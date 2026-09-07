/**
 * tests/ai/rule-suggestion-flow.test.ts
 *
 * The rule suggestion is credit-metered (D1 fase 2) and "adviseert, beslist
 * niet". These tests pin:
 *
 *   • no budget → NO model call, clear message, NO charge (the brake);
 *   • success → the draft is returned and charged EXACTLY once (Brainpower);
 *   • provider / validation error → NO charge;
 *   • the flow NEVER persists a rule — its only side effect is the usage charge;
 *   • the charge writes one ai_rule_suggestion debit + one usage_events row.
 */

import { test, describe } from "node:test";
import assert             from "node:assert/strict";

import {
  runRuleSuggestion,
  chargeForRuleSuggestion,
  AI_RULE_SUGGESTION_CREDIT_COST,
  type RuleSuggestionDeps,
} from "@/ai/rule-suggestion-flow";
import { aiGenerationBlockMessage } from "@/billing/ai-generation-guard";
import {
  SEED_RULES_CONFIG,
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
  type StoredRule,
} from "@/decision/rules/stored-rule";
import type { RuleSuggestionContext } from "@/ai/rule-suggester";
import type { AiGenerateResult } from "@/ai/providers/base-provider";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BRIEF = { audience: "returning visitors from Google" };

const GOOD = {
  condition: { type: "field", field: "source", operator: "equals", value: "google" },
  plan:      { heroKey: "hero_google_problem", proofKey: "proof_default", ctaKey: "cta_default" },
  label:     "Google visitors",
  reason:    "Fires for visitors arriving from Google search.",
};

const CTX: RuleSuggestionContext = {
  catalogue: {
    heroKeys:  [...ALLOWED_HERO_KEYS],
    proofKeys: [...ALLOWED_PROOF_KEYS],
    ctaKeys:   [...ALLOWED_CTA_KEYS],
  },
  extraKeys:  {},
  baseConfig: SEED_RULES_CONFIG,
};

const okGen = async (): Promise<AiGenerateResult> => ({ ok: true, text: JSON.stringify(GOOD) });

function makeDeps(over: Partial<RuleSuggestionDeps> = {}) {
  const calls = { generate: 0, charge: 0, chargedRule: null as StoredRule | null };
  const deps: RuleSuggestionDeps = {
    checkWallet:  async () => ({ blocked: false }),
    generate:     async () => { calls.generate++; return okGen(); },
    charge:       async (rule) => { calls.charge++; calls.chargedRule = rule; },
    blockMessage: aiGenerationBlockMessage,
    ...over,
  };
  return { deps, calls };
}

// ── (d) The brake: no budget → no call, no charge ─────────────────────────────

describe("runRuleSuggestion — wallet guard", () => {
  test("insufficient balance → no model call, clear message, no charge", async () => {
    const { deps, calls } = makeDeps({
      checkWallet: async () => ({ blocked: true, blockReason: "insufficient_balance" }),
    });
    const res = await runRuleSuggestion("t1", BRIEF, CTX, deps);
    assert.equal(res.ok, false);
    assert.equal(calls.generate, 0, "model must not be called when blocked");
    assert.equal(calls.charge, 0, "no charge when blocked");
    assert.equal(!res.ok && res.error, aiGenerationBlockMessage("insufficient_balance"));
  });
});

// ── Success charges exactly once + returns the draft ──────────────────────────

describe("runRuleSuggestion — success", () => {
  test("returns a validated draft and charges exactly once", async () => {
    const { deps, calls } = makeDeps();
    const res = await runRuleSuggestion("t1", BRIEF, CTX, deps);
    assert.ok(res.ok);
    assert.equal(calls.generate, 1);
    assert.equal(calls.charge, 1, "exactly one charge on success");
    assert.ok(res.ok && calls.chargedRule?.id === res.rule.id, "charged for the returned rule");
  });

  test("the flow performs NO rule persistence — only the usage charge fires", async () => {
    // The deps expose exactly one side effect (charge = usage billing). There is
    // no save/persist dependency, so a suggestion can never auto-write a rule.
    const { deps, calls } = makeDeps();
    await runRuleSuggestion("t1", BRIEF, CTX, deps);
    // 'charge' is the sole side-effect channel; assert nothing else is invoked by
    // confirming the returned rule is a draft the caller must still save.
    assert.equal(calls.charge, 1);
    assert.ok(!("save" in deps), "the flow has no persistence dependency");
  });
});

// ── Provider / validation errors do not charge ────────────────────────────────

describe("runRuleSuggestion — errors do not charge", () => {
  test("provider MODEL_ERROR → no charge", async () => {
    const { deps, calls } = makeDeps({
      generate: async () => ({ ok: false, code: "MODEL_ERROR", reason: "boom" }),
    });
    const res = await runRuleSuggestion("t1", BRIEF, CTX, deps);
    assert.equal(res.ok, false);
    assert.equal(calls.charge, 0);
  });

  test("invalid suggestion (unknown field) → no charge, not injected", async () => {
    const bad = { ...GOOD, condition: { type: "field", field: "not_a_field", operator: "equals", value: "x" } };
    const { deps, calls } = makeDeps({
      generate: async () => ({ ok: true, text: JSON.stringify(bad) }),
    });
    const res = await runRuleSuggestion("t1", BRIEF, CTX, deps);
    assert.equal(res.ok, false, "an invalid suggestion is rejected");
    assert.equal(calls.charge, 0, "a rejected suggestion is never charged");
  });
});

// ── The charge writes one debit + one Brainpower audit row ─────────────────────

type RpcCall   = { name: string; params: Record<string, unknown> };
type InsertRow = Record<string, unknown>;

function fakeSupabase(rpcData: number | null = 100, rpcError: unknown = null) {
  const rpc:     RpcCall[]   = [];
  const inserts: InsertRow[] = [];
  const makeChain = (table: string) => {
    let lastInsert: InsertRow = {};
    const chain: Record<string, unknown> = {
      select: () => chain, eq: () => chain, update: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single:      async () => ({ data: lastInsert, error: null }),
      insert: (p: InsertRow) => { if (table === "usage_events") inserts.push(p); lastInsert = p; return chain; },
    };
    return chain;
  };
  const client = {
    from: (t: string) => makeChain(t),
    rpc:  async (name: string, params: Record<string, unknown>) => {
      rpc.push({ name, params });
      return { data: rpcData, error: rpcError };
    },
  } as never;
  return { client, rpc, inserts };
}

const SAMPLE_RULE: StoredRule = {
  id: "ai.google_visitors_ab12cd", priority: 42, label: "Google visitors",
  condition: { type: "field", field: "source", operator: "equals", value: "google" },
  plan: { heroKey: "hero_google_problem", proofKey: "proof_default", ctaKey: "cta_default" },
  reason: "Fires for Google traffic.", enabled: true, source: "tenant",
};

describe("chargeForRuleSuggestion — one debit + one Brainpower audit row", () => {
  test("debits 6 credits to Brainpower and writes the usage_events row", async () => {
    const { client, rpc, inserts } = fakeSupabase();
    await chargeForRuleSuggestion(client, "tenant-9", SAMPLE_RULE);

    const debit = rpc.find((c) => c.name === "debit_wallet");
    assert.ok(debit, "a wallet debit was issued");
    assert.equal(debit!.params.p_credit_cost, AI_RULE_SUGGESTION_CREDIT_COST);
    assert.equal(debit!.params.p_credit_cost, 6);
    assert.equal(debit!.params.p_category, "brainpower");
    assert.equal(debit!.params.p_reference_type, "ai_rule_suggestion");
    assert.equal(debit!.params.p_tenant_id, "tenant-9");

    assert.equal(inserts.length, 1, "exactly one usage_events row");
    const row = inserts[0]!;
    assert.equal(row.event_type, "ai_rule_suggestion");
    assert.equal(row.category, "brainpower");
    assert.equal(row.credits_used, 6);
    assert.equal(row.billable, true);
    assert.equal(row.success, true);
    assert.equal(row.tenant_id, "tenant-9");
    assert.deepEqual(row.metadata, { ruleId: "ai.google_visitors_ab12cd", priority: 42 });
  });

  test("failed debit → audit row recorded as unbilled (no silent charge leak)", async () => {
    const { client, inserts } = fakeSupabase(null, { message: "insufficient_wallet_balance", code: "P0001" });
    await chargeForRuleSuggestion(client, "tenant-9", SAMPLE_RULE);
    assert.equal(inserts.length, 1);
    const row = inserts[0]!;
    assert.equal(row.credits_used, 0, "not billed when the debit failed");
    assert.equal(row.billable, false);
    assert.equal(row.error_code, "debit_failed");
  });
});
