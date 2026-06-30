import type { PersonalizationPerformance } from "@/lib/lead-base/visitor-profiles-store";

const pct = (converted: number, total: number) => (total > 0 ? (converted / total) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      {sub && <div className="text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

export function PersonalizationReport({
  perf,
  segmentLabels,
}: {
  perf:          PersonalizationPerformance;
  segmentLabels: Record<string, string>;
}) {
  const overallRate = pct(perf.converted, perf.total);
  const pRate = pct(perf.personalized.converted, perf.personalized.total);
  const bRate = pct(perf.baseline.converted, perf.baseline.total);
  const lift  = bRate > 0 ? ((pRate - bRate) / bRate) * 100 : null;

  const hp = perf.holdout.personalized;
  const hc = perf.holdout.control;
  const hasHoldout = hp.total + hc.total > 0;
  const hpRate = pct(hp.converted, hp.total);
  const hcRate = pct(hc.converted, hc.total);
  const trueLift = hcRate > 0 ? ((hpRate - hcRate) / hcRate) * 100 : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Profiles" value={String(perf.total)} sub={perf.sampleCapped ? "sample capped" : undefined} />
        <Stat label="Conversions" value={String(perf.converted)} sub="form submissions" />
        <Stat label="Conversion rate" value={fmtPct(overallRate)} />
        <Stat
          label="Personalization lift"
          value={lift === null ? "—" : `${lift >= 0 ? "+" : ""}${lift.toFixed(0)}%`}
          sub="personalized vs baseline"
        />
      </div>

      {hasHoldout && (
        <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">
            Randomized holdout (true lift)
            {trueLift !== null && (
              <span className="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {trueLift >= 0 ? "+" : ""}{trueLift.toFixed(0)}% lift
              </span>
            )}
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            A deterministic % of visitors are held out and served the default experience
            (control). Comparing them head-to-head with the personalized group gives the true
            causal lift of personalization.
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Group</th>
                  <th className="px-3 py-2 text-right">Profiles</th>
                  <th className="px-3 py-2 text-right">Conversions</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="px-3 py-2 text-neutral-800">Personalized</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{hp.total}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{hp.converted}</td>
                  <td className="px-3 py-2 text-right font-medium text-neutral-900">{fmtPct(hpRate)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-neutral-800">Control (holdout)</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{hc.total}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{hc.converted}</td>
                  <td className="px-3 py-2 text-right font-medium text-neutral-900">{fmtPct(hcRate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Personalized vs baseline</h2>
        <p className="mb-3 text-xs text-neutral-500">
          &quot;Personalized&quot; = visitors who matched at least one audience segment (and thus
          saw adaptive content); &quot;Baseline&quot; = visitors who matched none. A proxy for
          personalization impact (not a randomized holdout).
        </p>
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-right">Profiles</th>
                <th className="px-3 py-2 text-right">Conversions</th>
                <th className="px-3 py-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="px-3 py-2 text-neutral-800">Personalized</td>
                <td className="px-3 py-2 text-right text-neutral-600">{perf.personalized.total}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{perf.personalized.converted}</td>
                <td className="px-3 py-2 text-right font-medium text-neutral-900">{fmtPct(pRate)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-800">Baseline</td>
                <td className="px-3 py-2 text-right text-neutral-600">{perf.baseline.total}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{perf.baseline.converted}</td>
                <td className="px-3 py-2 text-right font-medium text-neutral-900">{fmtPct(bRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Conversion by segment</h2>
        {perf.bySegment.length === 0 ? (
          <p className="text-xs text-neutral-400">No segment data yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Segment</th>
                  <th className="px-3 py-2 text-right">Profiles</th>
                  <th className="px-3 py-2 text-right">Conversions</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {perf.bySegment.map((s) => (
                  <tr key={s.segmentId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-neutral-800">{segmentLabels[s.segmentId] ?? s.segmentId}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{s.total}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{s.converted}</td>
                    <td className="px-3 py-2 text-right font-medium text-neutral-900">{fmtPct(pct(s.converted, s.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
