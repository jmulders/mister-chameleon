/**
 * fetchAllVariantCandidates
 *
 * Server-only helper used exclusively by the platform variant admin page.
 *
 * Fetches the full set of variant candidates for all three personalisation
 * slots by:
 *   1. Starting with the platform-defined registry (always present, always aiReady).
 *   2. Fetching all active Sanity variant documents — shared (no tenantId) *and*
 *      every tenant-scoped document — so the platform admin has a global view.
 *   3. Merging via resolveVariantCandidates() which applies tenant-first semantics
 *      for overlapping keys and computes aiReady from isMetaComplete().
 *
 * The returned VariantCandidate[] objects carry:
 *   - source: "platform" | "tenant"  (tenant covers both cms-tenant and cms-shared)
 *   - aiReady: boolean
 *   - decisionMeta: full VariantDecisionMeta | null
 *
 * ─── Graceful fallback ────────────────────────────────────────────────────────
 *
 *   When Sanity is not configured (no SANITY_PROJECT_ID) or the query throws,
 *   returns the platform-only candidates — no crash, no empty page.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   Uses Next.js ISR with the "sanity" cache tag so stale CMS data is served
 *   immediately and revalidated after a content webhook fires.
 */

import "server-only";

import { createSanityClient, SANITY_REVALIDATE_SECONDS, SANITY_CACHE_TAG }
  from "@/cms/providers/sanity-client";
import { logSanityFetch } from "@/cms/sanity-bandwidth-logger";
import { serverEnv }                    from "@/lib/env";
import { logger }                       from "@/lib/logger";
import {
  resolveVariantCandidates,
  platformOnlyCandidates,
}                                       from "@/ai/resolve-variant-candidates";
import type { SlotCandidates }          from "@/ai/variant-meta";
import type { CmsVariantRaw }           from "@/ai/resolve-variant-candidates";
import {
  HERO_CANDIDATES_QUERY,
  PROOF_CANDIDATES_QUERY,
  CTA_CANDIDATES_QUERY,
}                                       from "@/cms/queries/sanity/variant-candidates-query";
import type { SanityVariantCandidateRaw }
  from "@/cms/queries/sanity/variant-candidates-query";

// ── Normalisation ──────────────────────────────────────────────────────────────

/**
 * Convert the raw Sanity response (null-heavy) to the CmsVariantRaw shape
 * that resolveVariantCandidates() expects.
 */
function toCmsRaw(raw: SanityVariantCandidateRaw): CmsVariantRaw {
  const { decisionMeta } = raw;
  return {
    key:      raw.key,
    isActive: raw.isActive,
    // SanityDecisionMetaRaw uses `string | null`; CmsVariantRaw expects
    // `Partial<VariantDecisionMeta>` which uses `string | undefined`.
    // Map null → undefined so the types align before sanitiseCmsMeta() runs.
    decisionMeta: decisionMeta
      ? (Object.fromEntries(
          Object.entries(decisionMeta).map(([k, v]) => [k, v === null ? undefined : v]),
        ) as Partial<import("@/ai/variant-meta").VariantDecisionMeta>)
      : null,
  };
}

// ── Global query ───────────────────────────────────────────────────────────────
//
// For the platform admin view we pass tenantId = null so the GROQ filter
// returns ALL documents (both platform/shared and tenant-scoped).  This gives
// the super-admin visibility into every CMS variant across every tenant.

const GLOBAL_PARAMS = { tenantId: null } as const;

// ── Public API ─────────────────────────────────────────────────────────────────

export async function fetchAllVariantCandidates(): Promise<SlotCandidates> {
  if (!serverEnv.sanity.projectId) {
    return platformOnlyCandidates();
  }

  try {
    const client = createSanityClient();

    // `tags` must be a mutable string[] — Sanity client's FilteredResponseQueryOptions
    // does not accept `readonly string[]`, so we widen with an explicit cast.
    const fetchOpts = {
      next: { revalidate: SANITY_REVALIDATE_SECONDS, tags: [SANITY_CACHE_TAG] as string[] },
    };

    logSanityFetch("fetchAllVariantCandidates", { scope: "all-tenants" });
    const [heroRaw, proofRaw, ctaRaw] = await Promise.all([
      client.fetch<SanityVariantCandidateRaw[]>(HERO_CANDIDATES_QUERY,  GLOBAL_PARAMS, fetchOpts),
      client.fetch<SanityVariantCandidateRaw[]>(PROOF_CANDIDATES_QUERY, GLOBAL_PARAMS, fetchOpts),
      client.fetch<SanityVariantCandidateRaw[]>(CTA_CANDIDATES_QUERY,   GLOBAL_PARAMS, fetchOpts),
    ]);

    return resolveVariantCandidates({
      heroVariants:  heroRaw.map(toCmsRaw),
      proofVariants: proofRaw.map(toCmsRaw),
      ctaVariants:   ctaRaw.map(toCmsRaw),
    });
  } catch (err) {
    logger.warn(
      "[fetchAllVariantCandidates] Sanity query failed; showing platform variants only.",
      { error: String(err) },
    );
    return platformOnlyCandidates();
  }
}

// ── Missing-field helper ───────────────────────────────────────────────────────

const REQUIRED_META_LABELS: Record<string, string> = {
  decisionLabel:    "Decision Label",
  decisionSummary:  "Decision Summary",
  intendedAudience: "Intended Audience",
  intentLevel:      "Intent Level",
  funnelStages:     "Funnel Stages",
  bestForSources:   "Best For Sources",
  tone:             "Tone",
  primaryGoal:      "Primary Goal",
};

/**
 * Returns a list of human-readable field names that are missing from the given
 * partial decisionMeta. Used in the admin page to show editors what's blocking
 * AI-readiness for a CMS variant.
 */
export function missingMetaFields(
  meta: Partial<Record<string, unknown>> | null | undefined,
): string[] {
  if (!meta) return Object.values(REQUIRED_META_LABELS);
  return Object.entries(REQUIRED_META_LABELS)
    .filter(([key]) => {
      const val = meta[key];
      if (Array.isArray(val)) return val.length === 0;
      return val === undefined || val === null || val === "";
    })
    .map(([, label]) => label);
}
