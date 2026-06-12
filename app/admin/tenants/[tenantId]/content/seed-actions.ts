/**
 * Tenant Content — CMS Seed Server Actions
 *
 * Per-tenant wrappers around the platform seed operations.
 * These actions are invoked from the per-tenant Content tab
 * (/admin/tenants/[tenantId]/content) so that operators seed
 * only the CMS content for the specific tenant they are editing,
 * rather than triggering a global re-seed from the platform settings page.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   Both actions delegate to the platform-level seed implementations, which
 *   hold the actual Sanity / Storyblok client logic and credential resolution.
 *
 *   The `tenantId` parameter is accepted for traceability and future per-tenant
 *   scoping (e.g. loading a tenant-specific seed dataset).  Currently both
 *   implementations have a single set of seed content, so `tenantId` is not yet
 *   used to vary the seed data — that is the next evolution.
 *
 * ─── Auto nav reset ───────────────────────────────────────────────────────────
 *
 *   After a successful seed, each action automatically calls the nav reset so
 *   the `site_navigation` DB table is always rebuilt from the freshly-seeded
 *   CMS site-settings document.  This removes stale blueprint nav items written
 *   at tenant provisioning time and ensures the header shows the correct nav
 *   immediately — no manual "Reset navigation" step required.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Each action calls `getRequiredAdminSession()` independently so they cannot
 *   be invoked without an authenticated admin session, even though the delegated
 *   platform actions also authenticate.
 */

"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import {
  seedMarketingSiteAction,
  seedStoryblokSpaceAction,
} from "@/app/admin/platform/cms/actions";

// ── Statamic seed result type ──────────────────────────────────────────────────

/**
 * Result returned by `seedTenantStatamicAction`.
 *
 * Unlike the Sanity/Storyblok equivalents (which re-use the platform-level
 * action types), Statamic provisioning is wholly per-tenant: this type lives
 * here rather than in the platform actions file.
 */
export type SeedStatamicResult =
  | {
      ok:      true;
      seeded:  number;
      failed:  number;
      results: Array<{
        collection: string;
        slug:       string;
        ok:         boolean;
        error?:     string;
      }>;
    }
  | { ok: false; error: string };

// ── Sanity ─────────────────────────────────────────────────────────────────────

/**
 * Seed (or re-seed) the Sanity CMS with the marketing pages for the given
 * tenant.  Uses `createOrReplace` — safe to re-run.
 *
 * Credentials are resolved from the platform settings DB and env var fallbacks.
 * No secrets cross the server→client boundary.
 */
export async function seedTenantSanityAction(tenantId: string) {
  await getRequiredAdminSession();
  // Delegates to the platform seed — the tenantId parameter is passed through
  // for traceability and will drive per-tenant seed data selection in a future
  // iteration when multiple tenants share the same Sanity project.
  void tenantId;
  const result = await seedMarketingSiteAction();

  // Automatically rebuild the nav from the freshly-seeded CMS site-settings.
  // Best-effort: a nav reset failure does not fail the seed response.
  if (result.ok) {
    await resetTenantNavAction(tenantId).catch(() => undefined);
  }

  return result;
}

// ── Storyblok ──────────────────────────────────────────────────────────────────

/**
 * Seed (or re-seed) the Storyblok space for the given tenant.
 * Uses GET-then-PUT/POST upserts — safe to re-run.
 *
 * Credentials (Management API token + Space ID) are resolved from the platform
 * settings DB and env var fallbacks.  No secrets cross the server→client
 * boundary.
 */
export async function seedTenantStoryblokAction(tenantId: string) {
  await getRequiredAdminSession();
  void tenantId;
  const result = await seedStoryblokSpaceAction();

  // Automatically rebuild the nav from the freshly-seeded site-settings story.
  // Best-effort: a nav reset failure does not fail the seed response.
  if (result.ok) {
    await resetTenantNavAction(tenantId).catch(() => undefined);
  }

  return result;
}

// ── Statamic ───────────────────────────────────────────────────────────────────

/**
 * Seed (or re-seed) the Statamic site for the given tenant.
 *
 * Calls `StatamicProvider.provisionSite()` which POSTs starter entries
 * to the three variant collections via the custom write route in routes/api.php.
 * Idempotent — existing entries are overwritten, not duplicated.
 *
 * The base URL is resolved from the tenant's CMS settings (statamicBaseUrl)
 * or the platform-level Statamic settings if the tenant override is absent.
 * The Statamic server must be running and reachable.
 */
export async function seedTenantStatamicAction(
  tenantId: string,
): Promise<SeedStatamicResult> {
  await getRequiredAdminSession();

  const { getTenantById }          = await import("@/tenant/server");
  const { normalizeTenant }        = await import("@/tenant/normalize");
  const { createCMSProviderAsync } = await import("@/cms/providers/create-cms-provider");

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) {
    return { ok: false, error: "Tenant not found" };
  }

  const tenant   = normalizeTenant(rawTenant);
  const provider = await createCMSProviderAsync(tenant.cms, tenantId);

  const provision = await provider.provisionSite(tenant);

  if (!provision.ok) {
    return { ok: false, error: provision.error };
  }

  // Map documentIds (slugs) back to per-entry results for UI display.
  const results = provision.documentIds.map((id) => ({
    collection: "variant",
    slug:       id,
    ok:         true as const,
  }));

  // Append warning-level entries that partially failed.
  const warningResults = (provision.warnings ?? []).map((w) => ({
    collection: "variant",
    slug:       w.match(/"(.+?)" in/)?.[1] ?? "unknown",
    ok:         false as const,
    error:      w,
  }));

  const allResults = [...results, ...warningResults];

  return {
    ok:     true,
    seeded: results.length,
    failed: warningResults.length,
    results: allResults,
  };
}

// ── Navigation reset ───────────────────────────────────────────────────────────

/** Result returned to the client after a nav reset. */
export interface ResetNavResult {
  ok:      boolean;
  count:   number;
  source:  "cms" | "pages" | "none";
  error?:  string;
}

/**
 * Rebuild the `site_navigation` DB table for a tenant.
 *
 * Resolution order (highest → lowest priority):
 *
 *   1. CMS provider `getSiteSettings().mainNavigation` — used when the CMS has
 *      a site-settings document with a non-empty nav (e.g. after seeding
 *      Storyblok).  Always correct by design.
 *
 *   2. Platform DB pages (`page_store`) — used as a fallback when the CMS has
 *      no nav yet.  Blueprint placeholder slugs (services, landing, content,
 *      listing, page, components) are excluded because those pages never have
 *      real content for tenant sites.
 *
 * Calling this action after running the CMS seed (Storyblok or Sanity) will
 * pick up the CMS nav and persist it to the DB, so the header fallback shows
 * the right items even if the CDN cache is cold.
 *
 * Idempotent — safe to call multiple times.  Uses overwrite=true so stale
 * blueprint nav rows are always replaced.
 */
export async function resetTenantNavAction(
  tenantId: string,
): Promise<ResetNavResult> {
  await getRequiredAdminSession();

  try {
    const { createCMSProvider }  = await import("@/cms/providers/create-cms-provider");
    const { getTenantById }      = await import("@/tenant/server");
    const { normalizeTenant }    = await import("@/tenant/normalize");
    const { writeNavItems }      = await import("@/site/navigation-store");
    const { getPagesByTenant }   = await import("@/page-store");

    // ── 1. Try CMS nav ────────────────────────────────────────────────────────
    const rawTenant = await getTenantById(tenantId);
    if (!rawTenant) return { ok: false, count: 0, source: "none", error: "Tenant not found" };

    const tenant   = normalizeTenant(rawTenant);
    const provider = createCMSProvider(tenant.cms, tenantId);
    const settings = await provider.getSiteSettings().catch(() => null);

    if (settings?.mainNavigation && settings.mainNavigation.length > 0) {
      type NavItem = { label: string; href: string; order: number; children: NavItem[] };
      const items: NavItem[] = settings.mainNavigation.map((item, i) => ({
        label:    item.label,
        href:     item.href,
        order:    i,
        children: [],
      }));
      const written = await writeNavItems({ tenantId, items, overwrite: true });
      return { ok: true, count: written.length, source: "cms" };
    }

    // ── 2. Fall back to platform DB pages ─────────────────────────────────────
    //
    // Exclude slugs that are blueprint placeholders — these pages exist in the
    // template but have no real content on tenant sites.
    const PLACEHOLDER_SLUGS = new Set([
      "services", "landing", "content", "listing", "page", "components",
    ]);

    const pages = await getPagesByTenant(tenantId);

    const items: { label: string; href: string; order: number; children: never[] }[] = [];
    let order = 0;

    // Always include Home as the first item (logo target — omitted from
    // blueprint nav generator but most tenants expect it in the nav bar).
    items.push({ label: "Home", href: "/", order: order++, children: [] });

    for (const page of pages) {
      const slug = page.slug === "home" ? null : (page.slug ?? null);
      if (!slug) continue;
      if (PLACEHOLDER_SLUGS.has(slug)) continue;
      items.push({ label: page.title, href: `/${slug}`, order: order++, children: [] });
    }

    if (items.length === 1) {
      // Only Home — probably a fresh tenant with no additional pages.
      // Still write it so the DB reflects the correct (minimal) nav.
    }

    const written = await writeNavItems({ tenantId, items, overwrite: true });
    return { ok: true, count: written.length, source: "pages" };

  } catch (err) {
    rethrowNextInternal(err);
    return {
      ok:     false,
      count:  0,
      source: "none",
      error:  err instanceof Error ? err.message : String(err),
    };
  }
}
