-- migration 148 — enable RLS on tables that had none
--
-- ─── Waarom dit bestand pas nu bestaat ───────────────────────────────────────
--
-- Deze migratie is op 13 juni 2026 op productie toegepast via de Supabase-tool,
-- die hem in de ledger van de database schreef (versie 20260613122119) maar geen
-- bestand in deze repo achterliet. Daardoor bestond hij alleen daar. Zonder dit
-- bestand zou een verse database — staging, een branch, een herstel na verlies —
-- zonder RLS op onderstaande tabellen omhoogkomen, en zou niemand dat merken tot
-- het misging. De SQL hieronder is letterlijk teruggehaald uit
-- supabase_migrations.schema_migrations.
--
-- ─── Waarom een DO-blok en niet 19 kale ALTERs ───────────────────────────────
--
-- Het origineel was 19 losse `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Dat
-- werkte op productie omdat daar alle 19 tabellen staan. Maar zes ervan worden
-- door GEEN ENKELE migratie in deze repo aangemaakt:
--
--     _migrations, enrichment_price_cards, interest_profile_tags,
--     runtime_rules, tenant_search_settings, visitor_history
--
-- Ze zijn ooit met losse SQL ontstaan, buiten elke migratie om. Op productie
-- staan ze; in de repo bestaan ze niet. Een kale ALTER op `_migrations` zou dus
-- op elke verse database meteen falen, en daarmee de hele migratieketen breken.
--
-- Het DO-blok slaat over wat er niet is. Op productie verandert er niets: alles
-- staat er al en RLS staat al aan, dus dit is een no-op. Op een verse database
-- doet hij wat hij kan en gaat door.
--
-- LET OP: dit is een pleister, geen oplossing. Die zes tabellen horen alsnog als
-- inhaalmigratie in de repo. Zolang dat niet gebeurd is, kan deze repo je
-- productiedatabase niet opbouwen.

DO $$
DECLARE
  doelwit text;
BEGIN
  FOREACH doelwit IN ARRAY ARRAY[
    '_migrations',
    'adaptive_blocks',
    'behavior_scoring_rules',
    'behavior_sequence_patterns',
    'context_variable_metadata',
    'decay_profiles',
    'enrichment_price_cards',
    'form_submissions',
    'interest_profile_tags',
    'rate_limit_counters',
    'runtime_rules',
    'session_credit_balances',
    'session_credit_ledger',
    'tenant_domains',
    'tenant_form_overrides',
    'tenant_search_settings',
    'visitor_behavior_state',
    'visitor_history',
    'visitor_journey_events'
  ]
  LOOP
    IF to_regclass('public.' || quote_ident(doelwit)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', doelwit);
    ELSE
      RAISE NOTICE 'RLS overgeslagen: public.% bestaat niet in deze database', doelwit;
    END IF;
  END LOOP;
END $$;
