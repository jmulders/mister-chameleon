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
}: NotificationBlockProps) {
  // Normalise the legacy alias.
  const pos = position === "bottom-right" ? "right" : position;
  const isModal = pos === "center";

  // Start hidden; reveal on mount only when not suppressed. This avoids a flash
  // of a capped notification (storage is client-only) and SSR renders nothing.
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNotificationSuppressed(id, frequency, ttlToMs(ttl, ttlUnit), campaignId)) {
      setVisible(true);
    }
  }, [id, frequency, ttl, ttlUnit, campaignId]);

  const dismiss = () => {
    recordNotificationDismissal(id, frequency, campaignId);
    setVisible(false);
  };

  // Auto-dismiss — banners/toasts only.
  useEffect(() => {
    if (!visible || isModal || !autoDismissMs || autoDismissMs <= 0) return;
    const t = setTimeout(() => setVisible(false), autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, isModal, autoDismissMs]);

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
    <a href={ctaHref} className={`flex-shrink-0 rounded px-3 py-1 text-xs font-semibold transition-colors duration-150 ${styles.cta}`}>
      {ctaLabel}
    </a>
  ) : null;
  const closeBtn = (dismissible || isModal) ? (
    <button type="button" aria-label="Sluit melding" onClick={dismiss}
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
      <div className={`shrink-0 ${widthClass}`}>
        <BlockMediaView media={media} className="rounded-lg" />
      </div>
    ) : null;

  // ── Center modal ─────────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={dismiss} aria-hidden="true" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={message}
          tabIndex={-1}
          className={`relative z-10 flex max-w-md flex-col gap-3 rounded-2xl px-6 py-5 shadow-2xl outline-none ${styles.wrapper}`}
        >
          {hasMedia ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {!sideRight && mediaCol("w-full sm:w-44")}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
                  {closeBtn}
                </div>
                {cta && <div className="self-start">{cta}</div>}
              </div>
              {sideRight && mediaCol("w-full sm:w-44")}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
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
        <div role="alert" aria-live="polite"
          className={`fixed left-0 right-0 ${edge} z-[9999] flex items-center gap-4 px-4 py-2 text-sm font-medium shadow-md ${styles.wrapper}`}>
          {!sideRight && mediaCol("w-24")}
          <span className="flex-1 text-center leading-snug">{message}</span>
          {cta}
          {sideRight && mediaCol("w-24")}
          {closeBtn}
        </div>
      );
    }
    return (
      <div role="alert" aria-live="polite"
        className={`fixed left-0 right-0 ${edge} z-[9999] flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-medium shadow-md ${styles.wrapper}`}>
        <span className="text-center leading-snug">{message}</span>
        {cta}
        {closeBtn && <span className="ml-auto">{closeBtn}</span>}
      </div>
    );
  }

  // ── Corner toast (left / right) ──────────────────────────────────────────────
  const corner = pos === "left" ? "left-5" : "right-5";
  return (
    <div role="alert" aria-live="polite"
      className={`fixed bottom-5 ${corner} z-[9999] flex max-w-sm flex-col gap-2 rounded-xl px-4 py-3 shadow-xl text-sm font-medium ${styles.wrapper}`}>
      <div className="flex items-start gap-3">
        {!sideRight && mediaCol("w-20")}
        <p className="flex-1 leading-snug">{message}</p>
        {sideRight && mediaCol("w-20")}
        {closeBtn}
      </div>
      {cta && <div className="self-start">{cta}</div>}
    </div>
  );
}
