/**
 * AI Field Fill — Types
 *
 * Type definitions for Phase 2: AI-driven content field fill within a
 * previously selected variant.
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   Phase 1 selects WHICH variant to serve (hero_google_brand, cta_trial, …).
 *   Phase 2 fills individual TEXT FIELDS within that variant using AI, so the
 *   variant's words are contextualised to the specific visitor — without ever
 *   changing the variant's layout, structure, or key.
 *
 * ─── What AI may and may not do ──────────────────────────────────────────────
 *
 *   ✓ Replace individual text fields listed in allowedFields
 *   ✓ Respect per-field maxWords / maxChars / style constraints
 *   ✗ Change the variant key or layout
 *   ✗ Generate HTML, markdown, or structured data
 *   ✗ Add fields not declared in allowedFields
 *   ✗ Remove or null existing fields
 *
 * ─── Pipeline position ───────────────────────────────────────────────────────
 *
 *   Decision Engine (Phase 1) → CMS Fetch → AI Field Fill (Phase 2) → Render
 *
 *   Field fill runs AFTER the CMS variant is fetched so the AI receives the
 *   full CMS content as fallback values and context for its rewrites.
 *
 * ─── Configuration path ──────────────────────────────────────────────────────
 *
 *   TenantSettings.fieldFill                      — top-level switch
 *     └─ SlotFieldFillConfig (per slot)
 *          └─ FieldFillSpec  (per field)
 *
 * ─── Safety and fallback ─────────────────────────────────────────────────────
 *
 *   Any failure (AI timeout, invalid output, validation failure) causes the
 *   pipeline to fall back silently to the original CMS content.  The variant
 *   is ALWAYS served — field fill is best-effort enhancement only.
 */

// ── Field-level specification ─────────────────────────────────────────────────

/**
 * Per-field AI fill specification stored in the tenant config.
 *
 * Controls whether a specific text field in a CMS block may be rewritten
 * by AI, and what constraints apply to the output.
 *
 * Embedded in SlotFieldFillConfig.fields, keyed by field path.
 *
 * @example
 * // hero.title: allow AI, max 8 words, inspiring tone
 * { aiEnabled: true, maxWords: 8, style: "inspiring, benefit-focused" }
 *
 * // hero.tag: allow AI, max 5 words, short punchy label
 * { aiEnabled: true, maxWords: 5, style: "punchy, capitalised label" }
 */
export interface FieldFillSpec {
  /**
   * Whether AI may rewrite this field.
   *
   * When false, the field is included in allowedFields but will never be
   * sent to the AI (it is filtered out before the prompt is built).
   * Operators set this to false to lock individual fields.
   */
  aiEnabled: boolean;

  /**
   * Maximum word count for AI output for this field.
   *
   * Validation will truncate or reject outputs that exceed this.
   * undefined = no word limit (use maxChars alone, or neither).
   */
  maxWords?: number;

  /**
   * Maximum character count for AI output for this field.
   *
   * Applied after maxWords.  When both are set, the stricter limit wins.
   * undefined = no char limit.
   */
  maxChars?: number;

  /**
   * Tone or style guidance for this field.
   *
   * Injected verbatim into the AI prompt as a per-field instruction.
   * Keep it short and directive: "concise, professional", "punchy headline",
   * "active voice, under 6 words", etc.
   *
   * undefined = no additional style guidance beyond the slot-level tone preset.
   */
  style?: string;
}

// ── Slot-level configuration ──────────────────────────────────────────────────

/**
 * Per-slot AI field fill configuration stored in TenantSettings.fieldFill.
 *
 * Controls whether field fill is active for one core slot and which fields
 * within that slot may be AI-rewritten.
 */
export interface SlotFieldFillConfig {
  /**
   * Master switch for this slot.
   *
   * When false, the entire slot is skipped — no AI call is made, no fields
   * are modified, original CMS content is always served.
   */
  enabled: boolean;

  /**
   * Minimum AI confidence required to apply field fill for this slot.
   *
   * When the AI's self-reported confidence for the field fill call falls
   * below this value, the original CMS content is kept for ALL fields in
   * the slot (fail-safe behaviour).
   *
   * undefined = no gating (apply field fill regardless of confidence).
   * Recommended: 0.60–0.75 for production deployments.
   */
  confidenceThreshold?: number;

  /**
   * Per-field fill specs, keyed by field path.
   *
   * Supported field paths per slot:
   *   hero:  "title", "subtitle", "tag", "ctas.0.label", "ctas.1.label"
   *   proof: "title", "items.0.title", "items.0.text", "items.1.title",
   *          "items.1.text", "items.2.title", "items.2.text"
   *   cta:   "title", "text", "cta.label"
   *
   * Fields not listed here are never touched by AI.
   * Fields with aiEnabled=false are also never touched.
   */
  fields: Record<string, FieldFillSpec>;
}

// ── Top-level tenant config ───────────────────────────────────────────────────

/**
 * AI field fill configuration stored in TenantSettings.
 *
 * All slots optional — absent slot = field fill disabled for that slot.
 * This matches the backward-compatibility pattern used by adaptiveSlots.
 */
export interface TenantFieldFillSettings {
  hero?:  SlotFieldFillConfig;
  proof?: SlotFieldFillConfig;
  cta?:   SlotFieldFillConfig;
}

// ── AI call input ─────────────────────────────────────────────────────────────

/**
 * Input passed to the AI field fill call for one slot.
 *
 * Built by buildFieldFillInput() from the DecisionInput + CMS block data
 * + SlotFieldFillConfig.
 *
 * The AI receives exactly this shape — nothing from the raw DecisionInput
 * (no PII, no IP, no session tokens).
 */
export interface FieldFillInput {
  /** Which core slot this fill is for. */
  slotType: "hero" | "proof" | "cta";

  /** The variant key selected by Phase 1. */
  variantKey: string;

  /**
   * Human-readable visitor context signals injected into the AI prompt.
   *
   * Examples:
   *   ["source: google", "visitType: returning", "industry: fintech"]
   *
   * Derived from the DecisionInput — stripped of PII, IDs, and internal keys.
   */
  matchedContexts: string[];

  /**
   * The conversion goal for this slot (from the variant's decisionMeta.goal,
   * or a tenant-level default).
   *
   * Examples: "trial_signup", "demo_booking", "enterprise_inquiry"
   */
  goal: string;

  /**
   * Audience descriptors derived from CRM enrichment and journey state.
   *
   * Examples:
   *   ["returning visitor", "high-intent", "SaaS company", "growth stage"]
   */
  audienceHints: string[];

  /**
   * Operator-defined tone preset for the slot.
   *
   * Injected as a style directive into the prompt system message.
   * Examples: "professional and concise", "warm and conversational",
   *           "data-driven and credible"
   */
  tonePreset: string;

  /**
   * Fields AI is allowed to rewrite, with their constraints.
   *
   * Only fields with aiEnabled=true appear here — fields with aiEnabled=false
   * are filtered out before the prompt is built.
   */
  allowedFields: Record<string, FieldFillSpec>;

  /**
   * The original CMS field values, used as fallback and context.
   *
   * AI receives these so it can understand the existing voice/style and
   * produce coherent rewrites rather than generic copy.
   * Keys match allowedFields.
   */
  fallbackContent: Record<string, string>;
}

// ── AI call output ────────────────────────────────────────────────────────────

/**
 * Structured output from one AI field fill call.
 *
 * The AI must return ONLY the fields listed in FieldFillInput.allowedFields.
 * Extra fields are stripped by the validator before application.
 */
export interface FieldFillOutput {
  /**
   * Rewritten field values.
   *
   * Keys must be a subset of FieldFillInput.allowedFields.
   * Values must be plain text — no HTML, no markdown, no JSON.
   */
  fields: Record<string, string>;

  /**
   * AI self-reported confidence that these rewrites are appropriate.
   *
   * Range [0, 1].  Used for confidence gating when SlotFieldFillConfig
   * .confidenceThreshold is set.
   * undefined when the model did not report a confidence score.
   */
  confidence: number | undefined;
}

// ── Trace ─────────────────────────────────────────────────────────────────────

/**
 * Per-slot field fill trace recorded after one field fill pass.
 *
 * Attached to DecisionTrace.fieldFill (keyed by slotType) and surfaced in
 * the admin debug panel.
 */
export interface FieldFillTrace {
  /** Which core slot this trace is for. */
  slotType: "hero" | "proof" | "cta";

  /** The variant key that was field-filled. */
  variantKey: string;

  /** Whether AI was invoked and its output applied. */
  aiUsed: boolean;

  /**
   * AI confidence for this fill pass.
   * undefined when AI was not called or the model did not report a score.
   */
  confidence: number | undefined;

  /**
   * Why AI was NOT used, when aiUsed=false.
   *
   * Examples:
   *   "slot_disabled"           — SlotFieldFillConfig.enabled is false
   *   "no_eligible_fields"      — no fields have aiEnabled=true
   *   "confidence_below_threshold" — AI confidence < confidenceThreshold
   *   "ai_error"                — AI call threw or returned invalid output
   *   "ai_global_disabled"      — global AI mode is "disabled"
   *   null                      — AI was used (aiUsed=true)
   */
  fallbackReason: string | null;

  /**
   * Names of the fields that were modified by AI.
   * Empty array when aiUsed=false.
   */
  modifiedFields: string[];

  /**
   * Original CMS values for modified fields.
   * Empty when aiUsed=false (no fields were touched).
   */
  originalValues: Record<string, string>;

  /**
   * AI-proposed values for modified fields (before validation).
   * Empty when aiUsed=false.
   */
  aiValues: Record<string, string>;

  /**
   * Final values applied to the block data (after validation / constraint enforcement).
   * May differ from aiValues when a field was truncated to honour maxWords/maxChars.
   * Empty when aiUsed=false.
   */
  finalValues: Record<string, string>;
}

// ── Field fill result ─────────────────────────────────────────────────────────

/**
 * Result returned by runFieldFill() for one slot.
 *
 * Contains the (potentially modified) block data and the trace.
 */
export interface FieldFillResult<T> {
  /** The block data after field fill (may be the original when aiUsed=false). */
  data:  T;
  /** Trace for this slot's field fill pass. */
  trace: FieldFillTrace;
}
