/**
 * billing/enrichment-tracker.ts
 *
 * Post-pipeline enrichment usage tracking — wallet debit + dual-table recording.
 *
 * ─── Debit path ───────────────────────────────────────────────────────────────
 *
 *   `debitWallet()` (→ `public.debit_wallet` Postgres RPC) is the SINGLE debit
 *   path for enrichment billing.  The RPC atomically:
 *     1. Decrements tenant_wallets.balance_cents with a row-level lock.
 *     2. Inserts a wallet_ledger row with entry_type, category, and simulated flag.
 *     3. Raises 'insufficient_wallet_balance' on overdraft — no partial debits.
 *
 *   The legacy `deductCredits()` path has been removed.  All ledger entries are
 *   now written exclusively by the debit_wallet RPC.
 *
 * ─── What "v2" adds over the original ────────────────────────────────────────
 *
 *   1. Category propagation — every debit and usage_event carries the Chameleon
 *      Credits category (recognition / adaptation / brainpower).
 *   2. Internal cost tracking — actual provider cost in usage_events.internal_cost_cents.
 *   3. Feature key — usage_events.feature_key matches enrichment_pricing.enrichment_type.
 *   4. Wallet ledger category — debit_wallet RPC writes category into wallet_ledger
 *      so per-category spend queries work from the ledger directly.
 *
 * ─── Cache hits ───────────────────────────────────────────────────────────────
 *
 *   Cache hits (cacheSource === "provider-cache") cost 0 cents — no debit RPC
 *   call is made.  usage_events records cacheHit=true and 0 cost for analytics.
 *
 * ─── Insufficient funds handling ──────────────────────────────────────────────
 *
 *   When debit_wallet raises 'insufficient_wallet_balance':
 *     • debitWallet() returns { success: false }
 *     • usage_events row is written with creditsCost=0, errorCode="debit_failed"
 *     • A warning is logged so admins can see the pattern
 *
 *   Pre-flight blocking (checkWalletForEnrichment in enrichment-guard.ts) prevents
 *   enrichments from running at all when the wallet is empty or frozen.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 *
 * ─── Fire-and-forget ──────────────────────────────────────────────────────────
 *
 *   Never await this in a production request path.  All errors are swallowed
 *   (when throwOnError=false, the default) so billing never breaks visitors.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StageTrace }     from "@/enrichment/types";
import type { UsageEventType } from "./types";
import { trackUsageEvent }     from "./usage-events";
import {
  STAGE_LABEL_TO_EVENT_TYPE,
  ENRICHMENT_TYPE_CONFIG,
  ENRICHMENT_PRICE_CENTS,
} from "./enrichment-pricing";
import { EVENT_CATEGORY }                    from "./credits";
import { getAllEnrichmentPricing, getStaticInternalCost } from "./pricing";
import { debitWallet }           from "./wallet";
import { formatSupabaseError } from "./errors";
import type { BillingRequestDebug, BillingStageDebugEntry } from "./request-debug";
import { saveRequestDebugEvent } from "./request-debug-store";

// ── Options ───────────────────────────────────────────────────────────────────

export interface TrackEnrichmentUsageOptions {
  tenantId:      string;
  sessionId?:    string | null;
  /**
   * Request route / URL path (e.g. "/" or "/api/enrichment/leadinfo").
   * Written into billing_request_debug_events.route for admin filtering.
   */
  route?:        string;
  /**
   * When true, errors in individual stage tracking are re-thrown instead of
   * being swallowed.  Use in tests only — never in production request paths.
   */
  throwOnError?: boolean;
  /**
   * When true, marks all recorded events as simulated.
   * Set by the test_simulated wallet mode path.
   */
  simulated?:    boolean;
}

// ── Stage output detection ────────────────────────────────────────────────────

function stageProducedOutput(trace: StageTrace): boolean {
  if (!trace.output) return false;
  return Object.values(trace.output).some((v) => v !== null && v !== undefined);
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Record usage events and deduct from wallet for every billable enrichment
 * stage in a pipeline trace.
 *
 * `debitWallet()` → `public.debit_wallet` RPC is the SINGLE debit path.
 * Cache hits, failures, and skipped stages cost 0 and make no debit RPC call.
 *
 * Always fire-and-forget in production:
 *
 *   void trackEnrichmentUsage(client, trace, { tenantId, sessionId });
 */
export async function trackEnrichmentUsage(
  client:  SupabaseClient,
  trace:   StageTrace[],
  options: TrackEnrichmentUsageOptions,
): Promise<BillingRequestDebug> {
  const { tenantId, sessionId, route, throwOnError = false, simulated = false } = options;

  // ── Per-pipeline-run ID ───────────────────────────────────────────────────────
  //
  // Generated ONCE per trackEnrichmentUsage call.  Used as the idempotency key
  // component for all usage_events writes in this run.
  //
  // CRITICAL: Must NOT be scoped to sessionId.  Using sessionId as the idempotency
  // key caused a bug where billing only fired once per browser session — every
  // subsequent pipeline run (after the 30s dev / 4h prod session cache expired)
  // found the existing key and silently returned null, writing no rows.
  //
  // pipelineRunId is unique per call, so:
  //   • Idempotency still prevents double-writes within a single concurrent run.
  //   • New rows are written for every distinct pipeline execution (correct).
  const pipelineRunId = `${tenantId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log("BILLING STEP", {
    stage: "trackEnrichmentUsage:start",
    tenantId,
    sessionId,
    pipelineRunId,
    traceLength: trace.length,
    simulated,
  });

  // ── Debug accumulator ─────────────────────────────────────────────────────────
  //
  // Populated stage-by-stage in the loop below and returned at the end.
  // Fire-and-forget callers (production request path) ignore the return value.
  // Awaiting callers (tests, admin paths) receive the full debug model.
  const debugStages: BillingStageDebugEntry[] = [];
  const debugAnomalies: string[] = [];
  let debugTotalChargedCents = 0;
  let debugTotalCreditsUsed  = 0;
  let debugFirstBalanceBefore: number | null = null;
  let debugLastBalanceAfter:   number | null = null;

  // ── Batch-fetch live enrichment pricing from the enrichment_pricing DB table ───
  //
  // One DB round-trip for ALL enrichment types rather than N calls in the loop.
  // enrichment_pricing.credit_cost is the SOLE authoritative source for debit
  // amounts.  Static values in this file are never used for billing — only as a
  // last-resort 0-credit guard when the DB is unreachable.
  //
  // This ensures admin edits to /admin/platform/billing/pricing take effect
  // immediately — the next pipeline trace after a price change uses the new value.
  const dbPricingRows = await getAllEnrichmentPricing(client);

  // ── Diagnostic: log what the DB returned ──────────────────────────��──────────
  //
  // Emitted once per pipeline run.  If this shows rowCount=0 or a type is missing,
  // check that:
  //   1. enrichment_pricing table is seeded (Admin → Platform → Billing → Pricing →
  //      "Seed defaults" button)
  //   2. Migration 065 has been applied (supabase db push)
  //   3. SUPABASE_SERVICE_ROLE_KEY has SELECT on enrichment_pricing
  console.log("BILLING STEP", {
    stage:        "getAllEnrichmentPricing:result",
    rowCount:     dbPricingRows.length,
    creditCosts:  Object.fromEntries(
      dbPricingRows.map((r) => [r.enrichment_type, r.credit_cost]),
    ),
  });

  /**
   * Map: enrichment_type → unit_price in EUR (e.g. 0.030000 = €0.03).
   * Used only for EUR display / internal-cost tracking.  NEVER used for debits.
   */
  const dbPricingMap = Object.fromEntries(
    dbPricingRows.map((r) => [r.enrichment_type, Number(r.unit_price)]),
  );

  /**
   * Map: enrichment_type → credit_cost (decimal credits, e.g. 0.01).
   *
   * This is the SOLE authoritative debit amount.
   * Set by admins on /admin/platform/billing/pricing and stored in
   * enrichment_pricing.credit_cost (NUMERIC(12,3), migration 065).
   *
   * IMPORTANT: never derive this from unit_price or any EUR-based value.
   * unit_price is in EUR (e.g. 0.030000); multiplying by 100 gives 3 credits —
   * which is the 100× over-charge bug this map was introduced to prevent.
   */
  const dbCreditCostMap = Object.fromEntries(
    dbPricingRows.map((r) => [r.enrichment_type, Number(r.credit_cost)]),
  );

  /**
   * Resolve the live price for an event type in EUR.
   * Used ONLY for unitPriceEur display and internal-cost logging.
   * NEVER used to compute the debit amount.
   */
  const livePriceEur = (eventType: UsageEventType): number => {
    const dbPrice = dbPricingMap[eventType];
    if (typeof dbPrice === "number" && Number.isFinite(dbPrice) && dbPrice >= 0) return dbPrice;
    return (ENRICHMENT_PRICE_CENTS[eventType] ?? 3) / 100;
  };

  /**
   * Resolve the credit cost (decimal) to pass to debit_wallet.
   *
   * Source priority:
   *   1. enrichment_pricing.credit_cost  — DB, admin-editable, authoritative.
   *      e.g. 0.0100 for ip_enrich when set by admin.
   *   2. ENRICHMENT_TYPE_CONFIG.creditsPerCall — static integer fallback
   *      (1 for recognition/adaptation, 2 for brainpower).
   *      Used ONLY when the DB table is empty or the type is missing.
   *      This is safe because it never converts EUR values to credits.
   *
   * ── What we do NOT do ─────────────────────────────────────────────────────
   *
   *   We never fall back to `livePriceEur(eventType) * 100`.
   *   unit_price is in EUR (0.03 EUR) and multiplying by 100 gives "3 credits".
   *   That was the exact over-charge bug: ip_enrich unit_price=0.03 → 3 credits,
   *   when the correct credit_cost is 0.01.
   *
   * ── debit_wallet accepts NUMERIC ──────────────────────────────────────────
   *
   *   The debit_wallet RPC (migration 076) accepts p_credit_cost NUMERIC so
   *   fractional credits (e.g. 0.01, 0.25) are preserved exactly.
   */
  const creditCostFor = (eventType: UsageEventType): number => {
    // Authoritative source: enrichment_pricing.credit_cost from the DB.
    // Admins set this via Admin → Platform → Billing → Pricing.
    const dbCost = dbCreditCostMap[eventType];
    if (typeof dbCost === "number" && Number.isFinite(dbCost) && dbCost > 0) {
      return dbCost;
    }

    // DB has no row (or the row has credit_cost=0, i.e. schema DEFAULT not overridden).
    // Fall back to ENRICHMENT_TYPE_CONFIG.creditsPerCall (static integer: 1 or 2)
    // so enrichments are never silently free when the DB isn't seeded correctly.
    //
    // This fallback is logged as a warning (not error) so operators can see the
    // problem and fix it via Admin → Platform → Billing → Pricing → "Reset to defaults".
    const staticCost = ENRICHMENT_TYPE_CONFIG[eventType]?.creditsPerCall;
    if (typeof staticCost === "number" && staticCost > 0) {
      console.warn(
        `[billing/enrichment-tracker] creditCostFor: DB credit_cost missing or zero` +
        ` for type=${eventType} (enrichment_pricing rows=${dbPricingRows.length},` +
        ` dbCost=${String(dbCost)}).` +
        ` Using static fallback: ${staticCost} credit(s) per call.` +
        ` Fix: go to Admin → Platform → Billing → Pricing and click "Reset to defaults".`,
      );
      return staticCost;
    }

    // Unknown type — no static config either.  Log an error and charge 0.
    console.error(
      `[billing/enrichment-tracker] creditCostFor: unknown enrichment type=${eventType}.` +
      ` No DB row and no static config found. Charging 0 credits.`,
    );
    return 0;
  };

  // ── Summary log: what trackEnrichmentUsage is about to process ───────────────
  //
  // Emitted once per pipeline run so developers can see the full trace upfront
  // without reading every per-stage line.
  {
    const total    = trace.length;
    const skipped  = trace.filter((s) => s.skipped).length;
    const nonbill  = trace.filter((s) => !s.skipped && STAGE_LABEL_TO_EVENT_TYPE[s.label] == null).length;
    const cached   = trace.filter((s) => !s.skipped && s.cacheSource === "provider-cache").length;
    const live     = trace.filter((s) => !s.skipped && s.cacheSource !== "provider-cache" && STAGE_LABEL_TO_EVENT_TYPE[s.label] != null).length;
    console.log(
      `[billing/enrichment-tracker] ── PIPELINE BILLING SUMMARY` +
      ` | tenant=${tenantId} | session=${sessionId ?? "none"}` +
      ` | demo=${simulated}` +
      ` | stages_total=${total}` +
      ` | skipped=${skipped}` +
      ` | non_billable=${nonbill}` +
      ` | provider_cache_hits=${cached} (cost=0)` +
      ` | live_api_calls=${live} (will debit if success)`,
    );
  }

  for (const stage of trace) {
    if (stage.skipped) {
      debugStages.push({
        stageLabel: stage.label, enrichmentType: null, billable: false,
        cacheHit: false, hasOutput: false, hasError: false,
        durationMs: stage.durationMs ?? 0, error: null,
        unitPriceEur: 0, creditCost: 0, centsCharged: 0, result: "skipped",
      });
      continue;
    }

    // ── Event type lookup ────────────────────────────────────────────────────
    const rawEventType = STAGE_LABEL_TO_EVENT_TYPE[stage.label];
    if (rawEventType === null || rawEventType === undefined) {
      console.log(
        `[billing/enrichment-tracker] stage="${stage.label}"` +
        ` | billable=NO (not in STAGE_LABEL_TO_EVENT_TYPE)` +
        ` | action=skip`,
      );
      debugStages.push({
        stageLabel: stage.label, enrichmentType: null, billable: false,
        cacheHit: false, hasOutput: false, hasError: false,
        durationMs: stage.durationMs ?? 0, error: null,
        unitPriceEur: 0, creditCost: 0, centsCharged: 0, result: "skipped",
      });
      continue;
    }

    const eventType = rawEventType as UsageEventType;
    const config    = ENRICHMENT_TYPE_CONFIG[eventType];
    if (!config?.billable) {
      console.log(
        `[billing/enrichment-tracker] stage="${stage.label}"` +
        ` | type=${eventType}` +
        ` | billable=NO (config.billable=false)` +
        ` | action=skip`,
      );
      debugStages.push({
        stageLabel: stage.label, enrichmentType: eventType, billable: false,
        cacheHit: false, hasOutput: false, hasError: false,
        durationMs: stage.durationMs ?? 0, error: null,
        unitPriceEur: 0, creditCost: 0, centsCharged: 0, result: "free",
      });
      continue;
    }

    // ── Credit category + internal cost ───────────────────────────────────────
    //
    // category: the Chameleon Credits category (recognition / adaptation / brainpower)
    //           written to wallet_ledger.category via the debit_wallet RPC
    // internalCostCents: actual provider cost, from static pricing defaults
    const category          = EVENT_CATEGORY[eventType];
    const internalCostCents = getStaticInternalCost(eventType);

    // ── Determine cache / success ─────────────────────────────────────────────
    const cacheHit  = stage.cacheSource === "provider-cache";
    const hasOutput = stageProducedOutput(stage);
    const hasError  = stage.error != null;
    const success   = !hasError && hasOutput;
    const errorCode = hasError ? "stage_error" : (!hasOutput ? "no_match" : undefined);

    // ── Pricing ───────────────────────────────────────────────────────────────
    //
    // Cache hits and failures cost 0 — no debit RPC call is made for them.
    // Successful live API calls cost creditCostFor(eventType) — resolved from
    // enrichment_pricing.credit_cost (DB, admin-editable) with NO static fallback
    // (missing DB row → 0 cost + error log, never silently wrong amount).
    //
    // credit_cost is stored as NUMERIC (e.g. 0.0100) so fractional credits
    // (e.g. 0.01) are preserved exactly — never rounded to integer cents.
    const pricingFound       = typeof dbCreditCostMap[eventType] === "number" && dbCreditCostMap[eventType]! > 0;
    const creditCostToDeduct = cacheHit || !success ? 0 : creditCostFor(eventType);

    // ── Idempotency key ────────────────────────────────────────────────────────
    //
    // Scoped to pipelineRunId (NOT sessionId) so each pipeline execution writes
    // its own rows.  Prevents double-writes if this call is somehow invoked
    // concurrently, but allows a fresh row for every new pipeline run.
    //
    // BUG THAT WAS HERE: using sessionId meant billing only ever fired once per
    // browser session — all subsequent runs silently hit the idempotency guard.
    const idempotencyKey = `${eventType}:${pipelineRunId}:${stage.label}`;

    // ── Task-9 structured per-enrichment diagnostic log ───────────────────────
    //
    // One entry per evaluated billable stage. Captures:
    //   enrichmentType  — event type key (matches enrichment_pricing.enrichment_type)
    //   pricingFound    — TRUE when DB enrichment_pricing row exists for this type
    //   creditCost      — credits to deduct (0.01 for sub-credit pricing)
    //   creditsUsed     — same as creditCost when successful, 0 on cache/failure
    //   debitAmount     — actual value passed to debit_wallet RPC (= creditCost or 0)
    //   walletBefore    — decimal balance before debit (populated after RPC returns)
    //   walletAfter     — decimal balance after debit (populated after RPC returns)
    //   cacheHit        — TRUE when result came from provider cache (no API call)
    //   billable        — TRUE (all stages reaching this branch are billable)
    //
    // walletBefore / walletAfter are back-filled after the debit RPC call below.
    // This placeholder object is updated in-place once the RPC result is known.
    const diagnosticLog = {
      enrichmentType:  eventType,
      pricingFound,
      creditCost:      creditCostFor(eventType),    // DB cost for this type
      quantity:        1,
      creditsUsed:     0,                           // back-filled after debit
      debitAmount:     creditCostToDeduct,          // 0 for cache/failure
      walletBefore:    null as number | null,       // back-filled after debit
      walletAfter:     null as number | null,       // back-filled after debit
      cacheHit,
      billable:        true,
    };

    // ── BILLING STEP log — visible in all envs ────────────────────────────────
    console.log("BILLING STEP", {
      stage:          stage.label,
      tenantId,
      enrichmentType: eventType,
      billable:       true,
      cacheHit,
      success,
      creditCost:     creditCostToDeduct,
      simulated,
      pipelineRunId,
      willDebit:      creditCostToDeduct > 0 && !simulated,
    });

    // ── Wallet debit via debit_wallet RPC (SINGLE debit path) ─────────────────
    //
    // debitWallet() → public.debit_wallet RPC atomically:
    //   1. Decrements tenant_wallets.balance_cents with a row-level lock.
    //   2. Inserts wallet_ledger row (entry_type=enrichment_debit, category, simulated=false).
    //   3. Raises insufficient_wallet_balance on overdraft — caught below.
    //
    // No debit is made for:
    //   • creditCostToDeduct === 0  (cache hits, failures)
    //   • simulated === true   (test_simulated wallet mode)
    //
    let walletDebitSucceeded = true;
    let walletDebitErrorCode: string | undefined;
    let balanceAfter:         number | undefined;

    if (creditCostToDeduct > 0 && !simulated) {
      console.log("BILLING STEP", {
        stage:  "debitWallet:attempt",
        tenantId,
        enrichmentType: eventType,
        credits:        creditCostToDeduct,
        category,
        pipelineRunId,
      });
      try {
        const debitResult = await debitWallet(
          client,
          tenantId,
          creditCostToDeduct,          // decimal credits (e.g. 3.0 or 0.25)
          "enrichment_usage",          // referenceType — identifies the debit source
          stage.label,                 // referenceId   — which stage triggered the debit
          `${eventType} — ${stage.label}`,  // note
          category,                    // p_category → written to wallet_ledger
        );

        balanceAfter = debitResult.balanceAfter;

        if (debitResult.success) {
          // Back-fill diagnostic log with actual wallet before/after values.
          diagnosticLog.walletBefore  = balanceAfter !== undefined ? balanceAfter + creditCostToDeduct : null;
          diagnosticLog.walletAfter   = balanceAfter ?? null;
          diagnosticLog.creditsUsed   = creditCostToDeduct;
          console.log("BILLING STEP", {
            stage:        "debitWallet:success",
            tenantId,
            enrichmentType: eventType,
            credits:        creditCostToDeduct,
            balanceAfter,
            pipelineRunId,
          });
        } else {
          walletDebitSucceeded  = false;
          walletDebitErrorCode  = debitResult.error ?? "debit_failed";
          // wallet_not_found means this tenant has no billing wallet — expected
          // for dev-preview / admin-provisioned tenants that have never had
          // billing configured.  Downgrade to warn so the console stays clean.
          // All other debit failures remain console.error.
          const logDebitFailure = walletDebitErrorCode === "wallet_not_found"
            ? console.warn
            : console.error;
          logDebitFailure(
            `[billing/enrichment-tracker] DEBIT BLOCKED` +
            ` | tenant=${tenantId} | type=${eventType} | stage=${stage.label}` +
            ` | category=${category} | credits=${creditCostToDeduct}` +
            ` | balance_after=${debitResult.balanceAfter ?? "?"}` +
            ` | error=${debitResult.error ?? "none"}` +
            ` | pipelineRunId=${pipelineRunId}`,
          );
        }
      } catch (err) {
        walletDebitSucceeded = false;
        walletDebitErrorCode = "debit_rpc_error";

        // PGRST202 = function not found (migration not applied)
        // 42P01    = table missing
        // 42703    = column missing (e.g. wallet_ledger.category or .simulated
        //            not yet added by migration 051/076)
        // All are schema-gap conditions — warn instead of error so the console
        // is not flooded during a rolling schema migration.
        const errStr = formatSupabaseError(err);
        const isSchemaGap =
          errStr.includes("PGRST202") ||
          errStr.includes("42P01")    ||
          errStr.includes("42703");

        if (isSchemaGap) {
          // Schema gap = migration not applied. Hard error — billing will never
          // work until migrations are pushed.
          console.error(
            `[billing/enrichment-tracker] DEBIT RPC UNAVAILABLE — schema gap` +
            ` | tenant=${tenantId} | type=${eventType} | stage=${stage.label}` +
            ` | ${errStr}` +
            ` | FIX: run "supabase db push" to apply migrations 051/076` +
            ` | pipelineRunId=${pipelineRunId}`,
          );
        } else {
          console.error(
            `[billing/enrichment-tracker] DEBIT ERROR (unexpected)` +
            ` | tenant=${tenantId} | type=${eventType} | stage=${stage.label}` +
            ` | ${errStr}` +
            ` | pipelineRunId=${pipelineRunId}`,
          );
        }

        if (throwOnError) throw err;
      }
    } else if (creditCostToDeduct === 0) {
      console.log("BILLING STEP", {
        stage:          "debitWallet:skipped",
        reason:         cacheHit ? "cache_hit" : (!success ? "no_output" : "cost_zero"),
        tenantId,
        enrichmentType: eventType,
        pipelineRunId,
      });
    } else if (simulated) {
      console.log("BILLING STEP", {
        stage:          "debitWallet:skipped",
        reason:         "simulated_mode",
        tenantId,
        enrichmentType: eventType,
        credits:        creditCostToDeduct,
        pipelineRunId,
      });
    }

    // ── Task-9 diagnostic log emit ────────────────────────────────────────────
    //
    // Emitted once per billable stage with full pricing + wallet context.
    // Read this log to verify acceptance criteria:
    //   A. amount = -0.01 for ip_enrich → creditsUsed = 0.01, debitAmount = 0.01
    //   B. walletAfter = walletBefore - 0.01 (exact decimal)
    //   E. pricingFound = true for all types → enrichment_pricing seeded
    //   F. pricingFound = false + creditCost = 0 → missing row, not silently billed
    console.log("[billing/enrichment-tracker] ENRICHMENT_BILLING_DIAGNOSTIC", {
      ...diagnosticLog,
      stage:        stage.label,
      success,
      simulated,
      pipelineRunId,
      tenantId,
    });

    // ── Per-stage structured billing log ─────────────────────────────────────
    //
    // Emitted for every evaluated billable stage.  Shows exactly why credits
    // were or were not deducted so operators can diagnose billing issues from
    // the server logs without reading DB rows.
    //
    // Key for reading:
    //   cache=YES         → provider-cache hit; cost=0 (correct; no real API call)
    //   success=NO        → provider ran but returned no data; cost=0
    //   debited=YES       → balance decremented; balance_after (decimal) shown
    //   debited=SKIPPED   → simulated mode; DB rows written but balance unchanged
    //   debited=NO        → debit RPC failed (see error); usage_events written at cost=0
    //   debited=N/A       → cost=0 (cache or failure); no debit attempt made
    {
      const why =
        cacheHit    ? "provider_cache_hit"  :
        !success    ? (hasError ? "stage_error" : "no_output") :
        simulated   ? "simulated_mode"      :
        "live_api_call";

      const debitStatus =
        creditCostToDeduct === 0 ? "N/A (cost=0)"   :
        simulated               ? "SKIPPED (demo)"  :
        walletDebitSucceeded    ? `YES (balance_after=${balanceAfter ?? "?"})` :
                                  `NO (${walletDebitErrorCode ?? "error"})`;

      console.log(
        `[billing/enrichment-tracker]` +
        ` stage="${stage.label}"` +
        ` | type=${eventType}` +
        ` | category=${category}` +
        ` | cache=${cacheHit ? "YES" : "NO"}` +
        ` | success=${success ? "YES" : "NO"}` +
        ` | credits=${creditCostToDeduct}` +
        ` | demo=${simulated}` +
        ` | debited=${debitStatus}` +
        ` | why=${why}` +
        (errorCode ? ` | error=${errorCode}` : ""),
      );
    }

    // ── Accumulate per-stage debug entry ─────────────────────────────────────
    {
      const stageResult: BillingStageDebugEntry["result"] =
        cacheHit               ? "cached"    :
        !success               ? "failed"    :
        simulated              ? "simulated" :
        !walletDebitSucceeded  ? "failed"    :
        creditCostToDeduct > 0 ? "charged"   :
        "skipped";

      // actuallyCharged is decimal credits (matches balanceAfter unit).
      const actuallyCharged = stageResult === "charged" ? creditCostToDeduct : 0;

      // Track wallet balance bookends across the request.
      // balanceAfter is decimal credits; bookend fields store the same unit.
      if (typeof balanceAfter === "number") {
        if (debugFirstBalanceBefore === null) {
          debugFirstBalanceBefore = balanceAfter + actuallyCharged;
        }
        debugLastBalanceAfter = balanceAfter;
      }

      debugTotalChargedCents += actuallyCharged;
      debugTotalCreditsUsed  += stageResult === "charged" ? creditCostFor(eventType) : 0;

      if (!walletDebitSucceeded && walletDebitErrorCode) {
        debugAnomalies.push(
          `Wallet debit failed for ${eventType}: ${walletDebitErrorCode}`,
        );
      }

      debugStages.push({
        stageLabel:          stage.label,
        enrichmentType:      eventType,
        billable:            true,
        cacheHit,
        hasOutput,
        hasError,
        durationMs:          stage.durationMs ?? 0,
        error:               stage.error ? String(stage.error) : (walletDebitErrorCode ?? null),
        unitPriceEur:        livePriceEur(eventType),
        creditCost:          creditCostFor(eventType),
        centsCharged:        actuallyCharged,
        result:              stageResult,
        usageEventCreated:   true,
        ledgerEntryCreated:  stageResult === "charged",
        balanceAfterCents:   balanceAfter,
        balanceBeforeCents:  typeof balanceAfter === "number"
          ? balanceAfter + actuallyCharged
          : undefined,
      });
    }

    // ── Record usage_events (single canonical write — wallet billing + activity log) ─
    //
    // usage_events is the sole table written per billable stage.
    // enrichment_usage has been retired — all data lives here (migration 068).
    //
    // creditsCost / creditsUsed = 0 when:
    //   • creditCostToDeduct === 0  (cache hit or failure)
    //   • walletDebitSucceeded === false (debit rejected)
    {
      // chargedCredits: decimal credits actually deducted for this call.
      // Unit: NUMERIC credits (same unit as tenant_wallets.balance and
      // wallet_ledger.amount).  For ip_enrich with credit_cost=0.01 this is 0.01.
      // NOT cents — the variable was renamed from chargedCents to avoid confusion
      // with the legacy _cents integer columns.
      const chargedCredits = walletDebitSucceeded ? creditCostToDeduct : 0;
      const unitCreditCost = creditCostFor(eventType);

      // EUR price: chargedCredits × (€0.01 per credit).
      // 1 credit = €0.01 (canonical unit, billing/wallet.ts).
      // For ip_enrich with credit_cost=0.01: price = 0.01 × 0.01 = €0.0001 per call.
      // This is correct — it matches the actual wallet deduction in EUR terms.
      // livePriceEur(eventType) (= unit_price from DB) is the list price per call,
      // which may differ if admin changed credit_cost independently of unit_price.
      const priceEur = chargedCredits * 0.01;

      console.log("BILLING STEP", {
        stage:          "trackUsageEvent:attempt",
        tenantId,
        enrichmentType: eventType,
        billable:       true,
        cacheHit,
        chargedCredits,
        idempotencyKey,
        pipelineRunId,
      });

      try {
        const written = await trackUsageEvent(client, {
          tenantId,
          eventType,
          creditsCost:        chargedCredits,
          creditsUsed:        chargedCredits,
          price:              priceEur,               // EUR: chargedCredits × €0.01/credit
          billable:           true,
          internalCostCents:  internalCostCents ?? undefined,
          category,
          featureKey:         eventType,              // matches enrichment_pricing.enrichment_type
          success,
          cacheHit,
          errorCode:          walletDebitSucceeded ? errorCode : (walletDebitErrorCode ?? "debit_failed"),
          sessionId:          sessionId ?? undefined,
          idempotencyKey,
          simulated,
          metadata: {
            stageLabel:          stage.label,
            durationMs:          stage.durationMs,
            cacheSource:         stage.cacheSource ?? "unknown",
            category,
            // unitCreditCost: what DB says this type costs per call (decimal credits)
            unitCreditCost,
            // unitPriceEur: listed EUR price per call from enrichment_pricing.unit_price
            unitPriceEur:        livePriceEur(eventType),
            internalCostCents,
            // chargedCredits: actual decimal credits deducted from wallet
            chargedCredits,
            walletDebitSucceeded,
            pipelineRunId,
            // Balance bookends — written here so the admin debug page can show
            // wallet before/after per stage without a separate wallet query.
            // Values are decimal credits (1 credit = €0.01).
            //
            // Field names: new camelCase names + legacy *Cents names both written
            // so buildBillingDebugFromDbRows (request-debug.ts) keeps working for
            // existing DB rows that use the legacy names.
            ...(typeof balanceAfter === "number" ? {
              balanceAfter,                              // new name (decimal-explicit)
              balanceBefore: balanceAfter + chargedCredits, // new name
              balanceAfterCents:  balanceAfter,          // legacy — read by request-debug.ts
              balanceBeforeCents: balanceAfter + chargedCredits, // legacy
            } : {}),
            // Simulated flag forwarded into metadata so buildBillingDebugFromDbRows
            // can reconstruct billing mode accurately from usage_events rows.
            ...(simulated ? { simulated: true } : {}),
            ...(walletDebitErrorCode ? { walletDebitErrorCode } : {}),
            ...(stage.error ? { stageError: stage.error } : {}),
          },
        }, throwOnError);

        if (written) {
          console.log("BILLING STEP", {
            stage:          "trackUsageEvent:written",
            tenantId,
            enrichmentType: eventType,
            usageEventId:    written.id,
            chargedCredits,
            pipelineRunId,
          });
        } else {
          // null = idempotency duplicate OR schema error (both are logged inside trackUsageEvent)
          console.warn(
            `[billing/enrichment-tracker] trackUsageEvent returned null` +
            ` | tenant=${tenantId} | type=${eventType} | stage=${stage.label}` +
            ` | idempotencyKey=${idempotencyKey}` +
            ` | pipelineRunId=${pipelineRunId}` +
            ` | cause: either idempotency duplicate or schema error (check above warn logs)`,
          );
          // Mark the debug entry accordingly — ledger can't be confirmed
          const lastStage = debugStages[debugStages.length - 1];
          if (lastStage) {
            (lastStage as { usageEventCreated?: boolean }).usageEventCreated = false;
          }
        }
      } catch (err) {
        // trackUsageEvent already swallows errors internally; this catch is a last resort.
        // Flat string so Next.js console forwarding never collapses it to {}.
        console.error(
          `[billing/enrichment-tracker] trackUsageEvent UNEXPECTED THROW` +
          ` | table=usage_events | tenant=${tenantId} | type=${eventType} | stage=${stage.label}` +
          ` | pipelineRunId=${pipelineRunId}` +
          ` | ${formatSupabaseError(err)}`,
        );
        if (throwOnError) throw err;
      }
    }
  }

  // ── Build and return request-level debug object ───────────────────────────────
  //
  // Fire-and-forget callers (production request path) ignore this return value.
  // Test callers and admin paths can await and inspect it.
  if (simulated) {
    debugAnomalies.push("Simulated mode — wallet balance was not changed.");
  }
  if (debugTotalChargedCents === 0 && debugStages.some((s) => s.billable && !s.cacheHit && s.hasOutput)) {
    debugAnomalies.push(
      "Billable stages ran successfully but 0 credits were charged — check debit_wallet RPC.",
    );
  }

  const debugResult: BillingRequestDebug = {
    requestId:         pipelineRunId,
    tenantId,
    timestamp:         new Date().toISOString(),
    billingMode:       simulated ? "simulated" : "live",
    demoMode:          simulated,
    walletBeforeCents: debugFirstBalanceBefore,
    walletAfterCents:  debugLastBalanceAfter,
    totalChargedCents: debugTotalChargedCents,
    totalCreditsUsed:  debugTotalCreditsUsed,
    stages:            debugStages,
    anomalies:         debugAnomalies,
    source:            "db",  // this object is built from actual debit results
  };

  console.log("BILLING STEP", {
    stage:              "trackEnrichmentUsage:complete",
    tenantId,
    pipelineRunId,
    totalChargedCents:  debugTotalChargedCents,
    totalCreditsUsed:   debugTotalCreditsUsed,
    stagesProcessed:    debugStages.length,
    anomalies:          debugAnomalies,
  });

  // ── Persist debug snapshot to billing_request_debug_events (fire-and-forget) ──
  //
  // Written after every pipeline run so the admin debug page can show
  // real per-request snapshots without re-grouping usage_events rows.
  // Errors are swallowed — persistence failure must never block enrichment.
  void saveRequestDebugEvent(client, debugResult, { route: route ?? undefined });

  return debugResult;
}

// ── Convenience: build billing client ─────────────────────────────────────────

export function createBillingClient() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}
