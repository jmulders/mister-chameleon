/**
 * Implementation Template
 *
 * The structured specification for a new client deployment on the Mister
 * Chameleon platform. An ImplementationTemplate is the authoritative source of
 * truth for everything that needs to be decided or configured before a tenant
 * goes live.
 *
 * ─── Two concerns, one document ──────────────────────────────────────────────
 *
 *   This file bridges two layers:
 *
 *   1. Runtime config (→ createTenantConfig)
 *      Every field that feeds into TenantConfigInput lives here. The
 *      toTenantConfigInput() helper projects the template directly into a
 *      factory call — so the template IS the source of the tenant config.
 *
 *   2. Setup concerns (not in TenantConfig today)
 *      Some decisions — which analytics provider to use, which env vars to set,
 *      which hostnames to register — are deployment-time concerns, not runtime
 *      concerns. These live in the template so a single document covers the
 *      entire client setup without jumping between files.
 *
 * ─── Lifecycle ────────────────────────────────────────────────────────────────
 *
 *   draft           Placeholders in place. Internal use only.
 *   client-ready    Identity, package, and CMS confirmed with the client.
 *   configured      TenantConfig created, CMS connected, env vars set.
 *   live            Platform validated and in production.
 *
 * ─── Typical workflow ─────────────────────────────────────────────────────────
 *
 *   1. Copy DEFAULT_CLIENT_TEMPLATE from tenant/templates/default-client-template.ts
 *   2. Fill in tenantId, name, canonicalHostname, packageId
 *   3. Confirm cmsProvider and decisionProvider with the client
 *   4. Design the theme and populate variants once CMS content is written
 *   5. Call toTenantConfigInput(template) to generate the TenantConfigInput
 *   6. Pass the result to createTenantConfig() and register in resolve-tenant.ts
 *   7. Set required env vars from getRequiredEnvVars(template)
 *   8. Mark status → "configured", then → "live" after the diagnostics bar passes
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   onboarding/implementation-template.ts  ← YOU ARE HERE
 *   onboarding/types.ts                    ← step definitions, flow types
 *   onboarding/flow.ts                     ← STANDARD_ONBOARDING_FLOW
 *   onboarding/index.ts                    ← barrel re-export
 *   tenant/templates/default-client-template.ts  ← copy-paste starting point
 */

import type {
  CMSProviderName,
  DecisionProviderName,
  TenantFeatureFlags,
  TenantContactConfig,
  TenantVariantConfig,
  TenantBlockConfig,
  TenantPageConfig,
} from "@/tenant/types";
import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import type { TenantConfigInput } from "@/tenant/templates/base-template";
import type { ProductModuleId } from "@/product/types";
import type { PackageId } from "@/product/module-registry";

import {
  TENANT_DEFAULTS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_CONTACT_CONFIG,
  DEFAULT_VARIANT_CONFIG,
  DEFAULT_BLOCK_CONFIG,
  DEFAULT_PAGE_CONFIG,
} from "@/tenant/templates/base-template";
import { brand, neutral } from "@/design-system/theme/tenant-theme";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle stage of an implementation template.
 *
 * draft           Working document with placeholders. Do not use for deployment.
 * client-ready    All identity, package, and provider selections confirmed.
 * configured      TenantConfig created, CMS connected, env vars validated.
 * live            Platform validated in production via the diagnostics bar.
 */
export type ImplementationTemplateStatus =
  | "draft"
  | "client-ready"
  | "configured"
  | "live";

/**
 * Which analytics provider the tenant uses for page and event tracking.
 *
 * none      No analytics configured. Suitable for development or privacy-first tenants.
 * ga4       Google Analytics 4 (requires NEXT_PUBLIC_GA4_MEASUREMENT_ID).
 * plausible Plausible Analytics (requires NEXT_PUBLIC_PLAUSIBLE_DOMAIN).
 * posthog   PostHog product analytics (requires NEXT_PUBLIC_POSTHOG_KEY).
 * custom    Custom analytics provider — add env vars and wiring manually.
 */
export type AnalyticsProvider =
  | "none"
  | "ga4"
  | "plausible"
  | "posthog"
  | "custom";

/**
 * The secret sensitivity level of an environment variable.
 *
 * Drives how the variable is handled in deployment:
 *   secret   Never log; store in a secrets manager (e.g. Vercel encrypted env).
 *   public   Safe to expose to the client bundle (NEXT_PUBLIC_ prefix).
 *   config   Non-secret configuration value; can be committed to env files.
 */
export type EnvVarSecretType = "secret" | "public" | "config";

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analytics configuration for a tenant implementation.
 *
 * This is a setup-time concern — it determines which env vars must be set and
 * which analytics provider is wired into the platform. It does not live in
 * TenantConfig today, but is captured here so the full implementation picture
 * is in one place.
 *
 * Event tracking flags control which platform events fire to the provider:
 *   trackPageViews            Fires on each route change.
 *   trackVariantServed        Fires when the adaptive variant pipeline resolves.
 *   trackContactSubmissions   Fires on successful contact form submission.
 */
export interface ImplementationAnalyticsConfig {
  /** Which analytics provider to use. */
  provider: AnalyticsProvider;

  /**
   * GA4 Measurement ID.
   * Required when provider === "ga4".
   * Format: "G-XXXXXXXXXX"
   *
   * Stored as NEXT_PUBLIC_GA4_MEASUREMENT_ID in the deployment environment.
   */
  measurementId?: string;

  /**
   * Plausible Analytics site domain.
   * Required when provider === "plausible".
   * Must match the domain registered in the Plausible dashboard.
   * Example: "acmegrowth.com"
   *
   * Stored as NEXT_PUBLIC_PLAUSIBLE_DOMAIN in the deployment environment.
   */
  plausibleDomain?: string;

  /**
   * PostHog project API key.
   * Required when provider === "posthog".
   * Format: "phc_XXXXXXXXXXXX"
   *
   * Stored as NEXT_PUBLIC_POSTHOG_KEY in the deployment environment.
   */
  posthogKey?: string;

  /**
   * Whether the internal analytics dashboard feature is enabled.
   *
   * The dashboard surfaces variant-level performance data from the platform's
   * own tracking layer. This is separate from the external analytics provider —
   * the dashboard reads from Supabase, not from GA4/Plausible/PostHog.
   *
   * Enable only after the first variant cycle has accumulated meaningful data.
   * Safe default: false.
   */
  dashboardEnabled: boolean;

  /**
   * Whether to fire a pageview event on each route change.
   * Applicable to all providers except "none".
   */
  trackPageViews: boolean;

  /**
   * Whether to fire an event when the adaptive variant pipeline resolves.
   * Enables per-variant analytics segmentation in the external provider.
   * Safe to enable from day one.
   */
  trackVariantServed: boolean;

  /**
   * Whether to fire a conversion event on successful contact form submission.
   * Requires contact.enabled === true.
   */
  trackContactSubmissions: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single environment variable required by this implementation.
 *
 * Used by getRequiredEnvVars() to generate a deployment checklist.
 * The developer sets these in the hosting environment before going live.
 */
export interface EnvironmentVariable {
  /**
   * The environment variable name.
   * Convention: SCREAMING_SNAKE_CASE.
   * NEXT_PUBLIC_ prefix for variables that must be available client-side.
   */
  key: string;

  /**
   * Human-readable description of what this variable is and where to find it.
   * Written for the developer setting up the deployment environment.
   */
  description: string;

  /**
   * Whether the deployment will fail or behave incorrectly without this value.
   * false variables degrade gracefully (e.g. analytics not tracking).
   */
  required: boolean;

  /**
   * The sensitivity level — drives storage and handling instructions.
   * "secret" → store in encrypted env manager (Vercel encrypted env vars).
   * "public" → safe as NEXT_PUBLIC_; can appear in the client bundle.
   * "config" → non-sensitive; can be in .env.local or committed config.
   */
  secretType: EnvVarSecretType;

  /**
   * A non-sensitive example value that shows the expected format.
   * Never use the real production value here.
   * Example: "G-XXXXXXXXXX" for a GA4 Measurement ID.
   */
  exampleValue?: string;

  /**
   * Additional setup notes for the developer.
   * Where to find the value, which dashboard to check, caveats.
   */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete specification for a new client implementation.
 *
 * Every field that feeds into TenantConfigInput is present here, plus the
 * extended setup concerns (analytics, env vars, hostnames) that don't live
 * in the runtime config.
 *
 * ─── Mapping to TenantConfigInput ────────────────────────────────────────────
 *
 *   ImplementationTemplate field    → TenantConfigInput field
 *   ─────────────────────────────    ─────────────────────────
 *   tenantId                         tenantId (required)
 *   name                             name (required)
 *   canonicalHostname                canonicalHostname (required)
 *   theme                            theme (required)
 *   cmsProvider                      cmsProvider
 *   decisionProvider                 decisionProvider
 *   features                         features
 *   contact                          contact
 *   variants                         variants
 *   blocks                           blocks
 *   pages                            pages
 *
 *   analytics, additionalHostnames, enabledModules, envVars  ← setup-time only
 *
 *   Use toTenantConfigInput(template) to project to TenantConfigInput.
 *
 * ─── Module and feature flag relationship ────────────────────────────────────
 *
 *   enabledModules declares which ProductModules are active for this client.
 *   Each module may carry a tenantFeatureFlag (see product/catalog.ts) that
 *   gates runtime behaviour — those flags must be set in features accordingly.
 *
 *   For convenience, the PACKAGE_REGISTRY in product/module-registry.ts
 *   provides getFeatureFlagsForPackage(packageId) which generates the
 *   required feature flag set from a package selection. Use it when building
 *   the features object rather than setting flags manually.
 */
export interface ImplementationTemplate {

  // ── Template metadata ───────────────────────────────────────────────────────

  /**
   * Kebab-case identifier for this template instance.
   * Should match tenantId once the client name is confirmed.
   * Example: "acme-growth"
   */
  id: string;

  /**
   * Current lifecycle stage of this implementation.
   * Progresses from draft → client-ready → configured → live.
   */
  status: ImplementationTemplateStatus;

  /**
   * Which commercial package this client is purchasing.
   * Determines the capability set, enabled modules, and feature flags.
   *
   * essential  Core adaptive website. One surface, rules decisioning.
   * growth     Adds adaptive landing pages, A/B testing, dashboard analytics.
   * scale      Adds AI decisioning and adaptive product/service pages.
   */
  packageId: PackageId;

  /**
   * ISO 8601 timestamp when this template was created.
   * Used for audit and tracking the time-from-intake-to-live metric.
   */
  createdAt?: string;

  // ── Identity → TenantConfigInput ────────────────────────────────────────────

  /**
   * Stable, URL-safe, lowercase tenant identifier.
   * Used in logs, analytics events, and the tenant config.
   * Example: "acme-growth"
   *
   * Convention: kebab-case, max 32 chars, matches the client's short brand name.
   * Once set and live, changing this requires a data migration.
   */
  tenantId: string;

  /**
   * Human-readable display name for the tenant.
   * Appears in admin UIs, log annotations, and the theme meta.
   * Example: "Acme Growth Co."
   */
  name: string;

  /**
   * The primary production hostname — no protocol, no trailing slash.
   * Used for canonical link generation and OG tags.
   * Example: "acmegrowth.com"
   */
  canonicalHostname: string;

  /**
   * Additional hostnames this tenant answers to.
   * These all resolve to the same tenant config.
   * Register all of these in resolve-tenant.ts along with canonicalHostname.
   *
   * Typical entries: "www.acmegrowth.com", "acmegrowth.vercel.app",
   * "staging.acmegrowth.com"
   */
  additionalHostnames: readonly string[];

  // ── Theme → TenantConfigInput.theme ─────────────────────────────────────────

  /**
   * The visual brand theme for this tenant.
   *
   * Injected as CSS custom properties in the root layout — all components
   * inherit the theme through the CSS variable cascade without any code changes.
   *
   * Must be a complete TenantTheme — partial themes are not supported because
   * an incomplete theme produces incoherent CSS variables.
   *
   * Define the brand palette inline in the tenant config file (see
   * acme-growth-config.ts for the pattern). Do not modify the platform's
   * design-system tokens — those are the MC defaults, not the client's brand.
   */
  theme: TenantTheme;

  // ── CMS → TenantConfigInput.cmsProvider ──────────────────────────────────────

  /**
   * Which CMS backend the tenant uses for adaptive variant content.
   *
   * sanity      Sanity.io (structured content, powerful query language).
   * storyblok   Storyblok CDN (visual editor, component-based).
   * statamic    Statamic (flat-file / Eloquent, strong templating).
   * mock        In-memory mock (dev, preview, testing only).
   *
   * The client's CMS credentials must be set as env vars before going live.
   * See getRequiredEnvVars() for the exact env var keys per provider.
   */
  cmsProvider: CMSProviderName;

  /**
   * Internal notes about the CMS setup for this client.
   * Not used at runtime — for the implementation team only.
   * Example: "Storyblok space ID: 12345. EU region. Credentials in 1Password."
   */
  cmsNotes?: string;

  // ── Decision provider → TenantConfigInput.decisionProvider ───────────────────

  /**
   * Which decision engine selects the adaptive experience.
   *
   * rules  Ordered rule set evaluated server-side on each request. Zero
   *        inference cost. The correct default for every new client.
   *        Rules are configured in decision/providers/rules/.
   *
   * ai     Abstract AI base requiring a confidence policy and subclass.
   *        Enable only when the client has reviewed the confidence policy
   *        and features.aiDecisionProvider is set to true.
   */
  decisionProvider: DecisionProviderName;

  // ── Modules ───────────────────────────────────────────────────────────────────

  /**
   * Which ProductModules are active for this client.
   *
   * Derived from packageId — but explicitly stated here so the template is
   * self-documenting and the developer doesn't need to cross-reference the
   * module registry to know what's turned on.
   *
   * Module IDs must be a subset of the modules in the selected package.
   * See product/module-registry.ts → PACKAGE_REGISTRY[packageId].modules.
   *
   * Each module may carry a tenantFeatureFlag that must also be set in features.
   */
  enabledModules: readonly ProductModuleId[];

  // ── Pages → TenantConfigInput.pages ──────────────────────────────────────────

  /**
   * Which adaptive page pipelines are active.
   *
   * homepage  The main website homepage. Always true for the essential package.
   *
   * As the platform expands, additional page types (pricing, about, blog) will
   * be added here. Only enable pages where the client's CMS has variant content.
   */
  pages: TenantPageConfig;

  // ── Blocks → TenantConfigInput.blocks ────────────────────────────────────────

  /**
   * Which adaptive page section blocks are rendered.
   *
   * hero   Main headline + subheadline + primary CTA area. Almost always true.
   * proof  Social proof / evidence section. Disable if the design omits it.
   * cta    Standalone call-to-action block. Disable if the design uses inline CTAs.
   *
   * Align with the client's design — enabling a block with no CMS content
   * behind it will cause the variant pipeline to fall back to defaults.
   */
  blocks: TenantBlockConfig;

  // ── Variants → TenantConfigInput.variants ────────────────────────────────────

  /**
   * Which adaptive variant keys this tenant's CMS has content for.
   *
   * The decision engine will only select variant keys listed here.
   * Narrowing this list to what the client's CMS team has actually populated
   * prevents the platform from serving empty or fallback content.
   *
   * Key strings must match the literal unions in decision/types.ts.
   * Start with the minimum viable set (2–3 per dimension) and expand as
   * the client populates more content.
   */
  variants: TenantVariantConfig;

  // ── Contact → TenantConfigInput.contact ──────────────────────────────────────

  /**
   * Contact form and n8n orchestration settings.
   *
   * enabled      Whether POST /api/contact accepts submissions for this tenant.
   * webhookUrl   Client-specific n8n webhook URL. When absent, the platform-level
   *              N8N_CONTACT_WEBHOOK_URL env var is used.
   *
   * For clients who have their own n8n instance (common at growth/scale tier),
   * set webhookUrl to their instance URL. For clients using the shared MC
   * instance, leave webhookUrl undefined.
   */
  contact: TenantContactConfig;

  // ── Analytics (setup-time only — not in TenantConfig) ────────────────────────

  /**
   * Analytics provider and event tracking configuration.
   *
   * Determines which env vars must be set in the deployment environment and
   * which events the platform fires to the external analytics provider.
   *
   * This field is NOT passed to createTenantConfig() — it is a setup-time
   * specification. The developer uses it to configure the analytics wiring
   * during technical-setup (onboarding step 4).
   */
  analytics: ImplementationAnalyticsConfig;

  // ── Feature flags → TenantConfigInput.features ───────────────────────────────

  /**
   * Runtime feature flags for this tenant.
   *
   * All four flags must be explicitly set — no partial config in production.
   * The safest values for a new client are:
   *
   *   diagnosticsBar      false   Never on in production.
   *   contactForm         true    Unless the client uses a different lead channel.
   *   abTesting           false   Enable only when an experiment is configured.
   *   aiDecisionProvider  false   Enable only when decisionProvider is "ai".
   *
   * Use getFeatureFlagsForPackage(packageId) from product/module-registry.ts
   * to generate these flags from the package selection, then adjust manually.
   */
  features: Required<TenantFeatureFlags>;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input shape for createImplementationTemplate().
 *
 * Required fields: tenantId, name, canonicalHostname, packageId, analytics.
 * All other fields are optional and fall back to TEMPLATE_DEFAULTS.
 *
 * Nested objects (features, contact, variants, blocks, pages) are
 * deep-merged with the defaults — specify only the keys to override.
 */
export interface ImplementationTemplateInput {
  // Required
  tenantId:          string;
  name:              string;
  canonicalHostname: string;
  packageId:         PackageId;
  analytics:         ImplementationAnalyticsConfig;

  // Optional — falls back to TEMPLATE_DEFAULTS
  id?:                  string;           // defaults to tenantId
  status?:              ImplementationTemplateStatus;
  createdAt?:           string;
  additionalHostnames?: readonly string[];
  theme?:               TenantTheme;
  cmsProvider?:         CMSProviderName;
  cmsNotes?:            string;
  decisionProvider?:    DecisionProviderName;
  enabledModules?:      readonly ProductModuleId[];
  pages?:               Partial<TenantPageConfig>;
  blocks?:              Partial<TenantBlockConfig>;
  variants?:            Partial<TenantVariantConfig>;
  contact?:             Partial<TenantContactConfig>;
  features?:            Partial<Required<TenantFeatureFlags>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Placeholder theme for new clients before their brand has been designed.
 *
 * Uses the platform's default indigo-violet brand palette and neutral colours.
 * The meta.name reads "New Tenant" as a deliberate signal in admin UIs that
 * the theme has not been customised yet.
 *
 * Replace this with a client-specific theme in the tenant config file.
 * See acme-growth-config.ts for the inline palette pattern.
 */
export const PLACEHOLDER_IMPLEMENTATION_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],
      primaryHover:  brand[600],
      primaryActive: brand[700],
      primarySubtle: brand[50],
      primaryText:   neutral[0],
      ring:          brand[500],
      textBrand:     brand[600],
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
  radius: "balanced",
  meta: {
    name:    "New Tenant",
    tagline: "Powered by Mister Chameleon",
  },
};

/**
 * Default analytics configuration — no external provider, basic tracking flags.
 *
 * Safe for development and for clients who have not yet confirmed an analytics
 * provider. All event tracking flags are true so they are ready to fire as
 * soon as a provider is connected.
 */
export const DEFAULT_ANALYTICS_CONFIG: ImplementationAnalyticsConfig = {
  provider:                "none",
  dashboardEnabled:        false,
  trackPageViews:          true,
  trackVariantServed:      true,
  trackContactSubmissions: true,
};

/**
 * Default essential-package module set.
 *
 * The three modules included in the essential package:
 *   adaptive-website         Core adaptive homepage pipeline.
 *   context-intelligence     Visitor history and contact enrichment.
 *   adaptive-follow-up       n8n-powered post-submission journey.
 */
export const DEFAULT_ESSENTIAL_MODULES: readonly ProductModuleId[] = [
  "adaptive-website",
  "context-intelligence",
  "adaptive-follow-up",
];

/**
 * Complete defaults for a new implementation template.
 *
 * Mirrors the safe production defaults from TENANT_DEFAULTS, extended with
 * implementation-template-specific defaults (analytics, modules, hostnames).
 */
export const TEMPLATE_DEFAULTS = {
  status:              "draft"    as ImplementationTemplateStatus,
  additionalHostnames: []         as readonly string[],
  theme:               PLACEHOLDER_IMPLEMENTATION_THEME,
  cmsProvider:         TENANT_DEFAULTS.cmsProvider,
  decisionProvider:    TENANT_DEFAULTS.decisionProvider,
  enabledModules:      DEFAULT_ESSENTIAL_MODULES,
  pages:               DEFAULT_PAGE_CONFIG,
  blocks:              DEFAULT_BLOCK_CONFIG,
  variants:            DEFAULT_VARIANT_CONFIG,
  contact:             DEFAULT_CONTACT_CONFIG,
  analytics:           DEFAULT_ANALYTICS_CONFIG,
  features:            DEFAULT_FEATURE_FLAGS as Required<TenantFeatureFlags>,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a complete ImplementationTemplate by deep-merging the provided input
 * with TEMPLATE_DEFAULTS.
 *
 * Nested objects (features, contact, variants, blocks, pages) are merged.
 * theme, analytics, additionalHostnames, and enabledModules are fully replaced
 * when provided — partial overrides are not supported for these.
 *
 * @example
 * const ACME_TEMPLATE = createImplementationTemplate({
 *   tenantId:          "acme-growth",
 *   name:              "Acme Growth Co.",
 *   canonicalHostname: "acmegrowth.com",
 *   packageId:         "essential",
 *   analytics: {
 *     provider:         "ga4",
 *     measurementId:    "G-XXXXXXXXXX",
 *     dashboardEnabled: false,
 *     trackPageViews:   true,
 *     trackVariantServed: true,
 *     trackContactSubmissions: true,
 *   },
 *   additionalHostnames: ["www.acmegrowth.com", "acmegrowth.vercel.app"],
 *   cmsProvider:       "storyblok",
 *   theme:             ACME_THEME,
 * });
 */
export function createImplementationTemplate(
  input: ImplementationTemplateInput
): ImplementationTemplate {
  return {
    // ── Metadata ────────────────────────────────────────────────────────────
    id:          input.id ?? input.tenantId,
    status:      input.status      ?? TEMPLATE_DEFAULTS.status,
    packageId:   input.packageId,
    createdAt:   input.createdAt,

    // ── Identity ─────────────────────────────────────────────────────────────
    tenantId:           input.tenantId,
    name:               input.name,
    canonicalHostname:  input.canonicalHostname,
    additionalHostnames: input.additionalHostnames ?? TEMPLATE_DEFAULTS.additionalHostnames,

    // ── Theme (fully replaced when provided) ─────────────────────────────────
    theme: input.theme ?? TEMPLATE_DEFAULTS.theme,

    // ── Providers ────────────────────────────────────────────────────────────
    cmsProvider:      input.cmsProvider      ?? TEMPLATE_DEFAULTS.cmsProvider,
    decisionProvider: input.decisionProvider ?? TEMPLATE_DEFAULTS.decisionProvider,
    cmsNotes:         input.cmsNotes,

    // ── Modules (fully replaced when provided) ───────────────────────────────
    enabledModules: input.enabledModules ?? TEMPLATE_DEFAULTS.enabledModules,

    // ── Nested: deep-merge with defaults ─────────────────────────────────────
    pages:    { ...TEMPLATE_DEFAULTS.pages,    ...input.pages    },
    blocks:   { ...TEMPLATE_DEFAULTS.blocks,   ...input.blocks   },
    variants: { ...TEMPLATE_DEFAULTS.variants, ...input.variants },
    contact:  { ...TEMPLATE_DEFAULTS.contact,  ...input.contact  },
    features: { ...TEMPLATE_DEFAULTS.features, ...input.features },

    // ── Analytics (fully replaced when provided) ──────────────────────────────
    analytics: input.analytics ?? TEMPLATE_DEFAULTS.analytics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION: TEMPLATE → TENANT CONFIG INPUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Projects an ImplementationTemplate into a TenantConfigInput ready for
 * createTenantConfig().
 *
 * This is the primary bridge between the implementation spec and the runtime
 * config. Call this once the template is in "configured" status.
 *
 * @example
 * import { createTenantConfig } from "@/tenant/templates/base-template";
 * import { toTenantConfigInput } from "@/onboarding/implementation-template";
 *
 * const configInput = toTenantConfigInput(ACME_TEMPLATE);
 * export const ACME_TENANT = createTenantConfig(configInput);
 */
export function toTenantConfigInput(
  template: ImplementationTemplate
): TenantConfigInput {
  return {
    tenantId:          template.tenantId,
    name:              template.name,
    canonicalHostname: template.canonicalHostname,
    theme:             template.theme,
    cmsProvider:       template.cmsProvider,
    decisionProvider:  template.decisionProvider,
    features:          template.features,
    contact:           template.contact,
    variants:          template.variants,
    blocks:            template.blocks,
    pages:             template.pages,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: REQUIRED ENV VARS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the list of environment variables required by this implementation.
 *
 * The list is derived from the template's choices:
 *   • CMS provider      → CMS credentials env vars
 *   • contact.enabled   → N8N_CONTACT_WEBHOOK_URL (when no per-client webhookUrl)
 *   • analytics.provider → analytics key env vars
 *   • features.aiDecisionProvider → AI provider key
 *
 * Use this list to populate the deployment environment (Vercel env vars,
 * .env.local, 1Password) before going live.
 *
 * Required env vars (required: true) will break the platform if absent.
 * Optional env vars (required: false) degrade gracefully.
 */
export function getRequiredEnvVars(
  template: ImplementationTemplate
): EnvironmentVariable[] {
  const vars: EnvironmentVariable[] = [];

  // ── CMS provider ───────────────────────────────────────────────────────────
  switch (template.cmsProvider) {
    case "storyblok":
      vars.push({
        key:         "STORYBLOK_ACCESS_TOKEN",
        description: "Storyblok Content Delivery API access token for the client's space.",
        required:    true,
        secretType:  "secret",
        exampleValue: "your-storyblok-access-token",
        notes:       "Found in Storyblok → Settings → Access Tokens. Use the 'public' token for published content.",
      });
      break;

    case "sanity":
      vars.push(
        {
          key:         "SANITY_PROJECT_ID",
          description: "The Sanity.io project ID for the client's dataset.",
          required:    true,
          secretType:  "config",
          exampleValue: "abc12345",
          notes:       "Found in Sanity Studio → Manage → API → Project ID.",
        },
        {
          key:         "SANITY_API_TOKEN",
          description: "Sanity API token with read access to the client's dataset.",
          required:    true,
          secretType:  "secret",
          exampleValue: "sk...",
          notes:       "Create a token with Viewer permissions in Sanity → Manage → API → Tokens.",
        }
      );
      break;

    case "statamic":
      vars.push(
        {
          key:         "STATAMIC_API_URL",
          description: "Base URL of the client's Statamic REST API.",
          required:    true,
          secretType:  "config",
          exampleValue: "https://cms.acmegrowth.com/api",
          notes:       "The Statamic API must be enabled in config/statamic/api.php.",
        },
        {
          key:         "STATAMIC_API_TOKEN",
          description: "API token with read access to Statamic content entries.",
          required:    true,
          secretType:  "secret",
          exampleValue: "your-statamic-api-token",
          notes:       "Generate in Statamic → Users → API Tokens.",
        }
      );
      break;

    case "mock":
      // No env vars needed — mock provider is self-contained.
      break;
  }

  // ── Contact / n8n ──────────────────────────────────────────────────────────
  if (template.contact.enabled) {
    if (!template.contact.webhookUrl) {
      // No per-client override — requires the platform-level webhook URL.
      vars.push({
        key:         "N8N_CONTACT_WEBHOOK_URL",
        description: "n8n webhook URL that receives contact form submissions.",
        required:    true,
        secretType:  "secret",
        exampleValue: "https://n8n.misterchameleon.com/webhook/contact-intake",
        notes:       "The platform-level webhook. Override per-tenant with contact.webhookUrl in the tenant config.",
      });
    }
    // When contact.webhookUrl is set, the URL is in the tenant config — no env var needed.
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  switch (template.analytics.provider) {
    case "ga4":
      vars.push({
        key:         "NEXT_PUBLIC_GA4_MEASUREMENT_ID",
        description: "Google Analytics 4 Measurement ID for the client's property.",
        required:    true,
        secretType:  "public",
        exampleValue: "G-XXXXXXXXXX",
        notes:       "Found in GA4 → Admin → Data Streams → Web → Measurement ID. Must be NEXT_PUBLIC_ to be available client-side.",
      });
      break;

    case "plausible":
      vars.push({
        key:         "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
        description: "The Plausible Analytics site domain for this tenant.",
        required:    true,
        secretType:  "public",
        exampleValue: "acmegrowth.com",
        notes:       "Must exactly match the domain registered in the Plausible dashboard.",
      });
      break;

    case "posthog":
      vars.push(
        {
          key:         "NEXT_PUBLIC_POSTHOG_KEY",
          description: "PostHog project API key.",
          required:    true,
          secretType:  "public",
          exampleValue: "phc_XXXXXXXXXXXX",
          notes:       "Found in PostHog → Project Settings → Project API Key.",
        },
        {
          key:         "NEXT_PUBLIC_POSTHOG_HOST",
          description: "PostHog instance host URL.",
          required:    false,
          secretType:  "public",
          exampleValue: "https://eu.posthog.com",
          notes:       "Only required for self-hosted PostHog or EU cloud. Defaults to https://app.posthog.com.",
        }
      );
      break;

    case "none":
    case "custom":
      // No standard env vars — custom provider requires manual wiring.
      break;
  }

  // ── AI decision provider ───────────────────────────────────────────────────
  if (template.features.aiDecisionProvider) {
    vars.push({
      key:         "OPENAI_API_KEY",
      description: "OpenAI API key for the AI decision provider.",
      required:    true,
      secretType:  "secret",
      exampleValue: "sk-...",
      notes:       "Required when features.aiDecisionProvider is true and decisionProvider is 'ai'. Create at platform.openai.com → API Keys.",
    });
  }

  return vars;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: IMPLEMENTATION CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an ordered checklist of implementation tasks for this template.
 *
 * The checklist covers the technical-setup phase (onboarding step 4):
 * config creation, hostname registration, env var setup, CMS wiring,
 * and platform validation.
 *
 * Suitable for rendering as a task list in admin tooling or a project doc.
 */
export function getImplementationChecklist(
  template: ImplementationTemplate
): string[] {
  const items: string[] = [];

  // ── Config ─────────────────────────────────────────────────────────────────
  items.push(
    `Create tenant config file: tenant/templates/${template.tenantId}-config.ts`,
    `Call createTenantConfig() with toTenantConfigInput(template) output`,
    `Register hostname "${template.canonicalHostname}" in resolve-tenant.ts`
  );

  for (const hostname of template.additionalHostnames) {
    items.push(`Register additional hostname "${hostname}" in resolve-tenant.ts`);
  }

  // ── CMS ────────────────────────────────────────────────────────────────────
  if (template.cmsProvider !== "mock") {
    items.push(
      `Set ${template.cmsProvider.toUpperCase()} credentials as env vars in deployment environment`,
      `Confirm CMS connection by running the variant content fetch in development`
    );
  }

  // ── Variants ───────────────────────────────────────────────────────────────
  const totalVariants =
    template.variants.hero.length +
    template.variants.proof.length +
    template.variants.cta.length;

  items.push(
    `Confirm CMS entries exist for all ${totalVariants} variant keys`,
    `Run diagnostics bar and verify all variant keys resolve without fallback`
  );

  // ── Contact ────────────────────────────────────────────────────────────────
  if (template.contact.enabled) {
    if (template.contact.webhookUrl) {
      items.push(`Verify n8n webhook at ${template.contact.webhookUrl} is live and accepting submissions`);
    } else {
      items.push(`Set N8N_CONTACT_WEBHOOK_URL env var and verify the shared n8n workflow`);
    }
    items.push(`Submit a test contact form and confirm the n8n workflow fires`);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  if (template.analytics.provider !== "none") {
    items.push(
      `Set analytics env vars for provider: ${template.analytics.provider}`,
      `Verify pageview events appear in the ${template.analytics.provider} dashboard after a page load`
    );
    if (template.analytics.trackVariantServed) {
      items.push(`Verify variant-served events fire correctly in ${template.analytics.provider}`);
    }
    if (template.analytics.trackContactSubmissions && template.contact.enabled) {
      items.push(`Verify contact submission conversion events appear in ${template.analytics.provider}`);
    }
  }

  // ── Feature flags ──────────────────────────────────────────────────────────
  if (template.features.abTesting) {
    items.push(`Confirm an experiment record exists in Supabase before enabling A/B testing`);
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  items.push(
    `Run npx tsc --noEmit and confirm zero TypeScript errors`,
    `Enable diagnosticsBar temporarily and verify context, decision, and variant pipeline all pass`,
    `Disable diagnosticsBar before handing over to client`
  );

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: TEMPLATE STATUS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the template is ready to be passed to toTenantConfigInput().
 *
 * A template is "configurable" when it is in client-ready or configured status
 * and all required identity fields are non-placeholder values.
 */
export function isReadyToConfig(template: ImplementationTemplate): boolean {
  return (
    (template.status === "client-ready" || template.status === "configured" || template.status === "live") &&
    template.tenantId !== "new-client" &&
    template.canonicalHostname !== "example.com"
  );
}

/**
 * Returns true when the template describes a live, production deployment.
 */
export function isLive(template: ImplementationTemplate): boolean {
  return template.status === "live";
}

/**
 * Returns true when the template uses the placeholder theme and needs
 * a real brand theme before going live.
 */
export function needsTheme(template: ImplementationTemplate): boolean {
  return template.theme.meta.name === "New Tenant";
}
