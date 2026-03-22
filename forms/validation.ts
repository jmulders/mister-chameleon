/**
 * Form validation
 *
 * Executes the declarative validation rules declared in FormFieldValidation
 * against a raw string value.  Designed for server-side use inside the
 * /api/forms/[formKey] route handler, but is pure and dependency-free so it
 * can also run in edge/middleware environments.
 *
 * ─── Design constraints ────────────────────────────────────────────────────────
 *
 *   1. No validation library dependency.
 *      Rules are evaluated directly from the FormFieldValidation data object.
 *      This keeps the bundle lean and the logic auditable.
 *
 *   2. Server-side only in Fm3.
 *      Client-side progressive enhancement (e.g. on-blur validation) is a
 *      future concern.  The validation functions here are imported by the
 *      API route, not by client components.
 *
 *   3. All values arrive as strings.
 *      FormData serialises everything to string.  Checkbox values arrive as
 *      "true" | "false" (or absent when unchecked).  The validators cast
 *      as needed — the raw value is never assumed to be a number or boolean.
 *
 *   4. Returns the first error per field.
 *      Multiple errors per field are not collected.  Returning the first
 *      violation matches the UX expectation of showing one error at a time.
 *
 * ─── Module structure ──────────────────────────────────────────────────────────
 *
 *   validateField(field, rawValue)   — validate one field; returns error string or null
 *   validateSubmission(fields, body) — validate all fields; returns FieldErrors map
 *   interpolateTemplate(tpl, values) — replace {{key}} placeholders with submission values
 */

import type { FormField, FormFieldValidation } from "@/forms/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A map of field key → human-readable error message for every field that
 * failed validation.  Only failing fields are present — passing fields are
 * absent, not set to null.
 */
export type FieldErrors = Record<string, string>;

/**
 * The structured result of validating a full form submission.
 *
 *   ok     — true when every field passed validation.
 *   errors — field key → error message for every violation (empty when ok).
 *   values — cleaned (trimmed) submission values, keyed by field key.
 *            Present even when ok is false — useful for re-populating forms
 *            or logging partial submissions for debugging.
 */
export type ValidationResult =
  | { ok: true;  errors: Record<string, never>; values: Record<string, string> }
  | { ok: false; errors: FieldErrors;           values: Record<string, string> };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permissive email regex — validates basic structure (local@domain.tld)
 * without rejecting unusual but valid addresses.  Matches the HTML5 email
 * input validation algorithm closely enough for server-side use.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * URL validation — requires an absolute URL with http:// or https:// protocol.
 * Relative URLs, data: URIs, and protocol-relative URLs are rejected.
 */
const URL_RE = /^https?:\/\/.+\..+/;

// ─────────────────────────────────────────────────────────────────────────────
// Field-level validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single field value against its declared validation rules.
 *
 * Returns the first failing rule's error message, or null when the value
 * passes all rules.
 *
 * @param field     - The FormField definition (provides label + validation rules).
 * @param rawValue  - The raw string value from the form submission.
 *                    undefined = field absent from submission body.
 *
 * @example
 * const error = validateField(emailField, "not-an-email");
 * // → "Email address must be a valid email address."
 */
export function validateField(
  field: FormField,
  rawValue: string | undefined,
): string | null {
  const rules = field.validation;
  if (!rules) return null;

  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  const absent = value === "";

  return applyRules(field.label, value, absent, rules);
}

function applyRules(
  label:  string,
  value:  string,
  absent: boolean,
  rules:  FormFieldValidation,
): string | null {

  // 1. required — must be present and non-empty after trimming
  if (rules.required && absent) {
    return `${label} is required.`;
  }

  // Remaining rules are only evaluated when the field is non-empty.
  // Optional fields with a non-empty value still run through format checks.
  if (absent) return null;

  // 2. email — must be a plausible email address
  if (rules.email && !EMAIL_RE.test(value)) {
    return `${label} must be a valid email address.`;
  }

  // 3. url — must be an absolute http/https URL (only checked when non-empty)
  if (rules.url && !URL_RE.test(value)) {
    return `${label} must be a valid URL starting with http:// or https://.`;
  }

  // 4. minLength — minimum character count
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    return `${label} must be at least ${rules.minLength} characters.`;
  }

  // 5. maxLength — maximum character count
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    return `${label} must be no more than ${rules.maxLength} characters.`;
  }

  // 6. pattern — custom RegExp pattern
  if (rules.pattern) {
    try {
      const re = new RegExp(rules.pattern);
      if (!re.test(value)) {
        return rules.patternMessage ?? `${label} has an invalid format.`;
      }
    } catch {
      // Malformed pattern in definition — skip rather than crash.
      // This is a developer error; log in development if needed.
      if (process.env.NODE_ENV === "development") {
        console.warn(`[forms] Invalid regex pattern on field — pattern: ${rules.pattern}`);
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission-level validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates all fields in a form submission against their FormField definitions.
 *
 * Iterates every field in order, collecting the first error per field.
 * Fields not present in the body are treated as empty strings.
 * Hidden fields are skipped (they carry static preset values, not user input).
 *
 * @param fields  - The ordered field definitions from the FormDefinition.
 * @param body    - The raw submission body (keyed by field.key → string).
 *
 * @returns A ValidationResult — either { ok: true, values } or { ok: false, errors, values }.
 *
 * @example
 * const result = validateSubmission(formDef.fields, Object.fromEntries(formData));
 * if (!result.ok) {
 *   return Response.json({ ok: false, errors: result.errors }, { status: 422 });
 * }
 * await storeSubmission(formDef.key, result.values);
 */
export function validateSubmission(
  fields: readonly FormField[],
  body:   Record<string, string>,
): ValidationResult {
  const errors: FieldErrors = {};
  const values: Record<string, string> = {};

  for (const field of fields) {
    // Hidden fields pass through without validation.
    if (field.type === "hidden") {
      values[field.key] = body[field.key] ?? (
        typeof field.defaultValue === "string" ? field.defaultValue : ""
      );
      continue;
    }

    const rawValue = body[field.key];
    const trimmed  = typeof rawValue === "string" ? rawValue.trim() : "";

    // Store the cleaned value regardless of validity — useful for debugging
    // and for re-populating client forms when errors are returned.
    values[field.key] = trimmed;

    const error = validateField(field, rawValue);
    if (error !== null) {
      errors[field.key] = error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return { ok: true, errors: {} as Record<string, never>, values };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces `{{fieldKey}}` placeholders in a template string with the
 * corresponding values from a validated submission.
 *
 * Used by the email dispatch layer to resolve dynamic subject lines and body
 * copy from the FormEmailRouting templates defined in each FormDefinition.
 *
 * Unknown placeholders (keys not present in `values`) are replaced with an
 * empty string rather than left as-is — prevents raw `{{key}}` tokens from
 * leaking into sent emails.
 *
 * @param template  - A string containing zero or more `{{key}}` tokens.
 * @param values    - The validated submission values (keyed by field key).
 *
 * @example
 * interpolateTemplate("New message from {{name}}", { name: "Jane", email: "jane@example.com" })
 * // → "New message from Jane"
 *
 * @example — Unknown placeholder replaced with empty string:
 * interpolateTemplate("Hello {{unknown}}", { name: "Jane" })
 * // → "Hello "
 */
export function interpolateTemplate(
  template: string,
  values:   Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}
