/**
 * Ad-platform audience sync — orchestrator (incremental reconcile).
 *
 * For one tenant: resolve the segment once, then for each configured platform
 * DIFF the current segment against what we previously pushed (the audience
 * snapshot in ad_sync_audience_members) and apply only the delta:
 *   • additions  → add ops   (new/qualifying leads)
 *   • removals   → remove ops (leads that dropped below the threshold, changed
 *                              status, or were erased)
 * This is exactly what HubSpot's scheduled list sync does. Every push is logged
 * to ad_sync_runs. Fail-open — one platform's failure never blocks the others,
 * and nothing here ever throws.
 *
 * Diffs are keyed on the SHA-256 of the email (the common, stable identifier
 * across all three platforms). Members without an email (phone-only) can't be
 * diffed, so they are re-sent every run (add is idempotent) and are not tracked
 * for removal.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail } from "./hash";
import { resolveAudienceMembers } from "./segment";
import { syncGoogleCustomerMatch, removeGoogleCustomerMatch } from "./google-ads-client";
import { syncMetaCustomAudience,  removeMetaCustomAudience }  from "./meta-client";
import { syncLinkedInDmpSegment,  removeLinkedInDmpSegment }  from "./linkedin-client";
import {
  getAdSyncSettings,
  getAudienceHashes,
  addAudienceHashes,
  removeAudienceHashes,
  logAdSyncRun,
  markAdSyncRan,
} from "./ad-sync-store";
import type { AdPlatform, AdSyncSettings, AudienceMember, PlatformSyncResult } from "./types";

export interface TenantSyncSummary {
  tenantId:     string;
  membersTotal: number;
  results:      PlatformSyncResult[];
}

interface Diff {
  addMembers:   AudienceMember[];   // additions + phone-only (always re-sent)
  addHashes:    string[];           // email-hashes newly added (tracked)
  removeHashes: string[];           // email-hashes no longer in the segment
}

/** Diff the current member list against the previously-pushed hash snapshot. */
function computeDiff(members: AudienceMember[], previous: Set<string>): Diff {
  const currentHashes = new Set<string>();
  const emailless: AudienceMember[] = [];
  const addMembers: AudienceMember[] = [];
  const addHashes: string[] = [];

  for (const m of members) {
    const h = m.email ? hashEmail(m.email) : null;
    if (!h) { emailless.push(m); continue; }
    currentHashes.add(h);
    if (!previous.has(h)) { addHashes.push(h); addMembers.push(m); }
  }

  const removeHashes: string[] = [];
  for (const h of previous) if (!currentHashes.has(h)) removeHashes.push(h);

  return { addMembers: [...emailless, ...addMembers], addHashes, removeHashes };
}

type RemoveResult = { ok: boolean; removed: number; error?: string };

/** Merge an add result and a remove result into a single PlatformSyncResult. */
function combine(
  platform: AdPlatform,
  total: number,
  add: PlatformSyncResult | null,
  rem: RemoveResult,
): PlatformSyncResult {
  const addSkipped = add ? add.status === "skipped" : false;
  // A "skipped" add (platform not fully configured) is not an error.
  const addError = add ? !add.ok && !addSkipped : false;
  const ok = !addError && rem.ok;
  const status: PlatformSyncResult["status"] =
    !ok ? "error" : addSkipped && rem.removed === 0 && !rem.error ? "skipped" : "ok";
  const error = [add?.error, rem.error].filter(Boolean).join(" | ") || undefined;
  return {
    ok,
    platform,
    status,
    membersTotal: total,
    membersSent: add ? add.membersSent : 0,
    membersRemoved: rem.removed,
    ...(error ? { error } : {}),
  };
}

/**
 * Run the audience reconcile for a single tenant.
 *
 * @param settings  Pre-loaded config (pass to avoid a re-read); loaded when omitted.
 * @param trigger   "cron" | "manual" — recorded in the run log.
 */
export async function runTenantAdSync(
  tenantId: string,
  trigger: "cron" | "manual" = "cron",
  settings?: AdSyncSettings,
): Promise<TenantSyncSummary> {
  const cfg = settings ?? (await getAdSyncSettings(tenantId));
  const results: PlatformSyncResult[] = [];

  // Resolve the segment once — the same members go to every platform.
  const members = await resolveAudienceMembers(tenantId, cfg.segment);
  const total = members.length;

  // ── Google Ads ────────────────────────────────────────────────────────────
  if (cfg.google) {
    const prev = await getAudienceHashes(tenantId, "google");
    const { addMembers, addHashes, removeHashes } = computeDiff(members, prev);
    const add = addMembers.length ? await syncGoogleCustomerMatch(cfg.google, addMembers) : null;
    const rem = removeHashes.length ? await removeGoogleCustomerMatch(cfg.google, removeHashes) : { ok: true, removed: 0 };
    if ((add ? add.ok && add.status !== "skipped" : false)) await addAudienceHashes(tenantId, "google", addHashes);
    if (rem.ok) await removeAudienceHashes(tenantId, "google", removeHashes);
    const r = combine("google", total, add, rem);
    results.push(r);
    await logAdSyncRun(tenantId, { platform: "google", status: r.status, membersTotal: total, membersSent: r.membersSent, membersRemoved: r.membersRemoved ?? 0, trigger, error: r.error ?? null });
  }

  // ── Meta ──────────────────────────────────────────────────────────────────
  if (cfg.meta) {
    const prev = await getAudienceHashes(tenantId, "meta");
    const { addMembers, addHashes, removeHashes } = computeDiff(members, prev);
    const add = addMembers.length ? await syncMetaCustomAudience(cfg.meta, addMembers) : null;
    const rem = removeHashes.length ? await removeMetaCustomAudience(cfg.meta, removeHashes) : { ok: true, removed: 0 };
    if ((add ? add.ok && add.status !== "skipped" : false)) await addAudienceHashes(tenantId, "meta", addHashes);
    if (rem.ok) await removeAudienceHashes(tenantId, "meta", removeHashes);
    const r = combine("meta", total, add, rem);
    results.push(r);
    await logAdSyncRun(tenantId, { platform: "meta", status: r.status, membersTotal: total, membersSent: r.membersSent, membersRemoved: r.membersRemoved ?? 0, trigger, error: r.error ?? null });
  }

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  if (cfg.linkedin) {
    const prev = await getAudienceHashes(tenantId, "linkedin");
    const { addMembers, addHashes, removeHashes } = computeDiff(members, prev);
    const add = addMembers.length ? await syncLinkedInDmpSegment(cfg.linkedin, addMembers) : null;
    const rem = removeHashes.length ? await removeLinkedInDmpSegment(cfg.linkedin, removeHashes) : { ok: true, removed: 0 };
    if ((add ? add.ok && add.status !== "skipped" : false)) await addAudienceHashes(tenantId, "linkedin", addHashes);
    if (rem.ok) await removeAudienceHashes(tenantId, "linkedin", removeHashes);
    const r = combine("linkedin", total, add, rem);
    results.push(r);
    await logAdSyncRun(tenantId, { platform: "linkedin", status: r.status, membersTotal: total, membersSent: r.membersSent, membersRemoved: r.membersRemoved ?? 0, trigger, error: r.error ?? null });
  }

  await markAdSyncRan(tenantId);

  logger.info("[ad-sync] tenant sync complete", {
    tenantId,
    trigger,
    members: total,
    results: results.map((r) => `${r.platform}:${r.status}(+${r.membersSent}/-${r.membersRemoved ?? 0})`).join(", "),
  });

  return { tenantId, membersTotal: total, results };
}

/**
 * Erasure: remove specific people (by raw email) from every configured platform
 * audience and forget them from the snapshot. Called from the Lead Base GDPR
 * delete path so a deleted lead is also purged from the ad platforms. Fail-open.
 */
export async function removeLeadsFromAudiences(tenantId: string, emails: string[]): Promise<void> {
  const hashes = Array.from(new Set(emails.map((e) => hashEmail(e)).filter((h): h is string => Boolean(h))));
  if (hashes.length === 0) return;

  const cfg = await getAdSyncSettings(tenantId);
  try {
    if (cfg.google) {
      const r = await removeGoogleCustomerMatch(cfg.google, hashes);
      if (r.ok) await removeAudienceHashes(tenantId, "google", hashes);
    }
    if (cfg.meta) {
      const r = await removeMetaCustomAudience(cfg.meta, hashes);
      if (r.ok) await removeAudienceHashes(tenantId, "meta", hashes);
    }
    if (cfg.linkedin) {
      const r = await removeLinkedInDmpSegment(cfg.linkedin, hashes);
      if (r.ok) await removeAudienceHashes(tenantId, "linkedin", hashes);
    }
  } catch (err) {
    logger.warn("[ad-sync] removeLeadsFromAudiences failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
}
