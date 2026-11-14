/**
 * lib/cron/daily-jobs.ts
 *
 * Runs one daily job inside the function that is already running, by calling
 * the job's own route handler.
 *
 * The dispatcher used to fetch each job over HTTP from its own origin. That
 * put the firewall, deployment protection and whichever hostname the cron
 * arrived on between the dispatcher and its jobs, and any of them answering in
 * the job's place went unnoticed. Calling the handler keeps the job's own
 * checks (it still verifies the secret) and removes the trip.
 *
 * Each handler is loaded on demand, so a job whose module fails to load fails
 * alone.
 */

import { NextRequest } from "next/server";
import type { DailyJobPath } from "./daily-run";

type Handler = { GET: (request: NextRequest) => Promise<Response> };

const HANDLERS: Record<DailyJobPath, () => Promise<Handler>> = {
  "/api/cron/billing-renewal":        () => import("@/app/api/cron/billing-renewal/route"),
  "/api/cron/subscription-reconcile": () => import("@/app/api/cron/subscription-reconcile/route"),
  "/api/cron/form-submission-purge":  () => import("@/app/api/cron/form-submission-purge/route"),
  "/api/cron/visitor-profile-purge":  () => import("@/app/api/cron/visitor-profile-purge/route"),
  "/api/cron/ip-company-cache-purge": () => import("@/app/api/cron/ip-company-cache-purge/route"),
  "/api/cron/rate-limit-cleanup":     () => import("@/app/api/cron/rate-limit-cleanup/route"),
  "/api/cron/ad-sync":                () => import("@/app/api/cron/ad-sync/route"),
  "/api/cron/ad-billing":             () => import("@/app/api/cron/ad-billing/route"),
};

/** Call one job with the credentials the cron itself was called with. */
export async function invokeDailyJob(path: string, incoming: NextRequest): Promise<Response> {
  const load = HANDLERS[path as DailyJobPath];
  if (!load) throw new Error(`unknown daily job: ${path}`);
  const { GET } = await load();
  const request = new NextRequest(new URL(path, incoming.url), {
    headers: { authorization: incoming.headers.get("authorization") ?? "" },
  });
  return GET(request);
}
