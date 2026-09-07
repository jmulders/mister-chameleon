/**
 * billing/ai-usage-charge.ts
 *
 * Shared POST-success charge for on-demand AI operations (variant generation,
 * rule suggestion, …). One helper so every AI feature meters the same way:
 * debit the wallet (the real deduction — this is what makes the credit-rem an
 * actual brake on the next call) AND write a usage_events audit row.
 *
 * Call ONLY after the operation succeeded — never on a provider / parse /
 * validation error. Fire-and-forget over the operator flow: the AI output is a
 * draft pending human review, so a billing hiccup logs but never loses the draft.
 *
 * Mirrors billing/enrichment-tracker.ts: debitWallet is the single debit path;
 * if the debit fails (e.g. a balance race after the pre-call guard) we record
 * the event as unbilled (creditsCost 0 + errorCode) rather than logging a charge
 * that never hit the ledger — the "delivered, nobody billed" leak.
 *
 * Server only.
 */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageEventType } from "./types";
import type { CreditCategory } from "./credits";
import { debitWallet }     from "./wallet";
import { trackUsageEvent } from "./usage-events";
import { logger }          from "@/lib/logger";

export interface AiUsageChargeInput {
  eventType:     UsageEventType;
  /** Credits to charge (Chameleon Credits; 1 credit = €0.01). */
  credits:       number;
  category:      CreditCategory;
  /** wallet_ledger reference type (e.g. "ai_variant_generation"). */
  referenceType: string;
  /** Human-readable ledger note. */
  note:          string;
  /** Extra audit fields (e.g. { slot } or { ruleId, priority }). */
  metadata?:     Record<string, unknown>;
}

/**
 * Charge for one successful AI operation. Returns `{ charged }` — false when the
 * debit did not go through (recorded as an unbilled audit row). Never throws.
 */
export async function chargeAiUsage(
  client:   SupabaseClient,
  tenantId: string,
  input:    AiUsageChargeInput,
): Promise<{ charged: boolean }> {
  const { eventType, credits, category, referenceType, note, metadata = {} } = input;

  // Unique per call so each operation is charged exactly once and the audit
  // insert is never skipped as a duplicate (there is no visitor session here).
  const nonce          = randomBytes(6).toString("hex");
  const referenceId    = `${referenceType}:${nonce}`;
  const idempotencyKey = `${eventType}:${tenantId}:${nonce}`;

  let charged = false;
  try {
    const debit = await debitWallet(
      client,
      tenantId,
      credits,
      referenceType,
      referenceId,
      note,
      category, // → wallet_ledger
    );
    charged = debit.success;
    if (!debit.success) {
      logger.warn("[ai-usage-charge] wallet debit failed after success — recording unbilled", {
        tenantId, eventType, error: debit.error,
      });
    }
  } catch (err) {
    logger.warn("[ai-usage-charge] wallet debit threw after success — recording unbilled", {
      tenantId, eventType, err: err instanceof Error ? err.message : String(err),
    });
  }

  // Audit row — always written, so an operator can find every AI operation.
  await trackUsageEvent(client, {
    tenantId,
    eventType,
    creditsCost:    charged ? credits : 0,
    billable:       charged,
    category,
    featureKey:     eventType,
    success:        true,   // the operation itself succeeded
    cacheHit:       false,
    ...(charged ? {} : { errorCode: "debit_failed" }),
    idempotencyKey,
    metadata,
  });

  return { charged };
}
