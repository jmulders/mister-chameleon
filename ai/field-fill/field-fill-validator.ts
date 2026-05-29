/**
 * AI Field Fill — Validator
 *
 * Validates and sanitises raw AI output for a field fill call.
 *
 * ─── Responsibilities ─────────────────────────────────────────────────────────
 *
 *   1. Parse the raw AI response string as JSON.
 *   2. Confirm the top-level shape: { fields: Record<string,string>, confidence? }.
 *   3. Strip any keys from `fields` that are NOT in the allowed set.
 *   4. Enforce per-field maxWords and maxChars constraints (truncate, don't reject).
 *   5. Strip HTML tags from all field values.
 *   6. Return a clean FieldFillOutput or a ValidationFailure.
 *
 * ─── Fail-safe guarantee ──────────────────────────────────────────────────────
 *
 *   This function never throws.  All parse/validation errors return a
 *   ValidationFailure with a descriptive reason.  The caller (apply-field-fill)
 *   falls back to original CMS content on any failure.
 *
 * ─── No rejection on individual fields ───────────────────────────────────────
 *
 *   Rather than rejecting the entire output when one field is too long,
 *   the validator TRUNCATES the offending field to the limit boundary.
 *   This is intentional — a truncated headline is better than losing all
 *   personalised rewrites because one subtitle was two words over.
 *
 *   The trace records finalValues so operators can see which fields were
 *   truncated and tune their maxWords settings accordingly.
 */

import type { FieldFillOutput, FieldFillSpec } from "./types";

// ── Public types ──────────────────────────────────────────────────────────────

/** Discriminated union returned by validateFieldFillOutput(). */
export type ValidationResult =
  | { ok: true;  output: FieldFillOutput }
  | { ok: false; reason: string };

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Validate and sanitise raw AI model output for a field fill call.
 *
 * @param raw           The raw string returned by the AI model (expected JSON).
 * @param allowedFields Fields the AI was permitted to fill, with their specs.
 *                      Used to strip disallowed keys and enforce constraints.
 *
 * @returns  { ok: true, output } on success.
 *           { ok: false, reason } on any parse or structural failure.
 *           Individual over-limit fields are truncated rather than rejected.
 */
export function validateFieldFillOutput(
  raw:           string,
  allowedFields: Record<string, FieldFillSpec>,
): ValidationResult {
  // ── Step 1: Parse JSON ─────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    // AI may wrap JSON in markdown code fences — strip them first.
    const cleaned = stripCodeFences(raw);
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: `JSON parse error: ${summarise(raw)}` };
  }

  // ── Step 2: Top-level shape check ─────────────────────────────────────────
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "AI output is not a JSON object." };
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.fields || typeof obj.fields !== "object" || Array.isArray(obj.fields)) {
    return { ok: false, reason: `AI output missing "fields" object. Got keys: ${Object.keys(obj).join(", ")}` };
  }

  // ── Step 3: confidence ─────────────────────────────────────────────────────
  let confidence: number | undefined;
  if (obj.confidence !== undefined) {
    if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
      // Invalid confidence — accept the fields but drop the confidence score
      confidence = undefined;
    } else {
      confidence = obj.confidence;
    }
  }

  // ── Step 4: Strip, sanitise, and constrain fields ─────────────────────────
  const rawFields = obj.fields as Record<string, unknown>;
  const cleanFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawFields)) {
    // Only accept fields that were in the allowed set
    if (!(key in allowedFields)) continue;

    // Only accept string values
    if (typeof value !== "string") continue;

    const spec = allowedFields[key]!;

    // Strip any HTML tags
    let text = stripHtml(value.trim());

    // Enforce constraints
    text = enforceWordLimit(text, spec.maxWords);
    text = enforceCharLimit(text, spec.maxChars);

    // Skip empty strings after sanitisation
    if (text.length === 0) continue;

    cleanFields[key] = text;
  }

  return {
    ok:     true,
    output: { fields: cleanFields, confidence },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences from AI output.
 *
 * The AI sometimes wraps JSON in ```json ... ``` blocks despite being
 * told not to.  Strip them before parsing.
 */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1]! : trimmed;
}

/** Strip basic HTML tags from a string. */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Truncate text to at most `maxWords` words.
 * Words are split on whitespace.  Undefined limit = no truncation.
 */
function enforceWordLimit(text: string, maxWords: number | undefined): string {
  if (maxWords === undefined || maxWords <= 0) return text;

  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  return words.slice(0, maxWords).join(" ");
}

/**
 * Truncate text to at most `maxChars` characters.
 * Truncation happens at a word boundary when possible to avoid cutting mid-word.
 * Undefined limit = no truncation.
 */
function enforceCharLimit(text: string, maxChars: number | undefined): string {
  if (maxChars === undefined || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;

  // Try to cut at the last space before the limit
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut;
}

/** Return a short summary of a string for error messages. */
function summarise(s: string): string {
  const trimmed = s.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
}
