# CBS buurt-resolutie: adres vs. postcode

Hoe de CBS-location-enricher (`enrichment/providers/cbs-location.ts` +
`lib/enrichment/pdok-geocode.ts`) een CBS-**buurtcode** kiest uit een
form-provided locatie (`mc_loc`-cookie → `formLocation`).

## Precedentie (meest → minst precies)

1. **Volledig adres — postcode + huisnummer** → PDOK address-level lookup
   (`free?q="<postcode> <huisnummer>"&fq=type:adres&fl=id,buurtcode`). De
   `adres`-doc draagt zijn eigen `buurtcode`, dus dit is de **exacte** buurt van
   dat adres — géén centroid + reverse-geocode. `resolveBuurtcodeFromAddress`.
2. **Postcode-only** → forward-geocode de postcode naar zijn **centroid**, dan
   reverse-geocode de centroid naar een buurt (`type:buurt`).
3. **Plaats-only** → de woonplaats-centroid-buurt (grof, city-level).

Confidence blijft `high` voor postcode/adres, `low` voor plaats/GA4/IP-city.

## Waarom adres-niveau (fix)

Een PC6 (`3904BT`) kan meerdere buurten raken, en de **centroid** kan in een
buurbuurt of het centrum vallen. Bewijs (Peermos 3, Veenendaal):

| Methode | Resultaat |
|---|---|
| adres-lookup `q="3904BT 3"` `fq=type:adres` | **BU03450223** (Petenbos) — juist |
| postcode-centroid → reverse | grensgevoelig; landde eerder in **BU03450099** (Veenendaal-centrum) |

Daarom: als `formLocation` een **huisnummer** heeft, gaat resolutie via het
adres-niveau; alleen zónder huisnummer valt hij terug op de postcode-centroid
(en zónder postcode op de plaats-centroid). Een miss/transient op adres-niveau
valt netjes terug op de centroid, zodat we nooit een buurt verliezen.

## Huisnummer-flow (per-adres-enrichers)

Hetzelfde `huisnummer` voedt de per-adres-enrichers:

- **BAG** (`bag-location`) en **EP-Online** (`eponline-label`) — `shouldRun`
  vereist `formLocation.postcode && formLocation.houseNumber`.
- **Netbeheer PC6** (`netbeheer-energy`) — vereist alleen `formLocation.postcode`.

De keten is: form-submit → `formLocationFromValues(values)` (matcht de
veld-handles `postcode` / `huisnummer` / `woonplaats`) → `mc_loc`-cookie
(`{p,c,h}`) → `parseFormLocationCookie` → `formLocation` → `buildEnricherInput`.
De round-trip bewaart postcode én huisnummer 1-op-1 (regressietest in
`tests/enrichment/form-location.test.ts`). **Zorg dus dat een self-service
formulier de veld-handles `postcode` + `huisnummer` gebruikt** — anders vist
`formLocationFromValues` ze er niet uit en blijven BAG/EP-Online (en het
adres-niveau van CBS) leeg.

## Env-gates (géén code — Jaspers prod-env)

De per-adres-/PC6-enrichers zijn gegate in
`lib/enrichment/tenant-staged-enrichers.ts`:

| Enricher | Gate | Gevolg als uit |
|---|---|---|
| `bag-location` | `BAG_API_KEY` gezet | `locationBuildingUse/Year/AreaM2` null |
| `eponline-label` | `EPONLINE_API_KEY` gezet | EP-Online-velden null |
| `netbeheer-energy` | `NETBEHEER_ENERGY_ENABLED` gezet | **alle `locationPc6*` null** |

De netbeheer-enricher vuurt op het postcode-pad (geen huisnummer nodig); als
`locationPc6*` allemaal null zijn terwijl postcode aanwezig is, staat
`NETBEHEER_ENERGY_ENABLED` niet in de prod-env (env, geen code). Zet 'm aan ná
`npm run netbeheer:ingest`.
