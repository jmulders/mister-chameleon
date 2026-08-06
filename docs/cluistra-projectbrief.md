# Cluistra: projectbrief (nieuwe tenant)

Eigen project, losse tenant. Aanhanger-dealer. Contextuele personalisatie op hun
eigen website via de Mister Chameleon snippet. Vier contexten: service, ondernemer,
particulier, default. De definitieve copy per variant komt van de merkstrateeg
vanuit het CSD; het platform houdt alleen de varianten vast.

## Contexten en regels (van de schrijver)

Volgorde is prioriteit. Eerste match wint. Holdout wordt voor alles geevalueerd.
R1 tot en met R3 gelden alleen op de homepage en de sectorpagina's, niet op
modelpagina's.

- R0 Uitsluiting: bot of crawler, of IP op uitsluitingslijst. Geen personalisatie,
  niet meetellen in scoreverdeling of holdout.
- R1 Service (prio 10): terugkerend, en in deze of een eerdere sessie minstens een
  van /onderhoud, /accessoires, /contact bezocht. Plakt vast zodra hij vuurt.
- R2 Ondernemer (prio 20): landing op sectorpagina, of model met massa >= 2000 kg,
  of categorie kipper of transporter. Plakt na twee bevestigende signalen.
- R3 Particulier (prio 30): landing op /keuzehulp, of /stock met status Occasion, of
  model met massa <= 1350 kg. Plakt na twee bevestigende signalen.
- R4 Notificatie (prio 40, los, draait naast de rest): tijd buiten ma-za
  08:00-17:30 geeft "buiten-openingstijden", anders "bel-ons". Tijdvenster vast voor
  de sessie.
- Default: geen match of holdout, alle blokken op hun default.

Varianten per blok: hero, features, social-proof, cta, notificatie.

## Wat kan het platform nu, wat moet gebouwd, wat komt van de klant

- Platform-native nu: bot-uitsluiting (isBot), holdout, terugkerend (visitType),
  sticky vlaggen via context-writes, tijdvenster (currentHour + dayOfWeek),
  pathname/entryPath-condities.
- Nieuw te bouwen (generiek, pas nodig vanaf fase 2): signaal-teller voor "sticky na
  N signalen", aparte notificatie-pass, IP-uitsluitingslijst, domein-attributen
  (massa, categorie, occasion) in de context.
- Van de klant: domein, sectorpaden, productdata voor de attributen, CSD-copy.

## Gefaseerde uitrol

- Fase 1: service vs default. Bijna volledig platform-native. R1 = terugkerend plus
  sticky "bezocht servicepagina"-vlag, gescoped op homepage en sectorpagina's,
  holdout ervoor. Meet eerst of de service-context vult.
- Fase 2: ondernemer. Gate op sectorpaden plus domein-attributen (klant-data) plus
  de signaal-teller.
- Fase 3: particulier. Idem, plus stock/occasion-status.
- Notificatie: aparte beslis-pass, tijdvenster. Kan los.

De professionele gebruiker laat je voorlopig samenvallen met de ondernemer. Hero
niet laten varieren op modelpagina's.

## Tenant-setup

1. Tenant aanmaken, slug cluistra.
2. Snippet op de website, origin-allowlist op het domein.
3. Holdout aanzetten (10%).
4. Path-tracking bevestigen: /onderhoud, /accessoires, /contact, /keuzehulp, /stock,
   en de sectorpaden.
5. Variant-copy per blok invoeren (merkstrateeg, CSD).

## Implementatiestatus (platform)

Bijgehouden naast de brief; de brief blijft leidend.

### Fase 1 — gebouwd + getest op dev (PR #135)

- **Service-variant-blueprint** in de platform-catalogus: `hero_service`,
  `proof_service` (social-proof), `cta_service`, `feature_service`. Content blijft
  tenant-specifiek (placeholder-richting tot de CSD-copy).
- **Config** (`decision/rules/cluistra-phase1.ts`):
  - Sticky context-write regel: `pathname in [/onderhoud, /accessoires, /contact]` en
    `isBot=false` schrijft `visited_service_page = true` (sticky, monotone — plakt over
    sessies heen).
  - R1 Service (prio 10): `visitType=returning` en flag `visited_service_page` en
    `pathname in [homepage + sectorpaden]` en `isBot=false` → service-varianten voor
    hero/proof/cta/feature.
  - Default = platform-defaults.
- **Holdout**: tenant-breed op 10% (`enrichment.personalizationHoldoutPct`); met R1 als
  enige serveerregel is dat R1's holdout.
- **Bot-uitsluiting**: `isBot=false` op de regels; het serveer-/meet-pad sluit bots
  sowieso uit.
- **Dev**: tenant `cluistra` aangemaakt, config weggeschreven (`homepage_cluistra`),
  gevalideerd in de echte rules-editor. 12 unit-tests groen.

### Nog nodig voor fase 1 (van de klant)

- Echte **sectorpaden** — nu placeholders (`/aanhangers`, `/sectoren/...`) in de
  `pathname`-allowlist.
- Het **klantdomein** voor de snippet + origin-allowlist.
- **CSD-copy** voor de vier service-varianten (nu placeholder-richting).
- Daarna: prod-tenant + config als idempotente SQL (niet direct naar prod).

### Fase 2/3 — nog te bouwen (generiek platform-werk)

Signaal-teller voor "sticky na N bevestigende signalen", domein-attributen (massa,
categorie, occasion/stock-status) in de beslis-context, een aparte notificatie-pass
(R4, tijdvenster), en de IP-uitsluitingslijst voor R0. Pas oppakken wanneer fase 1
meet dat de service-context vult.
