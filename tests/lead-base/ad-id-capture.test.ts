/**
 * Ad-ID capture — first-touch ad click identifiers (gclid/fbclid/msclkid/ttclid).
 *
 * Covers the capture point (detectVisitorContext), the consent gate
 * (gateProfileWrite), and the channel classifier (classifyChannel). The store
 * upsert (first-touch coalesce) and the conversion wiring are exercised by the
 * type checker + integration paths; here we lock the pure units.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { detectVisitorContext } from "@/context/detect-context";
import { classifyChannel }      from "@/lib/lead-base/channel";
import { gateProfileWrite, type ProfileCandidate } from "@/lib/lead-base/profile-gate";
import type { ConsentState }    from "@/tracking/consent-types";

function consent(parts: Partial<ConsentState> = {}): ConsentState {
  return { hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false, ...parts };
}

// ── detectVisitorContext — click-id capture ───────────────────────────────────

describe("detectVisitorContext — ad click ids", () => {
  it("captures gclid/fbclid/msclkid/ttclid from the landing URL", () => {
    const req = new Request(
      "https://tenant.example/?gclid=G-abc&fbclid=F-def&msclkid=M-ghi&ttclid=T-jkl",
    );
    const ctx = detectVisitorContext(req);
    assert.strictEqual(ctx.gclid,   "G-abc");
    assert.strictEqual(ctx.fbclid,  "F-def");
    assert.strictEqual(ctx.msclkid, "M-ghi");
    assert.strictEqual(ctx.ttclid,  "T-jkl");
  });

  it("defaults to null when the params are absent", () => {
    const ctx = detectVisitorContext(new Request("https://tenant.example/pricing"));
    assert.strictEqual(ctx.gclid,   null);
    assert.strictEqual(ctx.fbclid,  null);
    assert.strictEqual(ctx.msclkid, null);
    assert.strictEqual(ctx.ttclid,  null);
  });

  it("trims whitespace, drops empties and caps overlong tokens", () => {
    const long = "x".repeat(1000);
    const req = new Request(
      `https://tenant.example/?gclid=${encodeURIComponent("  G-trim  ")}&fbclid=&msclkid=${long}`,
    );
    const ctx = detectVisitorContext(req);
    assert.strictEqual(ctx.gclid, "G-trim");
    assert.strictEqual(ctx.fbclid, null);              // empty → null
    assert.strictEqual(ctx.msclkid?.length, 512);      // capped
  });
});

// ── classifyChannel — click ids are the strongest paid signal ─────────────────

describe("classifyChannel — ad click ids", () => {
  it("gclid → paid_search", () => {
    assert.strictEqual(classifyChannel({ gclid: "G-1" }), "paid_search");
  });
  it("msclkid → paid_search", () => {
    assert.strictEqual(classifyChannel({ msclkid: "M-1" }), "paid_search");
  });
  it("fbclid → paid_social", () => {
    assert.strictEqual(classifyChannel({ fbclid: "F-1" }), "paid_social");
  });
  it("ttclid → paid_social", () => {
    assert.strictEqual(classifyChannel({ ttclid: "T-1" }), "paid_social");
  });
  it("a click id outranks an organic referrer", () => {
    assert.strictEqual(
      classifyChannel({ gclid: "G-1", referrerDomain: "google.com" }),
      "paid_search",
    );
  });
});

// ── gateProfileWrite — click ids follow the attribution consent basis ─────────

describe("gateProfileWrite — ad click ids", () => {
  const cand: ProfileCandidate = {
    tenantId: "t1", visitorKey: "v1",
    gclid: "G-1", fbclid: "F-1", msclkid: "M-1", ttclid: "T-1",
  };

  it("drops click ids without analytics/personalization consent", () => {
    const patch = gateProfileWrite(cand, consent());
    assert.strictEqual(patch.gclid,   undefined);
    assert.strictEqual(patch.fbclid,  undefined);
    assert.strictEqual(patch.msclkid, undefined);
    assert.strictEqual(patch.ttclid,  undefined);
  });

  it("keeps click ids with analytics consent", () => {
    const patch = gateProfileWrite(cand, consent({ analytics: true }));
    assert.strictEqual(patch.gclid,   "G-1");
    assert.strictEqual(patch.fbclid,  "F-1");
    assert.strictEqual(patch.msclkid, "M-1");
    assert.strictEqual(patch.ttclid,  "T-1");
  });

  it("keeps click ids with personalization consent", () => {
    const patch = gateProfileWrite(cand, consent({ personalization: true }));
    assert.strictEqual(patch.gclid, "G-1");
    assert.strictEqual(patch.ttclid, "T-1");
  });
});
