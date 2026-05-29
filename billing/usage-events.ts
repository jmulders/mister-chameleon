/**
 * billing/usage-events.ts
 *
 * Usage event recording and aggregation — server-side DB operations.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended for writes).
 *   Do NOT import in client components.
 *
 *   Safe to import in:  Server Components, API Routes, Server Actions,
 *                       webhook handlers.
 *   Do NOT import in:   "use client" components.
 *
 * ─── Relationship to credit_transactions ─────────────────────────────────────
 *
 *   credit_transactions = financial ledger (balance changes).
 *   usage_events        = activity log (what enrichment happened and why).
 *
 *   When an enrichment call deducts credits:
 *     1. deductCredits()   → appends to credit_transactions (balance change)
 *     2. trackUsageEvent() → appends to usage_events (activity record)
 *
 *   Both calls should happen together at the enrichment call site.
 *   trackUsageEvent() is safe to call even when credits_cost=0 (free calls).
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   Pass idempotencyKey (format: `{eventType}:{tenantId}:{sessionId}`) to
 *   prevent double-recording on retried requests.  If the key already exists
 *   in usage_events, the insert is silently skipped.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { trackUsageEvent, getUsageEventSummary } from "@/billing/usage-events";
 *
 *   // In an enrichment API route:
 *   await trackUsageEvent(client, {
 *     tenantId:        tenant.id,
 *     eventType:       "leadinfo_lookup",
 *     creditsCost:     1,
 *     success:         data.matched,
 *     sessionId:       sessionId,
 *     idempotencyKey:  `leadinfo_lookup:${tenant.id}:${sessionId}`,
 *     metadata: {
 *       companyName:    data.companyName,
 *       companyDomain:  data.companyDomain,
 *       companyCountry: data.companyCountry,
 *       matched:        data.matched,
 *     },
 *   });
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UsageEventType,
  UsageEventInput,
  UsageEvent,
  UsageEventSummary,
  UsageEventBreakdownItem,
} from "./types";
import { isSchemaMissingCode } from "./usage";

// Migration 051 (category, feature_key, internal_cost_cents, simulated) and
// migration 068 (credits_used, price, billable) are now applied — all columns
// are included in the INSERT payload below.

// Re-export types for consumers that import from here
export type { UsageEventType, UsageEventInput, UsageEvent, UsageEventSummary, UsageEventBreakdownItem };

// ── Write: track a usage event ────────────────────────────────────────────────

/**
 * Record a single usage event in the usage_events table.
 *
 * This function is fire-and-forget friendly — errors are swallowed by default
 * so that a DB hiccup does not break the enrichment response to the visitor.
 * Set `throwOnError: true` in tests to detect issues.
 *
 * @param client        Service-role Supabase client (recommended for writes).
 * @param input         Usage event details.
 * @param throwOnError  If true, throws on DB error instead of swallowing.
 * @returns             The inserted row, or null on error / duplicate key.
 */
export async function trackUsageEvent(
  client:       SupabaseClient,
  input:        UsageEventInput,
  throwOnError  = false,
): Promise<UsageEvent | null> {
  const {
    tenantId,
    eventType,
    quantity           = 1,
    creditsCost,
    creditsUsed,
    price,
    billable           = true,
    success,
    cacheHit           = false,
    errorCode,
    sessionId,
    idempotencyKey,
    metadata           = {},
    // ── Migration 051 columns — now included in the INSERT payload ────────────
    category,
    featureKey,
    internalCostCents,
    simulated          = false,
  } = input;

  // Derive decimal billing fields. 1 credit = €0.01 in Chameleon Credits model.
  // credits_used (NUMERIC) supports sub-cent precision.
  // price stores the EUR equivalent.
  const resolvedCreditsUsed = creditsUsed ?? creditsCost;
  const resolvedPrice       = price       ?? creditsCost / 100;

  // Idempotency: skip if this key was already recorded.
  if (idempotencyKey) {
    const { data: existing, error: idempotencyError } = await client
      .from("usage_events")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (idempotencyError) {
      // Column might not exist yet (42703) or table missing (42P01).
      // Log clearly — this is a schema issue that must be fixed.
      console.error(
        `[billing/usage-events] idempotency check FAILED` +
        ` | tenant=${tenantId} | type=${eventType}` +
        ` | code=${idempotencyError.code} | msg=${idempotencyError.message}` +
        ` | FIX: ensure usage_events has idempotency_key column (migration 068+)`,
      );
      // Fall through — attempt the insert anyway; if it fails the error below will catch it.
    }

    if (existing) {
      // Idempotency hit — this exact pipeline run already wrote this event.
      // Log at debug level in dev so it's visible but not alarming.
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[billing/usage-events] IDEMPOTENCY HIT — skipping duplicate write` +
          ` | tenant=${tenantId} | type=${eventType} | key=${idempotencyKey}`,
        );
      }
      return null;
    }
  }

  // ── INSERT payload ────────────────────────────────────────────────────────────
  //
  // Includes all columns from migrations 051, 065, and 068.  All are nullable
  // or have DB defaults so the insert is safe even if an older DB instance is
  // missing one of them — isSchemaMissingCode catches PGRST204 / 42703 and
  // logs a warning instead of throwing.
  //
  // credits_cost (INT, DEFAULT 0) is intentionally omitted — superseded by
  // credits_used (NUMERIC, migration 068) for sub-credit precision.
  const payload = {
    tenant_id:            tenantId,
    event_type:           eventType,
    quantity,
    credits_used:         resolvedCreditsUsed,
    price:                resolvedPrice,
    billable,
    // ── Migration 051 columns ────────────────────────────────────────────────
    category:             category             ?? null,
    feature_key:          featureKey           ?? null,
    internal_cost_cents:  internalCostCents    ?? null,
    simulated,
    // ── Base columns ────────────────────────────────────────────────────────
    success,
    cache_hit:            cacheHit,
    error_code:           errorCode            ?? null,
    session_id:           sessionId            ?? null,
    idempotency_key:      idempotencyKey       ?? null,
    metadata,
  };

  const { data, error } = await client
    .from("usage_events")
    .insert(payload)
    .select()
    .single();

  if (error) {
    // Duplicate idempotency key (race condition) — event already recorded.
    if (error.code === "23505") return null;

    // Column / table missing — migration pending.
    // This is a hard blocker: no usage_events will be written until the schema is fixed.
    if (isSchemaMissingCode(error.code)) {
      console.error(
        `[billing/usage-events] SCHEMA MISMATCH — usage_events INSERT failed` +
        ` | table=usage_events | tenant=${tenantId} | type=${eventType}` +
        ` | code=${error.code} | msg=${error.message}` +
        ` | payload_keys=${Object.keys(payload).join(",")}` +
        ` | FIX: run "supabase db push" to apply all pending migrations`,
      );
      return null;
    }

    if (throwOnError) throw error;

    // Swallow in production — usage tracking failure must not break enrichment.
    // Flat string so Next.js console forwarding never collapses it to {}.
    console.error(
      `[billing/usage-events] trackUsageEvent: DB error` +
      ` | table=usage_events | tenant=${tenantId} | type=${eventType}` +
      ` | payload_keys=${Object.keys(payload).join(",")}` +
      ` | code=${error.code} | msg=${error.message}`,
    );
    return null;
  }

  return data as UsageEvent;
}

// ── Read: single-tenant history ────────────────────────────────────────────────

/**
 * Fetch usage events for a tenant, most recent first.
 *
 * @param client     Supabase client.
 * @param tenantId   Tenant to query.
 * @param limit      Max rows to return (default 100).
 * @param eventType  Filter to a specific event type (optional).
 */
export async function getUsageEvents(
  client:     SupabaseClient,
  tenantId:   string,
  limit       = 100,
  eventType?: UsageEventType,
): Promise<UsageEvent[]> {
  let query = client
    .from("usage_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;
  if (error) {
    if (isSchemaMissingCode(error.code)) {
      console.warn("[billing/usage-events] getUsageEvents: usage_events schema missing or type mismatch", {
        code: error.code, tenantId,
      });
      return [];
    }
    throw new Error(
      `[billing/usage-events] getUsageEvents failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }
  return (data ?? []) as UsageEvent[];
}

// ── Read: usage summary for a billing period ──────────────────────────────────

/**
 * Aggregate usage events for a tenant within a billing period.
 *
 * Returns a summary with total calls, total credits, and per-event-type
 * breakdown.  This is the data source for the admin billing dashboard's
 * usage section and for the billing calculator's overage computation.
 *
 * @param client       Supabase client.
 * @param tenantId     Tenant to aggregate.
 * @param periodStart  ISO 8601 start of the billing period (inclusive).
 * @param periodEnd    ISO 8601 end of the billing period (exclusive).
 */
export async function getUsageEventSummary(
  client:      SupabaseClient,
  tenantId:    string,
  periodStart: string,
  periodEnd:   string,
): Promise<UsageEventSummary> {
  const { data, error } = await client
    .from("usage_events")
    .select("event_type, quantity, credits_cost, success, cache_hit")
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart)
    .lt("created_at", periodEnd);

  if (error) {
    // Table missing, column missing, or type mismatch — return safe empty summary.
    // 42P01 = table missing, 42703 = column missing (e.g. cache_hit),
    // 22P02 = UUID-vs-TEXT type mismatch on tenant_id.
    if (isSchemaMissingCode(error.code)) {
      console.warn(
        "[billing/usage-events] getUsageEventSummary: usage_events schema missing or type mismatch — returning empty summary",
        { code: error.code, message: error.message, tenantId, periodStart, periodEnd },
      );
      return {
        tenantId,
        periodStart,
        periodEnd,
        totalCalls:     0,
        totalCredits:   0,
        successCalls:   0,
        failureCalls:   0,
        cacheHitCalls:  0,
        freshCallCount: 0,
        breakdown:      [],
      };
    }
    throw new Error(
      `[billing/usage-events] getUsageEventSummary failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  const rows = (data ?? []) as {
    event_type:   UsageEventType;
    quantity:     number;
    credits_cost: number;
    success:      boolean;
    cache_hit:    boolean;
  }[];

  // Build per-type breakdown
  const byType = new Map<UsageEventType, UsageEventBreakdownItem>();

  let totalCalls    = 0;
  let totalCredits  = 0;
  let successCalls  = 0;
  let failureCalls  = 0;
  let cacheHitCalls = 0;
  let freshCallCount = 0;

  for (const row of rows) {
    totalCalls   += row.quantity;
    totalCredits += row.credits_cost;

    if (row.success)   successCalls  += row.quantity;
    else               failureCalls  += row.quantity;

    if (row.cache_hit) cacheHitCalls  += row.quantity;
    else               freshCallCount += row.quantity;

    const existing = byType.get(row.event_type);
    if (existing) {
      existing.callCount    += row.quantity;
      existing.totalCredits += row.credits_cost;
      if (row.success)   existing.successCount  += row.quantity;
      else               existing.failureCount  += row.quantity;
      if (row.cache_hit) existing.cacheHitCount += row.quantity;
      else               existing.freshCallCount += row.quantity;
    } else {
      byType.set(row.event_type, {
        eventType:     row.event_type,
        callCount:     row.quantity,
        successCount:  row.success   ? row.quantity : 0,
        failureCount:  row.success   ? 0 : row.quantity,
        cacheHitCount: row.cache_hit ? row.quantity : 0,
        freshCallCount: row.cache_hit ? 0 : row.quantity,
        totalCredits:  row.credits_cost,
      });
    }
  }

  // Sort breakdown by credit consumption descending; ties broken by fresh call count
  const breakdown = [...byType.values()].sort(
    (a, b) => b.totalCredits - a.totalCredits || b.freshCallCount - a.freshCallCount,
  );

  return {
    tenantId,
    periodStart,
    periodEnd,
    totalCalls,
    totalCredits,
    successCalls,
    failureCalls,
    cacheHitCalls,
    freshCallCount,
    breakdown,
  };
}

// ── Validation helpers ─────────────────────────────────────────────────────────

/**
 * Build a stable idempotency key for a usage event.
 *
 * Format: `{eventType}:{tenantId}:{sessionId}`
 *
 * Using the session ID as the third component means a tenant is charged once
 * per enrichment type per visitor session — which matches the cookie caching
 * strategy (e.g. Leadinfo results are cached for 7 days, so the same visitor
 * is not charged again on the next pageview).
 *
 * If sessionId is absent (e.g. server-side batch enrichment), callers should
 * provide a request-level nonce to prevent double-counting on retry.
 */
export function buildIdempotencyKey(
  eventType: UsageEventType,
  tenantId:  string,
  sessionId: string,
): string {
  return `${eventType}:${tenantId}:${sessionId}`;
}

/**
 * Validate that the required usage event fields are present and in range.
 * Throws a descriptive Error if validation fails.
 * Use in tests and CI to catch mis-wired call sites early.
 */
export function validateUsageEventInput(input: UsageEventInput): void {
  if (!input.tenantId) {
    throw new Error("[billing/usage-events] validateUsageEventInput: tenantId is required");
  }
  if (!input.eventType) {
    throw new Error("[billing/usage-events] validateUsageEventInput: eventType is required");
  }
  if (typeof input.creditsCost !== "number" || input.creditsCost < 0) {
    throw new Error(
      `[billing/usage-events] validateUsageEventInput: creditsCost must be a non-negative number (got ${input.creditsCost})`,
    );
  }
  if ((input.quantity ?? 1) < 1) {
    throw new Error(
      `[billing/usage-events] validateUsageEventInput: quantity must be ≥ 1 (got ${input.quantity})`,
    );
  }
}
