"use client";

/**
 * NotificationBlock
 *
 * Adaptive notification overlay. Renders in one of five positions and honors a
 * frequency cap so it does not reappear on every load.
 *
 * ─── Severity ────────────────────────────────────────────────────────────────
 *
 *   info | success | warning | promo — colour scheme only.
 *
 * ─── Position ────────────────────────────────────────────────────────────────
 *
 *   top / bottom  — fixed full-width banner
 *   left / right  — floating corner toast   (bottom-right = legacy alias for right)
 *   center        — centered modal with a backdrop, ESC to close, and a focus-trap
 *
 * autoDismissMs is honored for banners/toasts only, never for the modal.
 *
 * ─── Content ─────────────────────────────────────────────────────────────────
 *
 *   message  the title, always shown
 *   text     one line under it that says what the notification is about. The
 *            toast and the modal show it. A banner is one line and shows it
 *            after the message from sm up.
 *
 * In a toast the media stands beside the text and the button stands under the
 * text, in the same column. So the three read as one message.
 *
 * ─── Hooks for a brand layer (app/brand/*.css) ───────────────────────────────
 *
 *   data-part="notification"  with data-severity and data-position
 *   data-part="notification-cta" and data-part="notification-dismiss"
 *
 * The severity colours below are fixed. A brand layer can use the hooks to
 * give a notification the colours of the site's own theme.
 *
 * ─── Frequency ───────────────────────────────────────────────────────────────
 *
 *   always | once_per_session | once_per_period (+ ttl / ttlUnit). See
 *   lib/notifications/frequency-cap.ts. Capping is keyed by the notification id,
 *   so dismissing one never suppresses another.
 *
 * This is a CLIENT component: it reads/writes functional storage for capping and
 * manages dismiss + modal focus via hooks.
 */

import { useEffect, useRef, useState } from "react";
import type { NotificationPosition } from "@/cms/types";
import type { BlockMedia } from "@/lib/media/block-media";
import { isRenderableMedia } from "@/lib/media/block-media";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { useSiteLocale } from "@/components/site/SiteLocale";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";
import { toastBottom } from "@/lib/layout/floating-stack";
import {
  isNotificationSuppressed,
  recordNotificationDismissal,
  ttlToMs,
  type NotificationFrequency,
  type NotificationTtlUnit,
} from "@/lib/notifications/frequency-cap";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotificationBlockProps {
  /** Stable id used as the frequency-cap key (the notification's variant key). */
  id?: string;
  message: string;
  /** A line of explanation under the message. */
  text?: string;
  severity?: "info" | "success" | "warning" | "promo";
  ctaLabel?: string;
  ctaHref?: string;
  /** Anchor position. Defaults to "top". */
  position?: NotificationPosition;
  /** Whether the visitor can dismiss it. Defaults to true (always true for modal). */
  dismissible?: boolean;
  /** Auto-dismiss delay in ms. Banners/toasts only; ignored for the modal. */
  autoDismissMs?: number;
  /** Frequency cap. Defaults to "always". */
  frequency?: NotificationFrequency;
  ttl?: number;
  ttlUnit?: NotificationTtlUnit;
  /** Optional campaign id / version folded into the cap key so a change resets it. */
  campaignId?: string;
  /** Optional media (image or video) shown beside the message. Absent = text-only. */
  media?: BlockMedia;
  /** Which side the media sits on. Defaults to "left". Ignored when there is no media. */
  mediaSide?: "left" | "right";
  /**
   * Admin preview mode (default false). When true the notification renders
   * in-flow inside its bounded parent instead of pinned to the viewport:
   * `position: fixed` becomes `absolute`, the frequency cap is bypassed so it is
   * always shown, auto-dismiss is disabled, and dismissing does not write to
   * storage. Has no effect on the live site (callers never set it there).
   */
  preview?: boolean;
}

// ── Severity styles ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<NonNullable<NotificationBlockProps["severity"]>, { wrapper: string; cta: string; dismiss: string }> = {
  info:    { wrapper: "bg-blue-600 text-white",    cta: "bg-white/20 hover:bg-white/30 text-white border border-white/30", dismiss: "text-white/70 hover:text-white" },
  success: { wrapper: "bg-emerald-600 text-white", cta: "bg-white/20 hover:bg-white/30 text-white border border-white/30", dismiss: "text-white/70 hover:text-white" },
  warning: { wrapper: "bg-amber-500 text-white",   cta: "bg-white/20 hover:bg-white/30 text-white border border-white/30", dismiss: "text-white/70 hover:text-white" },
  promo:   { wrapper: "bg-indigo-700 text-white",  cta: "bg-white/20 hover:bg-white/30 text-white border border-white/30", dismiss: "text-white/70 hover:text-white" },
};

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationBlock({
  id = "",
  message,
  text,
  severity      = "info",
  ctaLabel,
  ctaHref,
  position      = "top",
  dismissible   = true,
  autoDismissMs = 0,
  frequency     = "always",
  ttl,
  ttlUnit,
  campaignId    = "",
  media,
  mediaSide     = "left",
  preview       = false,
}: NotificationBlockProps) {
  const texts = BLOCK_TEXTS[useSiteLocale()];

  // Normalise the legacy alias.
  const pos = position === "bottom-right" ? "right" : position;
  const isModal = pos === "center";

  // Anchoring: pinned to the viewport on the live site, contained within the
  // bounded parent in admin preview (so the overlay is visible in the iframe).
  const anchor = preview ? "absolute" : "fixed";

  // Start hidden; reveal on mount only when not suppressed. This avoids a flash
  // of a capped notification (storage is client-only) and SSR renders nothing.
  // In preview mode start visible and bypass the cap entirely.
  const [visible, setVisible] = useState(preview);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview) { setVisible(true); return; }
    if (!isNotificationSuppressed(id, frequency, ttlToMs(ttl, ttlUnit), campaignId)) {
      setVisible(true);
    }
  }, [preview, id, frequency, ttl, ttlUnit, campaignId]);

  const dismiss = () => {
    // Never persist a dismissal from the admin preview — it must not suppress
    // the real notification for the visitor.
    if (!preview) recordNotificationDismissal(id, frequency, campaignId);
    setVisible(false);
  };

  // Auto-dismiss — banners/toasts only. Disabled in preview so the block stays
  // on screen for inspection.
  useEffect(() => {
    if (!visible || isModal || preview || !autoDismissMs || autoDismissMs <= 0) return;
    const t = setTimeout(() => setVisible(false), autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, isModal, preview, autoDismissMs]);

  // Modal a11y: ESC to close + a simple focus-trap within the dialog.
  useEffect(() => {
    if (!visible || !isModal) return;
    const el = dialogRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
      if (e.key !== "Tab" || !el) return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isModal]);

  if (!visible) return null;

  const styles = SEVERITY_STYLES[severity];
  const cta = ctaLabel && ctaHref ? (
    <a href={ctaHref} data-part="notification-cta" className={`flex-shrink-0 rounded px-3 py-1 text-xs font-semibold transition-colors duration-150 ${styles.cta}`}>
      {ctaLabel}
    </a>
  ) : null;
  const closeBtn = (dismissible || isModal) ? (
    <button type="button" data-part="notification-dismiss" aria-label={texts.closeNotification} onClick={dismiss}
      className={`flex-shrink-0 rounded p-1 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white/50 ${styles.dismiss}`}>
      <CloseIcon />
    </button>
  ) : null;

  // Media beside the message. When there is no renderable media every branch below
  // falls back to its original text-only markup (no layout change, no regression).
  // The media column is sized per position; `mediaSide` places it left/right.
  const hasMedia  = isRenderableMedia(media);
  const sideRight = mediaSide === "right";
  const mediaCol = (widthClass: string) =>
    hasMedia && media ? (
      <div className={`shrink-0 self-center ${widthClass}`}>
        <BlockMediaView media={media} className="rounded-lg" />
      </div>
    ) : null;

  const body = (
    <>
      <p className="font-semibold leading-snug">{message}</p>
      {text && <p className="font-normal leading-snug opacity-90">{text}</p>}
    </>
  );
  const hooks = { "data-part": "notification", "data-severity": severity, "data-position": pos };

  // ── Center modal ─────────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className={`${anchor} inset-0 z-[9999] flex items-center justify-center p-4`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={dismiss} aria-hidden="true" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={message}
          tabIndex={-1}
          {...hooks}
          className={`relative z-10 flex max-w-md flex-col gap-3 rounded-2xl px-6 py-5 shadow-2xl outline-none ${styles.wrapper}`}
        >
          {hasMedia ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {!sideRight && mediaCol("w-full sm:w-44")}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-1 flex-col gap-1 text-sm">{body}</div>
                  {closeBtn}
                </div>
                {cta && <div className="self-start">{cta}</div>}
              </div>
              {sideRight && mediaCol("w-full sm:w-44")}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex flex-1 flex-col gap-1 text-sm">{body}</div>
                {closeBtn}
              </div>
              {cta && <div className="self-start">{cta}</div>}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Full-width banner (top / bottom) ─────────────────────────────────────────
  if (pos === "top" || pos === "bottom") {
    const edge = pos === "top" ? "top-0" : "bottom-0";
    if (hasMedia) {
      return (
        <div role="alert" aria-live="polite" {...hooks}
          className={`${anchor} left-0 right-0 ${edge} z-[9999] flex items-center gap-4 px-4 py-2 text-sm font-medium shadow-md ${styles.wrapper}`}>
          {!sideRight && mediaCol("w-24")}
          <span className="flex-1 text-center leading-snug">{message}{text && <span className="hidden font-normal opacity-90 sm:inline"> {text}</span>}</span>
          {cta}
          {sideRight && mediaCol("w-24")}
          {closeBtn}
        </div>
      );
    }
    return (
      <div role="alert" aria-live="polite" {...hooks}
        className={`${anchor} left-0 right-0 ${edge} z-[9999] flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-medium shadow-md ${styles.wrapper}`}>
        <span className="text-center leading-snug">{message}{text && <span className="hidden font-normal opacity-90 sm:inline"> {text}</span>}</span>
        {cta}
        {closeBtn && <span className="ml-auto">{closeBtn}</span>}
      </div>
    );
  }

  // ── Corner toast (left / right) ──────────────────────────────────────────────
  //
  // One row: the media, then a column with the message, the text and the
  // button, then the close button. Until 25 Nov 2026 the button stood under the
  // whole row, at the left edge under the media, and read as a loose part.
  const corner = pos === "left" ? "left-5" : "right-5";
  return (
    <div role="alert" aria-live="polite" {...hooks}
      // The toast sits above the row of small launchers in the bottom corners
      // (cookie settings, scenario console) instead of on top of them. The
      // offset is 0 unless something claims that row; see lib/layout/floating-stack.ts.
      style={{ bottom: toastBottom(pos === "left" ? "left" : "right") }}
      className={`${anchor} ${corner} z-[9999] flex max-w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-xl p-4 shadow-xl text-sm ${styles.wrapper}`}>
      {!sideRight && mediaCol("w-20")}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {body}
        {cta && <div className="mt-2 self-start">{cta}</div>}
      </div>
      {sideRight && mediaCol("w-20")}
      {closeBtn}
    </div>
  );
}
