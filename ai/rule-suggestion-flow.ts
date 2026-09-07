/**
 * AI Rule Suggestion — credit-metered flow (D1 fase 2).
 *
 * The orchestration around a single suggestion: a PRE-call wallet guard (the
 * brake — no budget, no model call) and a POST-success charge (debit + audit),
 * charged ONLY when a valid, validated rule was produced. Reuses the fase-1
 * credit-rem: the same wallet guard and the shared chargeAiUsage helper.
 *
 * Kept OUT of the "use server" actions file so it is pure over its dependencies
 * and unit-testable: the action wires the real guard / provider / charge, tests
 * inject fakes.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chargeAiUsage } from "@/billing/ai-usage-charge";
import {
  suggestRule,
  type GenerateFn,
  type RuleSuggestionBrief,
  type RuleSuggestionContext,
  type SuggestResult,
} from "@/ai/rule-suggester";
import type { StoredRule } from "@/decision/rules/stored-rule";

/**
 * Credits charged per successful rule suggestion. Brainpower tier (6 cr) — one
 * LLM call, same band as AI variant generation (see billing/credits.ts).
 */
export const AI_RULE_SUGGESTION_CREDIT_COST = 6;

/** Minimal wallet-guard shape the flow needs (see billing/ai-generation-guard). */
export interface AiWalletGuard {
  blocked:      boolean;
  blockReason?: string | undefined;
}

/** Injected dependencies — real in the action, faked in tests. */
export interface RuleSuggestionDeps {
  /** Pre-call wallet gate. `blocked:true` → no model call. */
  checkWallet:  (tenantId: string) => Promise<AiWalletGuard>;
  /** The provider generate fn (createAiProvider(...).generate). */
  generate:     GenerateFn;
  /** Charge for one successful, validated suggestion. */
  charge:       (rule: StoredRule) => Promise<void>;
  /** Map a block reason to an operator-facing message. */
  blockMessage: (reason: string | undefined) => string;
  /** Allow one corrective retry when the first suggestion fails validation. */
  retryOnInvalid?: boolean;
}

/**
 * Run ONE credit-metered rule suggestion:
 *   1. wallet guard  — blocked → return the block message, NO model call, NO charge.
 *   2. suggest       — via the injected provider fn; provider/parse/validation
 *                      error → NO charge (nothing valid was produced).
 *   3. charge        — only after a valid, validated rule, exactly once.
 */
export async function runRuleSuggestion(
  tenantId: string,
  brief:    RuleSuggestionBrief,
  ctx:      RuleSuggestionContext,
  deps:     RuleSuggestionDeps,
): Promise<SuggestResult> {
  // ── 1. Pre-call wallet guard — the brake ──────────────────────────────────
  const guard = await deps.checkWallet(tenantId);
  if (guard.blocked) {
    return { ok: false, error: deps.blockMessage(guard.blockReason) };
  }

  // ── 2. Suggest via the shared AiProvider abstraction ──────────────────────
  const res = await suggestRule(brief, ctx, {
    generate: deps.generate,
    ...(deps.retryOnInvalid ? { retryOnInvalid: true } : {}),
  });
  if (!res.ok) return res; // provider / parse / validation error → no charge

  // ── 3. Charge only on a valid, validated suggestion ───────────────────────
  await deps.charge(res.rule);
  return res;
}

/**
 * Charge for one successful rule suggestion: debit the wallet + write a
 * usage_events audit row (tenant, type, credits, ruleId, priority). Called only
 * after a valid suggestion — never on a provider / parse / validation error.
 * Fire-and-forget over the operator flow (the rule is an unsaved draft).
 */
export async function chargeForRuleSuggestion(
  client:   SupabaseClient,
  tenantId: string,
  rule:     StoredRule,
): Promise<void> {
  await chargeAiUsage(client, tenantId, {
    eventType:     "ai_rule_suggestion",
    credits:       AI_RULE_SUGGESTION_CREDIT_COST,
    category:      "brainpower",
    referenceType: "ai_rule_suggestion",
    note:          `AI rule suggestion — ${rule.label}`,
    metadata:      { ruleId: rule.id, priority: rule.priority },
  });
}
