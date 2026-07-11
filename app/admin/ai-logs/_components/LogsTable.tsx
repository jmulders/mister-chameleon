"use client";

/**
 * LogsTable — client-side presentation of the AI decision logs table.
 *
 * Receives the already-fetched log rows from the server page and renders the
 * same table markup, sliced through usePagination so long result sets paginate
 * without a server round-trip.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { usePagination, PaginationControls } from "@/components/admin/Pagination";
import type { AiDecisionLogRow } from "@/data/types";

// ── Badge helpers ─────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function matchBadge(match: boolean): { variant: BadgeVariant; label: string } {
  return match
    ? { variant: "success", label: "Match" }
    : { variant: "warning", label: "Differ" };
}

function verdictBadge(verdict: string | undefined): { variant: BadgeVariant; label: string } {
  if (!verdict) return { variant: "outline", label: "—" };
  switch (verdict) {
    case "USE_AI":                    return { variant: "success", label: "USE_AI" };
    case "FALLBACK_LOW_CONFIDENCE":   return { variant: "warning", label: "LOW_CONF" };
    case "FALLBACK_CONTEXT_SPARSE":   return { variant: "default", label: "SPARSE" };
    case "FALLBACK_MISSING_FIELDS":   return { variant: "error",   label: "BAD_FIELDS" };
    case "FALLBACK_INVALID_KEYS":     return { variant: "error",   label: "BAD_KEYS" };
    default:                          return { variant: "outline", label: verdict };
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatTime(iso: string): { relative: string; absolute: string } {
  const ts = new Date(iso);
  const diffMs = Date.now() - ts.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  let relative: string;
  if (diffMin < 1)       relative = "just now";
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24)  relative = `${diffHr}h ago`;
  else                   relative = `${diffDay}d ago`;

  const absolute = ts.toLocaleString("en-GB", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });

  return { relative, absolute };
}

function truncateSession(sessionId: string): string {
  return sessionId.slice(0, 8) + "…";
}

function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined || confidence === null) return "—";
  return (confidence * 100).toFixed(0) + "%";
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AiDecisionLogRow }) {
  const { relative, absolute }  = formatTime(log.created_at);
  const match                   = matchBadge(log.plans_match);
  const verdict                 = verdictBadge(log.shadow_plan.policyVerdict);
  const confidence              = formatConfidence(log.shadow_plan.confidence);
  // const tenantLabel             = log.tenant_id ?? "—"; // reserved for future use
  const source                  = log.context.source ?? "—";

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Time */}
      <td className="px-4 py-3 text-sm text-neutral-500" title={absolute}>
        {relative}
      </td>

      {/* Tenant */}
      <td className="px-4 py-3">
        {log.tenant_id ? (
          <Link
            href={`/admin/ai-logs?tenant=${log.tenant_id}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {log.tenant_id}
          </Link>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>

      {/* Session */}
      <td className="px-4 py-3">
        <span
          className="font-mono text-xs text-neutral-400"
          title={log.session_id}
        >
          {truncateSession(log.session_id)}
        </span>
      </td>

      {/* Live provider */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-600">{log.live_provider}</span>
      </td>

      {/* Shadow provider */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-600">{log.shadow_provider}</span>
      </td>

      {/* Plans match */}
      <td className="px-4 py-3">
        <Badge variant={match.variant} size="sm">{match.label}</Badge>
      </td>

      {/* Confidence */}
      <td className="px-4 py-3 text-sm tabular-nums text-neutral-700">
        {confidence}
      </td>

      {/* Policy verdict */}
      <td className="px-4 py-3">
        <Badge variant={verdict.variant} size="sm">{verdict.label}</Badge>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-500">{source}</span>
      </td>
    </tr>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

export function LogsTable({ logs }: { logs: AiDecisionLogRow[] }) {
  const pager = usePagination(logs, 25);

  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {[
                "Time",
                "Tenant",
                "Session",
                "Live provider",
                "Shadow provider",
                "Plans",
                "Confidence",
                "Verdict",
                "Source",
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4">
        <PaginationControls {...pager} label="logs" />
      </div>

      {/* Table footer */}
      <div className="border-t border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-400">
          Showing {logs.length} row{logs.length !== 1 ? "s" : ""}.
          {" "}API keys are never stored — only model names, variant keys, and anonymised visitor context.
        </p>
      </div>
    </Card>
  );
}
