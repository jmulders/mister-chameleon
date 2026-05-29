/**
 * AI Field Fill — Apply
 *
 * The main orchestration function for Phase 2 AI field fill.
 *
 * ─── What this module does ────────────────────────────────────────────────────
 *
 *   runFieldFill() takes a fetched CMS block data object and, when field fill
 *   is configured and enabled for that slot:
 *
 *     1. Extracts the current text values of eligible fields from the block.
 *     2. Builds a FieldFillInput from the DecisionInput + SlotFieldFillConfig.
 *     3. Builds a prompt and calls the AI model (via the adapter passed in).
 *     4. Validates and sanitises the AI output.
 *     5. Applies the validated fields to the block data.
 *     6. Returns the modified block + a FieldFillTrace.
 *
 * ─── Fail-safe guarantee ──────────────────────────────────────────────────────
 *
 *   runFieldFill() NEVER throws.  Any failure at any step returns the original
 *   block data unchanged with fallbackReason set in the trace.  The homepage
 *   always renders — field fill is purely best-effort enhancement.
 *
 * ─── Supported field paths ────────────────────────────────────────────────────
 *
 *   hero:  "title", "subtitle", "tag", "ctas.0.label", "ctas.1.label"
 *   proof: "title", "items.0.title", "items.0.text", "items.1.title",
 *          "items.1.text", "items.2.title", "items.2.text"
 *   cta:   "title", "text", "cta.label"
 *
 * ─── AI adapter contract ──────────────────────────────────────────────────────
 *
 *   runFieldFill() accepts a minimal FieldFillAdapter interface rather than
 *   coupling to any concrete AI provider.  This keeps the module testable and
 *   provider-agnostic.  The adapter receives a FieldFillPrompt and returns a
 *   raw string (the model's response).
 */

import type { DecisionInput }              from "@/decision/types";
import type { HeroBlockData, ProofBlockData, CTABlockData } from "@/cms/types";
import type {
  FieldFillSpec,
  FieldFillInput,
  FieldFillTrace,
  FieldFillResult,
  SlotFieldFillConfig,
} from "./types";
import { buildFieldFillPrompt }            from "./field-fill-prompt";
import { validateFieldFillOutput }         from "./field-fill-validator";
import type { ResolvedAiPolicy }           from "@/ai/policy/types";
import { shouldCallAi }                    from "@/ai/policy/resolve-policy";

// ── Adapter interface ─────────────────────────────────────────────────────────

/**
 * Minimal interface for an AI adapter that can execute a field fill call.
 *
 * Concrete implementations (e.g. ClaudeFieldFillAdapter) are injected by the
 * caller — runFieldFill() never imports a specific AI provider.
 *
 * The adapter must NOT throw for expected errors (timeout, rate-limit, bad JSON).
 * Return null to signal failure — runFieldFill() will fall back to original content.
 */
export interface FieldFillAdapter {
  /**
   * Call the AI model and return its raw response string.
   *
   * @param systemMessage  The system prompt.
   * @param userMessage    The user turn.
   * @returns The raw model response, or null on failure.
   */
  callModel(
    systemMessage: string,
    userMessage:   string,
  ): Promise<string | null>;
}

// ── Public overloads ──────────────────────────────────────────────────────────

export function runFieldFill(
  slotType: "hero",
  data:     HeroBlockData,
  config:   SlotFieldFillConfig | undefined,
  input:    DecisionInput,
  adapter:  FieldFillAdapter | null,
  policy?:  ResolvedAiPolicy | null,
): Promise<FieldFillResult<HeroBlockData>>;

export function runFieldFill(
  slotType: "proof",
  data:     ProofBlockData,
  config:   SlotFieldFillConfig | undefined,
  input:    DecisionInput,
  adapter:  FieldFillAdapter | null,
  policy?:  ResolvedAiPolicy | null,
): Promise<FieldFillResult<ProofBlockData>>;

export function runFieldFill(
  slotType: "cta",
  data:     CTABlockData,
  config:   SlotFieldFillConfig | undefined,
  input:    DecisionInput,
  adapter:  FieldFillAdapter | null,
  policy?:  ResolvedAiPolicy | null,
): Promise<FieldFillResult<CTABlockData>>;

// ── Public implementation ─────────────────────────────────────────────────────

/**
 * Run AI field fill for one CMS slot.
 *
 * @param slotType  Which core slot ("hero" | "proof" | "cta").
 * @param data      The fetched CMS block data.
 * @param config    The slot's field fill config from TenantSettings.fieldFill.
 *                  Pass undefined when field fill is not configured for this slot.
 * @param input     The visitor decision input (for context signals).
 * @param adapter   The AI adapter to call.  Pass null when AI is globally disabled.
 *
 * @returns  FieldFillResult with the (potentially modified) block data + trace.
 *           Never rejects.
 */
export async function runFieldFill(
  slotType: "hero" | "proof" | "cta",
  data:     HeroBlockData | ProofBlockData | CTABlockData,
  config:   SlotFieldFillConfig | undefined,
  input:    DecisionInput,
  adapter:  FieldFillAdapter | null,
  policy?:  ResolvedAiPolicy | null,
): Promise<FieldFillResult<HeroBlockData | ProofBlockData | CTABlockData>> {
  const variantKey = data.id;

  // ── Guard: policy disabled ─────────────────────────────────────────────────
  // Phase 3: if a policy is provided and mode is disabled, skip AI entirely.
  if (policy && !shouldCallAi(policy)) {
    return makePassThrough(slotType, variantKey, data, "policy_disabled");
  }

  // ── Guard: adapter absent = AI globally disabled ───────────────────────────
  if (!adapter) {
    return makePassThrough(slotType, variantKey, data, "ai_global_disabled");
  }

  // ── Guard: config absent or disabled ──────────────────────────────────────
  if (!config?.enabled) {
    return makePassThrough(slotType, variantKey, data, "slot_disabled");
  }

  // ── Extract eligible fields ───────────────────────────────────────────────
  const eligibleFields = buildEligibleFields(config.fields);
  if (Object.keys(eligibleFields).length === 0) {
    return makePassThrough(slotType, variantKey, data, "no_eligible_fields");
  }

  // ── Extract current field values from the CMS block ───────────────────────
  const fallbackContent = extractFieldValues(slotType, data, eligibleFields);

  // ── Build AI input ────────────────────────────────────────────────────────
  const fillInput: FieldFillInput = {
    slotType,
    variantKey,
    matchedContexts: buildContextSignals(input),
    goal:            deriveGoal(input, slotType),
    audienceHints:   buildAudienceHints(input),
    tonePreset:      "professional and conversion-focused",
    allowedFields:   eligibleFields,
    fallbackContent,
  };

  // ── Call AI ───────────────────────────────────────────────────────────────
  let rawResponse: string | null = null;
  try {
    const prompt  = buildFieldFillPrompt(fillInput);
    rawResponse   = await adapter.callModel(prompt.systemMessage, prompt.userMessage);
  } catch {
    return makePassThrough(slotType, variantKey, data, "ai_error");
  }

  if (rawResponse === null) {
    return makePassThrough(slotType, variantKey, data, "ai_error");
  }

  // ── Validate AI output ────────────────────────────────────────────────────
  const validation = validateFieldFillOutput(rawResponse, eligibleFields);
  if (!validation.ok) {
    return makePassThrough(slotType, variantKey, data, `validation_failure: ${validation.reason}`);
  }

  const { fields: aiFields, confidence } = validation.output;

  // ── Shadow mode (Phase 3): run AI but do NOT apply output ─────────────────
  if (policy?.mode === "shadow") {
    // AI ran and we have valid output — record it in the trace but serve original
    const shadowTrace: FieldFillTrace = {
      slotType,
      variantKey,
      aiUsed:         true,
      confidence,
      fallbackReason: "policy_shadow",
      modifiedFields: [],
      originalValues: {},
      aiValues:       aiFields,   // recorded so debug can show what AI suggested
      finalValues:    {},
    };
    return { data: data as HeroBlockData | ProofBlockData | CTABlockData, trace: shadowTrace };
  }

  // ── Confidence gating ─────────────────────────────────────────────────────
  // Phase 3: prefer policy threshold; fall back to per-slot config threshold.
  const effectiveThreshold =
    policy?.confidenceThreshold ?? config.confidenceThreshold;

  if (
    effectiveThreshold !== undefined &&
    (confidence === undefined || confidence < effectiveThreshold)
  ) {
    return makePassThrough(slotType, variantKey, data, "confidence_below_threshold");
  }

  // ── Nothing to apply ─────────────────────────────────────────────────────
  if (Object.keys(aiFields).length === 0) {
    return makePassThrough(slotType, variantKey, data, "ai_no_fields_returned");
  }

  // ── Apply fields to block data ────────────────────────────────────────────
  const { updated, appliedFields } = applyFields(slotType, data, aiFields, fallbackContent);

  const trace: FieldFillTrace = {
    slotType,
    variantKey,
    aiUsed:         true,
    confidence,
    fallbackReason: null,
    modifiedFields: Object.keys(appliedFields),
    originalValues: Object.fromEntries(
      Object.keys(appliedFields).map((k) => [k, fallbackContent[k] ?? ""]),
    ),
    aiValues:       aiFields,
    finalValues:    appliedFields,
  };

  return { data: updated, trace };
}

// ── Field extraction ──────────────────────────────────────────────────────────

/**
 * Extract the current text values for the eligible fields from a CMS block.
 *
 * Returns a flat map of fieldPath → currentValue.
 * Missing optional fields (e.g. tag) produce an empty string.
 */
function extractFieldValues(
  slotType: "hero" | "proof" | "cta",
  data:     HeroBlockData | ProofBlockData | CTABlockData,
  fields:   Record<string, FieldFillSpec>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const fieldPath of Object.keys(fields)) {
    result[fieldPath] = getNestedField(slotType, data, fieldPath) ?? "";
  }

  return result;
}

/**
 * Read a nested field value from a CMS block by dotted path.
 *
 * Supported paths per slot type:
 *   hero:  title, subtitle, tag, ctas.N.label
 *   proof: title, items.N.title, items.N.text
 *   cta:   title, text, cta.label
 *
 * Returns undefined when the path does not resolve.
 */
function getNestedField(
  slotType: "hero" | "proof" | "cta",
  data:     HeroBlockData | ProofBlockData | CTABlockData,
  path:     string,
): string | undefined {
  switch (slotType) {
    case "hero": {
      const hero = data as HeroBlockData;
      if (path === "title")    return hero.title;
      if (path === "subtitle") return hero.subtitle;
      if (path === "tag")      return hero.tag ?? "";
      const ctaMatch = path.match(/^ctas\.(\d+)\.label$/);
      if (ctaMatch) {
        const idx = parseInt(ctaMatch[1]!, 10);
        return hero.ctas[idx]?.label;
      }
      return undefined;
    }
    case "proof": {
      const proof = data as ProofBlockData;
      if (path === "title") return proof.title;
      const itemMatch = path.match(/^items\.(\d+)\.(title|text)$/);
      if (itemMatch) {
        const idx   = parseInt(itemMatch[1]!, 10);
        const field = itemMatch[2] as "title" | "text";
        return proof.items[idx]?.[field];
      }
      return undefined;
    }
    case "cta": {
      const cta = data as CTABlockData;
      if (path === "title")     return cta.title;
      if (path === "text")      return cta.text;
      if (path === "cta.label") return cta.cta.label;
      return undefined;
    }
  }
}

// ── Field application ─────────────────────────────────────────────────────────

/**
 * Apply validated AI field values to a CMS block, returning the updated block
 * and a map of actually-applied field values (for the trace).
 *
 * Uses shallow spread for top-level fields and reconstructs nested arrays/objects
 * surgically to avoid mutating the original block.
 */
function applyFields(
  slotType: "hero" | "proof" | "cta",
  data:     HeroBlockData | ProofBlockData | CTABlockData,
  aiFields: Record<string, string>,
  _fallback: Record<string, string>,
): { updated: HeroBlockData | ProofBlockData | CTABlockData; appliedFields: Record<string, string> } {
  const appliedFields: Record<string, string> = {};

  switch (slotType) {
    case "hero": {
      const hero   = data as HeroBlockData;
      let updated  = { ...hero };

      for (const [path, value] of Object.entries(aiFields)) {
        if (path === "title") {
          updated           = { ...updated, title: value };
          appliedFields[path] = value;
        } else if (path === "subtitle") {
          updated           = { ...updated, subtitle: value };
          appliedFields[path] = value;
        } else if (path === "tag") {
          updated           = { ...updated, tag: value };
          appliedFields[path] = value;
        } else {
          const ctaMatch = path.match(/^ctas\.(\d+)\.label$/);
          if (ctaMatch) {
            const idx       = parseInt(ctaMatch[1]!, 10);
            const newCtas   = [...hero.ctas] as typeof hero.ctas extends readonly (infer T)[] ? T[] : never[];
            if (newCtas[idx]) {
              (newCtas[idx] as { label: string }).label = value;
              updated           = { ...updated, ctas: newCtas };
              appliedFields[path] = value;
            }
          }
        }
      }

      return { updated, appliedFields };
    }

    case "proof": {
      const proof  = data as ProofBlockData;
      // Deep-clone items array so we can mutate it
      const items  = proof.items.map((item) => ({ ...item }));
      let titleSet = false;

      for (const [path, value] of Object.entries(aiFields)) {
        if (path === "title") {
          titleSet = true;
          appliedFields[path] = value;
        } else {
          const itemMatch = path.match(/^items\.(\d+)\.(title|text)$/);
          if (itemMatch) {
            const idx   = parseInt(itemMatch[1]!, 10);
            const field = itemMatch[2] as "title" | "text";
            if (items[idx]) {
              items[idx]![field]  = value;
              appliedFields[path] = value;
            }
          }
        }
      }

      const updated: ProofBlockData = {
        ...proof,
        ...(titleSet ? { title: aiFields["title"]! } : {}),
        items,
      };

      return { updated, appliedFields };
    }

    case "cta": {
      const cta    = data as CTABlockData;
      let updated  = { ...cta };

      for (const [path, value] of Object.entries(aiFields)) {
        if (path === "title") {
          updated           = { ...updated, title: value };
          appliedFields[path] = value;
        } else if (path === "text") {
          updated           = { ...updated, text: value };
          appliedFields[path] = value;
        } else if (path === "cta.label") {
          updated           = { ...updated, cta: { ...cta.cta, label: value } };
          appliedFields[path] = value;
        }
      }

      return { updated, appliedFields };
    }
  }
}

// ── Context signal builders ───────────────────────────────────────────────────

/**
 * Build a list of human-readable context signals from the DecisionInput.
 * Strips all PII — only structural signals (source, device, visit type, etc.).
 */
function buildContextSignals(input: DecisionInput): string[] {
  const signals: string[] = [];

  if (input.source)    signals.push(`source: ${input.source}`);
  if (input.device)    signals.push(`device: ${input.device}`);
  if (input.visitType) signals.push(`visitType: ${input.visitType}`);
  if (input.utmSource)   signals.push(`utmSource: ${input.utmSource}`);
  if (input.utmCampaign) signals.push(`utmCampaign: ${input.utmCampaign}`);

  const journey = input.history.journey;
  if (journey?.funnelStage)    signals.push(`funnelStage: ${journey.funnelStage}`);
  if (journey?.intentScore != null && journey.intentScore > 0) {
    signals.push(`intentScore: ${journey.intentScore}`);
  }

  return signals;
}

/**
 * Build audience hints from enrichment data and journey state.
 * The DecisionInput may carry enrichment as a runtime extension — cast safely.
 */
function buildAudienceHints(input: DecisionInput): string[] {
  const hints: string[] = [];

  const ctx = input as DecisionInput & {
    enrichment?: Record<string, unknown>;
  };
  const enrichment = ctx.enrichment ?? {};

  if (typeof enrichment.companyIndustry === "string") {
    hints.push(`industry: ${enrichment.companyIndustry}`);
  }
  if (typeof enrichment.companyName === "string") {
    hints.push(`company: ${enrichment.companyName}`);
  }
  if (typeof enrichment.crmLifecycleStage === "string") {
    hints.push(`lifecycleStage: ${enrichment.crmLifecycleStage}`);
  }
  if (input.visitType === "returning") {
    hints.push("returning visitor");
  }

  const journey = input.history.journey;
  if (journey?.funnelStage === "high_intent") {
    hints.push("high-purchase-intent visitor");
  } else if (journey?.intentScore != null && journey.intentScore >= 50) {
    hints.push("medium-to-high intent");
  }

  return hints;
}

/**
 * Derive a simple goal string for the field fill prompt.
 * Falls back to a generic goal per slot type.
 */
function deriveGoal(input: DecisionInput, slotType: "hero" | "proof" | "cta"): string {
  // Future: read from variant decisionMeta.goal when available
  switch (slotType) {
    case "hero":  return "drive visitors to start a trial or book a demo";
    case "proof": return "build trust and credibility with relevant proof points";
    case "cta":   return "convert visitors to a clear next action";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Filter down to only fields with aiEnabled=true. */
function buildEligibleFields(
  fields: Record<string, FieldFillSpec>,
): Record<string, FieldFillSpec> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, spec]) => spec.aiEnabled),
  );
}

/** Build a pass-through result (original data, aiUsed=false). */
function makePassThrough<T extends HeroBlockData | ProofBlockData | CTABlockData>(
  slotType: "hero" | "proof" | "cta",
  variantKey: string,
  data: T,
  reason: string,
): FieldFillResult<T> {
  return {
    data,
    trace: {
      slotType,
      variantKey,
      aiUsed:         false,
      confidence:     undefined,
      fallbackReason: reason,
      modifiedFields: [],
      originalValues: {},
      aiValues:       {},
      finalValues:    {},
    },
  };
}
