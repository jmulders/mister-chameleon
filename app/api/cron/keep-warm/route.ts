/**
 * GET /api/cron/keep-warm
 *
 * Keep-warm cron. Serverless functions on Vercel are recycled after a few
 * minutes of inactivity; the next visitor then pays a cold start (seconds),
 * and on a cold ISR window the render also re-fetches Sanity. This cron pings
 * the production homepage(s) on a schedule so the render function stays warm and
 * the Sanity/data caches stay primed — keeping first-visit TTFB low.
 *
 * How it warms things:
 *   - It fetches the real homepage URL, so the exact render path runs and all
 *     its Sanity fetches (site settings, home page, block variants) refresh the
 *     shared Next data cache for everyone.
 *   - The `x-mc-warmup: 1` header marks the request as a warm-up: the homepage
 *     pipeline disables billing for it, so keep-warm pings never consume
 *     enrichment credits (see lib/pipeline/homepage-pipeline.ts).
 *
 * Config:
 *   KEEP_WARM_URLS  comma-separated list of URLs to warm.
 *                   Default: "https://www.misterchameleon.nl".
 *   CRON_SECRET     Bearer auth (required in production; see the other crons).
 *
 * Vercel cron (vercel.json):
 *   { "path": "/api/cron/keep-warm", "schedule": "*\/5 * * * *" }
 *   Frequent schedules (every few minutes) require a Vercel Pro plan. On Hobby,
 *   use an external uptime pinger hitting the homepage instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TARGETS = ["https://www.misterchameleon.nl"];

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${cronSecret}`;
}

function targets(): string[] {
  const raw = process.env["KEEP_WARM_URLS"];
  if (!raw) return DEFAULT_TARGETS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const results = await Promise.all(
    targets().map(async (base) => {
      const url = base.replace(/\/+$/, "") + "/?__warm=1";
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-mc-warmup": "1",
            "user-agent": "MisterChameleon-KeepWarm/1.0",
          },
          cache: "no-store",
          redirect: "follow",
        });
        // Drain the body so the full render (and its Sanity fetches) completes.
        await res.text().catch(() => "");
        return { url, status: res.status, ms: Date.now() - t0 };
      } catch (err) {
        return { url, error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 };
      }
    }),
  );

  const durationMs = Date.now() - startedAt;
  logger.info("[keep-warm] Completed", { results, durationMs });
  return NextResponse.json({ ok: true, results, durationMs, runAt: new Date().toISOString() });
}
