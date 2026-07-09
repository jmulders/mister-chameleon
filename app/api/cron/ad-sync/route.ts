/**
 * GET /api/cron/ad-sync
 *
 * Daily reconcile of ad-platform retargeting audiences. For every tenant with
 * ad-sync enabled, resolves its Lead Base segment and pushes the members to each
 * configured platform (Google Ads Customer Match, Meta Custom Audience, LinkedIn
 * DMP Segment). Mirrors HubSpot's scheduled ads-audience sync.
 *
 * Security: CRON_SECRET Bearer header (optional in non-production). Same pattern
 * as visitor-profile-purge. See docs/lead-base-design.md.
 *
 * Vercel cron (vercel.json):
 *   { "path": "/api/cron/ad-sync", "schedule": "30 3 * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { listEnabledAdSyncTenantIds } from "@/lib/ad-sync/ad-sync-store";
import { runTenantAdSync }            from "@/lib/ad-sync/sync-engine";
import { logger }                     from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const tenantIds = await listEnabledAdSyncTenantIds();

    // Sequential across tenants — keeps external API load predictable and stays
    // well within the function budget; each tenant's platforms already run in
    // sequence inside the engine.
    let tenantsProcessed = 0;
    let membersPushed = 0;
    const failures: Array<{ tenantId: string; platform: string; error: string }> = [];

    for (const tenantId of tenantIds) {
      const summary = await runTenantAdSync(tenantId, "cron");
      tenantsProcessed++;
      for (const r of summary.results) {
        if (r.status === "ok") membersPushed += r.membersSent;
        else if (r.status === "error") failures.push({ tenantId, platform: r.platform, error: r.error ?? "unknown" });
      }
    }

    const durationMs = Date.now() - startedAt;
    logger.info("[ad-sync-cron] Completed", { tenantsProcessed, membersPushed, failures: failures.length, durationMs });
    return NextResponse.json({
      ok: true,
      tenantsProcessed,
      membersPushed,
      failures,
      durationMs,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[ad-sync-cron] Unexpected error", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
