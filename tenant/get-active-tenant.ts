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
import { getTenantByDomainCached, getTenantByIdCached, getTenantById }  from "./tenant-store";
import { readPersistedHostTenant, persistHostTenant } from "./host-resolution-cache-store";
import { DEV_TENANT_COOKIE, isTenantOverrideEnabled }  from "./dev-tenant-cookie";
import { buildTenantConfigFromSettings } from "./build-tenant-config";
import type { TenantConfig }  from "./types";

// Module-level last-known-good host → tenant resolution cache.
//
// `www.misterchameleon.nl` (and every admin-provisioned custom domain) is NOT in
// the static TENANT_REGISTRY, so it resolves via the async store lookup (step 3)
// on every request. When that lookup TRANSIENTLY returns null (cold start, a DB
// hiccup, a momentary cache miss), step 4 falls back to FALLBACK_TENANT
// (mister-chameleon) — a DIFFERENT tenant with different content/nav. That is
// exactly what makes the header/nav "flip-flop" between tenants on refresh.
//
// Once a host has resolved to a real store-based tenant we pin it here, so a
// later transient store miss serves the correct tenant instead of the fallback.
// The map only grows by distinct host, so it stays tiny.
const lastGoodTenantByHost = new Map<string, TenantConfig>();

// Known production hosts → tenantId.  These are NOT in the static TENANT_REGISTRY
// (their TenantConfig lives in the DB, not in code), so they normally resolve via
// the async store path — which can transiently miss on a cold instance right
// after a deploy and flip the whole site to FALLBACK_TENANT (mister-chameleon).
//
// This map lets such a miss resolve DETERMINISTICALLY: we already know the
// hostname maps to a specific tenantId, so we re-derive its config from the
// durable id-cache instead of falling back to a different tenant's content.
// The mapping is stable; add a host here when a production domain goes live.
const KNOWN_HOST_TENANT_IDS: Readonly<Record<string, string>> = {
  "misterchameleon.nl":     "statamic",
  "www.misterchameleon.nl": "statamic",
  "steunles.nl":            "another-statamic",
  "www.steunles.nl":        "another-statamic",
};

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

  // ── 0. Dev / preview header override ─────────────────────────────────────
  // In dev and on Vercel preview/staging, the proxy injects x-tenant-override
  // from the ?tenant= query param. This takes priority over the persistent
  // cookie so that a single URL can temporarily select any tenant without
  // mutating cookie state. Never active in production (host-based only) — see
  // isTenantOverrideEnabled().
  if (isTenantOverrideEnabled()) {
    const headerOverride = h.get("x-tenant-override")?.trim();
    if (headerOverride) {
      const override = resolveTenantById(headerOverride);
      if (override) return override;
      // Not in static registry — try the store (handles admin-provisioned tenants).
      const storedSettings = await getTenantById(headerOverride);
      if (storedSettings) return buildTenantConfigFromSettings(storedSettings);
      // Unknown tenantId — fall through to cookie/host resolution.
    }
  }

  // ── 1. Dev / preview cookie override ─────────────────────────────────────
  // In dev and on Vercel preview/staging, check the mc_dev_tenant cookie before
  // host resolution so an override set via ?tenant= persists without carrying
  // the query param in every URL. Never active in production — see
  // isTenantOverrideEnabled().
  if (isTenantOverrideEnabled()) {
    const c           = await cookies();
    const devTenantId = c.get(DEV_TENANT_COOKIE)?.value?.trim();
    if (devTenantId) {
      const override = resolveTenantById(devTenantId);
      if (override) return override;
      // Not in static registry — try the store (handles admin-provisioned tenants
      // like those onboarded via /admin/onboarding whose config isn't in the
      // static TENANT_REGISTRY yet).
      const storedSettings = await getTenantById(devTenantId);
      if (storedSettings) return buildTenantConfigFromSettings(storedSettings);
      // Truly unknown tenantId (stale cookie after tenant deletion) —
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
  const hostKey = host.toLowerCase();
  // Resilient cross-instance cached lookup: once any instance resolves this host
  // the result is shared via Next's persistent data cache, so cold instances no
  // longer fall back to FALLBACK_TENANT on a transient DB miss (the nav/header
  // flip-flop).  Returns null only on a genuine, sustained miss.
  const storedTenant = await getTenantByDomainCached(host);
  if (storedTenant) {
    // Tenant is in the store but not in the static registry (admin-onboarded).
    // Build its runtime config from the stored settings so its domain is fully
    // served on production without needing a code entry in resolve-tenant.ts.
    // This is what makes domain → tenant assignment switchable purely from the
    // DB / admin UI (tenant_domains), with no code deploy.
    const config = resolveTenantById(storedTenant.tenantId)
      ?? buildTenantConfigFromSettings(storedTenant);
    lastGoodTenantByHost.set(hostKey, config); // pin as last-known-good for this host
    // Durably persist the host → settings mapping so cold lambdas and Data-Cache
    // resets (revalidateTag on every tenant save) still resolve the correct
    // tenant instead of flipping to FALLBACK_TENANT. Fire-and-forget.
    void persistHostTenant(hostKey, storedTenant);
    return config;
  }

  // ── 3b. Transient store miss → serve the last-known-good for this host ────
  // The store lookup returned null. If this host has resolved to a real tenant
  // before, that mapping is stable (domains don't silently change), so this is
  // almost certainly a transient outage — serve the pinned tenant rather than
  // flipping the whole site to FALLBACK_TENANT (the nav/header flip-flop).
  const lastGood = lastGoodTenantByHost.get(hostKey);
  if (lastGood) return lastGood;

  // ── 3c. Durable DB last-known-good — survives cold lambdas & cache resets ──
  // The in-memory pin is empty on a freshly-started serverless instance (e.g.
  // right after a deploy), so without this a cold instance + transient store
  // miss would flip the whole site to FALLBACK_TENANT. The persisted host →
  // settings mapping is stable and always correct.
  const persisted = await readPersistedHostTenant(hostKey);
  if (persisted) {
    const config = resolveTenantById(persisted.tenantId)
      ?? buildTenantConfigFromSettings(persisted);
    lastGoodTenantByHost.set(hostKey, config);
    return config;
  }

  // ── 3d. Known production host → deterministic id-based resolution ──────────
  // For a hard-coded production domain we KNOW the tenantId, so a transient
  // domain-lookup miss must never flip it to FALLBACK_TENANT. Re-derive the
  // config from the durable id-cache (separate cache key from the domain lookup,
  // so it survives when the domain path is cold). Only if even the direct DB
  // read fails do we fall through — which is an extreme, total-outage case.
  const knownTenantId = KNOWN_HOST_TENANT_IDS[hostKey];
  if (knownTenantId) {
    const settings = (await getTenantByIdCached(knownTenantId))
      ?? (await getTenantById(knownTenantId));
    if (settings) {
      const config = resolveTenantById(knownTenantId)
        ?? buildTenantConfigFromSettings(settings);
      lastGoodTenantByHost.set(hostKey, config);
      void persistHostTenant(hostKey, settings);
      return config;
    }
  }

  // ── 4. Fallback ──────────────────────────────────────────────────────────
  return resolveTenant(host); // returns FALLBACK_TENANT for unknown hosts
}
