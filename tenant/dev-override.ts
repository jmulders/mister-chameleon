/**
 * Dev-only tenant override utility
 *
 * Shared helper used by the homepage and any dashboard page that resolves
 * the active tenant, so the `?tenant=<id>` development override is applied
 * consistently across all tenant-scoped routes.
 *
 * In production Next.js builds, `process.env.NODE_ENV === "development"` is a
 * compile-time constant — the entire override branch is dead-code-eliminated
 * and no trace of the override logic ships to production.
 *
 * ─── Resolution order (development only) ────────────────────────────────────
 *
 *   1. ?tenant= query param  — highest priority; one-request override.
 *      getActiveTenantWithDevOverride() applies this on top of everything.
 *
 *   2. mc_dev_tenant cookie  — persistent override; set from the admin page.
 *      getActiveTenant() applies this before host resolution (see
 *      tenant/get-active-tenant.ts).
 *
 *   3. Host header           — standard registry lookup; always the fallback.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In a Server Component page:
 *   const { tenantConfig, devTenantOverride, devOverrideSource } =
 *     await getActiveTenantWithDevOverride(params, "dashboard/tenant");
 *
 *   // Show a banner when override is active:
 *   {devTenantOverride && (
 *     <DevOverrideBanner tenantId={devTenantOverride} source={devOverrideSource} />
 *   )}
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   The override is silently ignored in production regardless of query params.
 *   It only resolves tenants that are registered in TENANT_REGISTRY — unknown
 *   ids produce a warning log and fall back to the host-resolved tenant.
 *
 * Never import this module in client components — it calls getActiveTenant()
 * which reads Next.js request headers (server-only context).
 */

import "server-only";

import { cookies }           from "next/headers";
import { getActiveTenant }   from "./get-active-tenant";
import { resolveTenantById } from "./resolve-tenant";
import { DEV_TENANT_COOKIE } from "./dev-tenant-cookie";
import { logger }            from "@/lib/logger";
import type { TenantConfig } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveTenantResult {
  /** Resolved TenantConfig — may differ from host-resolved in development. */
  readonly tenantConfig:      TenantConfig;
  /**
   * Non-null only in development when an override is active and resolved
   * to a known registry entry.  Use this to render a dev override banner.
   */
  readonly devTenantOverride: string | null;
  /**
   * How the override was applied (development only).
   *
   *   "query-param" — ?tenant= was present and took highest priority.
   *   "cookie"      — mc_dev_tenant cookie was the active override source.
   *   null          — no override active; tenant resolved from Host header.
   */
  readonly devOverrideSource: "query-param" | "cookie" | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Resolves the active tenant config, applying development-only overrides
 * when present.
 *
 * Resolution order (development only):
 *   1. ?tenant= query param   (highest — passed as searchParams)
 *   2. mc_dev_tenant cookie   (applied by getActiveTenant() below)
 *   3. Host header            (standard fallback)
 *
 * @param searchParams  Raw search-params object from `await searchParams`.
 * @param context       Short label used in log warnings, e.g. "dashboard/tenant".
 */
export async function getActiveTenantWithDevOverride(
  searchParams: Record<string, string | string[] | undefined>,
  context = "dashboard",
): Promise<ActiveTenantResult> {
  // getActiveTenant() already applies the cookie override in dev, so the
  // returned config may already differ from the host-resolved default.
  let tenantConfig      = await getActiveTenant();
  let devTenantOverride: string | null = null;
  let devOverrideSource: "query-param" | "cookie" | null = null;

  if (process.env.NODE_ENV === "development") {
    // ── ?tenant= query param (highest priority) ────────────────────────────
    // Lets a developer make a per-request override without touching the cookie.
    const paramId = typeof searchParams.tenant === "string"
      ? searchParams.tenant.trim()
      : null;

    if (paramId) {
      const overrideConfig = resolveTenantById(paramId);
      if (overrideConfig) {
        tenantConfig      = overrideConfig;
        devTenantOverride = paramId;
        devOverrideSource = "query-param";
      } else {
        logger.warn(`[${context}] Dev tenant override ignored — unknown tenantId`, { overrideId: paramId });
      }
    } else {
      // ── Cookie (second priority) ─────────────────────────────────────────
      // getActiveTenant() already applied the cookie to tenantConfig above.
      // Re-read the cookie here only to populate devTenantOverride / source.
      const c          = await cookies();
      const cookieId   = c.get(DEV_TENANT_COOKIE)?.value?.trim() ?? null;
      if (cookieId && resolveTenantById(cookieId)) {
        devTenantOverride = cookieId;
        devOverrideSource = "cookie";
        // tenantConfig is already correct — getActiveTenant() applied it.
      }
    }
  }

  return { tenantConfig, devTenantOverride, devOverrideSource };
}
