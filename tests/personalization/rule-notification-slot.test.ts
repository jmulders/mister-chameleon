/**
 * Notification slot server-validation tests.
 *
 * Proves that a rule (and the default plan) can carry a platform notification
 * variant key, and that validateStoredConfig accepts it for a tenant with NO
 * extra CMS keys (e.g. Statamic) so saving does not reject the whole config.
 * Also proves that None (notificationKey omitted) is valid and that an unknown
 * key is rejected with a notificationKey-scoped error.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { validateStoredConfig } from "@/decision/rules/stored-rule";
import type { StoredRulesConfig, StoredRule } from "@/decision/rules/stored-rule";

/** A returning-visitor rule whose plan optionally targets a notification key. */
function returningRule(notificationKey?: string): StoredRule {
  return {
    id:        "test.returning_notification",
    priority:  10,
    label:     "Returning visitor notification",
    condition: { type: "field", field: "visitType", operator: "equals", value: "returning" },
    plan: {
      heroKey:  "hero_default",
      proofKey: "proof_default",
      ctaKey:   "cta_default",
      ...(notificationKey ? { notificationKey: notificationKey as never } : {}),
    },
    reason:  "Returning visitor: show the welcome-back notification.",
    enabled: true,
    source:  "tenant",
  } as StoredRule;
}

function configWith(rule: StoredRule, defaultNotificationKey?: string): StoredRulesConfig {
  return {
    schemaVersion: 1,
    updatedAt:     "2026-01-01T00:00:00.000Z",
    rules:         [rule],
    defaultPlan: {
      heroKey:  "hero_default",
      proofKey: "proof_default",
      ctaKey:   "cta_default",
      reason:   "Default experience.",
      ...(defaultNotificationKey ? { notificationKey: defaultNotificationKey as never } : {}),
    },
    rulesEnabled: true,
  } as StoredRulesConfig;
}

describe("notification slot validation (no extra keys, Statamic-like)", () => {
  it("accepts notification_returning on a rule with empty extraKeys", () => {
    const errors = validateStoredConfig(configWith(returningRule("notification_returning")));
    assert.deepEqual(errors, []);
  });

  it("accepts a notification key on the default plan", () => {
    const errors = validateStoredConfig(configWith(returningRule(), "notification_offer"));
    assert.deepEqual(errors, []);
  });

  it("accepts None (notificationKey omitted) on both rule and default plan", () => {
    const errors = validateStoredConfig(configWith(returningRule()));
    assert.deepEqual(errors, []);
  });

  it("rejects an unknown notification key with a notificationKey-scoped error", () => {
    const errors = validateStoredConfig(configWith(returningRule("notification_nope")));
    assert.equal(errors.length >= 1, true);
    assert.equal(errors.some((e) => e.field.includes("notificationKey")), true);
  });
});
