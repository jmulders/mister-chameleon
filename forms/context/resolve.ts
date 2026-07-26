/**
 * Contextual forms — pure resolution logic.
 *
 * No I/O, no server-only imports — safe to unit-test and to call from either the
 * render endpoint or the submit handler so both agree on the same segment.
 */

import type { FormField } from "@/forms";
import type {
  FormContextRule,
  FormContextConditions,
  FormContextSignals,
  FormOverlay,
  ResolvedForm,
} from "./types";

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Does a single rule's conditions all match the request signals? */
export function ruleMatches(cond: FormContextConditions, signals: FormContextSignals): boolean {
  const path    = norm(signals.path || "/");
  const query   = signals.query ?? {};
  const country = norm(signals.country);

  if (cond.pathStartsWith && !path.startsWith(norm(cond.pathStartsWith))) return false;
  if (cond.pathExact && path !== norm(cond.pathExact)) return false;

  if (cond.utmSource   && norm(query.utm_source)   !== norm(cond.utmSource))   return false;
  if (cond.utmMedium   && norm(query.utm_medium)   !== norm(cond.utmMedium))   return false;
  if (cond.utmCampaign && norm(query.utm_campaign) !== norm(cond.utmCampaign)) return false;

  if (cond.queryKey) {
    const actual = norm(query[cond.queryKey.trim().toLowerCase()] ?? query[cond.queryKey]);
    if (norm(cond.queryValue) !== actual) return false;
  }

  if (cond.country && norm(cond.country) !== country) return false;

  return true;
}

/**
 * Resolve the winning segment for a request. Enabled rules are evaluated in
 * ascending `priority` (ties keep array order); the first match wins.
 * Returns null when nothing matched (caller falls back to the base form).
 */
export function resolveFormSegment(
  rules: readonly FormContextRule[],
  signals: FormContextSignals,
): string | null {
  const ordered = [...rules]
    .filter((r) => r.enabled !== false)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.priority - b.r.priority) || (a.i - b.i));

  for (const { r } of ordered) {
    if (ruleMatches(r.conditions, signals)) return r.segment;
  }
  return null;
}

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
    fields:         overlay?.fields && overlay.fields.length > 0 ? overlay.fields : base.fields,
  };
}
