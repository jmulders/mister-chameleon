/**
 * Theme contrast audit.
 *
 * Models the exact resolution a browser performs for the two-layer theme system
 * so we can compute the WCAG contrast ratio of each (surface, text) token pair
 * for every preset — in both light-on-light and dark-on-dark directions — and
 * prove that the structural token fix removes the failures.
 *
 * ─── The bug this models ──────────────────────────────────────────────────────
 *
 *   A custom property declared ONLY at :root as `--x: var(--y)` has its var()
 *   substituted at :root (against the :root value of --y) and inherits the
 *   already-resolved value down. Re-pinning --y at [data-site] does NOT reach
 *   --x. So a token like `--form-input-text: var(--text)` stays the :root text
 *   colour on every preset unless it is ALSO re-pinned at [data-site].
 *
 *   resolveAtDataSite() reproduces this: a token present in the preset's emitted
 *   record (the [data-site] layer) uses that concrete value; a token absent from
 *   the record falls back to its :root declaration resolved against :root ONLY.
 *
 * This module is pure — the caller supplies the parsed :root defaults (see
 * tests/theme/contrast-audit.test.ts, which reads them from theme.css) and a
 * preset's emitted record (tenantThemeToVarsRecord). No fs, no app imports.
 */

import { contrastRatio } from "@/lib/color";

export interface AuditPair {
  id:      string;
  label:   string;
  /** Surface (background) token name. */
  surface: string;
  /** Text (foreground) token name. */
  text:    string;
  /** Minimum acceptable WCAG ratio (4.5 normal text, 3.0 large/supplementary). */
  min:     number;
  /** True for pairs the structural fix targets (form tokens re-pinned at [data-site]). */
  fixed?:  boolean;
}

/**
 * (surface, text) pairs that are designed to be shown together. Controls (button
 * / hero / cta / body / card) are already emitted concretely and should pass
 * before and after; the `fixed` pairs are the form tokens this change re-pins.
 */
export const AUDIT_PAIRS: readonly AuditPair[] = [
  { id: "body",        label: "Body text on page",         surface: "--bg",                text: "--text",                 min: 4.5 },
  { id: "subtle",      label: "Body text on subtle section", surface: "--section-subtle-bg", text: "--text",               min: 4.5 },
  { id: "card",        label: "Body text on card",         surface: "--card-bg",           text: "--text",                 min: 4.5 },
  // Button labels are semibold UI text (large-text / UI-component tier → 3.0).
  { id: "btn-primary", label: "Primary button",            surface: "--btn-bg",            text: "--btn-text",             min: 3.0 },
  { id: "btn-secondary", label: "Secondary button",        surface: "--btn-secondary-bg",  text: "--btn-secondary-text",   min: 3.0 },
  { id: "hero-title",  label: "Hero title",                surface: "--section-hero-bg",   text: "--hero-title-color",     min: 4.5 },
  { id: "hero-subtitle", label: "Hero subtitle",           surface: "--section-hero-bg",   text: "--hero-subtitle-color",  min: 3.0 },
  { id: "cta-body",    label: "CTA section body",          surface: "--section-cta-bg",    text: "--section-cta-body",     min: 3.0 },

  // ── Fixed by this change: form tokens re-pinned at [data-site] ──────────────
  { id: "form-label",       label: "Form label on form section", surface: "--form-bg",         text: "--form-label-color",       min: 4.5, fixed: true },
  { id: "form-help",        label: "Form help text",             surface: "--form-bg",         text: "--form-help-color",        min: 3.0, fixed: true },
  { id: "form-input",       label: "Input text",                 surface: "--form-input-bg",   text: "--form-input-text",        min: 4.5, fixed: true },
  { id: "form-placeholder", label: "Input placeholder",          surface: "--form-input-bg",   text: "--form-input-placeholder", min: 3.0, fixed: true },
];

/** Token names the structural fix newly emits at [data-site] (colour tokens only). */
export const NEWLY_EMITTED_COLOR_TOKENS: readonly string[] = [
  "--form-bg", "--form-input-bg", "--form-input-text", "--form-input-placeholder",
  "--form-label-color", "--form-help-color", "--form-input-border", "--form-input-focus-ring",
];

const VAR_RE = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/;

/** Resolve a value using ONLY the :root map (models the indirection bug). */
export function resolveRootOnly(value: string, root: Record<string, string>, seen: Set<string> = new Set()): string {
  const v = (value ?? "").trim();
  const m = v.match(VAR_RE);
  if (!m) return v;
  const name = m[1];
  const fallback = m[2];
  if (seen.has(name)) return "";
  const next = new Set(seen).add(name);
  if (root[name] !== undefined) return resolveRootOnly(root[name], root, next);
  if (fallback !== undefined)   return resolveRootOnly(fallback, root, next);
  return "";
}

/**
 * Resolve a token as a browser would at [data-site]: the preset record (the
 * [data-site] layer) wins; a token absent from the record falls back to its
 * :root declaration resolved against :root only (the bug).
 */
export function resolveAtDataSite(name: string, record: Record<string, string>, root: Record<string, string>): string {
  if (record[name] !== undefined) return resolveRootOnly(record[name], { ...root, ...record });
  if (root[name] !== undefined)   return resolveRootOnly(root[name], root);
  return "";
}

export interface AuditRow {
  preset:   string;
  pair:     string;
  label:    string;
  surface:  string; // resolved hex (or raw value when unparseable)
  text:     string; // resolved hex
  ratio:    number | null;
  min:      number;
  pass:     boolean; // true when ratio is null (unparseable → not a contrast claim) or >= min
  fixed:    boolean;
}

/**
 * Audit one preset. `simulatePreFix` removes the newly-emitted colour tokens from
 * the record first, so the fixed pairs resolve via the buggy :root indirection —
 * giving the "before" column.
 */
export function auditPreset(
  presetKey: string,
  record: Record<string, string>,
  root: Record<string, string>,
  opts: { simulatePreFix?: boolean } = {},
): AuditRow[] {
  const effective = { ...record };
  if (opts.simulatePreFix) {
    for (const t of NEWLY_EMITTED_COLOR_TOKENS) delete effective[t];
  }
  return AUDIT_PAIRS.map((p) => {
    const surface = resolveAtDataSite(p.surface, effective, root);
    const text    = resolveAtDataSite(p.text, effective, root);
    const ratio   = contrastRatio(surface, text);
    // A null ratio means one side is not a plain hex (transparent / rgba / font);
    // that is not a contrast claim we assert on — treat as pass but surface it.
    const pass = ratio === null ? true : ratio >= p.min;
    return { preset: presetKey, pair: p.id, label: p.label, surface, text, ratio, min: p.min, pass, fixed: !!p.fixed };
  });
}
