/**
 * Tenant Display Name Registry
 *
 * A zero-dependency lookup from tenantId to the human-readable name that
 * should be shown in admin UIs, Sanity Studio navigation, and log annotations.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────────
 *
 *   The authoritative `name` field lives on each TenantConfig object
 *   (e.g. WORKENGINE_TENANT.name = "WorkEngine"), but TenantConfig files
 *   carry theme and provider imports that are incompatible with Vite-bundled
 *   contexts such as the Sanity Studio.  This file is the thin, shareable
 *   layer that extracts only the display name mapping so it can be imported
 *   from anywhere:
 *
 *     • Sanity Studio (Vite)        — apps/studio/structure.ts
 *     • Next.js server components   — admin pages, log helpers
 *     • Tests                       — no side-effects
 *
 * ─── Maintenance ─────────────────────────────────────────────────────────────
 *
 *   When adding a new tenant:
 *     1. Create tenant/<new-tenant>-config.ts with the TenantConfig object.
 *     2. Add one line to TENANT_DISPLAY_NAMES below:
 *          "new-tenant-id": "New Tenant Name",
 *     3. Register hostnames in tenant/resolve-tenant.ts.
 *
 *   No other files need to change for the Studio to pick up the new label.
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   `getTenantDisplayName()` returns the registered name when one exists.
 *   For unknown tenant IDs it falls back to a title-cased slug so the UI
 *   always shows something readable:
 *
 *     "workengine"       → "WorkEngine"         (from registry)
 *     "mister-chameleon" → "Mister Chameleon"   (from registry)
 *     "acme-corp"        → "Acme Corp"           (slug fallback)
 */

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Maps every known tenantId to its human-readable display name.
 *
 * Source of truth: the `name` field on each TenantConfig.
 * Keep this file in sync with the config files under tenant/.
 */
export const TENANT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "mister-chameleon": "Mister Chameleon",
  "workengine":       "WorkEngine",
};

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable display name for a tenantId.
 *
 * Looks up TENANT_DISPLAY_NAMES first.  If the tenantId is not registered,
 * falls back to a title-cased version of the slug (hyphen → space, each word
 * capitalised).
 *
 * @example
 *   getTenantDisplayName("workengine")       // "WorkEngine"
 *   getTenantDisplayName("mister-chameleon") // "Mister Chameleon"
 *   getTenantDisplayName("acme-corp")        // "Acme Corp"  ← fallback
 *   getTenantDisplayName("foo")              // "Foo"        ← fallback
 */
export function getTenantDisplayName(tenantId: string): string {
  const registered = TENANT_DISPLAY_NAMES[tenantId];
  if (registered) return registered;

  // Slug fallback: split on hyphens, capitalise each word
  return tenantId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
