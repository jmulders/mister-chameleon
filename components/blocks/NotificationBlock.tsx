"use client";

/**
 * NotificationBlock
 *
 * Adaptive notification overlay — renders as a fixed top banner or a
 * bottom-right toast depending on `position`.
 *
 * This is a CLIENT component because it manages dismiss state and the
 * optional auto-dismiss timer via React hooks.
 *
 * ─── Severity ────────────────────────────────────────────────────────────────
 *
 *   info     — blue / neutral informational notice
 *   success  — green success or confirmation message
 *   warning  — amber alert or important notice
 *   promo    — brand-coloured promotional offer (uses accent colour)
 *
 * ─── Position ────────────────────────────────────────────────────────────────
 *
 *   top          — fixed full-width banner across the viewport top
 *   bottom-right — floating toast pinned to the bottom-right corner
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <NotificationBlock
 *     message="🎉 Nieuwe functie beschikbaar — bekijk wat er nieuw is!"
 *     severity="promo"
 *     ctaLabel="Meer info"
 *     ctaHref="/features"
 *     position="top"
 *     dismissible={true}
 *     autoDismissMs={8000}
 *   />
 */

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotificationBlockProps {
  /** Main notification message text */
  message: string;
  /** Visual severity / colour scheme */
  severity?: "info" | "success" | "warning" | "promo";
  /** Optional CTA button label */
  ctaLabel?: string;
  /** Optional CTA href */
  ctaHref?: string;
  /** Where the notification is anchored.  Defaults to "top". */
  position?: "top" | "bottom-right";
  /** Whether the visitor can dismiss the notification.  Defaults to true. */
  dismissible?: boolean;
  /** Auto-dismiss delay in milliseconds.  0 or absent = never auto-dismiss. */
  autoDismissMs?: number;
}

// ── Severity styles ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<NonNullable<NotificationBlockProps["severity"]>, {
  wrapper: string;
  cta:     string;
  dismiss: string;
}> = {
  info: {
    wrapper: "bg-blue-600 text-white",
    cta:     "bg-white/20 hover:bg-white/30 text-white border border-white/30",
    dismiss: "text-white/70 hover:text-white",
  },
  success: {
    wrapper: "bg-emerald-600 text-white",
    cta:     "bg-white/20 hover:bg-white/30 text-white border border-white/30",
    dismiss: "text-white/70 hover:text-white",
  },
  warning: {
    wrapper: "bg-amber-500 text-white",
    cta:     "bg-white/20 hover:bg-white/30 text-white border border-white/30",
    dismiss: "text-white/70 hover:text-white",
  },
  promo: {
    wrapper: "bg-indigo-700 text-white",
    cta:     "bg-white/20 hover:bg-white/30 text-white border border-white/30",
    dismiss: "text-white/70 hover:text-white",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationBlock({
  message,
  severity      = "info",
  ctaLabel,
  ctaHref,
  position      = "top",
  dismissible   = true,
  autoDismissMs = 0,
}: NotificationBlockProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss timer
  useEffect(() => {
    if (!autoDismissMs || autoDismissMs <= 0) return;
    const timer = setTimeout(() => setVisible(false), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  if (!visible) return null;

  const styles = SEVERITY_STYLES[severity];

  // ── Top banner ─────────────────────────────────────────────────────────────
  if (position === "top") {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-mc-top-banner=""
        className={`
          fixed top-0 left-0 right-0 z-[9999]
          flex items-center justify-center gap-4 px-4 py-2.5
          text-sm font-medium shadow-md
          ${styles.wrapper}
        `}
      >
        <span className="text-center leading-snug">{message}</span>

        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            className={`
              flex-shrink-0 rounded px-3 py-1 text-xs font-semibold
              transition-colors duration-150
              ${styles.cta}
            `}
          >
            {ctaLabel}
          </a>
        )}

        {dismissible && (
          <button
            type="button"
            aria-label="Sluit melding"
            onClick={() => setVisible(false)}
            className={`
              flex-shrink-0 ml-auto rounded p-1 transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-white/50
              ${styles.dismiss}
            `}
          >
            {/* ✕ */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // ── Bottom-right toast ─────────────────────────────────────────────────────
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        fixed bottom-5 right-5 z-[9999]
        flex max-w-sm flex-col gap-2 rounded-xl px-4 py-3 shadow-xl
        text-sm font-medium
        ${styles.wrapper}
      `}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-snug">{message}</p>

        {dismissible && (
          <button
            type="button"
            aria-label="Sluit melding"
            onClick={() => setVisible(false)}
            className={`
              flex-shrink-0 rounded p-0.5 transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-white/50
              ${styles.dismiss}
            `}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className={`
            self-start rounded px-3 py-1.5 text-xs font-semibold
            transition-colors duration-150
            ${styles.cta}
          `}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
