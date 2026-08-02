/**
 * Score Distribution — diagnostics over REAL sessions.
 *
 * Answers the maintenance question the rules list cannot: not "what threshold
 * did I set" but "what does the score actually look like across real visitors".
 * For each axis (intent + each interest dimension) it buckets the observed
 * scores into bands and counts how many sessions fell in each band — and how
 * many carried no signal on that axis at all ("no bucket"). If ninety percent
 * of sessions land in one band, the input doesn't discriminate and no threshold
 * on that axis will either.
 *
 * This is a read-only gather over visitor_profiles (one fetch + in-process
 * bucketing, like getChannelAttribution). It never mutates anything and never
 * touches the decide hot path.
 */

import "server-only";

import { listVisitorProfiles } from "./visitor-profiles-store";

/** Max sessions sampled for the distribution (newest activity first). */
export const DISTRIBUTION_SAMPLE_CAP = 50_000;
/** Number of bands each axis is split into. */
export const BAND_COUNT = 5;
/** Cap on how many interest axes are shown (highest coverage first). */
export const MAX_INTEREST_AXES = 12;

export interface ScoreBand {
  label: string;
  min:   number;
  max:   number;
  count: number;
}

export interface AxisDistribution {
  /** Machine key: "intent" or the interest dimension key. */
  key:   string;
  /** Human label. */
  label: string;
  /** Sessions that had a value on this axis. */
  withValue:    number;
  /** Sessions with no signal on this axis (the "no bucket" count). */
  withoutValue: number;
  bands: ScoreBand[];
  observedMax: number;
  /**
   * Share (0–1) of valued sessions that fall in the single most-populated band.
   * High = the axis does not discriminate.
   */
  topBandShare: number;
}

export interface ScoreDistribution {
  sampleSize:  number;
  generatedAt: string;
  axes:        AxisDistribution[];
}

/** Round a positive max up to a "nice" ceiling so band edges read cleanly. */
function niceCeil(max: number): number {
  if (max <= 1) return 1;
  if (max <= 10) return 10;
  if (max <= 100) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / pow) * pow;
}

/** Bucket a set of numeric values into BAND_COUNT equal-width bands over [0, ceil]. */
function bucket(values: number[], ceil: number): { bands: ScoreBand[]; topBandShare: number } {
  const width = ceil / BAND_COUNT;
  const counts = new Array<number>(BAND_COUNT).fill(0);

  for (const v of values) {
    // Clamp into range; the top edge is inclusive in the last band.
    const idx = Math.min(BAND_COUNT - 1, Math.max(0, Math.floor(v / width)));
    counts[idx] += 1;
  }

  const decimals = ceil <= 1 ? 2 : 0;
  const bands: ScoreBand[] = counts.map((count, i) => {
    const min = i * width;
    const max = (i + 1) * width;
    return {
      label: `${min.toFixed(decimals)}–${max.toFixed(decimals)}`,
      min,
      max,
      count,
    };
  });

  const top = counts.length ? Math.max(...counts) : 0;
  const topBandShare = values.length ? top / values.length : 0;
  return { bands, topBandShare };
}

function buildAxis(key: string, label: string, values: number[], sampleSize: number): AxisDistribution {
  const observedMax = values.length ? Math.max(...values) : 0;
  const ceil = niceCeil(observedMax);
  const { bands, topBandShare } = bucket(values, ceil);
  return {
    key,
    label,
    withValue:    values.length,
    withoutValue: sampleSize - values.length,
    bands,
    observedMax,
    topBandShare,
  };
}

/**
 * Compute the per-axis score distribution over real sessions for a tenant.
 * Never throws: returns an empty distribution on failure.
 */
export async function getScoreDistribution(tenantId: string): Promise<ScoreDistribution> {
  const generatedAt = new Date().toISOString();
  if (!tenantId) return { sampleSize: 0, generatedAt, axes: [] };

  const profiles = await listVisitorProfiles(tenantId, { limit: DISTRIBUTION_SAMPLE_CAP }).catch(() => []);
  const sampleSize = profiles.length;

  const axes: AxisDistribution[] = [];

  // ── Intent axis (fixed 0–100 scale) ──────────────────────────────────────────
  const intentValues = profiles
    .map((p) => p.intentScore)
    .filter((v): v is number => typeof v === "number");
  {
    // Intent is a 0–100 score; force the ceiling so bands are stable regardless
    // of the observed max (an empty top band is itself a signal).
    const { bands, topBandShare } = bucket(intentValues, 100);
    axes.push({
      key:          "intent",
      label:        "Intent score",
      withValue:    intentValues.length,
      withoutValue: sampleSize - intentValues.length,
      bands,
      observedMax:  intentValues.length ? Math.max(...intentValues) : 0,
      topBandShare,
    });
  }

  // ── Interest axes (adaptive scale) ───────────────────────────────────────────
  // Collect coverage per interest key, then keep the best-covered axes.
  const interestValues = new Map<string, number[]>();
  for (const p of profiles) {
    const interests = p.interests ?? {};
    for (const [k, v] of Object.entries(interests)) {
      if (typeof v !== "number") continue;
      const arr = interestValues.get(k) ?? [];
      arr.push(v);
      interestValues.set(k, arr);
    }
  }

  const sortedInterestKeys = [...interestValues.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_INTEREST_AXES)
    .map(([k]) => k);

  for (const k of sortedInterestKeys) {
    axes.push(buildAxis(`interest:${k}`, `Interest — ${k}`, interestValues.get(k) ?? [], sampleSize));
  }

  return { sampleSize, generatedAt, axes };
}
