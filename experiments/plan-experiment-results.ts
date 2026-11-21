/**
 * The result of a plan experiment: how many visitors each arm had and how
 * many of them made a request afterwards.
 *
 * Until 21 Nov 2026 an experiment could be created, run and ended in the
 * admin, and nowhere did it say which arm did better. The data was there all
 * along: every enrolled visitor has a row in plan_experiment_assignments with
 * the arm (bucket 0 is the rule's own plan, bucket 1 the challenger), and a
 * visitor who submits a form gets converted_at on their profile.
 *
 * This file is the sum, kept apart from the database so it can be tested. An
 * enrolment is stored with a session, and a session only exists for a visitor
 * who gave consent, so the result covers those visitors.
 */

export interface ArmStat {
  /** Visitors enrolled in this arm. */
  visitors: number;
  /** Of those, the ones who converted after they were enrolled. */
  conversions: number;
}

export interface ExperimentResult {
  /** Bucket 0: the rule's plan, unchanged. */
  control: ArmStat;
  /** Bucket 1: the rule's plan with the challenger's variants. */
  challenger: ArmStat;
}

export interface AssignmentForResult {
  experiment_id: string;
  session_id: string;
  bucket: number;
  created_at: string;
}

const emptyResult = (): ExperimentResult => ({
  control:    { visitors: 0, conversions: 0 },
  challenger: { visitors: 0, conversions: 0 },
});

/**
 * Counts visitors and conversions per arm, per experiment.
 *
 * A conversion counts for an experiment only when it came after the visitor
 * was enrolled: someone who asked for a demo last month and is enrolled today
 * did not ask because of today's page.
 *
 * @param convertedAt  visitor key (the session id) to the time of conversion.
 */
export function tallyExperimentResults(
  assignments: readonly AssignmentForResult[],
  convertedAt: ReadonlyMap<string, string>,
): Map<string, ExperimentResult> {
  const out = new Map<string, ExperimentResult>();
  const seen = new Set<string>();
  for (const a of assignments) {
    // One row per visitor per experiment (the table has that constraint; a
    // paged read may still hand a row over twice).
    const key = `${a.experiment_id}|${a.session_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const result = out.get(a.experiment_id) ?? emptyResult();
    const arm = a.bucket === 1 ? result.challenger : result.control;
    arm.visitors += 1;
    const converted = convertedAt.get(a.session_id);
    if (converted && Date.parse(converted) >= Date.parse(a.created_at)) arm.conversions += 1;
    out.set(a.experiment_id, result);
  }
  return out;
}

/** Conversions per visitor, 0 without visitors. */
export function conversionRate(arm: ArmStat): number {
  return arm.visitors > 0 ? arm.conversions / arm.visitors : 0;
}

export type ExperimentVerdict = "too-early" | "no-clear-difference" | "challenger-ahead" | "control-ahead";

/** Below these numbers a difference says nothing yet. */
export const MIN_VISITORS_PER_ARM = 30;
export const MIN_CONVERSIONS_TOTAL = 10;

/** |z| at which a difference this large would come up by chance one time in twenty. */
const Z_95 = 1.96;

/**
 * Says whether the two arms differ by more than chance explains.
 *
 * A two-proportion z-test with a pooled rate, at the usual 95 percent. It is a
 * guard against reading a winner into noise, not a full analysis: it does not
 * correct for looking at the numbers every day, so a verdict that flips back
 * a week later was never one.
 */
export function judgeExperiment(result: ExperimentResult): ExperimentVerdict {
  const { control, challenger } = result;
  if (control.visitors < MIN_VISITORS_PER_ARM || challenger.visitors < MIN_VISITORS_PER_ARM) return "too-early";
  const conversions = control.conversions + challenger.conversions;
  if (conversions < MIN_CONVERSIONS_TOTAL) return "too-early";

  const visitors = control.visitors + challenger.visitors;
  const pooled = conversions / visitors;
  const spread = Math.sqrt(pooled * (1 - pooled) * (1 / control.visitors + 1 / challenger.visitors));
  if (!(spread > 0)) return "no-clear-difference";

  const z = (conversionRate(challenger) - conversionRate(control)) / spread;
  if (z >= Z_95) return "challenger-ahead";
  if (z <= -Z_95) return "control-ahead";
  return "no-clear-difference";
}
