-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0038 — Behavioral Personalization Scoring Seed
--
-- Adds a practical, production-ready scoring ruleset for all four supported
-- site models: B2B/SaaS, Careers, Commerce, Real Estate.
--
-- Contents:
--   1. Decay profiles  — intent, engagement, friction, sequence, persistent
--   2. Generic scoring rules  — engagement, intent, form interactions
--   3. B2B / SaaS scoring rules
--   4. Careers scoring rules
--   5. Commerce scoring rules
--   6. Real Estate scoring rules
--   7. Generic sequences
--   8. Careers sequences
--   9. Commerce sequences
--  10. Real Estate sequences
--
-- All rules and sequences are inserted into the "mister-chameleon" tenant.
-- Use ON CONFLICT DO NOTHING so re-running the migration is safe.
--
-- Naming convention for keys:
--   generic_<action>           — site-model-agnostic rules
--   saas_<page_or_action>      — B2B / SaaS specific
--   careers_<action>           — Careers specific
--   commerce_<action>          — Commerce specific
--   re_<action>                — Real Estate specific
--   seq_generic_<pattern>      — Generic sequences
--   seq_careers_<pattern>      — Careers sequences
--   seq_commerce_<pattern>     — Commerce sequences
--   seq_re_<pattern>           — Real Estate sequences
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Schema self-heal (idempotent) ─────────────────────────────────────────
--
-- This migration seeds with the WIDE schema (key/name/description/base_score/…)
-- that later migrations (029/070) introduce. On a database where those hadn't
-- landed yet, the seeds below crash with 42703 (missing column) or 42P10
-- (missing ON CONFLICT arbiter). Ensure every column and unique index the seeds
-- rely on exists first — all IF NOT EXISTS, so this is safe on every database.
-- In particular, `name` is not added by 028/029, so we add it here.

ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS key           text,
  ADD COLUMN IF NOT EXISTS name          text,
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS page_category text,
  ADD COLUMN IF NOT EXISTS base_score    numeric(10,3),
  ADD COLUMN IF NOT EXISTS decay_profile text    NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority      integer NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX IF NOT EXISTS behavior_scoring_rules_tenant_key_uidx
  ON behavior_scoring_rules (tenant_id, key) WHERE key IS NOT NULL;

ALTER TABLE behavior_sequence_patterns
  ADD COLUMN IF NOT EXISTS slug                    text,
  ADD COLUMN IF NOT EXISTS key                     text,
  ADD COLUMN IF NOT EXISTS name                    text,
  ADD COLUMN IF NOT EXISTS description             text,
  ADD COLUMN IF NOT EXISTS confidence_contribution numeric(4,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cross_session           boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active               boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority                integer      NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX IF NOT EXISTS behavior_sequence_patterns_tenant_slug_uidx
  ON behavior_sequence_patterns (tenant_id, slug);

-- Legacy NOT-NULL columns that predate this wide seed (score on scoring_rules,
-- label on sequence_patterns) have no default, so inserts that only populate the
-- new columns (base_score, name) would hit 23502. Give them safe defaults.
-- Guarded per column → a no-op on a database where the column doesn't exist.
DO $$ BEGIN ALTER TABLE behavior_scoring_rules    ALTER COLUMN score SET DEFAULT 0;  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE behavior_sequence_patterns ALTER COLUMN label SET DEFAULT ''; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── 1. Decay Profiles ─────────────────────────────────────────────────────────
--
-- Rationale:
--   intent      standard  — pricing/product interest stays relevant ~7 days
--   engagement  slow      — deep engagement (downloads, long reads) signals
--                           sustained interest, half-life ~30 days
--   friction    fast      — confusion/bounces from last week don't matter today
--   sequence    slow      — completed journeys (pricing→contact) retain value
--   persistent  very slow — customer/account status and form submits last months

-- Guard: only insert if the slug column exists.
-- decay_profiles may exist without slug when CREATE TABLE IF NOT EXISTS in
-- migration 028 was a no-op (table pre-existed without the column).
-- Migration 070 adds the column and re-seeds; skip here to avoid a 42703 crash.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'decay_profiles'
      AND column_name  = 'slug'
  ) THEN
    INSERT INTO decay_profiles (slug, label, day_1, day_7, day_30, day_90)
    VALUES
      ('standard',   'Standard (7-day half-life)',        1.0, 0.70, 0.30, 0.10),
      ('fast',       'Fast (24h half-life)',               1.0, 0.40, 0.10, 0.00),
      ('slow',       'Slow (30-day half-life)',             1.0, 0.90, 0.60, 0.30),
      ('engagement', 'Engagement (sustained, 30-day)',     1.0, 0.85, 0.55, 0.20),
      ('friction',   'Friction (very fast, 2-day)',        1.0, 0.20, 0.05, 0.00),
      ('sequence',   'Sequence (slow, completed journeys)',1.0, 0.90, 0.70, 0.40),
      ('persistent', 'Persistent (months, account/CRM)',   1.0, 0.98, 0.90, 0.70)
    ON CONFLICT (slug) DO NOTHING;
  ELSE
    RAISE NOTICE 'decay_profiles.slug not yet present — skipping seed (migration 070 will add it)';
  END IF;
EXCEPTION WHEN not_null_violation THEN
  -- A later migration added a NOT NULL column to decay_profiles without a default.
  -- The rows already exist from a previous run — ON CONFLICT DO NOTHING would have
  -- skipped them, but Postgres validates new-row constraints before checking conflicts.
  -- Safe to skip: data is already present.
  NULL;
END $$;


-- ── 2. Generic Scoring Rules ──────────────────────────────────────────────────
--
-- These rules apply to all site models.  They establish baseline engagement,
-- intent, and friction scores that feed context signals like funnelStage,
-- intentScore, and engagementScore.

INSERT INTO behavior_scoring_rules (
  tenant_id, key, name, description,
  event_type, event_value, page_category,
  base_score, decay_profile, is_active, priority
)
SELECT
  'mister-chameleon',
  r.key, r.name, r.description,
  r.event_type, r.event_value, r.page_category,
  r.base_score, r.decay_profile, r.is_active, r.priority
FROM (VALUES

  -- Homepage / general page view (low signal, high volume)
  ('generic_homepage_view',
   'Homepage view', 'Visitor landed on the homepage.',
   'page_view', '/', NULL,
   5, 'standard', true, 100),

  -- Generic page view (any page not otherwise matched)
  ('generic_page_view',
   'Page view', 'Visitor viewed a page.',
   'page_view', NULL, NULL,
   3, 'standard', true, 200),

  -- High-value page view: pricing, contact, demo, etc.
  -- (covered by model-specific rules below — lower priority here)
  ('generic_highvalue_page',
   'High-value page view', 'Visited a high-intent page (pricing, demo, contact).',
   'page_view', NULL, 'high-intent',
   25, 'standard', true, 50),

  -- CTA click (all types)
  ('generic_cta_click',
   'CTA click', 'Clicked any CTA button.',
   'cta_click', NULL, NULL,
   20, 'standard', true, 30),

  -- Primary CTA click (specifically a "primary" tagged CTA)
  ('generic_primary_cta_click',
   'Primary CTA click', 'Clicked a primary CTA (high-intent action).',
   'cta_click', 'primary', NULL,
   35, 'standard', true, 20),

  -- Form start (any form)
  ('generic_form_start',
   'Form start', 'Visitor started filling out a form.',
   'form_start', NULL, NULL,
   25, 'fast', true, 25),

  -- Form submit (any form) — highest generic signal
  ('generic_form_submit',
   'Form submit', 'Visitor completed and submitted a form.',
   'form_submit', NULL, NULL,
   80, 'slow', true, 10),

  -- Download (content asset download — brochures, guides, etc.)
  ('generic_download',
   'Content download', 'Visitor downloaded a content asset.',
   'download', NULL, NULL,
   30, 'engagement', true, 35),

  -- Repeat visit (same session day)
  ('generic_repeat_page_view',
   'Repeat page view', 'Returning to a page visited earlier in the session.',
   'page_view_repeat', NULL, NULL,
   8, 'standard', true, 150),

  -- Multi-page session (3+ page views in session)
  ('generic_multipage_session',
   'Multi-page session', 'Visited 3 or more pages in a single session.',
   'session_multipage', NULL, NULL,
   15, 'engagement', true, 80),

  -- Long time-on-page (≥2 minutes)
  ('generic_long_read',
   'Long read', 'Spent 2+ minutes on a page — high engagement signal.',
   'time_on_page_long', NULL, NULL,
   18, 'engagement', true, 70),

  -- Video play
  ('generic_video_play',
   'Video play', 'Played an embedded video.',
   'video_play', NULL, NULL,
   12, 'engagement', true, 90),

  -- Scroll depth: 75%+
  ('generic_scroll_deep',
   'Deep scroll', 'Scrolled past 75% of a page.',
   'scroll_depth', '75', NULL,
   6, 'standard', true, 120),

  -- Bounce / quick exit — negative signal (use friction decay)
  ('generic_quick_exit',
   'Quick exit (friction)', 'Left the page in under 10 seconds — likely mismatch.',
   'quick_exit', NULL, NULL,
   -10, 'friction', true, 300)

) AS r(key, name, description, event_type, event_value, page_category,
       base_score, decay_profile, is_active, priority)
ON CONFLICT (tenant_id, key) WHERE key IS NOT NULL DO NOTHING;


-- ── 3. B2B / SaaS Scoring Rules ──────────────────────────────────────────────
--
-- High-signal pages for software evaluation cycles.
-- Assumes page categories: product, features, pricing, demo, trial, enterprise,
-- use-case, case-study, about, contact.

INSERT INTO behavior_scoring_rules (
  tenant_id, key, name, description,
  event_type, event_value, page_category,
  base_score, decay_profile, is_active, priority
)
SELECT 'mister-chameleon', r.key, r.name, r.description,
       r.event_type, r.event_value, r.page_category,
       r.base_score, r.decay_profile, r.is_active, r.priority
FROM (VALUES

  -- Product overview
  ('saas_product_view',
   'Product page view', 'Viewed the main product or features overview page.',
   'page_view', NULL, 'product',
   20, 'standard', true, 40),

  -- Feature detail page
  ('saas_feature_view',
   'Feature page view', 'Viewed a specific feature detail page.',
   'page_view', NULL, 'features',
   15, 'standard', true, 50),

  -- Use case page
  ('saas_use_case_view',
   'Use case page view', 'Viewed an industry or use-case landing page.',
   'page_view', NULL, 'use-case',
   18, 'standard', true, 45),

  -- Pricing page — top intent signal
  ('saas_pricing_view',
   'Pricing page view', 'Viewed the pricing page — high purchase intent.',
   'page_view', NULL, 'pricing',
   45, 'standard', true, 5),

  -- Demo request page
  ('saas_demo_view',
   'Demo page view', 'Visited the demo request or book-a-demo page.',
   'page_view', NULL, 'demo',
   50, 'standard', true, 8),

  -- Trial / signup page
  ('saas_trial_view',
   'Trial/signup page view', 'Visited the free trial or sign-up page.',
   'page_view', NULL, 'trial',
   55, 'standard', true, 6),

  -- Enterprise / custom-plan page
  ('saas_enterprise_view',
   'Enterprise page view', 'Viewed an enterprise or custom pricing page.',
   'page_view', NULL, 'enterprise',
   40, 'standard', true, 12),

  -- Case study / customer story
  ('saas_case_study_view',
   'Case study view', 'Read a customer success story or case study.',
   'page_view', NULL, 'case-study',
   22, 'engagement', true, 35),

  -- Demo CTA click
  ('saas_demo_cta',
   'Demo CTA click', 'Clicked a "Request a demo" or "Book a demo" CTA.',
   'cta_click', 'demo', NULL,
   55, 'standard', true, 3),

  -- Trial CTA click
  ('saas_trial_cta',
   'Trial CTA click', 'Clicked a "Start free trial" or "Try for free" CTA.',
   'cta_click', 'trial', NULL,
   60, 'standard', true, 2),

  -- Pricing CTA click
  ('saas_pricing_cta',
   'Pricing CTA click', 'Clicked a pricing plan or "Get started" on pricing.',
   'cta_click', 'pricing', NULL,
   50, 'standard', true, 4),

  -- Comparison / vs page
  ('saas_comparison_view',
   'Comparison page view', 'Viewed a competitive comparison or "vs" page.',
   'page_view', NULL, 'comparison',
   30, 'standard', true, 25),

  -- Integration / API docs
  ('saas_integration_view',
   'Integration/API view', 'Viewed integrations or developer API documentation.',
   'page_view', NULL, 'integrations',
   12, 'standard', true, 80)

) AS r(key, name, description, event_type, event_value, page_category,
       base_score, decay_profile, is_active, priority)
ON CONFLICT (tenant_id, key) WHERE key IS NOT NULL DO NOTHING;


-- ── 4. Careers Scoring Rules ──────────────────────────────────────────────────
--
-- Assumes page categories: jobs, job-detail, application, employer-brand.

INSERT INTO behavior_scoring_rules (
  tenant_id, key, name, description,
  event_type, event_value, page_category,
  base_score, decay_profile, is_active, priority
)
SELECT 'mister-chameleon', r.key, r.name, r.description,
       r.event_type, r.event_value, r.page_category,
       r.base_score, r.decay_profile, r.is_active, r.priority
FROM (VALUES

  -- Jobs overview page (browsing)
  ('careers_jobs_overview',
   'Jobs overview view', 'Visited the job listings overview page.',
   'page_view', NULL, 'jobs',
   10, 'standard', true, 60),

  -- Job detail page (showing specific interest)
  ('careers_job_detail',
   'Job detail view', 'Viewed a specific job listing page.',
   'page_view', NULL, 'job-detail',
   30, 'standard', true, 20),

  -- Job detail — multiple views (2+ different jobs)
  ('careers_multi_job_detail',
   'Multiple job detail views', 'Viewed 2+ different job detail pages (active explorer).',
   'page_view_repeat', NULL, 'job-detail',
   20, 'standard', true, 25),

  -- Application start
  ('careers_application_start',
   'Application start', 'Started filling in a job application form.',
   'form_start', 'application', NULL,
   60, 'fast', true, 5),

  -- Application submit (strong conversion signal)
  ('careers_application_submit',
   'Application submitted', 'Completed and submitted a job application.',
   'form_submit', 'application', NULL,
   100, 'persistent', true, 1),

  -- Recruiter contact (direct outreach)
  ('careers_recruiter_contact',
   'Recruiter contact click', 'Clicked a "Contact recruiter" or email recruiter link.',
   'cta_click', 'contact-recruiter', NULL,
   70, 'slow', true, 3),

  -- Apply button click
  ('careers_apply_cta',
   'Apply CTA click', 'Clicked an "Apply now" or "Apply" CTA on a job page.',
   'cta_click', 'apply', NULL,
   65, 'standard', true, 4),

  -- Employer brand / culture page
  ('careers_employer_brand',
   'Employer brand view', 'Visited a culture, team, or benefits page.',
   'page_view', NULL, 'employer-brand',
   12, 'engagement', true, 70),

  -- Save job (bookmark/save for later)
  ('careers_job_save',
   'Job saved', 'Saved a job to apply later.',
   'job_save', NULL, NULL,
   35, 'fast', true, 10)

) AS r(key, name, description, event_type, event_value, page_category,
       base_score, decay_profile, is_active, priority)
ON CONFLICT (tenant_id, key) WHERE key IS NOT NULL DO NOTHING;


-- ── 5. Commerce Scoring Rules ─────────────────────────────────────────────────
--
-- Assumes page categories: product-detail, category, cart, checkout.

INSERT INTO behavior_scoring_rules (
  tenant_id, key, name, description,
  event_type, event_value, page_category,
  base_score, decay_profile, is_active, priority
)
SELECT 'mister-chameleon', r.key, r.name, r.description,
       r.event_type, r.event_value, r.page_category,
       r.base_score, r.decay_profile, r.is_active, r.priority
FROM (VALUES

  -- Product detail page view
  ('commerce_product_detail',
   'Product detail view', 'Viewed a product detail page.',
   'page_view', NULL, 'product-detail',
   15, 'standard', true, 40),

  -- Product detail — multiple views (browsing multiple products)
  ('commerce_multi_product',
   'Multiple product views', 'Viewed multiple product detail pages.',
   'page_view_repeat', NULL, 'product-detail',
   10, 'standard', true, 50),

  -- Add to cart
  ('commerce_add_to_cart',
   'Add to cart', 'Added a product to the shopping cart — high intent.',
   'add_to_cart', NULL, NULL,
   55, 'fast', true, 5),

  -- Cart view
  ('commerce_cart_view',
   'Cart view', 'Viewed the shopping cart page.',
   'page_view', NULL, 'cart',
   35, 'fast', true, 10),

  -- Wishlist / save for later
  ('commerce_wishlist',
   'Wishlist add', 'Added a product to wishlist or saved for later.',
   'wishlist_add', NULL, NULL,
   25, 'engagement', true, 20),

  -- Checkout start
  ('commerce_checkout_start',
   'Checkout start', 'Began the checkout process.',
   'checkout_start', NULL, NULL,
   70, 'fast', true, 3),

  -- Checkout complete (conversion)
  ('commerce_checkout_complete',
   'Checkout complete', 'Completed a purchase — converted.',
   'checkout_complete', NULL, NULL,
   100, 'persistent', true, 1),

  -- Category browse
  ('commerce_category_browse',
   'Category page view', 'Browsed a product category page.',
   'page_view', NULL, 'category',
   8, 'standard', true, 80),

  -- Product search
  ('commerce_product_search',
   'Product search', 'Used the search function to find products.',
   'search', NULL, NULL,
   12, 'standard', true, 60),

  -- Review read
  ('commerce_review_read',
   'Review read', 'Read product reviews — research signal.',
   'page_view', NULL, 'reviews',
   10, 'standard', true, 70),

  -- Coupon / discount check
  ('commerce_coupon_check',
   'Coupon check', 'Checked for or applied a discount code — price-sensitive signal.',
   'coupon_check', NULL, NULL,
   20, 'fast', true, 30)

) AS r(key, name, description, event_type, event_value, page_category,
       base_score, decay_profile, is_active, priority)
ON CONFLICT (tenant_id, key) WHERE key IS NOT NULL DO NOTHING;


-- ── 6. Real Estate Scoring Rules ──────────────────────────────────────────────
--
-- Assumes page categories: property-detail, property-list, map, contact.

INSERT INTO behavior_scoring_rules (
  tenant_id, key, name, description,
  event_type, event_value, page_category,
  base_score, decay_profile, is_active, priority
)
SELECT 'mister-chameleon', r.key, r.name, r.description,
       r.event_type, r.event_value, r.page_category,
       r.base_score, r.decay_profile, r.is_active, r.priority
FROM (VALUES

  -- Property detail page view
  ('re_property_detail',
   'Property detail view', 'Viewed a property listing detail page.',
   'page_view', NULL, 'property-detail',
   20, 'standard', true, 30),

  -- Same property revisit (strong signal)
  ('re_property_revisit',
   'Property revisit', 'Returned to a previously viewed property listing.',
   'page_view_repeat', NULL, 'property-detail',
   35, 'standard', true, 10),

  -- Gallery interaction (photo/video browsing)
  ('re_gallery_interaction',
   'Gallery interaction', 'Interacted with property image gallery or video tour.',
   'gallery_interaction', NULL, NULL,
   30, 'standard', true, 20),

  -- Map interaction (exploring area)
  ('re_map_interaction',
   'Map interaction', 'Interacted with the property location map.',
   'map_interaction', NULL, NULL,
   15, 'standard', true, 50),

  -- Brochure / floorplan download
  ('re_brochure_download',
   'Brochure download', 'Downloaded a property brochure or floor plan.',
   'download', 'brochure', NULL,
   50, 'slow', true, 8),

  -- Viewing request / book appointment
  ('re_viewing_request',
   'Viewing request', 'Requested a property viewing appointment.',
   'form_submit', 'viewing', NULL,
   90, 'persistent', true, 1),

  -- Contact agent click
  ('re_contact_agent',
   'Contact agent click', 'Clicked to call or email the property agent.',
   'cta_click', 'contact-agent', NULL,
   60, 'slow', true, 3),

  -- Property shortlist / favourite
  ('re_property_save',
   'Property saved', 'Saved a property to shortlist or favourites.',
   'property_save', NULL, NULL,
   40, 'standard', true, 12),

  -- Multiple properties viewed in one session
  ('re_multi_property',
   'Multiple property views', 'Viewed 3+ property pages in one session — active explorer.',
   'page_view', NULL, 'property-list',
   10, 'standard', true, 60),

  -- Mortgage / finance calculator use
  ('re_finance_calc',
   'Finance calculator use', 'Used mortgage or stamp duty calculator — buyer signal.',
   'cta_click', 'calculator', NULL,
   25, 'standard', true, 35),

  -- School / area guide read
  ('re_area_guide',
   'Area guide read', 'Read local area or schools guide — buyer research.',
   'page_view', NULL, 'area-guide',
   12, 'engagement', true, 70)

) AS r(key, name, description, event_type, event_value, page_category,
       base_score, decay_profile, is_active, priority)
ON CONFLICT (tenant_id, key) WHERE key IS NOT NULL DO NOTHING;


-- ── 7–10. Sequences ──────────────────────────────────────────────────────────
--
-- Guard: behavior_sequence_patterns may exist without the extended columns
-- (slug, key, name, description, confidence_contribution, cross_session,
-- is_active, priority) when CREATE TABLE IF NOT EXISTS in migration 028 was
-- a no-op (table pre-existed with a narrower schema).
-- Migration 070 adds those columns and re-seeds; skip here to avoid 42703.
DO $seq_guard$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'behavior_sequence_patterns'
      AND column_name  = 'slug'
  ) THEN
    RAISE NOTICE 'behavior_sequence_patterns.slug not yet present — skipping sequence seed (migration 070 will add it)';
    RETURN;
  END IF;

-- ── 7. Generic Sequences ─────────────────────────────────────────────────────

INSERT INTO behavior_sequence_patterns (
  tenant_id, slug, key, name, description,
  sequence, max_gap_minutes, score, confidence_contribution,
  cross_session, is_active, priority
)
SELECT 'mister-chameleon', r.slug, r.key, r.name, r.description,
       r.sequence::jsonb, r.max_gap_minutes, r.score,
       r.confidence_contribution, r.cross_session, r.is_active, r.priority
FROM (VALUES

  -- Homepage → Pricing (fast intent signal)
  (
    'seq_generic_homepage_to_pricing',
    'seq_generic_homepage_to_pricing',
    'Homepage to Pricing',
    'Visitor went from homepage directly to pricing — high intent signal.',
    '[{"event_type":"page_view","event_value":"/"},{"event_type":"page_view","page_category":"pricing"}]',
    60, 30, 0.15, false, true, 10
  ),

  -- Pricing → Contact (near-conversion)
  (
    'seq_generic_pricing_to_contact',
    'seq_generic_pricing_to_contact',
    'Pricing to Contact',
    'Visited pricing then navigated to contact — very high conversion intent.',
    '[{"event_type":"page_view","page_category":"pricing"},{"event_type":"page_view","page_category":"contact"}]',
    120, 40, 0.25, true, true, 5
  ),

  -- Pricing → Form start (active conversion)
  (
    'seq_generic_pricing_to_form',
    'seq_generic_pricing_to_form',
    'Pricing to Form Start',
    'Went from pricing page to starting a contact or request form.',
    '[{"event_type":"page_view","page_category":"pricing"},{"event_type":"form_start"}]',
    120, 45, 0.30, true, true, 3
  ),

  -- Case study → Pricing (research to intent)
  (
    'seq_generic_case_to_pricing',
    'seq_generic_case_to_pricing',
    'Case Study to Pricing',
    'Read a case study then visited pricing — informed research → intent.',
    '[{"event_type":"page_view","page_category":"case-study"},{"event_type":"page_view","page_category":"pricing"}]',
    240, 35, 0.20, true, true, 8
  ),

  -- Multi-page + CTA click (broad engagement → action)
  (
    'seq_generic_multipage_cta',
    'seq_generic_multipage_cta',
    'Multi-page session → CTA click',
    'Viewed 3+ pages then clicked a primary CTA in the same session.',
    '[{"event_type":"session_multipage"},{"event_type":"cta_click"}]',
    60, 25, 0.15, false, true, 15
  )

) AS r(slug, key, name, description, sequence, max_gap_minutes, score,
       confidence_contribution, cross_session, is_active, priority)
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ── 8. Careers Sequences ──────────────────────────────────────────────────────

INSERT INTO behavior_sequence_patterns (
  tenant_id, slug, key, name, description,
  sequence, max_gap_minutes, score, confidence_contribution,
  cross_session, is_active, priority
)
SELECT 'mister-chameleon', r.slug, r.key, r.name, r.description,
       r.sequence::jsonb, r.max_gap_minutes, r.score,
       r.confidence_contribution, r.cross_session, r.is_active, r.priority
FROM (VALUES

  -- Jobs overview → Job detail (browsing to specific interest)
  (
    'seq_careers_jobs_to_detail',
    'seq_careers_jobs_to_detail',
    'Jobs Overview to Job Detail',
    'Browsed job listings then viewed a specific job — exploring intent.',
    '[{"event_type":"page_view","page_category":"jobs"},{"event_type":"page_view","page_category":"job-detail"}]',
    60, 25, 0.15, false, true, 20
  ),

  -- Job detail → Application start (active candidate)
  (
    'seq_careers_detail_to_apply',
    'seq_careers_detail_to_apply',
    'Job Detail to Application Start',
    'Viewed job detail then started an application — high intent candidate.',
    '[{"event_type":"page_view","page_category":"job-detail"},{"event_type":"form_start","event_value":"application"}]',
    120, 50, 0.35, true, true, 5
  ),

  -- Application start → Application submit (completed application)
  (
    'seq_careers_apply_complete',
    'seq_careers_apply_complete',
    'Application Start to Submit',
    'Started and completed a job application — strong conversion.',
    '[{"event_type":"form_start","event_value":"application"},{"event_type":"form_submit","event_value":"application"}]',
    60, 80, 0.50, false, true, 1
  ),

  -- Multiple job details → apply (active multi-role explorer)
  (
    'seq_careers_multi_detail_apply',
    'seq_careers_multi_detail_apply',
    'Multiple Job Views to Apply',
    'Viewed multiple job listings across sessions then applied — committed candidate.',
    '[{"event_type":"page_view","page_category":"job-detail"},{"event_type":"page_view","page_category":"job-detail"},{"event_type":"form_start","event_value":"application"}]',
    2880, 60, 0.40, true, true, 3
  )

) AS r(slug, key, name, description, sequence, max_gap_minutes, score,
       confidence_contribution, cross_session, is_active, priority)
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ── 9. Commerce Sequences ─────────────────────────────────────────────────────

INSERT INTO behavior_sequence_patterns (
  tenant_id, slug, key, name, description,
  sequence, max_gap_minutes, score, confidence_contribution,
  cross_session, is_active, priority
)
SELECT 'mister-chameleon', r.slug, r.key, r.name, r.description,
       r.sequence::jsonb, r.max_gap_minutes, r.score,
       r.confidence_contribution, r.cross_session, r.is_active, r.priority
FROM (VALUES

  -- Product detail → Add to cart
  (
    'seq_commerce_pdp_to_cart',
    'seq_commerce_pdp_to_cart',
    'Product Detail to Add to Cart',
    'Viewed a product then added it to cart — purchase intent.',
    '[{"event_type":"page_view","page_category":"product-detail"},{"event_type":"add_to_cart"}]',
    60, 45, 0.30, false, true, 5
  ),

  -- Cart view → Checkout start
  (
    'seq_commerce_cart_to_checkout',
    'seq_commerce_cart_to_checkout',
    'Cart View to Checkout Start',
    'Viewed cart then started checkout — near conversion.',
    '[{"event_type":"page_view","page_category":"cart"},{"event_type":"checkout_start"}]',
    30, 55, 0.40, false, true, 3
  ),

  -- Add to cart → Abandon (cart abandon signal)
  (
    'seq_commerce_cart_abandon',
    'seq_commerce_cart_abandon',
    'Cart Abandon Risk',
    'Added to cart but did not start checkout within 30 minutes.',
    '[{"event_type":"add_to_cart"},{"event_type":"page_view","page_category":"product-detail"}]',
    30, 20, 0.15, false, true, 10
  )

) AS r(slug, key, name, description, sequence, max_gap_minutes, score,
       confidence_contribution, cross_session, is_active, priority)
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ── 10. Real Estate Sequences ─────────────────────────────────────────────────

INSERT INTO behavior_sequence_patterns (
  tenant_id, slug, key, name, description,
  sequence, max_gap_minutes, score, confidence_contribution,
  cross_session, is_active, priority
)
SELECT 'mister-chameleon', r.slug, r.key, r.name, r.description,
       r.sequence::jsonb, r.max_gap_minutes, r.score,
       r.confidence_contribution, r.cross_session, r.is_active, r.priority
FROM (VALUES

  -- Property detail → Viewing request
  (
    'seq_re_detail_to_viewing',
    'seq_re_detail_to_viewing',
    'Property Detail to Viewing Request',
    'Viewed a property listing then requested a viewing — very high buyer intent.',
    '[{"event_type":"page_view","page_category":"property-detail"},{"event_type":"form_submit","event_value":"viewing"}]',
    240, 70, 0.45, true, true, 1
  ),

  -- Same property revisit → Contact agent
  (
    'seq_re_revisit_to_contact',
    'seq_re_revisit_to_contact',
    'Property Revisit to Contact Agent',
    'Returned to the same property then contacted the agent — ready to act.',
    '[{"event_type":"page_view_repeat","page_category":"property-detail"},{"event_type":"cta_click","event_value":"contact-agent"}]',
    480, 65, 0.40, true, true, 2
  ),

  -- Gallery → Brochure download (engaged researcher)
  (
    'seq_re_gallery_to_brochure',
    'seq_re_gallery_to_brochure',
    'Gallery to Brochure Download',
    'Browsed property gallery then downloaded a brochure — serious buyer.',
    '[{"event_type":"gallery_interaction"},{"event_type":"download","event_value":"brochure"}]',
    60, 40, 0.25, false, true, 8
  ),

  -- Finance calculator → Contact (buyer with affordability research)
  (
    'seq_re_calc_to_contact',
    'seq_re_calc_to_contact',
    'Calculator to Contact',
    'Used mortgage calculator then contacted agent — financially-aware buyer.',
    '[{"event_type":"cta_click","event_value":"calculator"},{"event_type":"cta_click","event_value":"contact-agent"}]',
    120, 50, 0.30, true, true, 5
  )

) AS r(slug, key, name, description, sequence, max_gap_minutes, score,
       confidence_contribution, cross_session, is_active, priority)
ON CONFLICT (tenant_id, slug) DO NOTHING;

END $seq_guard$;


-- ── Summary ───────────────────────────────────────────────────────────────────
--
-- Expected rows after this migration (ON CONFLICT = idempotent):
--
-- decay_profiles:              7  (3 existing + 4 new)
-- behavior_scoring_rules:     ~60  (14 generic + 13 SaaS + 9 careers + 11 commerce + 11 RE)
-- behavior_sequence_patterns: ~17  (5 generic + 4 careers + 3 commerce + 4 RE)
--
-- Acceptance criteria coverage:
--   A. generic scoring rules exist           ✓  (Section 2)
--   B. model-specific scoring rules exist    ✓  (Sections 3–6)
--   C. practical sequences exist             ✓  (Sections 7–10)
--   D. decay profiles exist                  ✓  (Section 1)
--   E. debug shows score/sequence contrib    → requires JourneyState extension (see lib/journey/)
