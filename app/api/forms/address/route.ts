/**
 * POST /api/forms/address — street and town for a Dutch postcode + house number.
 *
 * Called by a form that has a postcode field and a house-number field, as soon
 * as both are filled in (components/blocks/forms/useAddressAutofill.ts). The
 * form fills in the street and the town, or tells the visitor that the address
 * does not exist. The lookup itself lives in lib/forms/address-lookup.ts.
 *
 * POST with a JSON body, not GET: a postcode with a house number points at a
 * household, and a query string ends up in access logs. Nothing is stored.
 *
 * Answers, always HTTP 200 unless the request itself is wrong:
 *   { status: "ok", postcode, houseNumber, street, city }
 *   { status: "not_found" }   the combination does not exist
 *   { status: "invalid" }     not a postcode and a number (yet)
 *   { status: "error" }       the address register did not answer: the form
 *                             carries on without the check
 *
 * At most LOOKUPS_PER_WINDOW per client per ten minutes. Over that the answer
 * is "error", so the form still works, only without the help.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveClientIp }           from "@/forms/spam";
import { lookupDutchAddress }        from "@/lib/forms/address-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

// A visitor correcting a typo asks a handful of times. Sixty is far above that
// and far below what makes this an address service for someone else.
const LOOKUPS_PER_WINDOW = 60;
const WINDOW_MS          = 10 * 60 * 1_000;
const MAX_CLIENTS        = 5_000;
const seen = new Map<string, number[]>();

function allowed(ip: string, now: number): boolean {
  const recent = (seen.get(ip) ?? []).filter((t) => t > now - WINDOW_MS);
  if (recent.length >= LOOKUPS_PER_WINDOW) { seen.set(ip, recent); return false; }
  recent.push(now);
  if (!seen.has(ip) && seen.size >= MAX_CLIENTS) {
    const oldest = seen.keys().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  seen.set(ip, recent);
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400, headers: HEADERS });
  }
  const { postcode, houseNumber } = (body ?? {}) as { postcode?: unknown; houseNumber?: unknown };
  if (typeof postcode !== "string" || typeof houseNumber !== "string" || postcode.length > 12 || houseNumber.length > 12) {
    return NextResponse.json({ status: "invalid" }, { headers: HEADERS });
  }

  if (!allowed(resolveClientIp(req.headers), Date.now())) {
    return NextResponse.json({ status: "error" }, { headers: HEADERS });
  }

  const result = await lookupDutchAddress(postcode, houseNumber);
  return NextResponse.json(result, { headers: HEADERS });
}
