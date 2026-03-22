# New Tenant Setup

This guide walks through onboarding a new client onto the Mister Chameleon platform. The platform is multi-tenant: one deployment can serve multiple client sites, each with its own brand theme, CMS backend, variant set, and contact workflow.

A working example lives at `tenant/templates/acme-growth-config.ts`. Follow the steps below to adapt it for a real client.

---

## 1. Create the tenant config file

Create `tenant/templates/<client-slug>-config.ts` and use `createTenantConfig()` to build from the platform defaults:

```typescript
import { createTenantConfig } from "./base-template";
import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { neutral } from "@/design-system/theme/tenant-theme";

// Define brand colours — see step 3 below
const CLIENT_THEME: TenantTheme = { /* ... */ };

export const MY_CLIENT_TENANT = createTenantConfig({
  tenantId:          "my-client",
  name:              "My Client Ltd.",
  canonicalHostname: "myclient.com",
  theme:             CLIENT_THEME,
  cmsProvider:       "storyblok",   // or "sanity" | "statamic" | "mock"
});
```

`createTenantConfig()` deep-merges your input with `TENANT_DEFAULTS` — you only need to specify what differs from the defaults. The defaults encode safe production values: rules-based decisions, all blocks active, contact form enabled, no A/B experiments.

Required fields are `tenantId`, `name`, `canonicalHostname`, and `theme`. Everything else is optional.

---

## 2. Choose a CMS provider

Set `cmsProvider` to the backend the client's content team will use. Each option requires different environment variables in the deployment environment.

**`"mock"`** — in-memory stub, returns placeholder copy. No credentials needed. Use during development or before the client's CMS is ready.

**`"sanity"`** — Sanity.io headless CMS.
- Required env vars: `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`
- Optional: `SANITY_READ_TOKEN` (needed for draft/preview)
- Content must match the slug keys defined in `variants` (see step 4)

**`"storyblok"`** — Storyblok CDN.
- Required env var: `STORYBLOK_ACCESS_TOKEN`
- Optional: `STORYBLOK_REGION` (defaults to `eu`), `STORYBLOK_VERSION` (defaults to `published`)
- The Storyblok provider resolves content by the variant key used as the story slug

**`"statamic"`** — Statamic flat-file CMS.
- Required env var: `STATAMIC_API_URL`
- Optional: `STATAMIC_API_KEY` (required for protected collection APIs)

The CMS selection is declared per-tenant in the config, so different clients on the same deployment can use different backends. The factory `createCMSProvider(tenant.cmsProvider)` in `cms/providers/create-cms-provider.ts` handles the instantiation.

---

## 3. Choose a decision provider

Set `decisionProvider` to control how the platform selects which content variant to show each visitor.

**`"rules"`** (default) — a static ordered rule set evaluated in-process. Zero latency overhead, zero AI cost. The rules in `decision/rules/homepage-rules.ts` branch on traffic source (Google, LinkedIn, direct), device type, and visitor history (returning visitor, CTA engagement, page view depth). This is the recommended starting point for every new tenant.

**`"ai"`** — delegates to an LLM to pick the variant. Requires wiring an `AiDecisionProvider` subclass into the page, plus a confidence policy that defines when to trust the AI output vs. fall back to rules. This is opt-in: both `decisionProvider: "ai"` and `features.aiDecisionProvider: true` must be set before AI inference is triggered.

The decision provider reads the `variants` config (see step 4) to know which keys are available for the tenant — it will only select keys present in that list.

---

## 4. Define the variant set

The `variants` field declares which adaptive content keys the client's CMS has entries for. The decision engine will only select keys in this list.

```typescript
variants: {
  hero:  ["hero_google_problem", "hero_direct_brand"],
  proof: ["proof_cases", "proof_platform"],
  cta:   ["cta_meeting", "cta_platform"],
},
```

The full set of available keys is defined in `decision/types.ts` under `HeroVariantKey`, `ProofVariantKey`, and `CTAVariantKey`. Narrow the list to whatever the client's CMS team has actually written content for. Starting with a subset is fine — more variants can be added later once the content is ready.

If `variants` is omitted, all platform-defined keys are assumed to have CMS content, which is appropriate for the platform owner (Mister Chameleon) but will produce missing-content errors for clients with partial CMS populations.

---

## 5. Apply a brand theme

Every tenant config requires a `TenantTheme`. The theme controls colours, border radius personality, and brand metadata. Components consume these values via CSS custom properties — no component code changes when the theme changes.

Define the theme inline in the config file or in a dedicated `<slug>-theme.ts` file:

```typescript
import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { neutral } from "@/design-system/theme/tenant-theme";

// Use the client's brand hex values directly — no need to match the
// platform palette (design-system/tokens/colors.ts).
const CLIENT_PRIMARY = "#0d9488";  // teal-600

const MY_CLIENT_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:        CLIENT_PRIMARY,
      primaryHover:   "#0f766e",    // slightly darker
      primaryActive:  "#115e59",
      primarySubtle:  "#f0fdfa",    // very light tint
      primaryText:    neutral[0],   // white — text on brand bg
      ring:           CLIENT_PRIMARY,
      textBrand:      "#0f766e",    // darker for inline text contrast
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  neutral[100],
      bgInverse: neutral[900],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "sharp",   // "sharp" | "balanced" | "soft"
  meta: {
    name:        "My Client Ltd.",
    tagline:     "Client-specific tagline.",
    faviconPath: "/my-client-favicon.ico",  // optional
  },
};
```

`radius` picks one of three presets from `RADIUS_PRESETS` in `design-system/theme/tenant-theme.ts`. Use `"sharp"` for a startup / SaaS feel, `"balanced"` for a professional / neutral look, or `"soft"` for a friendly / consumer product feel.

---

## 6. Configure contact and n8n

By default, the contact form is enabled and uses the global `N8N_CONTACT_WEBHOOK_URL` environment variable. For clients with their own n8n instance, override the webhook URL:

```typescript
contact: {
  enabled:    true,
  webhookUrl: "https://n8n.myclient.com/webhook/contact-intake",
},
```

To disable the contact form for a tenant entirely (e.g. the client uses a HubSpot embed instead):

```typescript
contact: { enabled: false },
features: { contactForm: false },
```

The API route `POST /api/contact` checks `tenant.contact?.enabled` and returns 404 when it is false, so the form component can gate its rendering on the `contactForm` feature flag.

---

## 7. Register the tenant hostnames

Open `tenant/resolve-tenant.ts` and add the client's hostnames to `TENANT_REGISTRY`:

```typescript
// Import at the top of the file
import { MY_CLIENT_TENANT } from "./templates/my-client-config";

// Add to TENANT_REGISTRY
const TENANT_REGISTRY = {
  // ... existing entries ...

  // My Client Ltd.
  "myclient.com":              MY_CLIENT_TENANT,
  "www.myclient.com":          MY_CLIENT_TENANT,
  "myclient.staging.example.com": MY_CLIENT_TENANT,  // staging
};
```

A single `TenantConfig` object can appear under any number of hostnames — production, www, staging, and Vercel preview URLs all pointing to the same config is a typical pattern. No other files need to change once the registry is updated.

---

## 8. Checklist before going live

Before activating a new tenant in production, verify the following:

- [ ] `tenantId` is a unique, stable, lowercase slug — it appears in analytics and logs
- [ ] `canonicalHostname` matches the client's primary production domain (no `https://`, no trailing slash)
- [ ] CMS credentials are set in the deployment environment and content is published for all variant keys in `variants`
- [ ] The brand theme has been reviewed with the client and signed off
- [ ] `contact.webhookUrl` (or global `N8N_CONTACT_WEBHOOK_URL`) points to the correct n8n workflow
- [ ] Hostnames are registered in `TENANT_REGISTRY` — including `www.`, staging, and preview domains
- [ ] TypeScript compiles cleanly: `npx tsc --noEmit` exits 0
- [ ] The new config file is exported from `tenant/index.ts` (or left commented out if not yet live)

---

## File map

| File | Purpose |
|---|---|
| `tenant/types.ts` | `TenantConfig`, `TenantFeatureFlags`, and all platform extension interfaces |
| `tenant/templates/base-template.ts` | `createTenantConfig()` factory, `TENANT_DEFAULTS`, default constants |
| `tenant/templates/acme-growth-config.ts` | Working example of a second tenant config |
| `tenant/resolve-tenant.ts` | Hostname → `TenantConfig` registry |
| `tenant/index.ts` | Barrel re-export of all public tenant symbols |
| `tenant/mister-chameleon-config.ts` | Platform owner config (reference implementation) |
| `tenant/theme.ts` | Platform owner theme (reference implementation) |
| `design-system/theme/tenant-theme.ts` | `TenantTheme` type, `RADIUS_PRESETS`, `tenantThemeToCSS()` |
