/**
 * AI Decision Logs Dashboard — Step C4
 *
 * Server component. Loads up to 50 rows from `ai_decision_logs` and renders:
 *
 *   1. SummaryBlock  — three stat cards: total / matching / mismatching
 *   2. FilterTabs    — all / matching / mismatching tab bar
 *   3. LogsTable     — compact summary rows with native <details> plan panels
 *
 * Step C4 change in data strategy: we always fetch the 50 most recent rows
 * unfiltered so the summary counts are always consistent. The active filter is
 * applied in JS before the table is rendered — no extra DB round-trip.
 *
 * Filter routing:
 *   ?filter=all       (default) — every log row
 *   ?filter=match     — only rows where plans_match = true
 *   ?filter=mismatch  — only rows where plans_match = false
 *
 * No editing, no charts. Errors and per-filter empty states handled gracefully.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getRecentAiDecisionLogs } from "@/data/repositories/ai-logs-repository";
import type { AiDecisionLogRow } from "@/data/repositories/ai-logs-repository";
import type { AiPlanSnapshot } from "@/data/types";
import { getActiveTenantWithDevOverride, getTenantById } from "@/tenant/server";
import { getTenantAiRuntimeConfig } from "@/ai/config";
import type { AiRuntimeConfig } from "@/ai/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

export const metadata: Metadata = { title: "AI Decisions · Dashboard" };

const PAGE_LIMIT = 50;

// ── Filter type ────────────────────────────────────────────────────────────────

type FilterValue = "all" | "match" | "mismatch";

function parseFilter(raw: string | string[] | undefined): FilterValue {
  if (raw === "match" || raw === "mismatch") return raw;
  return "all";
}

function applyFilter(logs: AiDecisionLogRow[], filter: FilterValue): AiDecisionLogRow[] {
  if (filter === "match")    return logs.filter((l) => l.plans_match);
  if (filter === "mismatch") return logs.filter((l) => !l.plans_match);
  return logs;
}

// ── Page ───────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardAIPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);

  // In development, ?tenant=<id> overrides host-based resolution so a developer
  // can view AI decision logs in the context of any registered tenant.
  const { tenantConfig: activeTenantConfig, devTenantOverride } =
    await getActiveTenantWithDevOverride(params, "dashboard/ai");

  // Load tenant AI config in parallel with the decision logs query.
  // This gives operators immediate context: which mode/provider is active,
  // and whether the API key is configured — the same resolution used on homepage.
  // API keys are NEVER surfaced: getTenantAiRuntimeConfig returns hasApiKey: boolean only.
  const [tenantData, result] = await Promise.all([
    getTenantById(activeTenantConfig.tenantId).then((ts) => ({
      tenantId: activeTenantConfig.tenantId,
      aiConfig: getTenantAiRuntimeConfig(ts),
    })),
    getRecentAiDecisionLogs({ limit: PAGE_LIMIT }),
  ]);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader filter={filter} />
        {devTenantOverride && <DevOverrideBanner tenantId={devTenantOverride} />}
        <AiStatusBanner tenantId={tenantData.tenantId} aiConfig={tenantData.aiConfig} />
        <Card padding="md" shadow="none" className="border-red-200 bg-red-50">
          <CardContent>
            <Text variant="body-sm" className="text-red-700">
              <strong>Database error.</strong> {result.error}
            </Text>
            <Text variant="caption" color="muted" className="mt-1">
              Check that the Supabase connection is configured and the{" "}
              <code className="font-mono">ai_decision_logs</code> table exists.
            </Text>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allLogs  = result.data;
  const filtered = applyFilter(allLogs, filter);

  const counts = {
    total:    allLogs.length,
    matches:  allLogs.filter((l) => l.plans_match).length,
    mismatches: allLogs.filter((l) => !l.plans_match).length,
  };

  return (
    <div className="flex flex-col gap-6 px-8 py-8">
      <PageHeader filter={filter} />
      {devTenantOverride && <DevOverrideBanner tenantId={devTenantOverride} />}
      <AiStatusBanner tenantId={tenantData.tenantId} aiConfig={tenantData.aiConfig} />

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <SummaryBlock counts={counts} activeFilter={filter} />

      {/* ── Filtered table ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <Card padding="none" shadow="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-500 whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Session
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Page
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500 whitespace-nowrap">
                    Live provider
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500 whitespace-nowrap">
                    Shadow provider
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Match
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Plans
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <LogRows key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
          {allLogs.length === PAGE_LIMIT && (
            <div className="border-t border-neutral-100 px-4 py-3">
              <Text variant="caption" color="muted">
                Showing up to {PAGE_LIMIT} recent decisions. Older rows may
                exist in the database.
              </Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── AI Status Banner ───────────────────────────────────────────────────────────
//
// Compact strip showing the current tenant's AI mode, active provider, and
// a warning if the API key is missing.  Resolved from TenantSettings (admin-UI
// config) — env vars are the fallback.  API keys are never displayed.

function AiStatusBanner({
  tenantId,
  aiConfig,
}: {
  tenantId: string;
  aiConfig: AiRuntimeConfig;
}) {
  const modeVariant =
    aiConfig.mode === "live"     ? "primary"  :
    aiConfig.mode === "shadow"   ? "warning"  : "outline";

  const activeProvider =
    aiConfig.mode === "live"   ? aiConfig.liveProvider   :
    aiConfig.mode === "shadow" ? aiConfig.shadowProvider : null;

  const keyMissing = activeProvider !== null && !activeProvider.hasApiKey;

  return (
    <div className={[
      "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm",
      keyMissing
        ? "border-error-200 bg-error-50"
        : "border-neutral-200 bg-neutral-50",
    ].join(" ")}>
      {/* Tenant */}
      <span className="text-xs text-neutral-400 font-mono">{tenantId}</span>

      <span className="text-neutral-300" aria-hidden>|</span>

      {/* Mode */}
      <span className="flex items-center gap-1.5">
        <span className="text-xs text-neutral-500">AI mode</span>
        <Badge variant={modeVariant} size="sm" dot>{aiConfig.mode}</Badge>
      </span>

      {/* Active provider */}
      {activeProvider && (
        <>
          <span className="text-neutral-300" aria-hidden>|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">provider</span>
            <Badge variant="default" size="sm">{activeProvider.name}</Badge>
            <span className="font-mono text-xs text-neutral-400">{activeProvider.modelId}</span>
          </span>
        </>
      )}

      {/* Confidence threshold */}
      {aiConfig.mode !== "disabled" && (
        <>
          <span className="text-neutral-300" aria-hidden>|</span>
          <span className="text-xs text-neutral-500">
            threshold{" "}
            <span className="font-mono text-neutral-700">
              {(aiConfig.confidenceThreshold * 100).toFixed(0)}%
            </span>
          </span>
        </>
      )}

      {/* API key warning */}
      {keyMissing && (
        <>
          <span className="text-neutral-300" aria-hidden>|</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-error-700">
            <span aria-hidden>⚠</span> API key missing — AI will use DisabledAiProvider
          </span>
        </>
      )}

      {/* Link to tenant admin */}
      <span className="ml-auto text-xs">
        <Link
          href="/dashboard/tenant"
          className="text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline"
        >
          Configure →
        </Link>
      </span>
    </div>
  );
}

// ── Summary block ──────────────────────────────────────────────────────────────

interface Counts {
  total: number;
  matches: number;
  mismatches: number;
}

function SummaryBlock({
  counts,
  activeFilter,
}: {
  counts: Counts;
  activeFilter: FilterValue;
}) {
  const agreementPct =
    counts.total > 0
      ? Math.round((counts.matches / counts.total) * 100)
      : null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        href="/dashboard/ai"
        label="Total logged"
        value={counts.total}
        subtext={
          agreementPct !== null
            ? `${agreementPct}% agreement rate`
            : "No data yet"
        }
        active={activeFilter === "all"}
        accent="neutral"
      />
      <StatCard
        href="/dashboard/ai?filter=match"
        label="Matching"
        value={counts.matches}
        subtext="Live and shadow agreed"
        active={activeFilter === "match"}
        accent="green"
      />
      <StatCard
        href="/dashboard/ai?filter=mismatch"
        label="Different"
        value={counts.mismatches}
        subtext="Plans diverged"
        active={activeFilter === "mismatch"}
        accent="amber"
      />
    </div>
  );
}

type StatAccent = "neutral" | "green" | "amber";

const ACCENT_NUMBER_CLS: Record<StatAccent, string> = {
  neutral: "text-neutral-900",
  green:   "text-emerald-700",
  amber:   "text-amber-700",
};

const ACCENT_BORDER_CLS: Record<StatAccent, string> = {
  neutral: "border-neutral-200",
  green:   "border-emerald-200",
  amber:   "border-amber-200",
};

const ACCENT_ACTIVE_BG_CLS: Record<StatAccent, string> = {
  neutral: "bg-white ring-1 ring-neutral-300",
  green:   "bg-emerald-50 ring-1 ring-emerald-300",
  amber:   "bg-amber-50 ring-1 ring-amber-300",
};

function StatCard({
  href,
  label,
  value,
  subtext,
  active,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  subtext: string;
  active: boolean;
  accent: StatAccent;
}) {
  const borderCls  = ACCENT_BORDER_CLS[accent];
  const activeCls  = active ? ACCENT_ACTIVE_BG_CLS[accent] : "bg-white hover:bg-neutral-50/80";
  const numberCls  = active ? ACCENT_NUMBER_CLS[accent] : "text-neutral-700";

  return (
    <a
      href={href}
      className={`flex flex-col gap-1 rounded-lg border p-4 transition-colors ${borderCls} ${activeCls}`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className={`text-3xl font-bold tabular-nums leading-none ${numberCls}`}>
        {value}
      </span>
      <span className="mt-0.5 text-xs text-neutral-400">{subtext}</span>
    </a>
  );
}

// ── Table rows (summary + expandable plan comparison) ─────────────────────────

function LogRows({ log }: { log: AiDecisionLogRow }) {
  const { live_plan, shadow_plan } = log;

  const heroDiffers  = live_plan.heroKey  !== shadow_plan.heroKey;
  const proofDiffers = live_plan.proofKey !== shadow_plan.proofKey;
  const ctaDiffers   = live_plan.ctaKey   !== shadow_plan.ctaKey;
  const anyDiffers   = heroDiffers || proofDiffers || ctaDiffers;

  return (
    <>
      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors align-middle">
        <td className="px-4 py-3 text-xs text-neutral-500 tabular-nums whitespace-nowrap">
          <time dateTime={log.created_at}>{formatDate(log.created_at)}</time>
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/dashboard/sessions/${log.session_id}`}
            className="font-mono text-xs text-brand-600 hover:text-brand-800 hover:underline"
            title={log.session_id}
          >
            {log.session_id.slice(0, 8)}&hellip;
          </Link>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-neutral-600">
          {log.page_type}
        </td>
        <td className="px-4 py-3">
          <ProviderBadge provider={log.live_provider} />
        </td>
        <td className="px-4 py-3">
          <ProviderBadge provider={log.shadow_provider} />
        </td>
        <td className="px-4 py-3">
          <Badge variant={log.plans_match ? "success" : "warning"} size="sm">
            {log.plans_match ? "✓ match" : "✗ diff"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <span className="flex flex-wrap gap-1">
            <VariantChip value={live_plan.heroKey}  slot="hero"  differs={heroDiffers} />
            <VariantChip value={live_plan.proofKey} slot="proof" differs={proofDiffers} />
            <VariantChip value={live_plan.ctaKey}   slot="cta"   differs={ctaDiffers} />
          </span>
        </td>
      </tr>

      {/* ── Plan comparison expansion row ───────────────────────────────── */}
      <tr className="border-b border-neutral-100 bg-neutral-50/60">
        <td colSpan={7} className="px-4 pb-0 pt-0">
          <details className="group">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg
                className="size-3 transition-transform group-open:rotate-90"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {anyDiffers ? (
                <span className="text-amber-600 font-medium">
                  Plans differ — expand to compare
                </span>
              ) : (
                <span>Plans match — expand to inspect</span>
              )}
            </summary>
            <PlanComparison
              log={log}
              heroDiffers={heroDiffers}
              proofDiffers={proofDiffers}
              ctaDiffers={ctaDiffers}
            />
          </details>
        </td>
      </tr>
    </>
  );
}

// ── Plan comparison panel ──────────────────────────────────────────────────────

interface PlanComparisonProps {
  log: AiDecisionLogRow;
  heroDiffers: boolean;
  proofDiffers: boolean;
  ctaDiffers: boolean;
}

function PlanComparison({ log, heroDiffers, proofDiffers, ctaDiffers }: PlanComparisonProps) {
  return (
    <div className="mb-3 mt-1 grid grid-cols-2 gap-3">
      <PlanColumn
        title="Live plan"
        provider={log.live_provider}
        plan={log.live_plan}
        heroDiffers={heroDiffers}
        proofDiffers={proofDiffers}
        ctaDiffers={ctaDiffers}
        side="live"
      />
      <PlanColumn
        title="Shadow plan"
        provider={log.shadow_provider}
        plan={log.shadow_plan}
        heroDiffers={heroDiffers}
        proofDiffers={proofDiffers}
        ctaDiffers={ctaDiffers}
        side="shadow"
      />
    </div>
  );
}

interface PlanColumnProps {
  title: string;
  provider: string;
  plan: AiPlanSnapshot;
  heroDiffers: boolean;
  proofDiffers: boolean;
  ctaDiffers: boolean;
  side: "live" | "shadow";
}

function PlanColumn({
  title, provider, plan,
  heroDiffers, proofDiffers, ctaDiffers,
  side,
}: PlanColumnProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-700">{title}</span>
        <ProviderBadge provider={provider} />
      </div>
      <div className="flex flex-col gap-1">
        <PlanKeyRow slot="hero"  label="Hero"  value={plan.heroKey}  differs={heroDiffers} />
        <PlanKeyRow slot="proof" label="Proof" value={plan.proofKey} differs={proofDiffers} />
        <PlanKeyRow slot="cta"   label="CTA"   value={plan.ctaKey}   differs={ctaDiffers} />
      </div>
      {side === "shadow" && <ShadowMeta plan={plan} />}
      {plan.reason && (
        <p className="mt-2.5 border-t border-neutral-100 pt-2 text-[11px] leading-relaxed text-neutral-500 italic">
          {plan.reason}
        </p>
      )}
    </div>
  );
}

interface PlanKeyRowProps {
  slot: "hero" | "proof" | "cta";
  label: string;
  value: string;
  differs: boolean;
}

const SLOT_CHIP_CLS: Record<"hero" | "proof" | "cta", string> = {
  hero:  "bg-violet-50 text-violet-700 border-violet-100",
  proof: "bg-sky-50    text-sky-700    border-sky-100",
  cta:   "bg-amber-50  text-amber-700  border-amber-100",
};

const SLOT_DIFF_CLS: Record<"hero" | "proof" | "cta", string> = {
  hero:  "bg-amber-50 border-amber-200 text-amber-800",
  proof: "bg-amber-50 border-amber-200 text-amber-800",
  cta:   "bg-amber-50 border-amber-200 text-amber-800",
};

function PlanKeyRow({ slot, label, value, differs }: PlanKeyRowProps) {
  const chipCls = differs ? SLOT_DIFF_CLS[slot] : SLOT_CHIP_CLS[slot];
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${chipCls}`}>
        {differs && (
          <svg
            className="size-2.5 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-label="differs"
          >
            <path d="M8 3v10M3 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {value}
      </span>
    </div>
  );
}

function ShadowMeta({ plan }: { plan: AiPlanSnapshot }) {
  const hasAnyMeta =
    plan.confidence    != null ||
    plan.policyVerdict != null ||
    plan.latencyMs     != null ||
    plan.modelId       != null;

  if (!hasAnyMeta) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-100 pt-2">
      {plan.confidence != null && (
        <MetaItem label="Confidence" value={`${Math.round(plan.confidence * 100)}%`} highlight={plan.confidence < 0.5} />
      )}
      {plan.policyVerdict != null && (
        <MetaItem label="Verdict" value={plan.policyVerdict} highlight={plan.policyVerdict !== "ACCEPTED"} />
      )}
      {plan.latencyMs != null && (
        <MetaItem label="Latency" value={`${plan.latencyMs} ms`} highlight={plan.latencyMs > 1000} />
      )}
      {plan.modelId != null && (
        <MetaItem label="Model" value={plan.modelId} />
      )}
    </div>
  );
}

function MetaItem({
  label, value, highlight = false,
}: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className={`text-[11px] font-semibold tabular-nums ${highlight ? "text-amber-700" : "text-neutral-700"}`}>
        {value}
      </span>
    </span>
  );
}

// ── Dev override banner ────────────────────────────────────────────────────────

function DevOverrideBanner({ tenantId }: { tenantId: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Dev override active.</strong> Showing AI config for tenant{" "}
      <code className="font-mono font-semibold">{tenantId}</code> via{" "}
      <code className="font-mono">?tenant=</code> query param. This override is ignored in production.{" "}
      <span className="text-amber-600">
        Bookmark:{" "}
        <code className="font-mono text-xs">/dashboard/ai?tenant={tenantId}</code>
      </span>
    </div>
  );
}

// ── Page-level sub-components ──────────────────────────────────────────────────

/**
 * Page title + filter tab bar.
 * The subtitle is driven by the active filter rather than a count (counts live
 * in SummaryBlock now).
 */
function PageHeader({ filter }: { filter: FilterValue }) {
  const subtitle =
    filter === "match"
      ? "Showing decisions where live and shadow plans agreed."
      : filter === "mismatch"
        ? "Showing decisions where live and shadow plans differed."
        : "All recent AI decision logs, newest first.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text variant="h2" as="h1">
            AI Decisions
          </Text>
          <Text variant="body-sm" color="muted">
            {subtitle}
          </Text>
        </div>

        <Link
          href="/dashboard/ai"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
        >
          <svg
            className="size-3.5 text-neutral-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" strokeLinecap="round" />
            <path d="M10.5 4.5 13.5 4.7 13.3 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh
        </Link>
      </div>

      <FilterTabs active={filter} />
    </div>
  );
}

// ── Filter tabs ────────────────────────────────────────────────────────────────

const FILTER_TABS: { value: FilterValue; label: string; href: string }[] = [
  { value: "all",      label: "All",         href: "/dashboard/ai" },
  { value: "match",    label: "✓ Matching",  href: "/dashboard/ai?filter=match" },
  { value: "mismatch", label: "✗ Different", href: "/dashboard/ai?filter=mismatch" },
];

function FilterTabs({ active }: { active: FilterValue }) {
  return (
    <div
      role="tablist"
      aria-label="Filter AI decisions"
      className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 w-fit"
    >
      {FILTER_TABS.map(({ value, label, href }) => {
        const isActive = active === value;
        return (
          <a
            key={value}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-white text-neutral-900 shadow-sm border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60"
            }`}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterValue }) {
  const message =
    filter === "match"
      ? "No matching decisions found."
      : filter === "mismatch"
        ? "No mismatching decisions found."
        : "No AI decision logs yet.";

  const hint =
    filter === "all"
      ? "Logs appear here once the AI provider runs on an incoming visit."
      : filter === "match"
        ? "All recent decisions show disagreement — or no decisions have been recorded yet."
        : "All recent decisions show agreement between live and shadow plans.";

  return (
    <Card padding="lg" shadow="none" className="border-dashed">
      <CardContent className="py-12 text-center">
        <svg
          className="mx-auto size-10 text-neutral-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Text variant="body-sm" color="muted" className="mt-4">{message}</Text>
        <Text variant="caption" color="muted" className="mt-1 max-w-xs mx-auto">{hint}</Text>
        {filter !== "all" && (
          <Link
            href="/dashboard/ai"
            className="mt-4 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 hover:underline"
          >
            ← View all decisions
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared atoms ───────────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  const isAi = provider.startsWith("ai:");
  return (
    <Badge variant={isAi ? "primary" : "outline"} size="sm">
      {provider}
    </Badge>
  );
}

function VariantChip({
  value, slot, differs,
}: { value: string; slot: "hero" | "proof" | "cta"; differs: boolean }) {
  const cls = differs ? SLOT_DIFF_CLS[slot] : SLOT_CHIP_CLS[slot];
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>
      {value}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
