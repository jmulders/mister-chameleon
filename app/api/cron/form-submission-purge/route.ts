/**
 * GET /api/cron/form-submission-purge
 *
 * GDPR-compliance cron job.
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   For every tenant that has configured a `submissionRetentionDays` setting > 0
 *   in `tenant_form_settings`, deletes all `form_submissions` rows where
 *   created_at < now() - retention_days.
 *
 *   This ensures persoonsgegevens (personal data) are not stored longer than
 *   necessary, in line with AVG (GDPR) article 5(1)(e).
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Authenticated via CRON_SECRET header (Bearer token).
 *   Set CRON_SECRET in env.  Configure your cron provider (e.g. Vercel Cron,
 *   GitHub Actions, or an external scheduler) to pass it as:
 *     Authorization: Bearer <CRON_SECRET>
 *
 *   In development, CRON_SECRET is optional — the endpoint accepts requests
 *   without auth when NODE_ENV !== "production".
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Trigger daily (e.g. 03:00 UTC):
 *     GET https://your-app.com/api/cron/form-submission-purge
 *     Authorization: Bearer <CRON_SECRET>
 *
 *   Vercel cron (vercel.json):
 *     { "path": "/api/cron/form-submission-purge", "schedule": "0 3 * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { purgeAllExpiredSubmissions } from "@/data/repositories/form-submissions-repository";
import { logger }                    from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Auth helper ────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${cronSecret}`;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const client = createClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false } },
    );

    const result = await purgeAllExpiredSubmissions(client);

    if (!result.ok) {
      logger.error("[form-submission-purge] purgeAllExpiredSubmissions failed", {
        error: result.error,
      });
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    const durationMs = Date.now() - startedAt;

    logger.info("[form-submission-purge] Completed", {
      totalDeleted: result.data.totalDeleted,
      durationMs,
    });

    return NextResponse.json({
      ok:           true,
      totalDeleted: result.data.totalDeleted,
      durationMs,
      runAt:        new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[form-submission-purge] Unexpected error", { error: String(err) });
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
