/**
 * GET /api/cron/ip-company-cache-purge
 *
 * Retention sweep for the durable first-party company DB (ip_company_cache).
 * Deletes rows past hard-retention (matched > 180 days, no-match > 30 days since
 * the last verification). Expired rows already read as a miss, so this only
 * reclaims space — a later lookup rebuilds the row via a paid call.
 *
 * Security: CRON_SECRET Bearer header (optional in non-production). Mirrors the
 * other purge crons; invoked by /api/cron/daily.
 */

import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredIpCompanyRows } from "@/enrichment/ip-company-store";
import { logger }                    from "@/lib/logger";

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
    const { matched, noMatch } = await purgeExpiredIpCompanyRows();
    const durationMs = Date.now() - startedAt;
    logger.info("[ip-company-cache-purge] Completed", { matched, noMatch, durationMs });
    return NextResponse.json({
      ok: true, deleted: matched + noMatch, matched, noMatch, durationMs, runAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[ip-company-cache-purge] Unexpected error", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
