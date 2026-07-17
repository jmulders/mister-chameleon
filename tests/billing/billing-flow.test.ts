/**
 * Golden Scenario Tests — Billing, end to end
 *
 * The companion to tests/personalization/golden-flows.test.ts. Those scenarios
 * ask "does the visitor get the right page?"; these ask "does the tenant get
 * charged the right amount for it?" — the question behind every leak found on
 * 17 July 2026:
 *
 *   • no session counted for a visitor who never touched the homepage
 *   • one session counted for a visitor who came back six times in a month
 *   • the cap "enforced" while the rules engine kept personalising
 *   • a purchased credit never deducted because `undefined > 0` is false
 *
 * Every one of those was silent. Nothing threw; the numbers were just wrong.
 *
 * ─── Scenarios ───────────────────────────────────────────────────────────────
 *
 *   1  One visit, five pages       — one billable session, not five
 *   2  Five visits, one month      — five billable sessions, not one
 *   3  Inside the bundle           — counted, personalised, no credit spent
 *   4  Past the plan, with credits — personalised, one credit per session
 *   5  Past everything             — defaultPlan, not counted, not charged
 *   6  The month rolls over        — counter resets with the invoice period
 *
 * ─── What this composes ──────────────────────────────────────────────────────
 *
 *   resolveSession        (@/data/session)            — the two cookies
 *   isOverCap             (@/billing/plan-enforcement)— the cap arithmetic
 *   assignPersonalizationGroup / applySessionCap /
 *   servesDefaultExperience (@/lib/lead-base/holdout) — the cohort
 *   RulesDecisionProvider (@/decision/providers/…)    — what is actually served
 *   nextCalendarMonthStartUnix (@/billing/stripe)     — when the month turns
 *
 *   All pure. The DB writes around them (personalization_sessions,
 *   deduct_session_credit) are modelled by the fake ledger below, which enforces
 *   the one property the real table enforces: the PK is
 *   (tenant, month, session), so the same session in the same month is one row.
 *
 * ─── Why "golden"? ───────────────────────────────────────────────────────────
 *
 *   If any of these fail, someone is being billed the wrong amount. Run via
 *   `npm run test:release-check`.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveSession, SESSION_COOKIE, WEB_SESSION_COOKIE } from "@/data/session";
import { isOverCap }                 from "@/billing/plan-enforcement";
import { nextCalendarMonthStartUnix } from "@/billing/stripe";
import {
  assignPersonalizationGroup,
  applySessionCap,
  servesDefaultExperience,
}                                    from "@/lib/lead-base/holdout";
import { RulesDecisionProvider }     from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "../personalization/_fixtures";

// ── A stand-in for personalization_sessions ──────────────────────────────────

/**
 * Models the real table's only load-bearing property: PRIMARY KEY
 * (tenant_id, month_key, session_id) with INSERT … ON CONFLICT DO NOTHING.
 * Counting is a Set — which is exactly what the DB does.
 */
class SessionLedger {
  private readonly rows = new Set<string>();
  private creditsSpent = 0;

  /** Mirrors recordPersonalizedSession: skipped over the cap, deduped otherwise. */
  record(tenantId: string, monthKey: string, webSessionId: string, cap: {
    overLimit: boolean; current: number; planLimit: number; bonusSessions: number;
  }): void {
    if (cap.overLimit) return;                       // default page served — nothing to bill

    const pastPlanLimit = cap.planLimit > 0 && cap.current >= cap.planLimit;
    if (pastPlanLimit && cap.bonusSessions > 0) this.creditsSpent++;

    this.rows.add(`${tenantId}|${monthKey}|${webSessionId}`);
  }

  count(tenantId: string, monthKey: string): number {
    let n = 0;
    for (const r of this.rows) if (r.startsWith(`${tenantId}|${monthKey}|`)) n++;
    return n;
  }

  get credits(): number { return this.creditsSpent; }
}

const TENANT = "tenant-golden";
const MONTH  = "2026-07";

/** A page view: resolve cookies the way the proxy does, return the two keys. */
function pageview(cookieHeader: string | null) {
  const r = resolveSession(cookieHeader);
  return {
    ...r,
    /** The Cookie header the browser would send on the next request. */
    nextCookieHeader: `${SESSION_COOKIE}=${r.sessionId}; ${WEB_SESSION_COOKIE}=${r.webSessionId}`,
  };
}

// ── Scenario 1: one visit, five pages ────────────────────────────────────────

describe("Scenario 1 — one visit, five pages", () => {
  /**
   * A visitor lands on /pricing from Google, reads four more pages, leaves.
   * That is one contextual session. Until 17 July it was ZERO: only the homepage
   * recorded anything, so a visit that never touched / consumed nothing.
   */
  it("bills one session for the whole visit", () => {
    const ledger = new SessionLedger();
    const cap    = { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 };

    let cookies: string | null = null;
    for (let page = 0; page < 5; page++) {
      const v = pageview(cookies);
      ledger.record(TENANT, MONTH, v.webSessionId, cap);
      cookies = v.nextCookieHeader;
    }

    assert.strictEqual(ledger.count(TENANT, MONTH), 1, "five pages, one visit, one session");
  });

  it("the visit keeps one web-session id from first page to last", () => {
    const first  = pageview(null);
    const second = pageview(first.nextCookieHeader);

    assert.strictEqual(second.webSessionId, first.webSessionId);
    assert.strictEqual(second.isNewWebSession, false);
  });

  it("an inner page counts even though the homepage was never seen", () => {
    // The whole point of scenario 1. A CMS-only visit used to be free.
    const ledger = new SessionLedger();
    const v      = pageview(null);
    ledger.record(TENANT, MONTH, v.webSessionId,
      { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count(TENANT, MONTH), 1);
  });
});

// ── Scenario 2: five visits in one month ─────────────────────────────────────

describe("Scenario 2 — the same visitor, five separate visits", () => {
  /**
   * mc_session_id lives 30 days, so all five visits share it. Billing keyed on
   * that visitor key charged once for the month — the tenant delivered five
   * adapted visits and was paid for one.
   */
  function returningVisitor(visits: number): SessionLedger {
    const ledger = new SessionLedger();
    const cap    = { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 };

    for (let i = 0; i < visits; i++) {
      // mc_ws has expired between visits; mc_session_id has not.
      const v = pageview(`${SESSION_COOKIE}=visitor-returning`);
      ledger.record(TENANT, MONTH, v.webSessionId, cap);
    }
    return ledger;
  }

  it("bills five sessions, not one", () => {
    assert.strictEqual(returningVisitor(5).count(TENANT, MONTH), 5);
  });

  it("the visitor key is stable across all five — personalisation still knows them", () => {
    const a = pageview(`${SESSION_COOKIE}=visitor-returning`);
    const b = pageview(`${SESSION_COOKIE}=visitor-returning`);

    assert.strictEqual(a.sessionId, b.sessionId, "same visitor");
    assert.notStrictEqual(a.webSessionId, b.webSessionId, "different visits");
  });

  it("billing on the visitor key would have counted one — the bug, pinned", () => {
    // Kept as a test rather than a comment: it is the difference between the two
    // keys, stated as an amount of money.
    const ledger = new SessionLedger();
    for (let i = 0; i < 5; i++) {
      const v = pageview(`${SESSION_COOKIE}=visitor-returning`);
      ledger.record(TENANT, MONTH, v.sessionId,     // ← the old, wrong key
        { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });
    }
    assert.strictEqual(ledger.count(TENANT, MONTH), 1, "five visits collapsed into one");
  });
});

// ── Scenario 3: comfortably inside the bundle ────────────────────────────────

describe("Scenario 3 — inside the monthly bundle", () => {
  const cap = { current: 1_000, planLimit: 25_000, credits: 0 };

  it("is not over the cap", () => {
    assert.strictEqual(isOverCap(cap), false);
  });

  it("the visitor is personalised", async () => {
    const group    = applySessionCap(assignPersonalizationGroup("v-3", 0), isOverCap(cap));
    const provider = new RulesDecisionProvider(RULES_CONFIG, servesDefaultExperience(group));
    const plan     = await provider.getHomepagePlan(buildInput(buildJourney({}), { utmSource: "google" }));

    assert.strictEqual(group, "personalized");
    assert.strictEqual(plan.heroKey, "hero_google_problem");
  });

  it("the session is counted and no credit is spent", () => {
    const ledger = new SessionLedger();
    ledger.record(TENANT, MONTH, "ws-3",
      { overLimit: false, current: 1_000, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count(TENANT, MONTH), 1);
    assert.strictEqual(ledger.credits, 0, "the plan already paid for this session");
  });
});

// ── Scenario 4: past the plan, purchased credits left ────────────────────────

describe("Scenario 4 — past the plan limit, credits remaining", () => {
  const cap = { current: 25_000, planLimit: 25_000, credits: 10_000 };

  it("purchased credits keep the tenant under the cap", () => {
    assert.strictEqual(isOverCap(cap), false);
  });

  it("the visitor is still personalised — they bought that", async () => {
    const group    = applySessionCap(assignPersonalizationGroup("v-4", 0), isOverCap(cap));
    const provider = new RulesDecisionProvider(RULES_CONFIG, servesDefaultExperience(group));
    const plan     = await provider.getHomepagePlan(buildInput(buildJourney({}), { utmSource: "google" }));

    assert.strictEqual(plan.heroKey, "hero_google_problem");
  });

  it("one credit is deducted for the session", () => {
    const ledger = new SessionLedger();
    ledger.record(TENANT, MONTH, "ws-4",
      { overLimit: false, current: 25_000, planLimit: 25_000, bonusSessions: 10_000 });

    assert.strictEqual(ledger.credits, 1);
    assert.strictEqual(ledger.count(TENANT, MONTH), 1);
  });

  it("credits are a live balance, not a bigger limit", () => {
    // The distinction that makes isOverCap correct, and the one I got wrong when
    // first writing this test — so it is worth stating as an assertion.
    //
    // `credits` is the REMAINING balance, decremented by deduct_session_credit
    // as sessions are served. So past the plan limit the question is only "is
    // there any balance left", never "is current past planLimit + credits":
    // that second formula double-counts, because every session past the limit
    // has already raised `current` AND lowered `credits`. It would stop serving
    // at roughly half the purchased credits and leave the rest unspent.
    assert.strictEqual(isOverCap({ current: 30_000, planLimit: 25_000, credits: 10_000 }), false);
    assert.strictEqual(isOverCap({ current: 90_000, planLimit: 25_000, credits: 1 }),      false);
    assert.strictEqual(isOverCap({ current: 25_000, planLimit: 25_000, credits: 0 }),      true);
  });

  it("a negative credit balance is treated as no balance", () => {
    assert.strictEqual(isOverCap({ current: 25_000, planLimit: 25_000, credits: -5 }), true);
  });
});

// ── Scenario 5: past everything ──────────────────────────────────────────────

describe("Scenario 5 — bundle exhausted, no credits", () => {
  const cap = { current: 25_000, planLimit: 25_000, credits: 0 };

  it("is over the cap", () => {
    assert.strictEqual(isOverCap(cap), true);
  });

  it("the cohort becomes capped, and capped gets the default page", () => {
    const group = applySessionCap(assignPersonalizationGroup("v-5", 0), isOverCap(cap));
    assert.strictEqual(group, "capped");
    assert.strictEqual(servesDefaultExperience(group), true);
  });

  it("a Google visitor gets defaultPlan — the product is actually withheld", async () => {
    const group    = applySessionCap(assignPersonalizationGroup("v-5", 0), isOverCap(cap));
    const provider = new RulesDecisionProvider(RULES_CONFIG, servesDefaultExperience(group));
    const plan     = await provider.getHomepagePlan(buildInput(buildJourney({}), { utmSource: "google" }));

    assert.deepStrictEqual(plan, RULES_CONFIG.defaultPlan);
    assert.notStrictEqual(plan.heroKey, "hero_google_problem");
  });

  it("nothing is counted and nothing is charged", () => {
    const ledger = new SessionLedger();
    ledger.record(TENANT, MONTH, "ws-5",
      { overLimit: true, current: 25_000, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count(TENANT, MONTH), 0, "they did not get a personalised page");
    assert.strictEqual(ledger.credits, 0);
  });

  it("an unlimited plan (planLimit 0) is never over the cap", () => {
    assert.strictEqual(isOverCap({ current: 9_000_000, planLimit: 0, credits: 0 }), false);
  });
});

// ── Scenario 6: the month rolls over ─────────────────────────────────────────

describe("Scenario 6 — new month, new bundle", () => {
  it("the counter is per month, so July's traffic does not touch August", () => {
    const ledger = new SessionLedger();
    ledger.record(TENANT, "2026-07", "ws-a", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });
    ledger.record(TENANT, "2026-08", "ws-b", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count(TENANT, "2026-07"), 1);
    assert.strictEqual(ledger.count(TENANT, "2026-08"), 1);
  });

  it("the same web session in two months counts in both — months are the unit", () => {
    const ledger = new SessionLedger();
    ledger.record(TENANT, "2026-07", "ws-same", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });
    ledger.record(TENANT, "2026-08", "ws-same", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count(TENANT, "2026-07"), 1);
    assert.strictEqual(ledger.count(TENANT, "2026-08"), 1);
  });

  it("tenants never see each other's sessions", () => {
    const ledger = new SessionLedger();
    ledger.record("tenant-a", MONTH, "ws-x", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });
    ledger.record("tenant-b", MONTH, "ws-x", { overLimit: false, current: 0, planLimit: 25_000, bonusSessions: 0 });

    assert.strictEqual(ledger.count("tenant-a", MONTH), 1);
    assert.strictEqual(ledger.count("tenant-b", MONTH), 1);
  });

  it("the cap resets exactly when the invoice period starts", () => {
    // The counter resets on the month_key boundary; Stripe renews on the billing
    // cycle anchor. They must be the same instant, or one paid month spans two
    // bundles — which is what two live subscriptions were doing, anchored to the
    // 27th and the 16th.
    const anchor    = new Date(nextCalendarMonthStartUnix(new Date("2026-07-17T12:00:00.000Z")) * 1000);
    const monthKeyOfAnchor = anchor.toISOString().slice(0, 7);   // currentMonthKey()'s slice

    assert.strictEqual(anchor.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.strictEqual(monthKeyOfAnchor, "2026-08");
  });
});
