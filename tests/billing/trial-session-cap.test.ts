/**
 * The trial is capped by sessions as well as by days.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import { TRIAL_SESSION_LIMIT, trialSessionLimit, trialWindow } from "../../billing/trial-session-cap.ts";
import { sessionCapNoticeText } from "../../billing/notifications.ts";

describe("trialWindow", () => {
  it("a trialing subscription is on trial from the day it was created", () => {
    assert.deepEqual(
      trialWindow({ status: "trialing", created_at: "2026-11-25T10:00:00+00:00" }),
      { startedAt: "2026-11-25T10:00:00.000Z" },
    );
  });

  it("any other status is not a trial", () => {
    for (const status of ["active", "past_due", "canceled", "unpaid", "paused", "", null, undefined]) {
      assert.equal(trialWindow({ status, created_at: "2026-11-25T10:00:00Z" }), null);
    }
    assert.equal(trialWindow(null), null);
    assert.equal(trialWindow(undefined), null);
  });

  it("a trial without a usable start date counts everything, it does not lift the limit", () => {
    assert.deepEqual(trialWindow({ status: "trialing" }), { startedAt: "1970-01-01T00:00:00.000Z" });
    assert.deepEqual(trialWindow({ status: "trialing", created_at: "not a date" }), { startedAt: "1970-01-01T00:00:00.000Z" });
  });
});

describe("trialSessionLimit", () => {
  it("is 150 for every plan on sale", () => {
    assert.equal(TRIAL_SESSION_LIMIT, 150);
    for (const planLimit of [1_500, 7_500, 40_000]) assert.equal(trialSessionLimit(planLimit), 150);
  });

  it("never gives a trial more than the plan itself", () => {
    assert.equal(trialSessionLimit(100), 100);
  });

  it("caps the trial of an unlimited plan too", () => {
    assert.equal(trialSessionLimit(0), 150);
  });

  it("a trial limit of zero switches the trial cap off", () => {
    assert.equal(trialSessionLimit(1_500, 0), 1_500);
  });
});

describe("the cap verdict uses the trial", () => {
  const src = fs.readFileSync("billing/plan-enforcement.ts", "utf8");

  it("reads the subscription's status and start with the plan", () => {
    assert.match(src, /\.select\("plan, status, created_at"\)/);
  });

  it("only a trial pays for the extra count", () => {
    assert.match(src, /\? await getSessionCountSince\(tenantId, trial\.startedAt\)\s+: monthCount;/);
  });

  it("counts a trial from its start, across the month boundary", () => {
    assert.match(src, /\.gte\("created_at", sinceIso\)/);
    assert.match(src, /getSessionCountSince\(tenantId, trial\.startedAt\)/);
  });

  it("hands the trial limit on as the plan limit, so credits and notices follow", () => {
    assert.match(src, /const planLimit = trial\s+\? trialSessionLimit\(plan\.limits\.personalizedSessionsPerMonth\)\s+: plan\.limits\.personalizedSessionsPerMonth;/);
    assert.match(src, /isOverCap\(\{ current, planLimit, credits: bonusSessions \}\)/);
  });

  it("says in the verdict that it is a trial", () => {
    assert.match(src, /onTrial:\s+trial !== null,/);
  });
});

describe("the trial texts name the limit", () => {
  const shop = fs.readFileSync("lib/site-texts/shop.ts", "utf8");

  it("the number comes from the constant, not from a second copy", () => {
    assert.match(shop, /import \{ TRIAL_SESSION_LIMIT \} from "@\/billing\/trial-session-cap";/);
    assert.doesNotMatch(shop, /150 (personalised|gepersonaliseerde)/);
  });

  it("both languages say it where the trial is offered", () => {
    assert.match(shop, /up to \$\{TRIAL_SESSION_LIMIT\} personalised sessions/);
    assert.match(shop, /tot \$\{TRIAL_SESSION_LIMIT\} gepersonaliseerde bezoeken/);
  });
});

describe("the limit notice on trial", () => {
  it("is claimed once for the whole trial and counted from its start", () => {
    const src = fs.readFileSync("billing/session-cap-notice.ts", "utf8");
    assert.match(src, /export const TRIAL_NOTICE_KEY = "trial";/);
    assert.match(src, /const monthKey = onTrial \? TRIAL_NOTICE_KEY : input\.monthKey;/);
    assert.match(src, /await counting\.gte\("created_at", input\.trialSince as string\)/);
  });

  it("the cap verdict hands the trial start to the notice", () => {
    const src = fs.readFileSync("billing/plan-enforcement.ts", "utf8");
    assert.match(src, /trialSince:\s+capResult\.onTrial \? \(capResult\.trialStartedAt \?\? null\) : null,/);
  });
});

describe("sessionCapNoticeText on trial", () => {
  const info = { count: 150, planLimit: 150, bonusSessions: 0, monthKey: "trial", onTrial: true };

  it("speaks of the trial, not of a month", () => {
    const full = sessionCapNoticeText({ ...info, threshold: 100 });
    assert.equal(full.subject, "[Mister Chameleon] Trial session limit reached");
    assert.match(full.body, /150 of the 150 personalised sessions in your trial/);
    assert.match(full.body, /nothing is charged before it ends/);
    assert.doesNotMatch(full.body, /next month/);
    assert.doesNotMatch(full.body, /for trial\./);
  });

  it("warns at 80% with the same road forward", () => {
    const warn = sessionCapNoticeText({ ...info, count: 120, threshold: 80 });
    assert.equal(warn.subject, "[Mister Chameleon] 80% of your trial sessions used");
    assert.match(warn.body, /120 of the 150 personalised sessions in your trial/);
    assert.match(warn.body, /buy extra sessions/);
  });

  it("says so when a bought bundle keeps personalisation going", () => {
    const full = sessionCapNoticeText({ ...info, bonusSessions: 1_000, threshold: 100 });
    assert.match(full.body, /1,000 extra sessions left from a bundle you bought/);
  });

  it("leaves the paid plan's text as it was", () => {
    const paid = sessionCapNoticeText({ threshold: 100, count: 1_500, planLimit: 1_500, bonusSessions: 0, monthKey: "2026-11" });
    assert.equal(paid.subject, "[Mister Chameleon] Monthly session limit reached");
    assert.match(paid.body, /first day of next month/);
  });
});
