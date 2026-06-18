# Provision a new Statamic tenant (fresh instance)

A reproducible checklist for spinning up a new Statamic-backed tenant on a fresh
Statamic instance (Ploi) wired to the platform (Vercel). Captures every step and
the failure modes we actually hit so they don't recur.

For the *why* (architecture, auth, slot resolution) see
[`runbook-platform-cms-addon.md`](./runbook-platform-cms-addon.md).

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
