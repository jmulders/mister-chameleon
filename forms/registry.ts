/**
 * Form registry
 *
 * The single source of truth for all registered form definitions on the
 * platform.  Consumers resolve a FormDefinition by its key via
 * getFormDefinition() rather than importing definition files directly.
 *
 * ─── Why a registry? ──────────────────────────────────────────────────────────
 *
 *   Centralising registration here mirrors the block registry pattern used
 *   in page-config/registry.ts.  It means:
 *
 *   1. Any module that needs a form definition imports from "@/forms" only.
 *      It never needs to know which file the definition lives in.
 *
 *   2. Adding a new form type requires exactly two edits:
 *      a) Add the key to the FormKey union in forms/types.ts.
 *      b) Add the definition file + registration entry here.
 *      No other files change.
 *
 *   3. getAllFormDefinitions() gives admin UIs and tooling a complete list
 *      of available forms without manual enumeration at the call site.
 *
 * ─── Registration contract ────────────────────────────────────────────────────
 *
 *   Every FormKey that appears in the FormKey union MUST have a corresponding
 *   entry in FORM_REGISTRY.  Missing entries produce a TypeScript error because
 *   the registry is typed as Record<FormKey, FormDefinition> — the compiler
 *   enforces exhaustiveness.
 *
 * ─── Adding a new form ────────────────────────────────────────────────────────
 *
 *   1. Add the key to FormKey in forms/types.ts:
 *        export type FormKey = "contact" | "application" | "newsletter";
 *
 *   2. Create forms/definitions/newsletter.ts exporting a FormDefinition.
 *
 *   3. Import and register it here:
 *        import { NEWSLETTER_FORM } from "./definitions/newsletter";
 *        // …add to FORM_REGISTRY:
 *        newsletter: NEWSLETTER_FORM,
 */

import type { FormDefinition, FormKey } from "@/forms/types";
import { CONTACT_FORM }     from "@/forms/definitions/contact";
import { APPLICATION_FORM } from "@/forms/definitions/application";
import { APPOINTMENT_FORM } from "@/forms/definitions/appointment";
import { NEWSLETTER_FORM }  from "@/forms/definitions/newsletter";
import { LOCATIE_TEST_FORM } from "@/forms/definitions/locatie-test";

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Internal registry mapping every FormKey to its platform-side definition.
 *
 * Typed as `Record<FormKey, FormDefinition>` to enforce exhaustiveness at
 * compile time — every key in the FormKey union must be registered here.
 * The TypeScript compiler will error if a key is missing.
 *
 * @internal — Use getFormDefinition() / getAllFormDefinitions() in consumers.
 */
const FORM_REGISTRY: Record<FormKey, FormDefinition> = {
  contact:     CONTACT_FORM,
  application: APPLICATION_FORM,
  appointment: APPOINTMENT_FORM,
  newsletter:  NEWSLETTER_FORM,
  "locatie-test": LOCATIE_TEST_FORM,
};

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns the FormDefinition for the given key, or `undefined` when the key
 * is not registered.
 *
 * In practice, every valid FormKey has a registered definition (the registry
 * is exhaustive).  The `undefined` return covers the case where the key
 * originates from an untyped source (CMS string, URL param) that has not
 * been narrowed to the FormKey union yet.
 *
 * @example
 * const def = getFormDefinition("contact");
 * if (!def) return notFound();
 * renderForm(def);
 *
 * @example — CMS block with an unvalidated formKey string:
 * const def = getFormDefinition(block.formKey as FormKey);
 * if (!def) {
 *   logger.warn(`Unknown form key: ${block.formKey}`);
 *   return null;
 * }
 */
export function getFormDefinition(key: FormKey): FormDefinition | undefined {
  return FORM_REGISTRY[key];
}

/**
 * Returns all registered form definitions in insertion order.
 *
 * Use in admin UIs to populate form-type pickers, in documentation generators,
 * or in test suites that need to assert over all form definitions at once.
 *
 * The returned array is a snapshot — it does not update if the registry
 * changes (which it cannot, since the registry is a module-level constant).
 *
 * @example — List all form titles in an admin picker:
 * const forms = getAllFormDefinitions();
 * forms.forEach(f => console.log(f.key, f.title));
 *
 * @example — Validate all definitions in a test suite:
 * getAllFormDefinitions().forEach(def => {
 *   expect(def.fields.length).toBeGreaterThan(0);
 *   expect(def.action.storeSubmissions).toBeDefined();
 * });
 */
export function getAllFormDefinitions(): readonly FormDefinition[] {
  return Object.values(FORM_REGISTRY) as FormDefinition[];
}

/**
 * Returns true when the given string is a registered FormKey.
 *
 * Use to narrow an untyped CMS string to the FormKey union before passing
 * it to getFormDefinition().
 *
 * @example
 * if (isFormKey(block.formKey)) {
 *   const def = getFormDefinition(block.formKey); // now typed as FormKey
 * }
 */
export function isFormKey(value: string): value is FormKey {
  return Object.prototype.hasOwnProperty.call(FORM_REGISTRY, value);
}

/**
 * Resolve a raw form HANDLE (e.g. from a CMS relation) to a registered FormKey,
 * tolerating separator + case differences between the CMS and the code.
 *
 * Statamic generates form handles in snake_case ("locatie_test"), while the code
 * FormDefinitions use kebab-case keys ("locatie-test"). Without normalisation a
 * CP-linked form never matches getFormDefinition() and the form_section renders
 * nothing. Resolution order (conservative — no fuzzy matching, so no false hits):
 *   1. exact match;
 *   2. separator swap `_` ↔ `-` ("locatie_test" → "locatie-test");
 *   3. case-insensitive, separator-agnostic compare against the registry.
 * Returns undefined for an unknown handle. Builds on resolveFormHandle (#370),
 * which first extracts the handle string from the CP field shape.
 */
export function resolveFormKey(handle: string | null | undefined): FormKey | undefined {
  const raw = (handle ?? "").trim();
  if (!raw) return undefined;
  if (isFormKey(raw)) return raw;                                   // 1. exact
  for (const v of [raw.replace(/_/g, "-"), raw.replace(/-/g, "_")]) // 2. separator swap
    if (isFormKey(v)) return v;
  // 3. case- AND separator-agnostic: strip every separator so a CP-slugified
  //    handle with NO separator (e.g. Statamic turns "locatie_test" into the
  //    form handle "locatietest") still matches a kebab-case key ("locatie-test").
  //    Safe against false hits: the registry keys are distinct once separators
  //    are removed (contact / application / appointment / newsletter / locatietest).
  const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, "");
  const target = norm(raw);
  for (const key of Object.keys(FORM_REGISTRY) as FormKey[])
    if (norm(key) === target) return key;
  return undefined;
}
