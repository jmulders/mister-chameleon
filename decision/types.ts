/**
 * Decision Layer Types
 *
 * Defines the output vocabulary of the decision engine and the input type
 * that all decision providers receive.
 *
 * ─── Input → Output flow ──────────────────────────────────────────────────────
 *
 *   DecisionInput  →  DecisionProvider.getHomepagePlan()  →  ExperiencePlan
 *        ↑                                                          ↓
 *   VisitorContext                                    block components receive
 *   + VisitorHistory                                  typed variant keys and
 *   (from context layer)                              fetch matching CMS content
 *
 * ─── Key naming convention ────────────────────────────────────────────────────
 *
 *   {block}_{intent}
 *     block  — the page slot this key controls    (hero, proof, cta, feature, …)
 *     intent — the visitor intent it speaks to    (problem, vision, brand, …)
 *
 * ─── Slot architecture ───────────────────────────────────────────────────────
 *
 *   Adaptive slots are strictly typed — each slot accepts only its own variant
 *   document type.  This file is the authoritative registry for:
 *
 *     • Variant key union types per slot (HeroVariantKey, ProofVariantKey, …)
 *     • Runtime key arrays for admin UI population (HERO_VARIANT_KEYS, …)
 *     • The AdaptiveSlotId union — all known slot identifiers
 *     • ADAPTIVE_SLOT_REGISTRY — metadata for each slot, used by the composer,
 *       admin UI, and debug panel
 *     • SLOT_VOCABULARY — fast key→variant-key-list lookup
 *     • ExperiencePlan — the full plan output of the decision engine
 *
 *   Core slots (hero / proof / cta) are required in every ExperiencePlan.
 *   Extended slots (feature / conversion) are optional — they appear in the
 *   plan only when the page template declares them and the decision engine
 *   resolves a key.  If a CMS fetch returns null for an optional slot, the
 *   slot is simply absent from the experience (no fallback cascade).
 *
 * ─── Adding a new slot type ───────────────────────────────────────────────────
 *
 *   1. Add its variant key type here (e.g. FaqVariantKey).
 *   2. Add a runtime key array (e.g. FAQ_VARIANT_KEYS).
 *   3. Add the slot ID to AdaptiveSlotId.
 *   4. Add an entry to ADAPTIVE_SLOT_REGISTRY.
 *   5. Add the optional key to ExperiencePlan (e.g. faqKey?).
 *   6. Add a *BlockData interface in cms/types.ts.
 *   7. Add get*Variant() to CMSProvider + each provider implementation.
 *   8. Create cms/schemas/<type>Variant.ts and cms/queries/sanity/<type>-queries.ts.
 *   9. Add mapSanity<Type>() to cms/mappers/sanity/sanity-mappers.ts.
 *  10. Handle the new key in experience/compose-experience.ts.
 *  11. Extend ContextBlockKey in tenant/types.ts.
 */

import type { VisitorContext } from "@/context/types";
import type { VisitorHistory } from "@/context/visitor-history";
import type { SlotCandidates } from "@/ai/variant-meta";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import type { RuleContextWrite } from "@/decision/rules/stored-rule";

// ── Hero variant keys ─────────────────────────────────────────────────────────

/**
 * Controls the headline, subheadline, and CTA copy inside HeroBlock.
 *
 * ── Platform defaults ─────────────────────────────────────────────────────────
 * hero_default              — canonical brand hero for new/unknown visitors
 * hero_google_problem       — speaks to a visitor searching for a solution
 * hero_linkedin_vision      — speaks to a visitor browsing thought leadership
 * hero_direct_brand         — speaks to an unattributed visitor; leads with brand
 * hero_consideration        — speaks to a visitor in research/consideration mode
 * hero_intent_direct        — direct pitch for high-intent, ready-to-buy visitors
 * hero_customer_onboarding  — warm welcome for post-conversion / onboarding users
 *
 * ── B2B SaaS blueprint ────────────────────────────────────────────────────────
 * hero_saas_default             — general educational default for SaaS audiences
 * hero_saas_consideration       — product-led, comparison-friendly; shows fit
 * hero_saas_intent              — direct conversion-focused; strong value prop
 * hero_saas_trial               — strong free-trial / start-now emphasis
 * hero_saas_customer_onboarding — post-conversion onboarding mode
 */
export type HeroVariantKey =
  | "hero_default"
  | "hero_google_problem"
  | "hero_linkedin_vision"
  | "hero_direct_brand"
  | "hero_consideration"
  | "hero_intent_direct"
  | "hero_customer_onboarding"
  // Vertical service-CTA blueprint (service-led businesses, e.g. Cluistra)
  | "hero_service"
  // B2B SaaS blueprint
  | "hero_saas_default"
  | "hero_saas_consideration"
  | "hero_saas_intent"
  | "hero_saas_trial"
  | "hero_saas_customer_onboarding"
  // Careers / Werken-bij blueprint
  | "hero_careers_default"       // awareness: brand intro, culture showcase
  | "hero_careers_job_match"     // explorer / job-interest: role-led messaging
  | "hero_careers_high_intent"   // high intent: urgency + direct apply CTA
  | "hero_careers_reassurance"   // drop-off recovery: remove friction, build trust
  // Per-preset demo variants (distinct hero per Quick Preset)
  | "hero_trial_ready"
  | "hero_returning"
  | "hero_enterprise"
  | "hero_form_dropoff"
  | "hero_customer_expansion"
  | "hero_post_conversion"
  | "hero_high_friction"
  | "hero_churn_risk"
  | "hero_careers_job_interest"
  | "hero_careers_submitted";

/**
 * Runtime tuple of all valid hero variant key strings.
 * Mirrors HeroVariantKey — keep in sync when adding new keys.
 */
export const HERO_VARIANT_KEYS: readonly HeroVariantKey[] = [
  "hero_default",
  "hero_google_problem",
  "hero_linkedin_vision",
  "hero_direct_brand",
  "hero_consideration",
  "hero_intent_direct",
  "hero_customer_onboarding",
  "hero_saas_default",
  "hero_saas_consideration",
  "hero_saas_intent",
  "hero_saas_trial",
  "hero_saas_customer_onboarding",
  // Careers / Werken-bij blueprint
  "hero_careers_default",
  "hero_careers_job_match",
  "hero_careers_high_intent",
  "hero_careers_reassurance",
  // Per-preset demo variants
  "hero_trial_ready",
  "hero_returning",
  "hero_enterprise",
  "hero_form_dropoff",
  "hero_customer_expansion",
  "hero_post_conversion",
  "hero_high_friction",
  "hero_churn_risk",
  "hero_careers_job_interest",
  "hero_careers_submitted",
] as const;

// ── Proof variant keys ────────────────────────────────────────────────────────

/**
 * Controls which social proof angle the ProofBlock surfaces.
 *
 * ── Platform defaults ─────────────────────────────────────────────────────────
 * proof_default      — canonical trust-building proof for new visitors
 * proof_cases        — concrete case studies and ROI numbers
 * proof_vision       — analyst quotes, industry recognition
 * proof_platform     — platform scale and reliability stats
 * proof_stats        — platform performance metrics and conversion numbers
 * proof_reassurance  — low-pressure reassurance copy for friction/dropout recovery
 *
 * ── B2B SaaS blueprint ────────────────────────────────────────────────────────
 * proof_saas_default       — platform value, explainability, and credibility
 * proof_saas_consideration — use cases and fit signals for evaluating buyers
 * proof_saas_intent        — ROI / conversion impact proof for high-intent buyers
 * proof_saas_reassurance   — safe fallback; no-dumb-personalization message
 */
export type ProofVariantKey =
  | "proof_default"
  | "proof_cases"
  | "proof_vision"
  | "proof_platform"
  | "proof_stats"
  | "proof_reassurance"
  // Vertical service-CTA blueprint (service-led businesses, e.g. Cluistra)
  | "proof_service"
  // B2B SaaS blueprint
  | "proof_saas_default"
  | "proof_saas_consideration"
  | "proof_saas_intent"
  | "proof_saas_reassurance"
  // Careers / Werken-bij blueprint
  | "proof_careers_default"       // culture & values: general employer credibility
  | "proof_careers_team"          // team spotlights: department-specific social proof
  | "proof_careers_reassurance";  // transparency: fair process, removes application friction

/**
 * Runtime tuple of all valid proof variant key strings.
 */
export const PROOF_VARIANT_KEYS: readonly ProofVariantKey[] = [
  "proof_default",
  "proof_cases",
  "proof_vision",
  "proof_platform",
  "proof_stats",
  "proof_reassurance",
  "proof_saas_default",
  "proof_saas_consideration",
  "proof_saas_intent",
  "proof_saas_reassurance",
  // Careers / Werken-bij blueprint
  "proof_careers_default",
  "proof_careers_team",
  "proof_careers_reassurance",
] as const;

// ── CTA variant keys ──────────────────────────────────────────────────────────

/**
 * Controls the primary call-to-action in CTABlock.
 *
 * ── Platform defaults ─────────────────────────────────────────────────────────
 * cta_default    — canonical low-friction CTA for new/unknown visitors
 * cta_guide      — nurture/educate intent  ("Get the free playbook")
 * cta_platform   — product-led intent     ("Start building for free")
 * cta_meeting    — sales-led/brand intent ("Book a 20-minute demo")
 * cta_demo       — mid-funnel demo CTA    ("Bekijk een gratis demo")
 * cta_onboarding — post-conversion CTA    ("Start je onboarding")
 * cta_expansion  — expansion/upsell CTA  ("Bekijk uitbreidingsopties")
 *
 * ── B2B SaaS blueprint ────────────────────────────────────────────────────────
 * cta_saas_default    — general "learn more / see how it works" CTA
 * cta_saas_demo       — book a product demo
 * cta_saas_trial      — start free trial / start for free
 * cta_saas_onboarding — next onboarding step after signup
 * cta_saas_expansion  — expand plan / unlock more features
 */
export type CTAVariantKey =
  | "cta_default"
  | "cta_guide"
  | "cta_platform"
  | "cta_meeting"
  | "cta_demo"
  | "cta_onboarding"
  | "cta_expansion"
  // Vertical service-CTA blueprint (service-led businesses, e.g. Cluistra)
  | "cta_service"
  // B2B SaaS blueprint
  | "cta_saas_default"
  | "cta_saas_demo"
  | "cta_saas_trial"
  | "cta_saas_onboarding"
  | "cta_saas_expansion"
  // Careers / Werken-bij blueprint
  | "cta_careers_browse"   // awareness/explorer: "Bekijk vacatures" — low friction
  | "cta_careers_apply"    // job-interest/high-intent: "Solliciteer nu" — direct apply
  | "cta_careers_open"     // drop-off recovery: "Stuur open sollicitatie" — soft re-engage
  | "cta_careers_contact"; // post-submission: "Stel een vraag" — relationship continuation

/**
 * Runtime tuple of all valid CTA variant key strings.
 */
export const CTA_VARIANT_KEYS: readonly CTAVariantKey[] = [
  "cta_default",
  "cta_guide",
  "cta_platform",
  "cta_meeting",
  "cta_demo",
  "cta_onboarding",
  "cta_expansion",
  "cta_saas_default",
  "cta_saas_demo",
  "cta_saas_trial",
  "cta_saas_onboarding",
  "cta_saas_expansion",
  // Careers / Werken-bij blueprint
  "cta_careers_browse",
  "cta_careers_apply",
  "cta_careers_open",
  "cta_careers_contact",
] as const;

// ── Feature variant keys ──────────────────────────────────────────────────────

/**
 * Controls the feature highlights / benefit grid section.
 *
 * feature_grid_primary  — icon + headline + body grid (default)
 * feature_highlights    — larger, alternating left/right feature rows
 * feature_comparison    — side-by-side comparison table / matrix
 *
 * All content-managed via the featureVariant Sanity document type.
 * Add new keys here + corresponding featureVariant documents in Sanity.
 */
export type FeatureVariantKey =
  | "feature_grid_primary"
  | "feature_highlights"
  | "feature_comparison"
  // Vertical service-CTA blueprint (service-led businesses, e.g. Cluistra)
  | "feature_service";

/**
 * Runtime tuple of all valid feature variant key strings.
 */
export const FEATURE_VARIANT_KEYS: readonly FeatureVariantKey[] = [
  "feature_grid_primary",
  "feature_highlights",
  "feature_comparison",
  "feature_service",
] as const;

// ── Notification variant keys ─────────────────────────────────────────────────

/**
 * Controls the notification overlay — a toast or top/bottom banner shown on top
 * of (not inside) the page layout.  Optional slot: absent from the experience
 * when the decision engine returns no notificationKey.
 *
 * notification_default   — generic informational notice (new feature, tip)
 * notification_offer     — promotional / limited-time offer banner
 * notification_urgency   — urgency/scarcity nudge for high-intent visitors
 * notification_returning — personalised welcome-back message for known visitors
 */
export type NotificationVariantKey =
  | "notification_default"
  | "notification_offer"
  | "notification_urgency"
  | "notification_returning";

/**
 * Runtime tuple of all valid notification variant key strings.
 */
export const NOTIFICATION_VARIANT_KEYS: readonly NotificationVariantKey[] = [
  "notification_default",
  "notification_offer",
  "notification_urgency",
  "notification_returning",
] as const;

// ── Conversion variant keys ───────────────────────────────────────────────────

/**
 * Controls the conversion-focused section — a richer intent-signalling block
 * than a simple CTA (may include a form, urgency copy, multi-step flow, etc.).
 *
 * conversion_signup   — email / account signup form
 * conversion_demo     — demo request form or booking embed
 * conversion_contact  — contact / enquiry form
 *
 * All content-managed via the conversionVariant Sanity document type.
 */
export type ConversionVariantKey =
  | "conversion_signup"
  | "conversion_demo"
  | "conversion_contact";

/**
 * Runtime tuple of all valid conversion variant key strings.
 */
export const CONVERSION_VARIANT_KEYS: readonly ConversionVariantKey[] = [
  "conversion_signup",
  "conversion_demo",
  "conversion_contact",
] as const;

// ── Adaptive slot registry ────────────────────────────────────────────────────

/**
 * All known adaptive slot identifiers.
 *
 * Matches ContextBlockKey in tenant/types.ts — these must stay in sync.
 * Core slots (hero / proof / cta) are required in every ExperiencePlan.
 * Extended slots (feature / conversion) are optional.
 */
export type AdaptiveSlotId =
  | "hero"
  | "proof"
  | "cta"
  | "feature"
  | "conversion"
  | "notification";
  // Future reserved: | "content" | "faq" | "feed" | "trust"

/**
 * Metadata for a single adaptive slot type.
 *
 * Used by the experience composer, admin UI, and debug panel to understand
 * each slot without hard-coding slot-specific logic in multiple places.
 */
export interface AdaptiveSlotSpec {
  /** Slot identifier — matches ContextBlockKey and the plan key prefix. */
  readonly id:            AdaptiveSlotId;
  /** Sanity document _type for this slot's variant documents. */
  readonly docType:       string;
  /** Prefix all variant keys for this slot must start with. */
  readonly keyPrefix:     string;
  /** Human-readable label for Studio and debug UIs. */
  readonly label:         string;
  /** Short description shown in the admin page builder. */
  readonly description:   string;
  /**
   * Whether this slot is required in every ExperiencePlan.
   *   true  — core slot; the composer applies 4-tier fallback if missing.
   *   false — optional slot; absent from experience if CMS returns null.
   */
  readonly required:      boolean;
  /** Runtime key array for admin UI population. */
  readonly knownKeys:     readonly string[];
}

/**
 * The authoritative registry of all adaptive slot types.
 *
 * Iterate this array to drive generic behaviour (composer, debug panel, admin
 * UI) without hard-coding per-slot logic.  Each provider implementation must
 * implement a get*Variant() method for every entry here.
 *
 * ─── Adding a new slot ───────────────────────────────────────────────────────
 *   Add an entry here, then follow the checklist in the file header above.
 */
export const ADAPTIVE_SLOT_REGISTRY: readonly AdaptiveSlotSpec[] = [
  {
    id:          "hero",
    docType:     "heroVariant",
    keyPrefix:   "hero_",
    label:       "Hero",
    description: "Adaptive page header — headline, subtitle, and primary CTA.",
    required:    true,
    knownKeys:   HERO_VARIANT_KEYS,
  },
  {
    id:          "proof",
    docType:     "proofVariant",
    keyPrefix:   "proof_",
    label:       "Proof",
    description: "Adaptive social proof section — case studies, recognition, or platform stats.",
    required:    true,
    knownKeys:   PROOF_VARIANT_KEYS,
  },
  {
    id:          "cta",
    docType:     "ctaVariant",
    keyPrefix:   "cta_",
    label:       "CTA",
    description: "Adaptive call-to-action section — nurture, product-led, or sales-led.",
    required:    true,
    knownKeys:   CTA_VARIANT_KEYS,
  },
  {
    id:          "feature",
    docType:     "featureVariant",
    keyPrefix:   "feature_",
    label:       "Feature",
    description: "Adaptive feature highlights or benefit grid — adapts messaging by visitor intent.",
    required:    false,
    knownKeys:   FEATURE_VARIANT_KEYS,
  },
  {
    id:          "conversion",
    docType:     "conversionVariant",
    keyPrefix:   "conversion_",
    label:       "Conversion",
    description: "Adaptive conversion section — signup form, demo request, or contact form.",
    required:    false,
    knownKeys:   CONVERSION_VARIANT_KEYS,
  },
  {
    id:          "notification",
    docType:     "notificationVariant",
    keyPrefix:   "notification_",
    label:       "Notification",
    description: "Adaptive overlay notification — toast or banner shown above the page layout.",
    required:    false,
    knownKeys:   NOTIFICATION_VARIANT_KEYS,
  },
] as const;

// ── Slot vocabulary map ───────────────────────────────────────────────────────

/**
 * Fast lookup: slot ID → valid variant key strings.
 *
 * Used by the admin page builder to populate slot editors with the correct
 * allowed-variant checkboxes and fallback-variant selects.  Not consumed by
 * the runtime decision engine.
 */
export const SLOT_VOCABULARY: Record<AdaptiveSlotId, readonly string[]> = {
  hero:         HERO_VARIANT_KEYS,
  proof:        PROOF_VARIANT_KEYS,
  cta:          CTA_VARIANT_KEYS,
  feature:      FEATURE_VARIANT_KEYS,
  conversion:   CONVERSION_VARIANT_KEYS,
  notification: NOTIFICATION_VARIANT_KEYS,
} as const;

// ── Experience plan ───────────────────────────────────────────────────────────

/**
 * The complete adaptive page plan produced by the decision engine
 * for a single visitor context.
 *
 * ─── Core slots (required) ───────────────────────────────────────────────────
 *
 *   heroKey, proofKey, ctaKey — always present; the composer applies the full
 *   4-tier fallback strategy if any CMS fetch returns null for these.
 *
 * ─── Extended slots (optional) ───────────────────────────────────────────────
 *
 *   featureKey, conversionKey — present only when the page template declares
 *   the slot AND the decision engine resolves a key.  If the CMS fetch returns
 *   null, the slot is omitted from the experience (no fallback cascade — the
 *   page simply renders without that section).
 *
 *   The `string` union on extended slots allows tenant-specific keys beyond the
 *   typed platform vocabulary (e.g. "feature_workengine_platform").  The CMS
 *   provider accepts plain strings; the typed union is advisory.
 *
 * `reason` is a human-readable explanation of which rule fired — surfaced in
 * the debug panel and analytics events.
 */
export interface ExperiencePlan {
  // ── Core (required) ────────────────────────────────────────────────────────
  /** Selected hero variant key */
  heroKey:  HeroVariantKey;
  /** Selected proof variant key */
  proofKey: ProofVariantKey;
  /** Selected CTA variant key */
  ctaKey:   CTAVariantKey;

  // ── Extended (optional — omit when the page template does not declare the slot) ──
  /** Selected feature variant key, e.g. "feature_grid_primary" */
  featureKey?:    FeatureVariantKey | string;
  /** Selected conversion variant key, e.g. "conversion_signup" */
  conversionKey?: ConversionVariantKey | string;

  /**
   * Selected notification overlay variant key, e.g. "notification_offer".
   *
   * When set, the page renders an adaptive notification (toast or top/bottom
   * banner) on top of the page layout.  When absent, no notification is shown.
   * This is a purely optional slot — the decision engine omits it for visitors
   * where no notification rule fires.
   */
  notificationKey?: NotificationVariantKey | string;

  /**
   * Adaptive page-banner key for CMS inner pages (e.g. /pricing, /how-it-works).
   *
   * When set, `cms-page-decision.ts` uses this key to override the hero slot on
   * CMS slug pages instead of `heroKey`.  This keeps the compact page-banner
   * layout on inner pages while still allowing visitor-adaptive content changes.
   *
   * `heroKey` continues to drive the homepage hero unaffected.
   *
   * Typical values: "hero_page_banner_high_intent", "hero_page_banner_enterprise",
   * "hero_page_banner_consideration", "hero_page_banner_returning".
   * When absent, the CMS page uses the page's own fallbackVariantKey unchanged.
   */
  pageBannerKey?: string;

  /**
   * Per-form-type variant keys chosen by the engine (forms-as-adaptive-blocks).
   * Maps a form type (contact / application / appointment) to a variant key in
   * the tenant's `form:<type>` adaptive-block row. When a type is absent, the
   * decide route serves the form's base definition (no variant applied).
   */
  formVariants?: Record<string, string>;

  /**
   * Per-email-template variant keys chosen by the engine (adaptive emails).
   * Maps an email template key to a variant key in the tenant's
   * `email:<templateKey>` adaptive-block row. When a template is absent, the
   * adaptive email uses its resolved template (no variant applied).
   */
  emailVariants?: Record<string, string>;

  /**
   * Context-driven theme override.
   *
   * When set by a ThemeRule (date/time/campaign), this key overrides the
   * tenant's default theme for the duration of the session.  When absent,
   * the tenant's configured design.theme is used.
   *
   * The theme decision layer populates this after the variant decision layer
   * runs, so variant rules and theme rules are evaluated independently.
   */
  themeKey?: ThemePresetKey;

  // ── Adaptive pricing behavior ──────────────────────────────────────────────

  /**
   * Controls how prominently the pricing section is displayed for this visitor.
   *
   * hidden     — Customer in onboarding/post-conversion. Acquisition pricing
   *              suppressed; replaced by lifecycle CTAs only.
   * teaser     — Awareness/consideration stage. Brief pricing preview only
   *              (e.g. "Starter vanaf €79/mo" + link to full pricing page).
   * standard   — Mid-funnel default. Full pricing table shown without
   *              special visual emphasis.
   * emphasized — High-intent / trial-ready. Pricing prominent with stronger
   *              CTA labels, highlighted recommended plan, and urgency framing.
   *
   * When absent, pricing components default to "standard".
   * Set by the rule engine from StoredPlan.pricingEmphasis.
   */
  pricingEmphasis?: "hidden" | "teaser" | "standard" | "emphasized";

  /**
   * Controls which CTA type is active in pricing-sensitive sections.
   *
   * trial      — Emphasise "Start gratis" / free trial (Starter).
   * demo       — "Plan demo" / "Bekijk demo" CTA (default for Growth/Pro).
   * onboarding — Post-conversion: "Plan je onboarding" / dashboard link.
   * expansion  — Existing customer: "Upgrade je plan" / enrichment CTA.
   * none       — Suppress acquisition CTA entirely.
   *
   * When absent, each plan card uses its canonical ctaType from pricing-table.ts.
   * Set by the rule engine from StoredPlan.pricingCtaMode.
   */
  pricingCtaMode?: "trial" | "demo" | "onboarding" | "expansion" | "none";

  /**
   * Context writes carried through the compose layer ("regels die context
   * schrijven"). Copied from StoredPlan.setContext so the sticky-persist step
   * (spec §5.4) can apply them after the response. Absent = no context effect.
   */
  setContext?: RuleContextWrite[];

  /**
   * Human-readable explanation of why this plan was selected.
   * Used in the debug panel and for analytics event properties.
   */
  reason: string;
}

// ── Convenience unions ────────────────────────────────────────────────────────

/** Any typed variant key from any core block section */
export type CoreVariantKey = HeroVariantKey | ProofVariantKey | CTAVariantKey;

/** Any typed variant key from any extended block section */
export type ExtendedVariantKey = FeatureVariantKey | ConversionVariantKey | NotificationVariantKey;

/** Any variant key from any slot */
export type AnyVariantKey = CoreVariantKey | ExtendedVariantKey;

// ── Decision input ─────────────────────────────────────────────────────────────

/**
 * The full input payload fed to every decision provider.
 *
 * Extends VisitorContext with a first-party `history` struct so that rules
 * and AI providers can personalise based on prior behaviour as well as the
 * current request.
 *
 * Because `DecisionInput extends VisitorContext`, all existing rule predicates
 * that reference `ctx.source`, `ctx.device`, etc. compile unchanged — they
 * simply ignore the new `history` field.  History-aware rules opt in by
 * destructuring or reading `ctx.history.*`.
 *
 * Build via `buildDecisionInput(context, history)` in the page/route; never
 * construct inline.
 */
export interface DecisionInput extends VisitorContext {
  /**
   * First-party behavioural history for this session.
   *
   * Derived from the `events` and `served_variants` tables — no
   * fingerprinting, no cross-session stitching beyond the first-party
   * mc_session_id cookie.
   *
   * Always present; `history.fromDatabase` is false when the DB query failed
   * or the visitor is brand-new (safe zero-values throughout).
   */
  history: VisitorHistory;

  /**
   * Optional: resolved variant candidates for all personalisation slots.
   *
   * When provided, the AI prompt builder uses these candidates (filtered to
   * `aiReady === true`) instead of the static platform key lists.  Tenant
   * variants and tenant overrides of platform defaults are included here.
   *
   * When absent (undefined), the AI falls back to the platform-only registry
   * — all 9 known variants with their hardcoded decision metadata.  This
   * maintains full backward compatibility.
   *
   * Build via `resolveVariantCandidates()` in the route/server action after
   * fetching the CMS variant documents for the current tenant.
   */
  variantCandidates?: SlotCandidates;
}

/**
 * Merge a fully resolved VisitorContext with its first-party VisitorHistory
 * into a DecisionInput ready for the decision pipeline.
 */
export function buildDecisionInput(
  context: VisitorContext,
  history: VisitorHistory,
): DecisionInput {
  return { ...context, history };
}
