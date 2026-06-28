"use client";

import { useState, useTransition } from "react";
import { listLeadProfilesAction, deleteLeadProfilesAction } from "../actions";
import type { VisitorProfile, VisitorProfileFilter } from "@/lib/lead-base/visitor-profiles-store";
import type { IdentityLevel, ProfileStatus } from "@/lib/lead-base/profile-gate";

const INPUT = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

interface SegmentOption { key: string; label: string }

const LEVEL_STYLE: Record<IdentityLevel, string> = {
  anonymous:  "bg-neutral-100 text-neutral-600",
  recognised: "bg-blue-50 text-blue-700",
  known:      "bg-indigo-50 text-indigo-700",
  customer:   "bg-green-50 text-green-700",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXPORT_COLS: Array<[string, (p: VisitorProfile) => string | number]> = [
  ["visitor_key",      (p) => p.visitorKey],
  ["identity_level",   (p) => p.identityLevel],
  ["status",           (p) => p.status],
  ["company_name",     (p) => p.companyName ?? ""],
  ["company_domain",   (p) => p.companyDomain ?? ""],
  ["company_size",     (p) => p.companySize ?? ""],
  ["company_industry", (p) => p.companyIndustry ?? ""],
  ["geo_country",      (p) => p.geoCountry ?? ""],
  ["intent_score",     (p) => p.intentScore ?? ""],
  ["funnel_stage",     (p) => p.funnelStage ?? ""],
  ["segments",         (p) => p.segmentIds.join("|")],
  ["visit_count",      (p) => p.visitCount],
  ["first_seen_at",    (p) => p.firstSeenAt],
  ["last_seen_at",     (p) => p.lastSeenAt],
  ["consent_state",    (p) => p.consentState],
];

function toCsv(rows: VisitorProfile[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = EXPORT_COLS.map(([h]) => h).join(",");
  const body   = rows.map((p) => EXPORT_COLS.map(([, f]) => esc(f(p))).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function LeadBaseClient({
  tenantId,
  initialProfiles,
  segments,
}: {
  tenantId:        string;
  initialProfiles: VisitorProfile[];
  segments:        SegmentOption[];
}) {
  const [profiles, setProfiles] = useState<VisitorProfile[]>(initialProfiles);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg]           = useState<string | null>(null);
  const [pending, start]        = useTransition();

  // Filter form state.
  const [identityLevel, setIdentityLevel] = useState<"" | IdentityLevel>("");
  const [status, setStatus]               = useState<"" | ProfileStatus>("");
  const [segmentId, setSegmentId]         = useState("");
  const [companyQuery, setCompanyQuery]   = useState("");
  const [minIntent, setMinIntent]         = useState("");

  function applyFilters() {
    const filter: VisitorProfileFilter = {
      ...(identityLevel ? { identityLevel } : {}),
      ...(status        ? { status }        : {}),
      ...(segmentId     ? { segmentId }     : {}),
      ...(companyQuery.trim() ? { companyQuery: companyQuery.trim() } : {}),
      ...(minIntent.trim() && !Number.isNaN(Number(minIntent)) ? { minIntent: Number(minIntent) } : {}),
    };
    start(async () => {
      const rows = await listLeadProfilesAction(tenantId, filter);
      setProfiles(rows);
      setSelected(new Set());
      setMsg(`${rows.length} profile(s).`);
    });
  }

  function resetFilters() {
    setIdentityLevel(""); setStatus(""); setSegmentId(""); setCompanyQuery(""); setMinIntent("");
    start(async () => {
      const rows = await listLeadProfilesAction(tenantId, {});
      setProfiles(rows); setSelected(new Set()); setMsg(null);
    });
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const allSelected = profiles.length > 0 && selected.size === profiles.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(profiles.map((p) => p.id)));
  }

  function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} profile(s)? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteLeadProfilesAction(tenantId, ids);
      setProfiles((cur) => cur.filter((p) => !ids.includes(p.id)));
      setSelected(new Set());
      setMsg(`Deleted ${res.deleted} profile(s).`);
    });
  }

  function exportCsv() { triggerDownload(`lead-base-${Date.now()}.csv`, toCsv(profiles), "text/csv"); }
  function exportJson() { triggerDownload(`lead-base-${Date.now()}.json`, JSON.stringify(profiles, null, 2), "application/json"); }

  return (
    <div className="space-y-5">
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className={LABEL}>Identity level</label>
            <select className={INPUT} value={identityLevel} onChange={(e) => setIdentityLevel(e.target.value as IdentityLevel | "")}>
              <option value="">All</option>
              <option value="anonymous">Anonymous</option>
              <option value="recognised">Recognised</option>
              <option value="known">Known</option>
              <option value="customer">Customer</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value as ProfileStatus | "")}>
              <option value="">All</option>
              <option value="visitor">Visitor</option>
              <option value="engaged">Engaged</option>
              <option value="mql">MQL</option>
              <option value="sql">SQL</option>
              <option value="customer">Customer</option>
              <option value="churned">Churned</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Segment</label>
            <select className={INPUT} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">Any</option>
              {segments.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Company</label>
            <input className={INPUT} value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="name or domain" />
          </div>
          <div>
            <label className={LABEL}>Min intent</label>
            <input className={INPUT} value={minIntent} onChange={(e) => setMinIntent(e.target.value)} placeholder="0–100" inputMode="numeric" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={applyFilters} disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
            {pending ? "Loading…" : "Apply filters"}
          </button>
          <button onClick={resetFilters} disabled={pending} className="text-xs text-neutral-500 hover:text-neutral-800">Reset</button>
          <div className="flex-1" />
          <button onClick={exportCsv} disabled={profiles.length === 0} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Export CSV</button>
          <button onClick={exportJson} disabled={profiles.length === 0} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Export JSON</button>
        </div>
      </section>

      {/* ── Bulk bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-neutral-900">Profiles ({profiles.length})</span>
        {selected.size > 0 && (
          <button onClick={() => deleteIds([...selected])} disabled={pending} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            Delete selected ({selected.size})
          </button>
        )}
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      {profiles.length === 0 ? (
        <p className="text-sm text-neutral-500">No profiles match — visitors populate this as they browse (homepage).</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th className="px-3 py-2 text-left">Identity</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Intent</th>
                <th className="px-3 py-2 text-left">Segments</th>
                <th className="px-3 py-2 text-right">Visits</th>
                <th className="px-3 py-2 text-left">Last seen</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLE[p.identityLevel]}`}>{p.identityLevel}</span>
                  </td>
                  <td className="px-3 py-2 text-neutral-900">
                    {p.companyName || <span className="text-neutral-400">—</span>}
                    {p.companyDomain && <span className="text-neutral-400"> · {p.companyDomain}</span>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{p.status}</td>
                  <td className="px-3 py-2 text-right text-neutral-700">{p.intentScore ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500 max-w-[14rem] truncate">{p.segmentIds.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{p.visitCount}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{fmtWhen(p.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => deleteIds([p.id])} disabled={pending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
