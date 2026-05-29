-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0126 — Interest Profiles: Mister Chameleon–specific catalog entries
--
-- Problem:
--   6 MC-specific interest profiles were added to interest-profiles/catalog.ts
--   (task #65) but never seeded via a SQL migration.  They only exist in code.
--   listActiveInterestProfiles() reads from the interest_profiles DB table, so
--   scoring always returned empty results → interestPrimary/Secondary/Confidence
--   were permanently null even after viewedKeywords were correctly populated.
--
-- Fix:
--   Upsert all 6 MC-specific profiles using ON CONFLICT on the partial unique
--   index (key WHERE tenant_id IS NULL) so the migration is safe to re-run.
--
-- Profiles added (all is_active = true, tenant_id = NULL = platform-wide):
--   personalization_seeker   — adaptive content / personalization researchers
--   conversion_optimizer     — CRO / A/B testing / growth focus
--   demo_intent              — strong demo or meeting booking signals
--   marketing_decision_maker — CMO / marketing leader platform evaluation
--   agency_partner_interest  — agency / bureau / white-label interest
--   saas_audience            — SaaS / scale-up personalizing their own site
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.interest_profiles
  (key, name, description, tags, is_active, tenant_id,
   family, recommended_site_models, default_status)
VALUES

('personalization_seeker', 'Personalization Seeker',
 'Visitor is actively researching website personalization, adaptive content, and contextual marketing technology.',
 '[
   {"keyword":"personalization","weight":2.5},
   {"keyword":"personalisatie","weight":2.5},
   {"keyword":"adaptive","weight":2.0},
   {"keyword":"contextual","weight":2.0},
   {"keyword":"personalised","weight":2.0},
   {"keyword":"gepersonaliseerd","weight":2.0},
   {"keyword":"how-it-works","weight":1.5},
   {"keyword":"decision engine","weight":2.0},
   {"keyword":"website personalization","weight":2.5},
   {"keyword":"dynamic content","weight":1.5},
   {"keyword":"dynamische content","weight":1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','agency','saas_product'], 'active'),

('conversion_optimizer', 'Conversion Optimizer',
 'Visitor is focused on improving conversion rates, A/B testing, and growth metrics — core MC value proposition.',
 '[
   {"keyword":"conversion","weight":2.5},
   {"keyword":"conversie","weight":2.5},
   {"keyword":"optimalisatie","weight":2.0},
   {"keyword":"optimization","weight":2.0},
   {"keyword":"cro","weight":2.5},
   {"keyword":"a/b","weight":2.0},
   {"keyword":"a/b testing","weight":2.0},
   {"keyword":"growth","weight":1.5},
   {"keyword":"groei","weight":1.5},
   {"keyword":"roi","weight":2.0},
   {"keyword":"lift","weight":1.5},
   {"keyword":"results","weight":1.5},
   {"keyword":"resultaten","weight":1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','agency','saas_product'], 'active'),

('demo_intent', 'Demo Intent',
 'Visitor shows strong signals of wanting to book a demo or see the product in action — has reached contact or pricing after exploring product content.',
 '[
   {"keyword":"demo","weight":2.5},
   {"keyword":"book","weight":2.0},
   {"keyword":"boeken","weight":2.0},
   {"keyword":"schedule","weight":2.0},
   {"keyword":"inplannen","weight":2.0},
   {"keyword":"meeting","weight":2.0},
   {"keyword":"afspraak","weight":2.0},
   {"keyword":"gesprek","weight":1.5},
   {"keyword":"see it live","weight":2.5},
   {"keyword":"live demo","weight":2.5},
   {"keyword":"in actie","weight":2.0},
   {"keyword":"contact","weight":1.0}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','agency','saas_product'], 'active'),

('marketing_decision_maker', 'Marketing Decision Maker',
 'Senior marketing stakeholder (CMO, Head of Marketing, Growth Lead) evaluating MC as a strategic platform investment — cross-visits pricing, cases, and about.',
 '[
   {"keyword":"cmo","weight":2.0},
   {"keyword":"marketing leader","weight":2.0},
   {"keyword":"head of marketing","weight":2.0},
   {"keyword":"strategy","weight":1.5},
   {"keyword":"strategie","weight":1.5},
   {"keyword":"enterprise","weight":2.0},
   {"keyword":"team","weight":1.0},
   {"keyword":"groeistrategie","weight":1.5},
   {"keyword":"growth strategy","weight":1.5},
   {"keyword":"marketing team","weight":1.5},
   {"keyword":"leadership","weight":1.0}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','agency'], 'active'),

('agency_partner_interest', 'Agency Partner Interest',
 'Marketing or digital agency exploring Mister Chameleon as a tool or white-label platform for their client portfolio.',
 '[
   {"keyword":"agency","weight":2.5},
   {"keyword":"bureau","weight":2.5},
   {"keyword":"partner","weight":2.0},
   {"keyword":"white-label","weight":2.5},
   {"keyword":"white label","weight":2.5},
   {"keyword":"reseller","weight":2.0},
   {"keyword":"voor bureaus","weight":2.5},
   {"keyword":"for agencies","weight":2.5},
   {"keyword":"klanten","weight":1.0},
   {"keyword":"clients","weight":1.0},
   {"keyword":"digitaal bureau","weight":2.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','agency'], 'active'),

('saas_audience', 'SaaS Audience',
 'SaaS company or scale-up exploring Mister Chameleon to personalise their own marketing site and improve trial-to-paid conversion.',
 '[
   {"keyword":"saas","weight":2.5},
   {"keyword":"software","weight":1.5},
   {"keyword":"scale-up","weight":2.0},
   {"keyword":"startup","weight":1.5},
   {"keyword":"product-led","weight":2.5},
   {"keyword":"plg","weight":2.5},
   {"keyword":"trial","weight":2.0},
   {"keyword":"free trial","weight":2.0},
   {"keyword":"gratis proberen","weight":2.0},
   {"keyword":"sign up","weight":1.5},
   {"keyword":"onboarding","weight":1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas','saas_product'], 'active')

ON CONFLICT (key) WHERE tenant_id IS NULL
DO UPDATE SET
  name                    = EXCLUDED.name,
  description             = EXCLUDED.description,
  tags                    = EXCLUDED.tags,
  is_active               = EXCLUDED.is_active,
  family                  = EXCLUDED.family,
  recommended_site_models = EXCLUDED.recommended_site_models,
  default_status          = EXCLUDED.default_status;

-- ── Summary ───────────────────────────────────────────────────────────────────
--
-- After this migration the full platform catalog has 26 profiles:
--   ACTIVE (18):
--     B2B / SaaS (5): pricing_focused, product_focused, use_case_focused,
--                     trust_focused, technical_focused
--     Careers    (3): candidate_explorer, job_specific_candidate, high_intent_applicant
--     Commerce   (3): product_explorer, deal_sensitive, high_purchase_intent
--     Real Estate(1): property_explorer
--     MC-specific(6): personalization_seeker, conversion_optimizer, demo_intent,
--                     marketing_decision_maker, agency_partner_interest, saas_audience
--   SUGGESTED (8): comparison_focused, roi_focused, employer_brand_interest,
--                  cart_ready, repeat_product_interest, buyer_intent,
--                  viewing_ready, investor_style_interest
