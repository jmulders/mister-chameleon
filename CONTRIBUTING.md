# Contributing — from a clean laptop to a merged PR

The starter kit. It assumes nothing except a machine with git, and takes you from
clone to a change live behind the gate. For deeper detail see
[`docs/testing.md`](./docs/testing.md) (the gate), [`docs/pipeline.md`](./docs/pipeline.md)
(frontend), and [`docs/cms-pipeline.md`](./docs/cms-pipeline.md) (Statamic CMS).

If a step here is wrong, fix it here first — an onboarding doc that lies costs
every next person a morning. (This file was itself corrected on 2026-07-19, when
it still told people to push straight to `main` and run `npx tsc` without typegen.)

## 0. What you need

| Tool | Version | Why |
|---|---|---|
| Node.js | **≥ 22.6** | The test runner uses `--experimental-transform-types`, added in 22.6. Older Node exits before a single test runs. `.nvmrc` pins it — `nvm use`. |
| npm | bundled with Node | — |
| git | any recent | — |
| Supabase CLI | latest (optional) | Only for applying migrations from your machine: `brew install supabase/tap/supabase`. |

No Docker or local Postgres needed — the app runs against a hosted Supabase project.
Check Node before anything else; `package.json` pins `engines: { node: ">=22.6" }`:

```
node --version   # v22.6 or higher
```

## 1. First-time setup

```
git clone https://github.com/jmulders/mister-chameleon.git
cd mister-chameleon
cp .env.example .env.local
```

Fill in `.env.local` — at minimum `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`ADMIN_SESSION_SECRET` (any long random string for local dev). Point it at the
**development** project (`mister-chameleon-dev`), never production — ask a
maintainer for the dev keys.

Then let the bootstrap script check versions, install deps, apply migrations, seed
the minimum, and validate:

```
node --experimental-strip-types scripts/bootstrap.ts
```

Or by hand: `npm ci`, then `supabase db push` against your dev DB. The Statamic CMS
runs separately on `:8000` if you are doing CMS work.

## 2. Run it

```
npm run dev        # Next.js on http://localhost:3000
```

## 3. Install the gate on your machine (once)

```
git config core.hooksPath .githooks
```

Now `git push` runs `npm run verify` and refuses to push if it is red.
`git push --no-verify` skips it — a deliberate escape hatch.

## 4. The one command you'll run most

```
npm run verify     # lint + typecheck + all tests — the gate
```

Green here means green in CI, because it is the *same command* on both sides.
Do **not** run `npx tsc --noEmit` on its own — use `npm run typecheck`, which runs
`next typegen` first (without it, a clean checkout invents ~18 phantom errors).

## 5. Making a change

```
git checkout -b feat/short-description     # branch off main, one change per branch
# ... edit; add a test for anything in billing or personalisation ...
npm run verify
git add -p && git commit -m "feat: what and why"
git push -u origin feat/short-description
```

Then open a Pull Request to `main`. CI runs **Verify** and **Build**; both must be
green, and a maintainer approves. **Branch protection means you cannot push to
`main` directly** — every change is a PR. (The old "fast-path push to main" is
gone; it was never safe.)

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) —
the version bump and changelog are derived from the prefix:

```
feat:  fix:  perf:  refactor:  docs:  test:  chore:  ci:
```

## 6. What happens when you merge to `main`

- **Vercel** deploys `main` to production automatically via its Git integration.
- **`Deploy — Production`** runs: `test → approve → migrate → health → release`.
  `approve` pauses for a required reviewer; `migrate` runs `supabase db push`
  against production; `release` bumps the version, writes the changelog, tags, and
  publishes a GitHub release.

You never run this by hand — merging is the trigger. Note the gate protects the
**database**; Vercel puts the code live at merge, before the approval step.

> Staging note: `develop`/staging is not currently wired to its own database — there
> is no separate staging Supabase project yet. Treat `main` + PR review as the path
> to production until one exists (`staging.yml` is ready for the day it does).

## 7. Changing the database

Migrations live in `supabase/migrations/` as timestamped `.sql` files, and they
**are** the schema (repo and DB stay in sync — check with `supabase migration list`).

```
supabase migration new short_description   # next file
# ... write DDL; guard every statement with IF NOT EXISTS so it is idempotent ...
supabase db push                           # applies to the DB in your .env
```

Never edit an existing migration. Rules learned the hard way (see `docs/testing.md`):
**one ledger** (`schema_migrations` — never hand-edit it, never run raw SQL outside a
migration), **idempotent**, **unique version numbers**.

## 8. Tests

| What | Command | Runs |
|---|---|---|
| The gate (unit + logic) | `npm test` / `npm run verify` | always, no secrets |
| Billing / personalisation only | `npm run test:billing` / `npm run test:personalization` | — |
| DB / Stripe / AI integration | `npm run test:integration` | self-skips without secrets — see `tests/integration/README.md` |
| Browser / E2E (Playwright) | `npm run test:e2e` | `npm i -D @playwright/test && npx playwright install` first |

Add a test **before** the fix and watch it fail for the reason you expect.

## 9. CMS (Statamic) changes

Fieldsets/templates/config do **not** auto-sync — edit them in the tenant repo and
redeploy via Ploi. After any CMS deploy, run the **config-drift checklist** in
[`docs/cms-pipeline.md`](./docs/cms-pipeline.md) — the per-tenant env vars
(`STATAMIC_SITE_URL`, `MC_PREVIEW_FRONTEND_URL`, `STATAMIC_API_URL`) are the most
common source of production/preview incidents.

## 10. Rollback

Frontend issues roll back in ~2 min via the **Production Rollback** GitHub Action
(re-aliases Vercel to a previous deployment, no DB change). A bad migration is not
a code rollback — restore from Supabase → Database → Backups. See `docs/pipeline.md`.

## 11. Traps that cost an hour if you don't know them

- **CI type errors you can't reproduce** → `npm run typecheck` (runs `next typegen`).
- **`scripts/*.ts` import each other with `.ts` extensions**, not `.js` — they run
  under `--experimental-strip-types`, which resolves paths literally. Hence
  `allowImportingTsExtensions` in `tsconfig.json`.
- **A workflow change only takes effect after it is merged to `main`** — a pipeline
  runs the workflow file as it exists on the branch it runs on.

## Where things live

```
app/                Next.js App Router — routes, API, admin
proxy.ts            Edge middleware (tenant resolution, rate limiting)
lib/pipeline/       The personalisation decision pipeline
billing/            Stripe, subscriptions, wallets, the webhook handler
data/               Supabase client + generated types (database.types.ts)
tenant/             Multi-tenant resolution and config
supabase/migrations The schema, one file per change
tests/              The gate (unit + logic)
tests/integration/  Opt-in DB / Stripe / AI tests
e2e/                Playwright browser tests
docs/testing.md     Why the gate is shaped the way it is — read this
scripts/            bootstrap, backup, release, validate (run with strip-types)
```

Welcome aboard. Start with `npm run dev` and `docs/testing.md`.
