-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0098 — Fix scoring rules with score = 0
--
-- Problem:
--   Migration 038 seeded scoring rules by inserting into the `base_score`
--   column (legacy name).  Migration 070 later added the canonical `score`
--   column and attempted to backfill score ← base_score.  However, when
--   migrations were applied manually via the SQL editor and migration 070
--   ran before 038's seed data existed, the backfill was a no-op and the
--   seed rows were subsequently inserted with score = 0 (the column default).
--
-- Fix:
--   Update each known seed rule to its correct score value using the rule `key`
--   as the stable identifier.  ON CONFLICT is not needed — these are plain
--   UPDATEs and will silently do nothing if the key doesn't exist.
--
-- Safe to re-run: UPDATE ... WHERE key = '...' AND score = 0 is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Generic rules ─────────────────────────────────────────────────────────────

UPDATE behavior_scoring_rules SET score = 5   WHERE key = 'generic_homepage_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 3   WHERE key = 'generic_page_view'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'generic_highvalue_page'    AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'generic_cta_click'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 'generic_primary_cta_click' AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'generic_form_start'        AND score = 0;
UPDATE behavior_scoring_rules SET score = 80  WHERE key = 'generic_form_submit'       AND score = 0;
UPDATE behavior_scoring_rules SET score = 30  WHERE key = 'generic_download'          AND score = 0;
UPDATE behavior_scoring_rules SET score = 8   WHERE key = 'generic_repeat_page_view'  AND score = 0;
UPDATE behavior_scoring_rules SET score = 15  WHERE key = 'generic_multipage_session' AND score = 0;
UPDATE behavior_scoring_rules SET score = 18  WHERE key = 'generic_long_read'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 12  WHERE key = 'generic_video_play'        AND score = 0;
UPDATE behavior_scoring_rules SET score = 6   WHERE key = 'generic_scroll_deep'       AND score = 0;
UPDATE behavior_scoring_rules SET score = -10 WHERE key = 'generic_quick_exit'        AND score = 0;

-- ── B2B / SaaS rules ──────────────────────────────────────────────────────────

UPDATE behavior_scoring_rules SET score = 40  WHERE key = 'saas_pricing_view'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 30  WHERE key = 'saas_demo_request_view'    AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'saas_features_view'        AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'saas_case_study_view'      AND score = 0;
UPDATE behavior_scoring_rules SET score = 45  WHERE key = 'saas_demo_cta_click'       AND score = 0;
UPDATE behavior_scoring_rules SET score = 60  WHERE key = 'saas_trial_signup'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 100 WHERE key = 'saas_demo_form_submit'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 50  WHERE key = 'saas_contact_form_submit'  AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 'saas_integration_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'saas_blog_view'            AND score = 0;
UPDATE behavior_scoring_rules SET score = 15  WHERE key = 'saas_changelog_view'       AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'saas_docs_view'            AND score = 0;
UPDATE behavior_scoring_rules SET score = 40  WHERE key = 'saas_comparison_view'      AND score = 0;

-- ── Careers rules ─────────────────────────────────────────────────────────────

UPDATE behavior_scoring_rules SET score = 30  WHERE key = 'careers_jobs_view'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 45  WHERE key = 'careers_job_detail_view'   AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'careers_culture_view'      AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'careers_benefits_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 40  WHERE key = 'careers_apply_cta_click'   AND score = 0;
UPDATE behavior_scoring_rules SET score = 100 WHERE key = 'careers_application_submit' AND score = 0;
UPDATE behavior_scoring_rules SET score = 15  WHERE key = 'careers_team_view'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'careers_office_view'       AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 'careers_salary_view'       AND score = 0;

-- ── Commerce rules ────────────────────────────────────────────────────────────

UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'commerce_product_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 40  WHERE key = 'commerce_pdp_view'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 'commerce_add_to_cart'      AND score = 0;
UPDATE behavior_scoring_rules SET score = 45  WHERE key = 'commerce_checkout_start'   AND score = 0;
UPDATE behavior_scoring_rules SET score = 100 WHERE key = 'commerce_purchase'         AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 'commerce_wishlist_add'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 30  WHERE key = 'commerce_review_read'      AND score = 0;
UPDATE behavior_scoring_rules SET score = 15  WHERE key = 'commerce_compare_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = -15 WHERE key = 'commerce_cart_abandon'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 10  WHERE key = 'commerce_search'           AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 'commerce_sale_page_view'   AND score = 0;

-- ── Real Estate rules ─────────────────────────────────────────────────────────

UPDATE behavior_scoring_rules SET score = 30  WHERE key = 're_listing_view'           AND score = 0;
UPDATE behavior_scoring_rules SET score = 45  WHERE key = 're_detail_view'            AND score = 0;
UPDATE behavior_scoring_rules SET score = 25  WHERE key = 're_map_search'             AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 're_photo_gallery'          AND score = 0;
UPDATE behavior_scoring_rules SET score = 50  WHERE key = 're_virtual_tour'           AND score = 0;
UPDATE behavior_scoring_rules SET score = 40  WHERE key = 're_contact_agent_click'    AND score = 0;
UPDATE behavior_scoring_rules SET score = 100 WHERE key = 're_viewing_request'        AND score = 0;
UPDATE behavior_scoring_rules SET score = 20  WHERE key = 're_mortgage_calc'          AND score = 0;
UPDATE behavior_scoring_rules SET score = 35  WHERE key = 're_save_property'          AND score = 0;
UPDATE behavior_scoring_rules SET score = 15  WHERE key = 're_neighbourhood_view'     AND score = 0;
UPDATE behavior_scoring_rules SET score = 45  WHERE key = 're_price_drop_alert'       AND score = 0;

-- ── Demo tenant seed rows (migration 070 re-seed) ─────────────────────────────

UPDATE behavior_scoring_rules
SET score = 40
WHERE tenant_id = 'mister-chameleon'
  AND event_type = 'page_view'
  AND event_value = '/pricing'
  AND label = 'Pricing page view'
  AND score = 0;

UPDATE behavior_scoring_rules
SET score = 20
WHERE tenant_id = 'mister-chameleon'
  AND event_type = 'page_view'
  AND event_value = '/cases'
  AND label = 'Case study page view'
  AND score = 0;

UPDATE behavior_scoring_rules
SET score = 25
WHERE tenant_id = 'mister-chameleon'
  AND event_type = 'form_start'
  AND event_value IS NULL
  AND label = 'Form interaction started'
  AND score = 0;

UPDATE behavior_scoring_rules
SET score = 80
WHERE tenant_id = 'mister-chameleon'
  AND event_type = 'form_submit'
  AND event_value IS NULL
  AND label = 'Form submitted'
  AND score = 0;
