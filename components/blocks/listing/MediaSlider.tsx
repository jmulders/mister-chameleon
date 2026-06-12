"use client";

/**
 * MediaSlider
 *
 * Full-width single-item CSS-snap slider with prev/next arrows and dot indicators.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   slides   SliderMediaItem[]   Content to render in each slide.
 *   heading  string | undefined  Optional section heading above the slider.
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   • Each slide takes the FULL WIDTH of the track (w-full), so exactly one
 *     slide is visible at a time.  This is essential for correct dot/arrow
 *     navigation: every slide has its own reachable CSS snap position.
 *
 *     Background: with "peek" slide widths (e.g. 40vw) multiple slides are
 *     visible simultaneously.  On wider viewports, later slides may exceed
 *     `maxScrollLeft` (scrollWidth − clientWidth) and therefore have no valid
 *     CSS snap position — the browser clamps the scroll, the `atEnd` guard
 *     fires prematurely, and `active` is set to the wrong slide.  Full-width
 *     slides eliminate this entirely.
 *
 *   • Arrows and dots are hidden when only 1 slide is present.
 *   • The PREV arrow is hidden while at the first snap position (`atStart`);
 *     the NEXT arrow is hidden at the last (`atEnd`).  Both remain in the DOM
 *     as `visibility: hidden` so the dot row stays centred.
 *   • Active-slide tracking uses `item.offsetLeft` vs `track.scrollLeft`.
 *     The track has `position: relative` so child `offsetLeft` values are
 *     relative to the track itself (not a distant ancestor).
 *   • Navigation buttons use `onPointerDown + e.preventDefault()` instead of
 *     `onClick`.  This prevents a focused YouTube iframe from consuming the
 *     event: without `preventDefault`, the browser blurs the iframe first and
 *     may swallow the pointer sequence before the button handler fires.
 *   • `scrollend` (where supported) provides accurate finalisation; `scroll`
 *     handles live tracking during the animation.
 *
 * ─── Design tokens ────────────────────────────────────────────────────────────
 *
 *   --primary          Active dot / arrow hover colour
 *   --text / --text-muted
 *   --bg / --bg-subtle
 *   --border
 */

import { useRef, useState, useEffect, useCallback } from "react";
import type { SliderMediaItem } from "@/page-config";
import { Text }       from "@/components/primitives/Text";
import { SliderSlide } from "./SliderSlide";

// ── Arrow icons ───────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MediaSliderProps {
  slides:   SliderMediaItem[];
  heading?: string;
}

export function MediaSlider({ slides, heading }: MediaSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const [active,  setActive]  = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd,   setAtEnd]   = useState(false);

  const count        = slides.length;
  const showControls = count > 1;

  // ── Track active slide + arrow visibility ─────────────────────────────────
  //
  // The "active" slide is the one whose left edge is closest to the track's
  // current scroll position (left-edge proximity).  This is correct for full-
  // width snap-start slides where each slide's left edge IS the snap position.
  //
  // Arrow visibility:
  //   atStart  ↔  scrollLeft ≈ 0       (prev hidden)
  //   atEnd    ↔  scrollLeft ≈ maxLeft  (next hidden)
  //
  // We listen to both "scroll" (live) and "scrollend" (final position, where
  // supported) to handle both in-flight animation and settled state.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !showControls) return;

    const computeActive = () => {
      const scrollLeft = track.scrollLeft;
      const maxLeft    = track.scrollWidth - track.clientWidth;

      setAtStart(scrollLeft <= 2);
      setAtEnd(maxLeft <= 2 || scrollLeft >= maxLeft - 2);

      // Find the item whose left edge is closest to the current scroll position.
      const items = Array.from(track.children) as HTMLElement[];
      let bestIdx  = 0;
      let bestDist = Infinity;
      for (let i = 0; i < items.length; i++) {
        const dist = Math.abs(items[i].offsetLeft - scrollLeft);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      setActive(bestIdx);
    };

    const supportsScrollEnd = "onscrollend" in window;

    track.addEventListener("scroll",    computeActive, { passive: true });
    if (supportsScrollEnd) {
      track.addEventListener("scrollend", computeActive, { passive: true });
    }

    computeActive(); // initialise on mount

    return () => {
      track.removeEventListener("scroll",    computeActive);
      if (supportsScrollEnd) {
        track.removeEventListener("scrollend", computeActive);
      }
    };
  }, [showControls, count]);

  // ── Scroll to a slide by index ────────────────────────────────────────────
  //
  // With full-width slides (w-full), item[i].offsetLeft = i × (slideWidth + gap).
  // Every snap position is within [0, maxScrollLeft], so no clamping is needed.
  const scrollTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const item = track.children[idx] as HTMLElement | undefined;
    if (!item) return;
    track.scrollTo({ left: item.offsetLeft, behavior: "smooth" });
  }, []);

  const prev = () => scrollTo(Math.max(0, active - 1));
  const next = () => scrollTo(Math.min(count - 1, active + 1));

  // ── Arrow button class ────────────────────────────────────────────────────
  //
  // `invisible pointer-events-none` keeps the button in the DOM (preserving the
  // flex layout so the dot row stays centred) while making it non-interactive.
  const arrowClass = (hidden: boolean) =>
    `flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors${
      hidden ? " invisible pointer-events-none" : ""
    }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {heading && (
        <Text variant="h2" style={{
          color:      "var(--text)",
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--font-heading-weight)",
        }}>
          {heading}
        </Text>
      )}

      {/* Slide track ─────────────────────────────────────────────────────────
          `relative`  → makes this the offsetParent for child offsetLeft values.
          `w-full`    → track spans full container width.
          Slides use `w-full` too, so one slide fills the track at any viewport.
          `overflow-hidden` hides the adjacent slides (instead of overflow-x-auto +
          scrollbarWidth:none) — cleaner on all browsers and avoids a scrollbar flash.
          We keep `scroll-smooth` so keyboard / touch scrolling is also smooth. */}
      <div
        ref={trackRef}
        className="relative flex overflow-x-auto snap-x snap-mandatory scroll-smooth w-full"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        aria-label="Mediaslider"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.key ?? i}
            // w-full + flex-shrink-0: exactly one slide per view, no peeking.
            // snap-start: left edge of each slide is a snap point.
            className="w-full flex-shrink-0 snap-start"
          >
            <SliderSlide slide={slide} />
          </div>
        ))}
      </div>

      {/* Controls — only when there are 2+ slides */}
      {showControls && (
        <div className="flex items-center justify-between gap-4">

          {/* Prev arrow — hidden at first slide */}
          <button
            type="button"
            // onPointerDown + preventDefault: prevents a focused YouTube iframe
            // from consuming the event before this handler fires.
            onPointerDown={(e) => { e.preventDefault(); prev(); }}
            aria-label="Vorige slide"
            aria-hidden={atStart}
            className={arrowClass(atStart)}
            style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            <ChevronLeft />
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Ga naar slide ${i + 1}`}
                onPointerDown={(e) => { e.preventDefault(); scrollTo(i); }}
                className="h-2 rounded-full transition-all duration-200"
                style={{
                  width:           i === active ? "1.5rem" : "0.5rem",
                  backgroundColor: i === active ? "var(--primary)" : "var(--border)",
                }}
              />
            ))}
          </div>

          {/* Next arrow — hidden at last slide */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); next(); }}
            aria-label="Volgende slide"
            aria-hidden={atEnd}
            className={arrowClass(atEnd)}
            style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            <ChevronRight />
          </button>

        </div>
      )}
    </div>
  );
}
