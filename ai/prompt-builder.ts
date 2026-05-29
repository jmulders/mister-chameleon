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
 *   AI-ready gating Only variants with complete decision metadata (aiReady ===
 *                   true) are included in the system prompt.  Variants without
 *                   metadata are silently excluded — the AI never sees them.
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
 *   ai/variant-meta.ts               VariantCandidate / SlotCandidates types
 *   ai/variant-registry.ts           Platform defaults (always aiReady)
 *   ai/resolve-variant-candidates.ts Merge platform + CMS tenant variants
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
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import type { SlotCandidates, VariantCandidate } from "@/ai/variant-meta";
import {
  filterAiReady,
  platformOnlyCandidates,
} from "@/ai/resolve-variant-candidates";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import {
  ALLOWED_THEME_KEYS,
  THEME_DECISION_META,
  type ThemeDecisionMeta,
} from "@/ai/theme-meta";

/**
 * A superset of DecisionInput that includes all enriched context layers.
 *
 * The prompt builder accepts this type so callers passing a full
 * RuleEvaluationContext (enrichment + time + derived + interests) get the
 * richest possible prompt.  Callers that only have a DecisionInput still
 * work — the extra fields simply aren't present and their prompt sections
 * are omitted.
 */
type EnrichedDecisionInput = DecisionInput & Partial<Pick<RuleEvaluationContext,
  | "enrichment"
  | "currentHour"
  | "dayOfWeek"
  | "timeOfDay"
  | "isWeekend"
  | "seasonalEvent"
  | "derived"
  | "clientContext"
  | "interestContext"
  | "pageType"
  | "templateKey"
  | "tenantId"
>>;

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * The prompt pair returned by buildHomepagePrompt().
 *
 * Providers receive both parts and map them to their message format.
 * The system prompt is per-tenant (depends on resolved variant candidates);
 * only the user prompt changes per visitor request.
 */
export interface BuiltPrompt {
  /**
   * The system prompt.
   *
   * Contains the model's role, the full AI-ready variant vocabulary with
   * rich decision metadata, and the strict JSON output schema.  Stable for
   * a given tenant's variant configuration — can be cached per tenant.
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
   * Only aiReady variant keys are present.
   * Use these to validate the model's response before passing it to the
   * confidence policy — a key outside these sets is an instant validity failure.
   */
  allowedKeys: {
    hero:  readonly string[];
    proof: readonly string[];
    cta:   readonly string[];
  };

  /**
   * All ThemePresetKey values included in the system prompt's theme section.
   *
   * The model's `themeKey` response is a soft gate — an unknown key falls back
   * to the rule-selected or tenant-default theme rather than rejecting the plan.
   * These keys are provided so callers can quickly validate the response without
   * re-importing ALLOWED_THEME_KEYS.
   */
  allowedThemeKeys: readonly ThemePresetKey[];

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

  /**
   * Count of aiReady candidates per slot included in this prompt.
   * Useful for audit logging — reveals how many options the AI had.
   */
  aiReadyCandidateCounts: {
    hero:  number;
    proof: number;
    cta:   number;
  };
}

// ── Candidate resolution ──────────────────────────────────────────────────────

/**
 * Resolves the effective SlotCandidates for a given DecisionInput.
 *
 * Uses `input.variantCandidates` when provided (merged platform + tenant CMS),
 * falls back to the platform-only registry for full backward compatibility.
 */
function resolveCandidates(input: DecisionInput): SlotCandidates {
  return input.variantCandidates ?? platformOnlyCandidates();
}

// ── Variant formatting ────────────────────────────────────────────────────────

/**
 * Formats a single aiReady VariantCandidate as a block for the system prompt.
 *
 * Example output:
 *   hero_google_problem
 *     Label:     Google — Problem Aware
 *     For:       Paid or organic search visitors who searched a problem keyword...
 *     Intent:    consideration
 *     Funnel:    awareness, consideration
 *     Sources:   google
 *     Tone:      educational
 *     Goal:      Convert anonymous search intent into a qualified lead or sign-up.
 *     Avoid if:  Visitor is already a known customer; Source is LinkedIn
 */
function formatCandidate(c: VariantCandidate): string {
  const m = c.decisionMeta!; // aiReady candidates always have non-null meta
  const lines: string[] = [`  ${c.key}`];

  lines.push(`    Label:     ${m.decisionLabel}`);
  lines.push(`    Summary:   ${m.decisionSummary}`);
  lines.push(`    For:       ${m.intendedAudience}`);
  lines.push(`    Intent:    ${m.intentLevel}`);
  lines.push(`    Funnel:    ${m.funnelStages.join(", ")}`);
  lines.push(`    Sources:   ${m.bestForSources.join(", ")}`);
  lines.push(`    Tone:      ${m.tone}`);
  lines.push(`    Goal:      ${m.primaryGoal}`);

  if (m.supportingGoals.length > 0) {
    lines.push(`    Also:      ${m.supportingGoals.join("; ")}`);
  }

  if (m.exclusions.length > 0) {
    lines.push(`    Avoid if:  ${m.exclusions.join("; ")}`);
  }

  return lines.join("\n");
}

function formatSlot(
  label: string,
  candidates: VariantCandidate[],
): string {
  const ready = filterAiReady(candidates);
  const formatted = ready.map(formatCandidate).join("\n\n");
  return `${label} variants — choose exactly one:\n${formatted}`;
}

// ── Theme candidate formatting ────────────────────────────────────────────────

/**
 * Formats a single ThemePresetKey and its metadata for the system prompt.
 *
 * Example output:
 *   enterprise-clean
 *     Label:       Enterprise Clean
 *     Summary:     A restrained slate-grey palette that projects technical seriousness.
 *     Personality: restrained, technical, authoritative, precise
 *     Best for:    linkedin, direct, partner sources
 *     Funnel:      consideration, decision
 *     Use cases:   B2B enterprise software, fintech, developer tools
 *     Best when:   Visitor is from LinkedIn with enterprise evaluation context
 *     Avoid if:    Consumer app context; Campaign is playful or launch-energy
 */
function formatThemeCandidate(key: ThemePresetKey, meta: ThemeDecisionMeta): string {
  const lines: string[] = [`  ${key}`];
  lines.push(`    Label:       ${meta.label}`);
  lines.push(`    Summary:     ${meta.summary}`);
  lines.push(`    Personality: ${meta.personality}`);
  lines.push(`    Best for:    ${meta.bestForSources.join(", ")} sources`);
  lines.push(`    Funnel:      ${meta.bestForFunnel.join(", ")}`);
  lines.push(`    Use cases:   ${meta.intendedUse.join("; ")}`);
  if (meta.contextualFit.length > 0) {
    lines.push(`    Best when:   ${meta.contextualFit[0]}`);
    for (let i = 1; i < meta.contextualFit.length; i++) {
      lines.push(`                 ${meta.contextualFit[i]}`);
    }
  }
  if (meta.disqualifiers.length > 0) {
    lines.push(`    Avoid if:    ${meta.disqualifiers.join("; ")}`);
  }
  return lines.join("\n");
}

/**
 * Formats all theme candidates into the THEME VOCABULARY section.
 *
 * All 20 presets are always included — theme selection is less sensitive to
 * sparse context than variant selection, and we want the model to see the
 * full range of options to make meaningful choices.
 */
function buildThemeSection(): string {
  const entries = ALLOWED_THEME_KEYS
    .map((key) => formatThemeCandidate(key, THEME_DECISION_META[key]))
    .join("\n\n");

  return `THEME — choose one, or omit to preserve the tenant default:\n${entries}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * Returns the system prompt for the given SlotCandidates.
 *
 * The prompt is stable for a given tenant's variant configuration and can be
 * cached per tenant.  Pass the result of `resolveCandidates(input)` here.
 *
 * Only aiReady variants are included — variants without complete decision
 * metadata are silently excluded and never presented to the AI.
 */
export function buildSystemPrompt(candidates: SlotCandidates): string {
  const heroSection  = formatSlot("HERO",  candidates.hero);
  const proofSection = formatSlot("PROOF", candidates.proof);
  const ctaSection   = formatSlot("CTA",   candidates.cta);
  const themeSection = buildThemeSection();

  const heroKeys  = filterAiReady(candidates.hero).map((c) => c.key);
  const proofKeys = filterAiReady(candidates.proof).map((c) => c.key);
  const ctaKeys   = filterAiReady(candidates.cta).map((c) => c.key);
  const themeKeys = [...ALLOWED_THEME_KEYS];

  return `\
You are a homepage personalisation engine for Mister Chameleon, a B2B SaaS platform.

Your job is to select the optimal homepage experience plan for a single visitor based on their context signals and behavioural history. The plan controls which content variants are shown in three page sections (hero, proof, CTA) and optionally the visual theme applied to the page.

=== VARIANT VOCABULARY ===

Each variant below includes:
  - Label:     Short name for this variant
  - Summary:   What it communicates
  - For:       Ideal visitor profile
  - Intent:    Buyer journey stage (awareness / consideration / decision)
  - Funnel:    Which funnel stages it fits
  - Sources:   Traffic sources it performs best for
  - Tone:      Rhetorical tone
  - Goal:      Primary conversion goal
  - Also:      Supporting goals (when present)
  - Avoid if:  Hard disqualifiers — do not choose this variant if any apply

${heroSection}

${proofSection}

${ctaSection}

=== THEME VOCABULARY ===

The theme controls the visual presentation of the entire page — colours, typography, spacing, and layout personality. A well-matched theme reinforces the content variant's message and creates a coherent first impression.

Each theme below includes:
  - Label:       Short display name
  - Summary:     What this theme communicates to the visitor
  - Personality: Tonal adjectives
  - Best for:    Traffic sources where this theme performs best
  - Funnel:      Buyer journey stages it fits
  - Use cases:   Industries and product types it is designed for
  - Best when:   Contextual signals that make this theme a strong choice
  - Avoid if:    Hard disqualifiers — do not choose if any apply

Theme selection is OPTIONAL and SOFT: only suggest a theme when you have clear contextual evidence that it will meaningfully improve the visitor experience. If signals are ambiguous or the tenant's default theme is already appropriate, omit "themeKey" from the response.

The tenant's configured theme rules (date/time/campaign rules) take priority over AI suggestions. Only suggest a theme when you have strong enough signal to override the configured rules.

${themeSection}

=== DECISION PRINCIPLES ===

Variant selection:
- Match the visitor's intent. Traffic source and UTM parameters are the strongest signals.
- Respect all "Avoid if" disqualifiers — they are hard rules, not suggestions.
- Reinforce continuity for returning visitors. If they previously saw a specific hero or CTA, prefer consistency unless a stronger signal suggests a change.
- Prefer action-oriented CTAs (cta_guide, cta_platform) for new/exploratory visitors.
- Prefer relationship-oriented CTAs (cta_meeting) for returning visitors who have already engaged.
- When signals are weak or absent, default to the brand experience: hero_direct_brand, proof_platform, cta_meeting.
- Only choose from the variant keys listed above — any other key is invalid.

Theme selection:
- Only suggest a theme when you have clear contextual evidence: industry signal, campaign type, time of day, or strong source + funnel alignment.
- Prefer themes that reinforce the selected content variants (e.g. enterprise-clean + enterprise-focused hero).
- Respect all theme "Avoid if" disqualifiers.
- When uncertain, omit themeKey entirely — the tenant's configured theme or rules will apply.
- A theme suggestion is a soft override: an invalid or missing themeKey does not affect variant selection.

=== OUTPUT FORMAT ===

Respond with ONLY a single JSON object. No markdown. No code blocks. No text before or after the JSON.

The object must match this schema exactly:
{
  "heroKey":   "<one value from: ${heroKeys.join(", ")}>",
  "proofKey":  "<one value from: ${proofKeys.join(", ")}>",
  "ctaKey":    "<one value from: ${ctaKeys.join(", ")}>",
  "themeKey":  "<optional — one value from: ${themeKeys.join(", ")}, or omit this field entirely>",
  "reason":    "<one or two sentences explaining your variant selection and, if themeKey is present, why that theme was chosen>",
  "confidence": <float between 0.0 and 1.0>
}

Rules:
- heroKey, proofKey, and ctaKey must be exactly one of the allowed values enumerated above. Any other value is invalid.
- themeKey is OPTIONAL. Include it only when you have clear contextual evidence for a theme choice. Omit the field entirely when uncertain.
- If themeKey is included, it must be exactly one of the allowed theme values above. An invalid theme key will be silently ignored — it will not affect variant selection.
- reason must be a concise, human-readable explanation (not a JSON object).
- confidence must reflect your genuine certainty about the VARIANT selection: use 0.4–0.6 when signals are sparse or ambiguous, 0.7–0.85 for typical clear-signal cases, and 0.9+ only when the signals strongly and unambiguously favour one combination.`;
}

// ── User prompt (per-request) ─────────────────────────────────────────────────

/**
 * Returns the per-request user prompt for a specific EnrichedDecisionInput.
 *
 * Includes all available context layers:
 *   - Traffic + device
 *   - UTM attribution
 *   - Behavioural history
 *   - Enrichment: geo, company firmographics, CRM lifecycle, ABM
 *   - Time context: day of week, time of day, seasonal events
 *   - Derived signals: funnel stage, channel group, company type
 *   - Interest profiles: primary, secondary, confidence
 *   - Page context: page type
 *
 * Sections are omitted when data is absent — the prompt only includes what
 * is actually known about this visitor.
 */
export function buildUserPrompt(input: EnrichedDecisionInput): string {
  const lines: string[] = ["=== VISITOR SIGNALS ===", ""];

  // ── Traffic and device ─────────────────────────────────────────────────────
  lines.push(`Source:       ${input.source}`);
  lines.push(`Device:       ${input.device}`);
  lines.push(`Visit type:   ${input.visitType}`);

  // Channel group / campaign type from derived context (more descriptive than raw source)
  const channelGroup = input.derived?.channelGroup ?? null;
  if (channelGroup && channelGroup !== "direct") {
    lines.push(`Channel:      ${channelGroup}`);
  }

  // ── Attribution (UTM / referrer) ───────────────────────────────────────────
  const hasUtm =
    input.utmSource   !== null ||
    input.utmMedium   !== null ||
    input.utmCampaign !== null ||
    input.utmContent  !== null ||
    input.utmTerm     !== null;

  if (hasUtm) {
    lines.push("");
    lines.push("UTM attribution:");
    if (input.utmSource   !== null) lines.push(`  utm_source:   ${input.utmSource.toLowerCase()}`);
    if (input.utmMedium   !== null) lines.push(`  utm_medium:   ${input.utmMedium.toLowerCase()}`);
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

  // ── Funnel stage (derived) ─────────────────────────────────────────────────
  const funnelStage    = input.derived?.funnelStage    ?? null;
  const engagementScore = input.derived?.engagementScore ?? null;

  if (funnelStage) {
    lines.push("");
    lines.push("Funnel signals:");
    lines.push(`  Funnel stage:     ${funnelStage}`);
    if (engagementScore !== null) {
      lines.push(`  Engagement score: ${engagementScore.toFixed(2)} / 1.00`);
    }
  }

  // ── Enrichment: geo ────────────────────────────────────────────────────────
  const e = input.enrichment ?? {};
  const city    = (e as Record<string, unknown>)["currentCity"]    ?? (e as Record<string, unknown>)["city"]    ?? null;
  const country = (e as Record<string, unknown>)["currentCountry"] ?? (e as Record<string, unknown>)["countryCode"] ?? null;
  const region  = (e as Record<string, unknown>)["currentRegion"]  ?? (e as Record<string, unknown>)["region"]  ?? null;

  if (city || country) {
    lines.push("");
    lines.push("Visitor location:");
    if (city)    lines.push(`  City:    ${city}`);
    if (region)  lines.push(`  Region:  ${region}`);
    if (country) lines.push(`  Country: ${country}`);
  }

  // ── Enrichment: company firmographics ─────────────────────────────────────
  const companyName     = (e as Record<string, unknown>)["companyName"]     ?? null;
  const companyIndustry = (e as Record<string, unknown>)["companyIndustry"] ?? null;
  const companySize     = (e as Record<string, unknown>)["companySize"]     ?? null;
  const companyType     = input.derived?.companyType ?? null;

  if (companyName || companyIndustry) {
    lines.push("");
    lines.push("Company (reverse-IP):");
    if (companyName)     lines.push(`  Company:  ${companyName}`);
    if (companyIndustry) lines.push(`  Industry: ${companyIndustry}`);
    if (companySize)     lines.push(`  Size:     ${companySize}`);
    if (companyType)     lines.push(`  Type:     ${companyType}`);
  }

  // ── Enrichment: CRM intent ────────────────────────────────────────────────
  const crmLifecycleStage = (e as Record<string, unknown>)["crmLifecycleStage"] ?? null;
  const crmSegment        = (e as Record<string, unknown>)["crmSegment"]        ?? null;
  const crmMatched        = (e as Record<string, unknown>)["crmMatched"]        ?? null;

  if (crmMatched) {
    lines.push("");
    lines.push("CRM identity (matched):");
    if (crmLifecycleStage) lines.push(`  Lifecycle stage: ${crmLifecycleStage}`);
    if (crmSegment)        lines.push(`  Segment:         ${crmSegment}`);
  }

  // ── Enrichment: ABM (account-based) ──────────────────────────────────────
  const targetAccountMatched = (e as Record<string, unknown>)["targetAccountMatched"] ?? null;
  const targetAccountTier    = (e as Record<string, unknown>)["targetAccountTier"]    ?? null;

  if (targetAccountMatched) {
    lines.push("");
    lines.push(`ABM: this visitor is from a target account.${targetAccountTier ? ` Tier: ${targetAccountTier}.` : ""}`);
  }

  // ── Time context ──────────────────────────────────────────────────────────
  const dayOfWeek    = input.dayOfWeek    ?? null;
  const timeOfDay    = input.timeOfDay    ?? null;
  const isWeekend    = input.isWeekend    ?? null;
  const seasonalEvent = input.seasonalEvent ?? null;

  if (dayOfWeek || timeOfDay) {
    lines.push("");
    lines.push("Time context:");
    if (dayOfWeek) lines.push(`  Day:       ${dayOfWeek}${isWeekend ? " (weekend)" : ""}`);
    if (timeOfDay) lines.push(`  Time:      ${timeOfDay}`);
    if (input.derived?.isWorkHours !== undefined && input.derived?.isWorkHours !== null) {
      lines.push(`  Work hours: ${input.derived.isWorkHours ? "yes" : "no"}`);
    }
    if (seasonalEvent && seasonalEvent !== "none") {
      lines.push(`  Season/event: ${seasonalEvent}`);
    }
  }

  // ── Interest profiles ─────────────────────────────────────────────────────
  const ic = input.interestContext ?? null;

  if (ic && ic.interestConfidence > 0) {
    lines.push("");
    lines.push("Visitor interest signals (scored against platform interest profiles):");
    lines.push(`  Primary interest:    ${ic.interestPrimary} (confidence: ${ic.interestConfidence.toFixed(2)})`);
    if (ic.interestSecondary) {
      lines.push(`  Secondary interest: ${ic.interestSecondary}`);
    }
    if (Object.keys(ic.perProfile).length > 1) {
      const topN = Object.entries(ic.perProfile)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([key, score]) => `${key}: ${score.toFixed(2)}`)
        .join(", ");
      lines.push(`  Per-profile scores: ${topN}`);
    }
  }

  // ── Page context ──────────────────────────────────────────────────────────
  const pageType = input.pageType ?? null;
  if (pageType && pageType !== "homepage") {
    lines.push("");
    lines.push(`Page type: ${pageType}`);
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
 * The systemPrompt is stable per tenant variant configuration and can be
 * cached per tenant; the userPrompt is per-request and must never be cached
 * across different visitors.
 *
 * Variant candidates are taken from `input.variantCandidates` when present
 * (merged platform + CMS tenant variants), falling back to the platform
 * registry when absent.  Only aiReady variants appear in the prompt.
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
export function buildHomepagePrompt(input: EnrichedDecisionInput): BuiltPrompt {
  const candidates = resolveCandidates(input);

  return {
    systemPrompt: buildSystemPrompt(candidates),
    userPrompt:   buildUserPrompt(input),
    metadata:     buildMetadata(input, candidates),
  };
}

// ── Metadata builder ──────────────────────────────────────────────────────────

function buildMetadata(input: EnrichedDecisionInput, candidates: SlotCandidates): PromptBuildMetadata {
  const heroReady  = filterAiReady(candidates.hero);
  const proofReady = filterAiReady(candidates.proof);
  const ctaReady   = filterAiReady(candidates.cta);

  return {
    allowedKeys: {
      hero:  heroReady.map((c) => c.key),
      proof: proofReady.map((c) => c.key),
      cta:   ctaReady.map((c) => c.key),
    },
    allowedThemeKeys: ALLOWED_THEME_KEYS,
    signalCount:      countMeaningfulSignals(input),
    historyAvailable: input.history.fromDatabase,
    aiReadyCandidateCounts: {
      hero:  heroReady.length,
      proof: proofReady.length,
      cta:   ctaReady.length,
    },
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
function countMeaningfulSignals(input: EnrichedDecisionInput): number {
  let count = 0;

  // ── Base request signals ───────────────────────────────────────────────────
  if (input.source !== "unknown")       count += 1;
  if (input.visitType === "returning")  count += 1;
  if (input.referrerDomain !== null)    count += 1;

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

  // ── History signals ────────────────────────────────────────────────────────
  if (input.history.fromDatabase) {
    if (input.history.pageViewCount > 0)     count += 1;
    if (input.history.hasClickedCta)          count += 1;
    if (input.history.lastHeroKey !== null)   count += 1;
  }

  // ── Enrichment signals ─────────────────────────────────────────────────────
  const e = input.enrichment as Record<string, unknown> | undefined;
  if (e) {
    if (e["currentCity"] || e["city"])             count += 1;  // geo resolved
    if (e["companyName"])                          count += 1;  // company identified
    if (e["crmMatched"])                           count += 1;  // CRM contact matched
    if (e["targetAccountMatched"])                 count += 1;  // ABM target
  }

  // ── Derived signals ────────────────────────────────────────────────────────
  if (input.derived?.funnelStage && input.derived.funnelStage !== "awareness") {
    count += 1; // visitor is past awareness — higher value signal
  }

  // ── Interest signals ───────────────────────────────────────────────────────
  if (input.interestContext && input.interestContext.interestConfidence > 0) {
    count += 1;
  }

  return count;
}
