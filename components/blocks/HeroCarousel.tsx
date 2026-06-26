"use client";

/**
 * HeroCarousel
 *
 * A rotating hero with multiple slides — heading + subheading + optional product
 * image on the brand gradient — with autoplay, prev/next arrows and dot
 * indicators. Drives the `hero_carousel` layout variant.
 *
 * Client component: autoplay + navigation need state and effects. Honours
 * `prefers-reduced-motion` (no autoplay) and pauses autoplay on hover/focus.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --hero-bg          Section background (gradient or solid)
 *   --hero-bg-text     Heading/sub colour on the hero (falls back to --text-inverse)
 *   --btn-bg           CTA background
 *   --primary-text     CTA text colour
 *   --card-radius      CTA rounding
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export interface HeroCarouselSlide {
  heading?:    string;
  subheading?: string;
  mediaUrl?:   string;
  mediaAlt?:   string;
  ctaLabel?:   string;
  ctaUrl?:     string;
}

export interface HeroCarouselProps {
  slides:      HeroCarouselSlide[];
  autoplay?:   boolean;
  /** Autoplay interval in ms (default 6000). */
  intervalMs?: number;
}

export function HeroCarousel({ slides, autoplay = true, intervalMs = 6000 }: HeroCarouselProps) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (!autoplay || paused || count <= 1 || reducedMotion.current) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % count), Math.max(2000, intervalMs));
    return () => clearInterval(id);
  }, [autoplay, paused, count, intervalMs]);

  if (count === 0) return null;
  const slide = slides[index];

  const sectionStyle: CSSProperties = {
    position:   "relative",
    overflow:   "hidden",
    background: "var(--hero-bg, #0b1f6b)",
    color:      "var(--hero-bg-text, var(--text-inverse, #fff))",
    minHeight:  "clamp(420px, 70vh, 760px)",
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Hero"
      style={sectionStyle}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Slide */}
      <div
        key={index}
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          textAlign:      "center",
          gap:            20,
          padding:        "64px 24px",
          minHeight:      "inherit",
          animation:      "mc-hero-fade 0.5s ease",
        }}
      >
        {slide.heading && (
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.05, fontFamily: "var(--font-heading)" }}>
            {slide.heading}
          </h1>
        )}
        {slide.subheading && (
          <p style={{ margin: 0, fontSize: "clamp(1rem, 2vw, 1.35rem)", opacity: 0.92, maxWidth: 680 }}>
            {slide.subheading}
          </p>
        )}
        {slide.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.mediaUrl}
            alt={slide.mediaAlt ?? ""}
            loading={index === 0 ? "eager" : "lazy"}
            style={{ maxWidth: "min(680px, 80%)", maxHeight: 360, objectFit: "contain", marginTop: 8 }}
          />
        )}
        {slide.ctaLabel && slide.ctaUrl && (
          <a
            href={slide.ctaUrl}
            style={{
              marginTop:    8,
              display:      "inline-flex",
              alignItems:   "center",
              gap:          8,
              padding:      "12px 22px",
              borderRadius: "var(--card-radius, 8px)",
              background:   "var(--btn-bg, var(--primary, #1a2b88))",
              color:        "var(--primary-text, #fff)",
              fontWeight:   600,
              textDecoration: "none",
            }}
          >
            {slide.ctaLabel}
          </a>
        )}
      </div>

      {/* Arrows + dots (only when more than one slide) */}
      {count > 1 && (
        <>
          <ArrowButton side="left"  onClick={() => go(index - 1)} />
          <ArrowButton side="right" onClick={() => go(index + 1)} />
          <div
            role="tablist"
            aria-label="Slides"
            style={{ position: "absolute", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                onClick={() => go(i)}
                style={{
                  width: 10, height: 10, padding: 0, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: i === index ? "var(--primary-text, #fff)" : "rgba(255,255,255,0.45)",
                  transition: "background 0.15s",
                }}
              />
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes mc-hero-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </section>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      aria-label={side === "left" ? "Vorige" : "Volgende"}
      onClick={onClick}
      style={{
        position:   "absolute",
        top:        "50%",
        [side]:     12,
        transform:  "translateY(-50%)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "rgba(255,255,255,0.12)",
        color:      "var(--primary-text, #fff)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {side === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}
