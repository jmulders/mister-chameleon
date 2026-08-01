/**
 * Variant Catalogue
 *
 * Type definitions and helpers for the merged platform + CMS variant catalogue
 * used by the rules editor to populate slot variant selects.
 *
 * ─── Why a catalogue? ─────────────────────────────────────────────────────────
 *
 *   ALLOWED_HERO_KEYS / ALLOWED_PROOF_KEYS / ALLOWED_CTA_KEYS enumerate only the
 *   platform-defined variants hard-coded in this repository.  CMS-created variants
 *   (heroVariant / proofVariant / ctaVariant documents published in Sanity) are not
 *   represented by those lists.
 *
 *   This module defines a VariantCatalogue that merges both sources and labels
 *   each entry by its origin:
 *
 *     platform    — shipped with the platform codebase (always available)
 *     cms-tenant  — created in Sanity for a specific tenant
 *     cms-shared  — created in Sanity without a tenantId (available to all tenants)
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Server pages (admin/rules, dashboard/rules) call fetchVariantCatalogue(tenantId)
 *   to obtain the full catalogue and pass it to <RulesEditor variantCatalogue={…} />.
 *
 *   When `variantCatalogue` is absent (e.g. Sanity not configured), RulesEditor
 *   falls back to the platform-only lists — exactly the prior behaviour.
 */

import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
  ALLOWED_FEATURE_KEYS,
  ALLOWED_CONVERSION_KEYS,
} from "./stored-rule";

// ── VariantSource ──────────────────────────────────────────────────────────────

/**
 * The origin of a variant entry in the catalogue.
 *
 * "platform"   — Hard-coded in the platform codebase (ALLOWED_*_KEYS).
 * "cms-tenant" — Published in Sanity, scoped to a specific tenant.
 * "cms-shared" — Published in Sanity, shared across all tenants (no tenantId).
 */
export type VariantSource = "platform" | "cms-tenant" | "cms-shared";

// ── VariantEntry ───────────────────────────────────────────────────────────────

/**
 * A single variant option within a slot (hero / proof / cta).
 *
 * `key`    — The string stored in the plan (e.g. "hero_direct_brand").
 * `label`  — Human-readable description shown in the select.
 * `source` — Where the variant originates ("platform" | "cms-tenant" | "cms-shared").
 */
export interface VariantEntry {
  key:    string;
  label:  string;
  source: VariantSource;
}

// ── VariantCatalogue ───────────────────────────────────────────────────────────

/**
 * The merged catalogue of available variants, grouped by slot.
 * Passed from server pages into <RulesEditor /> as a prop.
 *
 * Core slots (hero / proof / cta) are always populated.
 * Extended slots (feature / conversion) are optional — present when the
 * platform-defined keys plus any CMS-authored variants are available.
 */
export interface VariantCatalogue {
  hero:       VariantEntry[];
  proof:      VariantEntry[];
  cta:        VariantEntry[];
  feature:    VariantEntry[];
  conversion: VariantEntry[];
  /**
   * Authored form variants, keyed by form type (contact / application /
   * appointment). Unlike the slots above, these are entirely tenant-authored
   * (no platform defaults) — a type is present only when the tenant has saved
   * at least one variant for it. A rule targets one via plan.formVariants.
   */
  forms?:     Record<string, VariantEntry[]>;

  /**
   * Authored email variants, keyed by email template key (abm_intro / … ).
   * Tenant-authored like forms; a rule targets one via plan.emailVariants.
   */
  emails?:    Record<string, VariantEntry[]>;
}

// ── Source labels ──────────────────────────────────────────────────────────────

/**
 * Human-readable labels for use in <optgroup> headings inside the variant
 * selects in the rules editor.
 */
export const SOURCE_LABELS: Record<VariantSource, string> = {
  "platform":   "Platform",
  "cms-tenant": "CMS / Tenant",
  "cms-shared": "CMS / Shared",
};

// ── Platform catalogue builder ─────────────────────────────────────────────────

/**
 * Hard-coded variant labels for the platform-defined keys.
 * These mirror HERO_KEY_LABELS / PROOF_KEY_LABELS / CTA_KEY_LABELS in RulesEditor
 * so the server can embed them in the catalogue without importing a client module.
 */
const PLATFORM_HERO_LABELS: Record<string, string> = {
  // Platform defaults
  hero_default:             "Default — generic awareness entry",
  hero_google_problem:      "Google Problem — search / solution intent",
  hero_linkedin_vision:     "LinkedIn Vision — thought-leadership intent",
  hero_direct_brand:        "Direct Brand — unattributed / returning",
  hero_consideration:       "Consideration — mid-funnel evaluation",
  hero_intent_direct:       "Intent Direct — high-intent, direct apply",
  hero_customer_onboarding: "Customer Onboarding — post-conversion",
  // B2B SaaS blueprint
  hero_saas_default:             "SaaS Default — platform intro",
  hero_saas_consideration:       "SaaS Consideration — evaluating fit",
  hero_saas_intent:              "SaaS Intent — ready to trial",
  hero_saas_trial:               "SaaS Trial — start free trial",
  hero_saas_customer_onboarding: "SaaS Onboarding — activation mode",
  // Careers / Werken-bij blueprint
  hero_careers_default:      "Careers Default — brand intro, culture showcase",
  hero_careers_job_match:    "Careers Job Match — role-led messaging",
  hero_careers_high_intent:  "Careers High Intent — direct apply CTA",
  hero_careers_reassurance:  "Careers Reassurance — drop-off recovery",
};

const PLATFORM_PROOF_LABELS: Record<string, string> = {
  // Platform defaults
  proof_default:     "Default — general trust building",
  proof_cases:       "Cases — concrete case studies & ROI numbers",
  proof_vision:      "Vision — analyst quotes & industry recognition",
  proof_platform:    "Platform — scale & reliability stats",
  proof_stats:       "Stats — performance metrics",
  proof_reassurance: "Reassurance — low-pressure fallback",
  // B2B SaaS blueprint
  proof_saas_default:       "SaaS Default — platform value & credibility",
  proof_saas_consideration: "SaaS Consideration — use cases & fit signals",
  proof_saas_intent:        "SaaS Intent — ROI & conversion impact",
  proof_saas_reassurance:   "SaaS Reassurance — safe fallback",
  // Careers / Werken-bij blueprint
  proof_careers_default:     "Careers Default — culture & employer credibility",
  proof_careers_team:        "Careers Team — team spotlights & department proof",
  proof_careers_reassurance: "Careers Reassurance — process transparency",
};

const PLATFORM_CTA_LABELS: Record<string, string> = {
  // Platform defaults
  cta_default:    "Default — low-friction awareness CTA",
  cta_guide:      "Guide — get the free personalisation guide",
  cta_platform:   "Platform — start building for free",
  cta_meeting:    "Meeting — book a 20-minute intro call",
  cta_demo:       "Demo — bekijk een gratis demo",
  cta_onboarding: "Onboarding — start je onboarding",
  cta_expansion:  "Expansion — bekijk uitbreidingsopties",
  // B2B SaaS blueprint
  cta_saas_default:    "SaaS Default — learn more / see how it works",
  cta_saas_demo:       "SaaS Demo — book a product demo",
  cta_saas_trial:      "SaaS Trial — start free trial",
  cta_saas_onboarding: "SaaS Onboarding — next onboarding step",
  cta_saas_expansion:  "SaaS Expansion — expand plan",
  // Careers / Werken-bij blueprint
  cta_careers_browse:  "Careers Browse — Bekijk vacatures",
  cta_careers_apply:   "Careers Apply — Solliciteer nu",
  cta_careers_open:    "Careers Open — Stuur open sollicitatie",
  cta_careers_contact: "Careers Contact — Stel een vraag",
};

const PLATFORM_FEATURE_LABELS: Record<string, string> = {
  feature_grid_primary: "Feature Grid — full feature overview (awareness / orientation)",
  feature_highlights:   "Feature Highlights — condensed differentiators (mid-funnel)",
  feature_comparison:   "Feature Comparison — side-by-side plan table (high intent / trial)",
};

const PLATFORM_CONVERSION_LABELS: Record<string, string> = {
  conversion_signup:  "Conversion Signup — email / account signup form",
  conversion_demo:    "Conversion Demo — demo request or booking embed",
  conversion_contact: "Conversion Contact — contact / enquiry form",
};

/**
 * Build a VariantCatalogue containing only the platform-defined variants.
 * This is the fallback when Sanity is not configured.
 */
export function buildPlatformCatalogue(): VariantCatalogue {
  return {
    hero: ALLOWED_HERO_KEYS.map((k) => ({
      key:    k,
      label:  PLATFORM_HERO_LABELS[k] ?? k,
      source: "platform" as const,
    })),
    proof: ALLOWED_PROOF_KEYS.map((k) => ({
      key:    k,
      label:  PLATFORM_PROOF_LABELS[k] ?? k,
      source: "platform" as const,
    })),
    cta: ALLOWED_CTA_KEYS.map((k) => ({
      key:    k,
      label:  PLATFORM_CTA_LABELS[k] ?? k,
      source: "platform" as const,
    })),
    feature: ALLOWED_FEATURE_KEYS.map((k) => ({
      key:    k,
      label:  PLATFORM_FEATURE_LABELS[k] ?? k,
      source: "platform" as const,
    })),
    conversion: ALLOWED_CONVERSION_KEYS.map((k) => ({
      key:    k,
      label:  PLATFORM_CONVERSION_LABELS[k] ?? k,
      source: "platform" as const,
    })),
    forms: {},
    emails: {},
  };
}
