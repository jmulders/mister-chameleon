/**
 * Lead Base unit tests — hot-lead scoring + the GDPR/AVG write gate.
 *
 * Pure-function tests, no DB. Run via: npm test
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { leadScore, scoreClass, type ScorableProfile } from "@/lib/lead-base/lead-scoring";
import { gateProfileWrite, type ProfileCandidate }     from "@/lib/lead-base/profile-gate";
import type { ConsentState } from "@/tracking/consent-types";

const NOW = Date.parse("2026-06-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function consent(parts: Partial<ConsentState> = {}): ConsentState {
  return { hasResponded: true, analytics: false, personalization: false, enrichment: false, ...parts };
}

// ── leadScore ───────────────────────────────────────────────────────────────────

describe("leadScore", () => {
  it("cold anonymous visitor (no intent, long ago) → 0", () => {
    const p: ScorableProfile = { identityLevel: "anonymous", intentScore: null, lastSeenAt: hoursAgo(24 * 60), visitCount: 1 };
    assert.strictEqual(leadScore(p, NOW), 0);
  });

  it("hot known lead (high intent, just now, returning) scores high", () => {
    const p: ScorableProfile = { identityLevel: "known", intentScore: 90, lastSeenAt: hoursAgo(1), visitCount: 5 };
    // 30 (known) + 36 (intent) + 15 (recency<1d) + 4 (engagement) = 85
    assert.strictEqual(leadScore(p, NOW), 85);
  });

  it("is monotonic in identity depth, all else equal", () => {
    const base = (lvl: ScorableProfile["identityLevel"]): ScorableProfile =>
      ({ identityLevel: lvl, intentScore: 20, lastSeenAt: hoursAgo(2), visitCount: 1 });
    assert.ok(leadScore(base("anonymous"), NOW) < leadScore(base("recognised"), NOW));
    assert.ok(leadScore(base("recognised"), NOW) < leadScore(base("known"), NOW));
    assert.ok(leadScore(base("known"), NOW) < leadScore(base("customer"), NOW));
  });

  it("never exceeds 100", () => {
    const p: ScorableProfile = { identityLevel: "customer", intentScore: 100, lastSeenAt: hoursAgo(0), visitCount: 99 };
    assert.ok(leadScore(p, NOW) <= 100);
  });

  it("scoreClass bands", () => {
    assert.match(scoreClass(70), /red/);
    assert.match(scoreClass(40), /amber/);
    assert.match(scoreClass(10), /neutral/);
  });
});

// ── gateProfileWrite ──────────────────────────────────────────────────────────────

describe("gateProfileWrite", () => {
  const company: ProfileCandidate = {
    tenantId: "t1", visitorKey: "v1", identityLevel: "recognised", status: "visitor",
    companyName: "Acme BV", geoCountry: "NL",
  };

  it("drops firmographics without enrichment consent (IP-recognised)", () => {
    const patch = gateProfileWrite(company, consent({ enrichment: false }));
    assert.strictEqual(patch.companyName, undefined);
    assert.strictEqual(patch.geoCountry, undefined);
  });

  it("keeps firmographics with enrichment consent", () => {
    const patch = gateProfileWrite(company, consent({ enrichment: true }));
    assert.strictEqual(patch.companyName, "Acme BV");
    assert.strictEqual(patch.geoCountry, "NL");
  });

  it("ABM known lead (abmLeadId) keeps company without consent, but still drops IP geo", () => {
    const abm: ProfileCandidate = { ...company, identityLevel: "known", abmLeadId: "lead-1" };
    const patch = gateProfileWrite(abm, consent({ enrichment: false }));
    assert.strictEqual(patch.companyName, "Acme BV"); // first-party → allowed
    assert.strictEqual(patch.geoCountry, undefined);  // IP-derived → still gated
  });

  it("behavioural fields require personalization consent", () => {
    const cand: ProfileCandidate = { tenantId: "t1", visitorKey: "v1", intentScore: 42, funnelStage: "intent" };
    assert.strictEqual(gateProfileWrite(cand, consent({ personalization: false })).intentScore, undefined);
    assert.strictEqual(gateProfileWrite(cand, consent({ personalization: true })).intentScore, 42);
  });
});
