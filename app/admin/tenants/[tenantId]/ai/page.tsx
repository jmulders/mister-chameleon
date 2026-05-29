/**
 * Tenant Workspace — Decisions
 *
 * Decision explainability view for a single tenant.  Shows:
 *
 *   1. AI configuration summary  — current mode (disabled / shadow / live),
 *      provider names, and confidence threshold.
 *
 *   2. Recent decision log       — last 50 AI log rows with human-readable
 *      path labels and verdict explanations derived from live_provider and
 *      shadow_plan.policyVerdict.
 *
 *   3. Decision path guide       — one-paragraph description of each of the
 *      four decision paths (rules / experiment / ai / fallback) so operators
 *      understand what the log entries mean.
 *
 * ─── What this page is NOT ────────────────────────────────────────────────────
 *
 *   This page is NOT a duplicate of the AI Logs tab.  The AI Logs tab shows
 *   raw log rows (providers, plans, shadow confidence).  This page interprets
 *   them into plain-language explanations and provides the tenant's decision
 *   configuration context alongside the data.
 *
 * ─── Data sources ─────────────────────────────────────────────────────────────
 *
 *   Tenant settings  — getTenantById() + normalizeTenant()
 *   Recent log rows  — getRecentAiDecisionLogs({ limit: 50, tenantId })
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   API keys are never stored in ai_decision_logs and are not serialised here.
 *   The tenant settings are read server-side only; no secrets cross the
 *   server→client boundary.
 */

import Link        from "next/link";
import { notFound } from "next/navigation";
import { getTenantById }     from "@/tenant/server";
import { normalizeTenant }   from "@/tenant/normalize";
import { getRecentAiDecisionLogs } from "@/data/repositories/ai-decisions-repository";
import { liveProviderToPathLabel, verdictToExplanation } from "@/decision/explain";
import { Badge }             from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Text }              from "@/components/primitives/Text";
import type { AiDecisionLogRow } from "@/data/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

// ── Badge helpers ─────────────────────────────────────────────────────────────

function modeBadge(mode: string): { variant: BadgeVariant; label: string } {
  switch (mode) {
    case "live":     return { variant: "success", label: "Live" };
    case "shadow":   return { variant: "warning", label: "Shadow" };
    case "disabled": return { variant: "outline", label: "Disabled" };
    default:         return { variant: "default", label: mode };
  }
}

function pathBadge(liveProvider: string): { variant: BadgeVariant; label: string } {
  if (liveProvider === "rules")              return { variant: "primary", label: "Rule match" };
  if (liveProvider.startsWith("ai:"))        return { variant: "success", label: "AI decision" };
  if (liveProvider.startsWith("experiment")) return { variant: "warning", label: "A/B experiment" };
  if (liveProvider === "fallback")           return { variant: "outline", label: "Fallback" };
  return { variant: "default", label: liveProvider };
}

function verdictBadge(verdict: string | undefined): { variant: BadgeVariant; label: string } {
  if (!verdict) return { variant: "outline", label: "—" };
  switch (verdict) {
    case "USE_AI":                   return { variant: "success", label: "Accepted" };
    case "FALLBACK_LOW_CONFIDENCE":  return { variant: "warning", label: "Low conf." };
    case "FALLBACK_CONTEXT_SPARSE":  return { variant: "default", label: "Sparse ctx." };
    case "FALLBACK_MISSING_FIELDS":  return { variant: "error",   label: "Bad fields" };
    case "FALLBACK_INVALID_KEYS":    return { variant: "error",   label: "Bad keys" };
    default:                         return { variant: "outline", label: verdict };
  }
}

// ── Time formatter ────────────────────────────────────────────────────────────

function formatTime(iso: string): { relative: string; absolute: string } {
  const ts      = new Date(iso);
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

function formatPct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(0)}%`;
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

function DecisionRow({ log }: { log: AiDecisionLogRow }) {
  const { relative, absolute } = formatTime(log.created_at);
  const path    = pathBadge(log.live_provider);
  const verdict = verdictBadge(log.shadow_plan.policyVerdict);
  const conf    = formatPct(log.shadow_plan.confidence);

  // Human-readable explanation strings derived from log fields
  const pathExplanation    = liveProviderToPathLabel(log.live_provider);
  const verdictExplanation = verdictToExplanation(log.shadow_plan.policyVerdict);

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Time */}
      <td className="px-4 py-3 text-sm text-neutral-500" title={absolute}>
        {relative}
      </td>

      {/* Decision path */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge variant={path.variant} size="sm">{path.label}</Badge>
          <span className="text-[11px] text-neutral-400">{pathExplanation}</span>
        </div>
      </td>

      {/* Served variants */}
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-600">Hero:</span>{" "}
            <code className="font-mono">{log.live_plan.heroKey}</code>
          </p>
          <p className="text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-600">Proof:</span>{" "}
            <code className="font-mono">{log.live_plan.proofKey}</code>
          </p>
          <p className="text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-600">CTA:</span>{" "}
            <code className="font-mono">{log.live_plan.ctaKey}</code>
          </p>
        </div>
      </td>

      {/* AI verdict */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge variant={verdict.variant} size="sm">{verdict.label}</Badge>
          <span className="text-[11px] text-neutral-400">{verdictExplanation}</span>
        </div>
      </td>

      {/* Confidence */}
      <td className="px-4 py-3 text-sm tabular-nums text-neutral-700">{conf}</td>

      {/* Plans agreement */}
      <td className="px-4 py-3">
        {log.plans_match ? (
          <span className="text-xs font-medium text-green-700">✓ Match</span>
        ) : (
          <span className="text-xs font-medium text-amber-600">≠ Differ</span>
        )}
      </td>

      {/* Traffic source */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-500">{log.context.source ?? "—"}</span>
      </td>
    </tr>
  );
}

// ── Decision path guide ───────────────────────────────────────────────────────

function DecisionPathGuide() {
  const paths = [
    {
      label:   "Rule match",
      variant: "primary" as BadgeVariant,
      desc:    "A stored or hardcoded rule matched the visitor's context (source, device, UTM, enrichment signals, etc.). The matched rule's variant plan was served directly. Rules run first and take highest priority.",
    },
    {
      label:   "A/B experiment",
      variant: "warning" as BadgeVariant,
      desc:    "One or more A/B experiment assignments overrode the base plan for specific slots. The experiment layer wraps the rules layer — slots not overridden by an experiment use the rules or fallback plan.",
    },
    {
      label:   "AI decision",
      variant: "success" as BadgeVariant,
      desc:    "The AI provider (Claude or OpenAI) produced a variant plan that passed the confidence policy. The live_provider in logs shows which AI provider ran. Only applies when AI mode is set to \u201clive\u201d.",
    },
    {
      label:   "Default fallback",
      variant: "outline" as BadgeVariant,
      desc:    "No rule matched, no experiment was active, and AI was either disabled or below the confidence threshold. The hardcoded default variant set was served.",
    },
  ];

  return (
    <Card>
      <CardContent>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          How decisions work
        </p>
        <div className="space-y-4">
          {paths.map((p) => (
            <div key={p.label} className="flex gap-3">
              <div className="mt-0.5 shrink-0">
                <Badge variant={p.variant} size="sm">{p.label}</Badge>
              </div>
              <p className="text-sm text-neutral-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantDecisionsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [rawTenant, logsResult] = await Promise.all([
    getTenantById(tenantId),
    getRecentAiDecisionLogs({ limit: 50, tenantId }),
  ]);

  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);
  const ai     = tenant.ai;

  const logs  = logsResult.ok ? logsResult.data : [];
  const error = !logsResult.ok ? logsResult.error : null;

  // ── Summary stats ──────────────────────────────────────────────────────────
  const total       = logs.length;
  const aiUsed      = logs.filter((l) => l.live_provider.startsWith("ai:")).length;
  const ruleUsed    = logs.filter((l) => l.live_provider === "rules").length;
  const fallbacks   = logs.filter((l) => l.live_provider === "fallback").length;
  const aiAgreement = logs.filter((l) => l.plans_match).length;
  const agreementRate = total > 0 ? `${Math.round((aiAgreement / total) * 100)}%` : "—";

  // ── AI config display ──────────────────────────────────────────────────────
  const mode       = ai?.mode ?? "disabled";
  const modeBadgeData = modeBadge(mode);
  const liveProviderName   = ai?.liveProvider?.model
    ? `${ai.liveProvider.model}`
    : "default";
  const shadowProviderName = ai?.shadowProvider?.model
    ? `${ai.shadowProvider.model}`
    : "default";
  const confThreshold = ai?.confidenceThreshold
    ? `${(ai.confidenceThreshold * 100).toFixed(0)}%`
    : "75% (platform default)";

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Decisions</h1>
          <Text variant="body-sm" color="muted" className="mt-1">
            Decision explainability for{" "}
            <code className="font-mono text-xs">{tenantId}</code>
          </Text>
        </div>

        <div className="flex gap-3">
          <Link
            href="/admin/platform/variants"
            className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          >
            Variant AI metadata →
          </Link>
          <Link
            href={`/admin/tenants/${tenantId}/ai-logs`}
            className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          >
            View raw AI logs →
          </Link>
          <Link
            href="/admin/ai-logs"
            className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          >
            Platform-wide logs →
          </Link>
        </div>
      </div>

      {/* AI configuration summary */}
      <Card className="mb-6">
        <CardContent>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            AI configuration
          </p>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-neutral-400">Mode</p>
              <div className="mt-1">
                <Badge variant={modeBadgeData.variant} size="sm" dot>
                  {modeBadgeData.label}
                </Badge>
              </div>
            </div>
            {mode !== "disabled" && (
              <>
                <div>
                  <p className="text-xs text-neutral-400">
                    {mode === "live" ? "Live provider" : "Shadow provider"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-neutral-700">
                    {mode === "live" ? liveProviderName : shadowProviderName}
                  </p>
                </div>
                {mode === "shadow" && (
                  <div>
                    <p className="text-xs text-neutral-400">Shadow provider</p>
                    <p className="mt-1 text-sm font-medium text-neutral-700">
                      {shadowProviderName}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-neutral-400">Confidence threshold</p>
                  <p className="mt-1 text-sm font-medium text-neutral-700">
                    {confThreshold}
                  </p>
                </div>
              </>
            )}
            {mode === "disabled" && (
              <p className="text-sm text-neutral-400 self-center">
                AI is disabled for this tenant. Decisions will use rules and fallback.
                Enable AI in the Overview settings to start logging decisions.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total decisions" value={total} sub="last 50 rows" />
        <StatCard label="AI-driven" value={aiUsed} sub={total > 0 ? `${Math.round((aiUsed / total) * 100)}% of decisions` : "—"} />
        <StatCard label="Rule-driven" value={ruleUsed} sub={total > 0 ? `${Math.round((ruleUsed / total) * 100)}% of decisions` : "—"} />
        <StatCard label="AI agreement" value={agreementRate} sub={`shadow matched live in ${aiAgreement} of ${total}`} />
      </div>

      {/* Error state */}
      {error && (
        <Card className="mb-6 border-error-200 bg-error-50">
          <CardContent>
            <p className="text-sm text-error-700">
              <strong>Failed to load decision logs:</strong> {error}
            </p>
            <p className="mt-1 text-xs text-error-500">
              Check your Supabase connection and that the migration has been applied.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Decision log */}
      {logs.length === 0 && !error ? (
        <Card className="mb-6">
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              No decisions recorded yet for this tenant.{" "}
              {mode === "disabled"
                ? "Enable AI shadow or live mode to start logging decisions."
                : "Decisions will appear here once the first request is processed."}
            </p>
          </CardContent>
        </Card>
      ) : logs.length > 0 ? (
        <Card padding="none" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {[
                    "Time",
                    "Decision path",
                    "Served variants",
                    "AI verdict",
                    "AI confidence",
                    "Agreement",
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
                  <DecisionRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neutral-100 px-4 py-3">
            <p className="text-xs text-neutral-400">
              Showing {logs.length} row{logs.length !== 1 ? "s" : ""}.{" "}
              API keys are never stored — only model names, variant keys, and anonymised visitor context.
            </p>
          </div>
        </Card>
      ) : null}

      {/* Decision path guide */}
      <DecisionPathGuide />
    </div>
  );
}
