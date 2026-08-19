-- Cluistra: rule "Large fleet (professional)" toevoegen
-- =====================================================
--
-- Context
--   Voegt EEN rule toe aan de Cluistra-rules (rules_config, key `homepage_cluistra`):
--   `cluistra.pro_wagenpark_nurture` op prioriteit 8. Die zit boven zowel
--   `cluistra.r1_service` (prio 10) als `cluistra.attr_ondernemer` (prio 16), zodat
--   een herkende groot-wagenpark/professioneel account het professionele plan krijgt
--   ook wanneer diezelfde bezoeker terugkerend is en eerder een servicepagina bezocht
--   (overlap-geval). Lager nummer = hogere prioriteit (first-match-by-priority).
--
-- Conditie (echte field-registry-veldnamen, geverifieerd)
--   ( companyMatchConfidence >= 0.6 OR leadinfoMatched = true )
--   AND ( leadinfoEmployeesTotal >= 50
--         OR leadinfoBranchCode IN [<gemeente/loonwerker SBI-codes, PLACEHOLDER>]
--         OR companyDomain    IN [<ABM fleet-accounts, PLACEHOLDER>] )
--   AND journey.funnelStage = "customer"
--
--   Match-gate is verbreed van single-source (alleen reverse-IP confidence) naar
--   beide enrichment-bronnen: een Leadinfo-only-herkenning (leadinfoMatched = true,
--   boolean in de registry) kwalificeert nu ook.
--
--   Let op t.o.v. de oorspronkelijke brief:
--   - `leadinfoEmployees` en `leadinfoSalesVolume` zijn in de registry STRING-velden
--     (buckets) zonder numerieke operator. De numerieke count is `leadinfoEmployeesTotal`
--     (die is hier gebruikt). De salesVolume-disjunct is bewust weggelaten: er is geen
--     numeriek omzet-veld om ">= 5.000.000" op uit te drukken; employeesTotal draagt het
--     omvang-signaal.
--   - "funnelStage" (derived) kent geen waarde "customer"; `journey.funnelStage`
--     (behavior) wel (awareness -> consideration -> intent -> high_intent -> customer).
--   - De branchecodes en de ABM-domeinlijst zijn PLACEHOLDERS; de klant vult die aan.
--   - fleet_service is fase 2 en zit hier niet in.
--
-- Veiligheid / guards
--   - Idempotent: draait de rule al (op id), dan doet dit niets (NOTICE, geen dubbele).
--   - Prioriteitsguard: is prio 8 al bezet door een ANDERE rule, dan BREEKT dit af met
--     een EXCEPTION en wordt niets geschreven. Reden: `validateStoredConfig` verwerpt de
--     HELE config bij een dubbele prioriteit, dus we mogen die situatie niet creeren.
--     Kies dan zelf een andere vrije prioriteit < 10 en pas `target_prio` + het
--     `"priority"`-veld in de JSON aan.
--   - De rules-config is app-side gecachet (unstable_cache, revalidate 120s). De nieuwe
--     rule is uiterlijk ~2 min na de write actief; direct verversen kan door in de
--     rules-editor eenmaal op te slaan (invalideert de cache-tag).
--
-- Draai dit op PROD (kdhfpvjeriszteqhpgll) zelf; wordt niet automatisch toegepast.
-- Reeds dev-first toegepast en geverifieerd op het dev-project.

-- 1) Read-only preview: huidige Cluistra-rules + is prio 8 vrij?
select r->>'id'                as id,
       (r->>'priority')::int   as priority,
       r->>'label'             as label
from rules_config, jsonb_array_elements(config->'rules') r
where key = 'homepage_cluistra'
order by priority;

-- 2) Guarded insert.
DO $$
DECLARE
  cfg          jsonb;
  rules        jsonb;
  target_id    text := 'cluistra.pro_wagenpark_nurture';
  target_prio  int  := 8;
  new_rule     jsonb := $rule$
  {
    "id": "cluistra.pro_wagenpark_nurture",
    "label": "Large fleet (professional)",
    "packId": "pack_behaviour",
    "source": "tenant",
    "enabled": true,
    "priority": 8,
    "precedenceLevel": "hard_state",
    "reason": "Recognised large-fleet / professional account (firmographics, optional ABM list). Placed above the returning-service rule (prio 10) and the trailer-attribute owner rule (prio 16): a fleet customer is often also a returning service visitor, and the professional experience must win in that overlap. The leadinfoSalesVolume disjunct from the brief was dropped because that registry field is a string with no numeric operator; leadinfoEmployeesTotal carries the size signal. Branch codes and the ABM domain list are placeholders for the client to fill. fleet_service is phase 2 and omitted.",
    "condition": {
      "type": "group",
      "logic": "and",
      "conditions": [
        { "type": "group", "logic": "or", "conditions": [
          { "type": "field", "field": "companyMatchConfidence", "operator": "greater_than_or_equal", "value": 0.6 },
          { "type": "field", "field": "leadinfoMatched", "operator": "equals", "value": true }
        ] },
        { "type": "group", "logic": "or", "conditions": [
          { "type": "field", "field": "leadinfoEmployeesTotal", "operator": "greater_than_or_equal", "value": 50 },
          { "type": "field", "field": "leadinfoBranchCode", "operator": "in", "value": ["PLACEHOLDER_SBI_GEMEENTE", "PLACEHOLDER_SBI_LOONWERKER"] },
          { "type": "field", "field": "companyDomain", "operator": "in", "value": ["placeholder-fleet-account-1.nl", "placeholder-fleet-account-2.nl"] }
        ] },
        { "type": "field", "field": "journey.funnelStage", "operator": "equals", "value": "customer" }
      ]
    },
    "plan": { "heroKey": "hero_consideration", "proofKey": "proof_cases", "ctaKey": "cta_meeting", "featureKey": "feature_service" }
  }
  $rule$::jsonb;
BEGIN
  SELECT config INTO cfg FROM rules_config WHERE key = 'homepage_cluistra';
  IF cfg IS NULL THEN
    RAISE EXCEPTION 'No rules_config row for homepage_cluistra; aborting.';
  END IF;
  rules := cfg->'rules';

  -- Idempotent: al aanwezig -> niets doen.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(rules) r WHERE r->>'id' = target_id) THEN
    RAISE NOTICE 'Rule % already present; nothing to do (idempotent).', target_id;
    RETURN;
  END IF;

  -- Prioriteitsguard: prio al bezet door een andere rule -> afbreken (geen dubbele prio).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(rules) r WHERE (r->>'priority')::int = target_prio) THEN
    RAISE EXCEPTION 'Priority % already in use for homepage_cluistra; pick another free priority below 10 (update target_prio and the JSON "priority"). Aborting to avoid a duplicate-priority config that validateStoredConfig would reject.', target_prio;
  END IF;

  UPDATE rules_config
     SET config = jsonb_set(cfg, '{rules}', rules || new_rule)
   WHERE key = 'homepage_cluistra';
  RAISE NOTICE 'Added rule % at priority %.', target_id, target_prio;
END $$;

-- 3) Read-only verificatie: de rule staat er nu op prio 8 (tussen 5 en 10).
select r->>'id'                as id,
       (r->>'priority')::int   as priority,
       r->>'label'             as label
from rules_config, jsonb_array_elements(config->'rules') r
where key = 'homepage_cluistra'
order by priority;
