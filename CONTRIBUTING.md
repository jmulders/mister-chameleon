# Contributing

Quick reference for how work flows from local dev to production. For the full
detail, see [`docs/pipeline.md`](./docs/pipeline.md) (frontend) and
[`docs/cms-pipeline.md`](./docs/cms-pipeline.md) (Statamic CMS).

## Local setup

```bash
npm ci
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

The Statamic CMS runs separately on `:8000` for local CMS work.

## Branch flow

```
feature/<name>  (branch from develop)
   └─PR→ develop   → CI + auto-deploy to staging
            └─PR→ main → CI + approval gate → production (+ tag/release)
hotfix/<name>   (branch from main, for urgent prod fixes)
```

- **`develop` = staging**, **`main` = production**.
- **Fast-path:** pushing straight to `main` is allowed for speed — the CI gate
  (lint + `tsc --noEmit` + tests + build) still runs on every push to `main`, so
  it can't deploy broken code. Use the `develop → main` route for risky,
  multi-file, or migration-bearing changes.
- Keep `develop` in sync with `main` so it stays a usable base — run the
  [develop-sync runbook](./docs/develop-sync.md) periodically.

## Before you push

CI runs these on every PR/push to `main`/`develop` — run them locally first:

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — the version bump
and changelog are derived from the prefix:

```
feat:  fix:  perf:  refactor:  docs:  test:  chore:  ci:
```

## Database changes

Never edit an existing migration. Add a new `supabase/migrations/<ts>_desc.sql`
and let the staging deploy apply it first. See `docs/pipeline.md`.

## CMS (Statamic) changes

Fieldsets/templates/config do **not** auto-sync — edit them in the tenant repo
and redeploy via Ploi. After any CMS deploy, run the **config-drift checklist**
in [`docs/cms-pipeline.md`](./docs/cms-pipeline.md) (the per-tenant env vars —
`STATAMIC_SITE_URL`, `MC_PREVIEW_FRONTEND_URL`, `STATAMIC_API_URL` — are the most
common source of production/preview incidents).

## Rollback

Frontend issues roll back in ~2 min via the **Production Rollback** GitHub Action
(re-aliases Vercel to a previous deployment, no DB change). See `docs/pipeline.md`.
