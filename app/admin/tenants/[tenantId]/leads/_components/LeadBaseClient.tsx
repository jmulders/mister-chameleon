"use client";

import { Fragment, useState, useTransition } from "react";
import { listLeadProfilesAction, deleteLeadProfilesAction, listVisitorEventsAction } from "../actions";
import type { VisitorEvent } from "@/lib/lead-base/visitor-events-store";
import type { VisitorProfile, VisitorProfileFilter } from "@/lib/lead-base/visitor-profiles-store";
import type { IdentityLevel, ProfileStatus } from "@/lib/lead-base/profile-gate";
import { leadScore, scoreClass, type LeadScoreConfig } from "@/lib/lead-base/lead-scoring";
import { usePagination, PaginationControls } from "@/components/admin/Pagination";

const INPUT = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

interface SegmentOption { key: string; label: string }

const LEVEL_STYLE: Record<IdentityLevel, string> = {
  anonymous:  "bg-neutral-100 text-neutral-600",
  recognised: "bg-blue-50 text-blue-700",
  known:      "bg-indigo-50 text-indigo-700",
  customer:   "bg-green-50 text-green-700",
};

const LEVEL_RANK:  Record<IdentityLevel, number> = { anonymous: 0, recognised: 1, known: 2, customer: 3 };
const STATUS_RANK: Record<ProfileStatus, number> = { visitor: 0, engaged: 1, mql: 2, sql: 3, customer: 4, churned: 0 };

interface AccountGroup { key: string; company: string; domain: string | null; members: VisitorProfile[] }
type RenderItem =
  | { type: "single"; profile: VisitorProfile; ts: number }
  | { type: "group";  group: AccountGroup;    ts: number };

const tsOf = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** Collapse profiles that share a company into one expandable group; the rest
 *  (anonymous, or a single-session company) render as normal rows. Recency order. */
function buildRenderList(profiles: VisitorProfile[], grouped: boolean): RenderItem[] {
  if (!grouped) return profiles.map((p) => ({ type: "single" as const, profile: p, ts: tsOf(p.lastSeenAt) }));
  const map = new Map<string, AccountGroup>();
  const order: string[] = [];
  const singles: VisitorProfile[] = [];
  for (const p of profiles) {
    const company = (p.companyName ?? "").trim();
    if (!company) { singles.push(p); continue; }
    const key = company.toLowerCase();
    if (!map.has(key)) { map.set(key, { key, company, domain: p.companyDomain ?? null, members: [] }); order.push(key); }
    const g = map.get(key)!;
    g.members.push(p);
    if (!g.domain && p.companyDomain) g.domain = p.companyDomain;
  }
  const items: RenderItem[] = [];
  for (const key of order) {
    const g = map.get(key)!;
    if (g.members.length === 1) items.push({ type: "single", profile: g.members[0], ts: tsOf(g.members[0].lastSeenAt) });
    else items.push({ type: "group", group: g, ts: Math.max(...g.members.map((m) => tsOf(m.lastSeenAt))) });
  }
  for (const p of singles) items.push({ type: "single", profile: p, ts: tsOf(p.lastSeenAt) });
  return items.sort((a, b) => b.ts - a.ts);
}

function aggregateGroup(g: AccountGroup) {
  const level  = g.members.reduce<IdentityLevel>((m, p) => (LEVEL_RANK[p.identityLevel]  > LEVEL_RANK[m]  ? p.identityLevel : m), "anonymous");
  const status = g.members.reduce<ProfileStatus>((m, p) => (STATUS_RANK[p.status]        > STATUS_RANK[m] ? p.status        : m), "visitor");
  const visits = g.members.reduce((s, p) => s + p.visitCount, 0);
  const intentVals = g.members.map((p) => p.intentScore).filter((v): v is number => typeof v === "number");
  const intent = intentVals.length ? Math.max(...intentVals) : null;
  const lastSeen = g.members.reduce<string | null>((m, p) => (tsOf(p.lastSeenAt) > tsOf(m) ? p.lastSeenAt : m), null);
  const segments = Array.from(new Set(g.members.flatMap((p) => p.segmentIds)));
  return { level, status, visits, intent, lastSeen, segments };
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "·";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "·";
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
  scoreConfig,
}: {
  tenantId:        string;
  initialProfiles: VisitorProfile[];
  segments:        SegmentOption[];
  scoreConfig?:    LeadScoreConfig;
}) {
  const score = (p: VisitorProfile) => leadScore(p, Date.now(), scoreConfig);
  const [profiles, setProfiles] = useState<VisitorProfile[]>(initialProfiles);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg]           = useState<string | null>(null);
  const [pending, start]        = useTransition();
  const [grouped, setGrouped]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy]     = useState<"score" | "recent">("score");
  const [eventsOpen, setEventsOpen]       = useState<string | null>(null);
  const [events, setEvents]               = useState<VisitorEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [copiedKey, setCopiedKey]         = useState<string | null>(null);

  /** Deep-link to the Journey Intelligence viewer with this session preloaded. */
  const journeyHref = (visitorKey: string) =>
    `/admin/tenants/${tenantId}/behavior/journey?session=${encodeURIComponent(visitorKey)}`;

  /** Copy the full session ID to the clipboard with brief "Copied!" feedback. */
  function copySession(visitorKey: string) {
    navigator.clipboard?.writeText(visitorKey).then(
      () => {
        setCopiedKey(visitorKey);
        setTimeout(() => setCopiedKey((c) => (c === visitorKey ? null : c)), 1500);
      },
      () => {/* clipboard blocked — ignore */},
    );
  }

  function toggleEvents(p: VisitorProfile) {
    if (eventsOpen === p.id) { setEventsOpen(null); return; }
    setEventsOpen(p.id);
    setEvents([]);
    setEventsLoading(true);
    start(async () => {
      try { setEvents(await listVisitorEventsAction(tenantId, p.visitorKey)); }
      finally { setEventsLoading(false); }
    });
  }

  const itemScore = (item: RenderItem) =>
    item.type === "single" ? score(item.profile) : Math.max(...item.group.members.map(score));
  const renderList = buildRenderList(profiles, grouped);
  if (sortBy === "score") renderList.sort((a, b) => itemScore(b) - itemScore(a));
  const profilesPager = usePagination(renderList, 25);
  const toggleExpand = (key: string) =>
    setExpanded((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const selectMany = (ids: string[], on: boolean) =>
    setSelected((cur) => { const n = new Set(cur); for (const id of ids) { if (on) n.add(id); else n.delete(id); } return n; });

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
    if (!confirm(`Delete ${ids.length} profile(s)? Any linked HubSpot contact is archived (recycling bin) for GDPR erasure. This cannot be undone here.`)) return;
    start(async () => {
      const res = await deleteLeadProfilesAction(tenantId, ids);
      setProfiles((cur) => cur.filter((p) => !ids.includes(p.id)));
      setSelected(new Set());
      setMsg(`Deleted ${res.deleted} profile(s)${res.crmArchived ? `, archived ${res.crmArchived} HubSpot contact(s)` : ""}.`);
    });
  }

  function exportCsv() { triggerDownload(`lead-base-${Date.now()}.csv`, toCsv(profiles), "text/csv"); }
  function exportJson() { triggerDownload(`lead-base-${Date.now()}.json`, JSON.stringify(profiles, null, 2), "application/json"); }

  const renderProfileRow = (p: VisitorProfile, indented = false) => (
    <Fragment key={p.id}>
      <tr className="hover:bg-neutral-50">
        <td className={`px-3 py-2 ${indented ? "pl-8" : ""}`}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
        <td className="px-3 py-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLE[p.identityLevel]}`}>{p.identityLevel}</span>
        </td>
        <td className="px-3 py-2 text-neutral-900">
          {indented
            ? <span className="font-mono text-xs text-neutral-400">session {p.visitorKey.slice(0, 8)}…</span>
            : (<>{p.companyName || <span className="text-neutral-400">·</span>}{p.companyDomain && <span className="text-neutral-400"> · {p.companyDomain}</span>}</>)}
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${scoreClass(score(p))}`}>{score(p)}</span>
        </td>
        <td className="px-3 py-2 text-neutral-600">{p.status}</td>
        <td className="px-3 py-2 text-right text-neutral-700">{p.intentScore ?? "·"}</td>
        <td className="px-3 py-2 text-xs text-neutral-500 max-w-[14rem] truncate">{p.segmentIds.join(", ") || "·"}</td>
        <td className="px-3 py-2 text-right">
          <button onClick={() => toggleEvents(p)} className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 hover:underline" title="Activity timeline">
            <span className="text-neutral-400">{eventsOpen === p.id ? "▾" : "▸"}</span>{p.visitCount}
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-neutral-500">{fmtWhen(p.lastSeenAt)}</td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-2 text-xs">
            <a
              href={journeyHref(p.visitorKey)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open this session in Journey Intelligence"
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Journey&nbsp;↗
            </a>
            <button
              onClick={() => copySession(p.visitorKey)}
              title={`Copy session ID: ${p.visitorKey}`}
              className="text-neutral-500 hover:text-neutral-800"
            >
              {copiedKey === p.visitorKey ? "Copied!" : "Copy ID"}
            </button>
            <button onClick={() => deleteIds([p.id])} disabled={pending} className="text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
          </div>
        </td>
      </tr>
      {eventsOpen === p.id && (
        <tr className="bg-neutral-50/40">
          <td colSpan={10} className="px-6 py-3">
            {eventsLoading ? (
              <span className="text-xs text-neutral-400">Loading timeline…</span>
            ) : events.length === 0 ? (
              <span className="text-xs text-neutral-400">No page events recorded for this session.</span>
            ) : (
              <ul className="space-y-1">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0 text-neutral-400">{fmtWhen(e.occurredAt)}</span>
                    <span className="font-mono text-neutral-800">{e.path || "·"}</span>
                    {(e.utmSource || e.utmCampaign) && (
                      <span className="text-neutral-500">· utm: {[e.utmSource, e.utmMedium, e.utmCampaign].filter(Boolean).join(" / ")}</span>
                    )}
                    {e.referrer && <span className="truncate text-neutral-400">· ref: {e.referrer}</span>}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );

  const renderGroupRow = (g: AccountGroup) => {
    const a = aggregateGroup(g);
    const memberIds = g.members.map((m) => m.id);
    const allMembersSelected = memberIds.every((id) => selected.has(id));
    const isOpen = expanded.has(g.key);
    return (
      <Fragment key={`g-${g.key}`}>
        <tr className="bg-neutral-50/60 hover:bg-neutral-50">
          <td className="px-3 py-2"><input type="checkbox" checked={allMembersSelected} onChange={(e) => selectMany(memberIds, e.target.checked)} /></td>
          <td className="px-3 py-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLE[a.level]}`}>{a.level}</span>
          </td>
          <td className="px-3 py-2 text-neutral-900">
            <button onClick={() => toggleExpand(g.key)} className="inline-flex items-center gap-1 font-medium hover:underline">
              <span className="text-neutral-400">{isOpen ? "▾" : "▸"}</span>
              {g.company}
              {g.domain && <span className="font-normal text-neutral-400"> · {g.domain}</span>}
              <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">{g.members.length} sessions</span>
            </button>
          </td>
          <td className="px-3 py-2 text-right">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${scoreClass(Math.max(...g.members.map(score)))}`}>{Math.max(...g.members.map(score))}</span>
          </td>
          <td className="px-3 py-2 text-neutral-600">{a.status}</td>
          <td className="px-3 py-2 text-right text-neutral-700">{a.intent ?? "·"}</td>
          <td className="px-3 py-2 text-xs text-neutral-500 max-w-[14rem] truncate">{a.segments.join(", ") || "·"}</td>
          <td className="px-3 py-2 text-right text-neutral-600">{a.visits}</td>
          <td className="px-3 py-2 text-xs text-neutral-500">{fmtWhen(a.lastSeen)}</td>
          <td className="px-3 py-2 text-right">
            <button onClick={() => deleteIds(memberIds)} disabled={pending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete all</button>
          </td>
        </tr>
        {isOpen && g.members.map((m) => renderProfileRow(m, true))}
      </Fragment>
    );
  };

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
        <label className="flex items-center gap-1.5 text-xs text-neutral-600">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Group by account
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-600">
          Sort
          <select className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "recent")}>
            <option value="score">Hottest</option>
            <option value="recent">Most recent</option>
          </select>
        </label>
        {selected.size > 0 && (
          <button onClick={() => deleteIds([...selected])} disabled={pending} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            Delete selected ({selected.size})
          </button>
        )}
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      {profiles.length === 0 ? (
        <p className="text-sm text-neutral-500">No profiles match. Visitors populate this as they browse (homepage).</p>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th className="px-3 py-2 text-left">Identity</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Intent</th>
                <th className="px-3 py-2 text-left">Segments</th>
                <th className="px-3 py-2 text-right">Visits</th>
                <th className="px-3 py-2 text-left">Last seen</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {profilesPager.pageItems.map((item) =>
                item.type === "single" ? renderProfileRow(item.profile) : renderGroupRow(item.group),
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls {...profilesPager} label="profielen" />
        </>
      )}
    </div>
  );
}
