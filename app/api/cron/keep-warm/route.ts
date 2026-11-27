/**
 * GET /api/cron/keep-warm
 *
 * Serverless functions on Vercel are stopped after a while without requests;
 * the next visitor then waits for one to start (seconds). This endpoint
 * requests the production homepage, so the function that renders it stays
 * awake and the remembered configuration stays fresh.
 *
 * What a ping costs: nothing but the render. It carries the warm-up header
 * (lib/warmup/warmup-request.ts, derived from CRON_SECRET), and the homepage
 * pipeline answers such a request with the default experience: no AI call, no
 * enrichment credit, no counted session, no analytics row.
 *
 * The answer is 200 only when every target answered 200. A target that the
 * Vercel Firewall challenged is reported as such (`mitigated`), because a
 * challenge page warms nothing; the answer is 502 then, so the scheduler that
 * calls this shows the failure.
 *
 * No login, on purpose. The caller is an outside scheduler, and the only key
 * this platform has for such calls (CRON_SECRET) also opens the billing jobs;
 * that key does not belong at a third party. Nothing here needs guarding: one
 * call renders the homepage once, which anyone can do by visiting it, the
 * targets come from the environment and not from the request, and the proxy
 * rate-limits /api/* per address like every other endpoint.
 *
 * Config:
 *   KEEP_WARM_URLS  comma-separated list of site origins to warm.
 *                   Default: "https://www.misterchameleon.nl".
 *   CRON_SECRET     The source of the warm-up header. Never leaves the server.
 *
 * Who calls it: an outside scheduler, every five minutes (see
 * docs/operator-infra-handleiding.md). Vercel's own cron runs daily at most
 * on the Hobby plan, and GitHub's scheduler ran the "hourly" billing job two
 * or three times a day in November 2026, so neither can keep a function awake.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { WARMUP_HEADER, warmupToken } from "@/lib/warmup/warmup-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TARGETS = ["https://www.misterchameleon.nl"];

function targets(): string[] {
  const raw = process.env["KEEP_WARM_URLS"];
  if (!raw) return DEFAULT_TARGETS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(): Promise<NextResponse> {
  // Without the token the homepage would treat the ping as a visitor: a
  // counted session and an AI call each time. Then it is better not to ping.
  const token = warmupToken() ?? (process.env["NODE_ENV"] !== "production" ? "1" : null);
  if (!token) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 500 });
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
            [WARMUP_HEADER]: token,
            "user-agent": "MisterChameleon-KeepWarm/1.0",
          },
          cache: "no-store",
          redirect: "follow",
        });
        // Drain the body so the whole render completes.
        await res.text().catch(() => "");
        const mitigated = res.headers.get("x-vercel-mitigated");
        return { url, status: res.status, ms: Date.now() - t0, ...(mitigated ? { mitigated } : {}) };
      } catch (err) {
        return { url, error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 };
      }
    }),
  );

  const durationMs = Date.now() - startedAt;
  const ok = results.every((r) => "status" in r && r.status === 200);
  if (ok) logger.info("[keep-warm] Completed", { results, durationMs });
  else    logger.warn("[keep-warm] A target did not answer 200", { results, durationMs });
  return NextResponse.json(
    { ok, results, durationMs, runAt: new Date().toISOString() },
    { status: ok ? 200 : 502 },
  );
}
