/**
 * billing/request-debug.ts
 *
 * Request-level billing debug model.
 *
 * ─── What this is ────────────────────────────────────────────────────────────
 *
 *   A structured snapshot of what the billing system did (or will do) for a
 *   single enrichment pipeline execution.  Used in two ways:
 *
 *   1. "trace" source  — built synchronously from the stage trace + static
 *      pricing.  Shows billing INTENT before the async debit fires.  Rendered
 *      in the site-level Billing Debug Panel (dev overlay).
 *
 *   2. "db" source  — reconstructed from enrichment_usage DB rows after the
 *      fact.  Shows actual billing OUTCOMES.  Rendered in the admin
 *      Tenants → Billing → Debug page.
 *
 * ─── Relation to enrichment-tracker.ts ────────────────────────────────────
 *
 *   trackEnrichmentUsage() now returns BillingRequestDebug so callers that
 *   DO await it (tests, admin paths) can inspect what happened.
 *   Fire-and-forget callers (the production request path) simply ignore
 *   the return value — no change in behavior.
 *
 * ─── Client safety ────────────────────────────────────────────────────────
 *
 *   Pure types + pure functions.  Safe to import in client components.
 */

import type { StageTrace } from "@/enrichment/types";
import {
  STAGE_LABEL_TO_EVENT_TYPE,
  ENRICHMENT_TYPE_CONFIG,
  ENRICHMENT_PRICE_CENTS,
} from "./enrichment-pricing";
import type { UsageEventType } from "./types";

// ── Core types ────────────────────────────────────────────────────────────────

/**
 * The billing outcome for one enrichment stage in a single request.
 *
 *   charged   — debit_wallet RPC ran and succeeded; credits deducted.
 *   cached    — provider-cache hit; cost = 0; no debit.
 *   skipped   — stage flagged skipped or not in the billable type map.
 *   failed    — stage ran but returned no output (or errored); cost = 0.
 *   simulated — demo/test mode; DB rows written but wallet unchanged.
 *   free      — billable=false for this type; always 0 credits.
 */
export type BillingStageResult =
  | "charged"
  | "cached"
  | "skipped"
  | "failed"
  | "simulated"
  | "free";

export interface BillingStageDebugEntry {
  /** Human-readable stage label from the enrichment pipeline. */
  stageLabel:         string;
  /** Canonical enrichment_type (null when stage is not in STAGE_LABEL_TO_EVENT_TYPE). */
  enrichmentType:     string | null;
  /** From ENRICHMENT_TYPE_CONFIG[type].billable. */
  billable:           boolean;
  /** Provider-cache hit — no real API call was made. */
  cacheHit:           boolean;
  /** Stage returned at least one non-null output field. */
  hasOutput:          boolean;
  /** Stage threw or returned an error. */
  hasError:           boolean;
  /** Wall-clock duration in ms (0 when stage was skipped entirely). */
  durationMs:         number;
  /** Error message when hasError is true. */
  error:              string | null;

  // ── Pricing ──────────────────────────────────────────────────────────────
  /** EUR unit price for this type (e.g. 0.030000 = €0.03). */
  unitPriceEur:       number;
  /** Credit cost per call (fractional, e.g. 3.000). */
  creditCost:         number;
  /** Integer cents actually charged (0 when cache/fail/skip/free/simulated). */
  centsCharged:       number;

  // ── Outcome ───────────────────────────────────────────────────────────────
  result:             BillingStageResult;

  // ── Actuals (only populated when source === "db") ─────────────────────────
  usageEventCreated?: boolean;
  ledgerEntryCreated?: boolean;
  balanceBeforeCents?: number;
  balanceAfterCents?:  number;
}

export interface BillingRequestDebug {
  /** Session ID or a generated UUID — groups all stages for one page load. */
  requestId:          string;
  tenantId:           string;
  timestamp:          string;   // ISO 8601

  /**
   * live       — real debits against the tenant wallet.
   * simulated  — demo / test_simulated mode; no real debits.
   * disabled   — no billingClient supplied (admin routes, CI, local dev without Supabase).
   */
  billingMode:        "live" | "simulated" | "disabled";
  /** True when running in the demo preview path (simulated is always true too). */
  demoMode:           boolean;

  // ── Wallet summary (null when disabled) ──────────────────────────────────
  walletBeforeCents:  number | null;
  walletAfterCents:   number | null;
  /** Sum of centsCharged across all stages. */
  totalChargedCents:  number;
  /** Sum of creditCost across charged stages. */
  totalCreditsUsed:   number;

  /** One entry per evaluated enrichment stage. */
  stages:             BillingStageDebugEntry[];

  /**
   * Human-readable anomaly descriptions.
   * Examples:
   *   "3 stages ran but 0 credits were charged — billing may be disabled"
   *   "Wallet debit failed for ip_enrich: insufficient_balance"
   *   "enrichment_pricing table missing — static defaults used"
   */
  anomalies:          string[];

  /**
   * "trace"  — built from stage trace before async debit fires (predictive).
   * "db"     — reconstructed from enrichment_usage rows after the fact (actual).
   */
  source:             "trace" | "db";
}

// ── Builder from stage trace (predictive — used by site debug panel) ──────────

/**
 * Build a BillingRequestDebug from a pipeline stage trace + static pricing.
 *
 * This is a SYNCHRONOUS pure function — no DB access, no async.
 * It reflects what the billing system INTENDS to do for each stage:
 * the actual async debit fires after this returns, but the intent is
 * deterministic from the trace.
 *
 * @param trace     Stage trace array from the enrichment pipeline.
 * @param options   billingMode, demoMode, tenantId, sessionId, pricing overrides.
 */
export function buildBillingDebugFromTrace(
  trace:   StageTrace[],
  options: {
    billingMode:  "live" | "simulated" | "disabled";
    demoMode:     boolean;
    tenantId:     string;
    sessionId?:   string;
    /** EUR pricing override (from enrichment_pricing table). */
    pricingMap?:  Record<string, { unitPriceEur: number; creditCost: number }>;
    /** Wallet balance before this pipeline ran (from pre-fetch). */
    walletBeforeCents?: number;
  },
): BillingRequestDebug {
  const {
    billingMode,
    demoMode,
    tenantId,
    sessionId,
    pricingMap = {},
    walletBeforeCents = null,
  } = options;

  const stages: BillingStageDebugEntry[] = [];
  let   totalChargedCents = 0;
  let   totalCreditsUsed  = 0;
  const anomalies: string[]  = [];

  for (const stage of trace) {
    if (stage.skipped) {
      stages.push({
        stageLabel:     stage.label,
        enrichmentType: null,
        billable:       false,
        cacheHit:       false,
        hasOutput:      false,
        hasError:       false,
        durationMs:     stage.durationMs ?? 0,
        error:          null,
        unitPriceEur:   0,
        creditCost:     0,
        centsCharged:   0,
        result:         "skipped",
      });
      continue;
    }

    const rawEventType = STAGE_LABEL_TO_EVENT_TYPE[stage.label];
    if (rawEventType === null || rawEventType === undefined) {
      // Stage ran (stage.skipped was false — already handled above) but has no
      // billing type. This means it is a free/in-process stage (e.g. IP
      // Classification, Cloud Detection, Seasonal Event / Nager.Date).
      // Use "free" so the monitor clearly distinguishes "ran but free" from
      // "didn't run at all" (which is "skipped").
      stages.push({
        stageLabel:     stage.label,
        enrichmentType: null,
        billable:       false,
        cacheHit:       false,
        hasOutput:      Object.values(stage.output ?? {}).some((v) => v !== null && v !== undefined),
        hasError:       stage.error != null,
        durationMs:     stage.durationMs ?? 0,
        error:          stage.error ? String(stage.error) : null,
        unitPriceEur:   0,
        creditCost:     0,
        centsCharged:   0,
        result:         "free",
      });
      continue;
    }

    const eventType = rawEventType as UsageEventType;
    const config    = ENRICHMENT_TYPE_CONFIG[eventType];

    // Resolve pricing: DB override → static fallback
    const pricingOverride = pricingMap[eventType];
    const staticCents     = ENRICHMENT_PRICE_CENTS[eventType] ?? 3;
    const unitPriceEur    = pricingOverride?.unitPriceEur ?? staticCents / 100;
    const creditCost      = pricingOverride?.creditCost   ?? staticCents;

    const billable   = !!config?.billable;
    const cacheHit   = stage.cacheSource === "provider-cache";
    const hasOutput  = !!(stage.output && Object.values(stage.output).some((v) => v !== null && v !== undefined));
    const hasError   = stage.error != null;
    const success    = !hasError && hasOutput;

    // Determine result
    let result: BillingStageResult;
    let centsCharged = 0;

    if (!billable) {
      result = "free";
    } else if (cacheHit) {
      result = "cached";
    } else if (!success) {
      result = "failed";
    } else if (billingMode === "disabled") {
      result = "skipped";  // would charge but billing is off
    } else if (billingMode === "simulated" || demoMode) {
      result = "simulated";
    } else {
      result        = "charged";
      centsCharged  = Math.round(unitPriceEur * 100);
    }

    if (result === "charged") {
      totalChargedCents += centsCharged;
      totalCreditsUsed  += creditCost;
    }

    stages.push({
      stageLabel:     stage.label,
      enrichmentType: eventType,
      billable,
      cacheHit,
      hasOutput,
      hasError,
      durationMs:     stage.durationMs ?? 0,
      error:          stage.error ? String(stage.error) : null,
      unitPriceEur,
      creditCost,
      centsCharged,
      result,
    });
  }

  // ── Anomaly detection ───────────────────────────────────────────────────────
  const liveSuccessful = stages.filter((s) => s.result === "charged" || (s.billable && !s.cacheHit && s.hasOutput));
  const actuallyCharged = stages.filter((s) => s.result === "charged");

  if (billingMode === "live" && liveSuccessful.length > 0 && actuallyCharged.length === 0) {
    anomalies.push(
      `${liveSuccessful.length} successful billable stage(s) ran but 0 credits were charged — check debit_wallet RPC.`,
    );
  }
  if (billingMode === "disabled") {
    anomalies.push("Billing is DISABLED for this route (no billingClient). No DB writes, no wallet debits.");
  }
  if (billingMode === "simulated" || demoMode) {
    anomalies.push("Running in demo/simulated mode — DB rows written but wallet balance is unchanged.");
  }
  const failures = stages.filter((s) => s.result === "failed");
  if (failures.length > 0) {
    anomalies.push(
      `${failures.length} stage(s) ran but returned no data (no_match / stage_error) — not charged.`,
    );
  }

  const walletAfterCents =
    walletBeforeCents !== null
      ? walletBeforeCents - totalChargedCents
      : null;

  return {
    requestId:         sessionId ?? `trace-${Date.now()}`,
    tenantId,
    timestamp:         new Date().toISOString(),
    billingMode,
    demoMode,
    walletBeforeCents,
    walletAfterCents,
    totalChargedCents,
    totalCreditsUsed,
    stages,
    anomalies,
    source:            "trace",
  };
}

// ── Builder from usage_events DB rows (actual — used by admin debug page) ─────
//
// Previously read from enrichment_usage; now reads from usage_events (migration 068).
// The column mapping is:
//   enrichment_type   → event_type
//   unit_price_cents  → metadata.unitPriceCents (or credits_cost)
//   total_price_cents → credits_used (NUMERIC) or credits_cost (INTEGER)
//   wallet_blocked    → error_code contains block reason; metadata.wallet_blocked = true
//   request_id        → session_id

export interface EnrichmentUsageDbRow {
  id:              string;
  tenant_id:       string;
  /** event_type from usage_events — same concept as enrichment_type. */
  event_type:      string;
  credits_cost:    number;
  credits_used:    number;
  price:           number;
  cache_hit:       boolean;
  billable:        boolean;
  success:         boolean;
  error_code:      string | null;
  session_id:      string | null;
  idempotency_key: string | null;
  metadata:        Record<string, unknown>;
  created_at:      string;
}

/**
 * Group usage_events DB rows by session_id and build one BillingRequestDebug per session.
 *
 * Reconstructs billing outcomes from the DB record rather than the live trace.
 * Used by the admin Billing → Debug page.
 */
export function buildBillingDebugFromDbRows(
  rows:     EnrichmentUsageDbRow[],
  tenantId: string,
): BillingRequestDebug[] {
  // Group by session_id (was request_id in enrichment_usage)
  const groups = new Map<string, EnrichmentUsageDbRow[]>();
  for (const row of rows) {
    const key = row.session_id ?? row.created_at.slice(0, 19); // fallback: minute bucket
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const result: BillingRequestDebug[] = [];

  for (const [requestId, groupRows] of groups) {
    const stages: BillingStageDebugEntry[] = groupRows.map((row) => {
      const meta          = row.metadata ?? {};
      const stageLabel    = (meta["stageLabel"] as string) ?? row.event_type;
      const walletDebitOk = meta["walletDebitSucceeded"] as boolean | undefined;
      const walletErrCode = meta["walletDebitErrorCode"] as string | undefined;
      const simulated     = !!(meta["simulated"]);

      // unit_price_cents is stored in metadata (written by enrichment-tracker.ts)
      const unitPriceCents   = (meta["unitPriceCents"] as number) ?? row.credits_cost;
      const totalPriceCents  = row.credits_used ?? row.credits_cost;

      // wallet_blocked was a column in enrichment_usage; now inferred from metadata/error_code.
      const walletBlocked = !!(meta["wallet_blocked"]) || (
        row.error_code != null && (
          row.error_code.includes("balance") ||
          row.error_code.includes("blocked") ||
          row.error_code.includes("suspended") ||
          row.error_code.includes("frozen")
        )
      );

      let result: BillingStageResult;
      if (!row.billable)                result = "free";
      else if (row.cache_hit)           result = "cached";
      else if (walletBlocked)           result = "failed";
      else if (!row.success)            result = "failed";
      else if (simulated)               result = "simulated";
      else if (walletDebitOk === false) result = "failed";
      else if (totalPriceCents > 0)     result = "charged";
      else                              result = "skipped";

      return {
        stageLabel,
        enrichmentType:     row.event_type,
        billable:           row.billable,
        cacheHit:           row.cache_hit,
        hasOutput:          row.success,
        hasError:           !!row.error_code,
        durationMs:         (meta["durationMs"] as number) ?? 0,
        error:              row.error_code ?? (walletErrCode ?? null),
        unitPriceEur:       unitPriceCents / 100,
        creditCost:         unitPriceCents,
        centsCharged:       totalPriceCents,
        result,
        usageEventCreated:  true,
        ledgerEntryCreated: result === "charged",
        balanceAfterCents:  (meta["balanceAfterCents"] as number) ?? undefined,
        balanceBeforeCents: (meta["balanceBeforeCents"] as number) ?? undefined,
      };
    });

    const totalChargedCents = stages.reduce((sum, s) => sum + s.centsCharged, 0);
    const totalCreditsUsed  = stages.reduce((sum, s) => s.result === "charged" ? sum + s.creditCost : sum, 0);

    // Derive billing mode from metadata
    const firstMeta = groupRows[0]?.metadata ?? {};
    const isSimulated = groupRows.some((r) => r.metadata?.simulated);
    const billingMode: "live" | "simulated" | "disabled" =
      isSimulated ? "simulated" : "live";

    const anomalies: string[] = [];
    const failedDebits = stages.filter((s) => s.result === "failed" && s.billable && !s.cacheHit && s.hasOutput);
    if (failedDebits.length > 0) {
      anomalies.push(`${failedDebits.length} debit(s) failed — wallet may have been insufficient.`);
    }
    if (isSimulated) {
      anomalies.push("Simulated mode — wallet balance was not changed.");
    }

    result.push({
      requestId,
      tenantId,
      timestamp:         groupRows[0]?.created_at ?? new Date().toISOString(),
      billingMode,
      demoMode:          isSimulated,
      walletBeforeCents: null,
      walletAfterCents:  null,
      totalChargedCents,
      totalCreditsUsed,
      stages,
      anomalies,
      source:            "db",
    });
  }

  // Sort descending by timestamp
  return result.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}
