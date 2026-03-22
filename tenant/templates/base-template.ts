/**
 * Tenant Base Template
 *
 * The canonical starting point for every new tenant configuration.
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   When onboarding a new client onto the platform, you should not write a
 *   TenantConfig from scratch. Instead, use one of the two helpers here:
 *
 *     createTenantConfig(overrides)   — minimal, spread-based factory.
 *                                       All fields from TENANT_DEFAULTS are
 *                                       applied first; your overrides win.
 *
 *     TENANT_DEFAULTS                 — the raw defaults object, if you need
 *                                       to inspect or extend at the type level.
 *
 * ─── What the defaults encode ─────────────────────────────────────────────────
 *
 *   Decision provider   "rules"   → no AI cost on day one; can be changed
 *                                   tenant-by-tenant when confidence policy is ready.
 *
 *   CMS provider        "mock"    → safe dev default; overridden in the config
 *                                   once the client's CMS credentials are ready.
 *
 *   All blocks          true      → hero + proof + cta rendered. Suppress
 *                                   individually in blocks override if the
 *                                   client's design doesn't include them.
 *
 *   All variant keys    full set  → all six hero/proof/cta variants assumed to
 *                                   have CMS content.  Narrow via variants override
 *                                   for clients who populate only a subset.
 *
 *   Contact form        enabled   → contact submissions active, uses global
 *                                   N8N_CONTACT_WEBHOOK_URL.  Override webhookUrl
 *                                   for clients who have their own n8n instance.
 *
 *   Feature flags:
 *     diagnosticsBar      false   → never in production. Enabled in the MC config
 *                                   via NODE_ENV check.
 *     contactForm         true    → contact form active by default.
 *     abTesting           false   → experiments table not queried until an
 *                                   experiment is actually running.
 *     aiDecisionProvider  false   → no AI inference cost until explicitly opted in.
 *
 * ─── Typical onboarding pattern ──────────────────────────────────────────────
 *
 *   import { createTenantConfig } from "@/tenant/templates/base-template";
 *   import { ACME_THEME } from "./acme-theme";
 *
 *   export const ACME_TENANT = createTenantConfig({
 *     tenantId: "acme-corp",
 *     name: "Acme Corp",
 *     canonicalHostname: "acme.com",
 *     cmsProvider: "storyblok",
 *     theme: ACME_THEME,
 *   });
 *
 *   Then register ACME_TENANT in tenant/resolve-tenant.ts.
 *
 * ─── Merging strategy ────────────────────────────────────────────────────────
 *
 *   Top-level fields are shallow-merged (last write wins).
 *   Nested objects (features, contact, blocks, variants, pages) are
 *   DEEP-MERGED — so `features: { diagnosticsBar: true }` adds the diagnostics
 *   bar without losing the other default flags.
 *
 *   Theme is always fully replaced — there is no sensible default theme that
 *   would apply to all tenants, so it must always be explicitly specified.
 */

import type {
  TenantConfig,
  TenantFeatureFlags,
  TenantContactConfig,
  TenantVariantConfig,
  TenantBlockConfig,
  TenantPageConfig,
  CMSProviderName,
  DecisionProviderName,
} from "../types";
import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { brand, neutral } from "@/design-system/theme/tenant-theme";

// ── Sensible default feature flags ───────────────────────────────────────────

/**
 * Default feature flags applied to every tenant unless overridden.
 *
 * Each flag is set to its safest production value.
 * Operator-specific flags (diagnosticsBar) must be explicitly enabled.
 */
export const DEFAULT_FEATURE_FLAGS: Required<TenantFeatureFlags> = {
  diagnosticsBar:     false,  // Never on by default — enable per-tenant via env check
  contactForm:        true,   // Contact form on by default
  abTesting:          false,  // No experiment query overhead until a test is running
  aiDecisionProvider: false,  // No AI cost until the tenant opts in
};

// ── Sensible default contact config ──────────────────────────────────────────

/**
 * Default contact configuration.
 * The form is enabled; webhook URL falls through to the global env var.
 */
export const DEFAULT_CONTACT_CONFIG: TenantContactConfig = {
  enabled: true,
  // webhookUrl: undefined  → uses N8N_CONTACT_WEBHOOK_URL env var
};

// ── Sensible default variant set ─────────────────────────────────────────────

/**
 * Full variant key set — all content variations are assumed to have
 * CMS entries.  Narrow this per-tenant if the client's CMS is only
 * partially populated.
 *
 * Key strings must match the literal union types in decision/types.ts.
 */
export const DEFAULT_VARIANT_CONFIG: TenantVariantConfig = {
  hero:  ["hero_google_problem", "hero_linkedin_vision", "hero_direct_brand"],
  proof: ["proof_cases", "proof_vision", "proof_platform"],
  cta:   ["cta_guide", "cta_platform", "cta_meeting"],
};

// ── Sensible default block config ────────────────────────────────────────────

/** All three page section blocks active. */
export const DEFAULT_BLOCK_CONFIG: TenantBlockConfig = {
  hero:  true,
  proof: true,
  cta:   true,
};

// ── Sensible default page config ─────────────────────────────────────────────

/** Homepage adaptive pipeline enabled. */
export const DEFAULT_PAGE_CONFIG: TenantPageConfig = {
  homepage: true,
};

// ── Fallback theme ────────────────────────────────────────────────────────────

/**
 * A minimal neutral theme used as the type-level placeholder.
 *
 * This theme is intentionally not used directly — it exists so that
 * TenantConfigInput can declare `theme` as optional, making it clear
 * in code review when a tenant's theme has not yet been designed.
 *
 * In practice, every real tenant config must supply its own theme.
 * The createTenantConfig() factory will warn if theme is absent.
 */
const PLACEHOLDER_THEME: TenantTheme = {
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

// ── TENANT_DEFAULTS ───────────────────────────────────────────────────────────

/**
 * The complete set of default values applied to every tenant config.
 *
 * Used by createTenantConfig() — you rarely need to reference this directly.
 */
export const TENANT_DEFAULTS = {
  cmsProvider:      "mock"  as CMSProviderName,
  decisionProvider: "rules" as DecisionProviderName,
  features:  DEFAULT_FEATURE_FLAGS,
  contact:   DEFAULT_CONTACT_CONFIG,
  variants:  DEFAULT_VARIANT_CONFIG,
  blocks:    DEFAULT_BLOCK_CONFIG,
  pages:     DEFAULT_PAGE_CONFIG,
  theme:     PLACEHOLDER_THEME,
} as const satisfies Partial<TenantConfig>;

// ── TenantConfigInput ────────────────────────────────────────────────────────

/**
 * The input shape for createTenantConfig().
 *
 * Required: tenantId, name, canonicalHostname, theme.
 * All other fields are optional and fall back to TENANT_DEFAULTS.
 *
 * Nested objects (features, contact, variants, blocks, pages) are
 * deep-merged with the defaults — you only need to specify the
 * keys you want to override.
 */
export interface TenantConfigInput {
  /** Required: unique tenant slug */
  tenantId: string;
  /** Required: human-readable name */
  name: string;
  /** Required: primary production hostname */
  canonicalHostname: string;
  /** Required: brand theme (no sensible default exists) */
  theme: TenantTheme;

  /** Optional: CMS backend. Default: "mock" */
  cmsProvider?: CMSProviderName;
  /** Optional: decision engine. Default: "rules" */
  decisionProvider?: DecisionProviderName;
  /** Optional: deep-merged with DEFAULT_FEATURE_FLAGS */
  features?: Partial<TenantFeatureFlags>;
  /** Optional: deep-merged with DEFAULT_CONTACT_CONFIG */
  contact?: Partial<TenantContactConfig>;
  /** Optional: deep-merged with DEFAULT_VARIANT_CONFIG */
  variants?: Partial<TenantVariantConfig>;
  /** Optional: deep-merged with DEFAULT_BLOCK_CONFIG */
  blocks?: Partial<TenantBlockConfig>;
  /** Optional: deep-merged with DEFAULT_PAGE_CONFIG */
  pages?: Partial<TenantPageConfig>;
}

// ── createTenantConfig ────────────────────────────────────────────────────────

/**
 * Creates a complete TenantConfig by deep-merging the provided input
 * with TENANT_DEFAULTS.
 *
 * All nested objects (features, contact, variants, blocks, pages) are
 * merged — the input only needs to supply the keys it wants to override.
 *
 * The `theme` field is always fully replaced — partial themes are not
 * supported because an incomplete theme produces incoherent CSS variables.
 *
 * @example
 * const ACME_TENANT = createTenantConfig({
 *   tenantId: "acme-corp",
 *   name: "Acme Corp",
 *   canonicalHostname: "acme.com",
 *   cmsProvider: "storyblok",
 *   theme: ACME_THEME,
 *   features: { abTesting: true },
 *   variants: {
 *     hero: ["hero_google_problem", "hero_direct_brand"],  // no LinkedIn variant
 *   },
 * });
 */
export function createTenantConfig(input: TenantConfigInput): TenantConfig {
  return {
    // ── Identity (always from input) ──────────────────────────────────────
    tenantId:          input.tenantId,
    name:              input.name,
    canonicalHostname: input.canonicalHostname,

    // ── Providers (input overrides default) ───────────────────────────────
    cmsProvider:      input.cmsProvider      ?? TENANT_DEFAULTS.cmsProvider,
    decisionProvider: input.decisionProvider ?? TENANT_DEFAULTS.decisionProvider,

    // ── Nested objects: deep-merge input with defaults ────────────────────
    features: { ...DEFAULT_FEATURE_FLAGS, ...input.features },
    contact:  { ...DEFAULT_CONTACT_CONFIG,  ...input.contact  },
    variants: { ...DEFAULT_VARIANT_CONFIG,  ...input.variants },
    blocks:   { ...DEFAULT_BLOCK_CONFIG,    ...input.blocks   },
    pages:    { ...DEFAULT_PAGE_CONFIG,     ...input.pages    },

    // ── Theme: always fully from input (no partial merge) ─────────────────
    theme: input.theme,
  };
}
