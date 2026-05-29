/**
 * Site Models — Type Definitions
 *
 * This module defines the composable site model system.  Instead of one
 * monolithic blueprint per industry, blueprints are assembled from:
 *
 *   1. PageType     — structural page skeleton (homepage, overview, detail, …)
 *   2. SiteModel    — collection of PageTypes + default rules for a context
 *   3. composeBlueprint() — merges one or more SiteModels into a Blueprint
 *
 * ─── Conceptual hierarchy ────────────────────────────────────────────────────
 *
 *   PageType          (structural DNA — what blocks go on this kind of page)
 *     └── SiteModel   (context DNA — which pages + which rules for a use-case)
 *           └── Blueprint  (the deliverable handed to apply-blueprint.ts)
 *
 * ─── Page types ──────────────────────────────────────────────────────────────
 *
 *   homepage    — Primary landing page: hero → proof → features → CTA
 *   overview    — Listing / category page: header → grid → filter → CTA
 *   detail      — Single-item page: title → body → media → related → CTA
 *   form        — Conversion page: header → form → trust signals
 *   process     — Process / step-by-step page: steps → FAQ → CTA
 *
 * ─── Site models ─────────────────────────────────────────────────────────────
 *
 *   service       — Service-oriented site (agency, consulting, IT services)
 *   product-saas  — Product / SaaS site (demo request, free trial, pricing)
 *   careers       — Employer brand / werken-bij (candidate journey)
 *   catalog       — Listing-heavy site (directory, property, event catalog)
 *   commerce      — Transactional (product detail, cart, checkout)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { SERVICE_MODEL } from "./service";
 *   import { composeBlueprint } from "./compose";
 *
 *   export const myBlueprint = composeBlueprint({
 *     key:   "accounting_firm",
 *     name:  "Accountantskantoor",
 *     models: [SERVICE_MODEL],
 *     overrides: {
 *       pages: { "/diensten": { title: "Diensten & Tarieven" } },
 *     },
 *     recommendedThemePreset: "corporate-trust",
 *     recommendedThemeFamily: "Corporate Trust",
 *     industry: "professional_services",
 *   });
 *
 * ─── Design principles ───────────────────────────────────────────────────────
 *
 *   • apply-blueprint.ts is unchanged — it still receives a Blueprint object.
 *   • Models are composable: a site can combine "service" + "careers" to get
 *     both a service-site structure and a /werken-bij section.
 *   • Overrides are shallow-merged at the page level so industry-specific copy
 *     notes replace the generic ones without touching block structure.
 *   • Every PageType is self-contained and can be used outside a SiteModel
 *     (e.g. add a /contact page to any blueprint via the page-template-library).
 */

import type {
  Blueprint,
  BlueprintPage,
  BlueprintBlock,
  BlueprintScoringRule,
  BlueprintSequencePattern,
  BlueprintIndustry,
} from "../blueprint-types";
import type { StoredRule }    from "@/decision/rules/stored-rule";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import type { ThemeFamilyName } from "@/design-system/theme/theme-family-registry";

// ── Page type keys ────────────────────────────────────────────────────────────

/**
 * The five fundamental structural page shapes.
 *
 * These keys are stable — do not rename or remove them; they are referenced
 * by site models, template overrides, and future admin UI filters.
 */
export type PageTypeKey =
  | "homepage"   // Primary landing: hero → proof → features → CTA
  | "overview"   // Listing / grid: header → cards → filter pager → CTA
  | "detail"     // Single-item: title → body → media → related → CTA
  | "form"       // Conversion: contextual header → form → trust signals
  | "process";   // Journey / how-it-works: steps → FAQ → CTA

// ── Site model keys ───────────────────────────────────────────────────────────

/**
 * The five canonical site models.
 *
 * A blueprint references one or more of these.  The admin setup flow
 * ("Initialize Site") uses these keys to group and select templates.
 */
export type SiteModelKey =
  | "service"       // Agency, consulting, professional services, IT
  | "product-saas"  // B2B SaaS, software product, demo/trial funnel
  | "careers"       // Recruitment, werken-bij, employer brand
  | "catalog"       // Directory, listing, property catalog, events
  | "commerce";     // Transactional, product detail, cart, checkout

// ── Page type definition ──────────────────────────────────────────────────────

/**
 * A reusable structural page template.
 *
 * Defines the default block composition for a page shape, independent of
 * any industry or use-case.  SiteModels reference PageTypes and supply
 * industry-specific copy notes via `noteOverrides`.
 */
export interface PageType {
  /** Stable identifier. */
  key:          PageTypeKey;
  /** Human-readable name shown in admin. */
  label:        string;
  /** One-line description. */
  description:  string;
  /**
   * Default slug when this page type is the primary instance.
   * Individual site models override this per-page.
   */
  defaultSlug:  string;
  /** Ordered default blocks for this page shape. */
  blocks:       PageTypeBlock[];
}

/**
 * A block definition within a PageType.
 *
 * `note` holds the generic (industry-agnostic) guidance for operators.
 * SiteModels override `note` per block via `noteOverrides` when they
 * need industry-specific guidance.
 */
export interface PageTypeBlock {
  /** Matches ContentBlockKey in page-config. */
  type:          string;
  /** Generic operator guidance (industry-neutral). */
  note?:         string;
}

// ── Site model definition ─────────────────────────────────────────────────────

/**
 * A composable site model — the middle layer between a PageType and a Blueprint.
 *
 * A SiteModel declares which pages to include (referencing PageTypes),
 * the behavioral rules appropriate for this context, and default scoring.
 */
export interface SiteModel {
  /** Stable key. */
  key:          SiteModelKey;
  /** Human-readable label shown in admin setup wizard. */
  label:        string;
  /** One-line pitch for the admin model picker. */
  description:  string;
  /** Longer explanation shown on hover / in preview. */
  longDescription?: string;
  /** Emoji for quick visual scanning. */
  icon:         string;
  /**
   * The pages this model contributes when composed into a blueprint.
   * Order is preserved; blueprints from multiple models are page-merged
   * in model array order.
   */
  pages:        SiteModelPage[];
  /**
   * Behavioral rules contributed by this model.
   * Rules from all composed models are merged and re-prioritised.
   */
  rules:        Omit<StoredRule, "id">[];
  /** Scoring rules contributed by this model. */
  scoringRules: BlueprintScoringRule[];
  /** Sequence patterns contributed by this model. */
  sequencePatterns: BlueprintSequencePattern[];
  /**
   * Industry contexts where this model is a strong default fit.
   * Used for auto-suggestion and filtering in the setup wizard.
   */
  industries:   BlueprintIndustry[];
  /**
   * Theme families that pair well with this model.
   * The first entry is used as the default recommendation when composing.
   */
  suggestedThemeFamilies: ThemeFamilyName[];
}

/**
 * A page instance within a SiteModel.
 *
 * References a PageType for its structural shape, then provides
 * model-specific metadata (slug, title) and copy-note overrides.
 */
export interface SiteModelPage {
  /** The structural shape this page uses. */
  pageTypeKey:    PageTypeKey;
  /** URL slug for this page instance. */
  slug:           string;
  /** Human-readable title for this page instance. */
  title:          string;
  /**
   * Block-level note overrides keyed by block `type`.
   * Merged on top of the PageType's generic notes.
   * Only the blocks listed here get their note replaced; all others
   * keep the PageType default.
   */
  noteOverrides?: Record<string, string>;
  /**
   * Additional blocks appended after the PageType's defaults.
   * Use for model-specific blocks not present in the generic PageType.
   */
  extraBlocks?:   PageTypeBlock[];
}

// ── Blueprint composition meta ────────────────────────────────────────────────

/**
 * Input to `composeBlueprint()`.
 *
 * Callers supply: the models to compose, identity fields, and any
 * overrides to the merged result.
 */
export interface BlueprintCompositionMeta {
  /** Stable blueprint key. */
  key:                     string;
  /** Human-readable name. */
  name:                    string;
  /** Short marketplace description. */
  description:             string;
  /** Optional longer pitch. */
  longDescription?:        string;
  /** Industry classification. */
  industry:                BlueprintIndustry;
  /** Searchable tags. */
  tags?:                   string[];
  /**
   * Ordered list of site models to compose.
   * Pages and rules are merged in this order.
   */
  models:                  SiteModel[];
  /** Override the theme preset auto-resolved from the first model. */
  recommendedThemePreset?: ThemePresetKey;
  /** Override the theme family auto-resolved from the first model. */
  recommendedThemeFamily?: ThemeFamilyName | string;
  /**
   * Page-level overrides keyed by slug.
   * Each entry is shallow-merged onto the resolved page.
   * Useful for replacing the generic title or a specific block note.
   */
  pageOverrides?: Record<string, Partial<{
    title:         string;
    noteOverrides: Record<string, string>;
    extraBlocks:   PageTypeBlock[];
  }>>;
  /**
   * Additional pages appended after all model pages.
   * Useful for industry-specific bonus pages (e.g. /over-ons on a service site).
   */
  extraPages?:             BlueprintPage[];
  /**
   * Additional rules appended after all model rules.
   * Priority values should be set so they interleave correctly.
   */
  extraRules?:             Omit<StoredRule, "id">[];
  /**
   * Additional scoring rules appended after model scoring rules.
   */
  extraScoringRules?:      BlueprintScoringRule[];
}

// ── Re-export Blueprint for convenience ───────────────────────────────────────

export type { Blueprint, BlueprintPage, BlueprintBlock };
