/**
 * billing/demo-billing.ts
 *
 * Demo-mode enrichment billing simulation.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The session enrichment cache (4-hour TTL) prevents the enrichment pipeline
 *   from re-running on page reloads — which is correct production behaviour.
 *   But during development and demos this makes billing invisible: credits never
 *   decrease once the session warms up, making it impossible to verify that the
 *   wallet debit chain works end-to-end.
 *
 *   Demo mode fires a lightweight billing simulation on EVERY request, including
 *   cache-hit requests, so the developer or demo operator can watch the balance
 *   decrease in real-time in the billing dashboard.
 *
 * ─── Activation ───────────────────────────────────────────────────────────────
 *
 *   CHAMELEON_DEMO_MODE=true
 *
 *   Optionally pair with SESSION_CACHE_TTL_SECONDS=5 to force the real
 *   enrichment pipeline to re-run frequently — this exercises the full chain
 *   rather than just the simulation layer.
 *
 * ─── What "demo mode" billing does ───────────────────────────────────────────
 *
 *   1. Builds a synthetic StageTrace using known-good billable stage labels.
 *   2. Calls `trackEnrichmentUsage` with `simulated=true`:
 *        • enrichment_usage rows ARE written (visible in the billing dashboard)
 *        • usage_events rows ARE written
 *        • wallet_ledger rows ARE written with entry_type="sim_debit", simulated=true
 *        • tenant_wallets.balance_cents is NOT decremented (simulated, not real)
 *   3. Tracks the running "demo simulated deduction" in memory and logs it so
 *      the developer can see the running total per session.
 *
 *   The dashboard "simulated spend" counter shows demo events separately from
 *   real spend, so there is no confusion about production costs.
 *
 * ─── Important ────────────────────────────────────────────────────────────────
 *
 *   • Does NOT perform real wallet debits — balance_cents is not decremented.
 *   • All DB rows are marked simulated=true so they are distinguishable.
 *   • Fire-and-forget from buildDecisionContext — never blocks the page response.
 *   • Never throws — all errors are caught and returned in the result.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 */

import type { SupabaseClient }          from "@supabase/supabase-js";
import type { StageTrace }              from "@/enrichment/types";
import { trackEnrichmentUsage }         from "@/billing/enrichment-tracker";

// ── Demo mode detection ───────────────────────────────────────────────────────

/**
 * Returns true when `CHAMELEON_DEMO_MODE=true` is set in the environment.
 * Evaluated once per module load — stable at runtime.
 */
export function isDemoMode(): boolean {
  return process.env.CHAMELEON_DEMO_MODE === "true";
}

// ── In-memory simulated spend tracker ────────────────────────────────────────
//
// Tracks the cumulative simulated deduction per session across requests.
// Resets on process restart (cold start) — this is intentional; it's a debug
// counter, not a persistent billing record.

const _sessionSimulatedCents = new Map<string, number>();

function addSimulatedCents(sessionId: string | null, cents: number): number {
  const key  = sessionId ?? "_global";
  const prev = _sessionSimulatedCents.get(key) ?? 0;
  const next = prev + cents;
  _sessionSimulatedCents.set(key, next);
  return next;
}

// ── Synthetic stage definitions ───────────────────────────────────────────────
//
// These use stage labels that exist in STAGE_LABEL_TO_EVENT_TYPE (enrichment-pricing.ts)
// so trackEnrichmentUsage correctly maps them to event types and pricing configs.
// We pick "IPinfo Lite" (recognition, 3¢) and "OpenKvK" (adaptation, 3¢) as a
// representative two-stage enrichment cycle.

interface DemoStageSpec {
  /** Must match a key in STAGE_LABEL_TO_EVENT_TYPE. */
  label:     string;
  /** Human-readable category for log output. */
  category:  string;
  /** Expected cost (informational — trackEnrichmentUsage looks it up from pricing). */
  costCents: number;
}

const DEMO_STAGE_SPECS: readonly DemoStageSpec[] = [
  { label: "IPinfo Lite", category: "recognition", costCents: 3 },
  { label: "OpenKvK",     category: "adaptation",  costCents: 3 },
];

// ── Build synthetic stage trace ───────────────────────────────────────────────

/**
 * Builds a minimal StageTrace array that `trackEnrichmentUsage` will treat as
 * two successful live-API pipeline stages.
 *
 * Key decisions:
 *   - `cacheSource` is omitted (undefined) so `cacheHit = false` → billable
 *   - `output` has a truthy value so `stageProducedOutput()` returns true → success
 *   - `error` is omitted so `hasError = false`
 *   - `skipped` is false so the stage is not skipped
 */
function buildDemoTrace(requestId: string): StageTrace[] {
  return DEMO_STAGE_SPECS.map((spec) => ({
    label:      spec.label,
    skipped:    false,
    // Provide a non-null output so stageProducedOutput() returns true.
    output:     { _demo: true, _requestId: requestId } as unknown as StageTrace["output"],
    // Omit cacheSource so cacheHit resolves to false (billable).
    cacheSource: undefined,
    error:      undefined,
    durationMs: 0,
  }));
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface DemoBillingStageResult {
  label:      string;
  category:   string;
  costCents:  number;
}

export interface DemoBillingResult {
  /** Whether demo billing ran for this request. */
  ran:                        boolean;
  /** Tenant billed. */
  tenantId:                   string;
  /** Session associated with this request. */
  sessionId:                  string | null;
  /** Stages that were simulated. */
  stages:                     DemoBillingStageResult[];
  /** Total cents that would have been deducted if real. */
  totalSimulatedCents:        number;
  /** Cumulative simulated spend for this session (in-memory). */
  sessionSimulatedTotalCents: number;
  /** Whether trackEnrichmentUsage succeeded without errors. */
  success:                    boolean;
  /** Error message if trackEnrichmentUsage threw. */
  error?:                     string;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Run a demo-mode enrichment billing simulation.
 *
 * Writes simulated enrichment_usage and usage_events rows (simulated=true) to
 * make billing visible in the dashboard without performing real wallet debits.
 * The wallet balance is NOT decremented — this is pure simulation for demo
 * and development purposes.
 *
 * Always fire-and-forget from `buildDecisionContext`:
 *
 *   if (isDemoMode() && billingClient && tenantId) {
 *     void runDemoBilling(billingClient, tenantId, sessionId).catch(() => {});
 *   }
 *
 * @param client    Service-role Supabase client.
 * @param tenantId  Tenant to record simulated events against.
 * @param sessionId Current session ID (used as idempotency key suffix).
 */
export async function runDemoBilling(
  client:    SupabaseClient,
  tenantId:  string,
  sessionId: string | null,
): Promise<DemoBillingResult> {
  const requestId = Math.random().toString(36).slice(2, 8);
  const trace     = buildDemoTrace(requestId);

  const result: DemoBillingResult = {
    ran:                        true,
    tenantId,
    sessionId,
    stages:                     DEMO_STAGE_SPECS.map((s) => ({ ...s })),
    totalSimulatedCents:        DEMO_STAGE_SPECS.reduce((s, st) => s + st.costCents, 0),
    sessionSimulatedTotalCents: 0,
    success:                    false,
  };

  try {
    // simulated=true → no wallet debit; enrichment_usage + usage_events are written.
    await trackEnrichmentUsage(client, trace, {
      tenantId,
      sessionId,
      simulated:    true,
      throwOnError: false,
    });
    result.success = true;
  } catch (err) {
    result.success = false;
    result.error   = err instanceof Error ? err.message : String(err);
  }

  // Track cumulative simulated spend for this session.
  result.sessionSimulatedTotalCents = addSimulatedCents(sessionId, result.totalSimulatedCents);

  return result;
}

// ── Debug log helpers ─────────────────────────────────────────────────────────

/**
 * Emit a structured console log line announcing that demo mode is active.
 * Call once at the start of a request when demo mode is detected.
 */
export function logDemoModeActive(
  tenantId: string | null,
  sessionId: string | null,
  context: "pipeline" | "cache-hit",
): void {
  console.log(
    `[demo-billing] 🎭 DEMO MODE active` +
    ` | tenant=${tenantId ?? "unknown"}` +
    ` | session=${sessionId ?? "none"}` +
    ` | context=${context}` +
    ` | real billing: DISABLED | simulated events: ENABLED`,
  );
}

/**
 * Emit a structured console log summarising the demo billing simulation result.
 */
export function logDemoBillingResult(result: DemoBillingResult): void {
  if (!result.ran) return;

  const icon   = result.success ? "✓" : "✗";
  const stages = result.stages.map((s) => `${s.label}(${s.costCents}¢)`).join(", ");

  console.log(
    `[demo-billing] ${icon} Simulated billing` +
    ` | tenant=${result.tenantId}` +
    ` | session=${result.sessionId ?? "none"}` +
    ` | stages=[${stages}]` +
    ` | simulated=${result.totalSimulatedCents}¢` +
    ` | session_total=${result.sessionSimulatedTotalCents}¢ (simulated, NOT debited)` +
    (result.error ? ` | error=${result.error}` : ""),
  );
}

/**
 * Emit a structured log for a session-cache-hit request in real mode
 * (demo mode off).  Shows that billing was skipped due to the cache.
 */
export function logCacheHitBillingSkipped(
  tenantId: string | null,
  sessionId: string | null,
): void {
  console.log(
    `[decision-billing] ℹ cache-hit — billing skipped` +
    ` | tenant=${tenantId ?? "unknown"}` +
    ` | session=${sessionId ?? "none"}` +
    ` | reason=session_enrichment_cache_hit` +
    ` | action=no_debit (expected — enrichment already billed on first request)`,
  );
}

/**
 * Emit a structured log for a pipeline-fresh request.
 * Shows what was actually billed this request.
 *
 * Note on billableCount: this is the count of non-skipped stages that are NOT
 * provider-cache hits.  It does NOT mean all of them will be charged — stages
 * that produce no output or return an error will still cost 0.  The per-stage
 * lines from billing/enrichment-tracker.ts show the exact outcome for each.
 */
export function logPipelineBillingFired(opts: {
  tenantId:          string | null;
  sessionId:         string | null;
  billableCount:     number;
  skippedCount:      number;
  walletGuarded:     boolean;
  guardReason?:      string;
  /** How many stages returned provider-cache hits (cost=0, no real API call). */
  providerCacheHits?: number;
}): void {
  const {
    tenantId, sessionId, billableCount, skippedCount, walletGuarded, guardReason, providerCacheHits = 0,
  } = opts;

  if (walletGuarded) {
    console.log(
      `[decision-billing] ⛔ Wallet guard blocked enrichment` +
      ` | tenant=${tenantId ?? "unknown"}` +
      ` | session=${sessionId ?? "none"}` +
      ` | reason=${guardReason ?? "unknown"}` +
      ` | billable_stages_blocked=${billableCount}`,
    );
    return;
  }

  // Note: provider_cache_hits are stages where the provider's in-process cache
  // returned a result — no real external API call was made, so cost = 0.
  // This is correct behaviour.  To force a real call (for testing billing):
  //   restart the dev server (clears in-process cache) and use a new session.
  console.log(
    `[decision-billing] ✓ Pipeline ran — billing fired` +
    ` | tenant=${tenantId ?? "unknown"}` +
    ` | session=${sessionId ?? "none"}` +
    ` | live_api_stages=${billableCount}` +
    ` | provider_cache_hits=${providerCacheHits} (cost=0 — no real API call)` +
    ` | skipped=${skippedCount}` +
    (billableCount > 0
      ? " | wallet debit: PENDING (fire-and-forget; see enrichment-tracker logs)"
      : " | wallet debit: NONE (all stages were cache hits or produced no output)"),
  );
}
