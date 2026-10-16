/**
 * Journey event-id helpers for the snippet decide route and v1/slot.
 *
 * visitor_journey_events.event_id is a `uuid` column, and recordJourneyEvent
 * dedupes on it via ON CONFLICT (event_id) DO NOTHING. Anything that is not a
 * valid UUID makes that upsert fail silently, so the visitor never gets journey
 * history. The snippet sends crypto.randomUUID() where available but falls back
 * to `mc_<timestamp>_<rand>` on older browsers, so the route normalises here.
 */

import { createHash } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest client-sent event id we are willing to hash. */
const MAX_RAW_EVENT_ID_LENGTH = 200;

/**
 * Deterministic UUID (v5-style, SHA-1 based) from an arbitrary name string.
 * Same name → same UUID, so derived ids still dedupe on retries.
 */
export function deterministicUuid(name: string): string {
  const h = createHash("sha1").update(name).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** True when the value is a UUID string (any version, any case). */
export function isUuid(raw: unknown): raw is string {
  return typeof raw === "string" && UUID_RE.test(raw);
}

/**
 * Turn a client-sent pageview event id into a value safe for the event_id
 * column:
 *   - a valid UUID passes through (trimmed);
 *   - another non-empty, bounded string is hashed into a deterministic UUID,
 *     scoped by `namespace` (the tenant), so retries of the same pageview
 *     still collapse into one row;
 *   - anything else is omitted (the DB default mints a fresh id).
 */
export function toJourneyEventId(raw: unknown, namespace: string): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim();
  if (id === "" || id.length > MAX_RAW_EVENT_ID_LENGTH) return undefined;
  if (isUuid(id)) return id;
  return deterministicUuid(`snippet-event|${namespace}|${id}`);
}
