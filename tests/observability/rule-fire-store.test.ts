/**
 * Rule-fire counts reach the database, also when a write fails once.
 *
 * The buffer used to flush only when another fire arrived a minute later on the
 * same instance, dropped the counts of a failed write, and lost any rule whose
 * id held a space. See lib/observability/rule-fire-store.ts.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __ruleFireBufferForTests,
  flushRuleFires,
  parseRuleFireKey,
  recordRuleFire,
  ruleFireKey,
  type RuleFireClient,
} from "../../lib/observability/rule-fire-store.ts";

type Call = { p_tenant_id: string; p_rule_id: string; p_count: number; p_day: string };

function fakeClient(failFor: (c: Call) => boolean = () => false) {
  const calls: Call[] = [];
  const client: RuleFireClient = {
    async rpc(_fn, args) {
      calls.push(args);
      return { error: failFor(args) ? { message: "boom" } : null };
    },
  };
  return { client, calls };
}

describe("rule fire buffer", () => {
  beforeEach(() => __ruleFireBufferForTests().reset());

  it("adds up fires per tenant, rule and day and writes one row each", async () => {
    recordRuleFire("acme", "rule_a");
    recordRuleFire("acme", "rule_a");
    recordRuleFire("acme", "rule_b");
    recordRuleFire("other", "rule_a");

    const { client, calls } = fakeClient();
    await flushRuleFires(client);

    const byKey = Object.fromEntries(calls.map((c) => [`${c.p_tenant_id}/${c.p_rule_id}`, c.p_count]));
    assert.deepEqual(byKey, { "acme/rule_a": 2, "acme/rule_b": 1, "other/rule_a": 1 });
    assert.match(calls[0]!.p_day, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(__ruleFireBufferForTests().entries.length, 0);
  });

  it("keeps a count whose write failed, and writes it on the next flush", async () => {
    recordRuleFire("acme", "rule_a");
    recordRuleFire("acme", "rule_b");

    const failing = fakeClient((c) => c.p_rule_id === "rule_a");
    await flushRuleFires(failing.client);
    assert.equal(__ruleFireBufferForTests().entries.length, 1, "rule_a is still buffered");

    recordRuleFire("acme", "rule_a");
    const ok = fakeClient();
    await flushRuleFires(ok.client);
    assert.deepEqual(ok.calls.map((c) => [c.p_rule_id, c.p_count]), [["rule_a", 2]]);
  });

  it("keeps the counts when the client throws", async () => {
    recordRuleFire("acme", "rule_a");
    const throwing: RuleFireClient = { rpc: () => Promise.reject(new Error("network")) };
    await flushRuleFires(throwing);
    assert.equal(__ruleFireBufferForTests().entries[0]?.[1], 1);
  });

  it("does not lose a rule whose id has a space in it", async () => {
    recordRuleFire("acme", "Gericht binnengekomen (meet)");
    const { client, calls } = fakeClient();
    await flushRuleFires(client);
    assert.equal(calls[0]!.p_rule_id, "Gericht binnengekomen (meet)");
    assert.equal(calls[0]!.p_tenant_id, "acme");
  });

  it("ignores a fire without a tenant or rule", async () => {
    recordRuleFire("", "rule_a");
    recordRuleFire("acme", "");
    assert.equal(__ruleFireBufferForTests().entries.length, 0);
  });
});

describe("ruleFireKey", () => {
  it("round-trips any characters", () => {
    const key = ruleFireKey('te"nant', "rule with spaces, and [brackets]", "2026-11-12");
    assert.deepEqual(parseRuleFireKey(key), { tenantId: 'te"nant', ruleId: "rule with spaces, and [brackets]", day: "2026-11-12" });
  });

  it("rejects what is not a key", () => {
    for (const bad of ["", "acme rule 2026-11-12", "[1,2,3]", '["a","b"]']) assert.equal(parseRuleFireKey(bad), null);
  });
});
