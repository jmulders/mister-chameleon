/**
 * Vercel Domains API Integration (optional)
 *
 * Server-only wrapper around the Vercel Domains API. Enables custom domains
 * added via the admin UI to be registered on the Vercel project automatically,
 * and allows operators to check verification status without leaving the admin.
 *
 * ─── Activation ──────────────────────────────────────────────────────────────
 *
 *   Requires both VERCEL_API_TOKEN and VERCEL_PROJECT_ID to be set.
 *   VERCEL_TEAM_ID is additionally required for team-scoped tokens.
 *
 *   When either required variable is absent, `isVercelConfigured()` returns
 *   false and every helper returns a safe "unconfigured" result without
 *   making any network calls.
 *
 * ─── Status semantics ────────────────────────────────────────────────────────
 *
 *   Vercel configured + domain added:
 *     status = "pending" until Vercel confirms DNS verification.
 *     vercel_verification carries the CNAME/TXT records to configure.
 *
 *   Vercel not configured:
 *     status = "active" immediately (platform trusts operator intent).
 *     No verification records are generated.
 *
 * ─── DNS reference ───────────────────────────────────────────────────────────
 *
 *   Apex domain (e.g. acme.com):
 *     A     @   76.76.21.21
 *
 *   Subdomain (e.g. www.acme.com):
 *     CNAME www cname.vercel-dns.com
 *
 *   Vercel may additionally require a TXT record for domain ownership
 *   verification — surface `verification` records to the operator.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   VERCEL_API_TOKEN is a bearer token — never logged or returned to clients.
 *   This file imports "server-only" to prevent bundling into client JS.
 */

import "server-only";

import { extractVercelCname } from "./vercel-cname";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single DNS verification record returned by Vercel. */
export interface VercelVerificationRecord {
  /** Record type: "TXT" or "CNAME" */
  type:   string;
  /** The hostname to set the record on, e.g. "_vercel.acme.com" */
  domain: string;
  /** The record value to configure at the DNS provider */
  value:  string;
  /** Human-readable reason this record is needed */
  reason: string;
}

/** Successful result of adding a domain to Vercel. */
export interface VercelAddDomainResult {
  ok:              true;
  vercelDomainId:  string;
  verification:    VercelVerificationRecord[];
  /** True when Vercel already considers the domain verified (no DNS action needed). */
  alreadyVerified: boolean;
}

/** Successful result of checking a domain's Vercel status. */
export interface VercelCheckDomainResult {
  ok:           true;
  verified:     boolean;
  verification: VercelVerificationRecord[];
}

/** Successful result of reading a domain's recommended DNS config. */
export interface VercelCnameResult {
  ok:    true;
  /** The project-specific CNAME target Vercel recommends (e.g.
   *  "xxxxxxxx.vercel-dns-017.com"), or null when Vercel returned none. */
  cname: string | null;
}

/** Failed result (network error, Vercel API error, or not configured). */
export interface VercelErrorResult {
  ok:    false;
  error: string;
}

export type VercelDomainResult      = VercelAddDomainResult  | VercelErrorResult;
export type VercelCheckResult       = VercelCheckDomainResult | VercelErrorResult;
export type VercelCnameLookupResult = VercelCnameResult       | VercelErrorResult;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns the Vercel API bearer token. Tries both common env var names. */
function getToken(): string | undefined {
  return process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || undefined;
}

/** Returns the Vercel project ID. */
function getProjectId(): string | undefined {
  return process.env.VERCEL_PROJECT_ID || undefined;
}

/** Returns the team ID query param fragment, or empty string when absent. */
function teamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

/** Appends teamId as a query param to an existing URL (which may already have params). */
function withTeam(url: string): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}teamId=${encodeURIComponent(teamId)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true when both VERCEL_API_TOKEN and VERCEL_PROJECT_ID are present.
 */
export function isVercelConfigured(): boolean {
  return !!(getToken() && getProjectId());
}

/**
 * Registers a custom domain on the Vercel project.
 *
 * POST /v10/projects/{projectId}/domains[?teamId=…]
 *
 * Returns:
 *   ok: true  — domain registered; `verification` carries DNS records to configure.
 *               `alreadyVerified` is true when Vercel considers DNS already done.
 *   ok: false — API error, network failure, or Vercel integration not configured.
 *
 * When the domain is already registered on this project, returns ok:true with
 * alreadyVerified:true (idempotent).
 *
 * @param hostname  Normalised hostname, e.g. "acme.com" (no protocol).
 */
export async function addVercelDomain(
  hostname: string,
): Promise<VercelDomainResult> {
  const token     = getToken();
  const projectId = getProjectId();

  if (!token || !projectId) {
    return { ok: false, error: "Vercel integration not configured" };
  }

  try {
    const url  = withTeam(`https://api.vercel.com/v10/projects/${projectId}/domains`);
    const resp = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: hostname }),
    });

    const body = await resp.json() as Record<string, unknown>;

    if (!resp.ok) {
      const err     = body.error as Record<string, unknown> | undefined;
      const code    = err?.code    as string | undefined;
      const message = err?.message as string | undefined;

      // Domain already on this project — idempotent success.
      if (code === "domain_already_in_use" || code === "domain_already_exists") {
        return { ok: true, vercelDomainId: hostname, verification: [], alreadyVerified: true };
      }

      return { ok: false, error: message ?? `Vercel API error ${resp.status}` };
    }

    const vercelDomainId  = (body.id ?? body.name ?? hostname) as string;
    const verifiedRaw     = body.verified      as boolean                    | undefined;
    const verificationRaw = body.verification  as VercelVerificationRecord[] | undefined;
    const verification    = verificationRaw ?? [];

    return {
      ok:              true,
      vercelDomainId,
      verification,
      alreadyVerified: verifiedRaw === true || verification.length === 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Vercel API request failed: ${message}` };
  }
}

/**
 * Checks the current verification status of a domain on the Vercel project.
 *
 * GET /v9/projects/{projectId}/domains/{hostname}[?teamId=…]
 *
 * Returns:
 *   ok: true  — `verified` reflects current Vercel status.
 *               `verification` carries any outstanding DNS records.
 *   ok: false — domain not found on Vercel, API error, or not configured.
 *
 * Use this to refresh a "pending" domain after the operator has updated DNS.
 *
 * @param hostname  Normalised hostname to check.
 */
export async function checkVercelDomain(
  hostname: string,
): Promise<VercelCheckResult> {
  const token     = getToken();
  const projectId = getProjectId();

  if (!token || !projectId) {
    return { ok: false, error: "Vercel integration not configured" };
  }

  try {
    const url  = withTeam(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    );
    const resp = await fetch(url, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const body    = await resp.json().catch(() => ({})) as Record<string, unknown>;
      const err     = body.error as Record<string, unknown> | undefined;
      const message = err?.message as string | undefined;

      if (resp.status === 404) {
        return { ok: false, error: `Domain "${hostname}" is not registered on this Vercel project.` };
      }
      return { ok: false, error: message ?? `Vercel API error ${resp.status}` };
    }

    const body        = await resp.json() as Record<string, unknown>;
    const verified    = (body.verified     as boolean                    | undefined) ?? false;
    const verification = (body.verification as VercelVerificationRecord[] | undefined) ?? [];

    return { ok: true, verified, verification };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Vercel API request failed: ${message}` };
  }
}

/**
 * Reads the DNS config Vercel recommends for a domain and returns the CNAME
 * target the operator must point their subdomain at.
 *
 * GET /v6/domains/{domain}/config[?teamId=…]
 *
 * The domain must already be registered on the project (call addVercelDomain
 * first). Returns:
 *   ok: true  — `cname` is the recommended target, or null when Vercel gave none.
 *   ok: false — API error, network failure, or not configured.
 *
 * @param hostname  Normalised hostname, e.g. "acme.demo.misterchameleon.nl".
 */
export async function getVercelRecommendedCname(
  hostname: string,
): Promise<VercelCnameLookupResult> {
  const token = getToken();
  if (!token) return { ok: false, error: "Vercel integration not configured" };

  try {
    const url  = withTeam(
      `https://api.vercel.com/v6/domains/${encodeURIComponent(hostname)}/config`,
    );
    const resp = await fetch(url, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const body    = await resp.json().catch(() => ({})) as Record<string, unknown>;
      const err     = body.error as Record<string, unknown> | undefined;
      const message = err?.message as string | undefined;
      return { ok: false, error: message ?? `Vercel API error ${resp.status}` };
    }

    const body = await resp.json() as Record<string, unknown>;
    return { ok: true, cname: extractVercelCname(body) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Vercel API request failed: ${message}` };
  }
}

/**
 * Removes a custom domain from the Vercel project.
 *
 * DELETE /v9/projects/{projectId}/domains/{hostname}[?teamId=…]
 *
 * Silently succeeds when the domain is not found on Vercel (already removed
 * or never registered).  A non-fatal warning is returned on other errors.
 *
 * @param hostname  Normalised hostname to remove.
 */
export async function removeVercelDomain(
  hostname: string,
): Promise<{ ok: true } | VercelErrorResult> {
  const token     = getToken();
  const projectId = getProjectId();

  if (!token || !projectId) {
    // Not configured — nothing to clean up on Vercel's side.
    return { ok: true };
  }

  try {
    const url  = withTeam(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    );
    const resp = await fetch(url, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const body    = await resp.json().catch(() => ({})) as Record<string, unknown>;
      const err     = body.error as Record<string, unknown> | undefined;
      const code    = err?.code    as string | undefined;
      const message = err?.message as string | undefined;

      // Domain not found → already removed, treat as success.
      if (resp.status === 404 || code === "not_found") return { ok: true };

      return { ok: false, error: message ?? `Vercel API error ${resp.status}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Vercel API request failed: ${message}` };
  }
}
