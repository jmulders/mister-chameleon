/**
 * Ad-platform audience sync — Meta (Facebook/Instagram) Custom Audiences client.
 *
 * Adds hashed lead identifiers to an existing Custom Audience via the Graph API:
 *   POST /{audience-id}/users  { payload: { schema: [...], data: [[...]] } }
 *
 * We send a multi-key schema (EMAIL, PHONE, FN, LN, COUNTRY) so Meta can match
 * on whichever it can; every value is SHA-256 hashed by @/lib/ad-sync/hash
 * first (Meta requires pre-hashed data for these keys). Auth is a long-lived
 * system-user access token with ads_management. Fail-open, never throws.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail, hashPhone, hashName, hashCountry } from "./hash";
import type { AudienceMember, MetaConfig, PlatformSyncResult } from "./types";

const API_VERSION = "v21.0";
const TIMEOUT_MS = 15_000;
const BATCH_SIZE = 5_000;          // Meta max 10k rows/request; stay conservative

// Column order for the payload — value at index i corresponds to SCHEMA[i].
const SCHEMA = ["EMAIL", "PHONE", "FN", "LN", "COUNTRY"] as const;

function memberRow(member: AudienceMember): (string | null)[] | null {
  const row = [
    hashEmail(member.email),
    hashPhone(member.phone, "31"),
    hashName(member.firstName),
    hashName(member.lastName),
    hashCountry(member.country),
  ];
  // Require at least one strong identifier (email or phone).
  if (!row[0] && !row[1]) return null;
  return row.map((v) => v ?? "");
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

/** Add members to the configured Custom Audience. Returns members accepted. */
export async function syncMetaCustomAudience(
  cfg:     MetaConfig,
  members: AudienceMember[],
): Promise<PlatformSyncResult> {
  const base = { platform: "meta" as const, membersTotal: members.length };

  if (!cfg.accessToken || !cfg.audienceId) {
    return { ok: false, status: "skipped", membersSent: 0, error: "Meta not configured (access token + audience id).", ...base };
  }

  try {
    let sent = 0;
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const rows = members
        .slice(i, i + BATCH_SIZE)
        .map(memberRow)
        .filter((r): r is (string | null)[] => r !== null);
      if (rows.length === 0) continue;

      const url = `https://graph.facebook.com/${API_VERSION}/${cfg.audienceId}/users`;
      const body = new URLSearchParams({
        access_token: cfg.accessToken,
        payload: JSON.stringify({ schema: SCHEMA, data: rows }),
      });
      const res = await timedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        logger.warn("[ad-sync] Meta users add non-2xx", { status: res.status, body: text.slice(0, 200) });
        return { ok: false, status: "error", membersSent: sent, error: `Meta API ${res.status}: ${text.slice(0, 300)}`, ...base };
      }
      // Meta echoes num_received / num_invalid_entries; count received when present.
      try {
        const json = JSON.parse(text) as { num_received?: number };
        sent += typeof json.num_received === "number" ? json.num_received : rows.length;
      } catch {
        sent += rows.length;
      }
    }
    return { ok: true, status: "ok", membersSent: sent, ...base };
  } catch (err) {
    return { ok: false, status: "error", membersSent: 0, error: err instanceof Error ? err.message : String(err), ...base };
  }
}

/**
 * Remove members (by hashed email) from the Custom Audience via DELETE
 * /{audience-id}/users. Returns members removed.
 */
export async function removeMetaCustomAudience(
  cfg:         MetaConfig,
  emailHashes: string[],
): Promise<{ ok: boolean; removed: number; error?: string }> {
  if (emailHashes.length === 0) return { ok: true, removed: 0 };
  if (!cfg.accessToken || !cfg.audienceId) return { ok: false, removed: 0, error: "Meta not configured." };

  try {
    let removed = 0;
    for (let i = 0; i < emailHashes.length; i += BATCH_SIZE) {
      const rows = emailHashes.slice(i, i + BATCH_SIZE).map((h) => [h]);
      const url = `https://graph.facebook.com/${API_VERSION}/${cfg.audienceId}/users`;
      const body = new URLSearchParams({
        access_token: cfg.accessToken,
        payload: JSON.stringify({ schema: ["EMAIL"], data: rows }),
      });
      const res = await timedFetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) return { ok: false, removed, error: `Meta API ${res.status}: ${text.slice(0, 200)}` };
      removed += rows.length;
    }
    return { ok: true, removed };
  } catch (err) {
    return { ok: false, removed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Credential probe: read the audience object metadata. */
export async function testMetaConnection(cfg: MetaConfig): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.accessToken || !cfg.audienceId) return { ok: false, error: "Access token and audience id required." };
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${cfg.audienceId}?fields=id,name&access_token=${encodeURIComponent(cfg.accessToken)}`;
    const res = await timedFetch(url, { method: "GET" });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, error: `Meta API ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
