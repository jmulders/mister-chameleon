"use server";

/**
 * Tenant Workspace › Ad Sync (retargeting) — Server Actions
 *
 * Configure and run the ad-platform audience sync: segment definition,
 * per-platform credentials, a live "test connection" per platform, and an
 * on-demand "sync now". All actions require an admin session. See
 * docs/lead-base-design.md.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import {
  getAdSyncSettings,
  setAdSyncEnabled,
  setAdSyncSegment,
  setPlatformConfig,
  listAdSyncRuns,
  getConversionConfig,
  setConversionConfig,
  type AdSyncRun,
} from "@/lib/ad-sync/ad-sync-store";
import type { ConversionConfig } from "@/lib/ad-sync/conversion-types";
import { resolveAudienceMembers } from "@/lib/ad-sync/segment";
import { runTenantAdSync } from "@/lib/ad-sync/sync-engine";
import { testGoogleConnection } from "@/lib/ad-sync/google-ads-client";
import { testMetaConnection } from "@/lib/ad-sync/meta-client";
import { testLinkedInConnection } from "@/lib/ad-sync/linkedin-client";
import type {
  AdPlatform,
  AdSyncSegment,
  AdSyncSettings,
  GoogleAdsConfig,
  LinkedInConfig,
  MetaConfig,
  PlatformSyncResult,
} from "@/lib/ad-sync/types";

const path = (tenantId: string) => `/admin/tenants/${tenantId}/audience/retargeting`;

/**
 * Redact secret fields before returning config to the client. The form shows
 * "•••• set" for stored secrets and only sends back fields the admin changed.
 */
function redact(settings: AdSyncSettings): AdSyncSettings {
  const mask = (v: string | undefined) => (v ? "__SET__" : undefined);
  return {
    ...settings,
    google: settings.google
      ? { ...settings.google, clientSecret: mask(settings.google.clientSecret), refreshToken: mask(settings.google.refreshToken), developerToken: mask(settings.google.developerToken) }
      : null,
    meta: settings.meta
      ? { ...settings.meta, accessToken: mask(settings.meta.accessToken) }
      : null,
    linkedin: settings.linkedin
      ? { ...settings.linkedin, accessToken: mask(settings.linkedin.accessToken) }
      : null,
  };
}

export async function getAdSyncSettingsAction(tenantId: string): Promise<AdSyncSettings> {
  await getRequiredAdminSession();
  return redact(await getAdSyncSettings(tenantId));
}

export async function listAdSyncRunsAction(tenantId: string): Promise<AdSyncRun[]> {
  await getRequiredAdminSession();
  return listAdSyncRuns(tenantId);
}

export async function saveAdSyncEnabledAction(
  tenantId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const ok = await setAdSyncEnabled(tenantId, enabled);
  if (!ok) return { ok: false, error: "Save failed." };
  revalidatePath(path(tenantId));
  return { ok: true };
}

export async function saveAdSyncSegmentAction(
  tenantId: string,
  segment: AdSyncSegment,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const ok = await setAdSyncSegment(tenantId, segment);
  if (!ok) return { ok: false, error: "Save failed." };
  revalidatePath(path(tenantId));
  return { ok: true };
}

/**
 * Save one platform's credentials. Fields equal to the redaction sentinel
 * ("__SET__") or empty are dropped so a stored secret is never overwritten by
 * the masked placeholder. Pass `clear: true` to remove the platform entirely.
 */
export async function savePlatformConfigAction(
  tenantId: string,
  platform: AdPlatform,
  config: GoogleAdsConfig | MetaConfig | LinkedInConfig,
  clear = false,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  if (clear) {
    const ok = await setPlatformConfig(tenantId, platform, null);
    if (!ok) return { ok: false, error: "Save failed." };
    revalidatePath(path(tenantId));
    return { ok: true };
  }
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string" && v.trim() && v !== "__SET__") cleaned[k] = v.trim();
  }
  const ok = await setPlatformConfig(tenantId, platform, cleaned as never);
  if (!ok) return { ok: false, error: "Save failed." };
  revalidatePath(path(tenantId));
  return { ok: true };
}

/** Count of matchable members the current segment resolves to (dry run). */
export async function previewSegmentAction(tenantId: string): Promise<{ count: number }> {
  await getRequiredAdminSession();
  const settings = await getAdSyncSettings(tenantId);
  const members = await resolveAudienceMembers(tenantId, settings.segment);
  return { count: members.length };
}

/** Live credential probe for one platform (uses stored secrets). */
export async function testPlatformConnectionAction(
  tenantId: string,
  platform: AdPlatform,
): Promise<{ ok: boolean; error?: string }> {
  await getRequiredAdminSession();
  const s = await getAdSyncSettings(tenantId);
  if (platform === "google")   return s.google   ? testGoogleConnection(s.google)     : { ok: false, error: "Not configured." };
  if (platform === "meta")     return s.meta     ? testMetaConnection(s.meta)         : { ok: false, error: "Not configured." };
  if (platform === "linkedin") return s.linkedin ? testLinkedInConnection(s.linkedin) : { ok: false, error: "Not configured." };
  return { ok: false, error: "Unknown platform." };
}

// ── Conversion feedback ─────────────────────────────────────────────────────────

export async function getConversionConfigAction(tenantId: string): Promise<ConversionConfig | null> {
  await getRequiredAdminSession();
  return getConversionConfig(tenantId);
}

export async function saveConversionConfigAction(
  tenantId:    string,
  conversions: ConversionConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const ok = await setConversionConfig(tenantId, conversions);
  if (!ok) return { ok: false, error: "Save failed." };
  revalidatePath(path(tenantId));
  return { ok: true };
}

/** Run the push now (manual trigger), returning a per-platform result summary. */
export async function syncNowAction(
  tenantId: string,
): Promise<{ ok: true; membersTotal: number; results: PlatformSyncResult[] } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const summary = await runTenantAdSync(tenantId, "manual");
  revalidatePath(path(tenantId));
  return { ok: true, membersTotal: summary.membersTotal, results: summary.results };
}
