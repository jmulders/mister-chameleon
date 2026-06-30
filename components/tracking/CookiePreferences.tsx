"use client";

/**
 * CookiePreferences — an always-available "Cookie settings" launcher + modal.
 *
 * The ConsentBanner only shows until the visitor first responds; this gives a
 * persistent way to re-open and change choices at any time (like Cookiebot's
 * badge). The modal hosts the full CookieDeclaration. Mount once in the layout.
 */

import { useState } from "react";
import { CookieDeclaration } from "./CookieDeclaration";

export function CookiePreferences() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Cookie settings"
        style={{
          position: "fixed", bottom: "16px", left: "16px", zIndex: 9998,
          padding: "8px 12px", borderRadius: "9999px",
          backgroundColor: "#ffffff", border: "1px solid #e5e7eb",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          fontSize: "12px", fontWeight: 500, color: "#374151", cursor: "pointer",
        }}
      >
        Cookie settings
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
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
              backgroundColor: "#ffffff", borderRadius: "12px",
              maxWidth: "820px", width: "100%", margin: "32px auto",
              padding: "24px",
              fontFamily: "var(--font-sans, system-ui, sans-serif)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <strong style={{ fontSize: "16px", color: "#111827" }}>Cookie preferences</strong>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#6b7280", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <CookieDeclaration />
          </div>
        </div>
      )}
    </>
  );
}
