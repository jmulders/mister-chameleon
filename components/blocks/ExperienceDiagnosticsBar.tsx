/**
 * ExperienceDiagnosticsBar
 *
 * A subtle developer-only overlay that shows which experience was composed
 * for the current request. Rendered at the bottom of the page in development.
 * Stripped from production builds via a NODE_ENV guard at the call site.
 *
 * Usage (in page.tsx):
 *
 *   {process.env.NODE_ENV === "development" && (
 *     <ExperienceDiagnosticsBar
 *       source={context.source}
 *       heroKey={experience.plan.heroKey}
 *       proofKey={experience.plan.proofKey}
 *       ctaKey={experience.plan.ctaKey}
 *       usedFallback={meta.usedFallback}
 *       reason={experience.plan.reason}
 *       ruleId={experience.plan.ruleId}
 *       ruleLabel={experience.plan.ruleLabel}
 *     />
 *   )}
 *
 * This component contains no business logic and has no effect on page content.
 */

export interface ExperienceDiagnosticsBarProps {
  /** Detected traffic source */
  source: string;
  /** Resolved hero variant key */
  heroKey: string;
  /** Resolved proof variant key */
  proofKey: string;
  /** Resolved CTA variant key */
  ctaKey: string;
  /** Whether the fallback plan was substituted */
  usedFallback: boolean;
  /** Human-readable reason string from the decision engine */
  reason: string;
  /**
   * ID of the matched rule, if any.
   * Present when a rule fired; absent when the default plan was used.
   */
  ruleId?: string;
  /**
   * Human-readable label of the matched rule, if any.
   * Shown in the bar alongside ruleId for quick identification.
   */
  ruleLabel?: string;
}

export function ExperienceDiagnosticsBar({
  source,
  heroKey,
  proofKey,
  ctaKey,
  usedFallback,
  reason,
  ruleId,
  ruleLabel,
}: ExperienceDiagnosticsBarProps) {
  return (
    <aside
      aria-label="Experience diagnostics (dev only)"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        {/* DEV badge */}
        <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-400">
          DEV
        </span>

        {/* Key-value pairs */}
        <DiagField label="source" value={source} />
        <DiagField label="hero" value={heroKey} />
        <DiagField label="proof" value={proofKey} />
        <DiagField label="cta" value={ctaKey} />

        {/* Fallback indicator */}
        {usedFallback && (
          <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-red-400">
            FALLBACK
          </span>
        )}

        {/* Matched rule identity — shown when a rule fired */}
        {ruleId && (
          <span
            className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-400"
            title={ruleLabel ?? ruleId}
          >
            {ruleId}
          </span>
        )}

        {/* Rule reason / label — truncated, right-aligned */}
        <span
          className="ml-auto truncate font-mono text-xs text-neutral-500"
          title={ruleLabel ? `${ruleLabel} — ${reason}` : reason}
        >
          {ruleLabel ? `${ruleLabel} — ${reason}` : reason}
        </span>
      </div>
    </aside>
  );
}

// ── Internal sub-component ────────────────────────────────────────────────────

function DiagField({ label, value }: { label: string; value: string }) {
  return (
    <span className="shrink-0 font-mono text-xs">
      <span className="text-neutral-500">{label}=</span>
      <span className="text-neutral-200">{value}</span>
    </span>
  );
}
