/**
 * PackageSummaryCard
 *
 * Operational summary of a commercial package tier, designed for admin
 * operators who need to understand what a package includes at a glance.
 *
 * ─── What it shows ────────────────────────────────────────────────────────────
 *
 *   Header       Package label + badge + indicative price
 *   Description  One-sentence positioning statement
 *   Recommended  Who the package is designed for
 *   Highlights   Key selling points from the package definition (salesHighlights)
 *   Features     Experiments / AI / Analytics as enabled / disabled chips
 *   Limits       Sites, concurrent experiments, variants per slot
 *
 * ─── Data source ──────────────────────────────────────────────────────────────
 *
 *   All values are derived from `getPackageOption(packageKey)` — a pre-formatted
 *   projection of the canonical `PackageDefinition`.  No inline mapping needed;
 *   edit tenant/packages.ts to change copy or values.
 *
 * ─── Server-safe ──────────────────────────────────────────────────────────────
 *
 *   No "use client" directive, no hooks, no event handlers.
 *   Safe to render as a Server Component or inside a Client Component tree.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { PackageSummaryCard } from "@/components/admin/PackageSummaryCard";
 *
 *   <PackageSummaryCard packageKey="growth" />
 *   <PackageSummaryCard packageKey={tenant.packageKey} className="mb-6" />
 */

import { getPackageOption }  from "@/tenant";
import { Badge }             from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { cn }                from "@/lib/utils";
import type { PackageKey }   from "@/tenant";

// ── Badge variant per tier ────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function tierBadgeVariant(key: PackageKey): BadgeVariant {
  switch (key) {
    case "starter": return "default";
    case "growth":  return "primary";
    case "pro":     return "success";
  }
}

// ── Limit formatter ───────────────────────────────────────────────────────────

function fmtLimit(n: number, zeroLabel = "None"): string {
  if (n === Infinity) return "Unlimited";
  if (n === 0)        return zeroLabel;
  return `Up to ${n}`;
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

/**
 * Feature availability chip — green when enabled, struck-through neutral when not.
 * Used to show at a glance which platform features the package unlocks.
 */
function FeatureChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        enabled
          ? "bg-success-50 text-success-700"
          : "bg-neutral-100 text-neutral-400 line-through",
      )}
    >
      <span aria-hidden>{enabled ? "✓" : "—"}</span>
      {label}
    </span>
  );
}

/**
 * Operational limit chip — displays a labelled value in a small bordered tile.
 * Used to show site, experiment, and variant limits at a glance.
 */
function LimitChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-w-[4rem] flex-col items-center rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-center">
      <span className="text-xs font-semibold tabular-nums text-neutral-800">{value}</span>
      <span className="text-[10px] leading-tight text-neutral-400">{label}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface PackageSummaryCardProps {
  /** The package tier to summarise. */
  packageKey: PackageKey;
  /** Optional extra CSS classes applied to the outer Card. */
  className?: string;
}

/**
 * A self-contained package summary card for admin operators.
 *
 * Renders highlights (salesHighlights from the package definition), feature
 * availability chips, and limit tiles — plus price context and the "ideal
 * buyer" description from the package's commercial metadata.
 *
 * @example
 *   <PackageSummaryCard packageKey="growth" />
 */
export function PackageSummaryCard({ packageKey, className }: PackageSummaryCardProps) {
  const opt = getPackageOption(packageKey);

  return (
    <Card padding="md" shadow="sm" className={className}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-800">{opt.label}</span>
        <Badge variant={tierBadgeVariant(packageKey)} size="sm">
          {opt.label}
        </Badge>
        <span className="ml-auto text-xs text-neutral-400">
          {opt.isContactSales
            ? "Contact us"
            : opt.monthlyPriceLabel}
          {!opt.isContactSales && opt.annualPriceLabel && (
            <span className="ml-1 text-neutral-300">
              · {opt.annualPriceLabel} billed annually
            </span>
          )}
        </span>
      </div>

      {/* ── Description ─────────────────────────────────────────────────────── */}
      <p className="mb-1 text-xs italic text-neutral-500">{opt.shortDescription}</p>
      <p className="mb-4 text-xs text-neutral-400">{opt.recommendedFor}</p>

      <CardContent>

        {/* ── Highlights ────────────────────────────────────────────────────── */}
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          What&apos;s included
        </p>
        <ul className="mb-4 space-y-1">
          {opt.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-700">
              <span className="mt-px shrink-0 text-success-500" aria-hidden>✓</span>
              {h}
            </li>
          ))}
        </ul>

        {/* ── Feature availability ──────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FeatureChip label="A/B experiments" enabled={opt.features.experiments} />
          <FeatureChip label="AI decisions"    enabled={opt.features.ai} />
          <FeatureChip label="Analytics"       enabled={opt.features.analytics} />
        </div>

        {/* ── Limits ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <LimitChip
            label="sites"
            value={fmtLimit(opt.limits.maxSites, "1")}
          />
          <LimitChip
            label="experiments"
            value={fmtLimit(opt.limits.maxExperiments, "None")}
          />
          <LimitChip
            label="variants / slot"
            value={fmtLimit(opt.limits.maxVariantsPerSlot)}
          />
        </div>

      </CardContent>
    </Card>
  );
}
