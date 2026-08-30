/**
 * Read per-rule fire recency from `rule_fire_daily` (tenant_id, rule_id, day,
 * count) for the config-health "never-fired" check. Server-only; FAILS OPEN
 * (returns {} on any error) so the rules editor never breaks over this.
 *
 * A rule that fired anywhere in the window gets `daysSinceLastFire`; the analyzer
 * flags it when that exceeds the threshold. A rule with NO fire in the window is
 * intentionally absent from the map (so a brand-new rule is not flagged as dead).
 */

import "server-only";
import { getDb } from "@/data/db";
import type { RuleFireStat } from "@/decision/rules/config-health";

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export async function getRuleFireStats(tenantId: string, windowDays = 90): Promise<Record<string, RuleFireStat>> {
  if (!tenantId) return {};
  try {
    const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString().slice(0, 10);
    const db = getDb() as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { gte: (k: string, v: string) => Promise<{ data: Array<{ rule_id: string; day: string; count: number }> | null }> } } };
    };
    const { data } = await db.from("rule_fire_daily").select("rule_id, day, count").eq("tenant_id", tenantId).gte("day", since);
    if (!data || data.length === 0) return {};

    // Latest fire day per rule (rows only exist for days a rule fired, count ≥ 1).
    const latest: Record<string, string> = {};
    for (const row of data) {
      if ((row.count ?? 0) <= 0 || !row.rule_id || !row.day) continue;
      if (!latest[row.rule_id] || row.day > latest[row.rule_id]) latest[row.rule_id] = row.day;
    }

    const todayMs = Math.floor(Date.now() / MS_PER_DAY) * MS_PER_DAY;
    const out: Record<string, RuleFireStat> = {};
    for (const [ruleId, day] of Object.entries(latest)) {
      const dayMs = new Date(`${day}T00:00:00Z`).getTime();
      const days = Math.max(0, Math.floor((todayMs - dayMs) / MS_PER_DAY));
      out[ruleId] = { fired: true, daysSinceLastFire: days };
    }
    return out;
  } catch {
    return {}; // fail open — never-fired check simply stays dormant
  }
}
