/**
 * GET /api/cron/rate-limit-cleanup
 *
 * Removes rate-limit counters whose window is over (see
 * lib/rate-limiting/cleanup.ts). Without it the table only grows: one row per
 * caller per minute, kept forever.
 *
 * Security: CRON_SECRET Bearer header (optional in non-production). Mirrors the
 * other purge crons; invoked by /api/cron/daily.
 */

import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredRateLimitCounters } from "@/lib/rate-limiting/cleanup";
import { logger }                        from "@/lib/logger";

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
    const deleted    = await purgeExpiredRateLimitCounters();
    const durationMs = Date.now() - startedAt;
    logger.info("[rate-limit-cleanup] Completed", { deleted, durationMs });
    return NextResponse.json({ ok: true, deleted, durationMs, runAt: new Date().toISOString() });
  } catch (err) {
    logger.error("[rate-limit-cleanup] Unexpected error", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
