/**
 * Blueprint Types
 *
 * A Blueprint is a pre-built industry-specific starting configuration for a
 * tenant.  Activating a blueprint creates or overwrites:
 *   - Page structures (homepage, pricing, about, etc.)
 *   - Default behavioral rules (StoredRule format)
 *   - Scoring rules (score per event type)
 *   - Sequence patterns
 *   - Theme family + preset recommendation
 *
 * Blueprints are defined in code (see blueprints/definitions/).  They are
 * applied idempotently and non-destructively (existing custom content is never
 * overwritten unless `force: true` is passed).
 *
 * ─── Precedence ──────────────────────────────────────────────────────────────
 *
 *   The blueprint is a starting point, not a constraint.  Operators can modify
 *   every generated piece after activation without restrictions.
 */

import type { StoredRule, StoredRulesConfig }    from "@/decision/rules/stored-rule";
import type { ThemePresetKey }                    from "@/design-system/theme/presets";
import type { SiteModelKey }                      from "./site-models/types";

// ── Industry taxonomy ─────────────────────────────────────────────────────────

export type BlueprintIndustry =
  | "b2b_saas"
  | "ecommerce"
  | "healthcare"
  | "lead_gen"
  | "marketplace"
  | "professional_services"
  | "recruitment"
  | "media";

// ── Page template ─────────────────────────────────────────────────────────────

/** A single page defined by a blueprint. */
export interface BlueprintPage {
  /** URL slug, e.g. "/" for homepage, "/pricing" */
  slug:          string;
  /** Human-readable page title. */
  title:         string;
  /** Ordered list of block types to scaffold on this page. */
  blocks:        BlueprintBlock[];
}

export interface BlueprintBlock {
  /** Matches ContentBlockKey in page-config. */
  type:          string;
  /** Optional human-readable note for the operator. */
  note?:         string;
}

// ── Scoring rule spec ─────────────────────────────────────────────────────────

/**
 * Lightweight scoring rule spec inside a blueprint.
 * Converted to full ScoringRule rows when the blueprint is applied.
 */
export interface BlueprintScoringRule {
  key:           string;
  label:         string;
  description?:  string;
  event_type:    string;
  event_value?:  string | null;
  page_category?: string | null;
  score:         number;
  decay_profile: string;
  priority:      number;
}

// ── Sequence spec ─────────────────────────────────────────────────────────────

export interface BlueprintSequenceStep {
  event_type:    string;
  event_value?:  string | null;
  page_category?: string | null;
}

export interface BlueprintSequencePattern {
  slug:              string;
  label:             string;
  sequence:          BlueprintSequenceStep[];
  max_gap_minutes:   number;
  score:             number;
}

// ── Main Blueprint type ───────────────────────────────────────────────────────

export interface Blueprint {
  /** Stable machine-readable key, e.g. "b2b_saas". */
  key:               BlueprintIndustry | string;
  /** Human-readable display name. */
  name:              string;
  /** One-line description shown in the marketplace. */
  description:       string;
  /** Industry classification. */
  industry:          BlueprintIndustry;
  /** Optional longer pitch shown in the preview modal. */
  longDescription?:  string;
  /** Category tags for filtering. */
  tags?:             string[];

  // ── Site model annotation ─────────────────────────────────────────────────
  /**
   * The site model(s) this blueprint was composed from.
   * Informational — used by the admin setup wizard for grouping and filtering.
   * Does not affect the apply-blueprint flow.
   */
  siteModels?: SiteModelKey[];

  // ── Theme recommendation ──────────────────────────────────────────────────
  recommendedThemePreset?: ThemePresetKey;
  recommendedThemeFamily?: string;

  // ── Page structure ────────────────────────────────────────────────────────
  pages:             BlueprintPage[];

  // ── Behavioral rules ──────────────────────────────────────────────────────
  /** StoredRule-compatible descriptors. IDs are prefixed with blueprint key on apply. */
  rules:             Omit<StoredRule, "id">[];

  // ── Scoring rules ─────────────────────────────────────────────────────────
  scoringRules:      BlueprintScoringRule[];

  // ── Sequence patterns ─────────────────────────────────────────────────────
  sequencePatterns:  BlueprintSequencePattern[];
}

// ── Apply options ─────────────────────────────────────────────────────────────

export interface ApplyBlueprintOptions {
  /** Tenant to apply the blueprint to. */
  tenantId:        string;
  /** The blueprint to apply. */
  blueprint:       Blueprint;
  /**
   * When true, overwrite existing rules and scoring rules even if they have
   * been customised.  Default: false (safe — only creates missing items).
   */
  force?:          boolean;
  /**
   * When true, set the tenant's theme to the blueprint recommendation.
   * Default: true.
   */
  applyTheme?:     boolean;
}

// ── Apply result ──────────────────────────────────────────────────────────────

export interface ApplyBlueprintResult {
  ok:                  boolean;
  error?:              string;
  pagesCreated:        number;
  rulesCreated:        number;
  rulesSkipped:        number;
  scoringRulesCreated: number;
  sequencesCreated:    number;
  themeApplied:        boolean;
}
