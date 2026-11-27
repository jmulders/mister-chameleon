/**
 * The monthly session limit on the two API paths.
 *
 * The hosted pages count each visit and stop personalising when the month is
 * used up. Snippet decide and v1/slot did neither, so a tenant on its own CMS
 * was never counted and never stopped. These tests pin the rule both routes
 * now share (lib/snippet/session-limit.ts) and that both routes use it.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import {
  apiSessionKey,
  apiVisitCounts,
  countApiSession,
  createCountedOnce,
} from "../../lib/snippet/session-limit.ts";

const VISIT = {
  overLimit:              false,
  isBot:                  false,
  visitorId:              "vid_12345678",
  personalizationConsent: true,
};

const CAP = {
  overLimit: false, current: 10, limit: 1_500, planLimit: 1_500, bonusSessions: 0, monthKey: "2026-11",
};

describe("apiVisitCounts", () => {
  it("counts a recognised visitor under the limit", () => {
    assert.equal(apiVisitCounts(VISIT), true);
  });

  it("counts nothing over the limit: the visitor got the default", () => {
    assert.equal(apiVisitCounts({ ...VISIT, overLimit: true }), false);
  });

  it("does not count a bot", () => {
    assert.equal(apiVisitCounts({ ...VISIT, isBot: true }), false);
  });

  it("does not count without personalization consent: the row is kept per visitor", () => {
    assert.equal(apiVisitCounts({ ...VISIT, personalizationConsent: false }), false);
  });

  it("does not count a call without a visitor id", () => {
    assert.equal(apiVisitCounts({ ...VISIT, visitorId: null }), false);
    assert.equal(apiVisitCounts({ ...VISIT, visitorId: undefined }), false);
    assert.equal(apiVisitCounts({ ...VISIT, visitorId: "" }), false);
  });
});

describe("createCountedOnce", () => {
  it("says yes once per key", () => {
    const counted = createCountedOnce();
    assert.equal(counted.firstTime("a"), true);
    assert.equal(counted.firstTime("a"), false);
    assert.equal(counted.firstTime("b"), true);
    assert.equal(counted.size, 2);
  });

  it("forgets a key on request, so a failed write is tried again", () => {
    const counted = createCountedOnce();
    counted.firstTime("a");
    counted.forget("a");
    assert.equal(counted.firstTime("a"), true);
  });

  it("stays bounded: a full set is emptied", () => {
    const counted = createCountedOnce(3);
    for (const key of ["a", "b", "c"]) counted.firstTime(key);
    assert.equal(counted.size, 3);
    assert.equal(counted.firstTime("d"), true);
    assert.equal(counted.size, 1);
  });
});

describe("countApiSession", () => {
  function deps() {
    const calls: Array<{ tenantId: string; sessionId: string; cap: unknown }> = [];
    return {
      calls,
      deps: {
        record: async (tenantId: string, sessionId: string, cap?: unknown) => {
          calls.push({ tenantId, sessionId, cap });
        },
        monthKey: () => "2026-11",
        counted:  createCountedOnce(),
      },
    };
  }

  it("records the visitor with the verdict the route already has", async () => {
    const d = deps();
    await countApiSession("statamic", "vid_12345678", CAP, d.deps);
    assert.deepEqual(d.calls, [{ tenantId: "statamic", sessionId: "vid_12345678", cap: CAP }]);
  });

  it("sends the six slot calls of one page once", async () => {
    const d = deps();
    for (let i = 0; i < 6; i++) await countApiSession("statamic", "vid_12345678", CAP, d.deps);
    assert.equal(d.calls.length, 1);
  });

  it("keeps tenants, visitors and months apart", async () => {
    const d = deps();
    await countApiSession("statamic", "vid_12345678", CAP, d.deps);
    await countApiSession("other", "vid_12345678", CAP, d.deps);
    await countApiSession("statamic", "vid_87654321", CAP, d.deps);
    await countApiSession("statamic", "vid_12345678", { ...CAP, monthKey: "2026-12" }, d.deps);
    assert.equal(d.calls.length, 4);
    assert.notEqual(
      apiSessionKey("statamic", "2026-11", "vid_12345678"),
      apiSessionKey("statamic", "2026-12", "vid_12345678"),
    );
  });

  it("still counts when the verdict could not be read", async () => {
    const d = deps();
    await countApiSession("statamic", "vid_12345678", null, d.deps);
    assert.deepEqual(d.calls, [{ tenantId: "statamic", sessionId: "vid_12345678", cap: undefined }]);
  });

  it("never throws, and tries again after a write that failed", async () => {
    const d = deps();
    let fail = true;
    const record = async (tenantId: string, sessionId: string, cap?: unknown) => {
      if (fail) throw new Error("database away");
      d.calls.push({ tenantId, sessionId, cap });
    };
    await countApiSession("statamic", "vid_12345678", CAP, { ...d.deps, record });
    assert.equal(d.calls.length, 0);
    fail = false;
    await countApiSession("statamic", "vid_12345678", CAP, { ...d.deps, record });
    assert.equal(d.calls.length, 1);
  });

  it("does nothing without a tenant or a visitor", async () => {
    const d = deps();
    await countApiSession("", "vid_12345678", CAP, d.deps);
    await countApiSession("statamic", "", CAP, d.deps);
    assert.equal(d.calls.length, 0);
  });
});

describe("both API routes keep to the limit", () => {
  const slot   = fs.readFileSync("app/api/v1/slot/route.ts", "utf8");
  const decide = fs.readFileSync("app/api/snippet/decide/route.ts", "utf8");

  it("read the verdict the hosted pages use", () => {
    assert.match(slot,   /readApiSessionCap\(tenantId\)/);
    assert.match(decide, /readApiSessionCap\(tenantId\)/);
  });

  it("the slot API serves the CMS default over the limit, before any rule runs", () => {
    const stop  = slot.indexOf("if (sessionCap?.overLimit)");
    const rules = slot.indexOf("new RulesDecisionProvider(");
    assert.ok(stop > 0 && rules > stop, "the limit is checked before the rules provider is built");
    assert.match(slot.slice(stop, stop + 400), /return respondDefault\(\);/);
  });

  it("snippet decide forces the default plan over the limit", () => {
    assert.match(decide, /const overSessionLimit = sessionCap\?\.overLimit === true;/);
    assert.match(decide, /isUaBot \|\| overSessionLimit,/);
  });

  it("count the visitor after the response, and only when the rule says so", () => {
    for (const source of [slot, decide]) {
      assert.match(source, /stableId && apiVisitCounts\(\{/);
      assert.match(source, /after\(\(\) => countApiSession\(tenantId, stableId, sessionCap\)\);/);
    }
  });

  it("the demo and advertiser answers of snippet decide leave before the count", () => {
    const count = decide.indexOf("countApiSession(tenantId");
    assert.ok(decide.indexOf("_ad: true") < count);
    assert.ok(decide.indexOf("_demo: true") < count);
    assert.ok(decide.indexOf("_quarantined: true") < count);
  });
});
