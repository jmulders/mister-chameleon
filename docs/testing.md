# Testing & the gate

## The one command

```
npm run verify        # lint + typecheck + tests — the same three gates CI runs
```

Run it before you push. The pre-push hook runs it for you (see Enforcement
below), and CI runs the identical command on a clean checkout — so if it passes
here it passes there, which is the whole reason it is one command.

| Command | What it does |
|---|---|
| `npm run verify` | `eslint --quiet` → typecheck → all tests. The gate. Errors only — warnings do not fail the build, so they do not belong in the gate’s output. |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | eslint, warnings and all (525 of them) |
| `npm run lint:summary` | errors grouped by rule and directory |
| `npm test` | every `tests/**/*.test.ts` |
| `npm run test:verbose` | the same, with the full spec output — for when you are reading one suite |
| `npm run test:watch` | spec output, re-runs on save |
| `npm run test:release-check` | the golden scenarios only — fast confidence before a deploy |
| `npm run test:billing` | everything under `tests/billing/` |

### On the output

The test scripts use the `dot` reporter: one dot per test, and failures printed
in full at the end. A green `verify` is about 30 lines.

That is deliberate. The first version of these scripts used the default `spec`
reporter and printed **2,449 lines on success** — the whole suite narrating every
passing test. Which is the same disease as the red CI nobody read: output you
cannot take in is output you stop looking at, and then a real failure scrolls past
in the same wall of green. If you want the narration, `npm run test:verbose`.

## Why this document exists

On 17 July 2026 CI had been red for months: 354 lint errors (all from a committed
Storybook bundle), ~44 type errors, and a test job that could not start at all
because it ran on Node 20.

CI had been running all three gates on every push to `main` the whole time, and
had been red the whole time. Because the lint job was red, the Build job
(`needs: [lint]`) never ran either.

Nothing was broken by that in the obvious way. What it cost was subtler: with the
gate already red, a new red meant nothing, so real problems arrived unannounced —
a `tenantConfig.tenantId` in a file with no `tenantConfig`, an import of a
`getStripe` that had never existed, two components whose props silently degraded
to `any`. `next.config.mjs` set `typescript.ignoreBuildErrors: true`, so the
build said "Compiled successfully" through all of it.

The lesson is not "write more tests". It is that **a gate nobody can read is not
a gate**, and a red gate becomes unreadable within a week.

### Two traps worth knowing about

**Node version.** The test runner needs `--experimental-transform-types`, which
arrived in Node 22.6. Every workflow pinned `node-version: "20"`, so
`npm test` died instantly with `node: bad option` and exit 9 — on every run,
since the day the flag was added. The tests have never executed in CI. Not
"26 red": zero run. Nobody saw it because the lint job was red above it.

`.nvmrc` already said 22 and every developer had 22 locally. Nothing connected
the two. The workflows now use `node-version-file: ".nvmrc"`, so there is one
place that decides, and `package.json` has `engines: { node: ">=22.6" }` so npm
says something the moment the version is wrong.

That is the shape of this whole day in one line: the right answer was written
down, and nothing read it.

### The next-env.d.ts trap

~18 of those 56 type errors were not code. `next-env.d.ts` and `.next/types/` are
both gitignored, and `tsconfig.json` includes them — `next-env.d.ts` is what
teaches TypeScript about Next's additions to `fetch` (`{ next: { revalidate } }`).
A fresh CI checkout has neither, so `tsc` reported errors that exist on no
developer's machine. That is why `npm run typecheck` runs `next typegen` first,
and why the CI job does too. If CI ever shows type errors that you cannot
reproduce locally, check this first.

## The golden scenarios

Two files. If either goes red, something a customer pays for has changed.

**`tests/personalization/golden-flows.test.ts`** — does the visitor get the right
page? Nine scenarios: new visitor, high intent, high friction, returning,
post-conversion, expansion, churn risk, holdout control, over the cap.

**`tests/billing/billing-flow.test.ts`** — does the tenant get charged the right
amount for it? Six scenarios: one visit across five pages, five visits in a
month, inside the bundle, past the plan with credits, past everything, month
rollover.

They are deliberately split that way. Every leak found on 17 July was a case
where the personalization tests would have stayed green: the page was right, the
invoice was not.

- No session counted for a visitor who never touched the homepage.
- One session counted for a visitor who came back six times in a month
  (`mc_session_id` lives 30 days — it is a visitor key, not a session).
- The cap "enforced" while the rules engine kept personalising underneath it.
- A purchased credit never deducted, because `undefined > 0` is false.

All silent. Nothing threw; the numbers were just wrong. That is what these
scenarios are for, and it is why they assert amounts rather than absence of
errors.

### Adding to them

When you change billing or personalisation, add the scenario **before** the fix,
and watch it fail for the reason you expect. A test that has never been red has
not been tested either.

Include the mirror assertion. Scenario H ends with "the same visitor outside the
holdout DOES get personalised" — without it, a provider that returned the default
plan unconditionally would pass every other assertion in the block.

## The pipeline runs the same command

`ci.yml`, `staging.yml`, `production.yml` and `hotfix.yml` all run `npm run
verify` — the same command as the pre-push hook and as you. That is the point:
five copies of "lint, then tsc, then test" is five things that can drift, and
they had.

They had drifted in the worst possible way. All four called `npx tsc --noEmit`
without `next typegen`, so all four failed on a clean checkout for a reason that
does not exist on any developer's machine. `production.yml` gates its migrations
on that job (`needs: [test]` → `approve` → `migrate`), so the pipeline had not run
past the gate in months. The site was still live because Vercel deploys from its
own Git integration — but `supabase db push` lives in the pipeline, and it never
ran.

The chain is now test → approve → migrate → **health** → release. There is no
"deploy to Vercel" job: it could not build from a runner (Vercel's *Sensitive*
env vars come back as `[SENSITIVE]`) and it duplicated what Vercel already does on
merge. See "Known debt — resolved" for the removal.

`hotfix.yml` was worse: it ran `test:personalization` only, labelled "fast path —
speed matters". The full suite takes about two seconds, and `test:personalization`
is precisely the suite that stays green while the billing is wrong. The weakest
gate sat on the highest-risk change anyone makes. It runs the full gate now.

### What happened when the gate finally passed

17 July, on `main`, commit 7e19c22: **CI went green.** Lint, typecheck, 285 tests
and the build, all on a clean checkout. First time.

`Deploy — Production` still failed that day at `DB Migrations`, so `supabase db
push` had still never run. On 18 July it did — the migrate job was fixed, the
ledger reconciled, and the whole chain reached `Create Release`. See "Known
debt — resolved" below for how each stage fell over the first time it ran.

### The migration ledger — how it got split, and how it was reconciled

For historical context, because the reconciliation only makes sense against it.
On 17 July there were two ledgers and neither was complete:

| ledger | written by | rows | last |
|---|---|---|---|
| `_migrations` | `npm run db:migrate` | 116 | 23 June 2026 |
| `supabase_migrations.schema_migrations` | `supabase db push` (and the Supabase MCP) | 130 | 30 June 2026 |
| files in `supabase/migrations/` | — | 136 | `…147_lead_suppressions` |

Three ways of changing the schema, two ledgers, and the newest tables in no ledger
at all — their tables existed because the SQL had been run directly. The schema
happened to be correct; nothing knew why.

The fix was **not** to hand-write the ledger — that asserts "applied" from the
tables existing, without checking every column, index and policy. `supabase db
push` proves completeness by applying (every statement `IF NOT EXISTS`, so a
no-op on the existing schema) and writes the ledger itself. Done on 18 July: the
duplicates were marked reverted, `db push` applied 127–152, and repo and database
now agree at 140 = 140. `_migrations` is retired; `schema_migrations` is the one
ledger. Details, including the two bugs this surfaced, are under "Known debt —
resolved / 3".

## The 525 warnings

`npm run verify` runs `eslint --quiet` — errors only, because only errors fail the
build. `npm run lint` still shows everything; `npm run lint:summary` gives the
compact view.

Do not read the 525 as noise, though. Most are unused variables. Some are not:

| rule | where | status |
|---|---|---|
| `react-hooks/static-components` (30) | ScenarioControlPanel | **Fixed.** `Section` and `Row` were declared inside render, so React saw a new component type every render and rebuilt the tree. Now `LiveSection` / `LiveRow` at module level, with `open`/`toggle` passed as props instead of closed over. |
| `react-hooks/set-state-in-effect` (3) | ConsentBanner, CookieDeclaration, cart-context | **Fixed (18 July).** All three now derive state from an external store via `useSyncExternalStore`. |

### How set-state-in-effect was fixed

The right fix was `useSyncExternalStore`, and it fit unusually well:
`onConsentChange` was already a subscribe function and `getConsent` already a
snapshot — that hook exists for exactly this shape.

The catch was that `useSyncExternalStore` requires `getSnapshot` to return a
*cached* value. `getConsent()` returns `window.__mc_consent`, which is reassigned
only by `setConsent()` — so between changes every call returns the same object.
That was verified *before* converting, not assumed: convert first and a fresh
object on every call would be an infinite render loop on the banner, in
production, for every visitor.

The three were not the same shape, and were not treated as such:

- **ConsentBanner** — visibility is now derived directly from the store; the two
  effects and the local `visible` state are gone.
- **CookieDeclaration** — the store feeds an editable draft overlay
  (`draft ?? stored`), so the on-mount seeding effect is gone but the form is
  still editable.
- **cart-context** — the cart moved out of React into `lib/cart/cart-store.ts`, a
  framework-agnostic external store backed by localStorage. The load-on-mount
  effect became a `getServerSnapshot` concern, and the reducers are now pure
  functions with their own tests (`tests/cart/cart-store.test.ts`) — the checkout
  maths had no coverage before.

The server snapshots report "hidden / empty" so the SSR HTML matches the first
client render; the real client state is read straight after hydration, exactly as
the old effects did.

## Known debt — resolved 18 July 2026

The four things below were "still wrong, but nothing breaks today" — the exact
condition under which the previous batch survived for months. On 18 July the
pipeline finally ran end to end for the first time, and each one was closed. They
are kept here, resolved, because the *how* is the useful part.

### 1. `DB Migrations — Production` — green

Three secrets were missing, not one: `SUPABASE_ACCESS_TOKEN`,
`PRODUCTION_DB_PASSWORD` and `PRODUCTION_SUPABASE_PROJECT_ID`. The preflight named
them one run at a time. They now live as **environment** secrets on the
`production` environment (not repository secrets), so only jobs that declare
`environment: production` can read them — the account-wide access token in
particular.

One trap on the way: an empty GitHub *environment* is not the same as the
Vercel-created `Production – mister-chameleon-qlk1` environment. The secrets first
went into the latter, where the workflow never looks. `environment: production`
means the lowercase one.

The wrong-domain health check (`misterchameleon.com`, a domain we do not own) was
corrected to `www.misterchameleon.nl` in the same pass.

### 2. The production environment has reviewers

Settings → Environments → production → Required reviewers, with the account owner
added. The `Approval Gate` job now actually pauses. Before this, `supabase db
push` would have run against production unattended — it only ever didn't because
it errored first.

Worth knowing what this gate does and does not protect: it gates the **database**,
not the site. Vercel deploys `main` on merge through its own Git integration, so
the new code is live before the approval prompt appears. Locking that down too is
a Vercel Deployment Protection setting, not a workflow change — left off
deliberately, since every merge is already tested before it lands.

### 3. The migration ledger — one ledger, reconciled

The timestamp-versioned rows the Supabase MCP had written (20260613… onward) were
the *same migrations* as the repo's `20240101000…` files, statement for statement
— verified before touching anything. `supabase migration repair --status
reverted` cleared the fourteen duplicates plus two orphans, then `supabase db
push` applied 127–152 (all `IF NOT EXISTS`, all no-ops on the existing schema) and
wrote the ledger itself.

Two real bugs fell out of doing it properly rather than hand-writing the ledger:

- **A migration broken for two years.** `…095_form_submissions_tenant_retention`
  shared version 000095 with another file, so the CLI only ever saw one of the
  two and this one never ran. When `db push` finally executed it, it failed on
  `created_at` — a column `form_submissions` never had (it is `submitted_at`).
  Renumbered to 150 and fixed.
- **Six tables in production, in no migration.** `runtime_rules`,
  `visitor_history`, `tenant_search_settings`, `enrichment_price_cards`,
  `interest_profile_tags`, `_migrations` existed only because SQL was run by hand.
  One was real (`tenant_search_settings` → migration 151), three were dead and are
  now dropped (migration 152), `_migrations` is the retired ledger, and
  `visitor_history` was a false alarm.

Repo and database now agree: 140 files, 140 ledger rows, no duplicate versions.
Regenerate the ledger's source of truth with `supabase db push`; do not hand-edit
`schema_migrations`.

### 4. The Supabase client — typed, and the shim's prophecy came true

`data/types.ts` used to hand-write the `Database` type, missing the
`Relationships` key on every table, so supabase-js resolved **every** table to
`never` and 24 `(db as any)` casts were the only way to use the client. It was
generated:

```
npx --yes supabase gen types typescript --linked > data/database.types.ts
```

The old note here ended "expect to find something." It was right. The deleted
Stripe shim (`types/stripe.d.ts`) had taught the codebase that
`current_period_end` lives on the subscription root — untrue since Stripe API
2024-09-30, where it moved to the subscription *item*. On 18 July that exact lie
surfaced in `billing/stripe.ts`: the `customer.subscription.*` webhook handlers
read `sub.current_period_end` (now `undefined`), called
`new Date(undefined * 1000).toISOString()` (a `RangeError`), threw, were swallowed
by the route's try/catch, and returned 200. Stripe thought every event was
delivered while the database was never updated — a live subscription sat a month
stale. Fixed with a `subscriptionPeriod()` helper that reads the item, plus
`tests/billing/subscription-period.test.ts`. The type change made it impossible to
miss: with the period fields honestly optional, `tsc` flagged the two remaining
root reads that a grep had not.

## What broke the first time each late stage ran — 18 July 2026

The pipeline had never reached its own back half, so every job past the gate was
untested ground. Once the gate passed, each one failed the first time it ran, for
a reason only a first run could reveal. Recorded because the pattern — "green and
broken, because this code never executed" — is the same one that kept CI red for
months.

- **The deploy job could not build.** `vercel build` in a runner does `vercel
  pull` first, and 52 of the 73 production env vars are marked *Sensitive* in
  Vercel — which return the literal string `[SENSITIVE]`, not their value. The
  build fell over on a rewrite whose destination was `[SENSITIVE]/assets/:path*`.
  The job could never work, and it was redundant anyway (Vercel deploys `main`
  itself). Removed. The workflow is now test → approve → migrate → **health** →
  release; the deploy belongs to Vercel.

- **The health check got 429, not 200.** It polls from a shared GitHub-runner IP,
  which Vercel's edge rate-limits — a 429 returned *before* the request reaches
  the app, so exempting `/api/health` from our own limiter (correct, but a layer
  too deep) did not help. A 429 proves the origin is alive, so the check now
  treats 200 and 429 as healthy and fails only on 5xx or no answer.

- **The release job had never committed.** It bumped the version, wrote the
  CHANGELOG, and then `git commit` failed with "empty ident name" — a runner has
  no git identity. Added a `github-actions[bot]` identity step.

- **The release scripts could not resolve their imports.** They import each other
  with `.js` extensions (the TypeScript-source convention), but the workflow runs
  them under `node --experimental-strip-types`, which resolves paths *literally* —
  `./logger.js` does not exist, only `logger.ts` does. Changed the `scripts/`
  imports to `.ts` and turned on `allowImportingTsExtensions` (safe: it permits,
  it does not require, and `noEmit` is on). That enabled the flag a stray
  `@ts-expect-error TS5097` had been suppressing — which the pre-push hook caught
  as a now-unused directive, on the same push.

Every one of these was found by the gate or the hook before it reached anyone
else. That is the system working: a change that would have broken something
quietly was stopped at the door.

## Enforcement

Three layers, weakest to strongest.

**1. `npm run verify`** — you, before you push.

**2. The pre-push hook** — git, before it leaves your machine.

```
git config core.hooksPath .githooks
```

One command, and it is checked in (`.githooks/pre-push`), so everyone gets the
same gate. `git push --no-verify` skips it. That escape hatch is deliberate: a
hook you cannot skip gets uninstalled the first time it is wrong, and then there
is no hook at all.

**3. Branch protection on `main`** — GitHub, before it reaches anyone else.

This is the only layer that actually binds, and it is the one that has to be
switched on in the repo settings — it cannot be committed. In GitHub:

> Settings → Branches → Add branch ruleset → target `main`
>   - ✅ Require a pull request before merging
>   - ✅ Require status checks to pass → add **Verify (lint + typecheck + tests)** and **Build**
>   - ✅ Require branches to be up to date before merging
>   - ✅ Do not allow bypassing the above settings

Do this only once CI is actually green, otherwise the first thing it blocks is
you, and the first thing you will do is turn it off.

## Why `ignoreBuildErrors` is gone

`next.config.mjs` no longer sets `typescript.ignoreBuildErrors`. It was added for
stale generated Supabase types in `tenant/domain-store.ts` and
`tenant/tenant-store.ts`; those files typecheck clean now, so the reason is gone,
but the flag was global and permanent.

If a deploy fails on a type error: that is the feature. Fix the error rather than
restoring the flag. If the generated Supabase types drift again:

```
npx supabase gen types typescript --linked > types/supabase.ts
```

## The integration layer (opt-in, added 18 July 2026)

The gate is pure and always will be. Alongside it now sits a second layer that
talks to real systems, kept out of the gate by name (`*.itest.ts`, not `*.test.ts`)
and self-skipping when its secret is absent — a run with no secrets is all green
skips, never failures. See `tests/integration/README.md`.

- **Webhook handler** — `tests/billing/webhook-handler.test.ts` (in the gate, no
  network). Feeds a real Stripe event through `handleStripeWebhook` with a
  recording mock client and asserts the `subscriptions` row is written from the
  item-level period. This is the integration around the exact bug that hid for a
  month; the pure `subscription-period.test.ts` guards the helper under it.
- **DB** — `tests/integration/db.itest.ts`. Reads and round-trips a scratch row on
  a throwaway test project. Catches RLS, real column types, and `(db as any)`
  fallout. Needs `TEST_SUPABASE_URL` + `TEST_SUPABASE_SERVICE_ROLE_KEY`.
- **Stripe** — `tests/integration/stripe.itest.ts`. Checks the Pro price still
  costs €749 (config-vs-Stripe drift) and that Stripe honours a
  `nextCalendarMonthStartUnix` anchor on a throwaway test subscription. Needs
  `STRIPE_TEST_SECRET_KEY`.
- **AI** — `tests/integration/ai.itest.ts`. The no-key guard runs everywhere; the
  live call to `ClaudeAdapter.suggest()` needs `ANTHROPIC_API_KEY`.
- **Browser / E2E** — `e2e/smoke.spec.ts` on Playwright (`npm run test:e2e`): home
  page renders 200, health endpoint alive, consent banner shows for a fresh visitor.

Honesty note: the four infra files were written but could not be executed where
they were written (no outbound network, no browser). They are correct by
construction and self-skipping; the first real run is the maintainer's.

## What is still not covered

Stated plainly, because a list of what a suite does not test is worth more than a
coverage percentage.

- **The integration layer has run green nowhere yet** — it self-skips without
  secrets, so "it passes" currently means "it skipped". Wire the secrets into a CI
  job (separate from the gate) to make it real.
- **No load or concurrency tests.** Nothing exercises the rate limiter, the wallet
  deduction, or the session cap under parallel traffic.
- **The E2E suite is a smoke test.** Three checks. It proves the site loads, not
  that a full personalise-and-convert journey works end to end.
