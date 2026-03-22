import {
  fetchVariantPerformance,
  VARIANT_FETCH_LIMIT,
} from "@/data/repositories/analytics-repository";
import type {
  VariantStats,
  VariantSourceBreakdown,
} from "@/data/repositories/analytics-repository";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

/**
 * Variant Performance Page
 *
 * Shows per-key stats for hero, proof, and CTA variants:
 *   serves · CTA clicks · CTR · top sources
 *
 * ─── Attribution model (session-level) ───────────────────────────────────────
 *
 *   "CTA Clicks" for a variant key = sessions that were served that key AND
 *   produced ≥1 "cta_click" event at any point in their lifetime.
 *
 *   This is NOT element-level click attribution. We don't track which specific
 *   CTA button was clicked — only that a session that saw the variant clicked
 *   something. For proof variants this is especially indirect.
 *
 *   This assumption is noted on the page so readers don't over-interpret CTR.
 *
 * Server Component — data fetched at request time.
 */
export const metadata = { title: "Variants · Dashboard" };

export default async function DashboardVariantsPage() {
  const result = await fetchVariantPerformance();

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader />
        <Card padding="md" shadow="none" className="border-red-200 bg-red-50">
          <CardContent>
            <Text variant="body-sm" className="text-red-700">
              <strong>Database error.</strong> {result.error}
            </Text>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { heroVariants, proofVariants, ctaVariants, rowsFetched } = result.data;
  const totalVariants =
    heroVariants.length + proofVariants.length + ctaVariants.length;

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      <PageHeader />

      {/* Attribution notice */}
      <AttributionNotice />

      {/* Truncation warning */}
      {rowsFetched >= VARIANT_FETCH_LIMIT && (
        <Card padding="md" shadow="none" className="border-amber-200 bg-amber-50">
          <CardContent>
            <Text variant="body-sm" className="text-amber-800">
              <strong>Data may be truncated.</strong> The query fetched{" "}
              {VARIANT_FETCH_LIMIT.toLocaleString()} rows (the current limit).
              Stats reflect only the most recent{" "}
              {VARIANT_FETCH_LIMIT.toLocaleString()} sessions. Replace with a
              SQL aggregation query for accurate full-history results.
            </Text>
          </CardContent>
        </Card>
      )}

      {totalVariants === 0 ? (
        <Card padding="lg" shadow="none" className="border-dashed">
          <CardContent className="py-12 text-center">
            <Text variant="body-sm" color="muted">
              No variant data yet. Visit the homepage to generate the first
              session.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <VariantSection
            title="Hero Variants"
            description="Content shown in the above-the-fold hero block."
            variants={heroVariants}
            ctaNote="Direct — session saw this hero and clicked a CTA."
          />
          <VariantSection
            title="Proof Variants"
            description="Social proof / testimonials block shown beneath the hero."
            variants={proofVariants}
            ctaNote="Indirect — session saw this proof block and clicked a CTA elsewhere."
          />
          <VariantSection
            title="CTA Variants"
            description="The primary call-to-action block."
            variants={ctaVariants}
            ctaNote="Direct — session was served this CTA block and clicked it."
          />
        </div>
      )}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-1">
      <Text variant="h2" as="h1">
        Variants
      </Text>
      <Text variant="body-sm" color="muted">
        Per-variant serve counts, CTA click attribution, and traffic source
        breakdown.
      </Text>
    </div>
  );
}

// ── Attribution notice ────────────────────────────────────────────────────────

function AttributionNotice() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sm text-neutral-400" aria-hidden>
          ℹ
        </span>
        <div className="flex flex-col gap-1">
          <Text variant="label" as="p">
            Attribution model: session-level
          </Text>
          <Text variant="body-sm" color="muted">
            "CTA Clicks" counts sessions that were shown a variant{" "}
            <em>and</em> fired a{" "}
            <code className="rounded bg-neutral-100 px-1 font-mono text-xs">
              cta_click
            </code>{" "}
            event at any point. It is not element-level tracking. CTR for proof
            variants is indirect — those blocks contain no CTA themselves.
          </Text>
        </div>
      </div>
    </div>
  );
}

// ── Variant section ───────────────────────────────────────────────────────────

interface VariantSectionProps {
  title: string;
  description: string;
  variants: VariantStats[];
  ctaNote: string;
}

function VariantSection({
  title,
  description,
  variants,
  ctaNote,
}: VariantSectionProps) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex flex-col gap-0.5">
        <Text variant="h4" as="h2">
          {title}
        </Text>
        <Text variant="body-sm" color="muted">
          {description}
        </Text>
      </div>

      {variants.length === 0 ? (
        <Card padding="md" shadow="none" className="border-dashed">
          <CardContent>
            <Text variant="body-sm" color="muted">
              No {title.toLowerCase()} recorded yet.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none" shadow="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Variant key
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500 text-right w-24">
                    Serves
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-neutral-500 text-right w-28"
                    title={ctaNote}
                  >
                    CTA Clicks
                    <span className="ml-1 text-neutral-300 cursor-help" aria-hidden>
                      ⓘ
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500 text-right w-20">
                    CTR
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Top sources
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <VariantRow key={v.key} variant={v} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

// ── Variant table row ─────────────────────────────────────────────────────────

function VariantRow({ variant }: { variant: VariantStats }) {
  const ctrColor =
    variant.ctr >= 20
      ? "text-green-700"
      : variant.ctr >= 10
        ? "text-amber-700"
        : "text-neutral-500";

  return (
    <tr className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Key */}
      <td className="px-4 py-3 max-w-[240px]">
        <span
          className="block truncate font-mono text-xs text-neutral-800"
          title={variant.key}
        >
          {variant.key}
        </span>
      </td>

      {/* Serves */}
      <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
        {variant.serves.toLocaleString()}
      </td>

      {/* CTA clicks */}
      <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
        {variant.ctaClicks.toLocaleString()}
      </td>

      {/* CTR */}
      <td className={`px-4 py-3 text-right tabular-nums font-medium ${ctrColor}`}>
        {variant.serves === 0 ? "—" : `${variant.ctr}%`}
      </td>

      {/* Top sources */}
      <td className="px-4 py-3">
        <SourceBreakdown sources={variant.topSources} total={variant.serves} />
      </td>
    </tr>
  );
}

// ── Source breakdown cell ─────────────────────────────────────────────────────

function SourceBreakdown({
  sources,
  total,
}: {
  sources: VariantSourceBreakdown[];
  total: number;
}) {
  if (sources.length === 0) {
    return <span className="text-xs text-neutral-300">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map(({ source, sessions }) => {
        const pct = total > 0 ? Math.round((sessions / total) * 100) : 0;
        return (
          <span
            key={source}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600"
            title={`${sessions.toLocaleString()} session${sessions === 1 ? "" : "s"}`}
          >
            <SourceDot source={source} />
            {source}
            <span className="text-neutral-400">{pct}%</span>
          </span>
        );
      })}
    </div>
  );
}

function SourceDot({ source }: { source: string }) {
  const colorMap: Record<string, string> = {
    linkedin: "bg-blue-500",
    google:   "bg-amber-500",
    direct:   "bg-neutral-400",
  };
  const color = colorMap[source] ?? "bg-neutral-300";
  return <span className={`size-1.5 shrink-0 rounded-full ${color}`} />;
}
