/**
 * Contextual forms — type definitions
 *
 * A form's presentation (copy, thank-you message, field set) can be varied per
 * visitor. Selection is handled by the decision engine: a rule sets
 * plan.formVariants[<type>] and the decide route layers the chosen variant onto
 * the base FormDefinition.
 *
 * `FormOverlay` is the shape of those copy/field overrides applied on top of the
 * base definition by `applyFormOverlay`; the base FormDefinition
 * (forms/definitions) is always the fallback, so a form with no variant renders
 * from its definition unchanged.
 */

import type { FormField } from "@/forms";
import type { BlockMedia } from "@/lib/media/block-media";

// ── Rule conditions ────────────────────────────────────────────────────────────

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
  /** Thank-you / success message override (shown inline after submit). */
  readonly successMessage?: string;
  /**
   * Relative path to send the visitor to after a successful submit (e.g.
   * "/thank-you-demo"). When set, the visitor is redirected there instead of
   * seeing the inline success message — so each segment can have its own
   * thank-you page. Must be a relative path (leading "/", no protocol/host).
   */
  readonly redirectPath?:   string;
  /**
   * Full field-set override. When present, it REPLACES the base definition's
   * fields for this segment (both at render and at server validation), so a
   * segment can add, drop, reorder, or relabel fields. Omit to keep the base
   * fields unchanged.
   */
  readonly fields?:         readonly FormField[];
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
  /** Relative path to redirect to after a successful submit (segment thank-you page). */
  readonly redirectPath?:  string;
  /** Effective field set (overlay fields when set, else base definition fields). */
  readonly fields:         readonly FormField[];
  /**
   * Cloudflare Turnstile widget config for the renderer. Present only when this
   * form has Turnstile enabled AND the tenant has a site key configured; absent
   * otherwise (no widget). The site key is public. Server-side token
   * verification is handled independently in the submit route.
   */
  readonly turnstile?:     { readonly siteKey: string };

  /**
   * Presentation layout for the form (phase 1 of the forms-as-adaptive-blocks
   * work). Controls only how the form is arranged — the field set and the
   * server contract are unchanged. Absent → the default single-column layout.
   *
   *   template: which layout to render (single, or a split with a contact panel
   *             on the left/right).
   *   contactPanel: optional person/contact details shown in the split panel.
   */
  readonly layout?: {
    readonly template: "single" | "split-left" | "split-right";
    readonly contactPanel?: {
      readonly name?:     string;
      readonly role?:     string;
      /** @deprecated Legacy flat image URL. New saves write `media`; kept for backward-compat render. */
      readonly photoUrl?: string;
      /** Shared block media (image / video with facade). Preferred over photoUrl. */
      readonly media?:    BlockMedia;
      readonly phone?:    string;
      readonly email?:    string;
    };
  };
}
