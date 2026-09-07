/**
 * AI Variant Generation — credit-metered flow (D1).
 *
 * The orchestration around a single generation: a PRE-call wallet guard (the
 * brake — no budget, no model call) and a POST-success charge (debit + audit).
 * Kept OUT of the "use server" actions file so it is pure over its dependencies
 * and unit-testable: the action wires the real guard / provider / charge, tests
 * inject fakes. See docs/ai-variant-generator.md.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { debitWallet }     from "@/billing/wallet";
import { trackUsageEvent } from "@/billing/usage-events";
import { logger }          from "@/lib/logger";
import {
  generateVariant,
  type GenerateFn,
  type GenerateResult,
  type VariantBrief,
  type GeneratorSlot,
} from "@/ai/variant-generator";

/**
 * Credits charged per successful AI generation call. Brainpower tier (6 cr) —
 * one LLM call is the platform's most expensive, quota-worthy operation, so it
 * shares the highest cost band (see billing/credits.ts EVENT_CATEGORY).
 */
export const AI_GENERATION_CREDIT_COST = 6;

/** Minimal wallet-guard shape the flow needs (see billing/ai-generation-guard). */
export interface AiWalletGuard {
  blocked:      boolean;
  blockReason?: string | undefined;
}

/** Injected dependencies — real in the action, faked in tests. */
export interface VariantGenerationDeps {
  /** Pre-call wallet gate. `blocked:true` → no model call. */
  checkWallet:  (tenantId: string) => Promise<AiWalletGuard>;
  /** The provider generate fn (createAiProvider(...).generate). */
  generate:     GenerateFn;
  /** Charge for one successful generation (debit + audit). */
  charge:       (slot: GeneratorSlot) => Promise<void>;
  /** Map a block reason to an operator-facing message. */
  blockMessage: (reason: string | undefined) => string;
}

/**
 * Run ONE credit-metered generation:
 *   1. wallet guard  — blocked → return the block message, NO model call, NO charge.
 *   2. generate      — via the injected provider fn; provider/parse error → NO charge.
 *   3. charge        — only after a successful generation, exactly once.
 *
 * Returns the same GenerateResult shape as generateVariant — the output contract
 * is unchanged; this only adds the guard-before and charge-after.
 */
export async function runVariantGeneration(
  tenantId: string,
  brief:    VariantBrief,
  deps:     VariantGenerationDeps,
): Promise<GenerateResult> {
  // ── 1. Pre-call wallet guard — the brake ──────────────────────────────────
  const guard = await deps.checkWallet(tenantId);
  if (guard.blocked) {
    return { ok: false, error: deps.blockMessage(guard.blockReason) };
  }

  // ── 2. Generate via the shared AiProvider abstraction ─────────────────────
  const res = await generateVariant(brief, { generate: deps.generate });
  if (!res.ok) return res; // provider/parse error → no charge

  // ── 3. Charge only on a successful generation ─────────────────────────────
  await deps.charge(brief.slot);
  return res;
}

/**
 * Charge for one successful generation: debit the wallet (the real deduction —
 * this is what makes credit-metering an actual brake on the next call) AND write
 * a usage_events audit row (tenant, type, credits, slot). Called only after a
 * successful generation — never on a provider/parse error.
 *
 * Fire-and-forget over the operator flow: the variant is a draft pending human
 * review, so a billing hiccup logs but never loses the generated draft.
 *
 * Mirrors billing/enrichment-tracker.ts: debitWallet is the single debit path;
 * if the debit fails (e.g. a balance race after the pre-call guard) we record
 * the event as unbilled (creditsCost 0 + errorCode) rather than logging a charge
 * that never hit the ledger — the "delivered, nobody billed" leak.
 */
export async function chargeForAiGeneration(
  client:   SupabaseClient,
  tenantId: string,
  slot:     GeneratorSlot,
): Promise<void> {
  // Unique per call so each generation is charged exactly once and the audit
  // insert is never skipped as a duplicate (there is no visitor session here).
  const nonce          = randomBytes(6).toString("hex");
  const referenceId    = `ai_variant_generation:${slot}:${nonce}`;
  const idempotencyKey = `ai_variant_generation:${tenantId}:${nonce}`;

  let charged = false;
  try {
    const debit = await debitWallet(
      client,
      tenantId,
      AI_GENERATION_CREDIT_COST,
      "ai_variant_generation", // referenceType
      referenceId,
      `AI variant generation — ${slot}`,
      "brainpower",            // category → wallet_ledger
    );
    charged = debit.success;
    if (!debit.success) {
      logger.warn("[ai-generate] wallet debit failed after generation — recording unbilled", {
        tenantId, slot, error: debit.error,
      });
    }
  } catch (err) {
    logger.warn("[ai-generate] wallet debit threw after generation — recording unbilled", {
      tenantId, slot, err: err instanceof Error ? err.message : String(err),
    });
  }

  // Audit row — always written, so an operator can find every generation.
  await trackUsageEvent(client, {
    tenantId,
    eventType:      "ai_variant_generation",
    creditsCost:    charged ? AI_GENERATION_CREDIT_COST : 0,
    billable:       charged,
    category:       "brainpower",
    featureKey:     "ai_variant_generation",
    success:        true,   // the generation itself succeeded
    cacheHit:       false,
    ...(charged ? {} : { errorCode: "debit_failed" }),
    idempotencyKey,
    metadata: { slot },
  });
}
