/**
 * GET /api/demo/[demoId]
 *
 * Public endpoint — returns demo instance data for the viewer.
 *
 * ─── Response (200) ───────────────────────────────────────────────────────────
 *
 *   Full DemoInstance JSON object (scenarios, brand colours, site metadata).
 *
 * ─── Expiry (410 Gone) ────────────────────────────────────────────────────────
 *
 *   If the demo has expired (expires_at < now), returns 410 Gone.
 *   The demo viewer page shows an expiry message in this case.
 *
 * ─── Not Found (404) ──────────────────────────────────────────────────────────
 *
 *   If no demo with the given ID exists, returns 404.
 *
 * ─── Auth ──────────────────────────────────────────────────────────────────────
 *
 *   No auth — demos are public by design.  The ID is the access token.
 *   No sensitive data is stored in demo_instances (see migration 048 notes).
 *
 * ─── View count ───────────────────────────────────────────────────────────────
 *
 *   Each successful GET increments view_count (fire-and-forget, non-blocking).
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Cache-Control: public, max-age=60, stale-while-revalidate=300
 *   Demos are static once generated — 60s edge cache is safe and fast.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { getDemoById, bumpViewCount } from "@/demo/store";

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req:    NextRequest,
  { params }: { params: Promise<{ demoId: string }> },
): Promise<NextResponse> {
  const { demoId } = await params;

  if (!demoId || typeof demoId !== "string" || demoId.length < 4) {
    return NextResponse.json({ error: "Invalid demo ID" }, { status: 400 });
  }

  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Fetch demo ──────────────────────────────────────────────────────────────

  let demo;
  try {
    // getDemoById returns null for both "not found" and "expired"
    // We need to distinguish them to return 404 vs 410.
    demo = await getDemoById(client, demoId);
  } catch (err) {
    console.error("[api/demo/[demoId]] getDemoById failed", {
      demoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Check raw expiry separately so we can return 410 vs 404
  if (!demo) {
    // Distinguish: check if a row exists but is expired
    const { data: raw } = await client
      .from("demo_instances")
      .select("id, expires_at")
      .eq("id", demoId)
      .maybeSingle();

    if (raw) {
      // Row exists but expired
      return NextResponse.json(
        { error: "This demo has expired.", expired: true },
        {
          status:  410,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    // No row at all
    return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  }

  // ── Bump view count (fire-and-forget) ───────────────────────────────────────

  void bumpViewCount(client, demoId, demo.view_count);

  // ── Return ───────────────────────────────────────────────────────────────────

  return NextResponse.json(demo, {
    status:  200,
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
