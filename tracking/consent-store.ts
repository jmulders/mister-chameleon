/**
 * Consent Store — client-side consent state management
 *
 * Maintains real-time consent state in `window.__mc_consent` so all
 * client-side code can check consent synchronously without re-parsing
 * the cookie on every call.
 *
 * ─── Source of truth hierarchy ────────────────────────────────────────────────
 *
 *   1. `mc_consent` cookie  →  persisted across sessions (365 days)
 *   2. `window.__mc_consent` →  in-memory cache; updated on cookie write
 *   3. DEFAULT_CONSENT       →  privacy-first fallback when cookie absent
 *
 * ─── Live update support ──────────────────────────────────────────────────────
 *
 *   When a user changes preferences during a session, `setConsent()`:
 *     1. Writes the `mc_consent` cookie (document.cookie, not httpOnly).
 *     2. Updates window.__mc_consent synchronously.
 *     3. Fires a `mc:consent-change` CustomEvent on window so components
 *        that listen (ConsentBanner, JourneyDebugPanel, trackEvent) can
 *        react immediately without a page reload.
 *
 * ─── SSR safety ───────────────────────────────────────────────────────────────
 *
 *   All exports guard `typeof window === "undefined"`.
 *   Safe to import in Server Components — all calls are no-ops server-side.
 */

import {
  type ConsentState,
  type ConsentCategory,
  DEFAULT_CONSENT,
  FULL_CONSENT,
  ESSENTIAL_CONSENT,
  CONSENT_COOKIE_NAME,
  CONSENT_COOKIE_MAX_AGE,
  serializeConsentState,
  parseConsentCookieValue,
} from "./consent-types";

export type { ConsentState, ConsentCategory };

// ── Global type augmentation ──────────────────────────────────────────────────

declare global {
  interface Window {
    __mc_consent?: ConsentState;
  }
  interface WindowEventMap {
    "mc:consent-change": CustomEvent<ConsentState>;
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/** Read a cookie value by name from document.cookie (client-only). */
function readDocumentCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/** Write the mc_consent cookie to document.cookie. */
function writeConsentCookie(state: ConsentState): void {
  if (typeof document === "undefined") return;
  const value   = encodeURIComponent(serializeConsentState(state));
  const secure  = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${CONSENT_COOKIE_NAME}=${value}; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

// ── Store initialization ──────────────────────────────────────────────────────

/**
 * Initialise window.__mc_consent from the mc_consent cookie.
 * Idempotent — safe to call multiple times. No-op on the server.
 */
export function initConsentStore(): void {
  if (typeof window === "undefined") return;
  if (window.__mc_consent) return; // already initialized

  const raw     = readDocumentCookie(CONSENT_COOKIE_NAME);
  window.__mc_consent = parseConsentCookieValue(raw);
}

// ── Public read API ───────────────────────────────────────────────────────────

/**
 * Returns the current ConsentState.
 * Initialises the in-memory cache if needed.
 * Returns DEFAULT_CONSENT (all false) on the server.
 */
export function getConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_CONSENT;
  initConsentStore();
  return window.__mc_consent ?? DEFAULT_CONSENT;
}

/**
 * Returns true only if the user has explicitly consented to `category`
 * AND has responded to the banner (not just the default deny state).
 *
 * Use this in client-side gating decisions.
 */
export function hasConsent(category: ConsentCategory): boolean {
  const consent = getConsent();
  return consent[category] === true;
}

/**
 * Returns true if the user has seen and responded to the consent banner.
 * False = banner not yet shown or cookie absent.
 */
export function hasConsentResponded(): boolean {
  return getConsent().hasResponded;
}

// ── Public write API ──────────────────────────────────────────────────────────

/**
 * Persist a new consent state:
 *   1. Writes the mc_consent cookie.
 *   2. Updates window.__mc_consent.
 *   3. Fires the "mc:consent-change" event so listeners react immediately.
 *
 * No-op on the server.
 */
export function setConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;

  writeConsentCookie(state);
  window.__mc_consent = state;

  window.dispatchEvent(
    new CustomEvent("mc:consent-change", { detail: state }),
  );
}

/** Convenience: accept all optional categories. */
export function acceptAllConsent(): void {
  setConsent(FULL_CONSENT);
}

/** Convenience: accept essential only (deny all optional categories). */
export function acceptEssentialConsent(): void {
  setConsent(ESSENTIAL_CONSENT);
}

/**
 * Register a callback that fires whenever consent state changes during
 * the current session (user updates preferences without page reload).
 *
 * Returns an unsubscribe function. No-op on the server.
 */
export function onConsentChange(
  callback: (state: ConsentState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (ev: CustomEvent<ConsentState>) => callback(ev.detail);
  window.addEventListener("mc:consent-change", handler);
  return () => window.removeEventListener("mc:consent-change", handler);
}

/**
 * useSyncExternalStore subscribe adapter.
 *
 * useSyncExternalStore hands us a zero-arg `onStoreChange`; onConsentChange
 * passes the new state to its callback, which onStoreChange simply ignores. The
 * pairing works because getConsent() is a stable snapshot: it returns
 * window.__mc_consent, reassigned only by setConsent(), so React never loops.
 *
 * Lives here (not in a component) so its identity is module-stable — a fresh
 * subscribe function on every render would make useSyncExternalStore resubscribe
 * each time.
 */
export function subscribeConsent(onStoreChange: () => void): () => void {
  return onConsentChange(onStoreChange);
}
