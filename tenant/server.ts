/**
 * Tenant Module — Server-only API
 *
 * Extends the client-safe "@/tenant" barrel with exports that require a Node.js
 * server context (file-system access, Next.js request headers).
 *
 * Import from "@/tenant/server" in:
 *   - Server Components
 *   - Route Handlers
 *   - Server Actions
 *
 * Never import from "@/tenant/server" in:
 *   - Client Components ("use client")
 *   - Edge Runtime code
 *   - Middleware
 *   - Tests that run in a browser-like environment
 *
 * The `import "server-only"` guard below makes Next.js throw a build-time
 * error if this module is accidentally included in a client bundle.
 *
 * ─── What this module adds on top of "@/tenant" ───────────────────────────────
 *
 *   Store (fs/promises-backed JSON CRUD)
 *     validateTenantSettings(raw)  — runtime shape check, returns TenantSettings
 *     getAllTenants()              — array of all TenantSettings records
 *     getTenantById(id)            — single record or null
 *     getTenantByDomain(hostname)  — lookup by primaryDomain / additionalDomains
 *     getTenantBySlug(slug)        — lookup by slug field
 *     saveTenant(settings)         — upsert
 *     createTenant(settings)       — insert (errors if id already exists)
 *     StoreResult<T>               — { ok: true; data: T } | { ok: false; error: string }
 *
 *   Next.js request helper
 *     getActiveTenant()            — reads Host header via next/headers,
 *                                    delegates to resolveTenant()
 */

import "server-only";

// ── Re-export the entire client-safe barrel ───────────────────────────────────
// Server files can use a single import source for all tenant symbols.
export * from "./index";

// ── Tenant store (Supabase-backed) ────────────────────────────────────────────
export {
  validateTenantSettings,
  getAllTenants,
  getTenantById,
  getTenantBySiteKey,
  getTenantByDomain,
  getTenantBySlug,
  saveTenant,
  createTenant,
  getTenantPipelineStages,
} from "./tenant-store";
export type { StoreResult } from "./tenant-store";

// ── Next.js request-context helper ───────────────────────────────────────────
export { getActiveTenant } from "./get-active-tenant";

// ── Dev-only tenant override (development builds only) ────────────────────────
export { getActiveTenantWithDevOverride } from "./dev-override";
export type { ActiveTenantResult }       from "./dev-override";
