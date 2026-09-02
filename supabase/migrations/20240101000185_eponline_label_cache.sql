-- migration 185 — eponline_label_cache (EP-Online energielabel per adres, lazy cache)
--
-- Fase 3 van de location-enrichment-bronnen: RVO EP-Online energielabel per adres.
-- LAZY per-adres (mirror van bag_address_cache), NIET bulk — EP-Online heeft een
-- per-adres API. Keyed op een SHA-256 van "POSTCODE:huisnummer[:huisletter:toevoeging]"
-- — het ruwe adres (persoonsgegeven) wordt NOOIT opgeslagen, alleen de hash + de
-- label-feiten. Service-role only: RLS aan, geen policies (zelfde patroon als
-- bag_address_cache / cbs_area_stats). Additief + idempotent. Prod-SQL apart aan Jasper.
--
-- ⚠ Licentie: EP-Online is vrij te gebruiken BEHALVE het op individueel niveau aan
-- derden verstrekken. De ruwe klasse mag pas aan een bezoeker getoond worden als de
-- per-tenant flag `epLabelDisplayAllowed` aanstaat (na juridische aftik). De band +
-- interne signalen zijn wel altijd beschikbaar voor regels/AI.

CREATE TABLE IF NOT EXISTS eponline_label_cache (
  addr_hash            TEXT         NOT NULL,   -- sha256("POSTCODE:huisnummer[:huisletter:toevoeging]")
  energy_label         TEXT,                    -- ruwe klasse, bv. "A", "C" (gated voor weergave)
  energy_label_band    TEXT,                    -- afgeleid: "green" (A/B) | "amber" (C/D) | "red" (E/G)
  energy_index         NUMERIC,
  building_class       TEXT,                    -- "W" (woning) | "U" (utiliteit)
  gebouwtype           TEXT,
  bouwjaar             INTEGER,
  gebruiksoppervlakte  NUMERIC,
  energiebehoefte      NUMERIC,
  aandeel_hernieuwbaar NUMERIC,
  co2                  NUMERIC,
  geldig_tot           DATE,
  is_prive             BOOLEAN,                 -- registratie niet in open data → overslaan
  bag_vbo_id           TEXT,
  refreshed_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ,
  PRIMARY KEY (addr_hash)
);

COMMENT ON TABLE eponline_label_cache IS 'EP-Online (RVO) energielabel per adres, lazy per-request cache (Fase 3). Raw address never stored (addr_hash only). Raw label display-gated by tenant flag epLabelDisplayAllowed.';

ALTER TABLE eponline_label_cache ENABLE ROW LEVEL SECURITY;
