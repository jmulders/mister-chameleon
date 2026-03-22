# Staging Deployment Guide

End-to-end instructions for deploying Mister Chameleon to Vercel staging.

---

## Prerequisites

- A Supabase project (free tier is fine for staging)
- A Vercel account with the repository imported
- (Optional) A Sanity project for real CMS content; the app falls back to built-in demo content if absent

---

## Step 1 — Apply Supabase migrations

The three file-backed stores (tenant settings, homepage rules, pages) are now Supabase-backed. You must apply the migrations **before** the first deployment or the app will error when it tries to read from tables that don't exist.

```bash
# Option A — Supabase CLI
npx supabase login
npx supabase db push --project-ref <your-project-ref>

# Option B — Supabase dashboard SQL editor
# Open Settings → SQL Editor and run each migration file in order:
#   supabase/migrations/20240101000009_create_tenant_settings.sql
#   supabase/migrations/20240101000010_create_rules_config.sql
#   supabase/migrations/20240101000011_create_pages.sql
```

Migration `000009` seeds the `mister-chameleon` platform tenant row automatically via `INSERT … ON CONFLICT DO NOTHING`. It is idempotent and safe to re-run.

Earlier migrations (`000001`–`000008`) must also be applied if starting from a blank Supabase project.

---

## Step 2 — Set environment variables in Vercel

Go to **Vercel → Project → Settings → Environment Variables**.

### Required (the app will not start without these)

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret key |

### Recommended for staging

| Variable | Value / notes |
|---|---|
| `MC_FALLBACK_TENANT_ID` | Set to the tenant you want to preview, e.g. `workengine`. Without a custom domain, all traffic lands on `*.vercel.app` which has no registry entry — this env var routes it to the right tenant. |
| `NEXT_PUBLIC_SITE_URL` | Set to your Vercel deployment URL, e.g. `https://mister-chameleon.vercel.app`. Used for OG tags and sitemaps. |

### Sanity CMS (optional — falls back to MockCMSProvider)

| Variable | Notes |
|---|---|
| `SANITY_PROJECT_ID` | Your Sanity project ID |
| `SANITY_DATASET` | Usually `production` |
| `SANITY_API_VERSION` | e.g. `2024-01-01` |
| `SANITY_API_WRITE_TOKEN` | Required only if you will use the **Provision CMS** button in `/admin/tenants/[id]`. Create a Write token at manage.sanity.io → Settings → API → Tokens. |

If Sanity vars are absent the app uses built-in demo content (MockCMSProvider). This is fine for testing the platform mechanics.

### AI / decision engine (optional)

| Variable | Notes |
|---|---|
| `MC_HOMEPAGE_DECISION_PROVIDER` | `rules` (default, zero config), `claude`, or `openai` |
| `ANTHROPIC_API_KEY` | Required when provider is `claude` |
| `OPENAI_API_KEY` | Required when provider is `openai` |
| `SHADOW_AI_ENABLED` | `true` to enable shadow logging to `ai_decision_logs` |

### Email / automation (optional — skipped silently when absent)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | Resend API key for transactional email |
| `MAIL_FROM_ADDRESS` | Sender address, e.g. `hello@example.com` |
| `BACKOFFICE_EMAIL` | Admin notification recipient |
| `N8N_CONTACT_WEBHOOK_URL` | n8n webhook for contact form submissions |

---

## Step 3 — Vercel build settings

Defaults work out of the box. Confirm in **Vercel → Project → Settings → General**:

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Build Command | `next build` |
| Output Directory | `.next` |
| Root Directory | _(blank — project root)_ |
| Node.js Version | 20.x |

No `output: "standalone"` is needed. The project uses the default Next.js output mode.

---

## Step 4 — Sanity Studio (separate deployment)

The Sanity Studio lives at `apps/studio/` — it is a separate Next.js/Sanity app, not part of the main Vercel deployment. Deploy it independently:

```bash
# From the apps/studio directory
cd apps/studio
npx sanity deploy
# This publishes the studio to https://<your-project>.sanity.studio/
```

Alternatively, import `apps/studio` as a separate Vercel project if you prefer a hosted studio URL.

The main Vercel deployment does **not** include the Studio — it only includes the front-end and API routes that *consume* Sanity content via the CDN API.

---

## Step 5 — Tenant resolution on staging

Vercel preview deployments are served on random `*.vercel.app` hostnames. The full resolution order is:

1. [dev only] `x-tenant-override` header (injected by middleware from `?tenant=` query param)
2. [dev only] `mc_dev_tenant` cookie (persistent override set from admin panel)
3. Static `TENANT_REGISTRY` lookup (hostname → TenantConfig) — **miss** on `*.vercel.app`
4. Supabase `tenant_settings` domain lookup — matches `primaryDomain` and `additionalDomains` stored per-tenant. **This is the recommended path for custom production domains.**
5. `MC_FALLBACK_TENANT_ID` env override — **hit** if the env var is set
6. Default: `mister-chameleon`

**Recommended staging config:** Set `MC_FALLBACK_TENANT_ID=workengine` (or whichever tenant you are staging) in Vercel environment variables. This applies to all preview deployments automatically.

### Custom domain routing (production)

The recommended production approach for new tenant domains is:

1. Set `primaryDomain` (and optionally `additionalDomains`) on the tenant's settings row via `/admin/tenants/[id]` or `/admin/onboarding`. **No code deploy required.**
2. The Supabase store lookup (step 4) will resolve requests from that domain to the correct tenant automatically.
3. Optionally, also add the hostname to `TENANT_REGISTRY` in `tenant/resolve-tenant.ts` for O(1) registry lookup performance on high-traffic domains.

At that point `MC_FALLBACK_TENANT_ID` can be cleared or left as a safety net for preview deployments.

---

## Step 6 — Known staging limitations

**Rules editor → live engine disconnect**

Admin-saved homepage rules are now persisted in Supabase (`rules_config` table). However, the `RulesDecisionProvider` reads rules from the local `decision/rules/runtime-rules.json` file at startup. That file does not exist on Vercel, so the provider falls back to the hard-coded `SEED_RULES_CONFIG` silently (logged at WARN level). Changes saved in `/dashboard/rules` will persist in the database but won't affect the live decision engine until the wiring between Supabase and the provider is completed in a future phase.

**Page store seeding**

The file-backed store previously auto-seeded on first access. The Supabase-backed store does not auto-seed. The `pages` table starts empty. Use `resetStore()` from `page-store/store.ts` in a one-off script to populate seed pages, or create pages via the admin UI at `/admin/tenants/[id]/pages`.

---

## Step 7 — Post-deploy verification

After the first successful deployment, run through this verification flow:

### Tenant resolution

1. Open the deployment URL (e.g. `https://mister-chameleon.vercel.app`)
2. Confirm the page loads without a 500 error
3. Open `/dashboard` — confirm the tenant name in the page header matches `MC_FALLBACK_TENANT_ID`
4. If `MC_FALLBACK_TENANT_ID` is not set, confirm the tenant is `mister-chameleon`

### Database connectivity

5. `/dashboard` should load without a "Database unavailable" error
6. Open Supabase table editor → `tenant_settings` — confirm the `mister-chameleon` row is present

### Dashboard and analytics

7. `/dashboard` — page views and CTA clicks show (may be zero on a fresh deploy)
8. `/dashboard/experiments` — loads without error; creating an experiment succeeds
9. `/dashboard/rules` — loads; saving a rule change returns success toast; row appears in Supabase `rules_config` table

### Admin routes

10. `/admin/tenants/mister-chameleon` — loads without 500; shows tenant settings form
11. `/admin/tenants/mister-chameleon/pages` — loads without 500 (list may be empty)
12. Save a change on the tenant settings form — confirm it writes to Supabase

### CMS

13. If Sanity is configured: homepage loads with real variant content from Sanity CDN
14. If Sanity is not configured: homepage loads with MockCMSProvider demo content (this is valid)

### Function logs

15. Vercel → Deployments → Functions → check for any of these errors:
    - `EROFS: read-only file system` — means a filesystem write was attempted; should not appear after this migration
    - `Missing required environment variable` — a required Supabase var is absent
    - `MC_FALLBACK_TENANT_ID=… does not match` — the fallback tenant ID has a typo

---

## Local development (unchanged)

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

The `mc_dev_tenant` cookie and `?tenant=` query-param overrides are only active when `NODE_ENV=development` and are dead-code-eliminated in production builds.

---

## Operator checklist

### 1. Exact env vars to add in Vercel

**Required — add all three before first deploy:**

```
NEXT_PUBLIC_SUPABASE_URL        = https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...  (anon/public key)
SUPABASE_SERVICE_ROLE_KEY       = eyJ...  (service_role secret)
```

**Recommended for staging:**

```
MC_FALLBACK_TENANT_ID  = workengine         (or whichever tenant to preview)
NEXT_PUBLIC_SITE_URL   = https://<your-deployment>.vercel.app
```

**Add if using Sanity:**

```
SANITY_PROJECT_ID       = <your-project-id>
SANITY_DATASET          = production
SANITY_API_VERSION      = 2024-01-01
SANITY_API_WRITE_TOKEN  = <write-token>     (only needed for CMS provisioning)
```

**Add if using AI decision engine:**

```
MC_HOMEPAGE_DECISION_PROVIDER = rules       (safe default; change to claude/openai later)
ANTHROPIC_API_KEY             = sk-ant-...  (only if provider = claude)
```

---

### 2. Deploy and test order

1. Apply Supabase migrations (Step 1 above)
2. Set the Required env vars in Vercel (Step 2)
3. Set `MC_FALLBACK_TENANT_ID` in Vercel
4. Trigger a Vercel deployment (push to main or re-deploy)
5. Wait for build to succeed
6. Run through the post-deploy verification in Step 7

---

### 3. First URLs to open after deploy

Open these in order after the build succeeds:

| URL | What to check |
|---|---|
| `/` | Homepage renders; correct tenant content shows |
| `/dashboard` | Loads; tenant name matches `MC_FALLBACK_TENANT_ID` |
| `/dashboard/experiments` | Loads without error |
| `/dashboard/rules` | Loads; save + reset actions succeed |
| `/admin/tenants/mister-chameleon` | Loads; settings form visible |
| `/admin/tenants/mister-chameleon/pages` | Loads (list may be empty) |

---

### 4. What to verify for each concern

**Tenant resolution**
- `/dashboard` header shows the right tenant name
- No "unknown tenant" fallback when `MC_FALLBACK_TENANT_ID` is set

**Dashboard**
- Metrics load (zeros are fine on first deploy)
- Supabase query errors would show as empty data + console errors in function logs

**CMS**
- If Sanity configured: real variant content visible on `/`
- If Sanity not configured: MockCMSProvider demo content on `/` (acceptable for staging)
- Sanity Studio deployed separately at `apps/studio/` via `npx sanity deploy`

**Admin / provisioning**
- `/admin/tenants/[id]` saves tenant settings to `tenant_settings` Supabase table
- `/admin/tenants/[id]/pages` lists and edits pages stored in `pages` Supabase table
- CMS provisioning ("Provision CMS" button) requires `SANITY_API_WRITE_TOKEN`

**Rules editor**
- `/dashboard/rules` saves to `rules_config` Supabase table ✓
- Saved rules do **not** yet affect the live homepage decision engine — the `RulesDecisionProvider` falls back to `SEED_RULES_CONFIG` until the Supabase → provider wiring is complete (planned future phase)
