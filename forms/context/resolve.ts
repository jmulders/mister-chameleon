/**
 * Contextual forms — pure resolution logic.
 *
 * No I/O, no server-only imports — safe to unit-test and to call from either the
 * render endpoint or the submit handler so both agree on the same segment.
 */

import type { FormField } from "@/forms";
import type { FormOverlay, ResolvedForm } from "./types";

/**
 * Apply an overlay on top of the base field set, producing the final
 * ready-to-render form. `overlay` may be undefined (no matching segment).
 *
 * Copy fields (title/intro/submitLabel/successMessage) are returned as
 * OVERRIDES ONLY — undefined when the segment doesn't override them — so the
 * caller can layer them over its own defaults (e.g. CMS copy → definition).
 * `fields` is always the EFFECTIVE set: the overlay's fields when provided,
 * otherwise the base definition's fields.
 */
export function applyFormOverlay(
  base: { fields: readonly FormField[] },
  segment: string | null,
  overlay: FormOverlay | undefined,
): ResolvedForm {
  return {
    segment,
    title:          overlay?.title,
    intro:          overlay?.intro,
    submitLabel:    overlay?.submitLabel,
    successMessage: overlay?.successMessage,
    redirectPath:   safeRelativePath(overlay?.redirectPath),
    fields:         overlay?.fields && overlay.fields.length > 0 ? overlay.fields : base.fields,
  };
}

/**
 * Only allow same-site relative paths as redirect targets — guards against open
 * redirects from tenant config. Must start with a single "/" and not "//".
 */
export function safeRelativePath(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const v = p.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

/**
 * Build a ready-to-render ResolvedForm for a CMS-managed form (one authored in
 * the CMS/CP, not registered as a code FormDefinition). Unlike `applyFormOverlay`
 * — whose copy fields are OVERRIDES layered over a base — a CMS form has no code
 * base, so its title / successMessage are the effective values and its converted
 * fields (see `toPlatformFields`) are the effective field set. Pure: the caller
 * (`resolveContextualForm`) does the I/O and passes the already-converted fields.
 */
export function buildCmsResolvedForm(cms: {
  readonly title?:          string;
  readonly successMessage?: string;
  readonly redirectPath?:   string;
  readonly fields:          readonly FormField[];
}): ResolvedForm {
  return {
    segment:        null,
    title:          cms.title,
    successMessage: cms.successMessage,
    redirectPath:   safeRelativePath(cms.redirectPath),
    fields:         cms.fields,
  };
}

/**
 * Field-set + render decision for FormSectionBlock, given the two possible
 * sources: the synchronous code FormDefinition (`codeFields`, present only for a
 * registered FormKey) and the async overlay (`overlayFields`, carrying either a
 * contextual variant of a code form OR a CMS-resolved form).
 *
 *   - Effective fields: the overlay's when it has any (a contextual variant or a
 *     CMS form wins over the raw definition), else the code definition's.
 *   - Render: whenever EITHER source yields fields. A code form renders
 *     immediately (before its overlay loads); a CMS form renders once the
 *     overlay arrives; an unknown form (neither source) renders nothing — a clean
 *     empty rather than a crash.
 */
export function selectFormRender(
  codeFields:    readonly FormField[] | undefined,
  overlayFields: readonly FormField[] | undefined,
): { fields: readonly FormField[]; render: boolean } {
  const hasCode    = Boolean(codeFields    && codeFields.length    > 0);
  const hasOverlay = Boolean(overlayFields && overlayFields.length > 0);
  const fields     = hasOverlay ? overlayFields! : (codeFields ?? []);
  return { fields, render: hasCode || hasOverlay };
}
