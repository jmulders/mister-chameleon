/**
 * billing/ai-generation-guard.ts
 *
 * Pre-call wallet gate for the AI variant generator (D1). Same wallet evaluation
 * as the enrichment guard — no wallet / insufficient balance / frozen / suspended
 * / monthly cap all block — but AI generation is a single, all-or-nothing call
 * (no per-stage filtering, no smart_lite tier): if the wallet can't pay, we make
 * no AI call at all.
 *
 * Fails OPEN on infrastructure errors (missing table/columns, unreadable wallet):
 * a billing outage must not block an operator's authoring action. It only blocks
 * on a *known* budget state, which `checkWalletForEnrichment` already computes —
 * so this is a thin, DRY wrapper over it.
 *
 * Server only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkWalletForEnrichment } from "./enrichment-guard";
import type { WalletGuardResult } from "./types";

export interface AiGenerationGuardResult {
  /** True when AI generation must be blocked (no model call). */
  blocked:      boolean;
  /** Machine-readable reason when blocked (from the wallet evaluation). */
  blockReason?: WalletGuardResult["blockReason"];
  balanceCents: number;
}

/** Operator-facing message per block reason. */
export function aiGenerationBlockMessage(reason: string | undefined): string {
  switch (reason) {
    case "no_wallet":
      return "Deze tenant heeft nog geen wallet — er is geen saldo om de AI-generatie tegen af te schrijven. Richt de wallet in en probeer opnieuw.";
    case "insufficient_balance":
      return "Onvoldoende saldo voor AI-generatie (6 credits). Vul de wallet aan en probeer opnieuw.";
    case "wallet_frozen":
      return "De wallet is bevroren — AI-generatie is geblokkeerd tot dat is opgeheven.";
    case "wallet_suspended":
      return "De wallet is opgeschort (saldo op) — vul aan om AI-generatie weer te gebruiken.";
    case "monthly_cap_exceeded":
      return "De maandelijkse creditlimiet is bereikt — AI-generatie is geblokkeerd tot volgende periode of tot de limiet wordt verhoogd.";
    default:
      return "AI-generatie is geblokkeerd door de wallet-status. Controleer het saldo en de status.";
  }
}

/**
 * Decide whether an AI variant generation may run for this tenant. `blocked:true`
 * means: do NOT call the model. Fails open (blocked:false) on infra errors.
 */
export async function checkWalletForAiGeneration(
  client:   SupabaseClient,
  tenantId: string,
): Promise<AiGenerationGuardResult> {
  const wallet = await checkWalletForEnrichment(client, tenantId);
  return {
    blocked:      wallet.blocked,
    ...(wallet.blockReason ? { blockReason: wallet.blockReason } : {}),
    balanceCents: wallet.balanceCents,
  };
}
