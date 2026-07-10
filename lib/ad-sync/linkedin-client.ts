/**
 * Ad-platform audience sync — LinkedIn Matched Audiences (DMP Segments) client.
 *
 * Adds hashed lead emails to a LinkedIn DMP Segment:
 *   POST /rest/dmpSegments/{id}/users
 *   { elements: [{ action: "ADD", userIds: [{ idType: "SHA256_EMAIL", idValue }] }] }
 *
 * LinkedIn matches business audiences primarily on SHA-256 of the lowercased
 * email. Auth is an OAuth2 access token with rw_dmp_segments. Requires the
 * versioned REST headers (LinkedIn-Version + X-Restli-Protocol-Version). Hashing
 * via @/lib/ad-sync/hash. Fail-open, never throws.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail } from "./hash";
import type { AudienceMember, LinkedInConfig, PlatformSyncResult } from "./types";

const REST_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202606";  // YYYYMM — bump periodically per LinkedIn's ~15-month sunset schedule
const TIMEOUT_MS = 15_000;
const BATCH_SIZE = 5_000;           // LinkedIn batch max is 5000 users/request

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function headers(cfg: LinkedInConfig): Record<string, string> {
  return {
    Authorization:              `Bearer ${cfg.accessToken}`,
    "Content-Type":             "application/json",
    "LinkedIn-Version":         LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/** Batch add/remove requires the BATCH_CREATE method header on the /users endpoint. */
function batchHeaders(cfg: LinkedInConfig): Record<string, string> {
  return { ...headers(cfg), "X-RestLi-Method": "BATCH_CREATE" };
}

/** Add members (by hashed email) to the configured DMP Segment. */
export async function syncLinkedInDmpSegment(
  cfg:     LinkedInConfig,
  members: AudienceMember[],
): Promise<PlatformSyncResult> {
  const base = { platform: "linkedin" as const, membersTotal: members.length };

  if (!cfg.accessToken || !cfg.dmpSegmentId) {
    return { ok: false, status: "skipped", membersSent: 0, error: "LinkedIn not configured (access token + DMP segment id).", ...base };
  }

  try {
    const url = `${REST_BASE}/dmpSegments/${encodeURIComponent(cfg.dmpSegmentId)}/users`;
    let sent = 0;

    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const elements = members
        .slice(i, i + BATCH_SIZE)
        .map((m) => hashEmail(m.email))
        .filter((h): h is string => Boolean(h))
        .map((idValue) => ({
          action: "ADD",
          userIds: [{ idType: "SHA256_EMAIL", idValue }],
        }));
      if (elements.length === 0) continue;

      const res = await timedFetch(url, {
        method: "POST",
        headers: batchHeaders(cfg),
        body: JSON.stringify({ elements }),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        logger.warn("[ad-sync] LinkedIn users add non-2xx", { status: res.status, body: text.slice(0, 200) });
        return { ok: false, status: "error", membersSent: sent, error: `LinkedIn API ${res.status}: ${text.slice(0, 300)}`, ...base };
      }
      sent += elements.length;
    }

    return { ok: true, status: "ok", membersSent: sent, ...base };
  } catch (err) {
    return { ok: false, status: "error", membersSent: 0, error: err instanceof Error ? err.message : String(err), ...base };
  }
}

/**
 * Remove members (by hashed email) from the DMP Segment using the "REMOVE"
 * action on the same /users endpoint. Returns members removed.
 */
export async function removeLinkedInDmpSegment(
  cfg:         LinkedInConfig,
  emailHashes: string[],
): Promise<{ ok: boolean; removed: number; error?: string }> {
  if (emailHashes.length === 0) return { ok: true, removed: 0 };
  if (!cfg.accessToken || !cfg.dmpSegmentId) return { ok: false, removed: 0, error: "LinkedIn not configured." };

  try {
    const url = `${REST_BASE}/dmpSegments/${encodeURIComponent(cfg.dmpSegmentId)}/users`;
    let removed = 0;
    for (let i = 0; i < emailHashes.length; i += BATCH_SIZE) {
      const elements = emailHashes.slice(i, i + BATCH_SIZE).map((idValue) => ({
        action: "REMOVE",
        userIds: [{ idType: "SHA256_EMAIL", idValue }],
      }));
      const res = await timedFetch(url, { method: "POST", headers: batchHeaders(cfg), body: JSON.stringify({ elements }) });
      const text = await res.text().catch(() => "");
      if (!res.ok) return { ok: false, removed, error: `LinkedIn API ${res.status}: ${text.slice(0, 200)}` };
      removed += elements.length;
    }
    return { ok: true, removed };
  } catch (err) {
    return { ok: false, removed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Credential probe: read the DMP segment metadata. */
export async function testLinkedInConnection(cfg: LinkedInConfig): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.accessToken || !cfg.dmpSegmentId) return { ok: false, error: "Access token and DMP segment id required." };
  try {
    const url = `${REST_BASE}/dmpSegments/${encodeURIComponent(cfg.dmpSegmentId)}`;
    const res = await timedFetch(url, { method: "GET", headers: headers(cfg) });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, error: `LinkedIn API ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
