/**
 * Custom attributes — server-side sanitisation and tenant-declaration filtering.
 *
 * The snippet (or a platform page) supplies a raw `customAttributes` map in the
 * decide payload. It is CLIENT-SUPPLIED and therefore untrusted and spoofable, so
 * before it ever reaches rule evaluation we:
 *
 *   1. Coerce the shape (object of scalar values), cap the count, normalise keys.
 *   2. When the tenant's declarations are known, keep ONLY declared attribute
 *      names, coerce each value to the declared type, and drop values outside a
 *      declared `allowedValues`. Undeclared names are dropped entirely, so a page
 *      can never inject arbitrary rule-affecting keys.
 *
 * Values are for content variation only — never access, pricing, or security.
 * See docs/custom-attributes-spec.md.
 */

import type { CustomAttributeDeclaration } from "@/tenant/types";

/** Hard cap on the number of attributes honoured from a single request. */
export const MAX_CUSTOM_ATTRIBUTES = 24;
/** Max length of a string attribute value; longer values are truncated. */
export const MAX_ATTRIBUTE_VALUE_LENGTH = 128;

const NAME_RE = /^[a-z0-9_-]{1,40}$/;

type Scalar = string | number | boolean;

/** Normalise a raw name to the lowercase [a-z0-9_-]{1,40} form, or null if invalid. */
function normaliseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

/** Coerce a raw value to a declared type, or null when it cannot be represented. */
function coerceToType(value: unknown, type: CustomAttributeDeclaration["type"]): Scalar | null {
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true")  return true;
    if (value === "false") return false;
    return null;
  }
  if (type === "number") {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  // string
  const s = typeof value === "string" ? value : (typeof value === "number" || typeof value === "boolean") ? String(value) : null;
  return s === null ? null : s.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
}

/** Coerce a raw value to any scalar (no declaration available) or null. */
function coerceScalar(value: unknown): Scalar | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number")  return Number.isFinite(value) ? value : null;
  if (typeof value === "string")  return value.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
  return null;
}

/**
 * Sanitise a raw customAttributes map from a request.
 *
 * @param raw           The untrusted `context.customAttributes` from the payload.
 * @param declarations  The tenant's declared attributes. When provided, the
 *                      result is filtered to declared names and coerced/validated
 *                      against each declaration. When omitted, only shape
 *                      sanitisation runs (used where declarations are unavailable).
 */
export function sanitizeCustomAttributes(
  raw:          unknown,
  declarations?: readonly CustomAttributeDeclaration[] | null,
): Record<string, Scalar> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const declByName = declarations && declarations.length > 0
    ? new Map(declarations.map((d) => [d.name.trim().toLowerCase(), d]))
    : null;

  const out: Record<string, Scalar> = {};
  let count = 0;

  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_CUSTOM_ATTRIBUTES) break;
    const name = normaliseName(rawKey);
    if (name === null) continue;

    if (declByName) {
      const decl = declByName.get(name);
      if (!decl) continue; // undeclared → dropped
      const value = coerceToType(rawValue, decl.type);
      if (value === null) continue;
      if (decl.allowedValues && decl.allowedValues.length > 0 && !decl.allowedValues.includes(value as string | number)) {
        continue; // outside the declared allowlist
      }
      out[name] = value;
      count++;
    } else {
      const value = coerceScalar(rawValue);
      if (value === null) continue;
      out[name] = value;
      count++;
    }
  }

  return out;
}
