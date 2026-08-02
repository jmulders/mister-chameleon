/**
 * Rule Fire Store — "do the rules actually fire?" (daily aggregation)
 *
 * The complement to the score-distribution panel: distribution tells you the
 * input discriminates; this tells you each rule actually fires (or never does).
 *
 * Storage is a per-rule, per-day counter (rule_fire_daily), NOT an append log.
 * An append log would be a hot-path write producing tens of millions of rows a
 * month at scale; a daily counter answers the same diagnostic question for at
 * most (#rules × #days) rows. The increment is a single atomic upsert via the
 * increment_rule_fire() SQL function, so concurrent fires can't lose counts.
 *
 * recordRuleFire is fire-and-forget: never awaited on the hot path, never throws,
 * and a missing table/function (pre-migration) is a silent no-op.
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

export interface RuleFireCount {
  ruleId:      string;
  count:       number;
  /** Last day (YYYY-MM-DD) this rule fired within the window, or null. */
  lastFiredAt: string | null;
}

export interface RuleFireStats {
  windowDays:  number;
  total:       number;
  generatedAt: string;
  byRule:      RuleFireCount[];
}

/**
 * Add one to today's counter for (tenant, rule). Fire-and-forget; never awaited
 * on the hot path and never throws. Silent no-op if the function/table is absent
 * (pre-migration).
 */
export async function recordRuleFire(tenantId: string, ruleId: string): Promise<void> {
  if (!tenantId || !ruleId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any).rpc("increment_rule_fire", {
      p_tenant_id: tenantId,
      p_rule_id:   ruleId,
    });
    if (error) {
      logger.debug("[observability] increment_rule_fire failed (pre-migration?)", { error: error.message });
    }
  } catch (err) {
    logger.debug("[observability] recordRuleFire failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function daysAgoISODate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Aggregate rule fires for a tenant over the last `windowDays` from the daily
 * counters. Never throws; empty on failure or pre-migration.
 */
export async function getRuleFireStats(tenantId: string, windowDays = 30): Promise<RuleFireStats> {
  const generatedAt = new Date().toISOString();
  const empty: RuleFireStats = { windowDays, total: 0, generatedAt, byRule: [] };
  if (!tenantId) return empty;

  try {
    const cutoff = daysAgoISODate(windowDays);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getDb() as any)
      .from("rule_fire_daily")
      .select("rule_id, day, count")
      .eq("tenant_id", tenantId)
      .gte("day", cutoff);

    if (error || !data) return empty;

    const rows = data as { rule_id: string; day: string; count: number }[];
    const map = new Map<string, { count: number; last: string }>();
    let total = 0;
    for (const r of rows) {
      const c = Number(r.count) || 0;
      total += c;
      const cur = map.get(r.rule_id);
      if (cur) {
        cur.count += c;
        if (r.day > cur.last) cur.last = r.day;
      } else {
        map.set(r.rule_id, { count: c, last: r.day });
      }
    }

    const byRule: RuleFireCount[] = [...map.entries()]
      .map(([ruleId, v]) => ({ ruleId, count: v.count, lastFiredAt: v.last }))
      .sort((a, b) => b.count - a.count);

    return { windowDays, total, generatedAt, byRule };
  } catch (err) {
    logger.debug("[observability] getRuleFireStats failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}

/** Delete daily counters older than `days`. Fail-open. Returns rows removed. */
export async function purgeOldRuleFireDays(days = 90): Promise<number> {
  try {
    const cutoff = daysAgoISODate(days);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getDb() as any)
      .from("rule_fire_daily")
      .delete()
      .lt("day", cutoff)
      .select("tenant_id");
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch {
    return 0;
  }
}
