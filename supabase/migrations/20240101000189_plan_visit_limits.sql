-- migration 189 — the plans hold the number of visits a B2B site really gets
--
-- The price list (billing/plans.ts) said 25,000 / 150,000 / 500,000
-- personalised visits a month for Starter / Growth / Pro. The owner's own site
-- counted 360 to 494 sessions a month from August to October 2026. At those
-- limits no B2B customer would ever outgrow Starter, so the two larger plans
-- only differed in features.
--
-- New limits, the owner's choice on 27 Nov 2026:
--   Starter   1,500
--   Growth    7,500
--   Pro      40,000
--
-- billing_plans.limits is what the session cap is computed from; the code
-- holds the same numbers as its fallback. Only the three plans the price list
-- sells are touched. There were no paying customers at the time: the two
-- subscriptions that existed were the owner's own tenants, on Pro.
--
-- Idempotent. Prod-SQL apart aan Jasper.

UPDATE billing_plans
SET limits     = COALESCE(limits, '{}'::jsonb) || '{"personalizedSessionsPerMonth":1500}'::jsonb,
    updated_at = now()
WHERE plan_id = 'starter';

UPDATE billing_plans
SET limits     = COALESCE(limits, '{}'::jsonb) || '{"personalizedSessionsPerMonth":7500}'::jsonb,
    updated_at = now()
WHERE plan_id = 'growth';

UPDATE billing_plans
SET limits     = COALESCE(limits, '{}'::jsonb) || '{"personalizedSessionsPerMonth":40000}'::jsonb,
    updated_at = now()
WHERE plan_id = 'pro';
