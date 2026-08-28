/**
 * GET /api/cron/cbs-location-ingest
 *
 * Yearly ingestion of CBS StatLine buurt statistics into cbs_area_stats, which
 * feeds the first-party location enricher. CBS figures are annual, so this runs
 * at most once per ~year: a freshness guard skips when the newest row is younger
 * than the staleness window, making it safe to include in the daily cron.
 *
 * Configure the CBS dataset id + source year at platform level (cbs_location
 * settings). With no datasetId configured this is a no-op.
 *
 * Security: CRON_SECRET Bearer header (optional in non-production).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { ingestCbsAreaStats, DEFAULT_CBS_DATASET } from "@/lib/enrichment/cbs-ingest";
import { getPlatformCbsLocationSettings } from "@/platform/platform-store";
import { logger }                    from "@/lib/logger";

export const dynamic     = "force-dynamic";
export const runtime     = "nodejs";
export const maxDuration = 60;

const STALE_AFTER_MS = 300 * 24 * 60 * 60 * 1_000; // ~10 months

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const startedAt = Date.now();
  const client = makeClient();

  try {
    // Freshness guard — skip if we already have recent data (unless forced).
    if (!force) {
      try {
        const { data } = await client
          .from("cbs_area_stats")
          .select("refreshed_at")
          .order("refreshed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const newest = data?.refreshed_at ? Date.parse(data.refreshed_at) : NaN;
        if (Number.isFinite(newest) && Date.now() - newest < STALE_AFTER_MS) {
          return NextResponse.json({ ok: true, skipped: "fresh", newest: data?.refreshed_at });
        }
      } catch { /* table missing / empty → proceed */ }
    }

    const settingsResult = await getPlatformCbsLocationSettings();
    const settings = settingsResult.ok ? settingsResult.data : {};

    const result = await ingestCbsAreaStats(client, {
      datasetId:  settings.datasetId?.trim() || DEFAULT_CBS_DATASET,
      sourceYear: settings.sourceYear ?? new Date().getUTCFullYear(),
    });

    const durationMs = Date.now() - startedAt;
    logger.info("[cbs-location-ingest] Completed", { ...result, durationMs });
    return NextResponse.json({ ok: true, ...result, durationMs, runAt: new Date().toISOString() });
  } catch (err) {
    logger.error("[cbs-location-ingest] Failed", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
