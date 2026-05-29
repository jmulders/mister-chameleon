"use client";

/**
 * PreviewBar
 *
 * A fixed-position banner rendered only when Next.js draft mode is active.
 * It has two responsibilities:
 *
 *   1. Live query controller — connects to /api/sanity-live (SSE), listens
 *      for Sanity mutation events, and triggers router.refresh() so the RSC
 *      tree re-renders with the latest draft content automatically.
 *
 *   2. UX indicator — shows the current preview/live state and provides
 *      an "Exit preview" link.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   This component is ONLY mounted when the server layout detects that
 *   draftMode().isEnabled is true.  For every public (non-preview) visitor
 *   the component is never included in the React tree — zero JS, zero CPU,
 *   zero network overhead.
 *
 * ─── Live update flow ─────────────────────────────────────────────────────────
 *
 *   EventSource → /api/sanity-live
 *     → "connected" event  → state: connected
 *     → "mutation"  event  → debounce 150 ms → router.refresh()
 *        → Next.js re-fetches all RSC data for the current route
 *        → SanityProvider uses cache:"no-store" → fresh draft content
 *        → page updates without full reload ✓
 *
 * ─── Connection resilience ────────────────────────────────────────────────────
 *
 *   If /api/sanity-live returns an error (e.g. preview cookie expired):
 *     - EventSource onerror fires.
 *     - We close the connection and attempt to reconnect after 5 s.
 *     - The banner shows "reconnecting…" during this window.
 *
 * ─── Cleanup ──────────────────────────────────────────────────────────────────
 *
 *   The EventSource and all timers are torn down in the useEffect cleanup
 *   function (runs on component unmount).  No memory leaks.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectionState =
  | "connecting"   // EventSource is opening
  | "connected"    // Received initial "connected" event from SSE
  | "updating"     // Mutation received; router.refresh() in flight
  | "error"        // SSE connection error; will auto-reconnect
  | "closed";      // Intentionally closed (should not occur during normal use)

// ── Labels and visual indicators ─────────────────────────────────────────────

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: "Preview · connecting…",
  connected:  "Preview · live",
  updating:   "Preview · updating…",
  error:      "Preview · reconnecting…",
  closed:     "Preview · disconnected",
};

const STATE_DOT_CLASS: Record<ConnectionState, string> = {
  connecting: "bg-yellow-400 animate-pulse",
  connected:  "bg-green-400",
  updating:   "bg-blue-400 animate-pulse",
  error:      "bg-red-400 animate-pulse",
  closed:     "bg-neutral-400",
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Rendered by `app/(site)/layout.tsx` when `draftMode().isEnabled === true`.
 * Never rendered for public visitors.
 */
export function PreviewBar() {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>("connecting");

  // Stable refs — don't cause re-renders but survive across reconnect cycles.
  const eSourceRef    = useRef<EventSource | null>(null);
  const refreshTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;

    function clearTimers() {
      if (refreshTimer.current)   { clearTimeout(refreshTimer.current);   refreshTimer.current   = null; }
      if (resetTimer.current)     { clearTimeout(resetTimer.current);     resetTimer.current     = null; }
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    }

    function connect() {
      if (!alive) return;
      if (alive) setState("connecting");

      const es = new EventSource("/api/sanity-live");
      eSourceRef.current = es;

      // ── SSE "connected" ─────────────────────────────────────────────────
      es.addEventListener("connected", () => {
        if (alive) setState("connected");
      });

      // ── SSE "mutation" ──────────────────────────────────────────────────
      //
      // Debounce: Sanity may fire several mutation events in quick succession
      // (e.g. auto-save burst).  Wait 150 ms for the burst to settle before
      // refreshing so we only re-render once.
      es.addEventListener("mutation", () => {
        if (!alive) return;
        setState("updating");

        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          if (!alive) return;
          // router.refresh() re-fetches all RSC data for the current route.
          // Since createPreviewCMSProvider() uses cache:"no-store", this
          // always returns the latest draft content from Sanity.
          router.refresh();

          // Show "updating" briefly after the refresh kicks off, then
          // return to "connected".
          if (resetTimer.current) clearTimeout(resetTimer.current);
          resetTimer.current = setTimeout(() => {
            if (alive) setState("connected");
          }, 700);
        }, 150);
      });

      // ── Connection error / retry ─────────────────────────────────────────
      //
      // Browsers automatically retry EventSource connections with back-off, but
      // we want a predictable 5 s gap and a visible "reconnecting" state.
      es.onerror = () => {
        if (!alive) return;
        es.close();
        eSourceRef.current = null;
        setState("error");

        reconnectTimer.current = setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimers();
      eSourceRef.current?.close();
      eSourceRef.current = null;
    };
  }, [router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={STATE_LABEL[state]}
      style={{
        position:            "fixed",
        bottom:              "1.25rem",
        left:                "50%",
        transform:           "translateX(-50%)",
        zIndex:              9999,
        display:             "flex",
        alignItems:          "center",
        gap:                 "0.625rem",
        borderRadius:        "9999px",
        padding:             "0.375rem 1rem",
        boxShadow:           "0 4px 24px rgba(0,0,0,0.35)",
        fontSize:            "0.8125rem",
        fontWeight:          500,
        letterSpacing:       "0.01em",
        fontFamily:          "system-ui, sans-serif",
        // Dark translucent pill — legible on any page background.
        background:          "rgba(15, 23, 42, 0.90)",
        color:               "#f1f5f9",
        backdropFilter:      "blur(10px)",
        WebkitBackdropFilter:"blur(10px)",
        border:              "1px solid rgba(255,255,255,0.10)",
        // Prevent the bar from being selected/highlighted accidentally.
        userSelect:          "none",
        WebkitUserSelect:    "none",
        // Ensure the bar doesn't interfere with pointer events on the page
        // (it only captures events on itself).
        pointerEvents:       "auto",
        // Subtle entrance animation via CSS custom property fallback.
        animation:           "previewBarFadeIn 0.25s ease",
      }}
    >
      {/* ── Status dot ───────────────────────────────────────────────────── */}
      <span
        aria-hidden="true"
        style={{
          display:       "inline-block",
          width:         "0.5rem",
          height:        "0.5rem",
          borderRadius:  "50%",
          flexShrink:    0,
          background:    stateDotColor(state),
          boxShadow:
            state === "connected"
              ? "0 0 0 3px rgba(74, 222, 128, 0.25)"
              : undefined,
          // Pulse animation for transient states.
          animation:
            state === "connecting" || state === "error" || state === "updating"
              ? "previewDotPulse 1s ease-in-out infinite"
              : undefined,
        }}
      />

      {/* ── Label ────────────────────────────────────────────────────────── */}
      <span style={{ whiteSpace: "nowrap" }}>{STATE_LABEL[state]}</span>

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <span aria-hidden="true" style={{ color: "rgba(148,163,184,0.5)", fontWeight: 300 }}>
        |
      </span>

      {/* ── Exit preview ─────────────────────────────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/exit-preview"
        style={{
          color:              "#94a3b8",
          textDecoration:     "underline",
          textUnderlineOffset:"2px",
          whiteSpace:         "nowrap",
          transition:         "color 0.15s",
          // Pointer events already enabled from parent.
        }}
        onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = "#f1f5f9"; }}
        onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = "#94a3b8"; }}
        title="Exit draft preview mode"
      >
        Exit preview
      </a>

      {/* ── Keyframe definitions ─────────────────────────────────────────── */}
      {/*
        Inline keyframes via a <style> tag scoped to this component.
        We avoid Tailwind's animate-* utilities here because this component
        lives outside the normal Tailwind purge boundary.
      */}
      <style>{`
        @keyframes previewBarFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(0.5rem); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes previewDotPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stateDotColor(state: ConnectionState): string {
  switch (state) {
    case "connecting": return "#facc15"; // yellow-400
    case "connected":  return "#4ade80"; // green-400
    case "updating":   return "#60a5fa"; // blue-400
    case "error":      return "#f87171"; // red-400
    case "closed":     return "#94a3b8"; // slate-400
  }
}
