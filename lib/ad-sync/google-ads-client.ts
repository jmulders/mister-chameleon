/**
 * Ad-platform audience sync — Google Customer Match via the Data Manager API.
 *
 * As of 1 April 2026 Google disabled Customer Match uploads through the Google
 * Ads API (OfflineUserDataJobService) for developer tokens that weren't already
 * allowlisted. The supported path for new integrations is the **Data Manager
 * API** (datamanager.googleapis.com), which this client uses:
 *
 *   POST /v1/audienceMembers:ingest   → add members to a Customer Match user list
 *   POST /v1/audienceMembers:remove   → remove members
 *
 * Key differences from the old Ads-API path:
 *   • No developer token. Auth is OAuth2 with the dedicated scope
 *     `https://www.googleapis.com/auth/datamanager`.
 *   • The target list + account are addressed via a `Destination`
 *     (operatingAccount = the Ads customer id, loginAccount = the MCC when used,
 *     productDestinationId = the Customer Match user list id).
 *   • Customer Match ToS is accepted inline via `termsOfService`.
 *
 * Identifiers are SHA-256 hashed (hex) by @/lib/ad-sync/hash before sending;
 * only hashes leave the process. Fail-open — never throws.
 *
 * Docs: https://developers.google.com/data-manager/api/devguides/audiences/google-ads/customer-match
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail, hashPhone } from "./hash";
import type { AudienceMember, GoogleAdsConfig, PlatformSyncResult } from "./types";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DM_BASE = "https://datamanager.googleapis.com/v1";
const TIMEOUT_MS = 15_000;
const BATCH_SIZE = 10_000;         // Data Manager API max is 10k members/request

function digitsOnly(v: string | undefined | null): string {
  return (v ?? "").replace(/\D/g, "");
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the stored refresh token for a short-lived access token. */
async function getAccessToken(cfg: GoogleAdsConfig): Promise<string | null> {
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) return null;
  try {
    const body = new URLSearchParams({
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type:    "refresh_token",
    });
    const res = await timedFetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      logger.warn("[ad-sync] Google OAuth non-2xx", { status: res.status, body: t.slice(0, 200) });
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    logger.warn("[ad-sync] Google OAuth failed", { err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** The Destination pointing at the tenant's Customer Match user list. */
function buildDestination(cfg: GoogleAdsConfig): Record<string, unknown> {
  return {
    ...(cfg.loginCustomerId
      ? { loginAccount: { product: "GOOGLE_ADS", accountId: digitsOnly(cfg.loginCustomerId) } }
      : {}),
    operatingAccount: { product: "GOOGLE_ADS", accountId: digitsOnly(cfg.customerId) },
    productDestinationId: digitsOnly(cfg.userListId),
  };
}

/** AudienceMember (compositeData) from a member's hashed email/phone. */
function toAudienceMember(member: AudienceMember): Record<string, unknown> | null {
  const userIdentifiers: Array<Record<string, unknown>> = [];
  const email = hashEmail(member.email);
  if (email) userIdentifiers.push({ emailAddress: email });
  const phone = hashPhone(member.phone, "31");
  if (phone) userIdentifiers.push({ phoneNumber: phone });
  if (userIdentifiers.length === 0) return null;
  return { compositeData: { userData: { userIdentifiers } } };
}

/** AudienceMember built directly from a hashed email (used for removals). */
function memberFromEmailHash(hash: string): Record<string, unknown> {
  return { compositeData: { userData: { userIdentifiers: [{ emailAddress: hash }] } } };
}

async function dmCall(
  accessToken: string,
  method: "ingest" | "remove",
  payload: unknown,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await timedFetch(`${DM_BASE}/audienceMembers:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

/** Add members to the Customer Match list. Returns members accepted. */
export async function syncGoogleCustomerMatch(
  cfg:     GoogleAdsConfig,
  members: AudienceMember[],
): Promise<PlatformSyncResult> {
  const base = { platform: "google" as const, membersTotal: members.length };

  if (!cfg.customerId || !cfg.userListId) {
    return { ok: false, status: "skipped", membersSent: 0, error: "Google not fully configured (customer id + user list id).", ...base };
  }
  const accessToken = await getAccessToken(cfg);
  if (!accessToken) {
    return { ok: false, status: "error", membersSent: 0, error: "Could not obtain Google OAuth token — check client id/secret/refresh token (datamanager scope).", ...base };
  }

  try {
    const destination = buildDestination(cfg);
    let sent = 0;
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const audienceMembers = members
        .slice(i, i + BATCH_SIZE)
        .map(toAudienceMember)
        .filter((m): m is Record<string, unknown> => m !== null);
      if (audienceMembers.length === 0) continue;

      const r = await dmCall(accessToken, "ingest", {
        destinations: [destination],
        audienceMembers,
        encoding: "HEX",
        termsOfService: { customerMatchTermsOfServiceStatus: "ACCEPTED" },
      });
      if (!r.ok) {
        return { ok: false, status: "error", membersSent: sent, error: `Data Manager ingest ${r.status}: ${r.text.slice(0, 300)}`, ...base };
      }
      sent += audienceMembers.length;
    }
    return { ok: true, status: "ok", membersSent: sent, ...base };
  } catch (err) {
    return { ok: false, status: "error", membersSent: 0, error: err instanceof Error ? err.message : String(err), ...base };
  }
}

/** Remove members (by hashed email) from the Customer Match list. */
export async function removeGoogleCustomerMatch(
  cfg:         GoogleAdsConfig,
  emailHashes: string[],
): Promise<{ ok: boolean; removed: number; error?: string }> {
  if (emailHashes.length === 0) return { ok: true, removed: 0 };
  if (!cfg.customerId || !cfg.userListId) return { ok: false, removed: 0, error: "Google not fully configured." };
  const accessToken = await getAccessToken(cfg);
  if (!accessToken) return { ok: false, removed: 0, error: "Google OAuth failed." };

  try {
    const destination = buildDestination(cfg);
    let removed = 0;
    for (let i = 0; i < emailHashes.length; i += BATCH_SIZE) {
      const audienceMembers = emailHashes.slice(i, i + BATCH_SIZE).map(memberFromEmailHash);
      const r = await dmCall(accessToken, "remove", {
        destinations: [destination],
        audienceMembers,
        encoding: "HEX",
      });
      if (!r.ok) return { ok: false, removed, error: `Data Manager remove ${r.status}: ${r.text.slice(0, 200)}` };
      removed += audienceMembers.length;
    }
    return { ok: true, removed };
  } catch (err) {
    return { ok: false, removed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Credential probe for the admin "Test connection" button. Runs a validateOnly
 * ingest with a single synthetic hashed email — this exercises the token, the
 * scope and the destination without actually writing to the audience.
 */
export async function testGoogleConnection(cfg: GoogleAdsConfig): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.customerId || !cfg.userListId) return { ok: false, error: "Customer id and user list id required." };
  const accessToken = await getAccessToken(cfg);
  if (!accessToken) return { ok: false, error: "OAuth failed — check client id, secret and refresh token (needs the datamanager scope)." };
  try {
    const probe = hashEmail("connection-test@example.com")!;
    const r = await dmCall(accessToken, "ingest", {
      destinations: [buildDestination(cfg)],
      audienceMembers: [memberFromEmailHash(probe)],
      encoding: "HEX",
      validateOnly: true,
      termsOfService: { customerMatchTermsOfServiceStatus: "ACCEPTED" },
    });
    if (!r.ok) return { ok: false, error: `Data Manager ${r.status}: ${r.text.slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
