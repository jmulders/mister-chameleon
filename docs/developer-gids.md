# Developer-gids

Lokaal draaien, repo-structuur, omgevingen, deploys en rollback.

## 1. Twee repo's

- **Platform** — Next.js 16 / React 19 / TypeScript, draait op Vercel. Personalisatie, admin, API's, billing.
- **CMS-app** — Statamic 6 / Laravel 13 (PHP ^8.3), draait op Ploi. Levert de content.

De Statamic-addon (`mister-chameleon-statamic`) is een eigen git-repo binnen de platform-map en is gitignored. Sanity Studio zit als apart project in `apps/studio` met eigen `package.json`.

## 2. Lokaal draaien

### Platform
```bash
npm ci
cp .env.example .env.local     # vul de waarden in
npm run dev                    # http://localhost:3000
```
Node: `.nvmrc` = 22 (CI draait op 20).

### CMS-app (Statamic)
```bash
composer setup    # install + .env + key:generate + migrate + npm install + npm run build
composer dev      # php artisan serve + queue:listen + pail + npm run dev
```
Poort 8000. Geen Valet/Herd-instructies in de repo; `composer dev` start alles via `concurrently`. `composer test` = `config:clear` + `php artisan test`.

### Zonder PHP werken: de file-fallback
Je hoeft de PHP-server niet te draaien om met Statamic-content te werken:
```bash
STATAMIC_CMS_PATH=../mister-chameleon-cms-app
```
De `StatamicClient` leest dan de platte YAML direct van schijf zodra de HTTP-API 404 geeft of niet parset (lokaal gebruikelijk door PHP-routingconflicten). Pad is relatief aan de Next.js-projectroot.

> **Let op:** `STATAMIC_CMS_PATH` staat **niet** in `.env.example`. Wie `cp .env.example .env.local` volgt, mist deze var.

## 3. Env-bestanden

| Bestand | Doel |
|---|---|
| `.env.example` | Sjabloon met comments. Uncommented = verplicht/aanbevolen, commented = optioneel. Kopieer naar `.env.local`. |
| `.env.local` | Lokale config met echte keys. Gitignored. |
| `.env.production.example` | Template voor Vercel → Env Vars, scope **Production**. |
| `.env.staging.example` | Template voor Vercel → Env Vars, scope **Preview**. Ook als `.env.staging.local`. |
| `.env.vercel` | Plak-blok voor Vercel Settings. `STATAMIC_CMS_PATH` staat er bewust niet in. |
| `.env.vercel.local` | Gegenereerd door `vercel pull`. |
| `apps/studio/.env.local` | Sanity Studio: `SANITY_STUDIO_PROJECT_ID`, `_DATASET`, `SANITY_API_TOKEN`. |

`.gitignore` negeert `.env*`, met een uitzondering voor de drie `*.example`-templates — die horen in de repo, want een verse clone heeft ze nodig om te onboarden (`cp .env.example .env.local`). Ze bevatten uitsluitend placeholders. Alle bestanden met echte waarden (`.env.local`, `.env.vercel`, `.env.vercel.local`, `.env.staging.local`) blijven genegeerd.

De CMS-app heeft een eigen `.env` + `.env.example`. Die `.env.example` is grotendeels het stock Laravel/Statamic-sjabloon — de MC-vars (`MISTER_CHAMELEON_API_URL`, `_TENANT_KEY`, `MC_PREVIEW_FRONTEND_URL`) staan in `DEPLOY.md`.

## 4. Repo-structuur (platform)

| Map | Waarvoor |
|---|---|
| `app/` | App Router: `(site)/`, `admin/`, `api/`, `dashboard/`, `demo/` |
| `cms/` | CMS-abstractielaag: types, provider-interface, mappers, queries, providers, seed |
| `decision/` | Beslislaag: ai-selector, confidence-policy, gating, explain |
| `context/` | Bezoekerscontext-detectie, attributie, derived context |
| `enrichment/` | Enrichment-pipeline, providers, IP-utils, cache |
| `lib/` | Grootste gedeelde laag (~49 submappen): abm, ad-sync, adaptive-blocks, admin-auth, assets, logger… |
| `page-config/` | Blok-registry + admin-metadata (block-catalogue, block-variants, assemblers) |
| `page-store/` | Admin-bewerkbare pagina's (bewust niet `pages/`) |
| `billing/` | Credits (1 credit = €0,01 → `balance_cents`), wallet, dunning, auto-reload |
| `ai/` | AI-laag; `config.ts` is de énige plek die `process.env` leest voor AI-config |
| `interest-profiles/` | 20 canonieke profielen (`catalog.ts` = source of truth), scoring |
| `tracking/` | Event-registry (`event-types.ts` = SoT voor `/api/events`), consent, cookies |
| `blueprints/` | Blueprint-registry, block-contracts, site-models |
| `provisioning/` | `definitions.ts` = SoT voor blocks/context-slots → `/api/v1/provision/manifest` |
| `tenant/` | Tenant-config, design-presets, theme, token-validator |
| `supabase/` | `migrations/` (40+ .sql) + `hotfix_paste_in_sql_editor.sql` |
| `scripts/` | migrate, backup, restore, release, bootstrap, create-admin-user |
| `apps/studio/` | Sanity Studio |
| `tests/` | Node test runner: billing, cms, lead-base, personalization |
| `docs/` | 23 runbooks |

## 5. Scripts

| Script | Wat |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `next build --webpack` (bewust webpack) |
| **`npm run verify`** | **lint + typecheck + tests — de poort. Draai dit vóór je pusht.** Zie `docs/testing.md`. |
| `npm run lint` | `eslint` |
| `npm run typecheck` | `next typegen && tsc --noEmit`. De `typegen` is niet optioneel: `next-env.d.ts` staat in `.gitignore` en is precies wat TypeScript leert dat `fetch` Next's `{ next: { revalidate } }` accepteert. Zonder die stap meldt `tsc` ~18 fouten die op geen enkele machine bestaan — dat is waarom CI maandenlang rood stond. |
| `npm test` | Node test runner over `tests/**/*.test.ts` |
| `npm run test:release-check` | De golden scenario's: personalisatie + facturatie. Snelle check vóór een deploy. |
| `npm run db:migrate` | `npx tsx scripts/migrate.ts` |
| `npm run dev:stripe` | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| `npm run storybook` | `storybook dev -p 6006` |
| `npm run studio` | Sanity Studio |
| `npm run backup` / `restore` | `scripts/backup.ts` / `restore.ts` |
| `npm run seed:all` | Seeds in `cms/seed/` (elk met `:dry`) |

> **Belangrijk:** `next.config.mjs` zet `typescript: { ignoreBuildErrors: true }`. De build faalt **niet** op typefouten — alleen `npx tsc --noEmit` (CI) vangt ze. Draai die lokaal vóór je pusht.

> **Build-valkuil:** SWC weigert `??` gemengd met `||`/`&&` zonder haakjes. Dit sloopt de productie-build en wordt níét gevangen door een losse transpile-check.

## 6. Migraties

**Lokaal:** `npm run db:migrate` → `scripts/migrate.ts` maakt een `_migrations`-tabel, leest `supabase/migrations/*.sql` alfabetisch (= chronologisch), slaat toegepaste over en registreert de rest. Vereist `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`. Draait SQL via de Supabase **Management API** (niet PostgREST) om schema-cache-staleness te vermijden.

**CI:** `staging.yml` / `production.yml` gebruiken de Supabase CLI (`link` + `db push`).

> **Caveat (op twee plekken gedocumenteerd):** `supabase db push` kan falen op een history-mismatch. Werkende paden: `npm run db:migrate` of de SQL-editor. Daarvoor staat `supabase/hotfix_paste_in_sql_editor.sql` klaar.

> **Regel:** bewerk **nooit** een bestaande migratie. Voeg `supabase/migrations/<timestamp>_desc.sql` toe en laat 'm eerst via staging lopen.

## 7. Omgevingen en branches

| Omgeving | Details |
|---|---|
| Development | `localhost:3000` + CMS `localhost:8000`; `.env.local` |
| Staging | `staging.misterchameleon.com`; auto-deploy op push naar `develop`; eigen Supabase, `SANITY_DATASET=staging`, eigen staging-CMS |
| Production | Vercel production (region `fra1`); deploy op push naar `main` met approval-gate |

```
feature/<naam>   (vanaf develop)
   └─PR→ develop  → CI + auto-deploy naar staging
            └─PR→ main → CI + approval → productie (+ tag/release)
hotfix/<naam>    (vanaf main, urgente prod-fixes)
```

**Fast-path:** rechtstreeks naar `main` pushen mag expliciet, voor snelheid. De CI-gate (lint + `tsc --noEmit` + tests + build) draait op elke push naar `main`. De `develop → main`-route is voor riskante, multi-file of migratie-dragende changes. `docs/develop-sync.md` is de sync-runbook.

## 8. CI/CD (GitHub Actions)

| Workflow | Trigger | Wat |
|---|---|---|
| `ci.yml` | PR + push (main, develop) | lint (ESLint + `tsc --noEmit`), test, build |
| `staging.yml` | push `develop` + handmatig | test → migrate → deploy (alias `staging.misterchameleon.com`) → healthcheck `/api/health` |
| `production.yml` | push `main` + handmatig | test → **approve** (Environment `production`) → migrate → deploy (`vercel --prod` + healthcheck) → release (tag + GitHub release). `cancel-in-progress: false` |
| `rollback.yml` | **alleen handmatig** | Aliast het productiedomein naar een eerdere Vercel-deployment. Inputs: `deployment_url` (verplicht), `reason`. **Raakt de DB niet.** |
| `hotfix.yml` | push `hotfix/**` + PR op main | Snelle CI (lint, tsc, alleen `test:personalization`, geen build). Deployt niets; merge naar `main` triggert productie |
| `set-previews.yml` | handmatig + push `develop` | Storybook → set-previews → PR op de CMS-template-repo. **Niet af** (`CMS_REPO` is placeholder) |

Handmatig triggerbaar: `production.yml`, `staging.yml`, `rollback.yml`, `set-previews.yml`.

## 9. Deploy en rollback vanuit het platform

**Admin → Platform → System** bundelt backup, environments, build-pipeline en rollback. De knoppen dispatchen GitHub Actions via `POST /api/admin/github/workflow-dispatch` met body `{ workflow, ref, inputs }`.

**Nodig:**
- `GITHUB_TOKEN` — **verplicht**, PAT met **`actions:write`**. Ontbreekt hij → 500 met expliciete melding.
- `GITHUB_REPO` — optioneel; fallback `jmulders/mister-chameleon` is hardcoded.

**Knoppen:**
- **Deploy to production** — `workflow=production.yml`, `branch=main`.
- **Rollback** — formulier met Vercel deployment-URL (verplicht) + reason → dispatcht `rollback.yml` op `main`.
- **Git commit-panel** — alleen development; server-side gated, rendert niets in productie.
- **Backup** — Create Backup (`POST /api/admin/backup`) + Restore per versie (`POST /api/admin/restore/[id]`). Append-only: restore maakt een nieuwe versie.

**Rollback in de praktijk:** pak in Vercel de URL van de laatste goede deployment, plak die met een reden in het formulier en dispatch. De workflow zet het domein-alias terug en doet een healthcheck.

> **Rollback raakt alleen de code/deployment, niet de database.** Een migratie die al gedraaid is, draai je hiermee niet terug.

## 10. Staging opzetten

1. Kopieer `.env.staging.example` naar Vercel → Env Vars, scope **Preview**.
2. Gebruik een **apart Supabase-project**, `SANITY_DATASET=staging` en een **aparte staging-CMS-host** — nooit de productie-CMS.
3. `NEXT_PUBLIC_SITE_URL=https://staging.misterchameleon.com`.
4. Zet `MC_FALLBACK_TENANT_ID` (voorbeeld: `workengine`) zodat een `*.vercel.app`-hostname naar een tenant resolvet.
5. Zet de GitHub Environment `staging`-secrets: `STAGING_DB_PASSWORD`, `STAGING_SUPABASE_PROJECT_ID`.
6. Push naar `develop` → `staging.yml` draait test → migrate → deploy → healthcheck.

Zie ook `STAGING.md` in de repo-root voor de volledige end-to-end guide (migraties eerst, dan env-vars).

## 11. Aandachtspunten

**Blijvend relevant:**

- `typescript.ignoreBuildErrors: true` — de build is blind voor typefouten; alleen CI's `tsc --noEmit` vangt ze. Draai die lokaal.
- SWC-valkuil: `??` gemengd met `||`/`&&` zonder haakjes sloopt de productie-build en wordt niet gevangen door een losse transpile-check.
- `supabase db push` in de workflows kan stuklopen op een history-mismatch; gebruik dan `npm run db:migrate` of de SQL-editor.

**Nog open:**

- `.nvmrc` zegt Node 22, CI draait Node 20 — bewust laten of gelijktrekken (CI bumpen is een aparte, geteste wijziging).
- `/api/cron/billing-renewal` en `/api/cron/keep-warm` staan niet in `vercel.json` en draaien dus niet automatisch. Bewust niet stilzwijgend aangezet: billing-renewal activeren heeft echte gevolgen.
- `set-previews.yml` heeft nog een placeholder `CMS_REPO` en is niet af.

**Opgelost (was drift, nu gefixt):**

- `STATAMIC_CMS_PATH` staat nu in `.env.example`.
- De System-pagina verwees naar een niet-bestaand `.env.local.example` → nu `.env.example`, met staging- en productie-templates erbij.
- Staging ontbrak op de System-pagina → er is nu een staging-rij én een "Deploy to staging"-knop (`staging.yml`).
- De Deployment-checklist miste hele groepen → aangevuld met Statamic, Stripe, Cron, Lead-base/webhooks, Enrichment, HubSpot en Google Calendar.
- Het setup-script noemde vars die de code niet leest → vervangen door de echte namen.
- **De "Download setup.sh"-route was kapot**: het bash-script staat in een TS-template-literal en de shell-kleurvariabelen (`${CYAN}` etc.) werden door TypeScript geïnterpoleerd → `ReferenceError: CYAN is not defined` → 500. Alle shell-`${…}` zijn nu geëscaped; het gegenereerde script is geverifieerd met `bash -n`.
- `docs/pipeline.md` noemde jest → nu de Node test runner.

### Beveiliging

`.env.local` en `.env.vercel` staan leesbaar op schijf met echte productie-secrets (Supabase service-role, een GCP service-account private key, een GitHub PAT, `EMAIL_ENCRYPTION_KEY`). Ze zijn gitignored, dus niet via de repo gelekt — maar behandel die machine als vertrouwd en **roteer tokens die ooit zichtbaar zijn geweest** (screenshot, terminal, chat). Zet nooit echte waarden in documentatie.
