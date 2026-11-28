"use client";

/**
 * CookiePreferences — the "Cookie settings" launcher + modal.
 *
 * The ConsentBanner only shows until the visitor first responds; this pill is
 * the way to re-open the choices. Once the visitor has chosen it leaves, as
 * long as the page itself links to the cookie page, where the same choices can
 * be changed. A page without that link keeps the pill. See
 * tracking/cookie-launcher.ts. The modal hosts the full CookieDeclaration.
 * Mount once in the layout.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { CookieDeclaration } from "./CookieDeclaration";
import { consentTexts } from "@/tracking/consent-i18n";
import { getConsent, subscribeConsent } from "@/tracking/consent-store";
import type { ConsentState } from "@/tracking/consent-types";
import {
  cookieLauncherShown,
  pageLinksToCookies,
  subscribePageLinks,
} from "@/tracking/cookie-launcher";
import { claimLauncherSide } from "@/lib/layout/floating-stack";

// Server + first-hydration snapshots: "chosen, and the page has its link", so
// the pill is not in the SSR HTML. A visitor who chose earlier then never sees
// it flash on a page load; for anyone else it appears straight after hydration,
// together with the banner. Module constants, so the stores never loop.
const SERVER_CONSENT: ConsentState = {
  hasResponded:    true,
  analytics:       false,
  personalization: false,
  enrichment:      false,
  advertising:     false,
};
function getServerConsent(): ConsentState { return SERVER_CONSENT; }
function getServerPageLink(): boolean { return true; }

export function CookiePreferences({ locale }: { locale?: string } = {}) {
  const t = consentTexts(locale);
  const [open, setOpen] = useState(false);

  const consent = useSyncExternalStore(subscribeConsent, getConsent, getServerConsent);
  const linked  = useSyncExternalStore(subscribePageLinks, pageLinksToCookies, getServerPageLink);
  const shown   = cookieLauncherShown({ responded: consent.hasResponded, pageLinksToCookies: linked });

  // While it is on screen the pill takes the left side of the launcher row, so
  // a corner toast on that side (or any toast on a narrow screen) sits above it.
  useEffect(() => {
    claimLauncherSide("left", shown);
    return () => claimLauncherSide("left", false);
  }, [shown]);

  return (
    <>
      {shown && <button
        onClick={() => setOpen(true)}
        aria-label={t.preferences.launcher}
        style={{
          position: "fixed", bottom: "16px", left: "16px", zIndex: 9998,
          padding: "8px 12px", borderRadius: "9999px",
          backgroundColor: "#ffffff", border: "1px solid #e5e7eb",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          fontSize: "12px", fontWeight: 500, color: "#374151", cursor: "pointer",
        }}
      >
        {t.preferences.launcher}
      </button>}

      {open && (
        <div
          data-consent-ui=""
          role="dialog"
          aria-modal="true"
          aria-label={t.preferences.title}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "24px", overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              // The window takes the theme's card surface, so the declaration
              // inside it (theme text colours) stays readable in every theme.
              backgroundColor: "var(--card-bg, #ffffff)", borderRadius: "12px",
              color: "var(--text, #111827)",
              maxWidth: "820px", width: "100%", margin: "32px auto",
              padding: "24px",
              fontFamily: "var(--font-sans, system-ui, sans-serif)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <strong style={{ fontSize: "16px", color: "var(--text, #111827)" }}>{t.preferences.title}</strong>
              <button
                onClick={() => setOpen(false)}
                aria-label={t.preferences.close}
                style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "var(--text-muted, #6b7280)", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <CookieDeclaration locale={locale} />
          </div>
        </div>
      )}
    </>
  );
}
