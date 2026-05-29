# Configuration Architecture

A standard, multi-tenant, layered configuration system used across all integration domains in the platform.

---

## Overview

The platform resolves configuration in four layers, from lowest to highest priority:

```
system  →  env  →  platform  →  tenant
(code)   (env vars) (admin DB)  (tenant DB)   ← highest priority wins
```

Each domain resolver returns a `DomainResolution<T>` containing:

- **`config`** — the fully-merged effective configuration
- **`source`** — which layer provided the highest-priority value
- **`hasTenantOverride`** — whether the tenant has its own DB config
- **`hasPlatformDefault`** — whether a platform DB default exists
- **`hasEnvFallback`** — whether environment variables contribute
- **`layers`** — raw per-layer values for diagnostics and override comparison

---

## Layers in detail

| Layer | Source | Priority |
|-------|--------|----------|
| **system** | Compiled-in safe defaults in code | Lowest |
| **env** | Environment variables (`RESEND_API_KEY`, `ANTHROPIC_API_KEY`, etc.) | Low |
| **platform** | `platform_settings` Supabase table (admin-configured defaults) | High |
| **tenant** | Per-tenant DB record (dedicated table or `tenant_settings.settings.{domain}`) | Highest |

---

## ConfigSource type

```typescript
type ConfigSource = "tenant" | "platform" | "env" | "system" | "none";
```

`"none"` means no configuration at all — the feature is effectively disabled.

---

## Domain resolvers

All resolvers are **server-only** and return `Promise<DomainResolution<T>>`.

### Email — `resolveEmailConfig(tenantId)`

Merges:
- **tenant**: `tenant_email_transport` table (transport type, SMTP/Resend credentials, fromName/fromEmail)
- **platform**: `platform_settings["email"]` (default transport, from address, backoffice email)
- **env**: `RESEND_API_KEY`, `SMTP_HOST`, `MAIL_FROM_ADDRESS`, `BACKOFFICE_EMAIL`

Returns `ResolvedEmailConfig` — transport-ready, decrypted.

### Forms — `resolveFormsConfig(tenantId)`

Merges:
- **tenant**: `tenant_form_settings` table (store toggle, recipients, confirmation, webhook, success behavior)
- **platform**: `platform_settings["email"].backofficeEmail` (for notification recipient fallback)
- **env**: `BACKOFFICE_EMAIL`

Extra derived fields:
- `effectiveRecipients: string[]` — the resolved notification recipients after all fallbacks
- `recipientSource: ConfigSource` — which layer supplied the recipients

### AI — `resolveAiConfig(tenantId)`

Merges:
- **tenant**: `tenant_settings.settings.ai` (mode, provider config, confidence threshold)
- **platform**: `platform_settings["ai"]` (platform API keys)
- **env**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **system**: `{ mode: "disabled" }`

### CRM — `resolveCrmConfig(tenantId)`

Merges:
- **tenant**: `tenant_settings.settings.crm` (enabled flag, enrichment flag)
- **platform**: `platform_settings["crm"]` (access token, provider)
- **env**: `HUBSPOT_ACCESS_TOKEN`
- **system**: `{ enabled: false, useCrmEnrichment: false }`

### Enrichment — `resolveEnrichmentConfig(tenantId)`

Merges:
- **tenant**: `tenant_settings.settings.enrichment` (enabled flag, geo enrichment flag)
- **platform**: `platform_settings["enrichment"]` (API keys: Clearbit, IPinfo, Leadinfo)
- **env**: `CLEARBIT_SECRET_KEY`, `IPINFO_TOKEN`, `LEADINFO_API_KEY`
- **system**: `{ enabled: false, useGeoEnrichment: false }`

---

## Storage model

| Domain | Tenant storage | Platform storage |
|--------|---------------|-----------------|
| Email transport | `tenant_email_transport` table (dedicated, encrypted) | `platform_settings["email"]` |
| Form settings | `tenant_form_settings` table (dedicated) | via email platform settings (backoffice only) |
| AI | `tenant_settings.settings.ai` (JSONB slice) | `platform_settings["ai"]` |
| CRM | `tenant_settings.settings.crm` (JSONB slice) | `platform_settings["crm"]` |
| Enrichment | `tenant_settings.settings.enrichment` (JSONB slice) | `platform_settings["enrichment"]` |

Email transport and form settings use dedicated tables because they need their own migration, encryption, and validation lifecycle. AI/CRM/enrichment use JSONB slices of the existing `tenant_settings` table since they have no secrets that need dedicated encryption.

---

## Usage examples

### In an API route

```typescript
import { resolveEmailConfig, resolveFormsConfig } from "@/lib/config";

// Load all layers and merge in one call (parallel)
const [emailResolution, formsResolution] = await Promise.all([
  resolveEmailConfig(tenantId),
  resolveFormsConfig(tenantId),
]);

// Use merged config
const { transportType, resendApiKey } = emailResolution.config;
const { effectiveRecipients }         = formsResolution.config;

// Use source for logging/diagnostics
logger.info("Using email transport", {
  source: emailResolution.source,             // "tenant" | "platform" | "env" | "none"
  hasTenantOverride: emailResolution.hasTenantOverride,
});
```

### In an admin Server Component

```typescript
import { resolveEmailConfig }   from "@/lib/config";
import { sourceLabel }          from "@/lib/config";
import { ConfigSourceBadge }    from "@/components/admin/ConfigSourceBadge";

const resolution = await resolveEmailConfig(tenantId);

// Safe: source is a string, no secrets
return (
  <div>
    <ConfigSourceBadge source={resolution.source} />
    <span>{sourceLabel(resolution.source)}</span>
  </div>
);
```

### Writing a tenant domain config slice

```typescript
import { setTenantDomainConfig } from "@/lib/config";

await setTenantDomainConfig(tenantId, "crm", {
  enabled:          true,
  useCrmEnrichment: true,
});
```

---

## Adding a new domain

1. Define `ResolvedXxxConfig` in `lib/config/resolvers/xxx.ts`
2. Implement `resolveXxxConfig(tenantId)` using `layeredResolve()`
3. Export from `lib/config/index.ts`
4. If the domain needs a new tenant column: add a migration and extend `TenantConfigDomains` in `lib/config/tenant-store.ts`
5. If the domain needs a new platform section: add `PlatformXxxSettings` and `getPlatformXxxSettings()` to `platform/platform-store.ts`

---

## Security rules

- **All resolvers import `"server-only"`** — they are never bundled into the client.
- **`DomainResolution<T>.config` may contain decrypted secrets** — never serialise it to the client.
- For admin UIs, use only: `resolution.source`, `resolution.hasTenantOverride`, `resolution.hasPlatformDefault`, `resolution.hasEnvFallback`, and the `sourceLabel()` / `sourceBadgeClass()` helpers.
- `ConfigSourceBadge` is a `"use client"` component that only receives a `ConfigSource` string — safe to render anywhere.

---

## Admin UX badges

Use `ConfigSourceBadge` and `ConfigSourceRow` from `@/components/admin/ConfigSourceBadge`:

| Source | Color | Label |
|--------|-------|-------|
| `"tenant"` | Green | Tenant override |
| `"platform"` | Blue | Platform default |
| `"env"` | Neutral | Env var fallback |
| `"system"` | Neutral | System default |
| `"none"` | Amber | Not configured |

```tsx
import { ConfigSourceBadge, ConfigSourceRow } from "@/components/admin/ConfigSourceBadge";

<ConfigSourceBadge source={resolution.source} />

<ConfigSourceRow
  label="Transport"
  source={resolution.source}
  note={resolution.config.transportType}
/>
```

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| A. Standard layered model (tenant → platform → env → system) | ✅ Implemented in `layeredResolve()` |
| B. Source metadata on every resolved config | ✅ `DomainResolution.source`, `hasTenantOverride`, `hasPlatformDefault`, `hasEnvFallback` |
| C. Multiple domains covered (email, forms, CRM, AI, enrichment) | ✅ Five resolvers implemented |
| D. Admin shows source — `ConfigSourceBadge` + `sourceLabel()` | ✅ Component + helpers in place |
| E. Documentation | ✅ This document |
