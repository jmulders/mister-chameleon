"use client";

/**
 * Read-only table of the platform IP company cache, with a name/domain search,
 * a matched filter, and a single global Clear cache action (confirmed).
 *
 * The server sends only firmographic fields (see fetchIpCacheAction); no IP,
 * hash, or raw payload ever reaches this component.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IpCacheEntry, IpCacheOverview } from "../actions";
import { clearIpCacheAction } from "../actions";

type MatchedFilter = "all" | "matched" | "unmatched";

const th: React.CSSProperties = {
  textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", whiteSpace: "nowrap",
};
const td: React.CSSProperties = { fontSize: 13, color: "#111827", padding: "8px 10px", verticalAlign: "top" };

function fmtDate(iso: string): string {
  // Stable, locale-independent YYYY-MM-DD HH:MM (UTC) so the table does not shift.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

function dash(v: string | null): string {
  return v && v.trim() ? v : "-"; // plain hyphen marks an empty cell
}

export function IpCacheClient({ initial }: { initial: IpCacheOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery]     = useState("");
  const [matched, setMatched] = useState<MatchedFilter>("all");
  const [status, setStatus]   = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.rows.filter((r) => {
      if (matched === "matched" && !r.matched) return false;
      if (matched === "unmatched" && r.matched) return false;
      if (!q) return true;
      const hay = `${r.companyName ?? ""} ${r.companyDomain ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [initial.rows, query, matched]);

  function clearCache() {
    setStatus(null);
    startTransition(async () => {
      const res = await clearIpCacheAction();
      setConfirming(false);
      if (res.ok) {
        setStatus({ kind: "ok", text: `Cleared ${res.cleared} cached ${res.cleared === 1 ? "entry" : "entries"}.` });
        router.refresh();
      } else {
        setStatus({ kind: "error", text: res.error });
      }
    });
  }

  const inputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input
          className={inputCls}
          placeholder="Search company or domain"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260 }}
          aria-label="Search company or domain"
        />
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "matched", "unmatched"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setMatched(v)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              style={matched === v ? { borderColor: "#4f46e5", background: "#eef2ff", color: "#4f46e5" } : undefined}
            >
              {v === "all" ? "All" : v === "matched" ? "Matched" : "Unmatched"}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 12, color: "#b91c1c" }}>Clear the entire cache?</span>
              <button
                type="button"
                onClick={clearCache}
                disabled={pending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Clearing..." : "Yes, clear all"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setStatus(null); setConfirming(true); }}
              className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Clear cache
            </button>
          )}
        </div>
      </div>

      {status && (
        <div style={{ marginBottom: 10, fontSize: 12, color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>
          {status.text}
        </div>
      )}

      {/* Summary line */}
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        Showing {filtered.length} of {initial.rows.length} loaded {initial.rows.length === 1 ? "entry" : "entries"}
        {" "}({initial.matched} matched).
        {initial.truncated && ` The cache holds ${initial.total} entries; only the ${initial.rows.length} most recent are shown.`}
      </div>

      {/* Table */}
      {initial.rows.length === 0 ? (
        <div
          style={{
            padding: "2rem", borderRadius: 10, border: "1px dashed #e5e7eb",
            background: "#fafafa", textAlign: "center", fontSize: 13, color: "#9ca3af",
          }}
        >
          The IP company cache is empty. It fills automatically as visitors are enriched.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={th}>Company</th>
                <th style={th}>Domain</th>
                <th style={th}>Industry</th>
                <th style={th}>Size</th>
                <th style={th}>Country</th>
                <th style={th}>Region</th>
                <th style={th}>City</th>
                <th style={th}>Matched</th>
                <th style={th}>Refreshed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <RowView key={i} r={r} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td style={{ ...td, color: "#9ca3af" }} colSpan={9}>No entries match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowView({ r }: { r: IpCacheEntry }) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ ...td, fontWeight: 600 }}>{dash(r.companyName)}</td>
      <td style={td}>{dash(r.companyDomain)}</td>
      <td style={td}>{dash(r.companyIndustry)}</td>
      <td style={td}>{dash(r.companySize)}</td>
      <td style={td}>{dash(r.countryCode)}</td>
      <td style={td}>{dash(r.region)}</td>
      <td style={td}>{dash(r.city)}</td>
      <td style={td}>
        <span
          style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
            color:      r.matched ? "#15803d" : "#6b7280",
            background:  r.matched ? "#dcfce7" : "#f3f4f6",
          }}
        >
          {r.matched ? "Yes" : "No"}
        </span>
      </td>
      <td style={{ ...td, whiteSpace: "nowrap", color: "#6b7280" }}>{fmtDate(r.refreshedAt)}</td>
    </tr>
  );
}
