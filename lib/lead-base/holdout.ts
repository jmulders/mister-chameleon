/**
 * Lead Base — personalization holdout assignment.
 *
 * Deterministically buckets a visitor into "control" (holdout — sees the default,
 * non-personalized experience) or "personalized", based on a stable hash of their
 * visitor_key and the tenant's holdout percentage. Pure + dependency-free so it's
 * stable across requests and unit-testable. See docs/lead-base-design.md.
 */

export type PersonalizationGroup = "control" | "personalized";

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
