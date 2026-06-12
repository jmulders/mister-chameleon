"use client";

/**
 * StatamicPreviewWatcher
 *
 * Polls /api/cms-version every 1.5 s and does a hard navigation when the
 * latest file mtime changes (i.e. the user saved in the Statamic CP).
 *
 * Hard navigation (window.location.href = pathname + ?_t=version) is used
 * instead of router.refresh() because:
 *   - It strips _mc_draft tokens, switching back to the persisted file content.
 *   - It bypasses the Next.js RSC payload cache unconditionally.
 *   - It works reliably across Next.js 15/16 cache-model changes.
 *
 * Detection strategy:
 *   The component only activates when rendered inside an iframe — i.e. when
 *   the Next.js page is embedded in the Statamic CP Live Preview pane.
 *   Regular visitors (no iframe) are completely unaffected.
 *
 * Environment guard:
 *   Only active in NODE_ENV === "development".
 *
 * Pre-save live preview (draft mode):
 *   Handled separately by the Antlers template POSTing current field values
 *   to /api/statamic-draft and reloading the iframe with ?_mc_draft=TOKEN.
 *   This component picks up the SAVED state after the user clicks Save.
 */

import { useEffect } from "react";

const POLL_INTERVAL_MS = 1500;

export function StatamicPreviewWatcher() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    // Only run when the page is inside an iframe (Statamic LP context)
    let isIframe = false;
    try {
      isIframe = window !== window.parent;
    } catch {
      isIframe = true; // SecurityError = cross-origin parent = definitely an iframe
    }
    if (!isIframe) return;

    let baseline: number | null = null;

    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/cms-version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: number };

        if (baseline === null) {
          baseline = version;
        } else if (version !== baseline) {
          baseline = version;
          // Hard-navigate to the clean pathname with a cache-buster so:
          //   1. Next.js re-runs the Server Components with fresh file data.
          //   2. Any _mc_draft token in the URL is dropped (saved file is truth).
          window.location.href =
            window.location.pathname + "?_t=" + version;
        }
      } catch {
        // Ignore transient errors (server restarting, etc.)
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return null;
}
