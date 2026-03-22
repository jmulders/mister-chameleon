/**
 * Tenant Package Enforcement
 *
 * Pure normalization helpers that clamp a structurally valid TenantSettings
 * object to the limits and allow-lists of its own package tier.
 *
 * ─── Separation of concerns ───────────────────────────────────────────────────
 *
 *   validateTenantSettings  (tenant-store.ts)
 *     Checks structural validity — are the fields present and the right types?
 *     Does not know about package tiers.
 *
 *   enforcePackageLimits    (THIS FILE)
 *     Accepts a structurally valid TenantSettings and normalizes it against
 *     the package definition.  Never rejects — always returns a clamped copy
 *     plus a list of human-readable violation strings describing what changed.
 *
 * ─── Enforcement rules ────────────────────────────────────────────────────────
 *
 *   blocks.context   → filter to pkg.allowedBlocks.context
 *   blocks.content   → filter to pkg.allowedBlocks.content
 *   features.*       → AND with pkg.allowedFeatures.*
 *   ai.mode          → force "disabled" when pkg.allowedFeatures.ai === false
 *   design.theme     → reset to pkg.allowedThemes[0] when not in allowedThemes
 *
 * ─── Package-change context ───────────────────────────────────────────────────
 *
 *   When `EnforcementOptions.previousPackageKey` is supplied and differs from
 *   the current package key, the violation list is prefixed with a one-line
 *   summary of the transition (e.g. "Package downgraded from Growth to Starter.
 *   The following settings were adjusted:").  This makes warnings surfaced to
 *   an admin in the save-feedback UI self-explanatory rather than cryptic.
 *
 *   The store (tenant-store.ts) detects the previous package by reading the
 *   existing record before writing and passes it here automatically.  External
 *   callers that want richer messages can supply the option themselves.
 *
 * ─── Safe in any context ──────────────────────────────────────────────────────
 *
 *   No I/O, no Next.js deps, no server-only imports.
 *   Import from "@/tenant" (client-safe barrel) or "@/tenant/server".
 */

import type {
  TenantSettings,
  TenantFeatures,
  TenantAiSettings,
  TenantDesignSettings,
  PackageKey,
  ContextBlockKey,
  ContentBlockKey,
  ThemeKey,
} from "./types";
import { getPackageDefinition } from "./packages";

// ── Package tier order ────────────────────────────────────────────────────────
// Used to determine upgrade vs. downgrade direction in violation messages.

const PACKAGE_TIER: Record<PackageKey, number> = {
  starter: 0,
  growth:  1,
  pro:     2,
};

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Optional context for enforcePackageLimits.
 *
 *   previousPackageKey
 *     The package key the tenant held before this save operation.
 *     When present and different from `settings.packageKey`, violations are
 *     prefixed with a package-transition summary so admins understand *why*
 *     values were adjusted — not just *what* changed.
 *     Omit when the package key is not changing (same-package settings edit).
 */
export interface EnforcementOptions {
  readonly previousPackageKey?: PackageKey;
}

/**
 * The result of enforcing package limits on a TenantSettings object.
 *
 *   settings   — the clamped copy, safe to persist
 *   violations — one entry per adjustment made; empty when no clamping was
 *                needed.  When a package change is detected, the first entry
 *                is a transition summary ("Package downgraded from X to Y.
 *                The following settings were adjusted:") followed by the
 *                individual field-level messages.
 *                Suitable for surfacing as admin warnings.
 */
export interface EnforcementResult {
  readonly settings:   TenantSettings;
  readonly violations: readonly string[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Builds a human-readable package transition summary for the violations list.
 *
 * "Package downgraded from Growth to Starter. The following settings were adjusted:"
 * "Package upgraded from Starter to Growth. The following settings were adjusted:"
 * "Package changed from Growth to Pro. The following settings were adjusted:"
 *   (the last form shouldn't produce violations in practice; included for safety)
 */
function buildTransitionPrefix(from: PackageKey, to: PackageKey): string {
  const fromPkg   = getPackageDefinition(from);
  const toPkg     = getPackageDefinition(to);
  const fromTier  = PACKAGE_TIER[from];
  const toTier    = PACKAGE_TIER[to];
  const direction = toTier < fromTier ? "downgraded" : toTier > fromTier ? "upgraded" : "changed";

  return (
    `Package ${direction} from ${fromPkg.displayName} to ${toPkg.displayName}. ` +
    `The following settings were adjusted:`
  );
}

// ── enforcePackageLimits ──────────────────────────────────────────────────────

/**
 * Clamps a structurally valid TenantSettings to what its package permits.
 *
 * Normalization is always applied — this function never rejects.  The caller
 * should persist `result.settings` (not the original input) and surface
 * `result.violations` as save-time warnings so admins know what was adjusted.
 *
 * ─── What each rule does ─────────────────────────────────────────────────────
 *
 *   blocks.context   Removes context block keys not in pkg.allowedBlocks.context.
 *   blocks.content   Removes content block keys not in pkg.allowedBlocks.content.
 *   features.*       Sets a feature to false when the package does not allow it,
 *                    regardless of what the caller passed.
 *   ai.mode          Resets to "disabled" when pkg.allowedFeatures.ai is false.
 *                    Running shadow/live AI without a package entitlement would
 *                    incur cost with no commercial approval.
 *   design.theme     Resets to the first theme in pkg.allowedThemes when the
 *                    requested theme is not in the package's allow-list.
 *                    primaryColor and primaryFont are kept as-is — they apply
 *                    on top of the base theme and are always valid.
 *
 * ─── Package-change violations ───────────────────────────────────────────────
 *
 *   When `options.previousPackageKey` is supplied and different from
 *   `settings.packageKey`, a transition summary is prepended to the violations
 *   array so the resulting messages are self-explanatory.
 *
 * @param settings  A structurally valid TenantSettings (post-validateTenantSettings).
 * @param options   Optional context — see EnforcementOptions.
 * @returns         EnforcementResult with the normalized settings + violations.
 *
 * @example
 * // Simple enforcement (no package change context):
 * const { settings: enforced, violations } = enforcePackageLimits(raw);
 *
 * @example
 * // Package-change-aware enforcement (store usage):
 * const { settings: enforced, violations } = enforcePackageLimits(raw, {
 *   previousPackageKey: existingTenant?.packageKey,
 * });
 * // violations[0] → "Package downgraded from Growth to Starter. The following …"
 * // violations[1] → "features.experiments: disabled — not available …"
 */
export function enforcePackageLimits(
  settings: TenantSettings,
  options?: EnforcementOptions,
): EnforcementResult {
  const pkg             = getPackageDefinition(settings.packageKey);
  const fieldViolations: string[] = [];

  // ── blocks.context ────────────────────────────────────────────────────────
  const allowedContextSet = new Set<ContextBlockKey>(pkg.allowedBlocks.context);
  const rawContext        = settings.blocks.context;
  const enforcedContext   = rawContext.filter((b) => allowedContextSet.has(b));
  const removedContext    = rawContext.filter((b) => !allowedContextSet.has(b));

  if (removedContext.length > 0) {
    fieldViolations.push(
      `blocks.context: [${removedContext.join(", ")}] removed — ` +
      `not available in the "${settings.packageKey}" package.`,
    );
  }

  // ── blocks.content ────────────────────────────────────────────────────────
  const allowedContentSet = new Set<ContentBlockKey>(pkg.allowedBlocks.content);
  const rawContent        = settings.blocks.content;
  const enforcedContent   = rawContent.filter((b) => allowedContentSet.has(b));
  const removedContent    = rawContent.filter((b) => !allowedContentSet.has(b));

  if (removedContent.length > 0) {
    fieldViolations.push(
      `blocks.content: [${removedContent.join(", ")}] removed — ` +
      `not available in the "${settings.packageKey}" package.`,
    );
  }

  // ── features ──────────────────────────────────────────────────────────────
  const features: TenantFeatures = {
    experiments: settings.features.experiments && pkg.allowedFeatures.experiments,
    ai:          settings.features.ai          && pkg.allowedFeatures.ai,
    analytics:   settings.features.analytics   && pkg.allowedFeatures.analytics,
  };

  if (settings.features.experiments && !pkg.allowedFeatures.experiments) {
    fieldViolations.push(
      `features.experiments: disabled — ` +
      `not available in the "${settings.packageKey}" package.`,
    );
  }
  if (settings.features.ai && !pkg.allowedFeatures.ai) {
    fieldViolations.push(
      `features.ai: disabled — ` +
      `not available in the "${settings.packageKey}" package.`,
    );
  }
  // analytics is always permitted in all current packages — included for
  // future-proofing should a new tier restrict it.
  if (settings.features.analytics && !pkg.allowedFeatures.analytics) {
    fieldViolations.push(
      `features.analytics: disabled — ` +
      `not available in the "${settings.packageKey}" package.`,
    );
  }

  // ── ai.mode ───────────────────────────────────────────────────────────────
  // Force "disabled" when the package does not allow AI at all, regardless
  // of what the admin set.  shadow/live without an AI entitlement would incur
  // cost without any commercial approval.  primaryColor/primaryFont are kept
  // as-is so configuration survives a potential future upgrade.
  let ai: TenantAiSettings = settings.ai;
  if (!pkg.allowedFeatures.ai && settings.ai.mode !== "disabled") {
    fieldViolations.push(
      `ai.mode: reset to "disabled" — ` +
      `AI is not available in the "${settings.packageKey}" package.`,
    );
    ai = { ...settings.ai, mode: "disabled" };
  }

  // ── design.theme ──────────────────────────────────────────────────────────
  const allowedThemesSet = new Set<ThemeKey>(pkg.allowedThemes);
  let design: TenantDesignSettings = settings.design;

  if (!allowedThemesSet.has(settings.design.theme)) {
    // Fall back to the first theme the package allows (always defined).
    const fallbackTheme: ThemeKey = pkg.allowedThemes[0] ?? "default";
    fieldViolations.push(
      `design.theme: "${settings.design.theme}" is not allowed in the ` +
      `"${settings.packageKey}" package — reset to "${fallbackTheme}".`,
    );
    design = { ...settings.design, theme: fallbackTheme };
  }

  // ── Assemble enforced settings ────────────────────────────────────────────
  const enforced: TenantSettings = {
    ...settings,
    blocks: {
      context: enforcedContext,
      content: enforcedContent,
    },
    features,
    ai,
    design,
  };

  // ── Build final violations with optional package-change prefix ────────────
  //
  // When the caller supplies a previousPackageKey that differs from the
  // current one, and there are field-level violations, prepend a single
  // human-readable summary of the transition so the messages make sense
  // in isolation (e.g. in a save-feedback toast or warning list).
  //
  // We skip the prefix when there are no violations — an upgrade that adds
  // entitlements is silent; no adjustment messages are warranted.

  let violations: readonly string[];

  const prevKey = options?.previousPackageKey;
  const packageChanged = prevKey !== undefined && prevKey !== settings.packageKey;

  if (packageChanged && fieldViolations.length > 0) {
    violations = [buildTransitionPrefix(prevKey, settings.packageKey), ...fieldViolations];
  } else {
    violations = fieldViolations;
  }

  return { settings: enforced, violations };
}
