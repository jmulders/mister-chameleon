/**
 * Ad-platform audience sync — per-tenant config store.
 *
 * Read/write for `ad_sync_settings` (segment + per-platform credentials) and an
 * append/read for `ad_sync_runs` (audit log). Service-role client only, same
 * pattern as abm-store.ts (RLS on, no policies). Secrets live in plaintext
 * JSONB columns reachable exclusively through getDb() on the server.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type {
  AdPlatform,
  AdSyncRun,
  AdSyncSegment,
  AdSyncSettings,
  GoogleAdsConfig,
  LinkedInConfig,
  MetaConfig,
} from "./types";

import type { ConversionConfig } from "./conversion-types";

export type { AdSyncRun } from "./types";

const EMPTY_SETTINGS = (tenantId: string): AdSyncSettings => ({
  tenantId,
  enabled:   false,
  segment:   { requireConsent: true },
  google:    null,
  meta:      null,
  linkedin:  null,
  lastRunAt: null,
});

function mapRow(tenantId: string, row: Record<string, unknown> | null): AdSyncSettings {
  if (!row) return EMPTY_SETTINGS(tenantId);
  return {
    tenantId,
    enabled:   Boolean(row.enabled),
    segment:   (row.segment as AdSyncSegment | null) ?? { requireConsent: true },
    google:    (row.google as GoogleAdsConfig | null) ?? null,
    meta:      (row.meta as MetaConfig | null) ?? null,
    linkedin:  (row.linkedin as LinkedInConfig | null) ?? null,
    lastRunAt: (row.last_run_at as string | null) ?? null,
  };
}

/** Full per-tenant ad-sync config (defaults when unset). Includes secrets. */
export async function getAdSyncSettings(tenantId: string): Promise<AdSyncSettings> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("ad_sync_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return EMPTY_SETTINGS(tenantId);
    return mapRow(tenantId, data);
  } catch {
    return EMPTY_SETTINGS(tenantId);
  }
}

async function upsert(tenantId: string, patch: Record<string, unknown>): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db
      .from("ad_sync_settings")
      .upsert(
        { tenant_id: tenantId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id" },
      );
    if (error) logger.warn("[ad-sync-store] upsert failed", { tenantId, error: String(error.message ?? error) });
    return !error;
  } catch (err) {
    logger.warn("[ad-sync-store] upsert threw", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function setAdSyncEnabled(tenantId: string, enabled: boolean): Promise<boolean> {
  return upsert(tenantId, { enabled });
}

export function setAdSyncSegment(tenantId: string, segment: AdSyncSegment): Promise<boolean> {
  return upsert(tenantId, { segment });
}

/**
 * Merge-update one platform's config. Empty-string fields are stripped so a
 * blank input never overwrites a stored secret; pass `null` for the whole blob
 * to clear the platform.
 */
export async function setPlatformConfig(
  tenantId: string,
  platform: AdPlatform,
  config:   GoogleAdsConfig | MetaConfig | LinkedInConfig | null,
): Promise<boolean> {
  if (config === null) return upsert(tenantId, { [platform]: null });

  const existing = await getAdSyncSettings(tenantId);
  const current = (existing[platform] ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) merged[k] = t;            // only overwrite when a value is provided
    } else if (v !== undefined) {
      merged[k] = v;
    }
  }
  return upsert(tenantId, { [platform]: merged });
}

// ── Run audit log ──────────────────────────────────────────────────────────────

export async function logAdSyncRun(
  tenantId: string,
  run: Omit<AdSyncRun, "id" | "createdAt">,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db.from("ad_sync_runs").insert({
      tenant_id:       tenantId,
      platform:        run.platform,
      status:          run.status,
      members_total:   run.membersTotal,
      members_sent:    run.membersSent,
      members_removed: run.membersRemoved,
      trigger:         run.trigger,
      error:           run.error,
    });
  } catch (err) {
    logger.warn("[ad-sync-store] logAdSyncRun failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function markAdSyncRan(tenantId: string): Promise<void> {
  await upsert(tenantId, { last_run_at: new Date().toISOString() });
}

/** Recent run history for the admin panel (newest first). */
export async function listAdSyncRuns(tenantId: string, limit = 20): Promise<AdSyncRun[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("ad_sync_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id:             String(r.id),
      platform:       r.platform as AdPlatform,
      status:         (r.status as AdSyncRun["status"]) ?? "error",
      membersTotal:   Number(r.members_total ?? 0),
      membersSent:    Number(r.members_sent ?? 0),
      membersRemoved: Number(r.members_removed ?? 0),
      trigger:        (r.trigger as AdSyncRun["trigger"]) ?? "cron",
      error:          (r.error as string | null) ?? null,
      createdAt:      String(r.created_at),
    }));
  } catch {
    return [];
  }
}

// ── Audience membership snapshot (for incremental reconcile) ────────────────────

/** All email-hashes we have currently pushed to one platform's audience. */
export async function getAudienceHashes(tenantId: string, platform: AdPlatform): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    // Page through — an audience can exceed the default 1000-row limit.
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("ad_sync_audience_members")
        .select("email_hash")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data as Array<{ email_hash: string }>) out.add(String(r.email_hash));
      if (data.length < PAGE) break;
    }
  } catch (err) {
    logger.warn("[ad-sync-store] getAudienceHashes failed", {
      tenantId, platform, err: err instanceof Error ? err.message : String(err),
    });
  }
  return out;
}

/** Record hashes as now-present in a platform audience (idempotent upsert). */
export async function addAudienceHashes(tenantId: string, platform: AdPlatform, hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const CHUNK = 500;
    for (let i = 0; i < hashes.length; i += CHUNK) {
      const rows = hashes.slice(i, i + CHUNK).map((h) => ({ tenant_id: tenantId, platform, email_hash: h }));
      await db.from("ad_sync_audience_members").upsert(rows, { onConflict: "tenant_id,platform,email_hash" });
    }
  } catch (err) {
    logger.warn("[ad-sync-store] addAudienceHashes failed", {
      tenantId, platform, err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Forget hashes that are no longer in a platform audience. */
export async function removeAudienceHashes(tenantId: string, platform: AdPlatform, hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const CHUNK = 500;
    for (let i = 0; i < hashes.length; i += CHUNK) {
      await db
        .from("ad_sync_audience_members")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .in("email_hash", hashes.slice(i, i + CHUNK));
    }
  } catch (err) {
    logger.warn("[ad-sync-store] removeAudienceHashes failed", {
      tenantId, platform, err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Conversion feedback (config + audit log) ────────────────────────────────────

/** Read the tenant's conversion-feedback config (or null when unset). */
export async function getConversionConfig(tenantId: string): Promise<ConversionConfig | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("ad_sync_settings")
      .select("conversions")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.conversions as ConversionConfig | null) ?? null;
  } catch {
    return null;
  }
}

/** Upsert the tenant's conversion-feedback config. */
export function setConversionConfig(tenantId: string, conversions: ConversionConfig): Promise<boolean> {
  return upsert(tenantId, { conversions });
}

/** Append one conversion-send outcome to the audit log. */
export async function logConversionEvent(
  tenantId: string,
  row: { platform: string; status: string; eventName?: string | null; trigger: string; error?: string | null },
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db.from("ad_conversion_events").insert({
      tenant_id:  tenantId,
      platform:   row.platform,
      status:     row.status,
      event_name: row.eventName ?? null,
      trigger:    row.trigger,
      error:      row.error ?? null,
    });
  } catch (err) {
    logger.warn("[ad-sync-store] logConversionEvent failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Tenant ids with ad-sync enabled — the cron's work list. */
export async function listEnabledAdSyncTenantIds(): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("ad_sync_settings")
      .select("tenant_id")
      .eq("enabled", true);
    if (error || !data) return [];
    return (data as Array<{ tenant_id: string }>).map((r) => String(r.tenant_id));
  } catch {
    return [];
  }
}
