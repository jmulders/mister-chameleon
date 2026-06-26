"use client";

/**
 * HeaderShell
 *
 * Client component that owns the scroll-aware behaviour of the site header.
 * Wraps the header element, tracks the page scroll position, and applies
 * smooth height / shadow transitions so the header is taller at the top
 * of the page and compact after the user scrolls.
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   scroll position ≤ 24px  →  "at top" state
 *     • larger header (py-5 = 20px top+bottom padding → ~72px total)
 *     • no drop shadow
 *
 *   scroll position > 24px  →  "scrolled" state
 *     • compact header (py-2 = 8px top+bottom padding → ~56px total)
 *     • subtle drop shadow to visually lift the header off the content
 *
 *   The transition is 250ms ease-in-out on padding and box-shadow — smooth
 *   and visible without feeling sluggish or jarring.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Header (RSC, async)      — fetches tenant + CMS settings server-side
 *        ↓  passes children (pre-rendered brand link + NavBar)
 *   HeaderShell (this file)  — owns the <header> element + scroll state
 *        ↓  renders children inside a scroll-aware wrapper
 *   NavBar (client)          — dropdown / mobile menu interactivity
 *
 *   Header is a React Server Component.  It cannot directly listen for scroll
 *   events.  By keeping HeaderShell as a thin client wrapper that receives
 *   already-rendered RSC children, the data-fetching stays on the server while
 *   the scroll behaviour lives only where it needs to: the client.
 *
 * ─── Scroll listener ──────────────────────────────────────────────────────────
 *
 *   Uses a passive scroll listener with requestAnimationFrame throttling so
 *   the handler never blocks the main thread during fast scrolls.
 *   The listener is removed on component unmount (cleanup in useEffect return).
 *
 * ─── Performance ──────────────────────────────────────────────────────────────
 *
 *   Only one state value (`scrolled: boolean`) is updated.  React re-renders
 *   only when the boolean flips — not on every scroll event.  Combined with
 *   `passive: true` on the event listener this has zero effect on scroll
 *   performance.
 */

import { useState, useEffect, useRef }  from "react";
import { cn }                           from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HeaderStyle = "light" | "dark" | "transparent";

export interface HeaderShellProps {
  children:     React.ReactNode;
  /**
   * Optional utility bar rendered above the main nav row.
   * Collapses smoothly when the user scrolls down to save vertical space.
   * Pass the pre-rendered <UtilityBar> element from Header.tsx.
   */
  utilityBar?:  React.ReactNode;
  /**
   * Initial header background mode before the user scrolls.
   *   light       — white/light bg, dark text (default)
   *   dark        — dark bg, light text; used by portfolio-showcase over imagery
   *   transparent — no bg initially; floats over the hero; solidifies on scroll
   */
  headerStyle?: HeaderStyle;
  /**
   * When true, suppresses the shell's own `py-5` / `py-2` padding.
   * Use for multi-band layouts (e.g. header_triband) where each band controls
   * its own vertical spacing so the shell's outer padding would be additive.
   */
  noBandPadding?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeaderShell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scroll-aware header wrapper.
 *
 * Renders the outer <header> element, tracks scroll position, and transitions
 * between the "tall" (at-top) and "compact" (scrolled) states via Tailwind
 * utility classes.  All layout / content is provided via `children`.
 */
// Hysteresis thresholds (px). The header collapses once scrolled past
// COLLAPSE_AT and only re-expands after scrolling back above EXPAND_AT. The gap
// between them is a dead-band that stops the collapse/expand from flickering at
// a single boundary.
const COLLAPSE_AT = 80;
const EXPAND_AT = 16;

export function HeaderShell({ children, utilityBar, headerStyle = "light", noBandPadding = false }: HeaderShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Determine the initial scroll position on mount so that server-side
    // rendering and client hydration stay in sync (page may load mid-scroll).
    setScrolled(window.scrollY > COLLAPSE_AT);

    const onScroll = () => {
      // Throttle state updates to one per animation frame — prevents
      // unnecessary re-renders during fast/continuous scrolling.
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        // Hysteresis: collapse only above COLLAPSE_AT, expand only below
        // EXPAND_AT. The dead-band between the two thresholds prevents the
        // header from oscillating (flickering) at a single boundary — when it
        // collapses the layout shifts up slightly, which previously could push
        // the scroll position back across one shared threshold and flip-flop.
        setScrolled((prev) => {
          if (!prev && y > COLLAPSE_AT) return true;
          if (prev && y < EXPAND_AT) return false;
          return prev;
        });
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // ── Background / border / foreground from headerStyle ────────────────────
  //
  // light:       uses CSS tokens as-is (white bg, dark text) — default
  // dark:        dark bg and light text before scrolling; reverts to token on scroll
  // transparent: fully transparent before scrolling so the hero shows through;
  //              solidifies to --header-bg-scrolled on scroll
  //
  // Once scrolled, all three styles converge on --header-bg-scrolled (solid white
  // or brand-tinted) so navigation remains legible over all page content.

  const isNonLight = headerStyle !== "light";

  const bgColor = scrolled
    ? "var(--header-bg-scrolled)"
    : headerStyle === "transparent"
      ? "transparent"
      : headerStyle === "dark"
        ? "var(--bg-inverse,#0f172a)"
        : "var(--header-bg)";

  const fgColor = scrolled
    ? "var(--header-fg)"
    : isNonLight
      ? "var(--text-inverse,#ffffff)"
      : "var(--header-fg)";

  const borderColor = (!scrolled && isNonLight)
    ? "transparent"
    : "var(--header-border)";

  return (
    <header
      style={{
        backgroundColor:   bgColor,
        borderBottomColor: borderColor,
        color:             fgColor,
        // will-change: transform promotes the header to its own GPU compositor
        // layer.  This prevents backdrop-filter repaints from propagating into
        // the surrounding page content during scroll + hover transitions, which
        // was causing visible flickering on macOS.
        willChange: "transform",
      }}
      className={cn(
        // ── Fixed positioning & layering ──────────────────────────────────
        "sticky top-0 z-40 w-full",

        // ── Background blur & border ──────────────────────────────────────
        // backdrop-blur-sm is only applied once the header is scrolled and
        // the bg solidifies.  At the top of the page the background is already
        // solid (or transparent-then-solid), so the blur pass is skipped — this
        // avoids the repaint overhead that caused flickering when hovering while
        // scrolling near the top.
        scrolled ? "backdrop-blur-sm" : "",
        "border-b",

        // ── Padding (controls header height) ─────────────────────────────
        //
        // Single-row layouts (noBandPadding=false, default):
        //   At top of page:  py-5 = 20px top + 20px bottom (~72px total)
        //   After scrolling: py-2 =  8px top +  8px bottom (~56px total)
        //
        // Multi-band layouts (noBandPadding=true, e.g. header_triband):
        //   py-0 — each band manages its own vertical spacing so the shell
        //   must not add extra space before band 1 or after the last band.
        //
        // `padding` is intentionally excluded from the transition list.
        // Animating padding forces a layout recalc on every frame, which —
        // combined with backdrop-filter — was the primary cause of flickering.
        "transition-[box-shadow,background-color,backdrop-filter,border-color,color] duration-250 ease-in-out",
        noBandPadding
          ? scrolled
            ? "shadow-[0_1px_8px_rgba(0,0,0,0.08)]"
            : "shadow-none"
          : scrolled
            ? "py-2 shadow-[0_1px_8px_rgba(0,0,0,0.08)]"
            : "py-6 shadow-none",
      )}
    >
      {/* ── Utility bar — collapses on scroll ─────────────────────────── */}
      {/*
       * overflow-hidden is applied ONLY when the bar is scrolled/collapsing.
       * While visible it must be absent so that any absolutely-positioned
       * child (e.g. the language-switcher dropdown) can paint outside the
       * max-height boundary without being clipped.
       */}
      {utilityBar && (
        <div
          className={cn(
            // relative + z-10 creates a stacking context above the main nav row
            // (children) inside the header's stacking context (backdrop-filter).
            // Without this the main nav — later in DOM order — would paint on top
            // of the utility-bar dropdown and swallow pointer events even though
            // the dropdown appears visually correct.
            "relative z-10",
            "transition-[max-height,opacity] duration-200 ease-in-out",
            scrolled
              ? "max-h-0 opacity-0 pointer-events-none overflow-hidden"
              : "max-h-20 opacity-100",
          )}
        >
          {utilityBar}
        </div>
      )}

      {/* ── Main nav row ──────────────────────────────────────────────── */}
      {children}
    </header>
  );
}
