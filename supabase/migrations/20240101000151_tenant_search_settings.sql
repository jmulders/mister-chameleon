-- migration 151 — tenant_search_settings
--
-- Per-tenant configuratie van de zoekprovider (Sanity/Statamic search). Gelezen
-- door search/providers/index.ts, geschreven vanuit de admin op
-- /admin/tenants/[tenantId]/search, en bijgewerkt door de sanity-search webhook.
--
-- ─── Waarom dit bestand pas nu bestaat ───────────────────────────────────────
--
-- Deze tabel staat sinds onbekende datum in productie en werd door GEEN ENKELE
-- migratie aangemaakt — hij is ooit met losse SQL ontstaan, buiten versiebeheer
-- om. Ontdekt op 17 juli 2026 bij het rechttrekken van de migratie-ledger: van de
-- 19 tabellen in migratie 148 bleken er zes nergens in de repo voor te komen.
--
-- Vijf van die zes waren dood (geen code raakte ze aan). Deze niet: hij wordt op
-- vijf plekken in de code gebruikt. Dat betekende dat een verse database — een
-- staging-omgeving, een branch, een herstel na verlies — omhoog zou komen zonder
-- deze tabel, en dat de zoekinstellingen dan stuk zouden zijn op de eerste query.
-- Niemand had dat gemerkt, omdat er nooit een tweede omgeving is gebouwd.
--
-- De definitie hieronder is één-op-één overgenomen uit productie (kolommen,
-- defaults, primary key, RLS). Alles is IF NOT EXISTS, dus op productie is dit
-- een no-op; het enige effect is dat de tabel eindelijk in versiebeheer staat.
--
-- RLS staat aan zonder policies: alleen de service-role komt erbij, net als bij
-- de andere tenant-configuratietabellen.

CREATE TABLE IF NOT EXISTS public.tenant_search_settings (
  tenant_id  TEXT        NOT NULL,
  config     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id)
);

ALTER TABLE public.tenant_search_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tenant_search_settings IS
  'Per-tenant search provider config. Service-role only; RLS on with no policies.';
