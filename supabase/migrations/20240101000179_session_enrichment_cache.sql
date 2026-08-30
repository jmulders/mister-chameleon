-- Shared, persistent session enrichment cache.
--
-- The session enrichment cache was process-local (an in-memory Map per Node
-- lambda). On Vercel, refreshes within one visitor session land on DIFFERENT
-- lambda instances, each with an empty Map, so the staged enrichment pipeline
-- re-ran per instance and fields flickered between requests (Leadinfo empty/full,
-- returningLeadStatus flipping, GA4 + CBS-location toggling).
--
-- This table is the SHARED L2 store: keyed on session_id, with ip + tenant_id for
-- the existing invalidation reasons (ip-changed / tenant-changed) and an
-- expires_at for TTL. The in-process Map stays as an L1 cache in front of it, so
-- a warm instance pays no DB read; a cold/other instance reads this shared row
-- instead of re-running the pipeline. `retry` marks a result from an INCOMPLETE
-- (transient-failure) run, stored with the short retry TTL.

create table if not exists public.session_enrichment_cache (
  session_id  uuid        primary key,
  tenant_id   text,
  ip          text,
  enrichment  jsonb       not null,
  retry       boolean     not null default false,
  cached_at   timestamptz not null default now(),
  expires_at  timestamptz not null
);

comment on table public.session_enrichment_cache is
  'Shared L2 cache of per-session staged-enrichment output (keyed on session_id). '
  'Fronted by an in-process L1 Map; rows expire at expires_at. Prevents cross-lambda '
  'flicker where each instance re-ran the pipeline with an empty in-memory cache.';

-- The read is a PK lookup (fast). This index serves the expired-row retention
-- sweep (delete where expires_at < now()).
create index if not exists session_enrichment_cache_expires_idx
  on public.session_enrichment_cache (expires_at);
