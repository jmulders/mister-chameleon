-- migration 142 — visitor_profiles.personalization_group (randomized holdout)
--
-- "control" | "personalized". A deterministic % of visitors (per-tenant
-- personalizationHoldoutPct, default 0 = off) are assigned to a holdout that
-- receives the default, non-personalized experience — so the performance report
-- can measure true causal lift vs the personalized group. See docs/lead-base-design.md.

ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS personalization_group TEXT;
