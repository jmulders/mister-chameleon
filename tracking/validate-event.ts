/**
 * Event Request Validator
 *
 * Pure validation logic for incoming POST /api/events request bodies.
 * Kept separate from the route handler so it can be unit-tested in isolation
 * and reused if the API is ever replicated (e.g. a batch endpoint).
 *
 * ─── Validation rules ────────────────────────────────────────────────────────
 *
 *   eventType  required, must be a member of ALLOWED_EVENT_TYPES
 *   payload    required, must be a plain object (JSON object, not array/null)
 *
 * ─── No external schema library ──────────────────────────────────────────────
 *
 *   Validation is implemented as typed guard functions so no runtime
 *   dependency is needed (zod, yup, etc. cannot be npm-installed in this env).
 *   Each check produces a descriptive error message suitable for API responses.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const result = validateEventRequest(await request.json());
 *   if (!result.ok) {
 *     return NextResponse.json({ error: result.error }, { status: result.status });
 *   }
 *   // result.value is ValidatedEventRequest
 */

import { isValidEventType, ALLOWED_EVENT_TYPES } from "./event-types";
import type { EventType } from "./event-types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ── Result types ──────────────────────────────────────────────────────────────

/** The cleaned, type-narrowed shape after successful validation. */
export interface ValidatedEventRequest {
  eventType: EventType;
  payload: Record<string, unknown>;
  /**
   * Optional tenant slug extracted from the request body.
   * Null when the client didn't send one (legacy or non-tenant contexts).
   */
  tenantId: string | null;
}

/** Validation succeeded — `value` is safe to use. */
export type ValidationOk = { ok: true; value: ValidatedEventRequest };

/** Validation failed — `error` is a user-facing message, `status` is the HTTP code. */
export type ValidationErr = { ok: false; error: string; status: 400 | 422 };

/** Discriminated union returned by `validateEventRequest`. */
export type ValidationResult = ValidationOk | ValidationErr;

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Validates the raw parsed JSON body of a POST /api/events request.
 *
 * Returns a typed `ValidationResult` — never throws.
 * The caller is responsible for converting validation errors to HTTP responses.
 *
 * @param body  The parsed JSON value from `request.json()`.
 *              May be any JavaScript value; this function handles all edge cases.
 */
export function validateEventRequest(body: unknown): ValidationResult {
  // ── Body must be a plain object ────────────────────────────────────────────

  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      status: 400,
    };
  }

  // ── eventType: required, must be a known type ──────────────────────────────

  const { eventType, payload, tenantId: rawTenantId } = body as Record<string, unknown>;

  if (eventType === undefined || eventType === null) {
    return {
      ok: false,
      error: 'Missing required field: "eventType".',
      status: 400,
    };
  }

  if (typeof eventType !== "string") {
    return {
      ok: false,
      error: '"eventType" must be a string.',
      status: 422,
    };
  }

  if (!isValidEventType(eventType)) {
    return {
      ok: false,
      error: `Unknown event type: "${eventType}". Allowed values: ${ALLOWED_EVENT_TYPES.map((t) => `"${t}"`).join(", ")}.`,
      status: 422,
    };
  }

  // ── payload: required, must be a plain object ──────────────────────────────

  if (payload === undefined || payload === null) {
    return {
      ok: false,
      error: 'Missing required field: "payload".',
      status: 400,
    };
  }

  if (!isPlainObject(payload)) {
    return {
      ok: false,
      error: '"payload" must be a JSON object (not an array or primitive).',
      status: 422,
    };
  }

  // ── tenantId: optional, must be a string when present ─────────────────────

  // Accept a non-empty string tenant ID from the request body. Non-string
  // values and empty strings are coerced to null rather than rejected, since
  // tenant scoping is best-effort and must never block event recording.
  const tenantId: string | null =
    typeof rawTenantId === "string" && rawTenantId.trim().length > 0
      ? rawTenantId.trim()
      : null;

  // ── All checks passed ──────────────────────────────────────────────────────

  return {
    ok: true,
    value: {
      eventType,
      payload: payload as Record<string, unknown>,
      tenantId,
    },
  };
}

