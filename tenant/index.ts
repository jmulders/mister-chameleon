/**
 * Tenant Module — Client-safe Public API
 *
 * Re-exports every public symbol from the tenant subsystem that is safe to
 * import in Client Components, Edge Runtime code, and tests.
 * Import from "@/tenant" rather than from individual files.
 *
 * ─── What this module provides ───────────────────────────────────────────────
 *
 *   Types
 *     TenantConfig          — full config shape for one deployment
 *     TenantFeatureFlags    — boolean capability flags per tenant
 *     CMSProviderName       — "sanity" | "mock"
 *     DecisionProviderName  — "rules" (extensible)
 *
 *   Configs
 *     MISTER_CHAMELEON_TENANT — default tenant config (reads env vars at import)
 *
 *   Functions
 *     resolveTenant(hostname)       — hostname string → TenantConfig (no Next.js dep)
 *     getPackageDefinition()        — package tier → PackageDefinition
 *     getAllPackageDefinitions()     — all tiers in canonical order (pricing pages)
 *     getPackageOption()            — package tier → PackageOption (UI-ready, pre-formatted)
 *     getAllPackageOptions()         — all tiers as PackageOption[] (onboarding, pricing UI)
 *     resolveThemeForTenant()       — TenantSettings → ResolvedTheme (CSS delta, pure)
 *     getResolvedTenantTheme()      — TenantSettings → ResolvedDesignTheme (structured)
 *
 * ─── Choosing the right import ───────────────────────────────────────────────
 *
 *   Client Components, Edge Runtime, tests:
 *     import { getPackageDefinition } from "@/tenant";
 *     import type { TenantSettings } from "@/tenant";
 *
 *   Server Components, Route Handlers, Server Actions:
 *     import { getTenantById, getActiveTenant } from "@/tenant/server";
 *
 *   Middleware / Edge (no next/headers):
 *     import { resolveTenant } from "@/tenant";
 *     const tenant = resolveTenant(host);
 *
 * ─── Server-only exports ─────────────────────────────────────────────────────
 *
 *   getActiveTenant, getTenantById, getAllTenants, saveTenant, createTenant,
 *   validateTenantSettings, StoreResult — see "@/tenant/server"
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  // ── Deployment config types (TenantConfig) ──────────────────────────────
  TenantConfig,
  TenantFeatureFlags,
  TenantContactConfig,
  TenantVariantConfig,
  TenantBlockConfig,
  TenantPageConfig,
  CMSProviderName,
  DecisionProviderName,
  // TenantTheme is re-exported from types.ts, which re-exports from design-system.
  // Import from "@/tenant" to avoid reaching into design-system directly.
  TenantTheme,
  // ── Package & settings model types (TenantSettings) ─────────────────────
  PackageKey,
  ContextBlockKey,
  ContentBlockKey,
  TenantBlocks,
  TenantFeatures,
  TenantAiProviderName,
  TenantAiProviderConfig,
  TenantAiSettings,
  TenantCmsSettings,
  ThemeKey,
  TenantTokenOverrides,
  TenantDesignSettings,
  TenantSettings,
  TenantLanguageConfig,
  TemplateCatalogKey,
} from "./types";

// Theme sub-types — available when callers need to work with individual surfaces.
export type {
  TenantBrandColors,
  TenantTextColors,
  TenantBackgroundColors,
  TenantBorderColors,
  TenantBrandMeta,
  TenantRadiusValues,
  RadiusPersonality,
} from "@/design-system/theme/tenant-theme";

// Theme utilities
export {
  RADIUS_PRESETS,
  tenantThemeToCSS,
  tenantThemeToVarsRecord,
} from "@/design-system/theme/tenant-theme";

// Theme catalog (admin UI metadata — labels, descriptions, swatch colours)
export type {
  ThemePresetKey,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
} from "@/design-system/theme/presets";
export {
  THEME_PRESETS,
  THEME_CATALOG,
  resolveTheme,
  isThemePresetKey,
} from "@/design-system/theme/presets";

// ── Runtime theme resolution ──────────────────────────────────────────────────
// Maps TenantSettings → a flat CSS-var override map ready for injection.
// Use resolveThemeForTenant() in Server Components; resolvedThemeToCSS() to
// serialise the result to a <style> tag.
export type { ResolvedTheme } from "./resolve-theme";
export {
  resolveThemeForTenant,
  resolvedThemeToCSS,
} from "./resolve-theme";

// ── Tenant template ───────────────────────────────────────────────────────────
// Factory and defaults for creating new tenant configs.
export {
  createTenantConfig,
  TENANT_DEFAULTS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_CONTACT_CONFIG,
  DEFAULT_VARIANT_CONFIG,
  DEFAULT_BLOCK_CONFIG,
  DEFAULT_PAGE_CONFIG,
} from "./templates/base-template";
export type { TenantConfigInput } from "./templates/base-template";

// ── Tenant configs ────────────────────────────────────────────────────────────
export { MISTER_CHAMELEON_TENANT } from "./mister-chameleon-config";
export { MISTER_CHAMELEON_THEME } from "./theme";

// Example client config — not yet live; shows the onboarding pattern.
// Exported from the barrel so callers can reference it without reaching into
// the templates sub-directory. Uncomment once the client is ready to activate.
// export { ACME_GROWTH_TENANT } from "./templates/acme-growth-config";

// Default client template — copy-paste starting point for a new client.
// NEW_CLIENT_TENANT uses placeholder values and should not be registered
// in resolve-tenant.ts directly. Copy the file, fill in client details, then
// register the renamed export.
// export { NEW_CLIENT_TENANT, DEFAULT_CLIENT_IMPLEMENTATION } from "./templates/default-client-template";

// ── Package definitions ───────────────────────────────────────────────────────
export {
  getPackageDefinition,
  getAllPackageDefinitions,
  isValidPackageKey,
  VALID_PACKAGE_KEYS,
  STARTER_PACKAGE,
  GROWTH_PACKAGE,
  PRO_PACKAGE,
} from "./packages";
export type { PackageDefinition, PackageLimits, PackagePricingMeta } from "./packages";

// ── Package options (UI-ready projections) ────────────────────────────────────
// Pre-formatted, pre-shaped views of PackageDefinition for onboarding flows,
// admin package selectors, and future pricing pages.  Use these in UI
// components rather than mapping PackageDefinition fields inline.
//
//   getAllPackageOptions()  — all tiers in canonical order (array, by-reference stable)
//   getPackageOption(key)  — one tier by key (by-reference stable)
//
// Fields include: label, shortDescription, recommendedFor, highlights,
//   monthlyPriceLabel ("$199 / mo" or "Contact us"), annualPriceLabel,
//   isContactSales, features.{experiments,ai,analytics}, limits.{maxSites,…}
export type { PackageOption }              from "./package-options";
export { getAllPackageOptions, getPackageOption } from "./package-options";

// ── Runtime block and feature helpers ────────────────────────────────────────
// Pure functions for reading block availability and feature flags from a
// TenantSettings record.  All accept null and apply sensible defaults so
// callers never need to guard against a missing tenant.
export {
  getEnabledContextBlocks,
  isContextBlockEnabled,
  getEnabledContentTypes,
  filterSectionsByTenant,
  getTenantFeatures,
  isFeatureEnabled,
} from "./runtime-helpers";

// ── Design theme resolution ───────────────────────────────────────────────────
// Turns TenantDesignSettings into a fully structured ResolvedDesignTheme.
// Use getResolvedTenantTheme() when you need typed design values in component
// logic (colors, typography, radius, spacing, button style).
// For CSS-var injection only, use resolveThemeForTenant() + resolvedThemeToCSS()
// from "./resolve-theme" (already exported above).
export type {
  ResolvedDesignColors,
  ResolvedDesignTypography,
  ResolvedDesignRadius,
  ResolvedDesignSpacing,
  ResolvedDesignButton,
  ResolvedDesignTheme,
} from "./design-theme";
export {
  DESIGN_PRESETS,
  LEGACY_THEME_MAP,
  normalizeThemeKey,
  getSafeDesignPreset,
  getResolvedTenantTheme,
} from "./design-theme";

// ── Package seed defaults ─────────────────────────────────────────────────────
// Conservative initial TenantSettings values for a newly created tenant,
// derived from the package definition.  Separates "what the package allows"
// (ceiling) from "what a new tenant starts with" (sensible floor).
//
//   features.analytics    = pkg.allowedFeatures.analytics (on if allowed)
//   features.experiments  = false (off; operator enables when ready)
//   features.ai           = false (off; requires provider + policy setup)
//   blocks.*              = pkg.allowedBlocks.* (all allowed blocks enabled)
//   ai.mode               = "disabled" (always; activate after setup)
//
// Used by onboarding/tenant-setup.ts to seed TenantSettings at creation time.
export type { PackageSeedDefaults }   from "./package-defaults";
export { getPackageSeedDefaults }     from "./package-defaults";

// ── Package enforcement ───────────────────────────────────────────────────────
// Pure normalization helper — clamps a structurally valid TenantSettings to
// the limits and allow-lists of its own package.  Safe to call from any
// context (no I/O, no server-only deps).  Primarily used server-side in the
// save path (tenant-store.ts) but exported here so admin UI and tests can
// pre-validate or display what would be adjusted before committing a save.
export type { EnforcementResult, EnforcementOptions } from "./package-enforcement";
export { enforcePackageLimits }                       from "./package-enforcement";

// ── Resolver (Edge / middleware / tests safe — no next/headers) ───────────────
//
// resolveTenant(hostname)   — production request routing (Host header → TenantConfig)
// resolveTenantById(id)     — dev-time lookup by tenantId (for ?tenant= override only)
export { resolveTenant, resolveTenantById } from "./resolve-tenant";
