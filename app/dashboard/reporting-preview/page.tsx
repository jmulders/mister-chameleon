/**
 * Reporting Preview Page — /dashboard/reporting-preview
 *
 * Internal preview of the customer-facing report structure using live platform
 * data. Shows what a monthly report would look like for the active tenant.
 *
 * ─── Data pipeline ────────────────────────────────────────────────────────────
 *
 *   fetchDashboardMetrics()    → DashboardMetrics (overview counts + rankings)
 *   fetchVariantPerformance()  → VariantPerformanceData (per-variant CTR)
 *   assembleReport()           → Report (all six sections, synchronous)
 *
 * ─── Design decisions ─────────────────────────────────────────────────────────
 *
 *   Pure server component — no client JS hydration, no interactivity.
 *   The goal is structural clarity: account managers reading this page should
 *   see exactly what the client will see in a delivered report.
 *
 *   Visual polish is intentionally minimal — this is an internal tool.
 *   The layout prioritises information density and scannability.
 */

import { fetchDashboardMetrics, fetchVariantPerformance } from "@/data/repositories/analytics-repository";
import { assembleReport }                    from "@/reports/templates/default-report";
import { getActiveTenantWithDevOverride }    from "@/tenant/server";
import type {
  Report,
  ReportSummarySection,
  ContextSegmentsSection,
  VariantPerformanceSection,
  ConversionMetricsSection,
  AiRulesInsightsSection,
  RecommendationsSection,
  ReportPeriod,
  VariantPerformanceRow,
  ConversionMetricRow,
  RecommendationRow,
} from "@/reports/types";

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the current calendar month as a ReportPeriod. */
function currentMonthPeriod(): ReportPeriod {
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const start = new Date(Date.UTC(year, month,     1));
  const end   = new Date(Date.UTC(year, month + 1, 0)); // last day of month

  const label = start.toLocaleDateString("en-GB", {
    month: "long",
    year:  "numeric",
    timeZone: "UTC",
  });

  return {
    cadence:   "monthly",
    startDate: start.toISOString().split("T")[0]!,
    endDate:   end.toISOString().split("T")[0]!,
    label,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportingPreviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Resolve the active tenant using the same order as the frontend site.
  // In development, ?tenant=<id> query param or mc_dev_tenant cookie overrides
  // host-based resolution so a developer can preview reports for any tenant.
  const { tenantConfig: tenant, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "dashboard/reporting-preview");

  // Fetch data in parallel — scope event counts to the active tenant.
  const [metricsResult, variantPerfResult] = await Promise.all([
    fetchDashboardMetrics(5, tenant.tenantId),
    fetchVariantPerformance(tenant.tenantId),
  ]);

  // Handle data fetch failures gracefully
  if (!metricsResult.ok) {
    return <ErrorState message={`Failed to load metrics: ${metricsResult.error}`} />;
  }
  if (!variantPerfResult.ok) {
    return <ErrorState message={`Failed to load variant data: ${variantPerfResult.error}`} />;
  }

  const period = currentMonthPeriod();
  const report = assembleReport({
    tenant:     { tenantId: tenant.tenantId, name: tenant.name },

    period,
    metrics:    metricsResult.data,
    variantPerf: variantPerfResult.data,
    preparedBy: "internal preview",
    includeEngineInsights: true,
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">

        {/* Dev override banner — shown in development when a tenant override is active */}
        {devTenantOverride && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Dev override active.</strong> Report showing data for tenant{" "}
            <code className="font-mono font-semibold">{devTenantOverride}</code> via{" "}
            {devOverrideSource === "query-param"
              ? <><code className="font-mono">?tenant=</code> query param</>
              : devOverrideSource === "cookie"
                ? <><code className="font-mono">mc_dev_tenant</code> cookie</>
                : "dev override"
            }.{" "}
            This override is ignored in production.{" "}
            <span className="text-amber-600">
              Bookmark:{" "}
              <code className="font-mono text-xs">
                /dashboard/reporting-preview?tenant={devTenantOverride}
              </code>
            </span>
          </div>
        )}

        {/* Report header */}
        <ReportHeader report={report} />

        {/* Table of contents */}
        <TableOfContents report={report} />

        {/* Section 1 — Executive Summary */}
        {report.sections.summary && (
          <SummarySection data={report.sections.summary} />
        )}

        {/* Section 2 — Context Segments */}
        {report.sections.contextSegments && (
          <ContextSegmentsSection data={report.sections.contextSegments} />
        )}

        {/* Section 3 — Variant Performance */}
        {report.sections.variantPerformance && (
          <VariantPerformanceSection data={report.sections.variantPerformance} />
        )}

        {/* Section 4 — Conversion Metrics */}
        {report.sections.conversionMetrics && (
          <ConversionMetricsSection data={report.sections.conversionMetrics} />
        )}

        {/* Section 5 — Decision Engine Insights */}
        {report.sections.aiRulesInsights && (
          <EngineInsightsSection data={report.sections.aiRulesInsights} />
        )}

        {/* Section 6 — Recommendations */}
        {report.sections.recommendations && (
          <RecommendationsSection
            data={report.sections.recommendations}
            period={report.config.period}
          />
        )}

        {/* Footer */}
        <ReportFooter report={report} />

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="text-sm font-medium text-red-600">Failed to generate report</p>
      <p className="mt-2 text-xs text-neutral-500 font-mono">{message}</p>
    </div>
  );
}

function ReportHeader({ report }: { report: Report }) {
  return (
    <div className="border-b border-neutral-200 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-1">
            Performance Report — Internal Preview
          </p>
          <h1 className="text-2xl font-bold text-neutral-900">
            {report.config.tenantName}
          </h1>
          <p className="mt-1 text-base text-neutral-600">
            {report.config.period.label}
            <span className="mx-2 text-neutral-300">·</span>
            <span className="capitalize">{report.config.period.cadence}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-neutral-400">Report ID</p>
          <p className="mt-0.5 text-xs font-mono text-neutral-600">{report.id}</p>
          <p className="mt-2 text-xs text-neutral-400">Generated</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {new Date(report.generatedAt).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
          {report.config.preparedBy && (
            <>
              <p className="mt-2 text-xs text-neutral-400">Prepared by</p>
              <p className="mt-0.5 text-xs text-neutral-600">{report.config.preparedBy}</p>
            </>
          )}
        </div>
      </div>
      {report.dataWindowNote && (
        <p className="mt-4 text-xs text-neutral-500 bg-neutral-100 rounded px-3 py-2 inline-block">
          {report.dataWindowNote}
        </p>
      )}
    </div>
  );
}

function TableOfContents({ report }: { report: Report }) {
  const SECTION_LABELS: Record<string, string> = {
    "summary":             "1. Executive Summary",
    "context-segments":    "2. Traffic & Context Segments",
    "variant-performance": "3. Variant Performance",
    "conversion-metrics":  "4. Conversion & Engagement Metrics",
    "ai-rules-insights":   "5. Decision Engine Insights",
    "recommendations":     "6. Recommendations & Next Actions",
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        Contents
      </p>
      <ul className="space-y-1">
        {report.config.includeSections.map((id) => (
          <li key={id} className="text-sm text-neutral-700">
            {SECTION_LABELS[id] ?? id}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportFooter({ report }: { report: Report }) {
  return (
    <div className="border-t border-neutral-200 pt-6 text-xs text-neutral-400 space-y-1">
      <p>
        Generated by Mister Chameleon Platform · Template: {report.config.templateId}
      </p>
      <p>
        This is an internal preview. Data is live from the platform database.
        Account managers should review all generated text before sharing with clients.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Shared section wrapper with consistent heading style. */
function Section({
  number,
  title,
  description,
  children,
}: {
  number:      number;
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-bold text-neutral-400 shrink-0">{number}</span>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

// ── 1. Executive Summary ──────────────────────────────────────────────────────

function SummarySection({ data }: { data: ReportSummarySection }) {
  return (
    <Section
      number={1}
      title="Executive Summary"
      description="High-level overview of the period."
    >
      {/* Headline */}
      <p className="text-sm text-neutral-800 leading-relaxed mb-5">{data.headline}</p>

      {/* Top-level metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricTile
          label="Sessions"
          value={data.sessionCount.toLocaleString()}
          sub="total visits"
        />
        <MetricTile
          label="Decisions Served"
          value={data.variantsServed.toLocaleString()}
          sub="adaptive renders"
        />
        <MetricTile
          label="CTA Click Rate"
          value={data.overallCtaClickRate !== null ? `${data.overallCtaClickRate}%` : "—"}
          sub="sessions with click"
          highlight={
            data.overallCtaClickRate !== null
              ? data.overallCtaClickRate >= 5 ? "good"
                : data.overallCtaClickRate >= 2 ? "warning"
                : "critical"
              : undefined
          }
        />
      </div>

      {/* Wins + Focus */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
            Key Wins
          </p>
          <ul className="space-y-1.5">
            {data.keyWins.map((win, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-700">
                <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">
            Focus Areas
          </p>
          <ul className="space-y-1.5">
            {data.focusAreas.map((area, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-700">
                <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.dataQualityNote && (
        <p className="mt-4 text-xs text-neutral-500 border-l-2 border-neutral-200 pl-3">
          {data.dataQualityNote}
        </p>
      )}
    </Section>
  );
}

function MetricTile({
  label,
  value,
  sub,
  highlight,
}: {
  label:     string;
  value:     string;
  sub:       string;
  highlight?: "good" | "warning" | "critical";
}) {
  const borderColor =
    highlight === "good"     ? "border-emerald-200 bg-emerald-50"
    : highlight === "warning"  ? "border-amber-200 bg-amber-50"
    : highlight === "critical" ? "border-red-200 bg-red-50"
    : "border-neutral-200 bg-neutral-50";

  const valueColor =
    highlight === "good"     ? "text-emerald-700"
    : highlight === "warning"  ? "text-amber-700"
    : highlight === "critical" ? "text-red-700"
    : "text-neutral-900";

  return (
    <div className={`rounded-lg border p-4 ${borderColor}`}>
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-xs text-neutral-400 mt-1">{sub}</p>
    </div>
  );
}

// ── 2. Context Segments ───────────────────────────────────────────────────────

function ContextSegmentsSection({ data }: { data: ContextSegmentsSection }) {
  return (
    <Section
      number={2}
      title="Traffic & Context Segments"
      description="Top traffic sources and how the engine served each audience."
    >
      {data.dominantSourceNote && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {data.dominantSourceNote}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <Th>Source</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">Share</Th>
              <Th>Top Hero Variant</Th>
              <Th>Top CTA Variant</Th>
              <Th>Insight</Th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={row.sourceKey} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                <td className="py-2.5 pr-4 font-medium text-neutral-800">
                  {row.sourceLabel}
                </td>
                <Td align="right">{row.sessionCount.toLocaleString()}</Td>
                <Td align="right">
                  <ShareBar value={row.sessionShare} />
                </Td>
                <Td>
                  <VariantKeyPill value={row.topHeroVariant} type="hero" />
                </Td>
                <Td>
                  <VariantKeyPill value={row.topCtaVariant} type="cta" />
                </Td>
                <td className="py-2.5 text-xs text-neutral-500 max-w-xs">
                  {row.insight ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Total sessions: {data.totalSessions.toLocaleString()}.
        Source matching is approximate — derived from variant serve data.
      </p>
    </Section>
  );
}

// ── 3. Variant Performance ────────────────────────────────────────────────────

function VariantPerformanceSection({ data }: { data: VariantPerformanceSection }) {
  return (
    <Section
      number={3}
      title="Variant Performance"
      description="Per-slot rankings by CTA click rate. Top performer highlighted."
    >
      {data.concentrationNote && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {data.concentrationNote}
        </div>
      )}

      <div className="space-y-6">
        {data.heroRows.length > 0 && (
          <VariantSlotTable
            title="Hero Variants"
            description="Headline + subheadline variants served in the hero block."
            rows={data.heroRows}
          />
        )}
        {data.proofRows.length > 0 && (
          <VariantSlotTable
            title="Proof / Social Proof Variants"
            description="Evidence and trust-signal variants shown in the proof block."
            rows={data.proofRows}
          />
        )}
        {data.ctaRows.length > 0 && (
          <VariantSlotTable
            title="CTA Variants"
            description="Call-to-action variants shown in the CTA block and hero button."
            rows={data.ctaRows}
          />
        )}
        {data.heroRows.length === 0 &&
         data.proofRows.length === 0 &&
         data.ctaRows.length === 0 && (
          <p className="text-sm text-neutral-500">No variant data available for this period.</p>
        )}
      </div>

      {data.dataTruncated && (
        <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Data truncated — the query row limit was reached. Serves and CTRs may not represent
          the full period. Consider adding a date-range filter to the analytics repository.
        </p>
      )}
    </Section>
  );
}

function VariantSlotTable({
  title,
  description,
  rows,
}: {
  title:       string;
  description: string;
  rows:        VariantPerformanceRow[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-700 mb-0.5">{title}</p>
      <p className="text-xs text-neutral-400 mb-2">{description}</p>
      <div className="overflow-x-auto rounded border border-neutral-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <Th>Variant Key</Th>
              <Th align="right">Serves</Th>
              <Th align="right">Share</Th>
              <Th align="right">CTA Click Rate</Th>
              <Th>Top Source</Th>
              <Th align="center">Winner</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.variantKey}
                className={
                  row.isTopPerformer
                    ? "bg-emerald-50"
                    : i % 2 === 0 ? "bg-white" : "bg-neutral-50"
                }
              >
                <td className="py-2.5 pr-4">
                  <span className="font-mono text-xs text-neutral-700">{row.variantKey}</span>
                </td>
                <Td align="right">{row.serves.toLocaleString()}</Td>
                <Td align="right">{row.serveSharePct.toFixed(1)}%</Td>
                <Td align="right">
                  <CtrBadge value={row.ctaClickRate} />
                </Td>
                <td className="py-2.5 pr-4 text-xs text-neutral-500 capitalize">
                  {row.topSource}
                </td>
                <td className="py-2.5 text-center">
                  {row.isTopPerformer && (
                    <span className="text-emerald-600 text-sm">★</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 4. Conversion Metrics ─────────────────────────────────────────────────────

function ConversionMetricsSection({ data }: { data: ConversionMetricsSection }) {
  return (
    <Section
      number={4}
      title="Conversion & Engagement Metrics"
      description="KPI-aligned outcomes for the period."
    >
      {data.coverageNote && (
        <p className="mb-4 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
          {data.coverageNote}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <Th>KPI</Th>
              <Th align="right">Value</Th>
              <Th align="center">Status</Th>
              <Th align="right">vs. Prior Period</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((metric, i) => (
              <ConversionMetricRowComponent
                key={metric.kpiId}
                metric={metric}
                isEven={i % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ConversionMetricRowComponent({
  metric,
  isEven,
}: {
  metric: ConversionMetricRow;
  isEven: boolean;
}) {
  const formattedValue =
    metric.value === null
      ? "—"
      : metric.format === "percentage"
      ? `${metric.value.toFixed(1)}%`
      : metric.format === "score"
      ? metric.value.toFixed(2)
      : metric.value.toLocaleString();

  const trend =
    metric.trendPct !== undefined
      ? metric.trendPct >= 0
        ? `↑ ${Math.abs(metric.trendPct).toFixed(1)}%`
        : `↓ ${Math.abs(metric.trendPct).toFixed(1)}%`
      : metric.previousPeriodValue !== undefined
      ? `was ${metric.previousPeriodValue}`
      : "—";

  const trendColor =
    metric.trendPct !== undefined
      ? metric.trendPct >= 0
        ? "text-emerald-600"
        : "text-red-600"
      : "text-neutral-400";

  return (
    <tr className={isEven ? "bg-white" : "bg-neutral-50"}>
      <td className="py-2.5 pr-4 font-medium text-neutral-800">{metric.label}</td>
      <td className="py-2.5 pr-4 text-right font-tabular font-medium text-neutral-900">
        {formattedValue}
      </td>
      <td className="py-2.5 pr-4 text-center">
        <HealthBadge status={metric.healthStatus} nullLabel={metric.value === null ? "no data" : undefined} />
      </td>
      <td className={`py-2.5 pr-4 text-right text-xs font-medium ${trendColor}`}>
        {trend}
      </td>
      <td className="py-2.5 text-xs text-neutral-400 max-w-xs">{metric.note ?? "—"}</td>
    </tr>
  );
}

// ── 5. Decision Engine Insights ───────────────────────────────────────────────

function EngineInsightsSection({ data }: { data: AiRulesInsightsSection }) {
  return (
    <Section
      number={5}
      title="Decision Engine Insights"
      description="How the adaptive engine distributed decisions across rules and variants."
    >
      {/* Engine summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricTile
          label="Total Decisions"
          value={data.totalDecisions.toLocaleString()}
          sub="variant decisions served"
        />
        <MetricTile
          label="Engine Type"
          value={data.activeEngine.toUpperCase()}
          sub="active provider"
        />
        {data.aiCoverageRate !== undefined && (
          <MetricTile
            label="AI Coverage"
            value={data.aiCoverageRate !== null ? `${data.aiCoverageRate.toFixed(1)}%` : "—"}
            sub="decisions via AI provider"
          />
        )}
      </div>

      {/* Rule fire breakdown */}
      {data.ruleFiredRows.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Rule / Decision Breakdown
          </p>
          <div className="overflow-x-auto rounded border border-neutral-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <Th>Rule / Decision Path</Th>
                  <Th align="right">Fires</Th>
                  <Th align="right">Share</Th>
                  <Th align="right">Assoc. CTA CTR</Th>
                </tr>
              </thead>
              <tbody>
                {data.ruleFiredRows.map((rule, i) => (
                  <tr key={rule.ruleId} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-neutral-800">{rule.ruleLabel}</p>
                      <p className="text-xs text-neutral-400 font-mono">{rule.ruleId}</p>
                    </td>
                    <Td align="right">{rule.firedCount.toLocaleString()}</Td>
                    <Td align="right">{rule.shareOfDecisions.toFixed(1)}%</Td>
                    <Td align="right">
                      {rule.associatedCtaClickRate !== undefined
                        ? <CtrBadge value={rule.associatedCtaClickRate} />
                        : <span className="text-neutral-400">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Rule attribution is inferred from variant serve data. For precise rule-level
            tracking, add a rule_id column to served_variants.
          </p>
        </div>
      )}

      {/* Narrative */}
      <div className="prose prose-sm prose-neutral max-w-none">
        {data.engineNarrative.split("\n\n").map((para, i) => (
          <p key={i} className="text-sm text-neutral-700 leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    </Section>
  );
}

// ── 6. Recommendations ────────────────────────────────────────────────────────

function RecommendationsSection({
  data,
  period,
}: {
  data:   RecommendationsSection;
  period: ReportPeriod;
}) {
  const highPriority   = data.items.filter((r) => r.priority === "high");
  const medPriority    = data.items.filter((r) => r.priority === "medium");
  const lowPriority    = data.items.filter((r) => r.priority === "low");

  return (
    <Section
      number={6}
      title="Recommendations & Next Actions"
      description="Prioritised actions for the coming period."
    >
      {/* Priority breakdown header */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <PriorityTile priority="high"   count={highPriority.length} />
        <PriorityTile priority="medium" count={medPriority.length} />
        <PriorityTile priority="low"    count={lowPriority.length} />
      </div>

      {/* Recommendation cards */}
      <div className="space-y-3">
        {data.items.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
        <span>
          {data.items.length} recommendation{data.items.length !== 1 ? "s" : ""} for {period.label}
        </span>
        {data.nextReviewDate && (
          <span>
            Next review:{" "}
            <span className="font-medium text-neutral-600">
              {new Date(data.nextReviewDate).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </span>
          </span>
        )}
      </div>
    </Section>
  );
}

function PriorityTile({ priority, count }: { priority: "high" | "medium" | "low"; count: number }) {
  const styles = {
    high:   "border-red-200 bg-red-50 text-red-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low:    "border-neutral-200 bg-neutral-50 text-neutral-600",
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${styles[priority]}`}>
      <p className="text-xl font-bold tabular-nums">{count}</p>
      <p className="text-xs capitalize mt-0.5">{priority} priority</p>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: RecommendationRow }) {
  const priorityBorder = {
    high:   "border-l-red-400",
    medium: "border-l-amber-400",
    low:    "border-l-neutral-300",
  };
  const priorityBadge = {
    high:   "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low:    "bg-neutral-100 text-neutral-600",
  };
  const ownerBadge = {
    "client":            "bg-blue-100 text-blue-700",
    "mister-chameleon":  "bg-purple-100 text-purple-700",
    "shared":            "bg-teal-100 text-teal-700",
  };
  const categoryLabel: Record<string, string> = {
    content: "Content", rules: "Rules", tracking: "Tracking",
    configuration: "Config", strategy: "Strategy",
  };

  return (
    <div className={`border border-l-4 ${priorityBorder[rec.priority]} border-neutral-200 rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded capitalize ${priorityBadge[rec.priority]}`}>
              {rec.priority}
            </span>
            <span className="text-xs text-neutral-400">
              {categoryLabel[rec.category] ?? rec.category}
            </span>
            <span className="text-xs text-neutral-300">·</span>
            <span className="text-xs font-mono text-neutral-400">{rec.id}</span>
          </div>
          <p className="font-medium text-neutral-900 text-sm">{rec.title}</p>
          <p className="mt-1 text-xs text-neutral-600 leading-relaxed">{rec.rationale}</p>
          <div className="mt-2 bg-neutral-50 rounded px-3 py-2">
            <p className="text-xs text-neutral-500 font-semibold mb-0.5">Suggested action</p>
            <p className="text-xs text-neutral-700 leading-relaxed">{rec.suggestedAction}</p>
          </div>
          {rec.relatedKpiId && (
            <p className="mt-2 text-xs text-neutral-400">
              KPI: <span className="font-mono">{rec.relatedKpiId}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right space-y-1">
          <span className={`text-xs font-medium px-2 py-1 rounded block ${ownerBadge[rec.owner]}`}>
            {rec.owner === "mister-chameleon" ? "MC" : rec.owner}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 ${alignClass}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td className={`py-2.5 pr-4 text-sm text-neutral-700 ${alignClass}`}>{children}</td>
  );
}

function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-neutral-600 w-9 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function VariantKeyPill({ value, type }: { value: string; type: "hero" | "proof" | "cta" }) {
  const color = {
    hero:  "bg-violet-50 text-violet-700",
    proof: "bg-sky-50 text-sky-700",
    cta:   "bg-emerald-50 text-emerald-700",
  };
  if (value === "—") return <span className="text-neutral-300 text-xs">—</span>;
  return (
    <span className={`inline-block font-mono text-xs px-1.5 py-0.5 rounded ${color[type]}`}>
      {value}
    </span>
  );
}

function CtrBadge({ value }: { value: number }) {
  const color =
    value >= 10  ? "text-emerald-700 font-semibold"
    : value >= 5   ? "text-emerald-600"
    : value >= 2   ? "text-amber-600"
    : "text-red-500";
  return <span className={`text-sm tabular-nums ${color}`}>{value.toFixed(1)}%</span>;
}

function HealthBadge({
  status,
  nullLabel,
}: {
  status?:   "good" | "warning" | "critical";
  nullLabel?: string;
}) {
  if (!status) {
    return (
      <span className="inline-block text-xs text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
        {nullLabel ?? "—"}
      </span>
    );
  }
  const styles = {
    good:     "bg-emerald-100 text-emerald-700",
    warning:  "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
