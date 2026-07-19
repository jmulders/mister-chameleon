# Mister Chameleon

A multi-tenant, contextual-website SaaS: one platform that serves each visitor an
adaptive homepage and pages, personalised on behaviour, firmographics and intent,
and bills the tenant per web session.

- **Platform** — Next.js 16 / React 19 / TypeScript on Vercel. Personalisation,
  admin, APIs, billing.
- **CMS** — Statamic 6 / Laravel on Ploi, per tenant. Delivers the content.
- **Data** — Supabase (Postgres). Schema lives in `supabase/migrations/`.

## Start here

New to the codebase? **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** is the starter kit —
it takes you from a clean laptop to a merged PR: setup, running locally, the test
gate, the branch → PR → deploy flow, migrations, and the traps worth knowing.

```bash
node --version            # must be >= 22.6
cp .env.example .env.local # fill in the dev Supabase keys
npm ci
npm run dev               # http://localhost:3000
```

## The one command

```bash
npm run verify            # lint + typecheck + tests — the gate CI runs too
```

Install it as a pre-push hook once: `git config core.hooksPath .githooks`.

## Documentation map

| Read when | Doc |
|---|---|
| Onboarding / day one | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Why the test gate is shaped this way | [`docs/testing.md`](./docs/testing.md) |
| Deep dev reference (repo layout, scripts, envs) | [`docs/developer-gids.md`](./docs/developer-gids.md) |
| Deploy pipeline | [`docs/pipeline.md`](./docs/pipeline.md) |
| Statamic CMS pipeline | [`docs/cms-pipeline.md`](./docs/cms-pipeline.md) |
| Backup & restore | [`docs/backup-restore.md`](./docs/backup-restore.md) |
| Architecture overview | [`docs/mvp-architecture.md`](./docs/mvp-architecture.md) |

The full set of runbooks lives in [`docs/`](./docs).

## How work ships

Every change is a pull request to `main` (branch protection — no direct pushes).
CI runs **Verify** and **Build**; a maintainer approves; merge deploys. Vercel puts
`main` live automatically, and `Deploy — Production` runs
`test → approve → migrate → health → release`.

## Licence

Proprietary — © Mister Chameleon. Not for redistribution.
