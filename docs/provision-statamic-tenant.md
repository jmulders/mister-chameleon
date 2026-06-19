# Provision a new Statamic tenant (fresh instance)

A reproducible checklist for spinning up a new Statamic-backed tenant on a fresh
Statamic instance (Ploi) wired to the platform (Vercel). Captures every step and
the failure modes we actually hit so they don't recur.

For the *why* (architecture, auth, slot resolution) see
[`runbook-platform-cms-addon.md`](./runbook-platform-cms-addon.md).

---

## 0a. Automated path (recommended)

Most of the steps below are now **one click**. On **Admin → Tenants → [tenant] →
Setup → "Provision CMS instance (automated)"**:

1. **Fase 1** generates a per-tenant GitHub repo *from the template* (a full copy,
   incl. the committed platform fieldsets) via the GitHub template API — no more
   empty/partial repos (which caused `public/index.php` to be missing → the app
   404'ing on everything).
2. **Fase 2** creates the Ploi Cloud application via the Infrastructure-as-Code
   API, pointing at that repo, with the env secrets, `composer install` build
   command, `/cp/auth/login` health check and PHP extensions that are known to
   work — and **no Node.js, no `mc:sync`**.

Configure the tokens once in **Admin → Platform → Integrations → Provisioning**
(GitHub PAT + Ploi Cloud API token + team).

### Step-by-step in the platform (Statamic tenant)

1. **Create the tenant** (cms.provider = `statamic`). The siteKey auto-generates.
2. **Setup → "Provision repo + Ploi app"** → Fase 1 + Fase 2 run (repo from
   template + Ploi Cloud app). Use **Dry run** first to preview.
3. In **Ploi**, open the new app, wait for the first deploy to go healthy, and
   copy its **host** (`…ams1-t.preview.ploi.it`).
4. **Setup → "Finalize wiring"** → enter that Ploi host + the tenant's domain.
   This writes `cms.statamicBaseUrl`, the `tenant_domains` rows, and points the
   repo's `sites.yaml` at the domain — then prints the exact DNS records + the
   two Ploi env vars to set.
5. **Vercel** → add the domain to the platform project. **DNS** (registrar) →
   the A (apex `76.76.21.21`) + CNAME (`www` → `cname.vercel-dns-0.com`) records
   the Finalize card printed (Vercel's panel is authoritative; add any TXT it asks).
6. **Ploi** → set `APP_URL` + `MC_PREVIEW_FRONTEND_URL` (printed by Finalize) on
   the app → **redeploy the Ploi app**.
7. **Redeploy the platform on Vercel** so the cached tenant config refreshes.
8. Smoke test: `https://www.<domain>` shows real content; `/cp` opens; Live
   Preview + "Visit URL" target the tenant's own domain.

> **Ploi Cloud specifics that bit us (now baked in):** the build context copies
> `composer.json` *before* the rest of the app, so `php please …` cannot run as a
> Build command; init-container commands run in a separate, ephemeral container
> (their file writes don't reach the main container). That's why the fieldsets
> are **committed into the repo** instead of generated at deploy. Health check
> must be `/cp/auth/login` (not `/up` — Statamic's frontend catch-all + the
> absolute multisite URL make `/up` 404 on the kube-probe host).

The manual steps below remain valid as a fallback / reference.

---

## 0. Prerequisites
- Platform deployed (Vercel) — it serves the provisioning manifest at
  `/api/v1/provision/manifest`.
- (Only if you want the live booking agenda) the platform Google Calendar
  integration is configured: Admin → Platform → Integrations → Calendar. It is
  **shared across all tenants**.

## 1. Create the tenant (platform / admin)
- Admin → Tenants → create. Set **cms.provider = `statamic`**.
- A **snippet siteKey is now auto-generated on creation**
  (`settings.snippet.siteKey`). Copy it from Admin → Tenant → Snippet — you need
  it for the CMS env in step 2. (Historically this was a manual step; a missing
  key was the root cause of a long outage — see Gotchas.)

## 2. Spin up the fresh Statamic instance (Ploi)
New Ploi app from the `mister-chameleon-cms` repo. Set these **env vars**
(Ploi → Environment) — NOT the localhost dev values:

| Var | Value |
|---|---|
| `APP_URL` | the Statamic host, e.g. `https://<app>.ams1-t.preview.ploi.it` |
| `STATAMIC_API_ENABLED` | **`true`** ← the REST API must be on, or the platform can't fetch anything |
| `STATAMIC_PRO_ENABLED` | `true` |
| `MISTER_CHAMELEON_API_URL` | the platform: `https://www.misterchameleon.nl` (serves the manifest) |
| `MISTER_CHAMELEON_TENANT_KEY` | the tenant siteKey from step 1 |
| `MC_PREVIEW_FRONTEND_URL` | the platform: `https://www.misterchameleon.nl` |

**Deploy script** (Ploi), after `git pull` + `composer install` — see
[`DEPLOY.md`](https://github.com/jmulders/mister-chameleon-cms/blob/main/DEPLOY.md)
in the CMS repo:

```bash
php please mc:sync        # fetches the manifest → writes the platform fieldsets
php please cache:clear
php please stache:refresh
```

A ready-to-use `deploy.sh` ships in the CMS repo — paste it into Ploi's deploy
script. On boot, the log line `Fetching build manifest from … ` must **write the
fieldsets** (not `Platform returned HTTP 501`).

Once configured, you can also trigger this deploy from the admin:
**Admin → Tenants → [tenant] → Setup → "Deploy CMS now"** (paste this tenant's
Ploi deploy webhook URL there once — each Statamic instance has its own).

## 2b. Seed the standard pages
For a brand-new instance, copy the clean starter pages so the CP has valid,
typed content from the start:

```bash
cp -R seed/content/. content/
php please cache:clear && php please stache:refresh
```

`seed/` contains `home.md` (the standard context slots + the global variant
catalogue) and `contact.md`. See `seed/README.md` for adding more pages.

## 3. Wire tenant ↔ Statamic on the platform
- DB `tenant_settings.settings.cms.statamicBaseUrl` = the Statamic host.
- DB `platform_settings` key `statamic` → `baseUrl` = same host (a fallback;
  **never leave it on `http://127.0.0.1:8000`** on prod).
- Vercel env `STATAMIC_API_URL` = the Statamic host (env-fallback client).

## 4. Map the public domain
- DB `tenant_domains`: add a row with `tenant_id`, `domain`, and `hostname` set
  to the public domain (e.g. `www.example.com`). One row per hostname, no
  duplicates.
- DNS: CNAME for `www` → the value Vercel shows; A record for the apex →
  `76.76.21.21` (see the DNS tip in Admin → Tenant → Setup).
- Vercel → Project → Domains: add the domain.

## 5. Redeploy the platform (Vercel)
After any env/DB change, **redeploy** so the cached tenant config is refreshed
(in-memory caches otherwise keep the old host).

## 6. Smoke test
```bash
# 1. Manifest resolves the tenant by siteKey → statamic (200, not 501)
curl "https://www.misterchameleon.nl/api/v1/provision/manifest?siteKey=<siteKey>"

# 2. Statamic REST API is up
curl "https://<statamic-host>/api/collections/pages/entries?limit=1"

# 3. Nav augments without erroring (real nav, not 500)
curl "https://<statamic-host>/api/navs/main_nav/tree"
```
- Public domain shows the real nav + content (no fallback nav).
- `https://<statamic-host>/cp` opens; editing a page entry does **not** 500.

---

## Gotchas (each caused a real outage)
- **Missing siteKey** → manifest `501` → `mc:sync` fails → fieldsets missing →
  the CP strips `type` from replicator items on save → corrupted content +
  nav `500` + the random "fallback nav" flip-flop. Now auto-generated; just make
  sure it lands in `MISTER_CHAMELEON_TENANT_KEY`.
- **`mc:sync` not in the deploy script** → same fieldset corruption.
- **`STATAMIC_API_ENABLED=false`** → the REST API is off → the platform fetches
  nothing → fallback everywhere.
- **`STATAMIC_PRO_ENABLED` not set** → navigations are a Statamic **Pro** feature,
  so `/api/navs/{handle}/tree` returns **404** → content renders but the site has
  **no navigation** (collections/entries still work, which masks the cause). The
  automated provisioning sets `STATAMIC_PRO_ENABLED=true`; for manual Ploi apps,
  add it to the env. After enabling, `php please config:clear && stache:refresh`
  and redeploy the platform (the empty nav may be cached by Next.js).
- **`platform_settings.statamic.baseUrl = http://127.0.0.1:8000`** (a leaked dev
  value) → fetches go to localhost on prod → fail → fallback nav. Set it to the
  host. (The per-tenant `statamicBaseUrl` overrides it, but never leave it wrong.)
- **Ploi host migration** (e.g. `ams1` → `ams1-t`): update `APP_URL` (Ploi),
  `STATAMIC_API_URL` (Vercel), and both `cms.statamicBaseUrl` (tenant) +
  `statamic.baseUrl` (platform_settings) in the DB, then redeploy the platform.

## Optional per-tenant features
- **Appointment request form** (lightweight): add a Statamic form
  `resources/forms/appointment.yaml` (+ `resources/blueprints/forms/appointment.yaml`)
  so it is selectable in a "Form Section" block. Submissions are handled by the
  platform (`/api/forms/appointment`).
- **Live Google-Calendar agenda** (Calendly-style): add a **Conversion** context
  slot whose variant has **`form_key: "book-demo"`** — `ConversionBlock` then
  embeds the full `BookDemoClient` inline. Requires the platform Google Calendar
  integration (step 0). The standalone agenda also lives at `/nl/book-demo`.
