/**
 * GET /api/cron/daily — one cron to run them all.
 *
 * ─── Waarom deze bestaat ──────────────────────────────────────────────────────
 *
 * Vercel Hobby staat maar een handvol cron-jobs toe. We hadden er vier nodig
 * (billing-renewal, de twee AVG-purges, ad-sync) — over de limiet. In plaats van
 * er een te schrappen, roept deze ene dagelijkse cron ze allemaal op volgorde aan.
 * Zo staat er in vercel.json één cron, ruim binnen de limiet, en blijven de
 * losse endpoints los aanroepbaar (de "Run"-knop in Vercel, of handmatig).
 *
 * De jobs draaien in deze functie zelf (lib/cron/daily-jobs.ts), niet via een
 * fetch naar de eigen origin: wat daar tussen zat kon in plaats van de job
 * antwoorden zonder dat iemand het zag. Elke run wordt vastgelegd
 * (lib/cron/daily-run-store.ts) en staat op /admin/platform/system. Faalt er
 * een job, dan antwoordt deze cron 500, zodat Vercel de run als mislukt toont.
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 * Vercel stuurt cron-verzoeken met `Authorization: Bearer <CRON_SECRET>` zodra
 * CRON_SECRET als env var is gezet. Die header verifiëren we hier, en we geven
 * hem door aan elke job — die checkt hetzelfde secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { DAILY_JOB_PATHS, runDailyJobs } from "@/lib/cron/daily-run";
import { invokeDailyJob }                from "@/lib/cron/daily-jobs";
import { saveDailyRun }                  from "@/lib/cron/daily-run-store";
import { logger }                        from "@/lib/logger";

export const dynamic     = "force-dynamic";
export const runtime     = "nodejs";
// De jobs lopen na elkaar in deze ene functie (Hobby staat tot 60s toe).
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

  // Sequentieel, niet parallel: de jobs raken deels dezelfde tabellen, en één cron
  // die netjes op volgorde loopt is voorspelbaarder dan acht die door elkaar rennen.
  const record   = await runDailyJobs(DAILY_JOB_PATHS, (path) => invokeDailyJob(path, request));
  const recorded = await saveDailyRun(record);

  if (!record.ok) {
    logger.error("[cron/daily] jobs failed", {
      failed: record.results.filter((r) => !r.ok).map((r) => `${r.path}: ${r.error ?? r.status}`),
    });
  }

  return NextResponse.json({ ...record, recorded }, { status: record.ok ? 200 : 500 });
}
