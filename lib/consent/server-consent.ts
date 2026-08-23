/**
 * Server-side consent reader
 *
 * Parses the `mc_consent` cookie from an HTTP Cookie header and returns a
 * normalized ConsentState.  Used in Server Components, API routes, and
 * middleware to gate analytics, personalization, and enrichment server-side.
 *
 * ─── Privacy-first default ────────────────────────────────────────────────────
 *
 *   When the cookie is absent or unparseable, ALL optional categories are
 *   denied. This is intentional: the platform should never assume consent.
 *
 * ─── Tenant-level gating ──────────────────────────────────────────────────────
 *
 *   This module applies BOTH the user's cookie and the tenant's privacy policy:
 *
 *     finalAllowed = tenantPolicyAllows(category) && userConsentGiven(category)
 *
 *   A tenant may disable a category platform-wide (e.g., GDPR-restricted
 *   deployment) regardless of what the user's cookie says.
 *
 * ─── Pure function — no I/O ───────────────────────────────────────────────────
 *
 *   All exports are pure. Safe to call in Edge Middleware and SSR.
 */

import {
  type ConsentState,
  CONSENT_COOKIE_NAME,
  DEFAULT_CONSENT,
  FULL_CONSENT,
  parseConsentCookieValue,
} from "@/tracking/consent-types";
import type { TenantPrivacySettings } from "@/tenant/types";

export type { ConsentState };

// ── Cookie parsing ────────────────────────────────────────────────────────────

/**
 * Extract the raw value of a named cookie from a Cookie header string.
 *
 * @param cookieHeader  Raw value of the "Cookie:" header.
 * @param name          Cookie name to look up.
 * @returns             Raw URL-encoded cookie value, or null if absent.
 */
function extractCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

// ── Server consent reader ─────────────────────────────────────────────────────

/**
 * Parse consent state from a raw HTTP Cookie header string.
 *
 * Returns DEFAULT_CONSENT (all false) when the cookie is absent.
 * Suitable for use in Next.js API routes (`request.headers.get("cookie")`).
 */
export function readConsentFromCookieHeader(
  cookieHeader: string | null,
): ConsentState {
  const raw = extractCookieValue(cookieHeader, CONSENT_COOKIE_NAME);
  return parseConsentCookieValue(raw);
}

// ── Effective consent computation ─────────────────────────────────────────────

/**
 * Compute the effective consent state by combining user consent with
 * tenant-level privacy policy.
 *
 * Formula: finalAllowed(cat) = tenantPolicyAllows(cat) && userConsentGiven(cat)
 *
 * @param userConsent    Parsed from the mc_consent cookie.
 * @param tenantPrivacy  From TenantSettings.privacy (optional).
 * @returns              Effective ConsentState with tenant restrictions applied.
 */
export function computeEffectiveConsent(
  userConsent:    ConsentState,
  tenantPrivacy?: TenantPrivacySettings | null,
): ConsentState {
  if (!tenantPrivacy) return userConsent;

  return {
    hasResponded:    userConsent.hasResponded,
    analytics:       (tenantPrivacy.allowAnalytics       !== false) && userConsent.analytics,
    personalization: (tenantPrivacy.allowPersonalization !== false) && userConsent.personalization,
    enrichment:      (tenantPrivacy.allowEnrichment      !== false) && userConsent.enrichment,
  };
}

/**
 * Convenience: read AND apply tenant policy in one call.
 *
 * @param cookieHeader   Raw HTTP Cookie header.
 * @param tenantPrivacy  Optional tenant privacy settings.
 */
export function resolveConsent(
  cookieHeader:   string | null,
  tenantPrivacy?: TenantPrivacySettings | null,
): ConsentState {
  const user = readConsentFromCookieHeader(cookieHeader);
  return computeEffectiveConsent(user, tenantPrivacy);
}

// ── Snippet consent payload ───────────────────────────────────────────────────

/** The `consent` field the snippet sends to /api/snippet/decide. */
export type SnippetConsentInput =
  | boolean
  | { analytics?: boolean; personalization?: boolean; enrichment?: boolean; hasResponded?: boolean }
  | null
  | undefined;

/**
 * Turn the snippet's forwarded consent into a ConsentState, before the tenant
 * ceiling is applied.
 *
 *   - object   -> the three categories, coerced to booleans.
 *   - boolean  -> legacy payload: true = full, false = deny.
 *   - null     -> the host sent NO signal: fall back to the tenant's
 *                 consentSource default ("always" -> grant, else deny).
 *   - undefined-> a pre-consent snippet that omits the field entirely: treated as
 *                 granted for backward compatibility (those hosts gate loading on
 *                 their own consent banner).
 *
 * Callers apply computeEffectiveConsent() afterwards to enforce the tenant ceiling.
 */
export function consentFromSnippet(
  input: SnippetConsentInput,
  consentSource: "auto" | "always" | undefined,
): ConsentState {
  if (input === true) return FULL_CONSENT;
  if (input === false) return { ...DEFAULT_CONSENT, hasResponded: true };
  if (input && typeof input === "object") {
    return {
      hasResponded:    input.hasResponded === true,
      analytics:       input.analytics === true,
      personalization: input.personalization === true,
      enrichment:      input.enrichment === true,
    };
  }
  if (input === null) {
    // Host provided no signal: apply the tenant default.
    return consentSource === "always" ? FULL_CONSENT : DEFAULT_CONSENT;
  }
  // Field omitted entirely (legacy snippet): backward-compatible grant.
  return FULL_CONSENT;
}

// ── Guard helpers used in API routes ─────────────────────────────────────────

/**
 * Returns true only when the effective consent allows the given category.
 * Shorthand to avoid repetitive property access in route handlers.
 */
export function isConsentGranted(
  consent: ConsentState,
  category: keyof Omit<ConsentState, "hasResponded">,
): boolean {
  return consent[category] === true;
}
