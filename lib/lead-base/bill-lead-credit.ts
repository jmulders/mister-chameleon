/**
 * Lead Base — credit billing.
 *
 * Charges Chameleon Credits for Lead Base value events. Currently used for
 * RECOGNITION: 1 credit when the platform first identifies the company behind a
 * visitor (anonymous → recognised, via IP enrichment). This mirrors the existing
 * enrichment billing model — you pay at the identification moment, only when value
 * is delivered. ABM named leads (your own data) never hit "recognised", so they
 * are not charged here.
 *
 * Fail-open: wallet errors never block the request (runs post-response).
 * See docs/lead-base-design.md.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb }                    from "@/data/db";
import { debitWallet }              from "@/billing/wallet";
import { checkWalletForEnrichment } from "@/billing/enrichment-guard";
import { logger }                   from "@/lib/logger";

/** 1 credit = €0.01 — same unit as an enrichment lookup. */
const RECOGNITION_CREDIT_COST = 1;

export async function billLeadCredit(
  tenantId:    string,
  visitorKey:  string,
  referenceId: string = `recognition:${visitorKey}`,
  note:        string = "lead_base — recognition (company identified)",
): Promise<void> {
  try {
    const client = getDb() as unknown as SupabaseClient;

    // Pre-flight guard — skip the debit when the wallet is empty/frozen/suspended.
    try {
      const guard = await checkWalletForEnrichment(client, tenantId);
      if (guard.blocked) {
        logger.warn("[lead-base] credit debit skipped — wallet blocked", {
          tenantId, blockReason: guard.blockReason,
        });
        return;
      }
    } catch {
      // Guard failure → fail open (attempt the debit anyway).
    }

    await debitWallet(
      client,
      tenantId,
      RECOGNITION_CREDIT_COST,
      "lead_base",   // referenceType
      referenceId,
      note,
      "recognition", // category → wallet_ledger
    );
  } catch (err) {
    logger.warn("[lead-base] billLeadCredit failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
}
