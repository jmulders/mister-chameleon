/**
 * Contextual forms — type definitions
 *
 * Lets a tenant vary a form's copy (heading, intro, submit label), its
 * thank-you message, AND its field set based on the visitor's context, using
 * operator-defined rules (URL path, UTM params, query string, country).
 *
 * ─── How it fits together ─────────────────────────────────────────────────────
 *
 *   FormContextRule[]     — operator rules: "when <conditions> → segment X"
 *        ↓  resolveFormSegment(rules, signals)
 *   segmentId | null      — the winning segment for this request (first match)
 *        ↓  overlays[formKey][segmentId]
 *   FormOverlay           — the copy/fields to apply on top of the FormDefinition
 *
 * Rules and overlays live in tenant settings (settings.formContext) — no schema
 * migration. The base FormDefinition (forms/definitions) is always the fallback,
 * so a form with no matching rule renders exactly as before.
 */

import type { FormField } from "@/forms";

// ── Rule conditions ────────────────────────────────────────────────────────────

/**
 * Conditions for a single rule. All present conditions must match (AND).
 * An empty condition object matches every request — useful as a catch-all
 * default when placed last (highest priority number).
 */
export interface FormContextConditions {
  /** Match when the page path starts with this (case-insensitive), e.g. "/pricing". */
  readonly pathStartsWith?: string;
  /** Match when the page path equals this exactly (case-insensitive). */
  readonly pathExact?:      string;
  /** Match on utm_source (case-insensitive exact). */
  readonly utmSource?:      string;
  /** Match on utm_medium (case-insensitive exact). */
  readonly utmMedium?:      string;
  /** Match on utm_campaign (case-insensitive exact). */
  readonly utmCampaign?:    string;
  /** Match when this query-string key equals this value (case-insensitive). */
  readonly queryKey?:       string;
  readonly queryValue?:     string;
  /** Match on visitor country (ISO-3166 alpha-2, case-insensitive). */
  readonly country?:        string;
}

/**
 * One operator rule mapping conditions to a segment id.
 * Lower `priority` is evaluated first; the first matching rule wins.
 */
export interface FormContextRule {
  readonly id:         string;
  /** Human label for the admin UI, e.g. "Paid — Google". */
  readonly label:      string;
  /** The segment this rule assigns when it matches. */
  readonly segment:    string;
  /** Lower = evaluated first. Ties break on array order. */
  readonly priority:   number;
  readonly conditions: FormContextConditions;
  /** When false, the rule is ignored (kept for easy toggling). Defaults to true. */
  readonly enabled?:   boolean;
}

// ── Overlay ────────────────────────────────────────────────────────────────────

/**
 * The context-specific overrides applied on top of a base FormDefinition.
 * Every field is optional — omit to inherit the base value.
 */
export interface FormOverlay {
  /** Heading override. */
  readonly title?:          string;
  /** Sub-text / intro override. */
  readonly intro?:          string;
  /** Submit button label override (the CTA). */
  readonly submitLabel?:    string;
  /** Thank-you / success message override (shown after submit). */
  readonly successMessage?: string;
  /**
   * Full field-set override. When present, it REPLACES the base definition's
   * fields for this segment (both at render and at server validation), so a
   * segment can add, drop, reorder, or relabel fields. Omit to keep the base
   * fields unchanged.
   */
  readonly fields?:         readonly FormField[];
}

// ── Tenant-level container ──────────────────────────────────────────────────────

/**
 * The tenant's contextual-forms configuration, stored at
 * settings.formContext. Absent = feature off; forms render from their base
 * definition exactly as before.
 */
export interface TenantFormContext {
  readonly rules:    readonly FormContextRule[];
  /** overlays[formKey][segmentId] = FormOverlay */
  readonly overlays: Readonly<Record<string, Readonly<Record<string, FormOverlay>>>>;
}

// ── Signals used at resolve time ────────────────────────────────────────────────

/** The request signals a rule is evaluated against. */
export interface FormContextSignals {
  /** Page path the form is shown on, e.g. "/pricing". */
  readonly path?:    string;
  /** Query-string params as a flat map (lowercased keys recommended). */
  readonly query?:   Readonly<Record<string, string>>;
  /** Visitor country (ISO-3166 alpha-2). */
  readonly country?: string | null;
}

/** The resolved, ready-to-render form copy + fields. */
export interface ResolvedForm {
  /** The winning segment id, or null when no rule matched. */
  readonly segment:        string | null;
  readonly title?:         string;
  readonly intro?:         string;
  readonly submitLabel?:   string;
  readonly successMessage?: string;
  /** Effective field set (overlay fields when set, else base definition fields). */
  readonly fields:         readonly FormField[];
}
