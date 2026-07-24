/**
 * Unit tests for pure behavioural ad targeting.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  matchesTargeting, isUntargeted, parseAdTargeting,
  type AdTargeting, type AdAudience,
} from "../../lib/ads/targeting.ts";

function aud(over: Partial<AdAudience> = {}): AdAudience {
  return { keywords: [], funnelStage: "awareness", pageviews: 1, returning: false, hasProfile: true, country: null, region: null, company: null, ...over };
}
const co = (over: Partial<NonNullable<AdAudience["company"]>> = {}) => ({ name: "Acme", industry: "Software", size: "51-200", ...over });

describe("isUntargeted", () => {
  it("empty / null specs are untargeted", () => {
    assert.equal(isUntargeted(null), true);
    assert.equal(isUntargeted({}), true);
    assert.equal(isUntargeted({ keywordMatch: "any", audience: "any" }), true);
    assert.equal(isUntargeted({ interestKeywords: [] }), true);
  });
  it("any constraint makes it targeted", () => {
    assert.equal(isUntargeted({ interestKeywords: ["saas"] }), false);
    assert.equal(isUntargeted({ funnelStages: ["intent"] }), false);
    assert.equal(isUntargeted({ audience: "returning" }), false);
    assert.equal(isUntargeted({ minPageviews: 2 }), false);
    assert.equal(isUntargeted({ countries: ["NL"] }), false);
  });
});

describe("matchesTargeting", () => {
  it("untargeted ads match everyone, even without an audience", () => {
    assert.equal(matchesTargeting({}, null), true);
    assert.equal(matchesTargeting(null, aud()), true);
  });

  it("targeted ads require an audience", () => {
    assert.equal(matchesTargeting({ interestKeywords: ["saas"] }, null), false);
  });

  it("keyword match: any (default)", () => {
    const t: AdTargeting = { interestKeywords: ["saas", "marketing"] };
    assert.equal(matchesTargeting(t, aud({ keywords: ["marketing"] })), true);
    assert.equal(matchesTargeting(t, aud({ keywords: ["finance"] })), false);
  });

  it("keyword match: all", () => {
    const t: AdTargeting = { interestKeywords: ["saas", "marketing"], keywordMatch: "all" };
    assert.equal(matchesTargeting(t, aud({ keywords: ["saas", "marketing", "b2b"] })), true);
    assert.equal(matchesTargeting(t, aud({ keywords: ["saas"] })), false);
  });

  it("keyword match is case-insensitive", () => {
    assert.equal(matchesTargeting({ interestKeywords: ["SaaS"] }, aud({ keywords: ["saas"] })), true);
  });

  it("funnel stage restriction", () => {
    const t: AdTargeting = { funnelStages: ["intent", "high_intent"] };
    assert.equal(matchesTargeting(t, aud({ funnelStage: "intent" })), true);
    assert.equal(matchesTargeting(t, aud({ funnelStage: "awareness" })), false);
  });

  it("new vs returning", () => {
    assert.equal(matchesTargeting({ audience: "new" },       aud({ returning: false })), true);
    assert.equal(matchesTargeting({ audience: "new" },       aud({ returning: true })),  false);
    assert.equal(matchesTargeting({ audience: "returning" }, aud({ returning: true })),  true);
    assert.equal(matchesTargeting({ audience: "returning" }, aud({ returning: false })), false);
  });

  it("minimum pageviews", () => {
    assert.equal(matchesTargeting({ minPageviews: 3 }, aud({ pageviews: 3 })), true);
    assert.equal(matchesTargeting({ minPageviews: 3 }, aud({ pageviews: 2 })), false);
  });

  it("all constraints must hold together (AND)", () => {
    const t: AdTargeting = { interestKeywords: ["saas"], funnelStages: ["intent"], audience: "returning", minPageviews: 2 };
    assert.equal(matchesTargeting(t, aud({ keywords: ["saas"], funnelStage: "intent", returning: true, pageviews: 4 })), true);
    // one dimension off → no match
    assert.equal(matchesTargeting(t, aud({ keywords: ["saas"], funnelStage: "awareness", returning: true, pageviews: 4 })), false);
  });

  it("geo: country allow-list (case-insensitive), needs a resolved country", () => {
    const t: AdTargeting = { countries: ["NL", "BE"] };
    assert.equal(matchesTargeting(t, aud({ country: "nl" })), true);
    assert.equal(matchesTargeting(t, aud({ country: "DE" })), false);
    assert.equal(matchesTargeting(t, aud({ country: null })), false);
  });

  it("behavioural dimensions require a real profile; geo does not", () => {
    // Unprofiled visitor with geo: geo targeting works, behavioural does not.
    const unprofiled = aud({ hasProfile: false, country: "NL", keywords: ["saas"] });
    assert.equal(matchesTargeting({ countries: ["NL"] }, unprofiled), true);
    assert.equal(matchesTargeting({ interestKeywords: ["saas"] }, unprofiled), false);
    assert.equal(matchesTargeting({ funnelStages: ["awareness"] }, unprofiled), false);
  });

  it("geo + behavioural combined", () => {
    const t: AdTargeting = { countries: ["NL"], funnelStages: ["intent"] };
    assert.equal(matchesTargeting(t, aud({ country: "NL", funnelStage: "intent", hasProfile: true })), true);
    assert.equal(matchesTargeting(t, aud({ country: "BE", funnelStage: "intent", hasProfile: true })), false);
  });

  it("firmographic: requireCompany needs a company match", () => {
    assert.equal(matchesTargeting({ requireCompany: true }, aud({ company: co() })), true);
    assert.equal(matchesTargeting({ requireCompany: true }, aud({ company: null })), false);
  });

  it("firmographic: industry contains (case-insensitive), size in list", () => {
    assert.equal(matchesTargeting({ industries: ["soft"] }, aud({ company: co({ industry: "Software" }) })), true);
    assert.equal(matchesTargeting({ industries: ["finance"] }, aud({ company: co({ industry: "Software" }) })), false);
    assert.equal(matchesTargeting({ companySizes: ["51-200"] }, aud({ company: co({ size: "51-200" }) })), true);
    assert.equal(matchesTargeting({ companySizes: ["1-10"] }, aud({ company: co({ size: "51-200" }) })), false);
  });

  it("firmographic needs a company; behavioural default profile doesn't leak in", () => {
    assert.equal(matchesTargeting({ industries: ["soft"] }, aud({ company: null })), false);
  });
});

describe("parseAdTargeting", () => {
  it("keeps valid fields, drops junk", () => {
    const parsed = parseAdTargeting({
      interestKeywords: ["saas", 3, "b2b"],
      keywordMatch: "all",
      funnelStages: ["intent", "nonsense"],
      audience: "returning",
      minPageviews: 2,
      extra: "ignored",
    });
    assert.deepEqual(parsed.interestKeywords, ["saas", "b2b"]);
    assert.equal(parsed.keywordMatch, "all");
    assert.deepEqual(parsed.funnelStages, ["intent"]);
    assert.equal(parsed.audience, "returning");
    assert.equal(parsed.minPageviews, 2);
  });
  it("countries: uppercased, only valid 2-letter codes", () => {
    const parsed = parseAdTargeting({ countries: ["nl", "Be", "USA", 3, "x"] });
    assert.deepEqual(parsed.countries, ["NL", "BE"]);
  });
  it("empty / invalid input → empty (untargeted) spec", () => {
    assert.deepEqual(parseAdTargeting(null), {});
    assert.deepEqual(parseAdTargeting("x"), {});
    assert.equal(isUntargeted(parseAdTargeting({ interestKeywords: [] })), true);
  });
});
