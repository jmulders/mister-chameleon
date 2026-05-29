/**
 * Platform Variant Registry
 *
 * Hardcoded decision metadata for all first-party slot variants.
 * Platform variants are always aiReady === true.
 *
 * CMS tenant variants supplement (or override) these via resolve-variant-candidates.ts.
 */

import type { VariantCandidate, VariantDecisionMeta } from "@/ai/variant-meta";

// ─── Hero Variants ───────────────────────────────────────────────────────────

const HERO_METAS: Record<string, VariantDecisionMeta> = {
  hero_google_problem: {
    decisionLabel: "Google — Problem Aware",
    decisionSummary:
      "Leads with the pain point the visitor likely searched for; positions the product as the clear solution without brand preamble.",
    intendedAudience:
      "Paid or organic search visitors who searched a problem keyword and may not know the brand yet.",
    intentLevel: "consideration",
    funnelStages: ["awareness", "consideration"],
    bestForSources: ["google"],
    tone: "educational",
    primaryGoal: "Convert anonymous search intent into a qualified lead or sign-up.",
    supportingGoals: ["Build immediate relevance", "Reduce bounce from mismatched expectations"],
    exclusions: [
      "Visitor is already a known customer (returning, authenticated)",
      "Source is LinkedIn or referral with brand recognition",
    ],
  },

  hero_linkedin_vision: {
    decisionLabel: "LinkedIn — Vision & Ambition",
    decisionSummary:
      "Leads with an aspirational outcome; assumes the visitor is professionally motivated and evaluating strategically.",
    intendedAudience:
      "LinkedIn-sourced professionals who clicked an ad or post about business transformation.",
    intentLevel: "consideration",
    funnelStages: ["consideration", "decision"],
    bestForSources: ["linkedin"],
    tone: "inspiring",
    primaryGoal: "Spark strategic interest and prompt a demo or deeper engagement.",
    supportingGoals: ["Signal market leadership", "Differentiate from tactical competitors"],
    exclusions: [
      "Visitor source is Google (problem-first framing works better)",
      "Visitor shows high bounce history on vision content",
    ],
  },

  hero_direct_brand: {
    decisionLabel: "Direct — Brand Confidence",
    decisionSummary:
      "Assumes brand familiarity; leads with credibility, proof, and a strong CTA rather than problem framing.",
    intendedAudience:
      "Direct or typed-URL visitors who know the brand and are evaluating whether to convert.",
    intentLevel: "decision",
    funnelStages: ["consideration", "decision"],
    bestForSources: ["direct"],
    tone: "credibility",
    primaryGoal: "Accelerate conversion for warm visitors who have brand intent.",
    supportingGoals: ["Reinforce trust signals", "Reduce time-to-action for returning visitors"],
    exclusions: [
      "First-time visitor with no prior brand exposure (no cookies, no GA history)",
      "Visitor source is paid search with high problem-keyword intent",
    ],
  },
};

// ─── Proof Variants ──────────────────────────────────────────────────────────

const PROOF_METAS: Record<string, VariantDecisionMeta> = {
  proof_cases: {
    decisionLabel: "Case Studies — Peer Proof",
    decisionSummary:
      "Showcases real customer success stories to validate the product with concrete outcomes.",
    intendedAudience:
      "Visitors in evaluation mode who need evidence that the product works for someone like them.",
    intentLevel: "decision",
    funnelStages: ["consideration", "decision"],
    bestForSources: ["google", "direct", "linkedin"],
    tone: "credibility",
    primaryGoal: "Remove objection via peer validation and quantified results.",
    supportingGoals: [
      "Build trust for first-time visitors",
      "Reinforce value proposition with specifics",
    ],
    exclusions: [
      "Visitor is in very early awareness stage (case studies can overwhelm)",
      "No relevant industry case studies available for this tenant",
    ],
  },

  proof_vision: {
    decisionLabel: "Vision — Strategic Proof",
    decisionSummary:
      "Leads with the broader market vision and positions the product as the path to that future.",
    intendedAudience:
      "Senior decision-makers or strategists evaluating a long-term platform investment.",
    intentLevel: "consideration",
    funnelStages: ["awareness", "consideration"],
    bestForSources: ["linkedin", "direct"],
    tone: "inspiring",
    primaryGoal: "Establish market leadership credibility with a vision-forward narrative.",
    supportingGoals: ["Attract strategic buyers", "Differentiate from tactical point solutions"],
    exclusions: [
      "Visitor is a practitioner looking for tactical proof (ROI, case studies)",
      "Source is problem-keyword Google traffic",
    ],
  },

  proof_platform: {
    decisionLabel: "Platform Capabilities — Feature Proof",
    decisionSummary:
      "Highlights the breadth and depth of platform features to address capability objections.",
    intendedAudience:
      "Technical evaluators or champions who need to justify the purchase to stakeholders.",
    intentLevel: "decision",
    funnelStages: ["consideration", "decision"],
    bestForSources: ["google", "direct", "unknown"],
    tone: "direct",
    primaryGoal: "Satisfy capability checklist requirements and remove technical objections.",
    supportingGoals: ["Support champion in internal selling", "Demonstrate integration breadth"],
    exclusions: [
      "Visitor is a C-level exec (platform details can feel tactical/noisy)",
      "Visitor is in early awareness stage (too much too soon)",
    ],
  },
};

// ─── CTA Variants ────────────────────────────────────────────────────────────

const CTA_METAS: Record<string, VariantDecisionMeta> = {
  cta_guide: {
    decisionLabel: "Guide / Resource CTA",
    decisionSummary:
      "Offers a valuable resource (guide, report, checklist) as a low-friction entry point.",
    intendedAudience:
      "Visitors who are not yet ready to talk to sales but want to learn more before deciding.",
    intentLevel: "awareness",
    funnelStages: ["awareness", "consideration"],
    bestForSources: ["google", "unknown"],
    tone: "educational",
    primaryGoal: "Generate a lead via content offer without high-commitment ask.",
    supportingGoals: ["Educate visitor", "Qualify intent through content consumption"],
    exclusions: [
      "Visitor shows strong purchase intent (book demo is better)",
      "Returning visitor who has already downloaded content",
    ],
  },

  cta_platform: {
    decisionLabel: "Platform Trial / Start Free CTA",
    decisionSummary:
      "Invites the visitor to start using the platform with a free trial or freemium entry point.",
    intendedAudience: "Product-led visitors who prefer to evaluate by using rather than talking.",
    intentLevel: "consideration",
    funnelStages: ["consideration", "decision"],
    bestForSources: ["google", "direct", "unknown"],
    tone: "direct",
    primaryGoal: "Drive product sign-up with low-friction self-serve entry.",
    supportingGoals: ["Accelerate evaluation", "Reduce sales-touch cost for SMB segments"],
    exclusions: [
      "Enterprise segment where trial is inappropriate",
      "Visitor is LinkedIn sourced with strategic/vision intent (demo fits better)",
    ],
  },

  cta_meeting: {
    decisionLabel: "Book a Meeting / Demo CTA",
    decisionSummary:
      "Asks the visitor to schedule a personalised demo or discovery call — highest-intent CTA.",
    intendedAudience:
      "Mid-to-late funnel visitors who are actively evaluating and willing to commit time.",
    intentLevel: "decision",
    funnelStages: ["decision"],
    bestForSources: ["linkedin", "direct"],
    tone: "persuasive",
    primaryGoal: "Convert high-intent visitors into a qualified sales opportunity.",
    supportingGoals: ["Trigger sales cycle", "Capture contact for follow-up"],
    exclusions: [
      "Visitor is in early awareness (commitment is too high)",
      "First visit with no prior engagement signals",
      "Source is problem-keyword Google with no behavioural signals",
    ],
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

function buildPlatformCandidates(
  metas: Record<string, VariantDecisionMeta>,
  slotType: VariantCandidate["slotType"],
): VariantCandidate[] {
  return Object.entries(metas).map(([key, decisionMeta]) => ({
    key,
    slotType,
    aiReady: true, // Platform variants always have complete metadata
    decisionMeta,
    source: "platform" as const,
  }));
}

/** All platform-defined hero variant candidates. Always aiReady. */
export const PLATFORM_HERO_CANDIDATES: VariantCandidate[] = buildPlatformCandidates(
  HERO_METAS,
  "hero",
);

/** All platform-defined proof variant candidates. Always aiReady. */
export const PLATFORM_PROOF_CANDIDATES: VariantCandidate[] = buildPlatformCandidates(
  PROOF_METAS,
  "proof",
);

/** All platform-defined cta variant candidates. Always aiReady. */
export const PLATFORM_CTA_CANDIDATES: VariantCandidate[] = buildPlatformCandidates(
  CTA_METAS,
  "cta",
);

/**
 * Look up decision metadata for a single platform variant key.
 * Returns null for unknown keys (tenant-only variants).
 */
export function getPlatformMeta(
  slotType: "hero" | "proof" | "cta",
  key: string,
): VariantDecisionMeta | null {
  const map: Record<string, Record<string, VariantDecisionMeta>> = {
    hero: HERO_METAS,
    proof: PROOF_METAS,
    cta: CTA_METAS,
  };
  return map[slotType]?.[key] ?? null;
}

/**
 * Returns all platform variant keys for a given slot.
 */
export function getPlatformKeys(slotType: "hero" | "proof" | "cta"): string[] {
  const map: Record<string, Record<string, VariantDecisionMeta>> = {
    hero: HERO_METAS,
    proof: PROOF_METAS,
    cta: CTA_METAS,
  };
  return Object.keys(map[slotType] ?? {});
}
