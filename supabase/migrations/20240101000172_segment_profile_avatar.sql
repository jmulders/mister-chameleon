-- Configurable avatars for audience segments and interest profiles.
--
-- Adds a nullable `avatar` JSONB column to both tables. The value is a
-- discriminated union stored as-is by the admin save actions:
--   { "kind": "emoji", "value": "🎯", "color"?: "<token>" }
--   { "kind": "image", "url": "<asset url>" }
--   null / absent  → the deterministic name+seed avatar (unchanged behaviour)
--
-- Nullable and idempotent, so it is non-breaking: existing rows keep rendering
-- the deterministic avatar until an operator picks one.

alter table public.audience_segments add column if not exists avatar jsonb;
alter table public.interest_profiles  add column if not exists avatar jsonb;
