import type { AbmDashboardRow } from "../actions";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scoreClass(score: number): string {
  if (score >= 60) return "bg-red-50 text-red-700";
  if (score >= 35) return "bg-amber-50 text-amber-700";
  return "bg-neutral-100 text-neutral-500";
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      {hint && <div className="text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/** Presentational dashboard: target accounts × observed activity, hottest first. */
export function AbmDashboard({ rows }: { rows: AbmDashboardRow[] }) {
  const total   = rows.length;
  const engaged = rows.filter((r) => r.activity).length;
  const hot     = rows.filter((r) => r.score >= 60).length;
  const synced  = rows.filter((r) => r.activity?.hubspotSynced).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Target accounts" value={total} />
        <Kpi label="Engaged" value={engaged} hint="visited the site" />
        <Kpi label="Hot" value={hot} hint="score ≥ 60" />
        <Kpi label="Synced to HubSpot" value={synced} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No target accounts yet — add or import leads on the Target accounts page.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Sessions</th>
                <th className="px-3 py-2 text-right">Visits</th>
                <th className="px-3 py-2 text-left">Last seen</th>
                <th className="px-3 py-2 text-left">Segments</th>
                <th className="px-3 py-2 text-center">CRM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ lead, activity, score }) => {
                const person = lead.profile.name || lead.profile.firstName || lead.identifier;
                return (
                  <tr key={lead.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-neutral-900">
                      <div className="font-medium">{lead.profile.company || person}</div>
                      <div className="text-xs text-neutral-500">
                        {person}{lead.profile.role ? ` · ${lead.profile.role}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${scoreClass(score)}`}>{score}</span>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {activity ? activity.status : <span className="text-neutral-400">not yet visited</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-600">{activity?.sessionCount ?? 0}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{activity?.visitCount ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-neutral-500">{fmtWhen(activity?.lastSeenAt ?? null)}</td>
                    <td className="px-3 py-2 max-w-[14rem] truncate text-xs text-neutral-500">{activity?.segmentIds.join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-center">{activity?.hubspotSynced ? <span className="text-green-600">✓</span> : <span className="text-neutral-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
