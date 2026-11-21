/**
 * PlanExperimentResults — which arm of each experiment did better.
 *
 * A server component: it only shows numbers. The sum is in
 * experiments/plan-experiment-results.ts, the read in
 * data/repositories/plan-experiments-repository.ts.
 */

import type { PlanExperimentRow } from "@/data/types";
import {
  conversionRate,
  judgeExperiment,
  MIN_CONVERSIONS_TOTAL,
  MIN_VISITORS_PER_ARM,
  type ArmStat,
  type ExperimentResult,
  type ExperimentVerdict,
} from "@/experiments/plan-experiment-results";

interface Props {
  experiments: readonly Pick<PlanExperimentRow, "id" | "name" | "status">[];
  results:     Readonly<Record<string, ExperimentResult>>;
  /** More rows existed than were read: the counts are a floor. */
  truncated:   boolean;
}

const VERDICT: Record<ExperimentVerdict, { label: string; tone: string }> = {
  "too-early":           { label: "Too early to tell",   tone: "bg-neutral-100 text-neutral-600" },
  "no-clear-difference": { label: "No clear difference", tone: "bg-neutral-100 text-neutral-700" },
  "challenger-ahead":    { label: "Challenger ahead",    tone: "bg-green-100 text-green-800" },
  "control-ahead":       { label: "Rule's plan ahead",   tone: "bg-amber-100 text-amber-800" },
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function Arm({ arm }: { arm: ArmStat }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{arm.visitors}</td>
      <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{arm.conversions}</td>
      <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{arm.visitors > 0 ? percent(conversionRate(arm)) : "n/a"}</td>
    </>
  );
}

export function PlanExperimentResults({ experiments, results, truncated }: Props) {
  // An experiment that never ran has nothing to show.
  const rows = experiments
    .map((experiment) => ({ experiment, result: results[experiment.id] }))
    .filter((row): row is { experiment: Props["experiments"][number]; result: ExperimentResult } => Boolean(row.result));

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-800">Results</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Visitors enrolled in each arm and how many of them submitted a form afterwards. Counts
          visitors who gave consent: only for them is an enrolment stored.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-500">
          No visitors have been enrolled in an experiment yet. Results appear here once an active
          experiment&apos;s rule has matched a visitor.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <th className="px-3 py-2" rowSpan={2}>Experiment</th>
                <th className="px-3 py-2 text-center" colSpan={3}>Rule&apos;s plan (control)</th>
                <th className="px-3 py-2 text-center" colSpan={3}>Challenger</th>
                <th className="px-3 py-2 text-right" rowSpan={2}>Difference</th>
                <th className="px-3 py-2" rowSpan={2}>Verdict</th>
              </tr>
              <tr className="text-xs text-neutral-400">
                <th className="px-3 pb-2 text-right font-medium">Visitors</th>
                <th className="px-3 pb-2 text-right font-medium">Requests</th>
                <th className="px-3 pb-2 text-right font-medium">Rate</th>
                <th className="px-3 pb-2 text-right font-medium">Visitors</th>
                <th className="px-3 pb-2 text-right font-medium">Requests</th>
                <th className="px-3 pb-2 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ experiment, result }) => {
                const verdict = VERDICT[judgeExperiment(result)];
                const both = result.control.visitors > 0 && result.challenger.visitors > 0;
                const difference = conversionRate(result.challenger) - conversionRate(result.control);
                return (
                  <tr key={experiment.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-neutral-800">{experiment.name}</span>
                      <span className="ml-2 text-xs text-neutral-400">{experiment.status}</span>
                    </td>
                    <Arm arm={result.control} />
                    <Arm arm={result.challenger} />
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                      {both ? `${difference > 0 ? "+" : ""}${(difference * 100).toFixed(1)} pt` : "n/a"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${verdict.tone}`}>{verdict.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
        <p>
          A request counts when it came after the visitor was enrolled. The verdict stays at
          &quot;too early&quot; below {MIN_VISITORS_PER_ARM} visitors per arm or {MIN_CONVERSIONS_TOTAL} requests
          in total. Above that it says an arm is ahead only when chance would give a difference
          this large one time in twenty. Let an experiment run its course before you read it:
          a verdict that flips back a week later was never one.
        </p>
        {truncated && (
          <p className="mt-1 text-amber-700">
            There are more rows than this page reads. The numbers above are a floor.
          </p>
        )}
      </div>
    </section>
  );
}
