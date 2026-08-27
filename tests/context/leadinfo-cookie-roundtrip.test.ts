/**
 * mc_li cookie round-trip through the REAL cookie encoding.
 *
 * Regression for the double-encode bug: serializeLeadinfoData used to
 * encodeURIComponent its own output, and NextResponse.cookies.set encodes AGAIN,
 * so the stored value was double-encoded (`%257B%2522…`). The server-side reader
 * sees the raw Cookie-header substring (parseCookieField does NOT decode) and the
 * parser decoded only once → JSON.parse failed → every leadinfo* field was null.
 *
 * These tests drive the actual Next.js cookie serialiser (NextResponse.cookies.set)
 * and read the value back the way each real reader does — NOT a hand-encoded
 * cookie — so a re-introduction of the double encode fails here.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
// The test loader resolves Next's package export via the explicit .js entry.
import { NextRequest, NextResponse } from "next/server.js";

import {
  serializeLeadinfoData,
  parseLeadinfoCookie,
  LEADINFO_COOKIE,
  type LeadinfoData,
} from "../../context/leadinfo-context.ts";

import { buildDecisionContext } from "../../decision/context/build-decision-context.ts";

function makeData(overrides: Partial<LeadinfoData> = {}): LeadinfoData {
  return {
    matched:         true,
    companyId:       "li_abc123",
    companyName:     "Nakatomi BV",
    companyCity:     "Amsterdam",
    companyDomain:   "nakatomi.example",
    companyCountry:  "NL",
    employees:       "11-50",
    employeesTotal:  42,
    salesVolume:     "1M-10M",
    cocNumber:       "12345678",
    branchCode:      "6201",
    branchCodeSic87: "7372",
    ...overrides,
  };
}

/** Set mc_li exactly as the API route does, then return the STORED value the
 *  browser would keep — i.e. what the browser echoes back in the Cookie header. */
function storedCookieValue(data: LeadinfoData): string {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LEADINFO_COOKIE, serializeLeadinfoData(data), {
    maxAge: 604800, path: "/", httpOnly: true, sameSite: "lax",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  // "mc_li=<value>; Max-Age=...; Path=/; ..."  → grab <value>
  const m = setCookie.match(/^mc_li=([^;]*)/);
  assert.ok(m, `set-cookie header missing mc_li: ${setCookie}`);
  return m[1];
}

describe("mc_li cookie — real encoding round-trip", () => {
  it("stores a SINGLE-encoded value (no double encoding)", () => {
    const stored = storedCookieValue(makeData());
    // Single-encoded JSON begins with the encoding of `{"` → %7B%22.
    // A double-encoded value would begin with %257B%2522 — the bug.
    assert.ok(stored.startsWith("%7B%22"), `expected single-encoded, got: ${stored.slice(0, 20)}`);
    assert.ok(!stored.startsWith("%257B"), "value is double-encoded (the bug)");
  });

  it("round-trips via the RAW Cookie-header substring (RSC pipeline path)", () => {
    // parseCookieField returns the raw substring WITHOUT decoding, so the parser
    // must recover the data from the single-encoded value itself.
    const stored = storedCookieValue(makeData());
    const parsed = parseLeadinfoCookie(stored);
    assert.equal(parsed?.companyName, "Nakatomi BV");
    assert.equal(parsed?.companyDomain, "nakatomi.example");
    assert.equal(parsed?.matched, true);
  });

  it("round-trips via NextRequest.cookies.get (already URL-decoded once)", () => {
    const stored = storedCookieValue(makeData());
    const req = new NextRequest("http://tenant.example/", {
      headers: { cookie: `${LEADINFO_COOKIE}=${stored}` },
    });
    const parsed = parseLeadinfoCookie(req.cookies.get(LEADINFO_COOKIE)?.value ?? null);
    assert.equal(parsed?.companyName, "Nakatomi BV");
    assert.equal(parsed?.companyCountry, "NL");
  });

  it("survives a company name containing a percent sign", () => {
    // "50% Off Ltd" — a literal % that must be encoded/decoded correctly.
    const stored = storedCookieValue(makeData({ companyName: "50% Off Ltd" }));
    assert.equal(parseLeadinfoCookie(stored)?.companyName, "50% Off Ltd");
  });

  it("legacy DOUBLE-encoded cookies still parse (tolerant reader)", () => {
    // Emulate a pre-fix cookie: encode twice.
    const legacy = encodeURIComponent(encodeURIComponent(JSON.stringify({ m: true, cn: "Legacy BV" })));
    const parsed = parseLeadinfoCookie(legacy);
    assert.equal(parsed?.matched, true);
    assert.equal(parsed?.companyName, "Legacy BV");
  });

  it("end-to-end: a valid mc_li fills leadinfo* context fields", async () => {
    const stored = storedCookieValue(makeData());
    const req = new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test" }) });
    const ctx = await buildDecisionContext({ request: req, cookieHeader: `${LEADINFO_COOKIE}=${stored}` });
    assert.equal(ctx.enrichment?.leadinfoCompanyName, "Nakatomi BV");
    assert.equal(ctx.enrichment?.leadinfoCompanyDomain, "nakatomi.example");
    assert.equal(ctx.enrichment?.leadinfoCompanyCountry, "NL");
    assert.equal(ctx.enrichment?.leadinfoMatched, true);
  });
});
