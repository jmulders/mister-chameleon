/**
 * GET /api/cron/visitor-profile-purge
 *
 * GDPR/AVG retention cron for the Lead Base. Deletes `visitor_profiles` rows
 * whose retention TTL (`expires_at`) has passed — so pseudonymous profiles are
 * not kept longer than necessary (AVG art. 5(1)(e)). Default TTL is 90 days, set
 * at write time by the profile gate.
 *
 * Security: CRON_SECRET Bearer header (optional in non-production). Mirror of
 * the form-submission-purge cron. See docs/lead-base-design.md.
 *
 * Vercel cron (vercel.json):
 *   { "path": "/api/cron/visitor-profile-purge", "schedule": "0 3 * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredVisitorProfiles } from "@/lib/lead-base/visitor-profiles-store";
import { logger }                      from "@/lib/logger";

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
    const deleted = await purgeExpiredVisitorProfiles();
    const durationMs = Date.now() - startedAt;
    logger.info("[visitor-profile-purge] Completed", { deleted, durationMs });
    return NextResponse.json({ ok: true, deleted, durationMs, runAt: new Date().toISOString() });
  } catch (err) {
    logger.error("[visitor-profile-purge] Unexpected error", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
