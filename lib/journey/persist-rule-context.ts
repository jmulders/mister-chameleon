/**
 * Persist Rule Context
 *
 * Merge-writes sticky rule-context values into
 * visitor_behavior_state.rule_context for a (tenant, session).
 *
 * ─── Why a separate write path? ───────────────────────────────────────────────
 *
 *   updateBehaviorState() rebuilds the whole row from raw events via
 *   deriveBehaviorState(), which knows nothing about rule_context. Writing
 *   rule_context through that path would clobber sticky writes on every rebuild.
 *   So the sticky-persist is an isolated merge-write that touches only the
 *   rule_context column (read → merge → update), leaving the derive-owned
 *   columns untouched.
 *
 * ─── Call pattern ─────────────────────────────────────────────────────────────
 *
 *   Always fire-and-forget, AFTER the HTTP response is sent — never on the hot
 *   request path:
 *
 *     persistRuleContext(sessionId, tenantId, writes).catch(() => void 0);
 *
 * ─── Failure handling ─────────────────────────────────────────────────────────
 *
 *   Never throws. All errors are logged at debug/warn level and the function
 *   returns silently — a lost sticky write is not critical; the next matching
 *   request re-applies it.
 */

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { RuleContextValues } from "./types";

// New journey tables are not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

/**
 * A single sticky context write to persist. Structurally compatible with the
 * engine's RuleContextWrite (decision/rules/stored-rule) — kept as a local type
 * so this journey-layer module does not depend on the decision layer.
 */
export interface StickyContextWrite {
  key:       string;
  value:     string | number | boolean;
  /**
   * Write-once: when true, an existing value for `key` is never overwritten
   * (neither the persisted value nor an earlier write in the same batch).
   */
  monotone?: boolean;
}

/**
 * Merge sticky `writes` onto an existing rule_context map, honouring per-key
 * monotone (write-once) semantics. Pure — no I/O; exported for direct testing
 * and reused by persistRuleContext.
 *
 *   - non-monotone write → last-write-wins.
 *   - monotone write     → kept only when the key is absent; an existing value
 *                          (persisted or set by an earlier write in the batch)
 *                          is preserved.
 */
export function mergeStickyWrites(
  existing: RuleContextValues | null | undefined,
  writes:   readonly StickyContextWrite[],
): RuleContextValues {
  const merged: RuleContextValues = { ...(existing ?? {}) };
  for (const w of writes) {
    const exists = Object.prototype.hasOwnProperty.call(merged, w.key);
    if (w.monotone && exists) continue; // write-once — keep the existing value
    merged[w.key] = w.value;
  }
  return merged;
}

type StateRow = {
  id:           string;
  visitor_id:   string | null;
  rule_context: RuleContextValues | null;
};

type DbResultMany<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Merges sticky `writes` into the persisted rule_context for (tenant, session).
 *
 * Per-key semantics:
 *   - non-monotone write → last-write-wins (overwrites any existing value).
 *   - monotone write     → write-once (kept only when the key is absent; an
 *                          existing persisted value is preserved). This is what
 *                          keeps a latch flag like `gericht_binnengekomen` set
 *                          even when a later view re-writes it.
 *
 * Keys not present in `writes` are always preserved. An empty batch is a no-op.
 *
 * When no state row exists yet (first view before updateBehaviorState() has run),
 * a minimal row is inserted carrying only the rule_context; the derive-owned
 * columns fall back to their DB defaults and are filled in on the next rebuild.
 *
 * @param sessionId  The visitor's mc_session_id UUID.
 * @param tenantId   Active tenant slug.
 * @param writes     Sticky writes to merge (each key/value/monotone?).
 */
export async function persistRuleContext(
  sessionId: string,
  tenantId:  string,
  writes:    readonly StickyContextWrite[],
): Promise<void> {
  // Skip for unresolved tenants and empty writes.
  if (!tenantId || tenantId === "unknown") return;
  if (!sessionId) return;
  if (!writes || writes.length === 0) return;

  try {
    const db = dbAny();

    // ── Read the freshest existing row (id + current rule_context) ──────────
    // limit(1) + updated_at DESC mirrors fetchJourneyState(): resilient to
    // duplicate rows on DBs where the UNIQUE (tenant_id, session_id) constraint
    // has not yet been applied.
    const existing = (await db
      .from("visitor_behavior_state")
      .select("id, visitor_id, rule_context")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .order("updated_at", { ascending: false })
      .limit(1)) as DbResultMany<StateRow>;

    if (existing.error) {
      logger.debug("[persist-rule-context] read failed", {
        sessionId, tenantId, error: existing.error.message,
      });
      return;
    }

    const row    = existing.data?.[0] ?? null;

    // Merge honouring per-key monotone (write-once) semantics.
    const merged = mergeStickyWrites(row?.rule_context, writes);

    // Nothing new to write (e.g. all writes were monotone no-ops) — skip the DB.
    const changed = Object.keys(merged).length !== Object.keys(row?.rule_context ?? {}).length
      || writes.some((w) => !w.monotone);
    if (row && !changed) return;

    const nowIso = new Date().toISOString();

    if (row) {
      // ── Update only the rule_context column on the freshest row ───────────
      const upd = await db
        .from("visitor_behavior_state")
        .update({ rule_context: merged, updated_at: nowIso })
        .eq("id", row.id);

      const updErr = (upd as { error?: { message: string } | null }).error;
      if (updErr) {
        logger.warn("[persist-rule-context] update failed", {
          sessionId, tenantId, error: updErr.message,
        });
        return;
      }
    } else {
      // ── No row yet — insert a minimal one carrying just the context ───────
      // visitor_id is NOT NULL in the live DB (schema drift); supply the
      // session_id as a surrogate, matching updateBehaviorState().
      const ins = await db
        .from("visitor_behavior_state")
        .insert({
          tenant_id:    tenantId,
          session_id:   sessionId,
          visitor_id:   sessionId,
          rule_context: merged,
          updated_at:   nowIso,
        });

      const insErr = (ins as { error?: { message: string } | null }).error;
      if (insErr) {
        // A concurrent updateBehaviorState() may have created the row between
        // our read and insert — not critical, the next request re-applies.
        logger.debug("[persist-rule-context] insert failed", {
          sessionId, tenantId, error: insErr.message,
        });
        return;
      }
    }

    logger.debug("[persist-rule-context] rule_context persisted", {
      sessionId, tenantId, keys: writes.map((w) => w.key),
    });
  } catch (err) {
    logger.warn("[persist-rule-context] unexpected error", {
      sessionId,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
