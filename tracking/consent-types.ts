/**
 * Consent Types
 *
 * Canonical type definitions for the platform consent model.
 * Shared between client-side (consent-store.ts) and server-side
 * (lib/consent/server-consent.ts) reading paths.
 *
 * ─── Cookie ──────────────────────────────────────────────────────────────────
 *
 *   Consent is persisted in the `mc_consent` cookie using a compact JSON
 *   representation:
 *
 *     { "v": 1, "a": true, "p": true, "e": false }
 *
 *   The cookie is intentionally NOT httpOnly so it is readable by both:
 *     - Client JS  → for immediate gating in trackEvent(), ConsentBanner
 *     - Server     → for gating in /api/events, /api/client-context, enrichment
 *
 *   Default (no cookie present): all false — privacy-first.
 *
 * ─── Categories ──────────────────────────────────────────────────────────────
 *
 *   essential      — Always true. Session cookie, security. Cannot be refused.
 *   analytics      — Page view counting, event logging, GA4 forwarding.
 *   personalization— PERSISTENT, cross-session behaviour only: a persistent
 *                    visitor identity, cross-session behaviour history / journey
 *                    state (visitor_behavior_state), and behavioural scoring built
 *                    from them. It does NOT gate the anonymous context layer
 *                    (device, coarse geo, source/UTM/referrer, time), which runs
 *                    without consent. See docs/design/host-cmp-consent.md.
 *   enrichment     — IP-to-company, Leadinfo, CRM lookups.
 *
 * ─── Precedence ──────────────────────────────────────────────────────────────
 *
 *   finalAllowed(category) = tenantPolicyAllows(category) && userConsentGiven(category)
 *
 *   A tenant can restrict a category platform-wide even if the user would
 *   otherwise consent.  User consent can only further restrict, never expand.
 */

// ── Cookie format ─────────────────────────────────────────────────────────────

/** Compact wire format stored in the mc_consent cookie. */
export interface ConsentCookiePayload {
  /** Schema version. Current: 1. */
  v: number;
  /** analytics consent. */
  a: boolean;
  /** personalization consent. */
  p: boolean;
  /** enrichment consent. */
  e: boolean;
  /**
   * advertising / marketing consent. Optional for backward compatibility: a
   * v1 cookie written before this category existed simply omits it, and it
   * parses as denied (privacy-first). Never bumped the schema version so old
   * cookies keep the visitor's other choices instead of being reset.
   */
  ad?: boolean;
}

// ── Consent categories ────────────────────────────────────────────────────────

/** The gatable consent categories used throughout the platform. */
export type ConsentCategory = "analytics" | "personalization" | "enrichment" | "advertising";

/**
 * Normalized consent state used internally by the consent engine.
 * Always computed from the parsed cookie + tenant privacy settings.
 */
export interface ConsentState {
  /** Whether the user has seen and responded to the banner. */
  hasResponded: boolean;
  /** analytics consent (page views, event logs, GA4). */
  analytics: boolean;
  /** personalization consent: persistent cross-session behaviour only (visitor
   * identity + history/journey + behavioural scoring). The anonymous context
   * layer runs without it. */
  personalization: boolean;
  /** enrichment consent (IP-to-company, Leadinfo, CRM). */
  enrichment: boolean;
  /**
   * advertising / marketing consent: sharing data with third-party ad platforms
   * for measurement and audiences — specifically forwarding ad click identifiers
   * (gclid/fbclid) to Google/Meta conversion APIs. A distinct purpose from
   * first-party analytics, so it has its own basis and is denied by default.
   */
  advertising: boolean;
}

/** The cookie name. Not httpOnly — readable by both client and server. */
export const CONSENT_COOKIE_NAME = "mc_consent";

/** Cookie max-age: 365 days (seconds). */
export const CONSENT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Privacy-first default: all consent categories denied.
 * Used when the cookie is absent or unparseable.
 */
export const DEFAULT_CONSENT: ConsentState = {
  hasResponded:    false,
  analytics:       false,
  personalization: false,
  enrichment:      false,
  advertising:     false,
};

/**
 * Full consent: all categories allowed.
 * Used when user clicks "Accept all".
 */
export const FULL_CONSENT: ConsentState = {
  hasResponded:    true,
  analytics:       true,
  personalization: true,
  enrichment:      true,
  advertising:     true,
};

/**
 * Essential-only consent: no optional categories.
 * Used when user clicks "Accept essential only".
 */
export const ESSENTIAL_CONSENT: ConsentState = {
  hasResponded:    true,
  analytics:       false,
  personalization: false,
  enrichment:      false,
  advertising:     false,
};

// ── Serialization helpers ─────────────────────────────────────────────────────

/** Serialize ConsentState to the compact cookie payload. */
export function serializeConsentState(state: ConsentState): string {
  const payload: ConsentCookiePayload = {
    v: 1,
    a: state.analytics,
    p: state.personalization,
    e: state.enrichment,
    ad: state.advertising,
  };
  return JSON.stringify(payload);
}

/**
 * Parse a raw cookie value string into ConsentState.
 * Returns DEFAULT_CONSENT on any parse error.
 */
export function parseConsentCookieValue(raw: string | null | undefined): ConsentState {
  if (!raw) return DEFAULT_CONSENT;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentCookiePayload>;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CONSENT;
    if (parsed.v !== 1) return DEFAULT_CONSENT;

    return {
      hasResponded:    true,
      analytics:       parsed.a === true,
      personalization: parsed.p === true,
      enrichment:      parsed.e === true,
      advertising:     parsed.ad === true,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}
