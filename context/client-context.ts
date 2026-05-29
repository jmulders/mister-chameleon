/**
 * Client Context
 *
 * Lightweight UA parsing (server-side) and cookie helpers for the
 * richer device/browser context layer.
 *
 * ─── Two signal tiers ─────────────────────────────────────────────────────────
 *
 *   Server-derived  — parsed from the User-Agent header on every request.
 *                     Fields: deviceType, osName, osVersion, browserName,
 *                             browserVersion, engineName
 *                     Available immediately on the first request.
 *
 *   Client-derived  — collected via browser APIs unavailable on the server.
 *                     Fields: isTouchDevice, viewportWidth, viewportHeight,
 *                             pixelRatio, preferredColorScheme, preferredLanguage,
 *                             timeZone
 *                     Collected once by ClientContextCollector on first page load,
 *                     sent to POST /api/client-context, and persisted in the
 *                     mc_cc cookie so subsequent server renders have the values.
 *
 * ─── Cookie format ────────────────────────────────────────────────────────────
 *
 *   mc_cc  — URL-encoded compact JSON blob. Compact keys (t, vw, vh, …) are
 *            used to keep the cookie as small as possible (~100–150 bytes).
 *
 * ─── UA parsing ───────────────────────────────────────────────────────────────
 *
 *   Lightweight RegExp patterns with zero external dependencies.
 *   Accuracy is sufficient for segmentation (OS family, browser name, major
 *   version) — not a full ua-parser replacement.
 */

// ── Cookie name ────────────────────────────────────────────────────────────────

/** Cookie name for persisted client-derived browser signals. */
export const CLIENT_CONTEXT_COOKIE = "mc_cc" as const;

/**
 * Max age for the client context cookie.
 * 30 days — aligns with the session cookie (mc_session_id) lifetime.
 */
export const CLIENT_CONTEXT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

/**
 * Cookie name for the visitor's IANA timezone string, set directly by
 * client-side JS (document.cookie) on the first page load.
 *
 * Unlike mc_cc (httpOnly, requires a server round-trip to /api/client-context),
 * mc_tz is a regular cookie written synchronously in the browser during
 * hydration.  This makes the visitor's timezone available to the server on
 * the very next navigation request — before the async POST completes and
 * before mc_cc exists.
 *
 * Value: raw IANA identifier, URL-encoded via encodeURIComponent.
 *        e.g. stored as "Europe%2FAmsterdam", decodes to "Europe/Amsterdam".
 * Max-age: 30 days (matches mc_cc / mc_session_id).
 * NOT httpOnly — intentionally readable and settable by browser JS.
 */
export const TIMEZONE_COOKIE = "mc_tz" as const;

/**
 * Parse the mc_tz cookie value into an IANA timezone string.
 *
 * The cookie value is URL-encoded by the browser (via encodeURIComponent).
 * This helper decodes it and validates the resulting IANA string via
 * Intl.DateTimeFormat — returning null if the string is unrecognised.
 *
 * @param cookieValue - Raw mc_tz value from the Cookie header.
 * @returns Valid IANA timezone string, or null on any error.
 */
export function parseTimezoneCookie(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;

  try {
    const tz = decodeURIComponent(cookieValue).trim().slice(0, 64);
    if (!tz) return null;

    // Validate: Intl.DateTimeFormat throws RangeError for unknown IANA strings.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// ── Extended device type ───────────────────────────────────────────────────────

/**
 * Extended device classification, more granular than the legacy binary
 * DeviceType ("mobile" | "desktop"). Adds "tablet" as a distinct category.
 */
export type ExtendedDeviceType = "mobile" | "tablet" | "desktop";

// ── UA-parsed context ──────────────────────────────────────────────────────────

/**
 * Fields parsed from the User-Agent string on the server.
 * All fields are null when the User-Agent is absent or the pattern does not match.
 */
export interface UAParsedContext {
  /**
   * Extended device class.
   * Adds "tablet" to the existing "mobile" | "desktop" binary.
   * Null when the User-Agent is absent or unrecognised.
   */
  deviceType: ExtendedDeviceType | null;

  /**
   * Operating system family, e.g. "Windows", "macOS", "iOS", "Android", "Linux".
   * Null when unrecognised.
   */
  osName: string | null;

  /**
   * OS version string as reported in the UA, e.g. "10.0", "14.4", "12".
   * Null when not parseable.
   */
  osVersion: string | null;

  /**
   * Browser name, e.g. "Chrome", "Firefox", "Safari", "Edge".
   * Null when unrecognised.
   */
  browserName: string | null;

  /**
   * Browser major version number as a string, e.g. "120", "17".
   * Null when not parseable.
   */
  browserVersion: string | null;

  /**
   * Rendering engine name, e.g. "Blink", "Gecko", "WebKit", "Trident".
   * Null when unrecognised.
   */
  engineName: string | null;
}

// ── Client-derived signals ─────────────────────────────────────────────────────

/**
 * Browser signals that can only be collected client-side.
 * Persisted in the mc_cc cookie after the first page load.
 */
export interface ClientSignals {
  /** True when the device supports touch input (pointer: coarse or touch events). */
  isTouchDevice: boolean | null;

  /** Viewport width in CSS pixels at collection time. */
  viewportWidth: number | null;

  /** Viewport height in CSS pixels at collection time. */
  viewportHeight: number | null;

  /**
   * Device pixel ratio (screen density).
   * 1.0 = standard, 2.0 = Retina/HiDPI, 3.0+ = mobile HiDPI.
   */
  pixelRatio: number | null;

  /**
   * Result of the prefers-color-scheme media query.
   * "no-preference" when the browser does not report a preference.
   */
  preferredColorScheme: "light" | "dark" | "no-preference" | null;

  /**
   * Primary language from navigator.languages[0], e.g. "en-US", "nl".
   * Falls back to navigator.language when languages is empty.
   */
  preferredLanguage: string | null;

  /**
   * IANA timezone identifier from Intl.DateTimeFormat().resolvedOptions().timeZone.
   * e.g. "Europe/Amsterdam", "America/New_York".
   */
  timeZone: string | null;
}

// ── Combined client context ────────────────────────────────────────────────────

/** Full client/device context — UA-parsed fields plus browser-collected signals. */
export type ClientContext = UAParsedContext & ClientSignals;

// ── Null context helper ────────────────────────────────────────────────────────

/**
 * Returns a ClientContext with all fields set to null.
 * Used as a safe default when no UA or cookie data is available.
 */
export function emptyClientContext(): ClientContext {
  return {
    deviceType:          null,
    osName:              null,
    osVersion:           null,
    browserName:         null,
    browserVersion:      null,
    engineName:          null,
    isTouchDevice:       null,
    viewportWidth:       null,
    viewportHeight:      null,
    pixelRatio:          null,
    preferredColorScheme: null,
    preferredLanguage:   null,
    timeZone:            null,
  };
}

// ── UA Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a User-Agent string into structured device, OS, browser, and engine fields.
 *
 * Uses lightweight RegExp patterns with no external dependencies.
 * Suitable for session segmentation — not a full ua-parser replacement.
 *
 * @param userAgent - Raw User-Agent header value, or null.
 * @returns Populated UAParsedContext; all fields null when userAgent is absent.
 */
export function parseUA(userAgent: string | null): UAParsedContext {
  if (!userAgent) {
    return {
      deviceType:     null,
      osName:         null,
      osVersion:      null,
      browserName:    null,
      browserVersion: null,
      engineName:     null,
    };
  }

  return {
    deviceType:     detectExtendedDeviceType(userAgent),
    osName:         detectOsName(userAgent),
    osVersion:      detectOsVersion(userAgent),
    browserName:    detectBrowserName(userAgent),
    browserVersion: detectBrowserVersion(userAgent),
    engineName:     detectEngineName(userAgent),
  };
}

// ── Device type ────────────────────────────────────────────────────────────────

function detectExtendedDeviceType(ua: string): ExtendedDeviceType {
  // Tablets — iPad, or Android without "Mobile" token (Android phones include Mobile)
  if (/iPad/i.test(ua)) return "tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";

  // Mobile phones
  if (/iPhone|iPod|(Android.*Mobile)|Windows Phone|BlackBerry|Mobile/i.test(ua)) {
    return "mobile";
  }

  // Default: desktop (also covers bots/crawlers — the safer rendering assumption)
  return "desktop";
}

// ── OS name ────────────────────────────────────────────────────────────────────

function detectOsName(ua: string): string | null {
  // Windows — check before Linux to avoid false positives
  if (/Windows NT/i.test(ua))        return "Windows";
  // iOS devices — check before macOS (iPhone UA contains "Mac OS X")
  if (/iPhone|iPod/i.test(ua))       return "iOS";
  if (/iPad/i.test(ua))              return "iPadOS";
  // macOS
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  // Android
  if (/Android/i.test(ua))           return "Android";
  // ChromeOS — subset of Linux UAs; check before generic Linux
  if (/CrOS/i.test(ua))              return "ChromeOS";
  // Generic Linux
  if (/Linux/i.test(ua))             return "Linux";
  return null;
}

// ── OS version ─────────────────────────────────────────────────────────────────

function detectOsVersion(ua: string): string | null {
  // Windows: "Windows NT 10.0" → "10.0"
  const winMatch = ua.match(/Windows NT\s*([\d.]+)/i);
  if (winMatch) return winMatch[1];

  // iOS / iPadOS: "OS 17_1_1 like Mac OS X" → "17.1.1"
  const iosMatch = ua.match(/OS\s+([\d_]+)\s+like/i);
  if (iosMatch) return iosMatch[1].replace(/_/g, ".");

  // Android: "Android 14" → "14"
  const androidMatch = ua.match(/Android\s+([\d.]+)/i);
  if (androidMatch) return androidMatch[1];

  // macOS: "Mac OS X 14_3" or "Mac OS X 10.15.7" → "14.3" or "10.15.7"
  const macMatch = ua.match(/Mac OS X\s+([\d_.]+)/i);
  if (macMatch) return macMatch[1].replace(/_/g, ".");

  return null;
}

// ── Browser name ──────────────────────────────────────────────────────────────

function detectBrowserName(ua: string): string | null {
  // Order matters: more specific tokens before more generic ones.

  // Edge (Chromium) — "Edg/" (not "Edge/")
  if (/Edg\//i.test(ua)) return "Edge";

  // Samsung Browser — contains "SamsungBrowser"; also contains "Chrome"
  if (/SamsungBrowser/i.test(ua)) return "Samsung Browser";

  // Opera new — "OPR/"
  if (/OPR\//i.test(ua)) return "Opera";
  // Opera legacy
  if (/Opera\//i.test(ua)) return "Opera";

  // Chrome / Chromium — check before Safari because Chrome UA includes "Safari"
  if (/Chrome\//i.test(ua)) return "Chrome";

  // Firefox
  if (/Firefox\//i.test(ua)) return "Firefox";

  // Safari — only reaches here when no Chrome/Edge token is present
  if (/Safari\//i.test(ua)) return "Safari";

  // Internet Explorer
  if (/Trident\//i.test(ua) || /MSIE/i.test(ua)) return "Internet Explorer";

  return null;
}

// ── Browser version ───────────────────────────────────────────────────────────

function detectBrowserVersion(ua: string): string | null {
  // Edge: "Edg/120.0.0.0" → "120"
  const edgeMatch = ua.match(/Edg\/([0-9]+)/i);
  if (edgeMatch) return edgeMatch[1];

  // Samsung Browser: "SamsungBrowser/24.0" → "24"
  const samsungMatch = ua.match(/SamsungBrowser\/([0-9]+)/i);
  if (samsungMatch) return samsungMatch[1];

  // Opera new: "OPR/106.0.0.0" → "106"
  const operaMatch = ua.match(/OPR\/([0-9]+)/i);
  if (operaMatch) return operaMatch[1];

  // Chrome: "Chrome/120.0.0.0" → "120"
  const chromeMatch = ua.match(/Chrome\/([0-9]+)/i);
  if (chromeMatch) return chromeMatch[1];

  // Firefox: "Firefox/121.0" → "121"
  const ffMatch = ua.match(/Firefox\/([0-9]+)/i);
  if (ffMatch) return ffMatch[1];

  // Safari: "Version/17.2.1" → "17"
  const safariMatch = ua.match(/Version\/([0-9]+)/i);
  if (safariMatch) return safariMatch[1];

  // IE: "MSIE 11.0" or "rv:11.0" (in Trident UA) → "11"
  const ieMatch = ua.match(/(?:MSIE |rv:)([0-9]+)/i);
  if (ieMatch) return ieMatch[1];

  return null;
}

// ── Engine name ───────────────────────────────────────────────────────────────

function detectEngineName(ua: string): string | null {
  // Trident — IE / IE11 compatibility view
  if (/Trident\//i.test(ua)) return "Trident";

  // Blink — Chrome, Edge (Chromium), Opera (new), Samsung
  // Detect before WebKit: Blink UAs include "WebKit/" token
  if (/Chrome\//i.test(ua) || /Edg\//i.test(ua) || /OPR\//i.test(ua)) return "Blink";

  // Gecko — Firefox (and other Gecko-based browsers)
  // "like Gecko" is present in many Blink/WebKit UAs — match only "Gecko/" with a version
  if (/Gecko\/[0-9]/i.test(ua)) return "Gecko";

  // WebKit — Safari and legacy WebKit browsers
  if (/WebKit\//i.test(ua)) return "WebKit";

  return null;
}

// ── Cookie serialization ──────────────────────────────────────────────────────

/**
 * Serialize ClientSignals to a compact JSON string suitable for a cookie value.
 *
 * Uses short keys to minimise cookie header overhead (~100–150 bytes typical).
 * Null fields are omitted entirely from the serialised output.
 *
 * ─── Encoding note ────────────────────────────────────────────────────────────
 *
 *   Returns raw JSON (NOT pre-encoded with encodeURIComponent).
 *
 *   Next.js's `response.cookies.set()` serialises the value via the `cookie`
 *   npm package, which applies `encodeURIComponent` internally before writing
 *   the Set-Cookie header.  Pre-encoding here would cause double-encoding:
 *   the browser stores `%257B%2522...` instead of `%7B%22...`, and the single
 *   `decodeURIComponent` call in `parseClientContextCookie` would leave the
 *   value still URL-encoded — `JSON.parse` would throw and return all nulls.
 *
 *   The server-side reader (`parseCookieField` + `parseClientContextCookie`)
 *   reads the raw encoded value from the Cookie header and applies one
 *   `decodeURIComponent`, which correctly recovers the plain JSON string.
 *
 * @param signals - Browser signals collected by ClientContextCollector.
 * @returns Raw JSON string (encoding delegated to response.cookies.set).
 */
export function serializeClientSignals(signals: ClientSignals): string {
  const compact: Record<string, unknown> = {};

  if (signals.isTouchDevice !== null)
    compact.t = signals.isTouchDevice ? 1 : 0;
  if (signals.viewportWidth !== null)
    compact.vw = signals.viewportWidth;
  if (signals.viewportHeight !== null)
    compact.vh = signals.viewportHeight;
  if (signals.pixelRatio !== null)
    compact.pr = Math.round(signals.pixelRatio * 100) / 100; // 2 dp
  if (signals.preferredColorScheme !== null)
    compact.cs = signals.preferredColorScheme;
  if (signals.preferredLanguage !== null)
    compact.lang = signals.preferredLanguage.slice(0, 32);
  if (signals.timeZone !== null)
    compact.tz = signals.timeZone.slice(0, 64);

  return JSON.stringify(compact);
}

/**
 * Parse the mc_cc cookie value back into ClientSignals.
 *
 * Defensive — returns null for every field on any parse error or missing key.
 *
 * @param cookieValue - Raw mc_cc cookie value from the Cookie header.
 * @returns Populated ClientSignals; fields are null when data is absent.
 */
export function parseClientContextCookie(
  cookieValue: string | null | undefined,
): ClientSignals {
  const empty: ClientSignals = {
    isTouchDevice:       null,
    viewportWidth:       null,
    viewportHeight:      null,
    pixelRatio:          null,
    preferredColorScheme: null,
    preferredLanguage:   null,
    timeZone:            null,
  };

  if (!cookieValue) return empty;

  try {
    const raw = JSON.parse(decodeURIComponent(cookieValue));
    if (typeof raw !== "object" || raw === null) return empty;

    const cs = raw.cs;
    const preferredColorScheme =
      cs === "light" || cs === "dark" || cs === "no-preference" ? cs : null;

    return {
      isTouchDevice:
        typeof raw.t === "number" ? raw.t === 1 : null,
      viewportWidth:
        typeof raw.vw === "number" ? Math.round(raw.vw) : null,
      viewportHeight:
        typeof raw.vh === "number" ? Math.round(raw.vh) : null,
      pixelRatio:
        typeof raw.pr === "number" ? raw.pr : null,
      preferredColorScheme,
      preferredLanguage:
        typeof raw.lang === "string" ? raw.lang.slice(0, 32) : null,
      timeZone:
        typeof raw.tz === "string" ? raw.tz.slice(0, 64) : null,
    };
  } catch {
    return empty;
  }
}
