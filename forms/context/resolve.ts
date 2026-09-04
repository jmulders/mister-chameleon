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
 * Validate a CMS-authored post-submit redirect target. Unlike `safeRelativePath`
 * — which only ever allows same-site paths, and stays that way for the overlay /
 * CMS redirect — a Form Section block may also point at an external thank-you
 * page, so absolute http(s) URLs are allowed here as well.
 *
 * Accepts:
 *   - a root-relative path: starts with a single "/" (never "//", which is a
 *     protocol-relative URL to another host)
 *   - an absolute URL with protocol http: or https:
 *
 * Everything else — javascript:, data:, mailto:, "//host", unparseable input —
 * returns undefined, so an open redirect can't be authored from the CP.
 */
export function safeRedirectTarget(p?: string): string | undefined {
  if (!p) return undefined;
  const v = p.trim();
  if (!v) return undefined;
  if (v.startsWith("/")) return v.startsWith("//") ? undefined : v;
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
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

// ── Post-submit behaviour ─────────────────────────────────────────────────────
//
// The two decisions useTenantForm makes after a successful POST — where to go,
// or what to say — extracted as pure functions so both are unit-testable
// without a DOM. The hook only performs the resulting action.

/** What the form should do after a successful submission. */
export type PostSubmitAction =
  | { kind: "push";    path:    string }  // same-site → client-side navigation
  | { kind: "assign";  url:     string }  // external  → full page load
  | { kind: "message"; message: string }; // stay put, show the thank-you copy

/**
 * Resolve the raw (not yet validated) redirect target from the three possible
 * sources, most specific first.
 *
 * A CMS block only takes precedence when it explicitly asks to redirect; with
 * `postSubmit` "message" — or absent, which is every block authored before the
 * field existed — the pre-existing overlay / definition redirect is used
 * unchanged, so nothing about current behaviour shifts.
 */
export function resolveRedirectTarget(input: {
  readonly postSubmit?:             "message" | "redirect";
  readonly blockRedirectUrl?:       string;
  readonly overlayRedirectPath?:    string;
  readonly definitionRedirectPath?: string;
}): string | undefined {
  const contextual = input.overlayRedirectPath ?? input.definitionRedirectPath;
  return input.postSubmit === "redirect"
    ? (input.blockRedirectUrl ?? contextual)
    : contextual;
}

/**
 * Decide what happens after `{ ok: true }` comes back.
 *
 * `target` is the raw value from resolveRedirectTarget; it is validated here, so
 * an unsafe one (javascript:, //host, …) degrades to showing the message rather
 * than navigating. Authored copy — the contextual overlay, then the CMS block —
 * beats the generic message the API echoes back; without either, the API's own
 * message wins, as it did before.
 */
export function resolvePostSubmitAction(
  target: string | undefined,
  messages: {
    readonly overlaySuccessMessage?: string;
    readonly blockSuccessMessage?:   string;
    readonly responseMessage?:       string;
    readonly fallbackMessage:        string;
  },
): PostSubmitAction {
  const safe = safeRedirectTarget(target);
  if (safe) return safe.startsWith("/") ? { kind: "push", path: safe } : { kind: "assign", url: safe };
  return {
    kind:    "message",
    message: messages.overlaySuccessMessage
      ?? messages.blockSuccessMessage
      ?? messages.responseMessage
      ?? messages.fallbackMessage,
  };
}
