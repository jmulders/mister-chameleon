/**
 * RuleFireStatsPanel
 *
 * "Do the rules actually fire?" — the complement to the score distribution.
 * Lists every configured rule with how often it fired in the window, INCLUDING
 * rules that never fired (count 0), because a dead rule looks fine in the list
 * but does nothing. A rule stays dead when its threshold is unreachable or a
 * higher-priority rule always wins first.
 *
 * Pure server component. Fires are recorded to rule_fire_events (migration 162);
 * until that migration is applied, counts are simply zero.
 */

import type { RuleFireStats } from "@/lib/observability/rule-fire-store";

interface RuleRef {
  id:    string;
  label: string;
}

interface RuleFireStatsPanelProps {
  rules: RuleRef[];
  stats: RuleFireStats;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("nl-NL");
  } catch {
    return iso;
  }
}

export function RuleFireStatsPanel({ rules, stats }: RuleFireStatsPanelProps) {
  const countById = new Map(stats.byRule.map((r) => [r.ruleId, r]));

  // Join config rules with their fire counts; unfired rules surface as count 0.
  const rows = rules
    .map((rule) => {
      const hit = countById.get(rule.id);
      return {
        id:    rule.id,
        label: rule.label,
        count: hit?.count ?? 0,
        last:  hit?.lastFiredAt ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);

  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0);
  const neverFired = rows.filter((r) => r.count === 0).length;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Regel-vuringen (laatste {stats.windowDays} dagen)
        </h2>
        <span className="text-xs text-neutral-500">
          {stats.total.toLocaleString("nl-NL")} vuringen{stats.truncated ? "+" : ""}
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Of de regels iets doen — de tegenhanger van de scoreverdeling. Een regel
        die nooit vuurt ziet er prima uit in de lijst, maar is dood.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          Nog geen regels om te tonen.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {rows.map((r) => {
              const width = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
              const dead = r.count === 0;
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="w-52 shrink-0 truncate text-xs text-neutral-700" title={r.label}>
                    {r.label}
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                    <div
                      className={`h-full rounded ${dead ? "bg-transparent" : "bg-brand-500/70"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className={`w-28 shrink-0 text-[11px] tabular-nums ${dead ? "text-amber-700" : "text-neutral-500"}`}>
                    {dead ? "nooit gevuurd" : `${r.count.toLocaleString("nl-NL")} · ${fmt(r.last).split(" ")[0]}`}
                  </span>
                </div>
              );
            })}
          </div>

          {neverFired > 0 && (
            <p className="mt-3 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              {neverFired} regel{neverFired === 1 ? "" : "s"} vuurde niet in dit venster — controleer drempel of prioriteit.
            </p>
          )}
        </>
      )}
    </div>
  );
}
