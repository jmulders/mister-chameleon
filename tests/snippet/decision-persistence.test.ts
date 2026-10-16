/**
 * Unit tests for the snippet decision-persistence gate.
 *
 * The decide route and v1/slot hand a sessionId to RulesDecisionProvider (rule
 * context writes to visitor_behavior_state) and ExperimentDecisionProvider
 * (bucket assignment rows). Those writes may only happen with personalization
 * consent and never for UA bots. Pure function, no infra.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { resolveDecisionPersistence } from "@/lib/snippet/decision-persistence";

describe("resolveDecisionPersistence", () => {
  it("keeps the session and experiments with personalization consent", () => {
    assert.deepEqual(
      resolveDecisionPersistence({
        sessionId: "vid_12345678", personalizationConsent: true, isUaBot: false, experimentsEnabled: true,
      }),
      { sessionId: "vid_12345678", experimentsEnabled: true },
    );
  });

  it("drops the session and experiments when personalization consent is denied", () => {
    assert.deepEqual(
      resolveDecisionPersistence({
        sessionId: "vid_12345678", personalizationConsent: false, isUaBot: false, experimentsEnabled: true,
      }),
      { sessionId: undefined, experimentsEnabled: false },
    );
  });

  it("drops the session and experiments for a UA bot even with consent", () => {
    assert.deepEqual(
      resolveDecisionPersistence({
        sessionId: "vid_12345678", personalizationConsent: true, isUaBot: true, experimentsEnabled: true,
      }),
      { sessionId: undefined, experimentsEnabled: false },
    );
  });

  it("never turns experiments on when the tenant switched them off", () => {
    assert.deepEqual(
      resolveDecisionPersistence({
        sessionId: "vid_12345678", personalizationConsent: true, isUaBot: false, experimentsEnabled: false,
      }),
      { sessionId: "vid_12345678", experimentsEnabled: false },
    );
  });

  it("drops experiments when there is no session to bucket on", () => {
    assert.deepEqual(
      resolveDecisionPersistence({
        sessionId: "", personalizationConsent: true, isUaBot: false, experimentsEnabled: true,
      }),
      { sessionId: undefined, experimentsEnabled: false },
    );
  });
});
