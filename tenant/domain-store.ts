/**
 * Domain Store — tenant_domains table CRUD
 *
 * Server-only module that manages custom domain registrations in the
 * `tenant_domains` Supabase table.
 *
 * ─── Responsibilities ────────────────────────────────────────────────────────
 *
 *   normalizeDomain(raw)                 Strip protocol, lowercase, trim
 *   checkDomainAvailable(hostname)       Returns null if free; owning tenantId if taken
 *   listDomainsForTenant(tenantId)       All domains for a tenant
 *   getDomainByHostname(hostname)        Single row by hostname (for routing)
 *   addDomain(tenantId, hostname, opts)  Insert row
 *   updateDomainStatus(id, status, ...)  Update status / vercel metadata
 *   setPrimaryDomain(id, tenantId)       Promote to primary; clears others
 *   removeDomain(id, tenantId)           Tenant-scoped delete
 *
 * ─── Resolution model ────────────────────────────────────────────────────────
 *
 *   tenant-store.ts calls getDomainByHostname() first (O(1) index lookup),
 *   then falls back to the legacy JSONB scan for rows written before this
 *   table existed.  Both paths are transparent to the caller.
 *
 * ─── Domain status ───────────────────────────────────────────────────────────
 *
 *   pending — added but not yet verified (DNS not propagated / Vercel pending).
 *             The domain IS used for routing even while pending — the operator
 *             owns the DNS record and has claimed the hostname.
 *   active  — verified (either by Vercel or immediately when Vercel is absent).
 *   error   — verification failed; operator must re-add the domain.
 *
 * ─── SQL schema ──────────────────────────────────────────────────────────────
 *
 *   See supabase/migrations/20240101000012_create_tenant_domains.sql
 */

import "server-only";

import { getDb }                         from "@/data/db";
import type { TenantDomainRow, DomainStatus } from "@/data/types";

// ── Typed query helpers ───────────────────────────────────────────────────────
// Same workaround as data/repositories and tenant-store.ts — the hand-authored
// Database type lacks the `PostgrestVersion` discriminant, causing `.select()`
// to return `never[]` in strict mode.

type SelectResult<T> = { data: T[] | null; error: { message: string } | null };
type SingleResult<T> = { data: T | null;   error: { message: string } | null };

function asRows<T>(result: unknown): SelectResult<T>  { return result as SelectResult<T>;  }
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

// ── StoreResult ───────────────────────────────────────────────────────────────

export type DomainStoreResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Normalises a raw domain input to a canonical hostname.
 *
 * Rules applied (in order):
 *   1. Trim whitespace.
 *   2. Strip any protocol prefix (http://, https://).
 *   3. Lowercase.
 *   4. Strip a trailing slash.
 *
 * Examples:
 *   "  https://Acme.COM/  "  →  "acme.com"
 *   "staging.workengine.io"   →  "staging.workengine.io"
 *
 * @param raw  The raw user-supplied domain string.
 * @returns    Normalised hostname suitable for storage and comparison.
 */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .toLowerCase()
    .replace(/\/$/, "");
}

// ── Validation ────────────────────────────────────────────────────────────────

// Very lightweight hostname validation — rejects obvious non-domain strings.
// A valid hostname must contain at least one dot and no spaces.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/;

/**
 * Returns an error string when the hostname is structurally invalid,
 * or null when it looks like a valid hostname.
 */
function validateHostname(hostname: string): string | null {
  if (!hostname) return "Hostname must not be empty.";
  if (!hostname.includes(".")) return "Hostname must include at least one dot (e.g. acme.com).";
  if (!HOSTNAME_RE.test(hostname)) return `Hostname "${hostname}" contains invalid characters.`;
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the tenantId that has already claimed `hostname`, or null if it is
 * available.
 *
 * Used before inserting a new domain row to enforce uniqueness across tenants.
 *
 * @param hostname  Normalised hostname to check (no protocol, lowercase).
 */
export async function checkDomainAvailable(
  hostname: string,
): Promise<string | null> {
  const { data } = asSingle<{ tenant_id: string }>(
    await getDb()
      .from("tenant_domains")
      .select("tenant_id")
      .eq("hostname", hostname)
      .maybeSingle(),
  );

  return data?.tenant_id ?? null;
}

/**
 * Returns all domain rows registered for the given tenant, ordered by
 * is_primary DESC then created_at ASC so the primary domain always appears
 * first.
 *
 * Never throws — returns an empty array on database error.
 *
 * @param tenantId  The tenant slug, e.g. "workengine".
 */
export async function listDomainsForTenant(
  tenantId: string,
): Promise<TenantDomainRow[]> {
  const { data, error } = asRows<TenantDomainRow>(
    await getDb()
      .from("tenant_domains")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  );

  if (error) {
    console.error("[domain-store] listDomainsForTenant error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Fetches a single domain row by hostname.
 *
 * Used by getTenantByDomain() in tenant-store.ts for O(1) routing lookups.
 * Returns null when no row matches (hostname not registered).
 *
 * @param hostname  Normalised hostname to look up.
 */
export async function getDomainByHostname(
  hostname: string,
): Promise<TenantDomainRow | null> {
  const { data, error } = asSingle<TenantDomainRow>(
    await getDb()
      .from("tenant_domains")
      .select("*")
      .eq("hostname", hostname)
      .maybeSingle(),
  );

  if (error) {
    console.error("[domain-store] getDomainByHostname error:", error.message);
    return null;
  }

  return data ?? null;
}

/**
 * Options accepted by addDomain().
 */
export interface AddDomainOptions {
  /** Mark this domain as the tenant's primary domain. Defaults to false. */
  isPrimary?:          boolean;
  /**
   * Initial status.  Defaults to "pending" when Vercel integration is active,
   * or "active" when it is not (the platform trusts the operator's intent).
   */
  status?:             DomainStatus;
  /** Vercel domain ID returned by the Vercel Domains API. */
  vercelDomainId?:     string;
  /** Vercel DNS verification records to show the operator. */
  vercelVerification?: Record<string, unknown>;
}

/**
 * Registers a new custom domain for a tenant.
 *
 * Steps:
 *   1. Normalise the input hostname.
 *   2. Validate the hostname format.
 *   3. Check uniqueness across all tenants.
 *   4. Insert the row.
 *
 * Returns the saved TenantDomainRow on success or an error message on failure.
 *
 * @param tenantId  The tenant to register the domain for.
 * @param rawDomain The raw hostname string (protocol will be stripped, lowercased).
 * @param opts      Optional Vercel metadata and status override.
 */
export async function addDomain(
  tenantId:  string,
  rawDomain: string,
  opts:      AddDomainOptions = {},
): Promise<DomainStoreResult<TenantDomainRow>> {
  const hostname = normalizeDomain(rawDomain);

  // ── Validate ──────────────────────────────────────────────────────────────
  const validationError = validateHostname(hostname);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // ── Uniqueness check ──────────────────────────────────────────────────────
  const existingTenantId = await checkDomainAvailable(hostname);
  if (existingTenantId !== null) {
    if (existingTenantId === tenantId) {
      return { ok: false, error: `Domain "${hostname}" is already registered for this tenant.` };
    }
    return { ok: false, error: `Domain "${hostname}" is already in use by another tenant.` };
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { data, error } = asSingle<TenantDomainRow>(
    await getDb()
      .from("tenant_domains")
      .insert({
        tenant_id:           tenantId,
        hostname,
        is_primary:          opts.isPrimary          ?? false,
        status:              opts.status             ?? "active",
        vercel_domain_id:    opts.vercelDomainId     ?? null,
        vercel_verification: opts.vercelVerification ?? null,
        created_at:          now,
        updated_at:          now,
      })
      .select("*")
      .single(),
  );

  if (error) {
    // Catch UNIQUE violation in case of a race between the check and insert.
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { ok: false, error: `Domain "${hostname}" was just claimed by another tenant.` };
    }
    return { ok: false, error: `[domain-store] addDomain DB error: ${error.message}` };
  }

  if (!data) {
    return { ok: false, error: "[domain-store] addDomain: no row returned after insert." };
  }

  return { ok: true, data };
}

/**
 * Updates the status (and optionally the Vercel metadata) for an existing
 * domain row.
 *
 * Used by the Vercel webhook handler or the admin "verify" button to mark a
 * domain as active once DNS verification succeeds.
 *
 * @param id      UUID of the tenant_domains row to update.
 * @param status  New status to set.
 * @param opts    Optional Vercel metadata to update at the same time.
 */
export async function updateDomainStatus(
  id:     string,
  status: DomainStatus,
  opts: {
    vercelDomainId?:     string;
    vercelVerification?: Record<string, unknown>;
  } = {},
): Promise<DomainStoreResult<TenantDomainRow>> {
  const { data, error } = asSingle<TenantDomainRow>(
    await getDb()
      .from("tenant_domains")
      .update({
        status,
        ...(opts.vercelDomainId     !== undefined ? { vercel_domain_id:    opts.vercelDomainId     } : {}),
        ...(opts.vercelVerification !== undefined ? { vercel_verification: opts.vercelVerification } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single(),
  );

  if (error) {
    return { ok: false, error: `[domain-store] updateDomainStatus DB error: ${error.message}` };
  }

  if (!data) {
    return { ok: false, error: `[domain-store] updateDomainStatus: domain "${id}" not found.` };
  }

  return { ok: true, data };
}

/**
 * Sets a domain as the primary domain for a tenant.
 *
 * Clears is_primary on every other domain for the same tenant, then sets
 * is_primary = true on the target row.  Both steps are scoped to `tenantId`
 * so a misconfigured caller cannot affect another tenant's domains.
 *
 * The two DB updates are not wrapped in a SQL transaction (the Supabase JS
 * client does not expose transaction APIs).  The brief inconsistency between
 * the two writes is acceptable for an admin-only operation.
 *
 * @param id        UUID of the tenant_domains row to promote.
 * @param tenantId  The owning tenant (enforced in both WHERE clauses).
 */
export async function setPrimaryDomain(
  id:       string,
  tenantId: string,
): Promise<DomainStoreResult<TenantDomainRow>> {
  const db  = getDb();
  const now = new Date().toISOString();

  // Step 1 — clear is_primary on every domain for this tenant.
  const { error: clearError } = await db
    .from("tenant_domains")
    .update({ is_primary: false, updated_at: now })
    .eq("tenant_id", tenantId);

  if (clearError) {
    return {
      ok:    false,
      error: `[domain-store] setPrimaryDomain clear error: ${clearError.message}`,
    };
  }

  // Step 2 — promote the target row.
  const { data, error: setError } = asSingle<TenantDomainRow>(
    await db
      .from("tenant_domains")
      .update({ is_primary: true, updated_at: now })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single(),
  );

  if (setError) {
    return {
      ok:    false,
      error: `[domain-store] setPrimaryDomain set error: ${setError.message}`,
    };
  }

  if (!data) {
    return {
      ok:    false,
      error: `[domain-store] setPrimaryDomain: domain "${id}" not found for tenant "${tenantId}".`,
    };
  }

  return { ok: true, data };
}

/**
 * Removes a domain registration.
 *
 * The `tenantId` parameter is required as a safety guard — the delete is
 * scoped to both the row ID and the tenant, so a misconfigured caller cannot
 * accidentally delete another tenant's domain.
 *
 * @param id        UUID of the tenant_domains row to delete.
 * @param tenantId  The owning tenant (enforced in the WHERE clause).
 */
export async function removeDomain(
  id:       string,
  tenantId: string,
): Promise<DomainStoreResult<void>> {
  const { error } = await getDb()
    .from("tenant_domains")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    return { ok: false, error: `[domain-store] removeDomain DB error: ${error.message}` };
  }

  return { ok: true, data: undefined };
}
