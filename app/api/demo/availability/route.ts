/**
 * GET /api/demo/availability?date=YYYY-MM-DD
 *
 * Returns available 30-minute demo booking slots for the given date.
 * Slots are in HH:MM format (24h), local time (Europe/Amsterdam by default).
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   200  { ok: true, slots: ["09:00", "09:30", ...], date: "YYYY-MM-DD" }
 *   400  { error: "..." }  — missing or malformed date
 *   500  { error: "..." }  — Google Calendar API error
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Responses are cached for 60 seconds in the CDN/browser.
 *   Short TTL so that a newly booked slot is unavailable within a minute
 *   for the next person visiting the booking page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots }         from "@/lib/google-calendar/availability";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Missing required query parameter: date (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  // Basic format validation — the library does a deeper check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Reject dates in the past (allow today — some slots today may still be future)
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return NextResponse.json(
      { ok: true, slots: [], date },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=3600" },
      },
    );
  }

  const result = await getAvailableSlots(date);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result, {
    status:  200,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
  });
}
