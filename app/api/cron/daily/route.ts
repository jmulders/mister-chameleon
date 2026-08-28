/**
 * GET /api/cron/daily — one cron to run them all.
 *
 * ─── Waarom deze bestaat ──────────────────────────────────────────────────────
 *
 * Vercel Hobby staat maar een handvol cron-jobs toe. We hadden er vier nodig
 * (billing-renewal, de twee AVG-purges, ad-sync) — over de limiet. In plaats van
 * er een te schrappen, roept deze ene dagelijkse cron ze allemaal op volgorde aan
 * via een interne, geauthenticeerde fetch. Zo staat er in vercel.json één cron,
 * ruim binnen de limiet, en blijven de losse endpoints los aanroepbaar (de
 * "Run"-knop in Vercel, of handmatig).
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 * Vercel stuurt cron-verzoeken met `Authorization: Bearer <CRON_SECRET>` zodra
 * CRON_SECRET als env var is gezet. Die header verifiëren we hier, en we sturen
 * hem door naar elk sub-endpoint — die checken hetzelfde secret.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const runtime     = "nodejs";
// Vier sequentiële sub-jobs: geef de functie ruim de tijd (Hobby staat tot 60s toe).
export const maxDuration = 60;

// Volgorde is bewust: billing eerst (raakt de administratie), dan opruimen, dan sync.
const JOBS = [
  "/api/cron/billing-renewal",
  "/api/cron/subscription-reconcile",
  "/api/cron/form-submission-purge",
  "/api/cron/visitor-profile-purge",
  "/api/cron/ip-company-cache-purge",
  "/api/cron/ad-sync",
  "/api/cron/ad-billing",
] as const;

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

  const origin = new URL(request.url).origin;
  const auth   = request.headers.get("authorization") ?? "";

  const results: Array<{ path: string; status: number; ok: boolean; error?: string }> = [];

  // Sequentieel, niet parallel: de jobs raken deels dezelfde tabellen, en één cron
  // die netjes op volgorde loopt is voorspelbaarder dan vier die door elkaar rennen.
  for (const path of JOBS) {
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { authorization: auth },
        cache:   "no-store",
      });
      results.push({ path, status: res.status, ok: res.ok });
    } catch (err) {
      // Eén job die faalt mag de rest niet tegenhouden.
      results.push({ path, status: 0, ok: false, error: (err as Error).message });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, ran: results.length, failed, results });
}
