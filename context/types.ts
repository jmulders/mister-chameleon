/**
 * Visitor Context Types
 *
 * Canonical type definitions for the signal layer.
 * Every dimension is a narrow discriminated union so downstream
 * code (decision engine, analytics, CMS queries) can be fully typed.
 *
 * Relationship to the rest of the system:
 *
 *   Request headers/cookies
 *        ↓  detectVisitorContext()
 *   VisitorContext           ← defined here
 *        ↓  DecisionEngine.evaluate()
 *   DecisionResult           ← defined in context/decision
 *        ↓  CMS fetch
 *   Experience               ← defined in context/experience
 *        ↓  RSC render
 *   Adaptive page
 */

// ── Traffic source ────────────────────────────────────────────────────────────

/**
 * Where the visitor came from.
 *
 * MVP set: linkedin | google | direct | unknown
 * Future: facebook | twitter | email | paid | organic | referral | …
 */
export type TrafficSource =
  | "linkedin"
  | "google"
  | "direct"
  | "unknown";

// ── Device type ───────────────────────────────────────────────────────────────

/**
 * Visitor's device class, inferred from the User-Agent header.
 *
 * MVP: mobile | desktop
 * Future: tablet | tv | bot | …
 */
export type DeviceType = "mobile" | "desktop";

// ── Visit type ────────────────────────────────────────────────────────────────

/**
 * Whether this is the visitor's first touch or a repeat visit.
 * Resolved from the `mc_seen` cookie: absent → new, present → returning.
 */
export type VisitType = "new" | "returning";

// ── Visitor context ───────────────────────────────────────────────────────────

/**
 * The full set of signals captured from a single HTTP request.
 *
 * `source`, `device`, and `visitType` are the three resolved dimensions
 * that drive MVP decision logic. The raw fields beneath them are kept
 * for debugging, analytics, and future rule authoring.
 */
export interface VisitorContext {
  // ── Resolved dimensions (used by the decision engine) ──────────────────

  /** Detected traffic source */
  source: TrafficSource;

  /** Detected device class */
  device: DeviceType;

  /** First or repeat visit */
  visitType: VisitType;

  // ── Raw signal values (for debugging and future rules) ─────────────────

  /** Full Referer header value, null if absent */
  rawReferrer: string | null;

  /** Parsed referrer hostname only, e.g. "linkedin.com" */
  referrerDomain: string | null;

  /** utm_source query parameter */
  utmSource: string | null;

  /** utm_medium query parameter */
  utmMedium: string | null;

  /** utm_campaign query parameter */
  utmCampaign: string | null;

  /** utm_content query parameter */
  utmContent: string | null;

  /** utm_term query parameter */
  utmTerm: string | null;

  /** Raw User-Agent string, null if absent */
  userAgent: string | null;

  /**
   * Millisecond timestamp when the context was resolved.
   * Useful for cache invalidation and latency measurement.
   */
  resolvedAt: number;
}

// ── Serialised form (safe to pass over the wire / into RSC props) ─────────────

/**
 * A JSON-serialisable snapshot of the visitor context.
 * Identical shape to VisitorContext but expressed as a plain object.
 * Use this type for API responses and RSC prop drilling.
 */
export type SerializedVisitorContext = Readonly<VisitorContext>;
