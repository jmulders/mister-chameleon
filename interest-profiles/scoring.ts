/**
 * Interest Profile Scoring
 *
 * Computes per-profile interest scores from a visitor's keyword cloud and the
 * platform-managed interest profile definitions.
 *
 * ─── Algorithm ────────────────────────────────────────────────────────────────
 *
 *   For each active profile:
 *     rawScore = Σ (cloud[keyword.toLowerCase()] × tag.weight) for each tag
 *
 *   Then normalize:
 *     maxRaw = max(rawScore across all profiles)
 *     normalized = rawScore / maxRaw   (0 when maxRaw === 0)
 *
 *   Primary   = profile with highest normalizedScore
 *   Secondary = profile with second-highest normalizedScore
 *   Confidence = primary.normalizedScore (rounded to 2 dp)
 *
 * ─── Zero-signal behaviour ────────────────────────────────────────────────────
 *
 *   When the visitor has no keyword history (empty cloud) or no profiles match,
 *   all scores are 0 and interestPrimary / interestSecondary are empty strings.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const cloud    = accumulateKeywords(visitedPages);
 *   const profiles = await loadInterestProfiles();
 *   const scores   = scoreInterests(cloud, profiles);
 *   const ctxVars  = buildInterestContextVars(scores);
 *   // → { interestPrimary: "logistics", interestConfidence: 0.8, … }
 */

import type {
  InterestProfile,
  InterestScore,
  InterestContextVars,
  VisitorKeywordCloud,
} from "./types";

// ── scoreInterests ────────────────────────────────────────────────────────────

/**
 * Computes per-profile interest scores from a visitor's keyword cloud.
 *
 * Returns an array of InterestScore objects sorted descending by normalizedScore.
 * Only active profiles are evaluated.
 *
 * @param cloud     Visitor keyword cloud: lowercase keyword → occurrence count
 * @param profiles  Active interest profile definitions from the DB
 */
export function scoreInterests(
  cloud:    VisitorKeywordCloud,
  profiles: readonly InterestProfile[],
): InterestScore[] {
  const active = profiles.filter((p) => p.isActive);
  if (active.length === 0 || Object.keys(cloud).length === 0) {
    return active.map((p) => ({
      profileKey:      p.key,
      rawScore:        0,
      normalizedScore: 0,
    }));
  }

  // Compute raw scores.
  const raws: Array<{ profileKey: string; rawScore: number }> = active.map((profile) => {
    let raw = 0;
    for (const tag of profile.tags) {
      const count = cloud[tag.keyword.toLowerCase()] ?? 0;
      if (count > 0) {
        raw += count * (tag.weight ?? 1);
      }
    }
    return { profileKey: profile.key, rawScore: raw };
  });

  // Normalize by max raw score.
  const maxRaw = Math.max(...raws.map((r) => r.rawScore), 0);

  const scores: InterestScore[] = raws.map(({ profileKey, rawScore }) => ({
    profileKey,
    rawScore,
    normalizedScore: maxRaw > 0 ? rawScore / maxRaw : 0,
  }));

  // Sort descending by normalizedScore.
  scores.sort((a, b) => b.normalizedScore - a.normalizedScore);

  return scores;
}

// ── buildInterestContextVars ──────────────────────────────────────────────────

/**
 * Converts an array of InterestScore objects (from scoreInterests) into the
 * flat key-value map of context variables exposed to the decision engine.
 *
 * @param scores  Sorted output from scoreInterests()
 */
export function buildInterestContextVars(
  scores: readonly InterestScore[],
): InterestContextVars {
  const primary   = scores[0];
  const secondary = scores[1];

  const perProfile: Record<string, number> = {};
  for (const s of scores) {
    perProfile[s.profileKey] = parseFloat(s.normalizedScore.toFixed(4));
  }

  return {
    interestPrimary:    primary?.normalizedScore  > 0 ? primary.profileKey  : "",
    interestSecondary:  secondary?.normalizedScore > 0 ? secondary.profileKey : "",
    interestConfidence: primary
      ? parseFloat(primary.normalizedScore.toFixed(2))
      : 0,
    perProfile,
  };
}

// ── accumulateKeywords ────────────────────────────────────────────────────────

/**
 * Builds a VisitorKeywordCloud from an array of page keyword lists.
 *
 * Each entry in `pageKeywordLists` is the `metaKeywords` array from a visited
 * page (as stored in the CMS).  Keywords are lowercased and counted.
 *
 * @param pageKeywordLists  Array of keyword arrays (one per visited page)
 */
export function accumulateKeywords(
  pageKeywordLists: readonly (readonly string[])[],
): VisitorKeywordCloud {
  const cloud: Record<string, number> = {};
  for (const keywords of pageKeywordLists) {
    for (const kw of keywords) {
      const lower = kw.toLowerCase().trim();
      if (lower) {
        cloud[lower] = (cloud[lower] ?? 0) + 1;
      }
    }
  }
  return cloud;
}

// ── flattenPerProfileVars ─────────────────────────────────────────────────────

/**
 * Flattens the per-profile scores from InterestContextVars into a flat
 * Record<string, string> suitable for merging into decision context or
 * template variable maps.
 *
 * Profile key "logistics" with score 0.8 → { "interestLogisticsScore": "0.8" }
 *
 * Key format: "interest" + PascalCase(profileKey) + "Score"
 *
 * @param vars  Output from buildInterestContextVars()
 */
export function flattenPerProfileVars(
  vars: InterestContextVars,
): Record<string, string> {
  const flat: Record<string, string> = {
    interestPrimary:    vars.interestPrimary,
    interestSecondary:  vars.interestSecondary,
    interestConfidence: String(vars.interestConfidence),
  };

  for (const [profileKey, score] of Object.entries(vars.perProfile)) {
    const varName = `interest${toPascalCase(profileKey)}Score`;
    flat[varName] = String(score);
  }

  return flat;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toPascalCase(key: string): string {
  return key
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase());
}
