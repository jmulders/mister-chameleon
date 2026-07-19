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
| D2 | **Chameleon Connect voor WordPress** — PHP-plugin die de snippet inpakt: install, slot-marking (block/shortcode/selector), consent-integratie. **Platform-deel gebouwd (19 juli):** snippet doet selector-support (`selectors`-map, ongeldige selector wordt genegeerd) en de decide-route stuurt de `selectorMap` uit de tenant-config mee — met tests. Rest is de aparte PHP-repo (`mister-chameleon-wordpress`): settings-page/siteKey, shortcode + Gutenberg-block, selector-mapping-UI, consent-integraties. **Ontwerp: `docs/design/snippet-wordpress-plugin.md`.** | Bereik: 's werelds populairste CMS | — | 🔨 Platform-kant klaar, PHP-plugin volgt |
| D3 | **Snippet render-modes + design tokens** — per-variant toggle tussen content-swap (default) en gestyled block met huisstijl via tokens. **Snippet + contract gebouwd (19 juli):** snippet doet block-mode (`data-mc-block`, HTML-injectie, tokens als scoped CSS-vars) en het response-contract (`SlotValue = string \| BlockSlot`) laat blocks toe — met tests. **Resteert:** het datamodel dat blocks *voedt* — `renderMode`/`blockHtml`/`tokenSetRef` op de variant + admin-toggle. Dat raakt de CMS-types en de losse CMS-repo's (Statamic e.a.), dus een eigen increment. **Ontwerp: `docs/design/snippet-render-modes.md`.** | Rijkere personalisatie op externe sites, on-brand | — | 🔨 Snippet+contract klaar, datamodel volgt |

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
