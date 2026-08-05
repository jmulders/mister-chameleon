-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0164 — visitor_behavior_state: rule_context (regels die context schrijven)
--
-- Problem:
--   Regels konden tot nu toe alleen een variant kiezen. De feature "regels die
--   context schrijven" laat een regel ook contextvariabelen zetten (eigen vlaggen
--   of overrides van afgeleide velden). Een sticky schrijf moet de sessie blijven
--   staan, zodat een latere paginaweergave/regel hem kan lezen (cross-view, het
--   twee-regel-ontwerp voor "hoge intentie bij binnenkomst").
--
--   Er is geen kolom om die sticky writes per sessie te persisteren.
--
-- Fix:
--   Voeg één jsonb-kolom rule_context toe aan visitor_behavior_state. Bevat
--   { "<key>": <string|number|boolean>, ... } — zowel eigen vlaggen als overrides
--   van registry-velden. Alleen sticky writes landen hier; niet-sticky writes
--   leven alleen binnen de request.
--
--   Idempotent (ADD COLUMN IF NOT EXISTS) en fail-open: een ontbrekende kolom
--   leest als {} (rowToJourneyState coalesced naar {}), en de sticky-persist doet
--   een aparte merge-write die de derive-payload niet raakt.
--
-- Columns added:
--   rule_context  — sticky contextvariabelen per sessie (jsonb, default '{}')
--
-- Draaien op dev (xqaeqbqjymeyxbvmhseg) en prod (kdhfpvjeriszteqhpgll) via deploy.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.visitor_behavior_state
  ADD COLUMN IF NOT EXISTS rule_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.visitor_behavior_state.rule_context IS
  'Sticky contextvariabelen die regels schrijven (eigen vlaggen + overrides van afgeleide velden). { key: string|number|boolean }. Alleen sticky writes; overlay gelezen vóór regel-evaluatie.';
