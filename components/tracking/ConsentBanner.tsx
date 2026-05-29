"use client";

/**
 * ConsentBanner
 *
 * Cookie consent banner rendered at the bottom of every page.
 * Visible only when the visitor has not yet responded to the consent prompt
 * (i.e. the `mc_consent` cookie is absent or has `hasResponded: false`).
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   • On mount: reads consent from the client store (cookie).
 *   • If `hasResponded` is false: renders the banner.
 *   • "Accept all"     → setConsent(FULL_CONSENT)
 *   • "Essential only" → setConsent(ESSENTIAL_CONSENT)
 *   • "Customize"      → expands detail panel to toggle each category.
 *   • Any choice hides the banner immediately (no page reload needed).
 *
 * ─── Live consent changes ─────────────────────────────────────────────────────
 *
 *   Listens to `mc:consent-change` CustomEvent.  If consent changes while the
 *   page is open (e.g. user re-opens settings), the banner dismisses.
 *
 * ─── Tenant customization ─────────────────────────────────────────────────────
 *
 *   Optional `title` and `description` props override the default copy.
 *   Passed from the server layout which reads TenantPrivacySettings.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getConsent,
  setConsent,
  onConsentChange,
  acceptAllConsent,
  acceptEssentialConsent,
} from "@/tracking/consent-store";
import type { ConsentState } from "@/tracking/consent-types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConsentBannerProps {
  /** Override for the banner title. Defaults to platform copy. */
  title?:       string;
  /** Override for the banner body text. Defaults to platform copy. */
  description?: string;
}

// ── Default copy ──────────────────────────────────────────────────────────────

const DEFAULT_TITLE       = "We value your privacy";
const DEFAULT_DESCRIPTION =
  "We use cookies to improve your experience, analyze traffic, and show relevant content. " +
  "You can choose which types of cookies you allow.";

// ── Category descriptions ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id:          "analytics" as const,
    label:       "Analytics",
    description: "Helps us understand how visitors interact with the site (page views, events).",
  },
  {
    id:          "personalization" as const,
    label:       "Personalization",
    description: "Allows us to tailor content and calls-to-action to your interests and behavior.",
  },
  {
    id:          "enrichment" as const,
    label:       "Enrichment",
    description: "Allows us to recognize your company and context to provide more relevant information.",
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsentBanner({ title, description }: ConsentBannerProps) {
  const [visible,    setVisible]    = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [customState, setCustomState] = useState<Omit<ConsentState, "hasResponded">>({
    analytics:       false,
    personalization: false,
    enrichment:      false,
  });

  // Show banner only if user hasn't responded yet.
  useEffect(() => {
    const consent = getConsent();
    if (!consent.hasResponded) {
      setVisible(true);
    }
  }, []);

  // Listen for consent changes from other sources (e.g. preferences re-opened).
  useEffect(() => {
    const unsubscribe = onConsentChange((state) => {
      if (state.hasResponded) setVisible(false);
    });
    return unsubscribe;
  }, []);

  const handleAcceptAll = useCallback(() => {
    acceptAllConsent();
    setVisible(false);
  }, []);

  const handleEssentialOnly = useCallback(() => {
    acceptEssentialConsent();
    setVisible(false);
  }, []);

  const handleSaveCustom = useCallback(() => {
    setConsent({ hasResponded: true, ...customState });
    setVisible(false);
  }, [customState]);

  const toggleCategory = useCallback(
    (id: "analytics" | "personalization" | "enrichment") => {
      setCustomState((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [],
  );

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      style={{
        position:        "fixed",
        bottom:          0,
        left:            0,
        right:           0,
        zIndex:          9999,
        backgroundColor: "#ffffff",
        borderTop:       "1px solid #e5e7eb",
        boxShadow:       "0 -4px 24px rgba(0,0,0,0.10)",
        padding:         "20px 24px",
        fontFamily:      "var(--font-sans, system-ui, sans-serif)",
        fontSize:        "14px",
        lineHeight:      "1.5",
        color:           "#111827",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header row */}
        <div style={{ marginBottom: "8px" }}>
          <strong style={{ fontSize: "15px" }}>
            {title ?? DEFAULT_TITLE}
          </strong>
        </div>

        <p style={{ margin: "0 0 12px", color: "#374151" }}>
          {description ?? DEFAULT_DESCRIPTION}
        </p>

        {/* Expanded customization panel */}
        {expanded && (
          <div
            style={{
              marginBottom:    "14px",
              padding:         "12px 14px",
              backgroundColor: "#f9fafb",
              borderRadius:    "8px",
              border:          "1px solid #e5e7eb",
            }}
          >
            {/* Essential — always on */}
            <label
              style={{
                display:       "flex",
                alignItems:    "flex-start",
                gap:           "10px",
                marginBottom:  "10px",
                cursor:        "default",
                opacity:       0.7,
              }}
            >
              <input
                type="checkbox"
                checked
                disabled
                style={{ marginTop: "3px", flexShrink: 0 }}
              />
              <span>
                <strong>Essential</strong>
                <span style={{ display: "block", color: "#6b7280", fontSize: "13px" }}>
                  Required for the site to function. Cannot be disabled.
                </span>
              </span>
            </label>

            {/* Optional categories */}
            {CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                style={{
                  display:       "flex",
                  alignItems:    "flex-start",
                  gap:           "10px",
                  marginBottom:  "10px",
                  cursor:        "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={customState[cat.id]}
                  onChange={() => toggleCategory(cat.id)}
                  style={{ marginTop: "3px", flexShrink: 0 }}
                />
                <span>
                  <strong>{cat.label}</strong>
                  <span style={{ display: "block", color: "#6b7280", fontSize: "13px" }}>
                    {cat.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display:    "flex",
            flexWrap:   "wrap",
            gap:        "8px",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleAcceptAll}
            style={{
              padding:         "8px 18px",
              backgroundColor: "#111827",
              color:           "#fff",
              border:          "none",
              borderRadius:    "6px",
              fontWeight:      600,
              fontSize:        "14px",
              cursor:          "pointer",
            }}
          >
            Accept all
          </button>

          {expanded ? (
            <button
              onClick={handleSaveCustom}
              style={{
                padding:         "8px 18px",
                backgroundColor: "#2563eb",
                color:           "#fff",
                border:          "none",
                borderRadius:    "6px",
                fontWeight:      600,
                fontSize:        "14px",
                cursor:          "pointer",
              }}
            >
              Save preferences
            </button>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              style={{
                padding:         "8px 18px",
                backgroundColor: "transparent",
                color:           "#374151",
                border:          "1px solid #d1d5db",
                borderRadius:    "6px",
                fontWeight:      500,
                fontSize:        "14px",
                cursor:          "pointer",
              }}
            >
              Customize
            </button>
          )}

          <button
            onClick={handleEssentialOnly}
            style={{
              padding:         "8px 14px",
              backgroundColor: "transparent",
              color:           "#6b7280",
              border:          "none",
              borderRadius:    "6px",
              fontWeight:      400,
              fontSize:        "13px",
              cursor:          "pointer",
              textDecoration:  "underline",
            }}
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
