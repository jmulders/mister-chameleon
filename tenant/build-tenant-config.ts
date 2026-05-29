/**
 * Build Tenant Config from Store Settings
 *
 * Synthesises a minimal TenantConfig from a TenantSettings record fetched
 * from the Supabase tenant_settings table.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The static TENANT_REGISTRY (resolve-tenant.ts) only contains tenants that
 *   were hard-coded at build time (e.g. mister-chameleon, workengine).  Tenants
 *   onboarded via the admin UI are stored only in Supabase — they have a
 *   TenantSettings row but no TenantConfig entry.
 *
 *   In development, the ?tenant= query-param override calls resolveTenantById()
 *   which searches TENANT_REGISTRY only.  When a store-only tenant is requested
 *   (e.g. ?tenant=nascita), the registry lookup returns null and the override is
 *   silently ignored — the user sees the fallback (MC) tenant instead.
 *
 *   buildTenantConfigFromSettings() is called as a fallback when
 *   resolveTenantById() returns null, allowing store-only tenants to be
 *   previewed via ?tenant= without adding them to the static registry.
 *
 * ─── What is synthesised ──────────────────────────────────────────────────────
 *
 *   tenantId           — taken directly from TenantSettings
 *   name               — settings.name ?? tenantId
 *   canonicalHostname  — settings.primaryDomain ?? "<tenantId>.localhost:3000"
 *   cmsProvider        — settings.cms.provider ?? "mock"
 *   decisionProvider   — always "rules" (safe default)
 *   features           — dev-friendly defaults (diagnosticsBar: true in dev)
 *   theme              — derived from settings.design.theme (THEME_PRESETS lookup)
 *                        falls back to MISTER_CHAMELEON_TENANT.theme
 *
 * ─── Theme note ───────────────────────────────────────────────────────────────
 *
 *   The root layout re-derives the theme via resolveThemeForTenant(tenantSettings)
 *   which applies the preset and any admin token-editor overrides.  The theme
 *   field in TenantConfig is Layer A (base preset fallback) — it is only used
 *   when finalThemeKey is not a known ThemePresetKey.  For all well-configured
 *   tenants, Layer A is superseded by the store-derived theme, so the fallback
 *   to MISTER_CHAMELEON_TENANT.theme here is never visible.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Dead-code-eliminated in production: all call-sites are guarded by
 *   `process.env.NODE_ENV === "development"` checks.  The function itself
 *   carries no such guard — callers are responsible for dev-gating.
 */

import { MISTER_CHAMELEON_TENANT } from "./mister-chameleon-config";
import { THEME_PRESETS, isThemePresetKey } from "@/design-system/theme/presets";
import type { TenantConfig, TenantSettings } from "./types";

/**
 * Synthesises a minimal TenantConfig from a TenantSettings record.
 *
 * Intended exclusively for the dev-override path — not for production routing.
 *
 * @param settings  TenantSettings loaded from tenant_settings table.
 * @returns         A fully-formed TenantConfig suitable for dev preview.
 */
export function buildTenantConfigFromSettings(settings: TenantSettings): TenantConfig {
  // ── Theme ──────────────────────────────────────────────────────────────────
  // Prefer the stored preset key; fall back to the MC theme as a safe default.
  const themeKey = settings.design?.theme;
  const theme = (themeKey && isThemePresetKey(themeKey))
    ? THEME_PRESETS[themeKey]
    : MISTER_CHAMELEON_TENANT.theme;

  // ── CMS provider ───────────────────────────────────────────────────────────
  // Cast to CMSProviderName — the store validates valid values on write, so the
  // cast is safe.  Unknown values are tolerated by createCMSProvider() which
  // falls back to the env-based priority order.
  const cmsProvider = (settings.cms?.provider as TenantConfig["cmsProvider"]) ?? "mock";

  return {
    tenantId:          settings.tenantId,
    name:              settings.name ?? settings.tenantId,
    canonicalHostname: settings.primaryDomain ?? `${settings.tenantId}.localhost:3000`,
    cmsProvider,
    decisionProvider:  "rules",
    features: {
      diagnosticsBar: process.env.NODE_ENV === "development",
      contactForm:    true,
    },
    theme,
  };
}
