/**
 * Form variants (forms-as-adaptive-blocks, phase 2).
 *
 * A form variant is the unit the decision engine chooses per visitor. It carries
 * presentation (layout + copy) and an optional presented field set, layered on
 * top of the immutable FormDefinition (which owns validation, email routing,
 * storage, Turnstile — the server contract).
 *
 * `assembleResolvedForm` merges a chosen variant onto the base definition into a
 * ResolvedForm the renderer can consume. It is PURE (no I/O) so it is fully
 * testable and safe to run in both the decide route and the submit route.
 *
 * ─── Field-set safety ─────────────────────────────────────────────────────────
 *
 *   A variant may only DROP (optional), RELABEL, or REORDER fields — never add a
 *   field the definition does not know, and never change a field's type or
 *   validation. We enforce this here: each variant field is matched to the
 *   definition by `key`; the definition's type + validation win, only the
 *   variant's label/placeholder/helpText are applied. Required definition fields
 *   that a variant omits are re-appended, so a submission always validates
 *   against the definition regardless of which variant was shown.
 */

import type { FormDefinition, FormField } from "@/forms/types";
import type { FormLayout }                from "@/tenant/types";
import type { ResolvedForm }              from "./types";

/** The per-visitor variant payload stored alongside adaptive-block variants. */
export interface FormVariantContent {
  title?:          string;
  intro?:          string;
  submitLabel?:    string;
  successMessage?: string;
  redirectPath?:   string;
  layout?:         FormLayout;
  /** Presented field set — a drop/relabel/reorder of the definition's fields. */
  fields?:         FormField[];
}

/**
 * Merge a chosen form variant onto the base definition. When `variant` is null
 * the base definition is returned (copy from the definition, all fields). Never
 * throws.
 */
export function assembleResolvedForm(
  def:     FormDefinition,
  variant: FormVariantContent | null | undefined,
  extras:  { turnstile?: { siteKey: string }; segment?: string | null } = {},
): ResolvedForm {
  const fields = resolvePresentedFields(def.fields, variant?.fields);

  return {
    segment:        extras.segment ?? null,
    title:          variant?.title          ?? def.title,
    intro:          variant?.intro          ?? def.description,
    submitLabel:    variant?.submitLabel,
    successMessage: variant?.successMessage,
    redirectPath:   variant?.redirectPath,
    fields,
    ...(extras.turnstile ? { turnstile: extras.turnstile } : {}),
    ...(variant?.layout  ? { layout: variant.layout }      : {}),
  };
}

/**
 * Compute the presented field set: variant fields matched to the definition by
 * key (definition type/validation preserved, variant label/placeholder applied),
 * with any omitted REQUIRED definition field re-appended so submit never breaks.
 * Falls back to the full definition fields when the variant sets none.
 */
export function resolvePresentedFields(
  defFields: readonly FormField[],
  variantFields: readonly FormField[] | undefined,
): readonly FormField[] {
  if (!variantFields || variantFields.length === 0) return defFields;

  const byKey = new Map(defFields.map((f) => [f.key, f]));
  const chosen: FormField[] = [];
  const seen = new Set<string>();
  for (const vf of variantFields) {
    const df = byKey.get(vf.key);
    if (!df || seen.has(vf.key)) continue; // unknown key or duplicate → skip
    seen.add(vf.key);
    // Definition owns type + validation; variant may relabel / re-hint only.
    chosen.push({
      ...df,
      ...(vf.label       ? { label:       vf.label }       : {}),
      ...(vf.placeholder ? { placeholder: vf.placeholder } : {}),
      ...(vf.helpText    ? { helpText:    vf.helpText }     : {}),
    } as FormField);
  }
  // Re-append required definition fields a variant dropped, so a submission still
  // validates against the definition.
  for (const df of defFields) {
    if (!seen.has(df.key) && df.validation?.required) chosen.push(df);
  }
  return chosen;
}
