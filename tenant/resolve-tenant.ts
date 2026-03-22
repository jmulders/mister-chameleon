/**
 * Tenant Resolver
 *
 * Maps incoming request hostnames to TenantConfig objects.
 * This is the authoritative lookup for "which tenant is this request for?".
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *
 *   TENANT_REGISTRY is a flat map of hostname → TenantConfig.
 *   One tenant may appear under multiple hostnames (production, www, staging,
 *   localhost, etc.) — they all point to the same config object.
 *
 *   resolveTenant(hostname) does a single O(1) registry lookup and falls back
 *   to MISTER_CHAMELEON_TENANT when the hostname is not registered.
 *
 * ─── Hostname format ─────────────────────────────────────────────────────────
 *
 *   Keys must match the Host header value exactly:
 *     • No protocol   ("misterchameleon.com", not "https://misterchameleon.com")
 *     • Include port  if non-standard ("localhost:3000", not "localhost" alone
 *                     when the server runs on port 3000)
 *     • Lowercase     (Host headers are case-insensitive; normalise at lookup)
 *
 * ─── Adding a second tenant ──────────────────────────────────────────────────
 *
 *   1. Create tenant/<new-tenant>-config.ts with a TenantConfig export.
 *   2. Import it here.
 *   3. Add all its known hostnames to TENANT_REGISTRY.
 *   4. Done — no other files change.
 *
 * ─── Full resolution order (server components / route handlers) ─────────────
 *
 *   getActiveTenant() in @/tenant/get-active-tenant.ts implements the full
 *   four-step chain:
 *
 *   1. [dev only]  x-tenant-override header (injected from ?tenant= param)
 *   2. [dev only]  mc_dev_tenant cookie
 *   3. Static TENANT_REGISTRY lookup — O(1), covers all hostnames registered
 *      below.  This is the fast path for all known production domains.
 *   4. Store-based domain lookup (Supabase) — matches TenantSettings fields
 *      `primaryDomain` and `additionalDomains`.  This is the recommended
 *      production path for custom domains onboarded via the admin UI.
 *      Operators set primaryDomain / additionalDomains via /admin/onboarding
 *      without needing a code deploy or a new entry in this registry.
 *   5. FALLBACK_TENANT (MC_FALLBACK_TENANT_ID env var, defaults to
 *      mister-chameleon).
 *
 *   For optimal latency on high-traffic production domains, also add the
 *   hostname to TENANT_REGISTRY below.  Both paths are correct; the registry
 *   is purely a performance optimisation.
 *
 * ─── Integration notes ───────────────────────────────────────────────────────
 *
 *   Server Components / Route Handlers:
 *     Use getActiveTenant() from @/tenant — it reads the Host header
 *     automatically via next/headers and delegates here.
 *
 *   Middleware / Edge:
 *     Call resolveTenant(request.headers.get("host") ?? "") directly,
 *     since next/headers is not available in middleware.
 *
 *   Tests:
 *     Call resolveTenant() with any hostname string — no Next.js context needed.
 */

import { MISTER_CHAMELEON_TENANT } from "./mister-chameleon-config";
import { WORKENGINE_TENANT }       from "./workengine-config";
// ── Additional tenant imports ──────────────────────────────────────────────────
// Uncomment when the client's hostname is live and CMS credentials are ready.
// import { ACME_GROWTH_TENANT } from "./templates/acme-growth-config";
import type { TenantConfig } from "./types";

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Exhaustive map of every known hostname to its TenantConfig.
 *
 * A single TenantConfig object may be referenced by multiple keys — there is
 * no duplication of config data. New tenants are added by importing their
 * config and registering their hostnames here.
 *
 * @example Adding a second tenant
 *   import { ACME_TENANT } from "./acme-config";
 *
 *   const TENANT_REGISTRY: Readonly<Record<string, TenantConfig>> = {
 *     // Mister Chameleon
 *     "misterchameleon.com":     MISTER_CHAMELEON_TENANT,
 *     ...
 *     // Acme Corp
 *     "acme.com":                ACME_TENANT,
 *     "www.acme.com":            ACME_TENANT,
 *     "acme.staging.example.com": ACME_TENANT,
 *   };
 */
const TENANT_REGISTRY: Readonly<Record<string, TenantConfig>> = {
  // ── Mister Chameleon — production ──────────────────────────────────────────
  "misterchameleon.com": MISTER_CHAMELEON_TENANT,
  "www.misterchameleon.com": MISTER_CHAMELEON_TENANT,

  // ── Mister Chameleon — staging / preview ───────────────────────────────────
  // Uncomment and update when a staging domain is provisioned:
  // "staging.misterchameleon.com": MISTER_CHAMELEON_TENANT,

  // ── Mister Chameleon — local development ───────────────────────────────────
  localhost: MISTER_CHAMELEON_TENANT,
  "localhost:3000": MISTER_CHAMELEON_TENANT,

  // ── WorkEngine ─────────────────────────────────────────────────────────────
  "workengine.io":              WORKENGINE_TENANT,
  "www.workengine.io":          WORKENGINE_TENANT,
  "workengine.localhost":       WORKENGINE_TENANT,
  "workengine.localhost:3000":  WORKENGINE_TENANT,

  // ── Acme Growth Co. — NOT YET LIVE ──────────────────────────────────────────
  // Uncomment all three lines (and the import above) when ready to activate.
  // "acmegrowth.com":          ACME_GROWTH_TENANT,
  // "www.acmegrowth.com":      ACME_GROWTH_TENANT,
  // "acmegrowth.vercel.app":   ACME_GROWTH_TENANT,  // preview deployment
};

// ── Fallback ──────────────────────────────────────────────────────────────────

/**
 * Compute the fallback tenant returned when the incoming hostname is not in
 * TENANT_REGISTRY.
 *
 * Defaults to Mister Chameleon so that:
 *   • Vercel preview deployments (random *.vercel.app hostnames) work out of
 *     the box without any registry entry.
 *   • Misconfigured proxies or load balancers degrade gracefully rather than
 *     crashing.
 *   • Developer machines on arbitrary ports (e.g. localhost:4000) still work.
 *
 * ─── Staging / env override ───────────────────────────────────────────────────
 *
 *   Set MC_FALLBACK_TENANT_ID to a registered tenant's `tenantId` string to
 *   change the fallback at runtime without a code change.  Useful on a staging
 *   deployment where the custom domain is not yet provisioned and all traffic
 *   arrives on a *.vercel.app URL.
 *
 *   Example .env / Vercel environment variable:
 *     MC_FALLBACK_TENANT_ID=workengine
 *
 *   The value must match a `tenantId` in TENANT_REGISTRY.  If the id is not
 *   found (e.g. a typo), the default MISTER_CHAMELEON_TENANT is used and a
 *   warning is logged at module load time.
 */
function computeFallbackTenant(): TenantConfig {
  const envId = process.env.MC_FALLBACK_TENANT_ID;

  if (envId) {
    for (const config of Object.values(TENANT_REGISTRY)) {
      if (config.tenantId === envId) return config;
    }
    // Warn at module load time so misconfigured staging environments are
    // immediately visible in build logs / function logs.
    console.warn(
      `[tenant] MC_FALLBACK_TENANT_ID="${envId}" does not match any tenant in ` +
      `TENANT_REGISTRY. Falling back to MISTER_CHAMELEON_TENANT. ` +
      `Check that the tenantId is spelled correctly and the tenant config is ` +
      `imported and registered in resolve-tenant.ts.`,
    );
  }

  return MISTER_CHAMELEON_TENANT;
}

const FALLBACK_TENANT: TenantConfig = computeFallbackTenant();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the TenantConfig for the given hostname.
 *
 * The lookup is case-insensitive — the hostname is lower-cased before the
 * registry lookup so that "Localhost:3000" and "localhost:3000" both resolve
 * correctly.
 *
 * Falls back to FALLBACK_TENANT (Mister Chameleon) for any hostname that is
 * not registered.
 *
 * @param hostname  The Host header value — no protocol, may include port.
 *                  Examples: "misterchameleon.com", "localhost:3000"
 *
 * @example
 *   // In middleware (no next/headers):
 *   const tenant = resolveTenant(request.headers.get("host") ?? "");
 *
 *   // In tests:
 *   const tenant = resolveTenant("misterchameleon.com");
 *   expect(tenant.tenantId).toBe("mister-chameleon");
 */
export function resolveTenant(hostname: string): TenantConfig {
  const normalised = hostname.toLowerCase();
  return TENANT_REGISTRY[normalised] ?? FALLBACK_TENANT;
}

/**
 * Returns the TenantConfig for the given hostname, or null if the hostname is
 * not in the static registry.  Unlike `resolveTenant()`, this function does NOT
 * fall back to FALLBACK_TENANT — callers can distinguish a registry hit from a
 * miss and implement their own fallback logic (e.g. a store-based lookup).
 *
 * @param hostname  The Host header value — no protocol, may include port.
 *
 * @example
 *   const config = resolveTenantOrNull("acme.com");
 *   if (config) { ... } else { // fall through to store lookup }
 */
export function resolveTenantOrNull(hostname: string): TenantConfig | null {
  const normalised = hostname.toLowerCase();
  return TENANT_REGISTRY[normalised] ?? null;
}

/**
 * Searches the tenant registry for a TenantConfig whose `tenantId` property
 * matches the given string.  Returns null if no registered tenant has that id.
 *
 * ─── When to use this ─────────────────────────────────────────────────────────
 *
 *   Production request routing always uses resolveTenant(hostname) — that is
 *   the authoritative path and must not change.
 *
 *   This function is intended for development-time tooling only, specifically
 *   the ?tenant= query-param override that lets a developer preview any
 *   registered tenant from localhost without changing the Host header.
 *
 *   Do NOT use this function in production request-handling code.
 *
 * ─── Deduplication note ───────────────────────────────────────────────────────
 *
 *   The same TenantConfig object may be referenced by multiple hostnames.
 *   The loop returns on first match — duplicates are harmless since they all
 *   point to the same object reference.
 *
 * @param tenantId  The `tenantId` string to look up, e.g. "workengine".
 * @returns  The matching TenantConfig, or null if not found.
 *
 * @example
 *   const config = resolveTenantById("workengine");
 *   // → WORKENGINE_TENANT, or null if "workengine" is not in the registry
 */
export function resolveTenantById(tenantId: string): TenantConfig | null {
  for (const config of Object.values(TENANT_REGISTRY)) {
    if (config.tenantId === tenantId) return config;
  }
  return null;
}
