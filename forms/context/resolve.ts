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
