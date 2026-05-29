/**
 * Event Type Definitions
 *
 * Canonical registry of every event that can be sent to POST /api/events.
 * This is the single source of truth for:
 *
 *   - The server-side allowlist (API route validation)
 *   - The client-side tracking helper (track() in index.ts)
 *   - Any analytics pipeline that consumes the events table
 *
 * ─── Adding a new event type ──────────────────────────────────────────────────
 *
 *   1. Add the string literal to `ALLOWED_EVENT_TYPES`
 *   2. Add a payload interface below (even if it's just `EmptyPayload`)
 *   3. Add a branch to `EventPayloadMap`
 *   4. The API route picks up the new type automatically via `isValidEventType()`
 *
 * ─── Payload convention ───────────────────────────────────────────────────────
 *
 *   Payload keys are snake_case to match the Postgres JSONB column convention.
 *   All payload fields are optional at the API level — the API accepts
 *   `Record<string, unknown>` and the DB stores whatever is sent.
 *   The typed interfaces below document the *expected* shape for each type.
 */

// ── Allowed event types ───────────────────────────────────────────────────────

/**
 * The complete list of event types accepted by the tracking API.
 *
 * Used as both the TypeScript union source and the runtime validation allowlist.
 * Using `as const` ensures each element is a string literal, not `string`.
 */
export const ALLOWED_EVENT_TYPES = [
  "page_view",
  "variant_served",
  "cta_click",
  "scroll_depth",
  "contact_form_submit",
  // Journey behavioral events — must match JOURNEY_EVENT_TYPES in app/api/events/route.ts
  "form_start",
  "form_submit",
  "download",
] as const;

/**
 * String literal union of all valid event types.
 *
 * @example
 *   const t: EventType = "cta_click";  // ✓
 *   const t: EventType = "button_tap"; // ✗ TypeScript error
 */
export type EventType = (typeof ALLOWED_EVENT_TYPES)[number];

/**
 * Runtime type guard. Returns true if `value` is a member of ALLOWED_EVENT_TYPES.
 *
 * Used by the API route to validate the incoming `eventType` field without
 * a schema validation library.
 *
 * @example
 *   if (!isValidEventType(body.eventType)) {
 *     return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
 *   }
 */
export function isValidEventType(value: unknown): value is EventType {
  return (
    typeof value === "string" &&
    (ALLOWED_EVENT_TYPES as readonly string[]).includes(value)
  );
}

// ── Per-event payload shapes ──────────────────────────────────────────────────
//
// These interfaces document the expected payload for each event type.
// They are NOT enforced by the API — the API accepts any JSON object.
// They exist so the client-side track() helper can be typed correctly,
// and so future analytics consumers know what fields to expect.

/** Fired once per homepage render (by the Server Component via after()). */
export interface PageViewPayload {
  /** URL pathname, e.g. "/" */
  pathname?: string;
  /** Document title */
  title?: string;
  /** Resolved traffic source */
  source?: string;
  /** Device class */
  device?: string;
  /** new | returning */
  visit_type?: string;
}

/**
 * Fired when the experience composer resolves a set of variant keys.
 * Useful for verifying that the decision layer is working as expected
 * independently of whether the user clicks anything.
 */
export interface VariantServedPayload {
  /** Selected hero variant key */
  hero_key: string;
  /** Selected proof variant key */
  proof_key: string;
  /** Selected CTA variant key */
  cta_key: string;
  /** Whether the fallback plan was used */
  used_fallback?: boolean;
  /** The rule that fired */
  reason?: string;
}

/** Fired when a visitor clicks a primary call-to-action button. */
export interface CtaClickPayload {
  /** The CTA variant key that was rendered, e.g. "cta_meeting" */
  cta_key?: string;
  /** The href the CTA points to */
  href?: string;
  /** The visible label text */
  label?: string;
  /**
   * Where on the page the click happened.
   * e.g. "hero" | "cta_block" | "nav"
   */
  position?: string;
}

/**
 * Fired when a visitor scrolls past a meaningful depth threshold.
 * Typically fired at 25%, 50%, 75%, 90% of page height.
 */
export interface ScrollDepthPayload {
  /**
   * Integer percentage of page height scrolled, e.g. 50 for 50%.
   * Prefer milestone values (25, 50, 75, 90, 100) over raw pixel offsets.
   */
  depth: number;
  /** Pathname of the page where the scroll occurred */
  pathname?: string;
}

/**
 * Fired server-side when a contact form submission is successfully processed.
 *
 * Capturing this as a first-party event lets the analytics pipeline correlate
 * form submissions with prior onsite behaviour (page views, CTA clicks) using
 * the session_id foreign key.
 *
 * Note: this event is written by the API route handler after dispatching to n8n,
 * not by client-side JavaScript — so it is always accurate and not blocked by
 * ad blockers or JS errors.
 */
export interface ContactFormSubmitPayload {
  /** The CTA variant key that was shown before the submission */
  served_cta_key?: string;
  /** Resolved traffic source at submission time */
  source?: string;
  /** The page pathname where the form was submitted */
  pathname?: string;
  /** Whether the n8n webhook dispatch succeeded */
  n8n_dispatched?: boolean;
}

/**
 * Fired when a visitor begins interacting with a form (first focus on any field).
 * Used for behavioral scoring — indicates intent to engage with a conversion path.
 */
export interface FormStartPayload {
  /** The page pathname where the form appears */
  page_path?: string;
  /** Form identifier, e.g. "contact", "demo-request", "newsletter" */
  form_id?: string;
  /** Which CTA variant was active when the form was engaged */
  cta_key?: string;
}

/**
 * Fired when a visitor successfully submits a form.
 * Identical scope to `contact_form_submit` but generic (not CMS-specific).
 * Journey engine treats this as a strong conversion signal.
 */
export interface FormSubmitPayload {
  /** The page pathname where the form appears */
  page_path?: string;
  /** Form identifier */
  form_id?: string;
  /** Which CTA variant was shown before submission */
  cta_key?: string;
}

/**
 * Fired when a visitor downloads a resource (PDF, whitepaper, template, etc.)
 * Indicates high-value research intent; scored strongly in the journey engine.
 */
export interface DownloadPayload {
  /** URL or path of the downloaded resource */
  resource_url?: string;
  /** Human-readable resource label, e.g. "Product Brochure 2025" */
  resource_label?: string;
  /** The page pathname where the download was triggered */
  page_path?: string;
}

// ── Payload map ───────────────────────────────────────────────────────────────

/**
 * Maps each EventType to its expected payload shape.
 *
 * Used to type the `payload` parameter in the client-side `track()` helper:
 *
 *   track({ eventType: "cta_click", payload: { cta_key: "cta_meeting" } })
 *   //                                         ↑ typed as CtaClickPayload
 */
export interface EventPayloadMap {
  page_view:            PageViewPayload;
  variant_served:       VariantServedPayload;
  cta_click:            CtaClickPayload;
  scroll_depth:         ScrollDepthPayload;
  contact_form_submit:  ContactFormSubmitPayload;
  form_start:           FormStartPayload;
  form_submit:          FormSubmitPayload;
  download:             DownloadPayload;
}

// ── Tracking event (used by the client-side track() helper) ───────────────────

/**
 * A typed tracking event passed to the client-side `track()` function.
 *
 * The generic constraint ensures the payload type matches the event type:
 *
 *   track({ eventType: "scroll_depth", payload: { depth: 50 } })  // ✓
 *   track({ eventType: "scroll_depth", payload: { href: "/foo" } }) // ✗ type error
 */
export interface TrackingEvent<T extends EventType = EventType> {
  eventType: T;
  payload?: EventPayloadMap[T];
}
