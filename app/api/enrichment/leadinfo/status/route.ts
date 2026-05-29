/**
 * GET /api/enrichment/leadinfo/status
 *
 * Reads the mc_li httpOnly cookie and returns its decoded state.
 * Used by the Leadinfo test panel in the admin UI to check whether the
 * LeadinfoProvider identify flow wrote a result after loading the site in
 * a hidden same-origin iframe.
 *
 * ─── Why this endpoint exists ────────────────────────────────────────────────
 *
 *   The mc_li cookie is httpOnly — client-side JavaScript cannot read it.
 *   This route runs server-side, reads the cookie from incoming headers,
 *   decodes the compact serialization, and returns human-readable fields.
 *
 *   The admin test panel polls this endpoint every 1.5 s while the iframe
 *   is loading, terminating as soon as the cookie appears or after 20 s.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   - Read-only — no side effects, no cookie writes.
 *   - Returns firmographic fields only — the same data LeadinfoProvider stores.
 *   - No CORS header: intended for same-origin admin tooling only.
 */

import { NextRequest, NextResponse } from "next/server";
import { LEADINFO_COOKIE, parseLeadinfoCookie } from "@/context/leadinfo-context";

// ── Response shape ─────────────────────────────────────────────────────────────

interface LeadinfoStatusData {
  matched:        boolean;
  companyName:    string | null;
  companyDomain:  string | null;
  companyCountry: string | null;
}

interface LeadinfoStatusResponse {
  /** Whether the mc_li cookie is present and parseable. */
  present: boolean;
  /**
   * Decoded cookie fields.
   * null when the cookie is absent OR present but unparseable (corrupted /
   * version mismatch — treated as effectively absent by the admin panel).
   */
  data: LeadinfoStatusData | null;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
): Promise<NextResponse<LeadinfoStatusResponse>> {
  const cookieVal = request.cookies.get(LEADINFO_COOKIE)?.value ?? null;

  if (!cookieVal) {
    return NextResponse.json({ present: false, data: null });
  }

  const parsed = parseLeadinfoCookie(cookieVal);

  if (!parsed) {
    // Cookie exists but couldn't be decoded (corrupted / incompatible version).
    // Report as absent so the admin panel keeps polling or shows "no result".
    return NextResponse.json({ present: true, data: null });
  }

  return NextResponse.json({
    present: true,
    data: {
      matched:        parsed.matched,
      companyName:    parsed.companyName,
      companyDomain:  parsed.companyDomain,
      companyCountry: parsed.companyCountry,
    },
  });
}
