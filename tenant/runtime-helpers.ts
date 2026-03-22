/**
 * Tenant Runtime Helpers
 *
 * Pure functions for reading block availability and feature flags from a
 * TenantSettings record.  All helpers accept null and return well-defined
 * defaults so callers never need to guard against a missing tenant.
 *
 * ─── Safe in any context ──────────────────────────────────────────────────────
 *
 *   No I/O, no server-only imports, no Next.js dependencies.
 *   Import from "@/tenant" (client-safe) or "@/tenant/server" (server).
 *
 * ─── Two-layer enforcement ────────────────────────────────────────────────────
 *
 *   Layer 1 (write path) — enforcePackageLimits() in tenant-store.ts normalizes
 *   settings before they are persisted.  Settings on disk should already be
 *   package-compliant.
 *
 *   Layer 2 (read path, HERE) — each helper intersects the stored value with
 *   the package allow-list at read time.  This ensures that:
 *     • Settings stored before enforcement was introduced still respect limits.
 *     • Package downgrades take effect immediately without requiring a re-save.
 *     • A programming error in the write path cannot leak excess capabilities
 *       into the runtime.
 *
 * ─── Defensive reads ─────────────────────────────────────────────────────────
 *
 *   TenantSettings rows sourced from Supabase JSONB may carry fields that are
 *   undefined, null, or of an unexpected type at runtime — even when TypeScript
 *   says otherwise.  Specifically:
 *
 *     tenant.packageKey  — may be undefined/null/unknown string if the row was
 *                          created before the field was added, or if Supabase
 *                          returns an unrecognised value.  resolvePackageSafe()
 *                          validates the key before lookup and falls back to the
 *                          PRO_PACKAGE (permissive ceiling) so no crash occurs.
 *
 *     tenant.features    — may be absent or partially populated; each flag is
 *                          read with optional chaining and falls back per-key.
 *
 *     tenant.blocks      — context/content arrays may be missing; falls back to
 *                          the package allow-list or DEFAULT_CONTEXT_BLOCKS.
 *
 * ─── Package fallback chain ───────────────────────────────────────────────────
 *
 *   resolvePackageSafe(key):
 *     1. key is a recognised PackageKey ("starter" | "growth" | "pro")
 *        → return getPackageDefinition(key)
 *     2. key is unrecognised, undefined, or null
 *        → return PRO_PACKAGE (all features/blocks allowed)
 *     3. PRO_PACKAGE itself somehow unavailable (import failure)
 *        → return SAFE_PACKAGE_FALLBACK (hardcoded, no I/O)
 *
 *   PRO_PACKAGE is the permissive fallback — its ceiling allows all features —
 *   so runtime behaviour for an unrecognised package degrades gracefully rather
 *   than crashing or silently gating all features off.
 *
 * ─── Defaults when tenant is null (or fields are missing) ────────────────────
 *
 *   Context blocks → all three (hero, proof, cta) — preserves full homepage
 *   Content types  → package's full allow-list    — no extra restriction
 *   Features:
 *     experiments  → true   (matches pre-tenant behaviour; package still gates)
 *     ai           → false  (requires env credentials regardless of the flag)
 *     analytics    → true   (matches pre-tenant behaviour)
 *
 * ─── Exports ─────────────────────────────────────────────────────────────────
 *
 *   getEnabledContextBlocks(tenant)        → ReadonlySet<ContextBlockKey>
 *   isContextBlockEnabled(tenant, block)   → boolean
 *   getEnabledContentTypes(tenant)         → ReadonlySet<ContentBlockKey> | null
 *   filterSectionsByTenant(sections, t)    → T[]
 *   getTenantFeatures(tenant)              → TenantFeatures
 *   isFeatureEnabled(tenant, feature)      → boolean
 */

import type {
  TenantSettings,
  TenantFeatures,
  ContextBlockKey,
  ContentBlockKey,
} from "./types";
import { getPackageDefinition, PRO_PACKAGE } from "./packages";
import type { PackageDefinition }            from "./packages";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT_BLOCKS: readonly ContextBlockKey[] = ["hero", "proof", "cta"];

/**
 * Feature flag defaults used when no tenant record is available, or when
 * a feature field is missing from the stored JSONB.
 *
 * - analytics / experiments mirror the seed-tenant values so a fresh env
 *   behaves identically to a fully configured pro-tier tenant.
 * - ai defaults to false: it requires env credentials regardless of the flag.
 */
const DEFAULT_FEATURES: TenantFeatures = {
  experiments: true,
  ai:          false,
  analytics:   true,
};

/**
 * Last-resort feature allowance used only if the PRO_PACKAGE import itself is
 * somehow unavailable.  All features enabled — same semantics as PRO.
 * Never returned under normal circumstances.
 */
const SAFE_PACKAGE_FEATURES_FALLBACK: TenantFeatures = {
  experiments: true,
  ai:          true,
  analytics:   true,
};

// ── Safe package resolution ───────────────────────────────────────────────────

/** The set of recognised PackageKey strings, used for runtime validation. */
const VALID_PACKAGE_KEYS = new Set<string>(["starter", "growth", "pro"]);

/**
 * Resolves a PackageDefinition from an untrusted runtime value, never throwing.
 *
 * Three-level fallback:
 *   1. key is a recognised PackageKey  → getPackageDefinition(key)
 *   2. key is unrecognised/null/undef  → PRO_PACKAGE (permissive ceiling)
 *   3. PRO_PACKAGE import failed       → inline hardcoded constant (last resort)
 *
 * Using PRO_PACKAGE as the fallback means an unrecognised package does not
 * silently disable all features; the ceiling is open and the per-tenant toggle
 * (or its default) controls what actually runs.
 *
 * @param key  Raw value from tenant.packageKey — typed as unknown because the
 *             Supabase JSONB boundary removes TypeScript's compile-time safety.
 */
function resolvePackageSafe(key: unknown): PackageDefinition {
  // Level 1 — recognised key
  if (typeof key === "string" && VALID_PACKAGE_KEYS.has(key)) {
    const pkg = getPackageDefinition(key as "starter" | "growth" | "pro");
    if (pkg) return pkg;
  }

  // Level 2 — unrecognised / missing: fall back to PRO (permissive)
  if (PRO_PACKAGE) return PRO_PACKAGE;

  // Level 3 — belt-and-braces: return a minimal inline definition so the
  // function never throws even if the import graph is broken.
  return {
    key:              "pro",
    displayName:      "Pro (fallback)",
    shortDescription: "",
    allowedBlocks: {
      context: DEFAULT_CONTEXT_BLOCKS as ContextBlockKey[],
      content: [],
    },
    allowedFeatures: SAFE_PACKAGE_FEATURES_FALLBACK,
    allowedThemes:   ["default", "minimal", "bold", "custom"],
    limits: {
      maxSites:           Infinity,
      maxExperiments:     Infinity,
      maxVariantsPerSlot: Infinity,
    },
    pricing: {
      monthlyPriceIndicative: null,
      annualPriceIndicative:  null,
      recommendedFor:         "",
      salesHighlights:        [],
    },
  };
}

// ── Context block helpers ─────────────────────────────────────────────────────

/**
 * Returns the set of context (adaptive) blocks the tenant has enabled,
 * intersected with what the package allows.
 *
 * Context blocks are the decision-engine-driven components: hero, proof, cta.
 * Falls back to all three when the tenant record is absent (or when
 * `tenant.blocks.context` is missing from the stored JSONB) so the homepage
 * renders in full even without a stored configuration.
 *
 * Package enforcement: even if the stored settings claim a block is enabled,
 * it is excluded here if the package's allowedBlocks.context does not include
 * it — guarding against stale data or package downgrades.
 *
 * @param tenant  TenantSettings, or null to use the defaults.
 * @returns       A ReadonlySet of enabled ContextBlockKey values.
 *
 * @example
 * const enabled = getEnabledContextBlocks(tenant);
 * if (enabled.has("hero")) { ... }
 */
export function getEnabledContextBlocks(
  tenant: TenantSettings | null,
): ReadonlySet<ContextBlockKey> {
  if (!tenant) return new Set(DEFAULT_CONTEXT_BLOCKS);

  const pkg        = resolvePackageSafe(tenant.packageKey);
  const pkgAllowed = new Set(pkg.allowedBlocks.context);

  // Defensive: `blocks` or `blocks.context` may be absent on legacy rows.
  const storedContext = tenant.blocks?.context ?? DEFAULT_CONTEXT_BLOCKS;

  return new Set(storedContext.filter((b) => pkgAllowed.has(b)));
}

/**
 * Returns true if the given context block is enabled for the tenant.
 *
 * Convenience wrapper over getEnabledContextBlocks() for single-block checks.
 *
 * @param tenant  TenantSettings, or null to use the defaults.
 * @param block   The ContextBlockKey to test.
 *
 * @example
 * if (isContextBlockEnabled(tenant, "hero")) { ... }
 */
export function isContextBlockEnabled(
  tenant: TenantSettings | null,
  block:  ContextBlockKey,
): boolean {
  return getEnabledContextBlocks(tenant).has(block);
}

// ── Content block / CMS section helpers ───────────────────────────────────────

/**
 * Returns the set of CMS section types the tenant permits, intersected with
 * what the package allows, or null when no tenant is present.
 *
 * The null / non-null distinction is intentional:
 *   null      → no restriction — all CMS section types are allowed
 *   non-null  → only the listed types may render
 *
 * When the tenant record exists but `blocks.content` is missing from the JSONB
 * (legacy row), this function returns the package's full allowed content set
 * rather than null.  This keeps the package ceiling in place without silently
 * removing all per-tenant content restrictions.
 *
 * Package enforcement: content block types not in pkg.allowedBlocks.content
 * are excluded even if the stored settings include them.
 *
 * @param tenant  TenantSettings, or null to allow all types.
 * @returns       A ReadonlySet<ContentBlockKey>, or null for unrestricted.
 */
export function getEnabledContentTypes(
  tenant: TenantSettings | null,
): ReadonlySet<ContentBlockKey> | null {
  if (!tenant) return null;

  const pkg        = resolvePackageSafe(tenant.packageKey);
  const pkgAllowed = new Set(pkg.allowedBlocks.content);

  // Defensive: `blocks` or `blocks.content` may be absent on legacy rows.
  const storedContent = tenant.blocks?.content ?? pkg.allowedBlocks.content;

  return new Set(storedContent.filter((b) => pkgAllowed.has(b)));
}

/**
 * Filters a CMS section array to only those types the tenant permits.
 *
 * Accepts any object that has a `_type` string field — works with raw CMS
 * documents, the mapped PageSectionData shape, or any similar structure.
 *
 * Returns the original array unchanged when the tenant is null or has no
 * content-type restriction, preserving all sections in that case.
 *
 * @param sections  The full CMS section list from the page document.
 * @param tenant    TenantSettings, or null to skip filtering.
 * @returns         The sections permitted for this tenant.
 *
 * @example
 * const visible = filterSectionsByTenant(homePage.sections ?? [], tenant);
 */
export function filterSectionsByTenant<T extends { _type: string }>(
  sections: T[],
  tenant:   TenantSettings | null,
): T[] {
  const allowed = getEnabledContentTypes(tenant);
  if (allowed === null) return sections;
  return sections.filter((s) => allowed.has(s._type as ContentBlockKey));
}

// ── Feature flag helpers ──────────────────────────────────────────────────────

/**
 * Returns the tenant's feature flags, ANDed with what the package allows.
 *
 * All reads are fully null-safe:
 *
 *   tenant.packageKey  — resolved through resolvePackageSafe(), which validates
 *                        the key at runtime and falls back to PRO_PACKAGE for any
 *                        unrecognised, undefined, or null value.  pkg is
 *                        guaranteed non-null before any field access.
 *
 *   tenant.features    — read with optional chaining; each flag falls back to the
 *                        DEFAULT_FEATURES value before the package AND is applied.
 *
 *   resolved flag = (stored ?? default) && packageAllows
 *
 * Package enforcement: a feature flag that evaluates to true (from store or
 * default) but is false in pkg.allowedFeatures is returned as false — the
 * package is the ceiling, the stored flag is the admin-controlled value
 * within it.
 *
 * @param tenant  TenantSettings, or null to use the defaults.
 * @returns       A TenantFeatures object with all flags resolved.
 *
 * @example
 * const { analytics, experiments } = getTenantFeatures(tenant);
 */
export function getTenantFeatures(
  tenant: TenantSettings | null,
): TenantFeatures {
  if (!tenant) return DEFAULT_FEATURES;

  // resolvePackageSafe() never returns undefined — safe to access all fields.
  const pkg    = resolvePackageSafe(tenant.packageKey);
  const pkgFx  = pkg.allowedFeatures ?? SAFE_PACKAGE_FEATURES_FALLBACK;

  // Optional-chain each flag: absent keys fall back to DEFAULT_FEATURES.
  const stored = tenant.features;

  return {
    experiments: (stored?.experiments ?? DEFAULT_FEATURES.experiments) && pkgFx.experiments,
    ai:          (stored?.ai          ?? DEFAULT_FEATURES.ai)          && pkgFx.ai,
    analytics:   (stored?.analytics   ?? DEFAULT_FEATURES.analytics)   && pkgFx.analytics,
  };
}

/**
 * Returns true if the given feature flag is enabled for the tenant.
 *
 * Convenience wrapper over getTenantFeatures() for single-flag checks.
 *
 * @param tenant   TenantSettings, or null to use the defaults.
 * @param feature  The feature flag key to check.
 *
 * @example
 * if (isFeatureEnabled(tenant, "analytics")) {
 *   await logServedVariants(sessionId, experience);
 * }
 */
export function isFeatureEnabled(
  tenant:  TenantSettings | null,
  feature: keyof TenantFeatures,
): boolean {
  return getTenantFeatures(tenant)[feature];
}
