/**
 * tests/ai/variant-generation-flow.test.ts
 *
 * The AI variant generator is credit-metered (D1). These tests pin the four
 * behaviours that make the metering a real brake without changing the output:
 *
 *   (a) Insufficient balance → NO model call, a clear message, and NO charge.
 *   (b) Success              → exactly ONE charge, on the Brainpower category,
 *                              plus one usage_events audit row (tenant/type/credits/slot).
 *   (c) Provider error code  → NO charge, a clean operator message.
 *   (d) Output shape unchanged → the flow returns exactly what generateVariant does.
 *
 * The flow is pure over injected deps, so (a)/(c)/(d) need no DB. The charge
 * helper is exercised against a fake Supabase client so (b) can assert the real
 * debit + audit payloads.
 */

import { test, describe } from "node:test";
import assert             from "node:assert/strict";

import {
  runVariantGeneration,
  chargeForAiGeneration,
  AI_GENERATION_CREDIT_COST,
  type VariantGenerationDeps,
} from "@/ai/variant-generation-flow";
import { generateVariant, type VariantBrief } from "@/ai/variant-generator";
import { aiGenerationBlockMessage }           from "@/billing/ai-generation-guard";
import type { AiGenerateResult }              from "@/ai/providers/base-provider";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BRIEF: VariantBrief = { slot: "hero", audience: "CTOs at scale-ups" };

/** A well-formed model response the coercer accepts. */
const GOOD_JSON = JSON.stringify({
  content: {
    title:    "Schaal zonder chaos",
    subtitle: "Personalisatie die met je meegroeit.",
    ctas:     [{ label: "Plan een demo", href: "/demo", variant: "primary" }],
  },
  decision: {
    decisionLabel:   "CTO — scale-up",
    decisionSummary: "Voor technische kopers die opschalen.",
    intentLevel:     "consideration",
    funnelStages:    ["consideration"],
    tone:            "credibility",
    primaryGoal:     "demo",
  },
});

const okGenerate    = async (): Promise<AiGenerateResult> => ({ ok: true, text: GOOD_JSON });

/** Deps with spies so we can assert what was (not) called. */
function makeDeps(over: Partial<VariantGenerationDeps> = {}) {
  const calls = { generate: 0, charge: 0, chargedSlot: null as string | null };
  const deps: VariantGenerationDeps = {
    checkWallet:  async () => ({ blocked: false }),
    generate:     async () => { calls.generate++; return okGenerate(); },
    charge:       async (slot) => { calls.charge++; calls.chargedSlot = slot; },
    blockMessage: aiGenerationBlockMessage,
    ...over,
  };
  return { deps, calls };
}

// ── (a) Insufficient balance blocks BEFORE the model call ─────────────────────

describe("runVariantGeneration — wallet guard (the brake)", () => {
  test("insufficient balance → no model call, clear message, no charge", async () => {
    const { deps, calls } = makeDeps({
      checkWallet: async () => ({ blocked: true, blockReason: "insufficient_balance" }),
    });

    const res = await runVariantGeneration("t1", BRIEF, deps);

    assert.equal(res.ok, false);
    assert.equal(calls.generate, 0, "model must NOT be called when blocked");
    assert.equal(calls.charge, 0, "no charge when blocked");
    assert.ok(!res.ok && res.error.includes("saldo"), "message names the balance problem");
    assert.equal(!res.ok && res.error, aiGenerationBlockMessage("insufficient_balance"));
  });

  test("no wallet → blocked with the no_wallet message, no call, no charge", async () => {
    const { deps, calls } = makeDeps({
      checkWallet: async () => ({ blocked: true, blockReason: "no_wallet" }),
    });
    const res = await runVariantGeneration("t1", BRIEF, deps);
    assert.equal(res.ok, false);
    assert.equal(calls.generate, 0);
    assert.equal(calls.charge, 0);
  });
});

// ── (b) Success charges exactly once ──────────────────────────────────────────

describe("runVariantGeneration — success", () => {
  test("charges exactly once, for the briefed slot", async () => {
    const { deps, calls } = makeDeps();

    const res = await runVariantGeneration("t1", BRIEF, deps);

    assert.equal(res.ok, true);
    assert.equal(calls.generate, 1);
    assert.equal(calls.charge, 1, "exactly one charge on success");
    assert.equal(calls.chargedSlot, "hero");
  });
});

// ── (c) Provider error → clean message, no charge ─────────────────────────────

describe("runVariantGeneration — provider errors do not charge", () => {
  test("MODEL_ERROR → no charge, message surfaces the reason", async () => {
    const { deps, calls } = makeDeps({
      generate: async () => ({ ok: false, code: "MODEL_ERROR", reason: "boom" }),
    });

    const res = await runVariantGeneration("t1", BRIEF, deps);

    assert.equal(res.ok, false);
    assert.equal(calls.charge, 0, "a provider error must not be charged");
    assert.ok(!res.ok && res.error.includes("boom"));
  });

  test("DISABLED → no charge, clean message", async () => {
    const { deps, calls } = makeDeps({
      generate: async () => ({ ok: false, code: "DISABLED", reason: "off" }),
    });
    const res = await runVariantGeneration("t1", BRIEF, deps);
    assert.equal(res.ok, false);
    assert.equal(calls.charge, 0);
    assert.ok(!res.ok && res.error.toLowerCase().includes("uitgeschakeld"));
  });

  test("unparseable model output → no charge", async () => {
    const { deps, calls } = makeDeps({
      generate: async () => ({ ok: true, text: "not json at all" }),
    });
    const res = await runVariantGeneration("t1", BRIEF, deps);
    assert.equal(res.ok, false);
    assert.equal(calls.charge, 0, "a parse failure is not a delivered variant — no charge");
  });
});

// ── (d) Output shape is unchanged by the metering wrapper ─────────────────────

describe("runVariantGeneration — output shape unchanged", () => {
  test("returns exactly what generateVariant returns on success", async () => {
    const direct  = await generateVariant(BRIEF, { generate: okGenerate });
    const { deps } = makeDeps();
    const wrapped = await runVariantGeneration("t1", BRIEF, deps);

    assert.deepEqual(wrapped, direct);
    // Spot-check the contract fields the drawer relies on.
    assert.ok(wrapped.ok && direct.ok);
    assert.equal(wrapped.variant.content.title, "Schaal zonder chaos");
    assert.equal(wrapped.variant.content.subtitle, "Personalisatie die met je meegroeit.");
    assert.equal(wrapped.variant.decision.intentLevel, "consideration");
  });
});

// ── (b, cont.) The charge writes the right debit + audit row ───────────────────

type RpcCall    = { name: string; params: Record<string, unknown> };
type InsertRow  = Record<string, unknown>;

/** Fake Supabase client that records rpc() debits and usage_events inserts. */
function fakeSupabase(rpcData: number = 100) {
  const rpc:     RpcCall[]   = [];
  const inserts: InsertRow[] = [];

  const makeChain = (table: string) => {
    let lastInsert: InsertRow = {};
    const chain: Record<string, unknown> = {
      select:      () => chain,
      eq:          () => chain,
      gte:         () => chain,
      lt:          () => chain,
      order:       () => chain,
      limit:       () => chain,
      update:      () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single:      async () => ({ data: lastInsert, error: null }),
      insert:      (payload: InsertRow) => {
        if (table === "usage_events") inserts.push(payload);
        lastInsert = payload;
        return chain;
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => makeChain(table),
    rpc:  async (name: string, params: Record<string, unknown>) => {
      rpc.push({ name, params });
      return { data: rpcData, error: null };
    },
  };

  return { client: client as never, rpc, inserts };
}

describe("chargeForAiGeneration — one debit + one Brainpower audit row", () => {
  test("debits 6 credits to Brainpower and writes the usage_events row", async () => {
    const { client, rpc, inserts } = fakeSupabase();

    await chargeForAiGeneration(client, "tenant-42", "hero");

    // One debit, correct amount + category + reference type.
    const debit = rpc.find((c) => c.name === "debit_wallet");
    assert.ok(debit, "a wallet debit was issued");
    assert.equal(debit!.params.p_credit_cost, AI_GENERATION_CREDIT_COST);
    assert.equal(debit!.params.p_credit_cost, 6);
    assert.equal(debit!.params.p_category, "brainpower");
    assert.equal(debit!.params.p_reference_type, "ai_variant_generation");
    assert.equal(debit!.params.p_tenant_id, "tenant-42");

    // Exactly one audit row, with the fields needed to find the generation.
    assert.equal(inserts.length, 1, "exactly one usage_events row");
    const row = inserts[0]!;
    assert.equal(row.event_type, "ai_variant_generation");
    assert.equal(row.category, "brainpower");
    assert.equal(row.credits_used, 6);
    assert.equal(row.billable, true);
    assert.equal(row.success, true);
    assert.deepEqual(row.metadata, { slot: "hero" });
    assert.equal(row.tenant_id, "tenant-42");
  });

  test("failed debit → audit row recorded as unbilled (no silent charge leak)", async () => {
    // debit_wallet RPC error path: message includes insufficient_wallet_balance.
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
        return { data: null, error: { message: "insufficient_wallet_balance", code: "P0001" } };
      },
    } as never;

    await chargeForAiGeneration(client, "tenant-42", "cta");

    assert.equal(inserts.length, 1);
    const row = inserts[0]!;
    assert.equal(row.credits_used, 0, "not billed when the debit failed");
    assert.equal(row.billable, false);
    assert.equal(row.error_code, "debit_failed");
    assert.equal(row.success, true, "the generation itself still succeeded");
  });
});
