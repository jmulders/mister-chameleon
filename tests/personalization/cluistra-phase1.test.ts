/**
 * Cluistra — Phase 1 config tests (service vs default)
 *
 * Proves the Phase-1 config is valid-by-construction and that the two rules fire
 * exactly for the intended contexts:
 *   • the sticky rule latches visited_service_page on a service page (not a bot);
 *   • R1 serves the service variants only for a RETURNING visitor who carries the
 *     flag and is on the homepage or a sector page (not a bot);
 *   • everything else falls through to the default plan.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { validateStoredConfig, evaluateCondition } from "@/decision/rules/stored-rule";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import {
  buildCluistraPhase1Config,
  CLUISTRA_SERVICE_PATHS,
  CLUISTRA_R1_PATHS,
  VISITED_SERVICE_PAGE_FLAG,
} from "@/decision/rules/cluistra-phase1";

/** Minimal context — only the fields the Phase-1 conditions read. */
function ctxWith(fields: Partial<RuleEvaluationContext>): RuleEvaluationContext {
  return fields as unknown as RuleEvaluationContext;
}

const config     = buildCluistraPhase1Config();
const stickyRule = config.rules.find((r) => r.id === "cluistra.visited_service_page")!;
const r1         = config.rules.find((r) => r.id === "cluistra.r1_service")!;

// ── 1. Valid by construction ────────────────────────────────────────────────────

describe("cluistra phase 1 — validity", () => {
  it("passes validateStoredConfig with no extra keys (service keys are platform-valid)", () => {
    assert.deepEqual(validateStoredConfig(config), []);
  });

  it("default plan is the platform default triple", () => {
    assert.deepEqual(
      { h: config.defaultPlan.heroKey, p: config.defaultPlan.proofKey, c: config.defaultPlan.ctaKey },
      { h: "hero_default", p: "proof_default", c: "cta_default" },
    );
  });

  it("R1 serves the service variants across every slot", () => {
    assert.deepEqual(r1.plan, {
      heroKey: "hero_service", proofKey: "proof_service", ctaKey: "cta_service", featureKey: "feature_service",
    });
  });
});

// ── 2. Sticky context-write rule ────────────────────────────────────────────────

describe("cluistra phase 1 — sticky visited_service_page rule", () => {
  it("writes a sticky + monotone flag", () => {
    assert.deepEqual(stickyRule.plan.setContext, [
      { key: VISITED_SERVICE_PAGE_FLAG, value: true, sticky: true, monotone: true },
    ]);
  });

  it("fires on each service page for a non-bot", () => {
    for (const path of CLUISTRA_SERVICE_PATHS) {
      assert.equal(evaluateCondition(stickyRule.condition, ctxWith({ pathname: path, isBot: false })), true, path);
    }
  });

  it("does not fire on the homepage or for a bot", () => {
    assert.equal(evaluateCondition(stickyRule.condition, ctxWith({ pathname: "/", isBot: false })), false);
    assert.equal(evaluateCondition(stickyRule.condition, ctxWith({ pathname: "/onderhoud", isBot: true })), false);
  });
});

// ── 3. R1 Service rule ───────────────────────────────────────────────────────────

describe("cluistra phase 1 — R1 service rule", () => {
  const base = { visitType: "returning", isBot: false, ruleContext: { [VISITED_SERVICE_PAGE_FLAG]: true } } as const;

  it("fires for a returning, flagged visitor on the homepage and every sector page", () => {
    for (const path of CLUISTRA_R1_PATHS) {
      assert.equal(evaluateCondition(r1.condition, ctxWith({ ...base, pathname: path })), true, path);
    }
  });

  it("does not fire on a service page (outside the R1 path allowlist)", () => {
    assert.equal(evaluateCondition(r1.condition, ctxWith({ ...base, pathname: "/onderhoud" })), false);
  });

  it("does not fire on an unlisted page", () => {
    assert.equal(evaluateCondition(r1.condition, ctxWith({ ...base, pathname: "/over-ons" })), false);
  });

  it("requires a RETURNING visitor (new visitor falls through)", () => {
    assert.equal(evaluateCondition(r1.condition, ctxWith({ ...base, visitType: "new", pathname: "/" })), false);
  });

  it("requires the flag (returning without the flag falls through)", () => {
    assert.equal(evaluateCondition(r1.condition, ctxWith({ visitType: "returning", isBot: false, ruleContext: {}, pathname: "/" })), false);
  });

  it("excludes bots", () => {
    assert.equal(evaluateCondition(r1.condition, ctxWith({ ...base, isBot: true, pathname: "/" })), false);
  });
});
