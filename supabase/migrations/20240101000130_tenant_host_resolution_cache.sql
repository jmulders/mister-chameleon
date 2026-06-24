-- migration 130 — tenant_host_resolution_cache
--
-- Persists the last-known-good RESOLVED tenant settings per public host. The
-- request tenant resolver (getActiveTenant) writes this on every successful
-- store-based domain match, and reads it on the degraded path BEFORE falling
-- back to FALLBACK_TENANT (mister-chameleon — a DIFFERENT site with a different
-- nav). This is what stops the "navigation flip-flop" where a known custom
-- domain (e.g. www.misterchameleon.nl) intermittently renders the platform
-- default nav after a transient DB miss on a cold serverless instance.
--
-- A host → tenant mapping is stable, so a persisted last-known-good is always
-- correct. Survives cold serverless starts, Data-Cache resets (revalidateTag on
-- every tenant save) and a slow/restarting database.

CREATE TABLE IF NOT EXISTS tenant_host_resolution_cache (
  host       TEXT        NOT NULL,
  settings   JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (host)
);
