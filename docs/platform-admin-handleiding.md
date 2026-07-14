# Platform-admin Handleiding

Volledige naslag van de platform-beheeromgeving van Mister Chameleon: het gedeelte onder `/admin` waar een platform-operator (super-admin) het hele platform beheert. Dit staat los van de tenant-workspace (per klant), die in een aparte handleiding wordt behandeld.

## 1. Inleiding

**Wie gebruikt dit.** Platform-admins (rol `superadmin` of `admin`) zien de volledige linker-sidebar en alle tenants. Tenant-scoped admins hebben alleen toegang tot hun eigen workspace en worden op platform-pagina's weggeleid.

**Inloggen en beveiliging.** Toegang loopt via een admin-sessie met twee-factor-authenticatie (TOTP). Relevante env-vars: `ADMIN_SESSION_SECRET` (sessie-ondertekening) en `ADMIN_TOTP_ISSUER` (naam in de authenticator-app). Elke admin-pagina en server-action verifieert de sessie via `getRequiredAdminSession()`.

**Layout.** Donkere linker-sidebar met vijf secties: PLATFORM, MONITORING, SALES, SYSTEM, DEFAULTS. Secrets worden nooit naar de browser gestuurd: velden tonen een "configured/saved"-indicator en blijven leeg bij render, zodat een leeg veld nooit een opgeslagen geheim overschrijft.

---

## 2. PLATFORM

### Tenants — `/admin/tenants`
- **Wat:** Overzichtstabel van alle tenants met package-badges en vier statistiek-kaarten (Total, Active, Pro/Agency, Growth); client-side paginatie.
- **Waarom:** Centraal startpunt om klanten te bekijken en door te klikken naar een workspace.
- **Acties:** "New Tenant"-knop, rij-links naar `/admin/tenants/[id]`, verwijderknop per rij, paginatie.
- **Env:** geen; leunt op de tenant-store.

### New Tenant (Onboarding) — `/admin/onboarding`
- **Wat:** Wizard om een nieuwe client-tenant aan te maken.
- **Waarom:** Nieuwe workspace aanmaken; instellingen afgeleid van het package, later verfijnd op de tenant-detailpagina.
- **Acties:** Velden Tenant name, Tenant ID (auto-slug), Website URL, Package (starter/growth/pro), CMS provider (platform/sanity/storyblok/statamic/mock), Theme preset. Submit maakt de tenant aan + readiness-checklist en theme-preview.
- **Env:** geen; opties uit package-constants en theme-catalogus.

### Signups (Trial queue) — `/admin/platform/signups`
- **Wat:** Dashboard voor trial-signups uit de Stripe-checkout (`pending_trial_signups`, status pending/completed/dismissed/failed).
- **Waarom:** Bij een vertraagde/gefaalde Stripe-webhook de signup handmatig afronden.
- **Acties:** per rij "Process", "Resend/Email retry", "Dismiss".
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Integrations (platform-brede koppelingen)

Platform-brede credentials per externe dienst; gelden als default/fallback. Per-tenant activering staat in de Integrations-tab van die tenant.

- **CMS** (`/integrations/cms`) — Sanity, Storyblok, Statamic. Factory kiest de eerst-geconfigureerde (Sanity → Storyblok → Statamic → Mock). Velden: projectId/dataset/write-token (Sanity), access token/regio/version (Storyblok), base URL/API key (Statamic) + "Test connection".
- **CRM** (`/integrations/crm`) — gedeelde HubSpot Private App token voor company-by-domain enrichment.
- **AI** (`/integrations/ai`) — platform-fallback keys Anthropic/OpenAI (tenant-keys hebben voorrang).
- **Enrichment** (`/integrations/enrichment`) — MaxMind, Clearbit, IPinfo, Leadinfo, OpenKvK/KvK, Nager.Date, reverse-geocode, weather, GA4-history; per provider secret + "Test connection".
- **Domains** (`/integrations/domains`) — Vercel Domains API (teamId + apiToken).
- **Email** (`/integrations/email`) — platform-transport Resend of SMTP + backoffice-adres/From. Resolutie: tenant → platform → env → skip.
- **Stripe** (`/integrations/stripe`) — publishableKey/secretKey/webhookSecret + credit-bundle price-IDs; "Test connection" pingt `/v1/balance`.
- **Storage** (`/integrations/storage`) — Sanity Assets / Supabase Storage / Cloudflare R2; provider kiezen + "Test connection".
- **Forge** (`/integrations/forge`) — Laravel Forge (apiKey, serverId, repo, branch, php-versie) voor Statamic-deploys.

---

## 3. MONITORING

### AI Logs — `/admin/ai-logs`
- **Wat:** Recente AI-beslissingslogs (`ai_decision_logs`): live-plan vs. shadow-plan met confidence en policy-verdict; summary-bar (agreement rate, mismatches, distinct tenants).
- **Waarom:** Observability van de AI-decision engine; afwijkingen monitoren.
- **Acties:** filter `?tenant=slug`; kolommen timestamp, tenant, session, live/shadow, match, confidence, verdict (USE_AI / FALLBACK_LOW_CONFIDENCE / …), source.
- **Env:** geen; keys worden nooit gelogd.

### Context Variables — `/admin/context`
- **Wat:** Dictionary van 67 ingebouwde contextvariabelen + operator-editable metadata.
- **Waarom:** Labels/beschrijvingen/beschikbaarheid beheren van variabelen die rules en AI gebruiken.
- **Acties:** per variabele Edit (label, category, gates "in rules"/"in AI", enabled); custom variabele aanmaken/verwijderen; built-ins deels read-only.
- **Env:** geen.

---

## 4. SALES

### Prospect Demos — `/admin/demo`
- **Wat:** Lijst van gegenereerde prospect-demos (mirror/synthetic), Active + Expired, met deelbare URLs.
- **Acties:** "+ New demo"; per rij browse-URL + kopieerknop.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Demo Importer — `/admin/platform/demo-importer`
- **Wat:** Config-/diagnostiekhub voor de demo-generator: provider-readiness, gedrag, output-defaults, recente runs, test-generator.
- **Acties:** provider-"Test connection", behavior-toggles, output-defaults, runs-tabel (met delete), test-panel voor een live-URL.
- **Env:** Anthropic AI-key (flag) + analyzer-provider.

---

## 5. SYSTEM

### Billing (platform-breed) — `/admin/platform/billing`
- **Wat:** Alle tenants in één blik met totale MRR en per tenant plan, status, cycle en credit-gebruik.
- **Waarom:** Omzet bekijken en `past_due`/overages signaleren.
- **Acties:** read-only tabel + quick-links; sub-secties plans/pricing/usage/defaults.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### CMS (legacy redirect) — `/admin/platform/cms`
- **Wat:** Permanente redirect naar `/admin/platform/integrations/cms` (deprecated). Geen seed-UI ondanks het sidebar-label.

### Deployment — `/admin/platform/deployment`
- **Wat:** Setup-status, env-var checklist en stap-voor-stap gids (Vercel + Supabase). Env-waarden gaan nooit naar de client (alleen isSet-flags).
- **Acties:** tabs Checklist (fix-/seed-knoppen, re-check), Env vars (set/missing), Guide (walkthrough met kopieerknoppen).
- **Env:** manifest incl. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_TOTP_ISSUER`, `NEXT_PUBLIC_SITE_URL`, `MC_FALLBACK_TENANT_ID`, `MC_HOMEPAGE_DECISION_PROVIDER`, `MC_DEMO_SITE_KEY`, Sanity-vars.

### Docs — `/admin/platform/docs`
- **Wat:** Lijst van de repo-runbooks/gidsen uit `docs/`, in-app gerenderd (waaronder deze handleiding).

### System (Operations / Backup) — `/admin/platform/system`
- **Wat:** Backup, build-pipeline en environment-uitleg. Backup interactief; rest statisch.
- **Acties:** "Create Backup", versiegeschiedenis, "Restore" (append-only); workflow-knoppen triggeren GitHub Actions (deploy/hotfix), rollback-trigger, git-commit-panel.
- **Env:** database via `getDb`; GitHub Actions workflow-dispatch.

---

## 6. DEFAULTS

### Adaptive blocks (catalogus) — `/admin/platform/blocks`
- **Wat:** Platform-brede block-catalogus per slot met preview + statuslijst; tellers totaal/actief/gedekt/ontbrekend.
- **Acties:** "Seed" (ontbrekende blocks), per block "Edit" (default-variant/tokens + AI/Decision-signalen), preview-toggles.

### Variant defaults (catalogus) — `/admin/platform/variants`
- **Wat:** Alle varianten die de AI kan kiezen (Platform + CMS), met source, aiReady en decisionMeta; plus per-slot content-budget-plafonds.
- **Acties:** "Open in Sanity Studio"-links; budget-formulier (heroMax, proofMax, …; amber 75%, rood 100%, niet-blokkerend).

### Interest defaults — `/admin/interest-profiles`
- **Wat:** Platform-interest-profielen per family (B2B/SaaS, Careers, Commerce, Real Estate) en status (ACTIVE/SUGGESTED); scoren metaKeywords.
- **Waarom:** Voeden `interestPrimary`/`interestSecondary`/`interestConfidence` voor rules en AI.
- **Acties:** "Seed catalog"; profiel-formulier (key immutable, name, description, is_active, tag-editor met weight 0.1–10).

### Token extractor — `/admin/platform/token-extractor`
- **Wat:** Plak een publieke URL; het platform distilleert design-tokens (kleuren/fonts/radius/schaduw) + block-token-set.
- **Acties:** URL + pages-teller (default 5); run; kleurstalen + importeerbare JSON met copy/download.

---

## 7. Bijlage — kern-omgevingsvariabelen

| Variabele | Waarvoor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project-URL (publiek) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (publiek) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role (server-only) |
| `ADMIN_SESSION_SECRET` | Ondertekening admin-sessie |
| `ADMIN_TOTP_ISSUER` | Issuer voor 2FA-authenticator |
| `NEXT_PUBLIC_SITE_URL` | Publieke basis-URL platform |
| `MC_FALLBACK_TENANT_ID` | Fallback-tenant |
| `MC_HOMEPAGE_DECISION_PROVIDER` | Decision-provider homepage |
| `MC_DEMO_SITE_KEY` | Site-key voor demo's |
| `CRON_SECRET` | Gate voor cron-endpoints |

Overige diensten (Stripe, HubSpot, MaxMind/enrichment, Resend/SMTP, Vercel Domains, Cloudflare R2, Laravel Forge, Anthropic/OpenAI) configureer je bij voorkeur via de Integrations-UI in plaats van env-vars.
