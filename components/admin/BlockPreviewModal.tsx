"use client";

/**
 * BlockPreviewModal
 *
 * Read-only preview of a single adaptive block — renders the real block in the
 * isolated preview route (same as the edit drawer), inside a light modal. No edit
 * fields. Used from the tenant blocks list so any block row can be viewed
 * regardless of status (tenant variant for customized, platform-default variant
 * for platform blocks).
 *
 * A11y: backdrop, ESC to close, a simple focus-trap, and a close button. Reuses
 * the drawer's device-frame (1280x720 iframe scaled to the column width) so the
 * crop matches what a visitor sees.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdaptiveVariantContent } from "@/cms/types";
import { buildBlockPreviewSrc } from "@/lib/blocks/block-preview-url";

const PREVIEW_VIEWPORT = { width: 1280, height: 720 } as const;

export function BlockPreviewModal({
  tenantId,
  blockKey,
  variant,
  statusLabel,
  onClose,
}: {
  tenantId:    string;
  blockKey:    string;
  variant:     AdaptiveVariantContent;
  statusLabel: string;
  onClose:     () => void;
}) {
  const src = useMemo(() => buildBlockPreviewSrc(tenantId, blockKey, variant), [tenantId, blockKey, variant]);

  const boxRef    = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Scale the 1280-wide iframe down to the box width (same trick as the drawer).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PREVIEW_VIEWPORT.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ESC to close + a simple focus-trap within the dialog.
  useEffect(() => {
    const el = dialogRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const focusables = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${blockKey}`}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">{blockKey}</p>
            <p className="text-[11px] text-neutral-400">Read-only preview · {statusLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-neutral-200 p-4">
          <div
            ref={boxRef}
            className="relative mx-auto w-full max-w-[1280px] overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm"
            style={{ aspectRatio: `${PREVIEW_VIEWPORT.width} / ${PREVIEW_VIEWPORT.height}` }}
          >
            <iframe
              src={src}
              title={`Preview of ${blockKey}`}
              className="absolute left-0 top-0 origin-top-left border-0 bg-white"
              style={{
                width:     PREVIEW_VIEWPORT.width,
                height:    PREVIEW_VIEWPORT.height,
                transform: `scale(${scale})`,
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
