/**
 * billing/enrichment-guard.ts
 *
 * Pre-call wallet balance gate for enrichment billing.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Before running the enrichment pipeline, call `checkWalletForEnrichment` to
 *   determine whether billable enrichments should be allowed or blocked.
 *
 *   The guard fails OPEN — if the wallet table is missing or the read fails,
 *   enrichments are allowed.  Billing errors must never degrade the visitor
 *   experience.
 *
 * ─── Filtering billable stages ────────────────────────────────────────────────
 *
 *   When the guard returns blocked=true, the caller (build-decision-context.ts)
 *   should filter out billable stages from the enricher list before calling
 *   runStagedPipeline.  Non-billable stages (IP headers, MaxMind local DB, etc.)
 *   are never affected.
 *
 *   Use `BILLABLE_STAGE_LABELS` to determine which stages to remove.
 *
 * ─── Monthly credit cap ───────────────────────────────────────────────────────
 *
 *   When tenant_wallets.monthly_credit_cap_cents > 0, the guard also computes
 *   month-to-date spend via getMonthToDateSpend() and blocks if the cap is
 *   reached.  The result includes fallbackMode so callers can apply the
 *   appropriate degraded enrichment tier instead of cutting enrichment entirely.
 *
 *   Fallback modes when cap exceeded:
 *     full_adaptive — enrichments still allowed (cap effectively disabled)
 *     smart_lite    — recognition-category only; adaptation + brainpower blocked
 *     default       — all billable enrichments blocked; static content only
 *
 * ─── Recording blocks ─────────────────────────────────────────────────────────
 *
 *   When enrichments are blocked, call `recordWalletBlock` to append one
 *   enrichment_usage row per would-be-billable stage so admins can see
 *   why enrichments were paused.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletGuardResult, UsageEventType } from "./types";
import {
  STAGE_LABEL_TO_EVENT_TYPE,
  ENRICHMENT_TYPE_CONFIG,
} from "./enrichment-pricing";
import { getMonthToDateSpend, currentPeriodKey } from "./usage-summary";
import { formatSupabaseError } from "./errors";
import { trackUsageEvent } from "./usage-events";

// Re-export for use in build-decision-context.ts
export type { WalletGuardResult };

// ── Billable stage label sets ──────────────────────────────────────────────────
//
// BILLABLE_STAGE_LABELS — any stage whose label maps to a non-null, billable
//   event type.  Used to filter all billable stages when wallet is empty.
//
// SMART_LITE_BLOCKED_STAGE_LABELS — stages in the adaptation and brainpower
//   categories only.  Used when fallbackMode === "smart_lite": recognition
//   stages still run, adaptation + brainpower are suppressed.
//
//   smart_lite behaviour:
//     recognition  — allowed (IPinfo Lite, Reverse Geocode, OpenKvK, Clearbit)
//     adaptation   — blocked (Weather, Intent)
//     brainpower   — blocked (GA4 History, HubSpot CRM)

export const BILLABLE_STAGE_LABELS: Set<string> = new Set(
  Object.entries(STAGE_LABEL_TO_EVENT_TYPE)
    .filter(([, eventType]) =>
      eventType !== null &&
      ENRICHMENT_TYPE_CONFIG[eventType as keyof typeof ENRICHMENT_TYPE_CONFIG]?.billable === true,
    )
    .map(([label]) => label),
);

export const SMART_LITE_BLOCKED_STAGE_LABELS: Set<string> = new Set(
  Object.entries(STAGE_LABEL_TO_EVENT_TYPE)
    .filter(([, eventType]) => {
      if (!eventType) return false;
      const config = ENRICHMENT_TYPE_CONFIG[eventType as keyof typeof ENRICHMENT_TYPE_CONFIG];
      return config?.billable === true && config.category !== "recognition";
    })
    .map(([label]) => label),
);

// ── Guard check ───────────────────────────────────────────────────────────────

/**
 * Check whether the tenant's wallet permits billable enrichment calls.
 *
 * Rules (evaluated in order):
 *   1. wallet status = 'frozen'    → blocked (reason: wallet_frozen)
 *   2. wallet status = 'suspended' → blocked (reason: wallet_suspended)
 *   3. balance_cents = 0           → blocked (reason: insufficient_balance)
 *   4. monthly_credit_cap_cents > 0 AND mtd_spend >= cap
 *                                  → blocked (reason: monthly_cap_exceeded)
 *                                    unless fallback_mode = 'full_adaptive'
 *   5. table missing / read error  → NOT blocked (fail open)
 *
 * @param client   Service-role Supabase client.
 * @param tenantId Tenant to check.
 */
export async function checkWalletForEnrichment(
  client:   SupabaseClient,
  tenantId: string,
): Promise<WalletGuardResult> {
  try {
    const { data, error } = await client
      .from("tenant_wallets")
      .select("balance, balance_cents, status, monthly_credit_cap_cents, fallback_mode")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      // 42P01 = table missing — migration not yet applied.  Fail open.
      if (error.code === "42P01") return { blocked: false, balanceCents: Infinity };
      // 42703 = new columns not yet migrated — fail open gracefully.
      if (error.code === "42703") {
        // Re-query with only the original columns so pre-migration tenants still work.
        const { data: legacyData, error: legacyErr } = await client
          .from("tenant_wallets")
          .select("balance_cents, status")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (legacyErr || !legacyData) return { blocked: false, balanceCents: Infinity };
        return _evaluateBasicWallet(legacyData as { balance_cents: number; status: string });
      }
      console.error("[billing/enrichment-guard] wallet read error — failing open", {
        tenantId, code: error.code, message: error.message,
      });
      return { blocked: false, balanceCents: Infinity };
    }

    // No wallet row = tenant hasn't been billed yet → allow enrichments.
    if (!data) return { blocked: false, balanceCents: Infinity };

    const {
      balance,
      balance_cents,
      status,
      monthly_credit_cap_cents,
      fallback_mode,
    } = data as {
      balance?:                  number | null;
      balance_cents:             number;
      status:                    string;
      monthly_credit_cap_cents:  number;
      fallback_mode:             "full_adaptive" | "smart_lite" | "default";
    };

    // ── 1–3: status and balance checks ─────────────────────────────────────────
    //
    // Prefer balance (NUMERIC, migration 076) over balance_cents (INTEGER).
    // balance_cents rounds fractional credits (e.g. 0.04 credits) to 0, which
    // would incorrectly block enrichments when the wallet still has value.
    const basicResult = _evaluateBasicWallet({ balance: balance ?? null, balance_cents, status });
    if (basicResult.blocked) return basicResult;

    // ── 4: monthly credit cap check ────────────────────────────────────────────
    //
    // Only check when cap is configured (> 0) and fallback is not full_adaptive
    // (full_adaptive means the cap is intentionally not enforced).
    const capCents = monthly_credit_cap_cents ?? 0;
    const resolvedFallback = (fallback_mode ?? "smart_lite") as "full_adaptive" | "smart_lite" | "default";

    if (capCents > 0 && resolvedFallback !== "full_adaptive") {
      try {
        const mtdSpendCents = await getMonthToDateSpend(client, tenantId, currentPeriodKey());

        if (mtdSpendCents >= capCents) {
          return {
            blocked:       true,
            blockReason:   "monthly_cap_exceeded",
            balanceCents:  balance_cents,
            fallbackMode:  resolvedFallback,
            mtdSpendCents,
            capCents,
          };
        }
      } catch (capErr) {
        // MTD spend query failure → fail open (do not block enrichments).
        console.error("[billing/enrichment-guard] monthly cap check failed — failing open", {
          tenantId,
          ...serializeError(capErr),
        });
      }
    }

    // Use NUMERIC balance when available; INTEGER balance_cents as last resort.
    const resolvedBalance = balance ?? balance_cents;
    return { blocked: false, balanceCents: resolvedBalance };
  } catch (err) {
    // Unexpected exception → fail open.
    console.error("[billing/enrichment-guard] unexpected error — failing open", {
      tenantId,
      ...serializeError(err),
    });
    return { blocked: false, balanceCents: Infinity };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _evaluateBasicWallet(
  wallet: { balance?: number | null; balance_cents: number; status: string },
): WalletGuardResult {
  const { status } = wallet;

  // Prefer NUMERIC balance (migration 076) over INTEGER balance_cents.
  // balance_cents rounds fractional credits to 0 and falsely blocks wallets
  // that still have value (e.g. 0.04 credits rounds to balance_cents=0).
  const balance = wallet.balance ?? wallet.balance_cents ?? 0;

  if (status === "frozen") {
    return { blocked: true, blockReason: "wallet_frozen",       balanceCents: balance };
  }
  if (status === "suspended") {
    return { blocked: true, blockReason: "wallet_suspended",    balanceCents: balance };
  }
  if (balance <= 0) {
    return { blocked: true, blockReason: "insufficient_balance", balanceCents: 0 };
  }

  return { blocked: false, balanceCents: balance };
}

// ── Record a block event ──────────────────────────────────────────────────────

/**
 * Record usage_events rows for each billable stage that was blocked by the
 * wallet guard.  Admins see these as events with success=false and an
 * error_code matching the block reason (e.g. "insufficient_balance").
 *
 * Previously wrote to enrichment_usage; now writes to usage_events (migration 068).
 * The wallet_blocked signal is carried in error_code and metadata.wallet_blocked.
 *
 * This function is fire-and-forget safe — errors are swallowed.
 *
 * @param stageLabels  Labels of the stages that were blocked.
 */
export async function recordWalletBlock(
  client:      SupabaseClient,
  tenantId:    string,
  blockReason: string,
  stageLabels: string[],
  sessionId?:  string,
): Promise<void> {
  if (stageLabels.length === 0) return;

  // Fire one trackUsageEvent per blocked stage, all fire-and-forget.
  const writes = stageLabels.map(async (label) => {
    const eventType = STAGE_LABEL_TO_EVENT_TYPE[label] as UsageEventType | undefined;
    if (!eventType) return; // skip unmapped labels (should not happen for billable stages)

    const config   = ENRICHMENT_TYPE_CONFIG[eventType];
    const category = config?.category ?? "recognition";

    try {
      await trackUsageEvent(client, {
        tenantId,
        eventType,
        creditsCost:   0,
        creditsUsed:   0,
        price:         0,
        billable:      true,   // the stage WAS billable; it was blocked before running
        category,
        featureKey:    eventType,
        success:       false,
        cacheHit:      false,
        errorCode:     blockReason,
        sessionId,
        metadata: {
          stageLabel:    label,
          blockReason,
          wallet_blocked: true,
        },
      });
    } catch (err) {
      console.error(
        `[billing/enrichment-guard] recordWalletBlock: trackUsageEvent failed` +
        ` | table=usage_events | tenant=${tenantId} | stage=${label}` +
        ` | ${formatSupabaseError(err)}`,
      );
    }
  });

  await Promise.allSettled(writes);
}
