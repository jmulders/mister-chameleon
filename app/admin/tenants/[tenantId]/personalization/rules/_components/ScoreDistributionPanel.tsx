/**
 * ScoreDistributionPanel
 *
 * Shows, per scoring axis, how real sessions distribute across score bands —
 * and how many carried no signal at all. This is the diagnostic that filtering
 * the rules list cannot give: it tells you whether the INPUT discriminates.
 * A flag appears when an axis is degenerate (almost everything in one band, or
 * almost no sessions with a value), because then no threshold on that axis
 * means anything.
 *
 * Pure server component: it renders a distribution computed upstream.
 */

import type { ScoreDistribution, AxisDistribution } from "@/lib/lead-base/score-distribution";

interface ScoreDistributionPanelProps {
  distribution: ScoreDistribution;
}

/** A single axis: label, coverage, band bars, and a degeneracy flag. */
function AxisRow({ axis, sampleSize }: { axis: AxisDistribution; sampleSize: number }) {
  const maxBand = axis.bands.reduce((m, b) => Math.max(m, b.count), 0);
  const noSignalShare = sampleSize > 0 ? axis.withoutValue / sampleSize : 0;

  const degenerate = axis.withValue > 0 && axis.topBandShare >= 0.9;
  const sparse = noSignalShare >= 0.9;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-900">{axis.label}</p>
        <p className="text-xs text-neutral-500">
          {axis.withValue} met waarde · {axis.withoutValue} zonder
        </p>
      </div>

      {/* Band bars */}
      <div className="mt-2 flex flex-col gap-1">
        {axis.bands.map((b) => {
          const share = axis.withValue > 0 ? b.count / axis.withValue : 0;
          const width = maxBand > 0 ? (b.count / maxBand) * 100 : 0;
          return (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-neutral-400">
                {b.label}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                <div
                  className="h-full rounded bg-brand-500/70"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-[11px] tabular-nums text-neutral-500">
                {b.count} ({Math.round(share * 100)}%)
              </span>
            </div>
          );
        })}
      </div>

      {(degenerate || sparse) && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          {sparse
            ? `Bijna geen sessies met een waarde op deze as (${Math.round(noSignalShare * 100)}% zonder) — een drempel hierop raakt vrijwel niemand.`
            : `${Math.round(axis.topBandShare * 100)}% van de sessies valt in één bak — deze as discrimineert nauwelijks.`}
        </p>
      )}
    </div>
  );
}

export function ScoreDistributionPanel({ distribution }: ScoreDistributionPanelProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Scoreverdeling over echte sessies
        </h2>
        <span className="text-xs text-neutral-500">
          {distribution.sampleSize.toLocaleString("nl-NL")} sessies
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Wat het scoremodel er in de praktijk van maakt — niet wat je hebt
        ingesteld. Per as: hoeveel sessies in welke bak, en hoeveel zonder
        signaal. Combineer met hoe vaak elke regel vuurt voor de volledige
        diagnose.
      </p>

      {distribution.sampleSize === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          Nog geen sessies om te analyseren. Zodra bezoekers profielen opbouwen,
          verschijnt hier de verdeling.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {distribution.axes.map((axis) => (
            <AxisRow key={axis.key} axis={axis} sampleSize={distribution.sampleSize} />
          ))}
        </div>
      )}
    </div>
  );
}
