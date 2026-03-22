/**
 * Contact Flow Types
 *
 * Defines the data shapes flowing through the contact form submission pipeline:
 *
 *   Browser form submit
 *        ↓  POST /api/contact  (JSON body: ContactFormRequest)
 *   Server route handler
 *        ↓  buildContactContextPayload()
 *   N8nContactPayload
 *        ↓  POST to N8N_CONTACT_WEBHOOK_URL
 *   n8n workflow (CRM enrichment, email, task creation, …)
 *
 * ─── Design constraints ───────────────────────────────────────────────────────
 *
 *   - All fields in the n8n payload are either required primitives or
 *     explicitly nullable — no `undefined` in the outbound JSON.
 *   - The `session` block includes only signals already tracked by the app;
 *     no PII is derived beyond what the visitor themselves submitted.
 *   - `servedExperience` may be null if no homepage render was captured yet
 *     (e.g. the visitor navigated directly to a contact page without hitting /),
 *     which allows n8n to handle incomplete context gracefully.
 */

// ── Raw form inputs ───────────────────────────────────────────────────────────

/**
 * The raw fields from the contact form.
 * Validated and sanitised server-side before being included in the payload.
 */
export interface ContactFormFields {
  /** Visitor's display name — required */
  name: string;
  /** Visitor's email address — required */
  email: string;
  /** Free-text message body — required */
  message: string;
}

/**
 * The JSON body accepted by POST /api/contact.
 *
 * `pathname` is the page path where the form was submitted.
 * It is sent by the client so the server doesn't need to infer it.
 */
export interface ContactFormRequest extends ContactFormFields {
  /** Current page pathname, e.g. "/" or "/contact". Sent by the browser. */
  pathname: string;
}

// ── Enrichment blocks ─────────────────────────────────────────────────────────

/**
 * Campaign acquisition context extracted from the visitor's session.
 *
 * All UTM values are null when the visitor arrived without UTM parameters.
 * `source` and `referrerDomain` reflect the resolved traffic attribution.
 */
export interface ContactCampaignContext {
  /** Resolved traffic source: "linkedin" | "google" | "direct" | "unknown" */
  source: string;
  /** Parsed referrer hostname, e.g. "linkedin.com". Null when absent. */
  referrerDomain: string | null;
  /** utm_source query parameter from the landing URL */
  utmSource: string | null;
  /** utm_medium query parameter */
  utmMedium: string | null;
  /** utm_campaign query parameter */
  utmCampaign: string | null;
  /** utm_content query parameter */
  utmContent: string | null;
  /** utm_term query parameter */
  utmTerm: string | null;
}

/**
 * Session behaviour context drawn from first-party history signals.
 *
 * These fields let n8n understand the depth of the lead's engagement before
 * submitting — e.g. a visitor with pageViewCount=7 and hasClickedCta=true
 * is far warmer than a single-view direct visitor.
 */
export interface ContactSessionContext {
  /** First-party session UUID (mc_session_id cookie) */
  sessionId: string;
  /** "new" | "returning" */
  visitType: string;
  /** "mobile" | "desktop" */
  device: string;
  /** Total prior page_view events for this session (excludes the current request) */
  pageViewCount: number;
  /** Whether this session has ever produced a cta_click event */
  hasClickedCta: boolean;
  /** Total cta_click count for this session */
  ctaClickCount: number;
  /**
   * ISO-8601 timestamp of the first event ever recorded for this session.
   * Null when the session is brand-new (no events yet).
   */
  firstSeenAt: string | null;
}

/**
 * The most recent homepage experience served to this visitor.
 *
 * Gives n8n full visibility into which messaging angle the visitor saw
 * before deciding to reach out — critical for CRM routing and follow-up copy.
 *
 * Null when no served_variant row exists for this session yet.
 */
export interface ContactServedExperience {
  /** Hero variant key, e.g. "hero_linkedin_vision" */
  heroKey: string;
  /** Proof variant key, e.g. "proof_vision" */
  proofKey: string;
  /** CTA variant key, e.g. "cta_meeting" */
  ctaKey: string;
  /**
   * Human-readable reason why this plan was selected.
   * Useful for n8n to route the lead to the appropriate workflow branch.
   * e.g. "Traffic source indicates thought-leadership/social intent."
   */
  reason: string;
  /**
   * ISO-8601 timestamp when this experience was rendered.
   * Allows n8n to calculate time-to-submit (servedAt → submittedAt).
   */
  servedAt: string;
}

/**
 * Metadata about the page where the form was submitted.
 */
export interface ContactPageContext {
  /** URL pathname, e.g. "/" or "/contact" */
  pathname: string;
}

// ── Outbound n8n payload ──────────────────────────────────────────────────────

/**
 * The complete enriched payload fired to the n8n webhook on contact submission.
 *
 * ─── n8n usage guide ─────────────────────────────────────────────────────────
 *
 *   Top-level routing:
 *     {{ $json.campaign.source }}          → route LinkedIn leads to AE channel
 *     {{ $json.servedExperience.ctaKey }}  → branch on which CTA triggered interest
 *     {{ $json.session.hasClickedCta }}    → warm vs cold lead routing
 *
 *   Lead enrichment:
 *     {{ $json.contact.email }}            → CRM lookup / create
 *     {{ $json.session.sessionId }}        → link to Supabase session analytics
 *     {{ $json.session.pageViewCount }}    → engagement score input
 *
 *   Follow-up personalisation:
 *     {{ $json.campaign.utmCampaign }}     → reference the campaign in email copy
 *     {{ $json.servedExperience.reason }}  → explain why they saw a specific hero
 *     {{ $json.session.firstSeenAt }}      → "you first visited X days ago"
 *
 * ─── Null handling in n8n ────────────────────────────────────────────────────
 *
 *   Nullable fields use `null` (not `undefined`) so they are always present
 *   in the JSON body. n8n IF nodes can test: `{{ $json.field !== null }}`.
 */
export interface N8nContactPayload {
  /**
   * ISO-8601 timestamp when this submission was processed server-side.
   * Use this (not a client timestamp) as the authoritative submission time.
   */
  submittedAt: string;

  /** The raw form data — name, email, message */
  contact: ContactFormFields;

  /** Campaign acquisition context — UTMs, source, referrer */
  campaign: ContactCampaignContext;

  /** Session behaviour signals — engagement depth, visit history */
  session: ContactSessionContext;

  /**
   * The homepage experience most recently served to this visitor.
   * Null when the visitor submitted the form without a prior homepage render
   * being captured (e.g. direct navigation to /contact).
   */
  servedExperience: ContactServedExperience | null;

  /** The page where the form was submitted */
  page: ContactPageContext;
}

// ── Submission result ─────────────────────────────────────────────────────────

/**
 * Result of attempting to send a contact payload to n8n.
 * Mirrors the RepositoryResult pattern used elsewhere in the codebase.
 */
export type ContactSubmissionResult =
  | { ok: true }
  | { ok: false; error: string };
