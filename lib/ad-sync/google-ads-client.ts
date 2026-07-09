/**
 * Ad-platform audience sync — Google Ads Customer Match client.
 *
 * Pushes hashed lead identifiers into a Customer Match user list via the Google
 * Ads API using an *offline user data job*:
 *   1. create a CUSTOMER_MATCH_USER_LIST job bound to the target user list,
 *   2. add the members (hashed email / phone / name+country) in batches,
 *   3. run the job (async server-side match).
 *
 * Auth: OAuth2 (refresh-token → access-token) + a developer token; the
 * login-customer-id header carries the MCC. All identifiers are SHA-256 hashed
 * by @/lib/ad-sync/hash before they leave the process. Fail-open: any missing
 * credential or API error → { ok:false, error } and never throws.
 *
 * API version is pinned in one place (API_VERSION) so it's trivial to bump.
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail, hashPhone, hashName, hashCountry } from "./hash";
import type { AudienceMember, GoogleAdsConfig, PlatformSyncResult } from "./types";

const API_VERSION = "v17";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 15_000;
const BATCH_SIZE = 10_000;         // Google allows up to 100k ops/request; stay conservative

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

/** Build a Customer Match user identifier object for one member (hashed). */
function toUserIdentifiers(member: AudienceMember): Array<Record<string, unknown>> {
  const ids: Array<Record<string, unknown>> = [];
  const email = hashEmail(member.email);
  if (email) ids.push({ hashedEmail: email });
  const phone = hashPhone(member.phone, "31");
  if (phone) ids.push({ hashedPhoneNumber: phone });
  const first = hashName(member.firstName);
  const last  = hashName(member.lastName);
  const country = hashCountry(member.country);
  if (first && last && country) {
    ids.push({ addressInfo: { hashedFirstName: first, hashedLastName: last, countryCode: (member.country ?? "").toUpperCase() } });
  }
  return ids;
}

async function apiCall(
  accessToken: string,
  cfg: GoogleAdsConfig,
  path: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; text: string }> {
  const customerId = digitsOnly(cfg.customerId);
  const res = await timedFetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        "developer-token":   cfg.developerToken ?? "",
        ...(cfg.loginCustomerId ? { "login-customer-id": digitsOnly(cfg.loginCustomerId) } : {}),
        "Content-Type":      "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const text = await res.text().catch(() => "");
  let json: Record<string, unknown> = {};
  try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

/**
 * Push members into the configured Customer Match user list. Returns the number
 * of members accepted (added to the job). Fail-open.
 */
export async function syncGoogleCustomerMatch(
  cfg:     GoogleAdsConfig,
  members: AudienceMember[],
): Promise<PlatformSyncResult> {
  const base = { platform: "google" as const, membersTotal: members.length };

  if (!cfg.developerToken || !cfg.customerId || !cfg.userListId) {
    return { ok: false, status: "skipped", membersSent: 0, error: "Google Ads not fully configured (developer token, customer id, user list id).", ...base };
  }

  const accessToken = await getAccessToken(cfg);
  if (!accessToken) {
    return { ok: false, status: "error", membersSent: 0, error: "Could not obtain Google OAuth access token — check client id/secret/refresh token.", ...base };
  }

  try {
    // 1) Create the offline user data job bound to the Customer Match list.
    const userListResource = `customers/${digitsOnly(cfg.customerId)}/userLists/${digitsOnly(cfg.userListId)}`;
    const create = await apiCall(accessToken, cfg, "offlineUserDataJobs:create", {
      job: {
        type: "CUSTOMER_MATCH_USER_LIST",
        customerMatchUserListMetadata: { userList: userListResource },
      },
    });
    if (!create.ok) {
      return { ok: false, status: "error", membersSent: 0, error: `Create job ${create.status}: ${create.text.slice(0, 300)}`, ...base };
    }
    const jobResource = String(create.json.resourceName ?? "");
    if (!jobResource) {
      return { ok: false, status: "error", membersSent: 0, error: "Create job returned no resourceName.", ...base };
    }
    const jobId = jobResource.split("/").pop() ?? "";

    // 2) Add members in batches.
    let sent = 0;
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const slice = members.slice(i, i + BATCH_SIZE);
      const operations = slice
        .map((m) => toUserIdentifiers(m))
        .filter((ids) => ids.length > 0)
        .map((userIdentifiers) => ({ create: { userIdentifiers } }));
      if (operations.length === 0) continue;

      const add = await apiCall(accessToken, cfg, `offlineUserDataJobs/${jobId}:addOperations`, {
        enablePartialFailure: true,
        operations,
      });
      if (!add.ok) {
        return { ok: false, status: "error", membersSent: sent, error: `Add operations ${add.status}: ${add.text.slice(0, 300)}`, ...base };
      }
      sent += operations.length;
    }

    // 3) Run the job (fire-and-forget; matching happens server-side).
    const run = await apiCall(accessToken, cfg, `offlineUserDataJobs/${jobId}:run`, {});
    if (!run.ok) {
      return { ok: false, status: "error", membersSent: sent, error: `Run job ${run.status}: ${run.text.slice(0, 300)}`, ...base };
    }

    return { ok: true, status: "ok", membersSent: sent, ...base };
  } catch (err) {
    return { ok: false, status: "error", membersSent: 0, error: err instanceof Error ? err.message : String(err), ...base };
  }
}

/**
 * Remove members (by hashed email) from the Customer Match user list. Uses an
 * offline user data job with `remove` operations. Returns members removed.
 */
export async function removeGoogleCustomerMatch(
  cfg:         GoogleAdsConfig,
  emailHashes: string[],
): Promise<{ ok: boolean; removed: number; error?: string }> {
  if (emailHashes.length === 0) return { ok: true, removed: 0 };
  if (!cfg.developerToken || !cfg.customerId || !cfg.userListId) {
    return { ok: false, removed: 0, error: "Google Ads not fully configured." };
  }
  const accessToken = await getAccessToken(cfg);
  if (!accessToken) return { ok: false, removed: 0, error: "Google OAuth failed." };

  try {
    const userListResource = `customers/${digitsOnly(cfg.customerId)}/userLists/${digitsOnly(cfg.userListId)}`;
    const create = await apiCall(accessToken, cfg, "offlineUserDataJobs:create", {
      job: { type: "CUSTOMER_MATCH_USER_LIST", customerMatchUserListMetadata: { userList: userListResource } },
    });
    if (!create.ok) return { ok: false, removed: 0, error: `Create job ${create.status}: ${create.text.slice(0, 200)}` };
    const jobId = String(create.json.resourceName ?? "").split("/").pop() ?? "";
    if (!jobId) return { ok: false, removed: 0, error: "Create job returned no resourceName." };

    let removed = 0;
    for (let i = 0; i < emailHashes.length; i += BATCH_SIZE) {
      const operations = emailHashes.slice(i, i + BATCH_SIZE).map((hashedEmail) => ({ remove: { userIdentifiers: [{ hashedEmail }] } }));
      const add = await apiCall(accessToken, cfg, `offlineUserDataJobs/${jobId}:addOperations`, { enablePartialFailure: true, operations });
      if (!add.ok) return { ok: false, removed, error: `Add remove-ops ${add.status}: ${add.text.slice(0, 200)}` };
      removed += operations.length;
    }
    const run = await apiCall(accessToken, cfg, `offlineUserDataJobs/${jobId}:run`, {});
    if (!run.ok) return { ok: false, removed, error: `Run job ${run.status}: ${run.text.slice(0, 200)}` };
    return { ok: true, removed };
  } catch (err) {
    return { ok: false, removed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lightweight credential probe used by the admin "Test connection" button. */
export async function testGoogleConnection(cfg: GoogleAdsConfig): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.developerToken || !cfg.customerId) return { ok: false, error: "Developer token and customer id required." };
  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, error: "OAuth failed — check client id, secret and refresh token." };
  return { ok: true };
}
