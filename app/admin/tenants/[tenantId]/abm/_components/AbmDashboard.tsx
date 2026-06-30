"use client";

import { useState } from "react";
import type { AbmDashboardRow } from "../actions";

type Filter = "all" | "engaged" | "hot" | "not_visited" | "synced";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "engaged",     label: "Engaged" },
  { key: "hot",         label: "Hot (≥60)" },
  { key: "not_visited", label: "Not yet visited" },
  { key: "synced",      label: "Synced to CRM" },
];

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

function matchesFilter(r: AbmDashboardRow, f: Filter): boolean {
  switch (f) {
    case "engaged":     return !!r.activity;
    case "hot":         return r.score >= 60;
    case "not_visited": return !r.activity;
    case "synced":      return !!r.activity?.hubspotSynced;
    default:            return true;
  }
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

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const CSV_COLS: Array<[string, (r: AbmDashboardRow, baseUrl: string) => string | number]> = [
  ["company",       (r) => r.lead.profile.company ?? ""],
  ["person",        (r) => r.lead.profile.name ?? r.lead.profile.firstName ?? ""],
  ["role",          (r) => r.lead.profile.role ?? ""],
  ["score",         (r) => r.score],
  ["status",        (r) => r.activity?.status ?? "not_visited"],
  ["sessions",      (r) => r.activity?.sessionCount ?? 0],
  ["visits",        (r) => r.activity?.visitCount ?? 0],
  ["last_seen",     (r) => r.activity?.lastSeenAt ?? ""],
  ["segments",      (r) => (r.activity?.segmentIds ?? []).join("|")],
  ["hubspot_synced",(r) => (r.activity?.hubspotSynced ? "yes" : "no")],
  ["link",          (r, baseUrl) => `${baseUrl}/go/${r.lead.identifier}`],
];

function toCsv(rows: AbmDashboardRow[], baseUrl: string): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = CSV_COLS.map(([h]) => h).join(",");
  const body   = rows.map((r) => CSV_COLS.map(([, f]) => esc(f(r, baseUrl))).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function AbmDashboard({ rows, baseUrl }: { rows: AbmDashboardRow[]; baseUrl: string }) {
  const [filter, setFilter] = useState<Filter>("all");

  const total    = rows.length;
  const engaged  = rows.filter((r) => r.activity).length;
  const hot      = rows.filter((r) => r.score >= 60).length;
  const synced   = rows.filter((r) => r.activity?.hubspotSynced).length;
  const filtered = rows.filter((r) => matchesFilter(r, filter));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Target accounts" value={total} />
        <Kpi label="Engaged" value={engaged} hint="visited the site" />
        <Kpi label="Hot" value={hot} hint="score ≥ 60" />
        <Kpi label="Synced to HubSpot" value={synced} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              filter === f.key
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-neutral-500">{filtered.length} account(s)</span>
        <div className="flex-1" />
        <button
          onClick={() => triggerDownload(`abm-dashboard-${Date.now()}.csv`, toCsv(filtered, baseUrl), "text/csv")}
          disabled={filtered.length === 0}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">No accounts match this filter.</p>
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
              {filtered.map(({ lead, activity, score }) => {
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
