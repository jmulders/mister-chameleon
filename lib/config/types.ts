/**
 * Layered Configuration — Core Types
 *
 * Defines the standard pattern for multi-tenant, layered configuration across
 * all domains in the platform (email, AI, CRM, enrichment, forms, etc.).
 *
 * ─── Resolution order (highest → lowest priority) ─────────────────────────────
 *
 *   1. tenant   — per-tenant DB override (tenant_settings or dedicated table)
 *   2. platform — platform-wide DB default (platform_settings table)
 *   3. env      — environment variable fallback
 *   4. system   — compile-time / safe default (never null)
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   All domain resolvers return `DomainResolution<T>`:
 *
 *     const resolution = await resolveEmailConfig(tenantId);
 *     resolution.config          // effective merged config
 *     resolution.source          // where the highest-priority value came from
 *     resolution.hasTenantOverride  // boolean — tenant has customised this domain
 *     resolution.layers.tenant   // raw tenant layer (or null)
 *
 * ─── Admin UX labels ──────────────────────────────────────────────────────────
 *
 *   Use `sourceLabel(source)` and `sourceBadgeClass(source)` to render
 *   consistent status badges across admin pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ConfigSource
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifies which configuration layer supplied the effective config.
 *
 * - "tenant"   — This tenant has an explicit DB override.
 * - "platform" — No tenant override; platform DB default is active.
 * - "env"      — No DB config; environment variable fallback is active.
 * - "system"   — Only compile-time / code defaults are present.
 * - "none"     — No configuration at all; feature is effectively disabled.
 */
export type ConfigSource = "tenant" | "platform" | "env" | "system" | "none";

// ─────────────────────────────────────────────────────────────────────────────
// DomainResolution<T>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The result of resolving a configuration domain for a specific tenant.
 *
 * @template T — The domain-specific config type (e.g. ResolvedEmailConfig).
 */
export interface DomainResolution<T extends object> {
  /**
   * The effective, fully-merged config for this tenant.
   * Layers are applied lowest → highest priority:
   *   system → env → platform → tenant
   * so tenant values always win.
   */
  readonly config: T;

  /**
   * The highest-priority layer that contributed any configuration.
   * Use this for admin status badges and diagnostics.
   */
  readonly source: ConfigSource;

  /**
   * Whether this tenant has an explicit DB override for this domain.
   * When true, `layers.tenant` is non-null.
   */
  readonly hasTenantOverride: boolean;

  /**
   * Whether a platform-wide DB default exists for this domain.
   * When true, `layers.platform` is non-null.
   */
  readonly hasPlatformDefault: boolean;

  /**
   * Whether any environment variable fallback is available for this domain.
   * When true, `layers.env` is non-null.
   */
  readonly hasEnvFallback: boolean;

  /**
   * Raw per-layer values, before merging.
   * Useful for admin diagnostics, override comparison, and UI.
   *
   * Layers that were not found are `null`.
   */
  readonly layers: {
    readonly tenant:   Partial<T> | null;
    readonly platform: Partial<T> | null;
    readonly env:      Partial<T> | null;
    readonly system:   Partial<T> | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin UI helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a ConfigSource value.
 * Used in admin badge text.
 *
 * @example
 *   sourceLabel("tenant")   // → "Tenant override"
 *   sourceLabel("platform") // → "Platform default"
 *   sourceLabel("env")      // → "Env var fallback"
 *   sourceLabel("system")   // → "System default"
 *   sourceLabel("none")     // → "Not configured"
 */
export function sourceLabel(source: ConfigSource): string {
  switch (source) {
    case "tenant":   return "Tenant override";
    case "platform": return "Platform default";
    case "env":      return "Env var fallback";
    case "system":   return "System default";
    case "none":     return "Not configured";
  }
}

/**
 * Returns a Tailwind CSS class string for styling a source badge.
 * Provides consistent visual hierarchy across admin pages.
 *
 * @example
 *   sourceBadgeClass("tenant")   // green — highest priority / tenant-specific
 *   sourceBadgeClass("platform") // blue  — platform configured
 *   sourceBadgeClass("env")      // neutral — legacy env var
 *   sourceBadgeClass("system")   // neutral — code default
 *   sourceBadgeClass("none")     // amber  — not configured, attention needed
 */
export function sourceBadgeClass(source: ConfigSource): string {
  switch (source) {
    case "tenant":   return "bg-green-50 text-green-700 border border-green-200";
    case "platform": return "bg-blue-50 text-blue-700 border border-blue-200";
    case "env":      return "bg-neutral-100 text-neutral-600 border border-neutral-200";
    case "system":   return "bg-neutral-100 text-neutral-500 border border-neutral-200";
    case "none":     return "bg-amber-50 text-amber-700 border border-amber-200";
  }
}

/**
 * Returns a short description for a ConfigSource, suitable for admin tooltips.
 *
 * @example
 *   sourceDescription("tenant")   // → "This tenant has its own configuration."
 *   sourceDescription("platform") // → "Using the platform-wide default configuration."
 *   sourceDescription("env")      // → "Falling back to environment variables."
 *   sourceDescription("system")   // → "Using compiled-in system defaults."
 *   sourceDescription("none")     // → "No configuration is active."
 */
export function sourceDescription(source: ConfigSource): string {
  switch (source) {
    case "tenant":   return "This tenant has its own configuration.";
    case "platform": return "Using the platform-wide default configuration.";
    case "env":      return "Falling back to environment variables.";
    case "system":   return "Using compiled-in system defaults.";
    case "none":     return "No configuration is active.";
  }
}
