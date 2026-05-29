/**
 * Event Request Validator
 *
 * Pure validation logic for incoming POST /api/events request bodies.
 * Kept separate from the route handler so it can be unit-tested in isolation
 * and reused if the API is ever replicated (e.g. a batch endpoint).
 *
 * ─── Validation rules ────────────────────────────────────────────────────────
 *
 *   eventType    required, must be a member of ALLOWED_EVENT_TYPES
 *   payload      required, must be a plain object (JSON object, not array/null)
 *   eventId      optional, must be RFC-4122 UUID v4 when present
 *   tenantId     optional, must be a non-empty string when present
 *   occurredAt   optional, must be a valid ISO-8601 timestamp when present
 *                → used as the event's occurred_at in the DB instead of server
 *                  receive time.  Critical for retried events so the DB timestamp
 *                  reflects when the event actually happened, not when it landed.
 *   visitorId    optional, non-empty string when present
 *                → the stable localStorage UUID (mc_visitor_id) that identifies
 *                  the same person across browser sessions.  Stored in metadata
 *                  so journey events can be linked to first-party visitor identity.
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

/** Returns true if `value` looks like a valid ISO-8601 date/time string. */
function isIso8601(value: string): boolean {
  // Accept strings the Date constructor can parse as a finite timestamp.
  // This is intentionally lenient — we just need a parseable date.
  const ts = Date.parse(value);
  return !isNaN(ts);
}

// ── Result types ──────────────────────────────────────────────────────────────

/** The cleaned, type-narrowed shape after successful validation. */
export interface ValidatedEventRequest {
  eventType:  EventType;
  payload:    Record<string, unknown>;
  /**
   * Optional tenant slug extracted from the request body.
   * Null when the client didn't send one (legacy or non-tenant contexts).
   */
  tenantId:   string | null;
  /**
   * Client-generated canonical event UUID for deduplication.
   * Null when the client didn't send one (pre-migration clients, server-side
   * events).  The DB will auto-generate a UUID via DEFAULT in that case.
   */
  eventId:    string | null;
  /**
   * Client-provided ISO-8601 timestamp of when the event actually occurred.
   * Null when the client didn't send one — the DB falls back to now().
   *
   * IMPORTANT: always use this when available instead of server-receive time.
   * For retried events, server-receive time can be minutes later than the
   * actual occurrence time, distorting recency and sequence analysis.
   */
  occurredAt: string | null;
  /**
   * Stable visitor UUID from localStorage (mc_visitor_id).
   * Null when the client didn't send one.
   *
   * Linking journey events to visitor_id enables cross-session behavioral
   * analysis without requiring server-side session stitching.
   */
  visitorId:  string | null;
}

/** Validation succeeded — `value` is safe to use. */
export type ValidationOk = { ok: true; value: ValidatedEventRequest };

/** Validation failed — `error` is a user-facing message, `status` is the HTTP code. */
export type ValidationErr = { ok: false; error: string; status: 400 | 422 };

/** Discriminated union returned by `validateEventRequest`. */
export type ValidationResult = ValidationOk | ValidationErr;

// ── UUID regex (RFC-4122 v4) ──────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const {
    eventType,
    payload,
    tenantId:    rawTenantId,
    eventId:     rawEventId,
    occurredAt:  rawOccurredAt,
    visitorId:   rawVisitorId,
  } = body as Record<string, unknown>;

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
  //
  // Accept a non-empty string tenant ID from the request body. Non-string
  // values and empty strings are coerced to null rather than rejected, since
  // tenant scoping is best-effort and must never block event recording.
  const tenantId: string | null =
    typeof rawTenantId === "string" && rawTenantId.trim().length > 0
      ? rawTenantId.trim()
      : null;

  // ── eventId: optional, must be a UUID string when present ─────────────────
  //
  // Accept a client-generated UUID for event deduplication.
  // Silently coerce invalid / missing values to null — the DB will generate
  // a UUID via DEFAULT.  This ensures backward-compat with older clients.
  const eventId: string | null =
    typeof rawEventId === "string" && UUID_RE.test(rawEventId.trim())
      ? rawEventId.trim()
      : null;

  // ── occurredAt: optional, must be a valid ISO-8601 string when present ────
  //
  // Coerce invalid values to null — the server falls back to now().
  // Using the client timestamp is always preferred when available because:
  //   • Events may be sent with a delay (retry queue, network latency).
  //   • Recency and sequence analysis depend on accurate occurrence timestamps.
  //   • Server receive time ≠ actual event time for retried events.
  const occurredAt: string | null = (() => {
    if (typeof rawOccurredAt !== "string") return null;
    const trimmed = rawOccurredAt.trim();
    return trimmed.length > 0 && isIso8601(trimmed) ? trimmed : null;
  })();

  // ── visitorId: optional, non-empty string when present ───────────────────
  //
  // The stable visitor UUID from localStorage (mc_visitor_id).
  // Stored in journey event metadata to support cross-session analysis.
  // Invalid / missing values coerced to null.
  const visitorId: string | null =
    typeof rawVisitorId === "string" && rawVisitorId.trim().length > 0
      ? rawVisitorId.trim()
      : null;

  // ── All checks passed ──────────────────────────────────────────────────────

  return {
    ok: true,
    value: {
      eventType,
      payload: payload as Record<string, unknown>,
      tenantId,
      eventId,
      occurredAt,
      visitorId,
    },
  };
}
