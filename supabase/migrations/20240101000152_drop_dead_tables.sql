-- migration 152 — drie dode tabellen droppen
--
-- ─── Wat dit is ──────────────────────────────────────────────────────────────
--
-- enrichment_price_cards, interest_profile_tags en runtime_rules stonden in
-- productie zonder door één regel code te worden gebruikt. Ontdekt op 17 juli
-- 2026 bij het rechttrekken van de migratie-ledger: ze werden door geen enkele
-- migratie aangemaakt (ooit met losse SQL ontstaan) en alleen genoemd in een
-- backuplijst waar ik ze zelf per ongelijk in had gezet.
--
--   • enrichment_price_cards — voorganger van enrichment_pricing (migratie 072),
--     dat op 7 plekken wordt bevraagd. Bevatte 6 verouderde prijsregels die
--     niemand las.
--   • interest_profile_tags — leeg.
--   • runtime_rules — leeg.
--
-- Gecontroleerd vóór het droppen: geen enkele foreign key in de database wijst
-- naar deze drie tabellen. Droppen trekt dus niets mee.
--
-- ─── Waarom geen IF NOT EXISTS-vangnet hier ─────────────────────────────────
--
-- Dit is de enige DESTRUCTIEVE migratie in de reeks. DROP TABLE IF EXISTS is
-- idempotent (tweede keer draaien = no-op), maar er is geen weg terug: de 6 rijen
-- in enrichment_price_cards zijn na deze migratie weg. Dat is de bedoeling — het
-- waren dode prijsregels — maar het staat hier expliciet zodat niemand denkt dat
-- dit per ongeluk kan zijn gebeurd.
--
-- CASCADE is bewust NIET gebruikt: als er ooit toch iets naar deze tabellen zou
-- verwijzen, wil ik dat de DROP faalt en het zichtbaar maakt, niet dat hij
-- stilzwijgend andere objecten meesleurt.

DROP TABLE IF EXISTS public.enrichment_price_cards;
DROP TABLE IF EXISTS public.interest_profile_tags;
DROP TABLE IF EXISTS public.runtime_rules;
