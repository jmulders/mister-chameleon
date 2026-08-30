# Backlog — wat er nog ligt

*Interne status, tegenhanger van het naar-buiten-verhaal in
[`wat-we-hebben-gebouwd.md`](./wat-we-hebben-gebouwd.md). Eerlijk over wat gebouwd is,
wat klaarstaat maar niet aan staat, wat onbewezen is, en wat we nog gaan maken.*

Opgesteld 19 juli 2026. Vier categorieën, oplopend van "moet gefixt" naar "roadmap".

---

## A. Bugs om te dichten (hoogste prioriteit)

| # | Wat | Impact | Wie beslist | Status |
|---|---|---|---|---|
| A1 | ~~**Trial → abonnement-flow.**~~ Onderzocht (19 juli): de flow is structureel in orde (checkout `mode=subscription` + 14d trial → `session.subscription` gevuld → subscription-rij gemaakt); "nooit geconverteerd" kwam doordat er nooit een echte trial liep (testdata was opgeschoond). De echte gap — een converterende trial verankerde op een willekeurige dag i.p.v. de 1e — is **gefixt** (optie b: `trialConversionRealign()` + lus-guard + test). | Omzet | — | ✅ **Gedaan** |
| A2 | ~~**Tenants zonder subscription/wallet**~~ **Opgehelderd (19 juli):** `nascita` en `another-statamic` (Steunles) zijn **testaccounts** — geen billing nodig, bewust laten staan. De wallet-RPC maakt vanzelf een lege wallet bij eerste gebruik, dus er breekt niets. | Geen | Jij (beslist: testaccounts) | ✅ **Gedaan** |
| A3 | ~~**`scripts/backup.ts` verouderd**~~ **Gefixt (19 juli):** de eigen tabellenlijst (24 tabellen, met niet-bestaande namen als `tenants`/`scoring_rules`) is vervangen door een re-export van de canonieke `lib/backup/backup-tables.ts` (53 tabellen — één bron van waarheid). Plus: vier dynamische `.js`-imports in `backup.ts`/`bootstrap.ts` naar `.ts` gezet — dat was de "env.js not found"-crash tijdens de backup-run. | Backup dekt nu de volledige set | — | ✅ **Gedaan** |

## B. Gebouwd, maar niet aangezet (activeren)

| # | Wat | Impact | Wie beslist | Status |
|---|---|---|---|---|
| B1 | ~~**billing-renewal cron niet gewired**~~ **Aangezet (19 juli):** toegevoegd aan `vercel.json` (`5 0 * * *`). Financieel laag-risico: hij raakt alleen handmatig-beheerde subs (`stripe_subscription_id IS NULL`); de 2 echte subs zijn Stripe-native en worden overgeslagen, en er zijn 0 handmatige subs. **LET OP:** Vercel Hobby-plan staat beperkt aantal crons toe (~2) — er staan er nu 4. Verifieer na deploy in Vercel → Crons dat hij echt draait. | Autonome incasso op handmatige subs (nu: niemand) | Jij (aangezet) | ✅ **Gedaan** + verifiëren |
| B2 | ~~**`set-previews.yml` placeholder `CMS_REPO`**~~ **Ingevuld (19 juli):** `jmulders/mister-chameleon-cms` (afgeleid uit de remote van de cms-app-map). Werkt zodra het secret `CMS_REPO_TOKEN` (PAT met contents+PR-write) er is en de workflow handmatig/via een levende `develop` triggert. | Storybook-preview-flow | Jij (token nog toevoegen) | ✅ **Config gedaan**, token open |
| B3 | ~~**Staging-omgeving**~~ **Besluit (19 juli): nu niet.** Een 3e Supabase-project kan niet op de gratis tier (max 2 = prod + dev). Gekozen voor `main` + PR-review; `staging.yml` staat klaar voor de dag dat je upgradet. | — | Jij (besloten: nu geen staging) | ✅ **Besloten** |

## C. Gebouwd, maar onbewezen (valideren)

| # | Wat | Impact | Wie beslist | Status |
|---|---|---|---|---|
| C1 | **Web-sessie-facturatie** — de nieuwe tell.manier is live, maar het effect zie je pas over een maand data. | Kernmodel van de pricing | — | Meten over tijd |
| C2 | **Ad-sync naar advertentieplatforms** — gebouwd, niet aantoonbaar tegen de echte platforms getest. | Adaptive Intelligence-belofte | — | Live-test nodig |
| C3 | **Integratie- & E2E-tests** (18 juli opgezet) — skippen zichzelf zonder secrets; nog nergens groen tegen live infra. | Testdekking op DB/Stripe/AI/browser | — (secrets in CI) | Secrets wiren + draaien |

## D. Roadmap (nog te bouwen features)

| # | Wat | Impact | Wie beslist | Status |
|---|---|---|---|---|
| D1 | **AI-generatieketen doortrekken** — volgende stap: voorgestelde varianten en regels. **Richtlijn (19 juli): heel beperkt, kostenbewust** — alleen op afroep (mens drukt de knop), één AI-call per keer, bestaande credit-metering als rem, géén automatische publicatie. | Productbelofte AI Generation, met kostenrem | Jij (richtlijn gezet) | Eigen ontwerptraject |
| D2 | **Chameleon Connect voor WordPress** — PHP-plugin die de snippet inpakt: install, slot-marking (block/shortcode/selector), consent-integratie. **Platform-deel gebouwd (19 juli):** snippet doet selector-support (`selectors`-map, ongeldige selector wordt genegeerd), de decide-route stuurt de `selectorMap` uit de tenant-config mee, én er is nu een **admin-UI** (Snippet → tab "Selectors") om die map zonder DB-geknutsel te beheren — met tests op de sanitisatie. Zo werkt de no-touch WordPress-route volledig vanuit de admin. Rest is de aparte PHP-repo (`mister-chameleon-wordpress`): auto-install/enqueue, shortcode + Gutenberg-block, consent-integraties. **Ontwerp: `docs/design/snippet-wordpress-plugin.md`.** | Bereik: 's werelds populairste CMS | — | 🔨 Platform-kant klaar, PHP-plugin volgt |
| D3 | **Snippet render-modes + design tokens** — per-variant toggle tussen content-swap (default) en gestyled block met huisstijl via tokens. **Snippet + contract + datamodel gebouwd (19 juli):** snippet doet block-mode (`data-mc-block`, HTML-injectie, tokens als scoped CSS-vars); response-contract laat blocks toe (`SlotValue = string \| BlockSlot`); `renderMode`/`blockHtml` staan op **alle zes** blokken (hero, cta, proof, feature, conversion, notification) en de decide-route emit voor elk een block-slot (`slots.hero`/`.cta`/`.proof`/`.feature`/`.conversion`/`.notification`) met de tokens uit `tokenRef` als CSS-vars — alles met tests. Conversion/notification kregen ook meteen een `tokenRef`. **Resteert:** (1) blocks *authoren* — `blockHtml`/`renderMode` invullen in de CMS-repo's (Statamic e.a.) + admin-toggle; (2) AI-generatie een block laten leveren (haakt op D1). **Ontwerp: `docs/design/snippet-render-modes.md`.** | Rijkere personalisatie op externe sites, on-brand | — | 🔨 Platform-kant compleet (alle 6 blokken), authoring volgt |
| D4 | **Locatie-enricher: PC4-bulk-upgrade (later).** De huidige CBS-locatie-enricher (#309) draait op **Optie B**: live OData `Kerncijfers wijken en buurten` (`85984NED`), **buurt-gekeyd**, inkomen + bedrijvigheid native + urbanity als dichtheids-proxy (`Bevolkingsdichtheid_34`), reverse-geocode lat/long → buurtcode via PDOK. Bewust licht gehouden: geen bulk-downloads, onderhoudsarm. **Reden:** er bestaat géén CBS-OData-tabel met stedelijkheid + inkomen + bedrijvigheid per PC4; die rijke kerncijfers zijn alleen download-bestanden (Excel/GeoPackage). **De upgrade** = doen wat allecijfers.nl doet: de CBS-bulkbestanden ("Kerncijfers per postcode" PC4 + wijken/buurten) jaarlijks binnenhalen en offline mergen → echte **PC4-granulariteit + officiële stedelijkheidsklasse + alle drie de attributen**. Kosten: jaarlijkse file-pipeline, twee keys mergen, schema-drift opvangen. **Alleen bouwen bij een concrete trigger** (een tenant die écht PC4-precisie of de stedelijkheidsklasse nodig heeft). De raw-row + config-structuur van #309 maken deze upgrade mogelijk zonder de enricher om te gooien. | Fijnere locatiesignalen, mits een klant het nodig heeft | Jij (trigger nodig) | ⏸️ Backlog — niet nu bouwen |
| D5 | **Locatie-verrijking uitbreiden (B2B publieke bronnen).** Rijkere per-locatie-signalen naast de CBS-buurt, in hetzelfde lazy-enricher-patroon. Geverifieerde bronnen: **CBS 85984NED extra velden** (energie/zonne/WOZ/sector — al ingeladen, alleen mapping verbreden), **BAG** (Kadaster, per-adres bouwjaar/gebruiksdoel/oppervlakte, gratis API), **netbeheerders** (Liander/Stedin/Enexis, gas+elektra per PC6, gratis bulk), **EP-Online** (RVO energielabel per gebouw, gratis bulk — ⚠ licentie-caveat individueel-aan-derden). Modulair per tenant-verticaal; adres-bronnen leunen op het form-postcode-pad. Fasering + details: **`docs/design/location-enrichment-sources.md`**. | B2B-personalisatie op pand/energie/verduurzaming | Jij (welke verticaal eerst) | ⏸️ Backlog — ontwerp klaar |
| D6 | **Ad-click-ID-resolutie-enricher.** Click-IDs worden al gevangen (gclid/fbclid/msclkid/ttclid in detect-context) + opgeslagen in visitor_profiles; de ads-attributie-enricher leidt campagne/keyword nu alleen uit UTM's af. Deze feature resolvet het click-ID tegen de platform-API naar rijke ad-data (keyword/match type/device/audience). **Geverifieerde realiteit:** alleen **Google Ads (gclid, via click_view)** en **Microsoft Ads (msclkid)** zijn inbound-resolvbaar; **Meta/LinkedIn/TikTok click-IDs zijn outbound-only** (conversies) — daar blijven UTM's de bron. Per-tenant OAuth-integratie (geen open data), ~48u latency → cachen. Fasering + auth-model: **`docs/design/ad-click-id-resolution.md`**. | Rijkere ad-attributie voor Google/MS-Ads-tenants | Jij (per-tenant ad-account nodig) | ⏸️ Backlog — ontwerp klaar |
| D7 | **Config-intelligence — twee sporen (harde scheiding: logica waar het kan, AI waar het over betekenis gaat).** **Spoor 1 — config-health/linter (near-term, deterministisch, geen AI):** priority-conflicten/dubbele priorities (vóór `validateStoredConfig` de hele config afkeurt), onbereikbare/geschaduwde regels (first-match), condities die nooit waar worden, dode varianten, nooit-vurende regels (via `rule_fire_daily`). Bespaart direct fouten, geen schaal nodig. **Spoor 2 — context-intelligence (roadmap, AI):** offline/batch, geaggregeerd (geen PII), op afroep, kostenbewust — contexten clusteren/reduceren, in gewone taal uitleggen (klaar voor een kwartaalgesprek), cross-tenant patronen (voedt de bibliotheek-route). Adviseert, beslist niet. Ontwerp: **`docs/design/config-intelligence.md`**. | Minder config-fouten (nu) + overzicht/uitleg (later) | Jij (spoor 2 = trigger) | ⏸️ Backlog — ontwerp klaar (spoor 1 near-term) |
| D8 | **Back-office-koppeling + form-prefill voor known leads.** Bouwt op het bestaande ABM-known-lead-systeem (`/go/{token}` → `mc_lead`-cookie, `apply-known-lead.ts` firmografie/segment-hint, `visitor_profiles.abm_lead_id`). **Mist:** (1) een **back-office-sync-API** — `POST /api/abm/leads` (per-tenant API-key): `external_id`-upsert van firmografie + contact + doelpagina → geeft het **handle** (`/go/{handle}`) terug zodat de back-office/CRM zelf de mail-links bouwt en de mapping `external_id ↔ handle` houdt; (2) **form-prefill** voor bekende leads (consent-gated, korte geldigheid, overweeg eenmalige tokens los van het 30d-handle wegens PII-forwarding-risico). Fasering: sync-API dan prefill. Ontwerp: **`docs/design/backoffice-lead-coupling.md`**; sync-API-contract: **`docs/abm-backoffice-sync-api.md`**. | Naadloze back-office→gepersonaliseerde-mail-flow | Jij (back-office-integratie) | 🚧 Fase 1 (sync-API) gebouwd — migratie 182, `POST /api/abm/leads`, per-tenant API-key; fase 2 (form-prefill) backlog |
| D9 | 💡 **Enrichment-laag als losstaand product (geparkeerd — alleen een idee).** De staged enrichment-pijplijn (geo MaxMind+IPinfo, company/CRM, CBS-locatie, weer, ads-attributie) + first-party stores (`ip_company_cache`, `cbs_area_stats`, sessie-cache) zou als **standalone enrichment-API/product** kunnen bestaan, los van de personalisatie-SaaS. Nu niet uitwerken; genoteerd zodat het niet verdwijnt. | Potentieel tweede product/omzetlijn | Jij (los idee) | 💡 Geparkeerd — geen ontwerp, niet nu |

---

## E. Routekeuze — sitebouw als distributie

Naar aanleiding van het advies van 1 augustus.

**Besloten (1 augustus).**

- **De sitebouwer blijft.** Stond eerder op "eerst uitzoeken of er een klantsite op draait,
  dan schrappen", op de aanname dat het onderhoud kost zonder strategisch rendement. Dat
  advies is ingetrokken. Zodra sitebouw een route is, is de bibliotheek geen kostenpost maar
  het distributiekanaal. De rij staat nu op "houden, want dit is hoe klanten binnenkomen".
- **Sitebouw is erkend als echte, derde route.** Elke nieuwe site die we bouwen is standaard
  adaptief, dus niemand hoeft personalisatie apart te kopen — het komt mee. De klant vroeg al
  om een website; de adaptieve laag is dan geen aparte beslissing maar een eigenschap. Dat is
  de goedkoopste weg naar een eerste live installatie, en precies waarom Olyslager de logische
  eerste is: daar wordt de site sowieso gebouwd.

**Randvoorwaarden bij die route (blijven staan).**

- **Niet in dezelfde deck of hetzelfde gesprek als de propositie van vandaag.** Vandaag:
  "je hebt geen nieuwe website nodig, je bestaande site wordt slimmer" — lage drempel,
  marketingverantwoordelijke, maandbedrag. De sitebouw-route: "wij bouwen je nieuwe site
  sneller en hij is meteen adaptief" — websiteproject, andere koper, ander bedrag, andere
  verkoopmotie. Beide kunnen, niet door elkaar.
- **Vorm reist mee, bewijs niet.** Een blok hergebruiken mag; wat bij klant A werkte, is niet
  bewezen bij klant B. De bibliotheek wordt sterker in vorm, niet in bewijskracht.
- **Snelheid is niet het verdedigbare deel.** Snel worden in standaardsites is snel worden in
  precies het deel waarvan de prijs wegzakt zodra concurrenten het ook kunnen. Verdedigbaar
  blijft de adaptieve laag en het denkwerk erachter.
- **Gebouwd is niet gekozen.** Het onderhoud van drie bibliotheken loopt door of we de route
  nu bewandelen of niet — dat het bestaat maakt de keuze goedkoper, niet overbodig.

**Nog te kiezen (september).** Niet alleen wie het koopt, maar of de adaptieve laag een dienst
is die je apart verkoopt of een eigenschap van elke site die we bouwen. Het tweede is
commercieel makkelijker en levert minder marge per klant. Echte afweging, geen detail.

**Besloten (2 augustus) — content-herkomst.** De adaptieve varianten voor het snippet
(externe sites) komen platform-native: de snippet-decide leest ze eerst uit de
platform-store, met fallback naar de tenant-CMS. Geïmplementeerd in
`cms/providers/platform-first-variants.ts`. Zie `docs/adaptive-content-architecture.md`.
Platform-native is daarmee de **default**.

**Nog te kiezen (september) — wat doen we met de externe-CMS-koppeling?** Het kunnen
leveren van variant-content uit een externe CMS (Sanity/Statamic/Storyblok). Drie opties.

*Optie A — houden en actief aanbieden.* Klanten mogen hun eigen CMS houden voor de
adaptieve content; wij koppelen. Logische vorm: alleen boven een bepaald pakket of tegen
meerprijs.
- Voor: sterkste "je hoeft niks te migreren, ook je content niet"-argument; past bureaus
  en enterprises die hun redactie niet opgeven; extra omzetregel.
- Tegen: je onderhoudt drie koppelingen als product (doorlopend werk); meer support en
  meer dat kan breken in het hete pad; je moet het écht verkopen om het terug te verdienen.

*Optie B — alleen platform-native, koppeling uitfaseren.* Eén verhaal: adaptieve content
maak je bij ons.
- Voor: minste onderhoud; simpelste propositie en demo; geen driewegverwarring meer.
- Tegen: je verliest het argument dat de klant ook zijn content niet hoeft te verplaatsen;
  minder aantrekkelijk voor partijen met een grote bestaande redactie.

*Optie C — houden maar niet verkopen.* Laat de koppeling bestaan voor het platform-gehoste
model (hele site incl. varianten uit hun CMS), maar zet 'm niet als verkoopargument neer.
- Voor: geen kostenpost die je actief moet terugverdienen; blijft beschikbaar als een klant
  er echt om vraagt.
- Tegen: je onderhoudt iets dat je niet te gelde maakt; "grijze" positie die makkelijk
  verwatert, want niemand is eigenaar van de keuze.

De kern: drie CMS-bibliotheken onderhouden is doorlopend werk — verdedigbaar zodra een klant
ervoor betaalt (A), kostenpost zolang niemand erom vraagt (C), of weg te snijden voor rust
(B). Het hangt aan de betaal-/pakketkeuze én aan hoeveel prospects écht hun eigen CMS willen
houden; dat laatste wordt meetbaar zodra je de eerste gesprekken voert.

---

## Voorgestelde volgorde

Van concreet-en-nu naar groot-en-strategisch:

1. **A1 Trial-flow** — de omzet-bug, concreet in code, direct te onderzoeken en te fixen.
2. **A2 + A3** — datacontrole op de losse tenants, en het backup-script gelijktrekken met
   `lib/backup/backup-tables.ts`. Kleine, veilige wins.
3. **C3 Tests in CI** — de secrets voor de integratietests in een aparte CI-job zetten, los
   van de gate. Maakt C1/C2 op termijn ook toetsbaar.
4. **B1/B2/B3** — activeren, maar elk met een besluit van jou (billing-renewal is financieel,
   staging kost een project, set-previews vraagt een repo-naam).
5. **D1 AI-generatie** — als eigen traject met ontwerp en scope vooraf; niet iets voor een
   losse middag.

## Stand van zaken (19 juli 2026)

Alle A-bugs gedicht, alle B-besluiten genomen, D1-richtlijn gezet. Wat resteert:

- **C1** — sessie-facturatie: meten over een maand echte data. Geen bouwwerk.
- **C2** — ad-sync live testen tegen de echte advertentieplatforms.
- **C3** — integratie-/E2E-tests in een aparte CI-job draaien: jij zet de secrets
  (`TEST_SUPABASE_*`, `STRIPE_TEST_SECRET_KEY`, `ANTHROPIC_API_KEY`) in GitHub, ik maak de
  workflow-job. Kan ik oppakken zodra de secrets er zijn.
- **B1** — na de eerstvolgende deploy verifiëren dat billing-renewal echt in Vercel → Crons
  staat (Hobby-limiet).
- **B2** — `CMS_REPO_TOKEN`-secret toevoegen.
- **D1** — eigen ontwerptraject, kostenbewust, wanneer je eraan toe bent.
