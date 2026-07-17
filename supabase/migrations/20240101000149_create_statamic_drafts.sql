-- migration 149 — statamic_drafts
--
-- Kortlevende Statamic Live Preview-drafts (15 min TTL). Alleen benaderbaar met
-- de service-role: RLS staat aan zonder policies, dus de anon-key ziet niets.
--
-- ─── Waarom dit bestand pas nu bestaat ───────────────────────────────────────
--
-- Op 13 juni 2026 op productie toegepast via de Supabase-tool (ledger-versie
-- 20260613123400), zonder bestand in deze repo. De tabel stond dus wel in
-- productie maar nergens in versiebeheer. SQL letterlijk teruggehaald uit
-- supabase_migrations.schema_migrations — inclusief de IF NOT EXISTS-varianten,
-- dus op productie is dit een no-op.

CREATE TABLE IF NOT EXISTS public.statamic_drafts (
  token       text PRIMARY KEY,
  entry       jsonb NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS statamic_drafts_expires_at_idx
  ON public.statamic_drafts (expires_at);

ALTER TABLE public.statamic_drafts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.statamic_drafts IS
  'Short-lived Statamic Live Preview drafts (15 min TTL). Service-role only; RLS on with no policies.';
