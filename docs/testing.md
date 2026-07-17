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
does not exist on any developer's machine. `staging.yml` and `production.yml`
gate their deploy on that job (`needs: [test]` → `migrate` → `deploy`), so the
deploy pipeline had not run past the gate in months. The site was still live
because Vercel deploys from its own Git integration — but `supabase db push`
lives in the pipeline, and it never ran.

`hotfix.yml` was worse: it ran `test:personalization` only, labelled "fast path —
speed matters". The full suite takes about two seconds, and `test:personalization`
is precisely the suite that stays green while the billing is wrong. The weakest
gate sat on the highest-risk change anyone makes. It runs the full gate now.

### What happened when the gate finally passed

17 July, on `main`, commit 7e19c22: **CI went green.** Lint, typecheck, 285 tests
and the build, all on a clean checkout. First time.

`Deploy — Production` still failed — at `DB Migrations`, see Known debt below.
So `supabase db push` has still never run. The ~20 unrecorded migrations
(20240101000127 … 147) are still waiting, still guarded with `IF NOT EXISTS`,
still expected to be a no-op against a database that already has those tables.
Whoever fixes the migrate job finds out.

### The migration ledger is not one ledger

There are two, and neither is complete:

| ledger | written by | rows | last |
|---|---|---|---|
| `_migrations` | `npm run db:migrate` | 116 | 23 June 2026 |
| `supabase_migrations.schema_migrations` | `supabase db push` (and the Supabase MCP) | 130 | 30 June 2026 |
| files in `supabase/migrations/` | — | 136 | `…147_lead_suppressions` |

The five newest migrations (ad_sync, ad_sync_audience_members,
visitor_profiles_attribution, ad_conversions, lead_suppressions) are recorded in
**neither** — their tables exist because the SQL was executed directly.

So three ways of changing the schema, two ledgers, and the newest tables in no
ledger at all. The schema happens to be correct; nothing knows why. Pick one path
(the pipeline's `supabase db push` is the obvious candidate, since it is the one
that runs unattended), reconcile the ledgers with `supabase migration repair`,
and delete the other. Until then, "is production migrated?" can only be answered
by looking at the tables.

## The 525 warnings

`npm run verify` runs `eslint --quiet` — errors only, because only errors fail the
build. `npm run lint` still shows everything; `npm run lint:summary` gives the
compact view.

Do not read the 525 as noise, though. Most are unused variables. Some are not:

| rule | where | what it means |
|---|---|---|
| `react-hooks/set-state-in-effect` (5) | ConsentBanner, CookieDeclaration, cart-context | setState called synchronously in an effect body — cascading renders. Production components, including the consent banner. |
| `react-hooks/static-components` (30) | ScenarioControlPanel | `Section` and `Row` are declared inside render, so they are new component types every render and their state resets. Dev-only panel, but it is why that panel feels flaky. |

Left as warnings on purpose: fixing them is behaviour change, not cleanup, and
they were found at the end of a long session. They are real, and they are worth a
morning.

## Known debt — written down so it stops living in someone's head

Four things are still wrong. None of them break anything today, which is exactly
why they need writing down: that is the condition under which the last batch
survived for months.

### 1. `DB Migrations — Production` is red

`Deploy — Production` reaches this job and fails with exit 1 on `supabase link`
or `supabase db push`. It has never succeeded — the workflow never got past its
own test gate before 17 July 2026, so everything downstream is untested ground.

Nothing is broken by it *right now*: the schema is already correct (every table
verified present), and Vercel deploys `main` through its own Git integration, so
the code ships regardless. What it costs is the future — every migration you
write from here on will not be applied by the pipeline, and you will keep
applying schema by hand.

Start with the log of that job. Most likely a missing or stale secret:
`SUPABASE_ACCESS_TOKEN`, `PRODUCTION_DB_PASSWORD`, `PRODUCTION_SUPABASE_PROJECT_ID`.

### 2. The production environment has no reviewers

`production.yml` has an `Approval Gate` job with `environment: production`. On
17 July it did not pause — it went straight through to the migrate job. So there
are no required reviewers configured, and `supabase db push` would have run
against the production database unattended. It only didn't because it errored.

Two minutes of work: Settings → Environments → production → Required reviewers.

### 3. The migration ledger is not one ledger

See the table above. Two ledgers, three ways of applying schema, and the five
newest migrations recorded in neither. Pick one path (`supabase db push`, since
it is the one meant to run unattended), reconcile with `supabase migration
repair`, delete the other. Blocked on (1).

### 4. The Supabase client has never been typed

`data/types.ts` hand-writes the `Database` type. Every table in it is missing the
`Relationships` key that @supabase/postgrest-js requires, and the schema is
missing Views / Functions / Enums / CompositeTypes. So the type fails its
`GenericSchema` constraint and supabase-js resolves **every** table to `never` —
including tables that are right there in the file. Verified: adding
`platform_backups` plus the four schema keys was not enough; `rules_config` is in
`Tables` and still resolves to `never`.

That is why there are 24 `(db as any)` casts. They were not laziness; they were
the only way to use the client. Every `db.from(...)` in this codebase is
effectively `any`, and has been since the file was written.

The fix is one command and a day of consequences:

```
npx supabase gen types typescript --linked > data/database.types.ts
```

Then the 24 casts come out, and you find out what they were hiding. Given that
the equivalent hand-written Stripe shim (types/stripe.d.ts, deleted on 17 July)
had been actively teaching the codebase that `current_period_end` lives on the
subscription root — which stopped being true in API 2024-09-30 — expect to find
something.

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

## What is still not covered

Stated plainly, because a list of what a suite does not test is worth more than a
coverage percentage.

- **No DB integration tests.** Everything is pure. `tests/billing/billing-flow.test.ts`
  models `personalization_sessions` with a `Set` that enforces the same primary
  key — it proves the *logic* around the table, not the table.
- **No browser tests.** Nothing renders a page and checks what a visitor sees.
- **No Stripe integration tests.** `nextCalendarMonthStartUnix` is tested;
  whether Stripe honours the anchor is not.
- **The AI adapters are not exercised against a live model.** By design — but it
  means "AI mode works" is still only tested at the seam.
