/**
 * The trial is capped twice: by days and by personalised sessions.
 *
 * A trial lasts 14 days. Until now those days were the only limit: a trial
 * tenant had the full monthly bundle of the plan it tried, 1,500 to 40,000
 * sessions, free. A busy site could run a campaign through a trial and leave.
 *
 * So a trial also ends at a number of personalised sessions, counted from the
 * day the trial started and not per calendar month: a trial that starts on
 * the 25th does not get a second helping on the 1st.
 *
 * At the limit the tenant is treated like any tenant over its bundle: the
 * default experience is served, the tenant is told, and purchased session
 * credits lift the limit (isOverCap in plan-enforcement.ts). When the trial
 * becomes a paid subscription the plan's own monthly limit takes over.
 *
 * "On trial" is the subscription status `trialing`. That includes the few
 * free days after the fourteenth, in which a converting trial is moved to the
 * 1st of the month (trialConversionRealign in stripe.ts): those days are free
 * too, so they fall under the same limit.
 */

/** Personalised sessions a trial may use, from its start to its end. */
export const TRIAL_SESSION_LIMIT = 150;

export interface TrialSubscription {
  status?:     string | null;
  created_at?: string | null;
}

export interface TrialWindow {
  /** ISO timestamp the trial sessions are counted from. */
  startedAt: string;
}

/**
 * The trial a subscription row is in, or null when it is not on trial.
 * Pure.
 *
 * A trialing row without a usable start date is still a trial: it is counted
 * from the epoch, which is every session the tenant ever had. That errs
 * towards the limit instead of quietly lifting it.
 */
export function trialWindow(sub: TrialSubscription | null | undefined): TrialWindow | null {
  if (!sub || sub.status !== "trialing") return null;
  const started = sub.created_at ? new Date(sub.created_at) : null;
  const valid   = started !== null && !Number.isNaN(started.getTime());
  return { startedAt: valid ? started.toISOString() : new Date(0).toISOString() };
}

/**
 * The session limit that holds during a trial. Pure.
 *
 * The lower of the trial limit and the plan's own limit, so a plan that
 * offers fewer sessions than the trial does not get more on trial than paid.
 * A plan limit of 0 means unlimited, and a trial of it is still a trial.
 */
export function trialSessionLimit(planLimit: number, trialLimit: number = TRIAL_SESSION_LIMIT): number {
  if (!(trialLimit > 0)) return planLimit;
  if (!(planLimit > 0)) return trialLimit;
  return Math.min(planLimit, trialLimit);
}
