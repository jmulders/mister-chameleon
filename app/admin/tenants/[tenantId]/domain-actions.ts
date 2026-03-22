/**
 * Domain Management Server Actions
 *
 * Thin server-side glue between the TenantDomainsPanel client component and
 * the domain-store / vercel-domains modules.
 *
 * ─── Actions ─────────────────────────────────────────────────────────────────
 *
 *   addDomainAction(tenantId, rawDomain)
 *     Normalise → check uniqueness → optionally register with Vercel →
 *     insert row (status pending or active) → revalidate page.
 *
 *   removeDomainAction(id, tenantId)
 *     Optionally remove from Vercel (non-fatal) → delete DB row → revalidate.
 *
 *   setPrimaryDomainAction(id, tenantId)
 *     Promote row to is_primary=true; clears others for same tenant.
 *
 *   checkDomainAction(id, tenantId)
 *     Ask Vercel for current verification status; if verified, flip DB status
 *     to "active". Returns updated row + current verification records.
 *
 *   listDomainsAction(tenantId)
 *     Convenience re-fetch used by the panel after mutations.
 */

"use server";

import { revalidatePath }                from "next/cache";
import {
  normalizeDomain,
  checkDomainAvailable,
  addDomain,
  removeDomain,
  listDomainsForTenant,
  setPrimaryDomain,
  updateDomainStatus,
}                                        from "@/tenant/domain-store";
import {
  isVercelConfigured,
  addVercelDomain,
  removeVercelDomain,
  checkVercelDomain,
}                                        from "@/lib/vercel-domains";
import type { TenantDomainRow }          from "@/data/types";

// ── Result types ─────────────────────────────────────────────────────────────

/** DNS records the operator must configure at their registrar. */
export interface DnsRecord {
  type:   "A" | "CNAME" | "TXT";
  name:   string;   // "@" for apex, "www" for subdomain, "_vercel" for TXT
  value:  string;
  ttl?:   string;
}

export type AddDomainActionResult =
  | {
      ok:           true;
      domain:       TenantDomainRow;
      /** True when domain is immediately active (no Vercel verification needed). */
      immediate:    boolean;
      /** DNS records the operator should set at their registrar. */
      dnsRecords:   DnsRecord[];
      /** Vercel verification TXT records (in addition to routing records). */
      verification: Array<{ type: string; domain: string; value: string; reason: string }>;
      warnings:     string[];
    }
  | { ok: false; error: string };

export type RemoveDomainActionResult =
  | { ok: true;  warnings: string[] }
  | { ok: false; error: string };

export type SetPrimaryDomainActionResult =
  | { ok: true;  domain: TenantDomainRow }
  | { ok: false; error: string };

export type CheckDomainActionResult =
  | {
      ok:           true;
      domain:       TenantDomainRow;
      verified:     boolean;
      verification: Array<{ type: string; domain: string; value: string; reason: string }>;
    }
  | { ok: false; error: string };

export type ListDomainsActionResult =
  | { ok: true;  domains: TenantDomainRow[] }
  | { ok: false; error: string };

// ── DNS record helpers ────────────────────────────────────────────────────────

/**
 * Returns the static DNS routing records the operator must configure.
 *
 * - Apex domain (e.g. "acme.com", parts ≤ 2):
 *     A  @  76.76.21.21
 *
 * - Subdomain (e.g. "www.acme.com", "app.acme.com"):
 *     CNAME  <subdomain-label>  cname.vercel-dns.com
 *
 * The Vercel-specific TXT verification records are separate and come from
 * the Vercel API response — they are surfaced alongside these records.
 */
function buildDnsRecords(hostname: string): DnsRecord[] {
  const parts = hostname.split(".");

  // Apex: hostname has no subdomain label (e.g. "acme.com" → 2 parts,
  // "acme.co.uk" → 3 parts with a 2-part TLD — keep it simple and check
  // for common TLD patterns; treat <= 2 parts as apex in all cases).
  const isApex = parts.length <= 2;

  if (isApex) {
    return [
      { type: "A", name: "@", value: "76.76.21.21", ttl: "3600" },
    ];
  }

  // Subdomain — use CNAME.
  const subdomain = parts[0];
  return [
    { type: "CNAME", name: subdomain, value: "cname.vercel-dns.com", ttl: "3600" },
  ];
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Adds a custom domain for a tenant.
 *
 * 1. Normalise and validate the hostname.
 * 2. Check uniqueness across all tenants.
 * 3. If Vercel is configured: register the domain; set status=pending with
 *    verification records.  If already verified on Vercel: status=active.
 * 4. If Vercel is NOT configured: insert directly as status=active.
 * 5. First domain for the tenant is automatically set as primary.
 * 6. Return DNS routing records (for the operator to configure at their registrar)
 *    + any Vercel TXT verification records.
 */
export async function addDomainAction(
  tenantId:  string,
  rawDomain: string,
): Promise<AddDomainActionResult> {
  if (!tenantId?.trim() || !rawDomain?.trim()) {
    return { ok: false, error: "tenantId and domain are required." };
  }

  const hostname = normalizeDomain(rawDomain);
  const warnings: string[] = [];

  // ── Uniqueness pre-check ─────────────────────────────────────────────────
  const existingOwner = await checkDomainAvailable(hostname);
  if (existingOwner !== null) {
    if (existingOwner === tenantId) {
      return { ok: false, error: `"${hostname}" is already registered for this tenant.` };
    }
    return { ok: false, error: `"${hostname}" is already claimed by another tenant.` };
  }

  // ── Vercel registration (optional) ───────────────────────────────────────
  let vercelDomainId:     string | undefined;
  let vercelVerification: Array<{ type: string; domain: string; value: string; reason: string }> = [];
  let domainStatus:       "pending" | "active" = "active";

  if (isVercelConfigured()) {
    const vercelResult = await addVercelDomain(hostname);

    if (!vercelResult.ok) {
      // Vercel call failed — save as active anyway, log warning.
      warnings.push(`Vercel domain registration failed: ${vercelResult.error}. Domain saved as active.`);
    } else {
      vercelDomainId     = vercelResult.vercelDomainId;
      vercelVerification = vercelResult.verification;
      domainStatus       = vercelResult.alreadyVerified ? "active" : "pending";
    }
  }

  // ── Determine if this should be the primary domain ───────────────────────
  const existing  = await listDomainsForTenant(tenantId);
  const isPrimary = existing.length === 0;

  // ── Insert row ───────────────────────────────────────────────────────────
  const result = await addDomain(tenantId, hostname, {
    isPrimary,
    status:             domainStatus,
    vercelDomainId,
    vercelVerification: vercelVerification.length > 0
      ? { records: vercelVerification }
      : undefined,
  });

  if (!result.ok) return result;

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return {
    ok:           true,
    domain:       result.data,
    immediate:    domainStatus === "active",
    dnsRecords:   buildDnsRecords(hostname),
    verification: vercelVerification,
    warnings,
  };
}

/**
 * Removes a custom domain registration.
 *
 * Optionally removes the domain from the Vercel project (non-fatal on error).
 * Always deletes the DB row regardless of Vercel outcome.
 */
export async function removeDomainAction(
  id:       string,
  tenantId: string,
): Promise<RemoveDomainActionResult> {
  if (!id?.trim() || !tenantId?.trim()) {
    return { ok: false, error: "id and tenantId are required." };
  }

  const warnings: string[] = [];

  // Fetch the row so we have the hostname for Vercel cleanup.
  const domains = await listDomainsForTenant(tenantId);
  const row     = domains.find((d) => d.id === id);

  if (!row) {
    return { ok: false, error: `Domain "${id}" not found for tenant "${tenantId}".` };
  }

  // ── Vercel cleanup (non-fatal) ────────────────────────────────────────────
  if (isVercelConfigured()) {
    const vercelResult = await removeVercelDomain(row.hostname);
    if (!vercelResult.ok) {
      warnings.push(`Vercel cleanup warning (non-fatal): ${vercelResult.error}`);
    }
  }

  // ── Delete DB row ─────────────────────────────────────────────────────────
  const result = await removeDomain(id, tenantId);
  if (!result.ok) return result;

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return { ok: true, warnings };
}

/**
 * Promotes a domain to is_primary=true for a tenant.
 *
 * Clears is_primary on all other domains for the same tenant.
 * Scoped to tenantId so a misconfigured call cannot affect other tenants.
 */
export async function setPrimaryDomainAction(
  id:       string,
  tenantId: string,
): Promise<SetPrimaryDomainActionResult> {
  if (!id?.trim() || !tenantId?.trim()) {
    return { ok: false, error: "id and tenantId are required." };
  }

  const result = await setPrimaryDomain(id, tenantId);
  if (!result.ok) return result;

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return { ok: true, domain: result.data };
}

/**
 * Checks the current Vercel verification status of a domain.
 *
 * If Vercel reports the domain as verified, the DB row is updated to
 * status="active".  Returns the (possibly updated) domain row so the
 * client can optimistically refresh without a separate list fetch.
 *
 * When Vercel integration is not configured, returns an error — there is
 * nothing to check without credentials.
 */
export async function checkDomainAction(
  id:       string,
  tenantId: string,
): Promise<CheckDomainActionResult> {
  if (!id?.trim() || !tenantId?.trim()) {
    return { ok: false, error: "id and tenantId are required." };
  }

  // Fetch the row so we have the hostname.
  const domains = await listDomainsForTenant(tenantId);
  const row     = domains.find((d) => d.id === id);

  if (!row) {
    return { ok: false, error: `Domain "${id}" not found for tenant "${tenantId}".` };
  }

  if (!isVercelConfigured()) {
    // Not using Vercel — domain is already active by default; nothing to check.
    return {
      ok:           true,
      domain:       row,
      verified:     row.status === "active",
      verification: [],
    };
  }

  // ── Ask Vercel ────────────────────────────────────────────────────────────
  const checkResult = await checkVercelDomain(row.hostname);
  if (!checkResult.ok) {
    return { ok: false, error: checkResult.error };
  }

  // ── Update DB status if now verified ─────────────────────────────────────
  let updatedRow = row;
  if (checkResult.verified && row.status !== "active") {
    const updateResult = await updateDomainStatus(id, "active", {
      // Clear outdated verification records now that it's verified.
      vercelVerification: undefined,
    });
    if (updateResult.ok) {
      updatedRow = updateResult.data;
    }
  } else if (!checkResult.verified && row.status === "active") {
    // Vercel says not verified but we had it as active — flip back to pending.
    const updateResult = await updateDomainStatus(id, "pending", {
      vercelVerification: checkResult.verification.length > 0
        ? { records: checkResult.verification }
        : undefined,
    });
    if (updateResult.ok) updatedRow = updateResult.data;
  }

  if (checkResult.verified || row.status !== updatedRow.status) {
    revalidatePath(`/admin/tenants/${tenantId}`);
  }

  return {
    ok:           true,
    domain:       updatedRow,
    verified:     checkResult.verified,
    verification: checkResult.verification,
  };
}

/**
 * Fetches the current domain list for a tenant.
 * Used by the panel to refresh after mutations.
 */
export async function listDomainsAction(
  tenantId: string,
): Promise<ListDomainsActionResult> {
  if (!tenantId?.trim()) {
    return { ok: false, error: "tenantId is required." };
  }

  try {
    const domains = await listDomainsForTenant(tenantId);
    return { ok: true, domains };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to load domains: ${message}` };
  }
}
