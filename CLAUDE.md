# CLAUDE.md — Mister Chameleon

Projectcontext en conventies voor Claude Code. Lees dit eerst; verken daarna de
code zelf waar nodig.

## Wat is dit

Mister Chameleon is een multi-tenant **contextuele-personalisatie-SaaS**. Bezoekers
krijgen per context (rol/segment, funnel-fase, interesse, gedrag, tijd) een andere
variant van blokken (hero, proof, cta, features, conversie, notificatie, formulier,
e-mail). Stack: **Next.js (App Router) + TypeScript + Supabase (Postgres)**.

Tenants worden op drie manieren bediend:
1. **Platform-gehoste pagina's** (de Next.js-app rendert de tenant-site).
2. Een **JS-snippet** op een externe site (`/api/snippet.js`), die slots op de
   bestaande pagina vervangt.
3. Een **Statamic-addon** en een **WordPress-plugin** (zelfde slot-mechaniek).

## Architectuur — kernsubsystemen

**Beslis-engine** (`decision/`)
- `providers/rules-decision-provider.ts` — `RulesDecisionProvider` → intern
  `ExperimentDecisionProvider`. **First-match-by-priority**, lager nummer = hogere
  prioriteit. Geeft één `StoredPlan` (variantkeys + presentatie-flags) terug.
- `rules/stored-rule.ts` — `StoredPlan`, `RuleCondition`-boom, `validateStoredConfig`
  / `validatePlan` / `evaluateCondition`. **Let op:** `validateStoredConfig` verwerpt
  de HELE config bij dubbele priority. Dat is eerder de oorzaak geweest van een demo
  die niet personaliseerde.
- `rules/field-registry.ts` — `RuleEvaluationContext` + `FIELD_REGISTRY`: condities
  matchen tegen een **vaste allowlist** van velden, elk met een `resolve(ctx)`. Nieuw
  veld = key toevoegen aan `RuleFieldKey` + `FIELD_REGISTRY` + vullen in de
  context-builder. Nieuwe velden verschijnen dan automatisch in de rule-editor.
- `context/build-decision-context.ts` — bouwt de context per request (source/device/
  utm/referrer, tijd, enrichment, derived, interest, segments). Context wordt élke
  request opnieuw afgeleid; sessie-persistentie zit in `visitor_behavior_state`
  (JourneyState) met monotone vlaggen `hasVisitedPricing/Cases/Contact`.
- `theme-decision.ts` — aparte tweede pass voor thema-keuze (leest dezelfde context,
  voedt niet terug).

**Contentbronnen**
- `platform_cms_content` (PlatformCMSProvider, admin Content-tab).
- `adaptive_blocks` (admin Blocks-pagina).
- Externe CMS (Sanity / Statamic / Storyblok).
- Snippet-slots resolven via `cms.getXVariant`, met `cms/providers/platform-first-variants.ts`:
  **platform-first**, tenant-CMS als fallback.

**Snippet** (`lib/snippet/snippet-source.ts`, geserveerd door `/api/snippet.js`)
- Verbergt de pagina, `REVEAL_MS` reveal-timer, `CALL_MS` abort. Instelbaar per tenant
  via `data-mc-reveal-ms` / `data-mc-call-ms` (admin Snippet → Timing-tab).
- Decide: `app/api/snippet/decide/route.ts`; losse slot: `app/api/v1/slot/route.ts`.
  Beide geven `tenantId` mee aan de provider (nodig voor rule-fire-registratie).

**Variant-catalogus** (`decision/rules/variant-catalogue.ts`)
- Per blok benoemde varianten, gegroepeerd per blueprint: Platform-standaard, B2B
  SaaS, Careers, Lifecycle. `ALLOWED_*_KEYS` bepalen wat geldig is; Statamic-tenants
  hebben lege `extraKeys`, dus platform-keys moeten in `ALLOWED_*_KEYS` staan.

**Rule-fire-statistiek** (`lib/observability/rule-fire-store.ts`)
- Gebufferd in-memory, **flush 1×/60s** → `rule_fire_daily`. Paneel onderaan de
  rules-pagina. Registreert alleen als de provider een `tenantId` kreeg (homepage-
  pipeline, snippet/decide, v1/slot). Zie `docs/rule-stats-testplan.md`.

**Demo / scenario** (`components/scenario/`)
- `ScenarioControlPanel.tsx` — operator-console (rechtsonder), met een **"Demo"-tab**
  (`DemoStageSection.tsx`): persona-keuze + readout + tijd-simulator, op het echte
  regel-pad. `scenario-store.ts` houdt de scenario-state bij. Demo draait op
  `localhost:3000/?tenant=statamic`.

## Conventies (belangrijk)

**Git / PR**
- `main` is beschermd: PR + **2 required status checks**. Direct pushen naar `main`
  wordt geweigerd.
- Pre-push hook draait `eslint --quiet && npm run typecheck && npm test`. Groen =
  pushen.
- **Commit per wijziging**; typecheck + eslint per stap.
- **Push EERST, merge DAARNA.** Als je een PR merget vóór je laatste push binnen is,
  mist die commit de merge (dit is meerdere keren misgegaan). Of gebruik
  `gh pr merge <branch> --squash --auto` zodat hij pas mergt als de checks groen zijn.
- Nooit force-pushen naar `main`.

**Taal / copy**
- Website- en variant-copy: **Nederlands**. Demo-UI en labels: **Engels**.

**Prod-veiligheid**
- Directe writes naar de prod-database worden geblokkeerd. **Omzeil dat niet** —
  lever SQL aan die de gebruiker zelf draait.
- Migraties worden **handmatig** toegepast via `npm run db:migrate`
  (`scripts/migrate.ts`, ledger `public._migrations`) — niet via de deploy. De
  CI-job `supabase db push` (`production.yml`) is momenteel **niet werkend**;
  reken er niet op. Check daarom `public._migrations` (op `filename`), niet
  alleen `supabase_migrations.schema_migrations`, of iets al geregistreerd staat.
  Zie `docs/migratie-registratie-163-164.md` en `docs/migratie-ledger-reconcile.md`.

## Supabase

- Dev-project: `xqaeqbqjymeyxbvmhseg`
- Prod-project: `kdhfpvjeriszteqhpgll`
- Prod-tenants: `nascita`, `statamic`, `mister-chameleon` (fallback/localhost =
  `mister-chameleon`).

## Commando's

```
npm run dev         # lokaal draaien
npm run typecheck   # next typegen && tsc --noEmit
npm test            # test-suite
npx eslint --quiet <paden>   # lint (warnings onderdrukt, zoals pre-push)
```

## Waar dingen staan

- `decision/` — engine, regels, veld-registry, context-opbouw.
- `context/` — visitor-context, history, types.
- `cms/` — content-providers (platform, extern, platform-first).
- `lib/pipeline/homepage-pipeline.ts`, `lib/cms-page-decision.ts` — request-orchestratie.
- `app/admin/tenants/[tenantId]/…` — tenant-admin (rules, snippet, design, content).
- `app/dashboard/rules/_components/RulesEditor.tsx` — de gedeelde rule-editor.
- `components/scenario/` — demo/scenario-UI.
- `docs/` — backlog, specs, testplannen, deploy-checklists.

## Actieve specs / docs

- `docs/rule-context-writes-spec.md` — regels die context schrijven (context-writes +
  override-laag). Bevat de bouwvolgorde onderaan.
- `docs/rule-stats-testplan.md` — testplan rule-fire-statistiek.
- `docs/backlog.md` — backlog en routekeuzes.
