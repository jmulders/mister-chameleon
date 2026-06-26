# CMS Pipeline (Statamic → Ploi)

Deploy flow, environment configuration, and a staging plan for the per-tenant
Statamic CMS. Companion to [`pipeline.md`](./pipeline.md) (the Next.js frontend).

> **Why this doc exists:** every production *incident* on the CMS side so far has
> been **config drift** in per-app environment variables — not code. The Live
> Preview rendering on the wrong tenant's frontend (June 2026) is the canonical
> example. The env-var matrix below is the single most important section.

---

## Architecture

- Each tenant runs its **own** Statamic flat-file CMS instance on **Ploi Cloud**
  (Kubernetes, image-based, **ephemeral filesystem** — only mounted volumes and
  git-committed files survive a deploy).
- The Live Preview bridge (`/mc-live-preview` + `/mc-live-preview-data`) ships in
  the **`mister-chameleon/statamic` addon** (`vendor/…`), not in `routes/web.php`.
- There is **no CI and no staging tier** for the CMS today (see the plan below).

### Repositories

| Repo | Tenant(s) | Frontend |
|------|-----------|----------|
| `jmulders/mister-chameleon-cms` | template + **steunles** (`another-statamic`) | www.steunles.nl |
| `jmulders/mister-chameleon-cms-another-statamic` | **misterchameleon** (`statamic`) | www.misterchameleon.nl |

> Note the confusing naming: the **misterchameleon** CMS lives in the repo whose
> name ends `-another-statamic`, and its runtime tenant id is `statamic`. The
> `another-statamic` *tenant id* is **steunles**. Double-check before pushing.

### Deploy flow

```
edit fieldset/template/config in the tenant repo
   │
   ├─►  git push   (to the correct tenant repo)
   │
Ploi → app → "Deploy now"
   │   runs deploy.sh:
   │     • sed-rewrites resources/sites.yaml `nl.url` ← STATAMIC_SITE_URL
   │     • boot-copies public/set-previews → public/assets/set-previews (volume)
   │
Statamic Git Sync tracks content/ only (not resources/ or config/)
```

**Fieldsets do NOT auto-sync** (`mc:sync` is intentionally disabled). To change a
blueprint/fieldset: edit it in the repo and redeploy. See
[`provision-statamic-tenant.md`](./provision-statamic-tenant.md).

---

## Environment variables — the drift source

These are set **per Ploi app** (CMS) and **per Vercel project** (frontend). They
must all point at the **tenant's own** hosts. Mixing them up (e.g. a value copied
from steunles) is what breaks the Live Preview.

| Var | Set on | Purpose | Must equal (misterchameleon) |
|-----|--------|---------|------------------------------|
| `STATAMIC_SITE_URL` | Ploi (CMS) | `deploy.sh` rewrites `sites.yaml` `nl.url`; drives permalinks + "Visit URL" | `https://www.misterchameleon.nl` |
| `MC_PREVIEW_FRONTEND_URL` | Ploi (CMS) | Host the **Live Preview** iframe embeds (`BASE/mc-preview`) | `https://www.misterchameleon.nl` |
| `STATAMIC_API_URL` | Vercel (frontend) | Fallback base the mappers use to resolve **draft** asset URLs to the CMS | `https://cms.misterchameleon.nl` |

Per-tenant values:

| Tenant | STATAMIC_SITE_URL | MC_PREVIEW_FRONTEND_URL | STATAMIC_API_URL |
|--------|-------------------|-------------------------|------------------|
| misterchameleon (`statamic`) | `https://www.misterchameleon.nl` | `https://www.misterchameleon.nl` | `https://cms.misterchameleon.nl` |
| steunles (`another-statamic`) | `https://www.steunles.nl` | `https://www.steunles.nl` | `https://cms.steunles.nl` |

### How these actually bite (June 2026 incident)

- The misterchameleon CMS had `MC_PREVIEW_FRONTEND_URL = https://www.steunles.nl`.
  Result: its Live Preview embedded `www.steunles.nl/mc-preview`, so every
  host-relative asset (`/assets/x`) resolved against steunles → 404 → broken
  images, even though the content + theme were correct.
- The frontend host does **not** proxy `/assets/` (`www.misterchameleon.nl/
  assets/x` → 404). Draft assets must therefore be resolved to **absolute** CMS
  URLs (`https://cms.misterchameleon.nl/assets/x`). The mapper now does this by
  receiving the per-tenant CMS base from `mc-preview` (commit `bb93236`), falling
  back to `STATAMIC_API_URL`.

### Config-drift checklist (run after any tenant clone / provision)

- [ ] `STATAMIC_SITE_URL` = the tenant's own `www.` frontend.
- [ ] `MC_PREVIEW_FRONTEND_URL` = the tenant's own `www.` frontend (NOT another tenant's).
- [ ] `STATAMIC_API_URL` (Vercel) = the tenant's own `cms.` host.
- [ ] `resources/sites.yaml` `nl.url` ends up correct after deploy (the robust
      `sed` in `deploy.sh` rewrites it from `STATAMIC_SITE_URL` regardless of the
      committed value).
- [ ] Live Preview: open an entry → Live Preview → confirm the nested iframe host
      is the tenant's own frontend, and that testimonial/logo images load.

---

## CMS staging — provisioning plan

To give the CMS the same `dev → staging → production` confidence as the frontend:

1. **Staging CMS app (Ploi):** clone the tenant's CMS app to a staging app
   (e.g. `cms.staging.misterchameleon.nl`) from the same repo, `develop` branch
   if you want it to track staging.
2. **Staging frontend:** the frontend `develop` → Vercel staging already exists;
   point its `STATAMIC_API_URL` at the staging CMS, and register the staging host
   in `tenant/resolve-tenant.ts` (currently commented out).
3. **Staging env vars:** set all three vars (table above) to the **staging** hosts.
4. **Staging content:** Statamic Git Sync means content is in git — a staging app
   on the `develop` branch gives you a content sandbox. Promote by merging
   `develop → main` (or by cherry-picking content commits).
5. **Smoke test:** after a staging deploy, run the config-drift checklist above
   against the staging app before promoting to production.

Until this exists, treat **any** CMS fieldset/template/config change as a direct
production change: deploy to the production Ploi app and verify with the
config-drift checklist immediately.

---

## Related docs

- [`pipeline.md`](./pipeline.md) — frontend (Next.js → Vercel) pipeline.
- [`provision-statamic-tenant.md`](./provision-statamic-tenant.md) — adding a new tenant CMS.
- [`new-tenant-setup.md`](./new-tenant-setup.md) — end-to-end new-tenant checklist.
- [`config-architecture.md`](./config-architecture.md) — where config lives (static registry vs DB vs env).
