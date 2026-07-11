/**
 * Admin — AI Logs
 *
 * Shows recent AI decision log rows from `ai_decision_logs`.
 * Each row is one AI inference: the live plan that was rendered versus
 * the shadow plan the AI suggested, plus confidence and policy verdict.
 *
 * ─── URL filters ─────────────────────────────────────────────────────────────
 *
 *   /admin/ai-logs              — all tenants, last 100 rows
 *   /admin/ai-logs?tenant=slug  — filtered to a single tenant
 *
 * ─── What is displayed ───────────────────────────────────────────────────────
 *
 *   Summary bar:  total decisions, agreement rate, mismatch count,
 *                 distinct tenant count in result set.
 *
 *   Table:        timestamp, tenant, session (truncated), live provider,
 *                 shadow provider, plans match, AI confidence, policy verdict,
 *                 traffic source.
 *
 * ─── Security notes ──────────────────────────────────────────────────────────
 *
 *   API keys are NEVER stored in ai_decision_logs — only model/provider names,
 *   variant keys, confidence scores, and anonymised visitor context.
 *   Rendering this page reveals no credentials.
 */

import Link from "next/link";
import { getRecentAiDecisionLogs } from "@/data/repositories/ai-decisions-repository";
import { getAllTenants } from "@/tenant/server";
import { Card, CardContent } from "@/components/ui/Card";
import { Text } from "@/components/primitives/Text";
import { LogsTable } from "./_components/LogsTable";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminAiLogsPage({ searchParams }: PageProps) {
  const params       = await searchParams;
  const tenantFilter = typeof params.tenant === "string" ? params.tenant : undefined;

  // Fetch AI logs and tenant list in parallel.
  // Neither depends on the other; the tenant list populates the filter pills.
  const [logsResult, tenants] = await Promise.all([
    getRecentAiDecisionLogs({ limit: 100, tenantId: tenantFilter }),
    getAllTenants(),
  ]);

  const logs  = logsResult.ok ? logsResult.data : [];
  const error = !logsResult.ok ? logsResult.error : null;

  // ── Summary stats ──────────────────────────────────────────────────────────
  const total        = logs.length;
  const matches      = logs.filter((l) => l.plans_match).length;
  const mismatches   = total - matches;
  const agreementRate =
    total > 0 ? `${Math.round((matches / total) * 100)}%` : "—";

  // Distinct tenants visible in this result set
  const visibleTenants = [...new Set(
    logs.map((l) => l.tenant_id).filter((t): t is string => Boolean(t)),
  )];

  // AI-enabled tenants for filter pills
  const aiTenants = tenants.filter((t) => t.features.ai);

  return (
    <div className="p-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text variant="h2">AI Logs</Text>
          <Text variant="body-sm" color="muted" className="mt-1">
            {tenantFilter
              ? `Showing AI decisions for ${tenantFilter}`
              : "Recent AI decisions — all tenants"}
          </Text>
        </div>

        {/* Tenant filter pills */}
        {aiTenants.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/ai-logs"
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                !tenantFilter
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
              ].join(" ")}
            >
              All tenants
            </Link>
            {aiTenants.map((t) => (
              <Link
                key={t.tenantId}
                href={`/admin/ai-logs?tenant=${t.tenantId}`}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  tenantFilter === t.tenantId
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
                ].join(" ")}
              >
                {t.tenantId}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Decisions"
          value={total}
          sub="last 100 rows"
        />
        <StatCard
          label="Agreement rate"
          value={agreementRate}
          sub={total > 0 ? `${matches} of ${total} matched` : "no data"}
        />
        <StatCard
          label="Mismatches"
          value={mismatches}
          sub="AI differed from rules"
        />
        <StatCard
          label="Tenants"
          value={visibleTenants.length || "—"}
          sub={visibleTenants.length > 0 ? visibleTenants.join(", ") : "no tenant data"}
        />
      </div>

      {/* ── Error state ─────────────────────────────────────────────────────── */}
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

      {/* ── Log table ───────────────────────────────────────────────────────── */}
      {logs.length === 0 && !error ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              {tenantFilter
                ? `No AI decisions recorded yet for "${tenantFilter}".`
                : "No AI decisions recorded yet. Enable AI shadow or live mode for a tenant to start logging."}
            </p>
          </CardContent>
        </Card>
      ) : logs.length > 0 ? (
        <LogsTable logs={logs} />
      ) : null}
    </div>
  );
}
