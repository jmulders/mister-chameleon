# Showcase — locatie-verrijking stuurt echte personalisatie (statamic)

Doel: laten zien dat de locatie-enrichment (BAG / CBS) écht personalisatie stuurt,
op het echte regel-pad. Vier voorbeeld-regels mappen nu-live locatiesignalen naar
bestaande variantkeys, met bijpassende Demo/scenario-presets zodat elke regel met
één klik demonstreerbaar is.

- Regels: `decision/rules/showcase/statamic-location-rules.ts`
  (`STATAMIC_LOCATION_SHOWCASE_RULES`).
- Presets: `components/scenario/scenario-presets.ts` (`loc_*`).
- Bewijs: `tests/rules/statamic-location-showcase.test.ts` (validate + config-health
  + firing).

Alle condities gebruiken **geregistreerde** `RuleFieldKey`-velden en alle
variantkeys staan in `ALLOWED_HERO/PROOF/CTA_KEYS` — anders verwerpt
`validateStoredConfig` de hele config. Priorities zijn uniek binnen de statamic-
config (medium_segmentation, 20–49), first-match.

## Signaal → variant → verhaal

| Preset (1-klik) | Signaal (conditie) | Variant (hero / proof / cta) | Verhaal | Prio |
|---|---|---|---|---|
| **Locatie · Verduurzaming B2B** | `locationBuildingUse == "kantoorfunctie"` **én** (`locationAvgGasUsage > 1500` **of** `locationSolarPct < 5`) | `hero_enterprise` / `proof_platform` / `cta_demo` | Kantoorpand dat veel gas gebruikt of weinig zon heeft → verduurzamings-/enterprise-hoek | 30 |
| **Locatie · Zakelijke dienstverlening** | `locationDominantBusinessSector == "business_services"` | `hero_saas_default` / `proof_saas_default` / `cta_saas_demo` | Buurt met dominante zakelijke dienstverlening → B2B-SaaS-hoek | 31 |
| **Locatie · Welvarende buurt** | `locationIncomeBand == "high"` **of** `locationAvgWozValue > 400000` | `hero_enterprise` / `proof_stats` / `cta_meeting` | Welvarende buurt → premium/enterprise-variant | 37 |
| **Locatie · Zonne-rijke buurt** | `locationSolarPct > 25` | `hero_consideration` / `proof_reassurance` / `cta_guide` | Veel zon-op-dak in de buurt → eigenaar/verduurzaming-hoek | 44 |

Elke preset zet de signalen via `enrichmentPatch` (raw `Partial<EnrichmentOutput>`
in `ctx.enrichment`), zodat de bijbehorende regel op het echte regel-pad vuurt en de
variant verschijnt in de scenario-console.

## Dev vs. prod

- **Dev**: de vier regels zijn in de statamic-`rules_config` geseed (43 regels totaal;
  unieke priorities geverifieerd, geen dubbele). De presets + regels + test zitten in
  deze PR.
- **Prod** (writes geblokkeerd — voor Jasper): voeg dezelfde vier regels toe aan de
  prod-`rules_config` (key `homepage_statamic`). JSON = `STATAMIC_LOCATION_SHOWCASE_RULES`
  (zie de module). Idempotente append (verwijder eerst bestaande `loc_showcase_*`):

  ```sql
  update rules_config
  set config = jsonb_set(
    jsonb_set(config, '{rules}',
      (select coalesce(jsonb_agg(r),'[]'::jsonb)
       from jsonb_array_elements(config->'rules') r
       where left(r->>'id',12) <> 'loc_showcase')
      || $rules$<JSON van STATAMIC_LOCATION_SHOWCASE_RULES>$rules$::jsonb),
    '{updatedAt}', to_jsonb(now()::text))
  where key = 'homepage_statamic';
  ```

  Draai daarna de config-health (of check: geen dubbele priorities).

## Uitbreiden zodra meer velden geregistreerd zijn

Deze set gebruikt alleen velden die nu in `FIELD_REGISTRY` staan (BAG + CBS Fase 0
energie/WOZ/sector). Zodra deze PR's gemerged zijn, kunnen extra stories erbij:

- **Netbeheer PC6** (`locationPc6SolarPct`, `locationPc6AvgGasM3`, …) — al geregistreerd
  (#357): een PC6-zon/gas-story kan toegevoegd.
- **CBS demografie** (#364: `locationPctHigherEducated`, `locationPctOwnerOccupied`,
  `locationMedianHouseholdWealth`, `locationCarsPerHousehold`, …) — welvaart/gezins-/
  opleidingsverhalen.
- **EP-Online** (#366: `locationEnergyLabelBand`) — energielabel-band-story (groen/amber/
  rood). ⚠ de ruwe klasse is display-gated (`epLabelDisplayAllowed`).
