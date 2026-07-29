/**
 * Tenant Workspace — AI Logs
 *
 * Shows AI decision logs scoped exclusively to this tenant.
 * Tenant-level view: no tenant filter pills, no cross-tenant rows.
 *
 * ─── Differences from /admin/ai-logs ────────────────────────────────────────
 *
 *   • tenantId is taken from the route params — never from a query string.
 *   • Tenant column is omitted (all rows are this tenant).
 *   • No tenant filter pills (single-tenant context).
 *   • Link back to platform-wide view is shown in the page header.
 *
 * ─── Security notes ──────────────────────────────────────────────────────────
 *
 *   API keys are never stored in ai_decision_logs — only model names, variant
 *   keys, confidence scores, and anonymised visitor context.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecentAiDecisionLogs } from "@/data/repositories/ai-decisions-repository";
import { getTenantById } from "@/tenant/server";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Text } from "@/components/primitives/Text";
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
  const ts    = new Date(iso);
  const diffMs  = Date.now() - ts.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  let relative: string;
  if (diffMin < 1)       relative = "just now";
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24)  relative = `${diffHr}h ago`;
  else                   relative = `${diffDay}d ago`;

  const absolute = ts.toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return { relative, absolute };
}

function truncateSession(id: string): string {
  return id.slice(0, 8) + "…";
}

function formatConfidence(c: number | undefined): string {
  if (c === undefined || c === null) return "—";
  return (c * 100).toFixed(0) + "%";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AiDecisionLogRow }) {
  const { relative, absolute } = formatTime(log.created_at);
  const match    = matchBadge(log.plans_match);
  const verdict  = verdictBadge(log.shadow_plan.policyVerdict);
  const conf     = formatConfidence(log.shadow_plan.confidence);
  const source   = log.context.source ?? "—";

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Time */}
      <td className="px-4 py-3 text-sm text-neutral-500" title={absolute}>
        {relative}
      </td>

      {/* Session */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-neutral-400" title={log.session_id}>
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
      <td className="px-4 py-3 text-sm tabular-nums text-neutral-700">{conf}</td>

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantAiLogsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const logsResult = await getRecentAiDecisionLogs({ limit: 100, tenantId });

  const logs  = logsResult.ok ? logsResult.data : [];
  const error = !logsResult.ok ? logsResult.error : null;

  // ── Summary stats ──────────────────────────────────────────────────────────
  const total         = logs.length;
  const matches       = logs.filter((l) => l.plans_match).length;
  const mismatches    = total - matches;
  const agreementRate = total > 0 ? `${Math.round((matches / total) * 100)}%` : "—";

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">AI Logs</h1>
          <Text variant="body-sm" color="muted" className="mt-1">
            AI decisions for{" "}
            <code className="font-mono text-xs">{tenantId}</code>
            {" — "}last 100 rows
          </Text>
        </div>

        <Link
          href="/admin/ai-logs"
          className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
        >
          View platform-wide logs →
        </Link>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Decisions" value={total} sub="last 100 rows" />
        <StatCard
          label="Agreement rate"
          value={agreementRate}
          sub={total > 0 ? `${matches} of ${total} matched` : "no data"}
        />
        <StatCard label="Mismatches" value={mismatches} sub="AI differed from live" />
      </div>

      {/* Error state */}
      {error && (
        <Card className="mb-6 border-error-200 bg-error-50">
          <CardContent>
            <p className="text-sm text-error-700">
              <strong>Failed to load AI logs:</strong> {error}
            </p>
            <p className="mt-1 text-xs text-error-500">
              Check your Supabase connection and that the migration has been applied.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Log table */}
      {logs.length === 0 && !error ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              No AI decisions recorded yet for this tenant.
              Enable AI shadow or live mode to start logging.
            </p>
          </CardContent>
        </Card>
      ) : logs.length > 0 ? (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {[
                    "Time",
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
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neutral-100 px-4 py-3">
            <p className="text-xs text-neutral-400">
              Showing {logs.length} row{logs.length !== 1 ? "s" : ""}.
              {" "}API keys are never stored, only model names, variant keys, and anonymised visitor context.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
