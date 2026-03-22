/**
 * Active Tenant — Next.js Request-Aware Helper
 *
 * Convenience wrapper around resolveTenant() that reads the Host header
 * automatically from the current Next.js request context.
 *
 * ─── When to use this vs. resolveTenant() directly ──────────────────────────
 *
 *   getActiveTenant()     — use in Server Components, Route Handlers, and
 *                           Server Actions. Requires Next.js request context
 *                           (next/headers must be available).
 *
 *   resolveTenant(host)   — use in middleware, Edge Runtime code, and tests
 *                           where next/headers is unavailable. Pass the host
 *                           string yourself.
 *
 * ─── Why this is async ───────────────────────────────────────────────────────
 *
 *   next/headers().get() returns a Promise in Next.js 15+. This wrapper is
 *   async so callers can simply `await getActiveTenant()` without worrying
 *   about the Next.js version difference.
 *
 * ─── Dev tenant cookie override ──────────────────────────────────────────────
 *
 *   In development, if the mc_dev_tenant cookie is set (written by the admin
 *   page via setDevTenantAction), its value is used to resolve the tenant
 *   before falling through to host-based resolution.  This lets a developer
 *   set a tenant once and have it persist across all navigation without
 *   carrying ?tenant= in every URL.
 *
 *   The ?tenant= query param takes even higher priority — it is applied on top
 *   of this in getActiveTenantWithDevOverride() (tenant/dev-override.ts).
 *
 *   The NODE_ENV guard is a compile-time constant in Next.js — the dev branch
 *   is dead-code-eliminated in production bundles.
 *
 * ─── Resolution order ────────────────────────────────────────────────────────
 *
 *   0. [dev only] x-tenant-override header — injected by middleware from ?tenant=
 *                 Takes highest priority so a single URL param can override
 *                 any persistent cookie without mutating state.
 *   1. [dev only] mc_dev_tenant cookie  — persistent dev override
 *   2. Static TENANT_REGISTRY           — O(1) hostname lookup (sync)
 *   3. Store-based domain lookup        — matches primaryDomain / additionalDomains
 *                                         stored in TenantSettings (async I/O)
 *   4. FALLBACK_TENANT                  — Mister Chameleon default
 *
 *   Steps 1 and 2 handle the vast majority of requests with zero I/O.  Step 3
 *   only runs for hostnames not in the static registry, enabling admin-
 *   provisioned tenants (onboarded via /admin/onboarding) to be routed by
 *   domain without a code deploy.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   No per-request memoisation is applied here — Next.js caches the headers()
 *   call internally within a single request. If you need to call this many
 *   times in one render tree, wrap the result in React.cache() at the
 *   call-site.
 *
 * @example
 *   // Server Component
 *   import { getActiveTenant } from "@/tenant";
 *
 *   export default async function Layout() {
 *     const tenant = await getActiveTenant();
 *     return <html lang="en" data-tenant={tenant.tenantId}>...</html>;
 *   }
 *
 * @example
 *   // Route Handler
 *   import { getActiveTenant } from "@/tenant";
 *
 *   export async function GET() {
 *     const tenant = await getActiveTenant();
 *     return Response.json({ tenant: tenant.tenantId });
 *   }
 */

import { headers, cookies }  from "next/headers";
import { resolveTenant, resolveTenantOrNull, resolveTenantById } from "./resolve-tenant";
import { getTenantByDomain }  from "./tenant-store";
import { DEV_TENANT_COOKIE }  from "./dev-tenant-cookie";
import type { TenantConfig }  from "./types";

/**
 * Returns the TenantConfig for the current request.
 *
 * Full resolution order:
 *   0. [dev only] x-tenant-override header — injected by middleware from ?tenant=
 *   1. [dev only] mc_dev_tenant cookie  — persistent dev override
 *   2. Static TENANT_REGISTRY           — fast O(1) hostname lookup
 *   3. Store-based domain lookup        — matches primaryDomain / additionalDomains
 *   4. FALLBACK_TENANT                  — safe default (Mister Chameleon)
 *
 * Must only be called in Server Components, Route Handlers, or Server Actions
 * (i.e. contexts where next/headers is available).
 */
export async function getActiveTenant(): Promise<TenantConfig> {
  const h    = await headers();
  const host = h.get("host") ?? "";

  // ── 0. Dev header override ───────────────────────────────────────────────
  // In development, the middleware injects x-tenant-override from the ?tenant=
  // query param.  This takes priority over the persistent cookie so that a
  // single URL can temporarily select any tenant without mutating cookie state.
  // Dead-code-eliminated in production (NODE_ENV is a compile-time constant).
  if (process.env.NODE_ENV === "development") {
    const headerOverride = h.get("x-tenant-override")?.trim();
    if (headerOverride) {
      const override = resolveTenantById(headerOverride);
      if (override) return override;
      // Unknown tenantId in header — fall through to cookie/host resolution.
    }
  }

  // ── 1. Dev cookie override ───────────────────────────────────────────────
  // In development, check the mc_dev_tenant cookie before host resolution so
  // the override set from /admin/tenants/[id] persists without ?tenant= in URLs.
  // Dead-code-eliminated in production (NODE_ENV is a compile-time constant).
  if (process.env.NODE_ENV === "development") {
    const c           = await cookies();
    const devTenantId = c.get(DEV_TENANT_COOKIE)?.value?.trim();
    if (devTenantId) {
      const override = resolveTenantById(devTenantId);
      if (override) return override;
      // Unknown tenantId in cookie (stale entry after registry change) —
      // fall through to host-based resolution rather than erroring out.
    }
  }

  // ── 2. Static registry (O(1), sync, covers most production requests) ─────
  const staticMatch = resolveTenantOrNull(host);
  if (staticMatch) return staticMatch;

  // ── 3. Store-based domain lookup (async — admin-provisioned tenants) ──────
  // Only reached for hostnames not in the static registry.  Reads the JSON
  // store and matches primaryDomain / additionalDomains against the host.
  // If a settings match is found, we use the stored tenantId to look up the
  // TenantConfig (so the full runtime config is returned, not just settings).
  const storedTenant = await getTenantByDomain(host);
  if (storedTenant) {
    const configFromRegistry = resolveTenantById(storedTenant.tenantId);
    if (configFromRegistry) return configFromRegistry;
    // Tenant is in the store but not in the static registry — this means it
    // was onboarded via admin but not yet backed by a TenantConfig.  Fall
    // through to FALLBACK_TENANT rather than erroring; the operator should
    // add the tenant config to resolve-tenant.ts to fully activate routing.
  }

  // ── 4. Fallback ──────────────────────────────────────────────────────────
  return resolveTenant(host); // returns FALLBACK_TENANT for unknown hosts
}
