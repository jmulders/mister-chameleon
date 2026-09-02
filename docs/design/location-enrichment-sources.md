# Ontwerp — Locatie-verrijking uitbreiden (B2B publieke bronnen)

Status: **backlog / ontwerp** (nog niet gebouwd). Opgesteld 29 aug 2026.
Alle bronnen hieronder zijn geverifieerd (endpoints/licentie gecheckt, niet aangenomen).

## Doel

De CBS-buurt-enricher (`cbs-location`, dataset 85984NED) uitbreiden met rijkere
locatie-signalen die vooral voor **B2B**-personalisatie relevant zijn: pand-kenmerken,
energie, verduurzaming. Elke bron past in **hetzelfde lazy-enricher-patroon** dat we
al bouwden (adres/postcode → provider → cache in eigen tabel → per tenant aan/uit →
klein credit-event).

### Twee toegangsvormen
- **Per-request API** (zoals PDOK): live opzoeken per adres, cachen. Geschikt voor
  adres-precieze bronnen.
- **Bulk-ingest** (zoals de CBS-backfill): jaarlijks/maandelijks bestand in een eigen
  tabel laden, opzoeken op PC6/BAG-id. Geschikt voor bestand-bronnen.

### Input-precisie bepaalt bruikbaarheid
Adres-niveau-bronnen (BAG, EP-Online) vereisen het **échte adres** (postcode+huisnummer)
→ komt uit het **form-postcode-pad**, niet uit IP-geo (dat geeft alleen een grove buurt).
PC6/buurt-bronnen (netbeheerders, CBS) werken ook met grovere input.

---

## Bronnen (geverifieerd)

### 0. CBS 85984NED — extra velden (GEEN nieuwe bron, quick win)
Het dataset dat we **al** inladen heeft ~121 kolommen; we mappen er 4. Al aanwezig:
- **Energie:** `GemiddeldAardgasverbruik_55`, `GemiddeldeElektriciteitslevering_53`
- **Verduurzaming:** `WoningenMetZonnestroom_59` (% woningen met zonnestroom),
  `AardgasvrijeWoningen_57`, `PercentageWoningenMetStadsverwarming_56`
- **Vastgoed:** `GemiddeldeWOZWaardeVanWoningen_39`
- **Bedrijvigheid per sector:** `ALandbouwBosbouwEnVisserij_96` … `RUCultuurRecreatie…_103`
  (landbouw / nijverheid-energie / handel-horeca / vervoer-ICT / financieel-vastgoed /
  zakelijke dienstverlening / overheid-onderwijs-zorg / cultuur-recreatie)

Granulariteit: **buurt**. Kosten: **gratis** (al binnen). Werk: mapping + `$select`
verbreden (nu 10 kolommen) — geen nieuwe bron, geen nieuwe ingestie-infra.
Verticalen: breed; energie / zonne-installatie / vastgoed / verduurzaming in het bijzonder.

### 1. BAG — Basisregistratie Adressen en Gebouwen (Kadaster)
- **Geeft:** per pand/verblijfsobject — **bouwjaar**, **gebruiksdoel** (woning/kantoor/
  industrie/…), **oppervlakte**, status, geometrie/coördinaat.
- **Granulariteit:** **per adres/pand** (fijnst).
- **Kosten:** **gratis**. API-key vereist (gratis aan te vragen via formulier).
- **Toegang:** BAG API Individuele Bevragingen — `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/`
  (ook via `data.pdok.nl/bag/api/v1/`). Bedoeld voor 1-of-enkele objecten (**geen bulk**);
  limiet 50.000 bevragingen/dag, 50/sec → prima voor lazy per-adres-lookups.
- **Toegangsvorm:** per-request API (lazy, cachen — net als PDOK).
- **Verticalen:** vastgoed, facility, bouw/installatie, energie/verduurzaming, verzekeraars.

### 2. Netbeheerders (Liander / Stedin / Enexis) — kleinverbruik — ✅ GEBOUWD (Fase 2)
Opgeleverd. Tabel `pc6_energy_stats` (migratie 183), bulk-ingest
`npm run netbeheer:ingest` (URL per netbeheerder als `--source`/`--config`), lazy
enricher `enrichment/providers/netbeheer-energy.ts` (form-postcode-pad, PC6-range-
lookup), rule/AI/-velden `locationPc6AvgGasM3 / AvgElkKwh / SolarPct / SmartMeterPct`.
Start met Liander/Stedin/Enexis; overige 5 later via extra `--source`. Aan/uit per
tenant via stage-config `netbeheer-energy` (default via `NETBEHEER_ENERGY_ENABLED`).

- **Geeft:** **gas- en elektriciteitsverbruik per PC6** (kleinverbruik: huishoudens +
  klein-zakelijk). Geanonimiseerd, alleen PC6 met ≥10 aansluitingen.
- **Granulariteit:** **PC6** (postcode 6-posities).
- **Kosten:** **gratis**, CSV, **jaarlijks** vernieuwd.
- **Toegang:** open-data-pagina's van elke netbeheerder (Liander/Stedin/Enexis; totaal
  8 netbeheerders dekken heel NL). Bulk-CSV.
- **Toegangsvorm:** **bulk-ingest** in eigen tabel (zoals de CBS-backfill), opzoeken op PC6.
- **Let op:** alleen **kleinverbruik**; grootverbruik (zware B2B-panden) zit hier niet in.
- **Verticalen:** energie, zonne-installatie, verduurzaming.

**Ingest draaien (lokale / gezipte bestanden).** In de praktijk is de data géén
kant-en-klare directe CSV-URL: **Enexis** levert op aanvraag per e-mail (geen URL),
**Liander/Stedin** distribueren gezipte bestanden via JS-downloadpagina's. Daarom
neemt `npm run netbeheer:ingest` de bron zoals die écht binnenkomt:

- `--source <naam>=<bron>` waar `<bron>` een **URL** (http/https → gefetcht) of een
  **lokaal pad** is (gedownload/gemaild bestand, resolved t.o.v. de cwd).
- De bytes mogen een **ZIP**, een **.gz** of een **kale CSV** zijn — gedetecteerd op
  magic bytes (niet op extensie). Uit een ZIP wordt **elke `.csv`-entry** verwerkt
  (ELK/GAS mogen in aparte CSV's zitten; ze worden op postcode samengevoegd).
- De parser autodetecteert het scheidingsteken (tab / `;` / `,`) en matcht kolommen
  op **headernaam**, dus verschillen tussen netbeheerders vangt hij vanzelf op.

```bash
# gebruikelijke praktijk — lokaal opgehaalde / gemailde bestanden:
npm run netbeheer:ingest -- \
  --source liander=./data/liander_kv_2024.zip \
  --source stedin=./data/stedin_kv_2024.zip \
  --source enexis=./data/enexis_kv_2024.csv \
  --year 2024 --peildatum 2024-01-01
# resumable: klaar-gemelde netbeheerders worden overgeslagen; --reset forceert opnieuw.
```

### 3. EP-Online (RVO) — energielabels — ✅ GEBOUWD (Fase 3)
Opgeleverd — **lazy per-adres** (niet bulk; EP-Online heeft een per-adres API).
Tabel `eponline_label_cache` (migratie 185), enricher `eponline-label` (form-
postcode+huisnummer-pad, `EPONLINE_API_KEY` in Authorization-header), velden
`location_energy_label` (ruw, intern), `location_energy_label_band` (green/amber/
red), `location_energy_index`, `location_building_energy_demand`,
`location_renewable_share`, `location_energy_label_valid_until`. `is_prive`-
registraties worden overgeslagen. **Licentie-gate:** per-tenant flag
`epLabelDisplayAllowed` (default OFF) — band + interne velden altijd voor regels/AI,
maar de RUWE klasse verschijnt alleen naar de bezoeker als de flag aan is (pas na
juridische aftik van de individueel-aan-derden-licentie).

- **Geeft:** **energielabel per gebouw** (BAG-gekoppeld), meest recente geldige registratie.
- **Granulariteit:** **per adres/gebouw**.
- **Kosten:** **gratis**. Maandelijks totaalbestand (XML/CSV/XLSX, gesplitst woning/utiliteit)
  via 'Openbare Data', of mutatie-webservice via API-key (`epbdwebservices.rvo.nl`).
- **Toegangsvorm:** **bulk-ingest** (maandbestand) in eigen tabel, opzoeken op BAG-id/adres.
- **⚠ Licentie-caveat:** vrij te gebruiken, **behalve** het op **individueel niveau aan
  derden** verstrekken. Een exact label van één pand tónen aan een prospect (derde) kan
  dus beperkt zijn — voor interne signalen (band/aggregatie) prima, voor letterlijk
  weergeven aan een derde eerst juridisch aftikken.
- **Verticalen:** energie, verduurzaming, installatie, vastgoed.

---

## Randvoorwaarden (voor alle nieuwe enrichers)
- **Modulair per tenant** — losse enricher-stages, aan/uit per tenant op basis van hun
  verticaal (energie-tenant zet energie-enrichers aan; generieke SaaS niet). Zelfde
  `tenant_pipeline_stages`-patroon als `cbs-location`.
- **Klein, configureerbaar credit** per lookup (zoals `location_lookup`), via
  usage_events/wallet.
- **Consent** — gedekt bij consumptie onder enrichment-consent, net als CBS.
- **Fail-open** — geen verrijking bij fout/timeout, nooit de render breken.
- **Input** — adres-bronnen (BAG, EP-Online) leunen op het form-postcode-pad; PC6/buurt
  (netbeheer, CBS) werken ook op grovere input.

## Voorgestelde fasering

**Fase 0 — CBS-velden verbreden (quick win, geen nieuwe bron).**
Map de al-ingeladen energie/zonne/WOZ/sector-velden uit 85984NED. `$select` + mapping
uitbreiden; nieuwe rule-velden. Grootste waarde/inspanning-ratio.

**Fase 1 — BAG per-adres-enricher.** Gratis per-request API (key), fijnste granulariteit,
breed relevant (bouwjaar/functie/oppervlakte). Lazy-lookup zoals PDOK. Leunt op
form-adres-input.

**Fase 2 — Netbeheerder-PC6-energie.** ✅ **GEBOUWD.** Bulk-ingest (jaarlijks) zoals
de CBS-backfill; opzoeken op PC6. Voor energie/verduurzamings-verticalen. Migratie
183, `npm run netbeheer:ingest`, enricher `netbeheer-energy`. ⚠ Alleen
**kleinverbruik** (huishoudens + klein-zakelijk, tot 3×80A / G25) — grootverbruik
zit er niet in. PC6-granulariteit, naast de CBS-buurt-signalen.

**Fase 3 — EP-Online-energielabel.** ✅ **GEBOUWD** — lazy per-adres (EP-Online heeft
een per-adres API, dus géén bulk-ingest zoals eerst gedacht). Migratie 185,
enricher `eponline-label`. De ruwe klasse is display-gated achter de per-tenant flag
`epLabelDisplayAllowed` (individueel-aan-derden-licentie); band + interne velden vrij.

## Bronnen (verificatie)
- BAG API Individuele Bevragingen — Kadaster (gratis, 50k/dag).
- EP-Online / Openbare Data — RVO (gratis; caveat individueel aan derden).
- Kleinverbruik open data — Liander / Stedin / Enexis (gratis, PC6, jaarlijks).
- CBS 85984NED DataProperties (extra velden — geverifieerd tegen de live metadata).
