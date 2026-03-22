/**
 * AI Module — Prompt Builder
 *
 * Converts a DecisionInput (visitor context + behavioural history) into a
 * structured prompt pair ready to send to any AI provider.
 *
 * ─── Design goals ─────────────────────────────────────────────────────────────
 *
 *   Deterministic   The same input always produces the same prompt.
 *                   No randomness, no timestamps, no ambient state.
 *
 *   Minimal         Only the signals the model actually needs.
 *                   Noise (rawReferrer, userAgent, resolvedAt) is excluded.
 *
 *   Cacheable       The system prompt is invariant — it never changes between
 *                   requests.  Cache it at the provider level to save tokens.
 *
 *   Provider-agnostic
 *                   Returns a systemPrompt + userPrompt pair so the caller can
 *                   map them to whichever message format the provider requires
 *                   (Anthropic system/user, OpenAI system/user roles, etc.).
 *
 *   Strict output   The prompt demands JSON-only output matching a declared
 *                   schema, with variant keys drawn exclusively from the allowed
 *                   vocabulary.  This is the first line of defence against
 *                   hallucinated keys before the confidence policy gates them.
 *
 * ─── Relationship to other ai/ files ──────────────────────────────────────────
 *
 *   ai/prompt-builder.ts   ← this file   builds the prompt
 *   ai/model-contract.ts                 adapter calls the model with the prompt
 *   decision/ai-confidence-policy.ts     validates and gates the model response
 *   decision/providers/ai-decision-provider.ts   orchestrates the full pipeline
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { buildHomepagePrompt } from "@/ai/prompt-builder";
 *
 *   const { systemPrompt, userPrompt, metadata } = buildHomepagePrompt(input);
 *
 *   // In a Claude adapter:
 *   const response = await anthropic.messages.create({
 *     system:   systemPrompt,
 *     messages: [{ role: "user", content: userPrompt }],
 *     ...
 *   });
 *
 *   // In an OpenAI adapter:
 *   const response = await openai.chat.completions.create({
 *     messages: [
 *       { role: "system",  content: systemPrompt },
 *       { role: "user",    content: userPrompt   },
 *     ],
 *     ...
 *   });
 */

import type { DecisionInput } from "@/decision/types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * The prompt pair returned by buildHomepagePrompt().
 *
 * Providers receive both parts and map them to their message format.
 * The system prompt is invariant; only the user prompt changes per request.
 */
export interface BuiltPrompt {
  /**
   * The invariant system prompt.
   *
   * Contains the model's role, the full variant vocabulary with descriptions,
   * and the strict JSON output schema.  Never changes between requests —
   * cache it at the provider level to reduce input token cost.
   */
  systemPrompt: string;

  /**
   * The per-request user prompt.
   *
   * Contains only the visitor's signals and the instruction to decide.
   * Changes on every request; never cache.
   */
  userPrompt: string;

  /**
   * Lightweight metadata produced alongside the prompts.
   * Useful for logging, debugging, and pre-validating model responses.
   */
  metadata: PromptBuildMetadata;
}

/**
 * Metadata produced by buildHomepagePrompt().
 *
 * Not sent to the model — used by the caller for observability and validation.
 */
export interface PromptBuildMetadata {
  /**
   * The exact allowed key sets embedded in this prompt.
   * Use these to validate the model's response before passing it to the
   * confidence policy — a key outside these sets is an instant validity failure.
   */
  allowedKeys: {
    hero:  readonly string[];
    proof: readonly string[];
    cta:   readonly string[];
  };

  /**
   * Count of meaningful visitor signals included in the user prompt.
   *
   * Excludes zero-value or unknown signals (source="unknown", visitType="new"
   * with no history, null UTM params, etc.).
   *
   * Correlates with expected model confidence:
   *   0–1   very sparse — model will likely produce low-confidence output
   *   2–3   moderate    — typical new visitor
   *   4+    rich        — returning visitor with UTM attribution
   *
   * This mirrors the contextRichness score in ai-confidence-policy.ts but is
   * expressed as a raw integer count rather than a normalised float.
   */
  signalCount: number;

  /**
   * Whether behavioural history was loaded from the database for this request.
   *
   * false when the session is brand-new or the DB query failed.
   * When false, all history fields are zero/null safe-defaults; the model is
   * told this explicitly so it does not over-weight the absent history signals.
   */
  historyAvailable: boolean;
}

// ── System prompt (invariant) ─────────────────────────────────────────────────

/**
 * Returns the invariant system prompt.
 *
 * Defined as a function (rather than a module-level constant) so that
 * the output type is explicit and tree-shakers can elide it when unused.
 * In practice, callers should call this once and cache the result.
 */
export function buildSystemPrompt(): string {
  return `\
You are a homepage personalisation engine for Mister Chameleon, a B2B SaaS platform.

Your job is to select the optimal homepage experience plan for a single visitor based on their context signals and behavioural history. The plan controls which content variants are shown in three page sections: hero, proof, and CTA.

=== VARIANT VOCABULARY ===

HERO variants — choose exactly one:
${ALLOWED_HERO_KEYS.map((k) => `  ${k}: ${HERO_DESCRIPTIONS[k]}`).join("\n")}

PROOF variants — choose exactly one:
${ALLOWED_PROOF_KEYS.map((k) => `  ${k}: ${PROOF_DESCRIPTIONS[k]}`).join("\n")}

CTA variants — choose exactly one:
${ALLOWED_CTA_KEYS.map((k) => `  ${k}: ${CTA_DESCRIPTIONS[k]}`).join("\n")}

=== DECISION PRINCIPLES ===

- Match the visitor's intent. Traffic source and UTM parameters are the strongest signals.
- Reinforce continuity for returning visitors. If they previously saw a specific hero or CTA, prefer consistency unless a stronger signal suggests a change.
- Prefer action-oriented CTAs (cta_guide, cta_platform) for new/exploratory visitors.
- Prefer relationship-oriented CTAs (cta_meeting) for returning visitors who have already engaged.
- When signals are weak or absent, default to the brand experience: hero_direct_brand, proof_platform, cta_meeting.

=== OUTPUT FORMAT ===

Respond with ONLY a single JSON object. No markdown. No code blocks. No text before or after the JSON.

The object must match this schema exactly:
{
  "heroKey":   "<one value from the HERO variants above>",
  "proofKey":  "<one value from the PROOF variants above>",
  "ctaKey":    "<one value from the CTA variants above>",
  "reason":    "<one or two sentences explaining your selection>",
  "confidence": <float between 0.0 and 1.0>
}

Rules:
- heroKey, proofKey, and ctaKey must be exactly one of the allowed values listed above. Any other value is invalid.
- reason must be a concise, human-readable explanation (not a JSON object).
- confidence must reflect your genuine certainty: use 0.4–0.6 when signals are sparse or ambiguous, 0.7–0.85 for typical clear-signal cases, and 0.9+ only when the signals strongly and unambiguously favour one combination.`;
}

// ── User prompt (per-request) ─────────────────────────────────────────────────

/**
 * Returns the per-request user prompt for a specific DecisionInput.
 *
 * The user prompt is intentionally terse — the system prompt provides all the
 * stable context.  Only the visitor-specific signals appear here.
 */
export function buildUserPrompt(input: DecisionInput): string {
  const lines: string[] = ["=== VISITOR SIGNALS ===", ""];

  // ── Traffic and device ────────────────────────────────────────────────────
  lines.push(`Source:       ${input.source}`);
  lines.push(`Device:       ${input.device}`);
  lines.push(`Visit type:   ${input.visitType}`);

  // ── Attribution (UTM / referrer) ──────────────────────────────────────────
  const hasUtm =
    input.utmSource !== null ||
    input.utmMedium !== null ||
    input.utmCampaign !== null ||
    input.utmContent !== null ||
    input.utmTerm !== null;

  if (hasUtm) {
    lines.push("");
    lines.push("UTM attribution:");
    if (input.utmSource   !== null) lines.push(`  utm_source:   ${input.utmSource}`);
    if (input.utmMedium   !== null) lines.push(`  utm_medium:   ${input.utmMedium}`);
    if (input.utmCampaign !== null) lines.push(`  utm_campaign: ${input.utmCampaign}`);
    if (input.utmContent  !== null) lines.push(`  utm_content:  ${input.utmContent}`);
    if (input.utmTerm     !== null) lines.push(`  utm_term:     ${input.utmTerm}`);
  }

  if (input.referrerDomain !== null) {
    lines.push(`Referrer domain: ${input.referrerDomain}`);
  }

  // ── Behavioural history ────────────────────────────────────────────────────
  lines.push("");

  if (!input.history.fromDatabase) {
    lines.push(
      "Behavioural history: not available (new session or database unavailable — treat all history signals as zero).",
    );
  } else {
    lines.push("Behavioural history (first-party, from database):");
    lines.push(`  Page views (prior):   ${input.history.pageViewCount}`);
    lines.push(`  Has clicked CTA:      ${input.history.hasClickedCta ? "yes" : "no"}`);

    if (input.history.ctaClickCount > 1) {
      lines.push(`  CTA click count:      ${input.history.ctaClickCount}`);
    }

    if (input.history.lastHeroKey !== null) {
      lines.push(`  Last hero variant:    ${input.history.lastHeroKey}`);
    }

    if (input.history.lastCtaKey !== null) {
      lines.push(`  Last CTA variant:     ${input.history.lastCtaKey}`);
    }

    if (input.history.firstSeenAt !== null) {
      lines.push(`  First seen:           ${input.history.firstSeenAt}`);
    }
  }

  lines.push("");
  lines.push("Select the best experience plan for this visitor.");

  return lines.join("\n");
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Builds the complete prompt pair and metadata for a homepage AI decision.
 *
 * Call this immediately before sending a request to an AI provider.
 * The systemPrompt is invariant and can be cached; the userPrompt is
 * per-request and must never be cached across different visitors.
 *
 * @param input  The DecisionInput for the current request, built via
 *               buildDecisionInput(visitorContext, visitorHistory).
 *
 * @returns      A BuiltPrompt containing systemPrompt, userPrompt, and metadata.
 *
 * @example
 * const { systemPrompt, userPrompt, metadata } = buildHomepagePrompt(input);
 *
 * // Sanity-check signal richness before spending tokens:
 * if (metadata.signalCount === 0) {
 *   // Very sparse — AI unlikely to add value over the rules engine.
 *   return rulesProvider.getHomepagePlan(input);
 * }
 */
export function buildHomepagePrompt(input: DecisionInput): BuiltPrompt {
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt:   buildUserPrompt(input),
    metadata:     buildMetadata(input),
  };
}

// ── Metadata builder ──────────────────────────────────────────────────────────

function buildMetadata(input: DecisionInput): PromptBuildMetadata {
  return {
    allowedKeys: {
      hero:  ALLOWED_HERO_KEYS,
      proof: ALLOWED_PROOF_KEYS,
      cta:   ALLOWED_CTA_KEYS,
    },
    signalCount:      countMeaningfulSignals(input),
    historyAvailable: input.history.fromDatabase,
  };
}

/**
 * Counts the number of non-trivial visitor signals present in the input.
 *
 * "Trivial" means: unknown source, new visit with no UTM, absent referrer,
 * absent UTM params, and no database history.
 *
 * Used to estimate how much the model has to work with.  Mirrors the spirit
 * of measureContextRichness() in ai-confidence-policy.ts but expressed as
 * a count rather than a normalised score.
 */
function countMeaningfulSignals(input: DecisionInput): number {
  let count = 0;

  if (input.source !== "unknown")    count += 1;
  if (input.visitType === "returning") count += 1;
  if (input.referrerDomain !== null) count += 1;

  // UTM attribution counts as one signal even if multiple params are present
  if (
    input.utmSource   !== null ||
    input.utmMedium   !== null ||
    input.utmCampaign !== null ||
    input.utmContent  !== null ||
    input.utmTerm     !== null
  ) {
    count += 1;
  }

  // History signals
  if (input.history.fromDatabase) {
    if (input.history.pageViewCount > 0) count += 1;
    if (input.history.hasClickedCta)     count += 1;
    if (input.history.lastHeroKey !== null) count += 1;
  }

  return count;
}

// ── Variant descriptions ──────────────────────────────────────────────────────
// Derived from the JSDoc comments in decision/types.ts.
// Kept here rather than in types.ts so they remain prompt-specific copy —
// type comments and prompt copy have different audiences and may evolve
// independently.

const HERO_DESCRIPTIONS: Record<string, string> = {
  hero_google_problem:
    '"Are you leaving conversion on the table?" — for search-intent / problem-aware visitors arriving via Google.',
  hero_linkedin_vision:
    '"The future of website personalisation is here." — for thought-leadership / social visitors arriving via LinkedIn.',
  hero_direct_brand:
    '"Your website, tailored to every visitor." — for direct or unattributed traffic; leads with brand.',
};

const PROOF_DESCRIPTIONS: Record<string, string> = {
  proof_cases:
    "Concrete case studies and ROI numbers — resonates with problem-solvers who need justification.",
  proof_vision:
    "Analyst quotes and industry recognition — resonates with thought-leaders and evaluators scanning the market.",
  proof_platform:
    "Platform scale and reliability stats — resonates with technical evaluators assessing the product.",
};

const CTA_DESCRIPTIONS: Record<string, string> = {
  cta_guide:
    '"Get the free personalisation guide" — low-commitment, educational offer for early-stage / nurture intent.',
  cta_platform:
    '"Start building for free" — product-led offer for visitors with product intent.',
  cta_meeting:
    '"Book a 20-minute intro call" — relationship offer for sales-ready or brand-led visitors.',
};
