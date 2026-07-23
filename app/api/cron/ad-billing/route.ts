/**
 * GET /api/cron/ad-billing — meter unbilled ad events against advertiser wallets.
 *
 * Called by the daily cron orchestrator (/api/cron/daily) and runnable manually
 * from Vercel. Auth: Authorization: Bearer <CRON_SECRET> (same as the other crons).
 */

import { NextRequest, NextResponse } from "next/server";
import { rollupAdBilling } from "@/lib/ads/rollup";
import { logger } from "@/lib/logger";

export const dynamic     = "force-dynamic";
export const runtime     = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !secret) return true;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await rollupAdBilling();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("[cron/ad-billing] failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "rollup_failed" }, { status: 500 });
  }
}
