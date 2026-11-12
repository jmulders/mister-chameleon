-- migration 187 — the plans give what the price list promises
--
-- The pricing page (billing/plans.ts) says:
--   Starter  rules, segments and experiments
--   Growth   + analytics dashboard, AI personalisation, CRM & ABM enrichment,
--            custom decay profiles
--   Pro      + multi-tenant agency management, priority support
--
-- What a tenant can actually use is decided by billing_plans.features, laid
-- over those static defaults. That row said otherwise: on production Growth had
-- no AI and no CRM/ABM enrichment, Pro had no multi-tenant management, and
-- Starter had no experiments. A customer got less than the page they bought
-- from. The seed in migration 065 had the same gaps, plus rule and experiment
-- caps (20 rules on Starter) where the page says "unlimited".
--
-- Only switches features ON and removes those two caps. Nothing a tenant has
-- today is taken away. Idempotent. Prod-SQL apart aan Jasper.

UPDATE billing_plans
SET features   = COALESCE(features, '{}'::jsonb) || '{"abExperiments":true,"adaptiveHomepage":true}'::jsonb,
    limits     = COALESCE(limits, '{}'::jsonb) - 'maxRules' - 'maxExperiments',
    updated_at = now()
WHERE plan_id = 'starter';

UPDATE billing_plans
SET features   = COALESCE(features, '{}'::jsonb) || '{"abExperiments":true,"analyticsDashboard":true,"aiDecisioning":true,"aiPersonalization":true,"crmAbmEnrichment":true,"customDecayProfiles":true}'::jsonb,
    limits     = COALESCE(limits, '{}'::jsonb) - 'maxRules' - 'maxExperiments',
    updated_at = now()
WHERE plan_id = 'growth';

UPDATE billing_plans
SET features   = COALESCE(features, '{}'::jsonb) || '{"abExperiments":true,"analyticsDashboard":true,"aiDecisioning":true,"aiPersonalization":true,"crmAbmEnrichment":true,"customDecayProfiles":true,"multiTenant":true,"prioritySupport":true}'::jsonb,
    limits     = COALESCE(limits, '{}'::jsonb) - 'maxRules' - 'maxExperiments',
    updated_at = now()
WHERE plan_id = 'pro';
