/**
 * Rule Fire Store — "do the rules actually do anything?"
 *
 * The complement to the score-distribution panel. Distribution tells you the
 * input discriminates; this tells you each rule actually fires (or never does).
 * A rule that never fires — because its threshold is unreachable, or a higher-
 * priority rule always wins first — looks fine in the list but is dead.
 *
 * Append-only: one row per rule match on the decide path, aggregated by count.
 * Writes are fire-and-forget (recordRuleFire) so they add no latency and, if the
 * table doesn't exist yet (pre-migration), fail silently — never breaking decide.
 *
 * Table: public.rule_fire_events (migration 162). Aggregation fetches the window
 * and counts in-process (capped), which is fine for a diagnostic.
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

/** Cap on rows scanned when aggregating (diagnostic, not exact accounting). */
export const RULE_FIRE_SCAN_CAP = 100_000;

export interface RuleFireCount {
  ruleId:      string;
  count:       number;
  lastFiredAt: string | null;
}

export interface RuleFireStats {
  windowDays:  number;
  total:       number;
  generatedAt: string;
  byRule:      RuleFireCount[];
  /** True when the scan hit the cap (counts are a lower bound). */
  truncated:   boolean;
}

/**
 * Record one rule fire. Fire-and-forget; never awaited on the hot path and
 * never throws. Silent no-op if the table is absent (pre-migration).
 */
export async function recordRuleFire(tenantId: string, ruleId: string): Promise<void> {
  if (!tenantId || !ruleId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getDb() as any)
      .from("rule_fire_events")
      .insert({ tenant_id: tenantId, rule_id: ruleId });
  } catch (err) {
    logger.debug("[observability] recordRuleFire failed (table may be pre-migration)", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Aggregate rule fires for a tenant over the last `windowDays`. Returns a
 * per-rule count + last-fired timestamp. Never throws; empty on failure or
 * pre-migration.
 */
export async function getRuleFireStats(tenantId: string, windowDays = 30): Promise<RuleFireStats> {
  const generatedAt = new Date().toISOString();
  const empty: RuleFireStats = { windowDays, total: 0, generatedAt, byRule: [], truncated: false };
  if (!tenantId) return empty;

  try {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getDb() as any)
      .from("rule_fire_events")
      .select("rule_id, occurred_at")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", cutoff)
      .order("occurred_at", { ascending: false })
      .limit(RULE_FIRE_SCAN_CAP);

    if (error || !data) return empty;

    const rows = data as { rule_id: string; occurred_at: string }[];
    const map = new Map<string, { count: number; last: string }>();
    for (const r of rows) {
      const cur = map.get(r.rule_id);
      if (cur) cur.count += 1;
      else map.set(r.rule_id, { count: 1, last: r.occurred_at }); // rows are newest-first, so first seen = last fired
    }

    const byRule: RuleFireCount[] = [...map.entries()]
      .map(([ruleId, v]) => ({ ruleId, count: v.count, lastFiredAt: v.last }))
      .sort((a, b) => b.count - a.count);

    return {
      windowDays,
      total:       rows.length,
      generatedAt,
      byRule,
      truncated:   rows.length >= RULE_FIRE_SCAN_CAP,
    };
  } catch (err) {
    logger.debug("[observability] getRuleFireStats failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}

/** Delete rule-fire rows older than `days`. Fail-open. Returns rows removed. */
export async function purgeOldRuleFireEvents(days = 90): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getDb() as any)
      .from("rule_fire_events")
      .delete()
      .lt("occurred_at", cutoff)
      .select("id");
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch {
    return 0;
  }
}
