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
 *   personalization— Behavioral scoring, journey state, adaptive content.
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
}

// ── Consent categories ────────────────────────────────────────────────────────

/** The gatable consent categories used throughout the platform. */
export type ConsentCategory = "analytics" | "personalization" | "enrichment";

/**
 * Normalized consent state used internally by the consent engine.
 * Always computed from the parsed cookie + tenant privacy settings.
 */
export interface ConsentState {
  /** Whether the user has seen and responded to the banner. */
  hasResponded: boolean;
  /** analytics consent (page views, event logs, GA4). */
  analytics: boolean;
  /** personalization consent (behavioral scoring, adaptive content). */
  personalization: boolean;
  /** enrichment consent (IP-to-company, Leadinfo, CRM). */
  enrichment: boolean;
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
};

// ── Serialization helpers ─────────────────────────────────────────────────────

/** Serialize ConsentState to the compact cookie payload. */
export function serializeConsentState(state: ConsentState): string {
  const payload: ConsentCookiePayload = {
    v: 1,
    a: state.analytics,
    p: state.personalization,
    e: state.enrichment,
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
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}
