/**
 * Lead Base — personalization holdout assignment.
 *
 * Deterministically buckets a visitor into "control" (holdout — sees the default,
 * non-personalized experience) or "personalized", based on a stable hash of their
 * visitor_key and the tenant's holdout percentage. Pure + dependency-free so it's
 * stable across requests and unit-testable. See docs/lead-base-design.md.
 */

/**
 * Which cohort a visitor belongs to for lift measurement.
 *
 *   personalized — got the adapted experience.
 *   control      — deliberately held out; the baseline the lift is measured against.
 *   capped       — got the default experience because the tenant's monthly session
 *                  bundle ran out, NOT because they were sampled.
 *
 * ─── Why "capped" is not just "control" ──────────────────────────────────────
 *
 *   Both see the same default page, so folding them together is tempting. It
 *   would quietly ruin the number this whole system exists to produce.
 *
 *   The control group is a RANDOM sample — that is what makes it a valid
 *   baseline. Capped visitors are not random: they are whoever happened to
 *   arrive late in a busy month. Mixing them in inflates the control cohort with
 *   a self-selected slice, exactly in the months with the most traffic, and the
 *   lift report keeps printing a number as if nothing happened.
 *
 *   Kept separate, the report can exclude them — and "how many visitors did we
 *   turn away" becomes the argument for buying more sessions.
 */
export type PersonalizationGroup = "control" | "personalized" | "capped";

/** FNV-1a hash → bucket 0–99 (stable for a given visitor_key). */
function bucket(visitorKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < visitorKey.length; i++) {
    h ^= visitorKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

/**
 * Assign a visitor to the holdout or the personalized group. `holdoutPct` is the
 * percentage held out (0 = everyone personalized; clamped to 0–50). The same
 * visitor always lands in the same group, so the experience never flips on them.
 */
export function assignPersonalizationGroup(visitorKey: string, holdoutPct: number): PersonalizationGroup {
  const pct = Math.min(50, Math.max(0, Math.round(holdoutPct || 0)));
  if (pct <= 0 || !visitorKey) return "personalized";
  return bucket(visitorKey) < pct ? "control" : "personalized";
}

/**
 * Fold the session cap into the cohort.
 *
 * Call this right after assignPersonalizationGroup(). When the tenant is over
 * their monthly session bundle (and has no purchased credits left), the visitor
 * gets the default experience regardless of the holdout draw — so the cohort
 * becomes "capped".
 *
 * The cap wins over "control" on purpose: a control visitor who is ALSO past the
 * cap must not be counted in the baseline, or the holdout cohort silently grows
 * with non-random traffic in exactly the busiest months. Both see the same page;
 * only the label differs, and the label is what the lift report trusts.
 *
 * Pure — the caller does the I/O (checkSessionSoftCap) and passes the verdict in.
 */
export function applySessionCap(
  group:   PersonalizationGroup,
  overCap: boolean,
): PersonalizationGroup {
  return overCap ? "capped" : group;
}

/**
 * True when this cohort must be served the default, unpersonalised experience.
 *
 * Use this instead of comparing to "control" by hand: there are now two reasons
 * to withhold personalisation, and a bare `group === "control"` check silently
 * misses the capped one.
 */
export function servesDefaultExperience(group: PersonalizationGroup): boolean {
  return group === "control" || group === "capped";
}
