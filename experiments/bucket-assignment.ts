/**
 * Deterministic Bucket Assignment
 *
 * Pure, side-effect-free functions for enrolling sessions into experiments
 * and assigning them to variant buckets.
 *
 * ─── Design goals ─────────────────────────────────────────────────────────────
 *
 *   Deterministic   — (sessionId, experimentId) always yields the same bucket.
 *                     No RNG, no storage read required for the assignment itself.
 *
 *   Independent     — Enrollment check and bucket assignment use different hash
 *                     inputs so a 50% traffic_fraction doesn't accidentally
 *                     concentrate sessions into one bucket.
 *
 *   Fast            — FNV-1a 32-bit hash over ASCII chars; microsecond-range
 *                     computation even for UUID strings.
 *
 *   Zero-dependency — No crypto import, no external libraries.  Runs in the
 *                     Edge runtime, Node.js, and unit tests without modification.
 *
 * ─── Algorithm: FNV-1a 32-bit ─────────────────────────────────────────────────
 *
 *   Standard FNV-1a parameters:
 *     offset basis: 2166136261  (0x811c9dc5)
 *     prime:        16777619    (0x01000193)
 *     unsigned 32-bit arithmetic via `>>> 0`
 *
 *   The output is an unsigned 32-bit integer in [0, 0xFFFFFFFF].
 *   For bucket selection: hash % variantCount  (uniform for counts ≪ 2^32)
 *   For enrollment check: hash / 0xFFFFFFFF normalized to [0, 1)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const enrolled = isEnrolled(sessionId, experiment.id, experiment.traffic_fraction);
 *   if (!enrolled) continue;
 *
 *   const bucket = assignBucket(sessionId, experiment.id, experiment.variants.length);
 *   const variantKey = experiment.variants[bucket];
 */

// ── FNV-1a hash ───────────────────────────────────────────────────────────────

/** FNV-1a 32-bit offset basis */
const FNV_OFFSET = 2166136261;
/** FNV-1a 32-bit prime */
const FNV_PRIME = 16777619;

/**
 * Compute a FNV-1a 32-bit hash over an ASCII/UTF-16 string.
 *
 * Uses charCodeAt() which is safe for session UUIDs (ASCII only).
 * For the full Unicode range a TextEncoder would be required — not needed here.
 *
 * @returns Unsigned 32-bit integer (0 – 4294967295)
 */
function fnv1a32(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime, keep 32-bit unsigned.
    // The `Math.imul` path is faster in V8 but `>>> 0` cast works everywhere.
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0; // Ensure unsigned
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if this session should be enrolled in the given experiment.
 *
 * Uses a separate hash suffix (":enroll") so the enrollment decision is
 * independent of the bucket assignment.  A session at the boundary of a
 * 50% traffic fraction will not always end up in bucket 0.
 *
 * @param sessionId       - The visitor's session UUID.
 * @param experimentId    - The stable experiment slug.
 * @param trafficFraction - Fraction of sessions to enroll: 0 < f ≤ 1.
 */
export function isEnrolled(
  sessionId: string,
  experimentId: string,
  trafficFraction: number,
): boolean {
  if (trafficFraction >= 1) return true;

  const hash = fnv1a32(`${sessionId}:${experimentId}:enroll`);
  // Normalize to [0, 1).  Dividing by 0x100000000 (2^32) gives an open
  // upper bound so trafficFraction = 0.5 correctly catches exactly 50%.
  const normalized = hash / 0x100000000;
  return normalized < trafficFraction;
}

/**
 * Returns the 0-based bucket index for a session in a given experiment.
 *
 * The result is in [0, variantCount - 1] and is stable for any given
 * (sessionId, experimentId) pair regardless of when or how often it is called.
 *
 * @param sessionId    - The visitor's session UUID.
 * @param experimentId - The stable experiment slug.
 * @param variantCount - Number of variants (buckets) in the experiment.
 */
export function assignBucket(
  sessionId: string,
  experimentId: string,
  variantCount: number,
): number {
  const hash = fnv1a32(`${sessionId}:${experimentId}`);
  return hash % variantCount;
}

/**
 * Convenience: derive both enrollment and bucket in one call.
 *
 * Returns null when the session is not enrolled, or the 0-based bucket index
 * when it is.  This is the primary function used by ExperimentDecisionProvider.
 *
 * @param sessionId       - The visitor's session UUID.
 * @param experimentId    - The stable experiment slug.
 * @param variantCount    - Number of variants in the experiment.
 * @param trafficFraction - Fraction of sessions to enroll: 0 < f ≤ 1.
 * @returns Bucket index (0…variantCount-1), or null if not enrolled.
 */
export function resolveExperimentBucket(
  sessionId: string,
  experimentId: string,
  variantCount: number,
  trafficFraction: number,
): number | null {
  if (!isEnrolled(sessionId, experimentId, trafficFraction)) return null;
  return assignBucket(sessionId, experimentId, variantCount);
}
