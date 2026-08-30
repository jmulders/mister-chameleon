"use client";

/**
 * ClientContextCollector
 *
 * Collects browser-only signals once per session and POSTs them to
 * POST /api/client-context, which persists them in the httpOnly mc_cc cookie.
 * On all subsequent server renders the cookie is available, so rules and AI
 * context have access to: isTouchDevice, viewportWidth, viewportHeight,
 * pixelRatio, preferredColorScheme, preferredLanguage, and timeZone.
 *
 * ─── Firing policy ────────────────────────────────────────────────────────────
 *
 *   Fires once per browser session: after the cookie is set, the component
 *   reads its own value from sessionStorage ("mc_cc_sent") to avoid
 *   re-sending on client-side navigation.  sessionStorage is cleared when the
 *   tab closes, matching the browser-session concept — but the mc_cc cookie
 *   persists for 30 days (matching mc_session_id), so re-sends are harmless
 *   and just refresh a stable value.
 *
 * ─── No layout shift ─────────────────────────────────────────────────────────
 *
 *   Renders nothing.  The POST is fire-and-forget; errors are silently swallowed
 *   so a network failure never affects the page.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Add to the root layout server component once:
 *
 *     import { ClientContextCollector } from "@/components/tracking/ClientContextCollector";
 *
 *     // Inside the <body>:
 *     <ClientContextCollector />
 *
 *   No props required.
 */

import { useEffect } from "react";
import { hasConsent } from "@/tracking/consent-store";

/** sessionStorage flag — prevents re-sending on client-side navigation. */
const SENT_FLAG = "mc_cc_sent";

export function ClientContextCollector(): null {
  useEffect(() => {
    // Consent gate: the client-context signals feed personalization, so only
    // collect them when the visitor granted the "personalization" category
    // (consistent with the other client trackers). No consent → stay null.
    if (!hasConsent("personalization")) return;

    // Skip if already sent in this browser session.
    try {
      if (sessionStorage.getItem(SENT_FLAG)) return;
    } catch {
      // sessionStorage may be unavailable (private mode, storage policy, etc.)
      // Fall through — sending is always safe even if de-duplication is skipped.
    }

    // ── Collect browser signals ──────────────────────────────────────────────

    // Touch detection: prefer pointer media query; fall back to touch events.
    let isTouchDevice: boolean | null = null;
    try {
      if (typeof window.matchMedia === "function") {
        isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      } else if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
        isTouchDevice = true;
      } else {
        isTouchDevice = false;
      }
    } catch {
      isTouchDevice = null;
    }

    // Viewport dimensions.
    const viewportWidth  = window.innerWidth  > 0 ? window.innerWidth  : null;
    const viewportHeight = window.innerHeight > 0 ? window.innerHeight : null;

    // Pixel ratio.
    const pixelRatio =
      typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : null;

    // Preferred colour scheme.
    let preferredColorScheme: "light" | "dark" | "no-preference" | null = null;
    try {
      if (typeof window.matchMedia === "function") {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          preferredColorScheme = "dark";
        } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
          preferredColorScheme = "light";
        } else {
          preferredColorScheme = "no-preference";
        }
      }
    } catch {
      preferredColorScheme = null;
    }

    // Preferred language — first entry in navigator.languages array.
    let preferredLanguage: string | null = null;
    try {
      preferredLanguage =
        (navigator.languages?.[0] ?? navigator.language ?? null) || null;
    } catch {
      preferredLanguage = null;
    }

    // IANA timezone identifier.
    let timeZone: string | null = null;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      timeZone = null;
    }

    // Note: mc_tz (the visitor's timezone cookie) is written separately and
    // UNCONDITIONALLY by <TimezoneCapture> — it is low-sensitivity and available on
    // the very next server render. We still POST timeZone here as part of the fuller
    // mc_cc client-context payload, but we do not duplicate the cookie write.

    // ── POST to server ────────────────────────────────────────────────────────

    void fetch("/api/client-context", {
      method:    "POST",
      headers:   { "Content-Type": "application/json" },
      body:      JSON.stringify({
        isTouchDevice,
        viewportWidth,
        viewportHeight,
        pixelRatio,
        preferredColorScheme,
        preferredLanguage,
        timeZone,
      }),
      // keepalive: true lets the request complete even if the page navigates
      // away immediately after mount (e.g. SPA client-side redirect).
      keepalive: true,
    })
      .then((res) => {
        if (res.ok) {
          try {
            sessionStorage.setItem(SENT_FLAG, "1");
          } catch {
            // Ignore sessionStorage errors.
          }
        }
      })
      .catch(() => {
        // Silently discard all errors.
        // A failure here has zero impact on the user or page rendering.
      });
  }, []); // Empty dependency array — run once on mount.

  return null;
}

export default ClientContextCollector;
