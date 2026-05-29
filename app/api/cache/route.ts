/**
 * Cache Admin API Route
 *
 * GET  /api/cache — Return an aggregated snapshot of all in-process cache layers.
 * POST /api/cache — Dispatch a cache invalidation event.
 *
 * ─── Authentication ───────────────────────────────────────────────────────────
 *
 *   Both endpoints require the `x-admin-key` header to match the
 *   `ADMIN_SECRET` environment variable.  If the variable is not set, the
 *   endpoints return 503 (not exposed) to avoid accidental information leakage.
 *
 *   Do not expose this route publicly.  Use it behind a VPN, a Vercel
 *   protection bypass, or in admin tooling only.
 *
 * ─── GET response shape ──────────────────────────────────────────────────────
 *
 *   {
 *     generatedAt:     "2026-04-03T10:00:00.000Z",
 *     cmsCache:        { size, fresh, stale, ttlMs },
 *     sessionCache:    { size, fresh, stale, ttlMs, inGrace, staleGraceMs },
 *     decisionCache:   { size, fresh, stale, ttlMs },
 *     providerCaches:  { leadinfo: {...}, openKvk: {...}, ... }
 *   }
 *
 * ─── POST request body ────────────────────────────────────────────────────────
 *
 *   InvalidationEvent — see cache/types.ts for the discriminated union shape.
 *
 *   Examples:
 *     { "type": "cms-content-updated", "tenantId": "workengine" }
 *     { "type": "tenant-config-changed", "tenantId": "workengine" }
 *     { "type": "session-reset", "sessionId": "<uuid>" }
 *     { "type": "full-flush" }
 *     { "type": "full-flush", "tenantId": "workengine" }
 *
 *   Returns: { ok: true, dispatched: <event> }
 *
 * ─── Cache origin header ─────────────────────────────────────────────────────
 *
 *   The GET response includes `X-Cache-Layer: none` to indicate that the
 *   stats are always freshly computed (never cached).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllCacheStats }           from "@/cache/registry";
import { handleInvalidation }        from "@/cache/invalidation";
import type { InvalidationEvent }    from "@/cache/types";

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false; // not configured → deny all
  return request.headers.get("x-admin-key") === adminSecret;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized. Provide a valid x-admin-key header." },
    { status: 401 },
  );
}

function notExposedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Cache admin API is not enabled. Set ADMIN_SECRET to enable it." },
    { status: 503 },
  );
}

// ── GET — cache stats ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!process.env.ADMIN_SECRET) return notExposedResponse();
  if (!isAuthorized(request))    return unauthorizedResponse();

  const stats = getAllCacheStats();

  return NextResponse.json(stats, {
    status: 200,
    headers: {
      "X-Cache-Layer":  "none",
      "Cache-Control":  "no-store",
      "Content-Type":   "application/json",
    },
  });
}

// ── POST — invalidation ───────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.ADMIN_SECRET) return notExposedResponse();
  if (!isAuthorized(request))    return unauthorizedResponse();

  let event: InvalidationEvent;

  try {
    event = (await request.json()) as InvalidationEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!event?.type) {
    return NextResponse.json(
      { error: "Missing required field: type." },
      { status: 400 },
    );
  }

  try {
    await handleInvalidation(event);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalidation failed.", detail: String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, dispatched: event },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
