"use client";

/**
 * TimelineSlider
 *
 * Interactive history slider used by the `timeline_slider` variant.
 * Renders one item at a time — media on the left, title + body text on the
 * right — with a horizontal navigation bar at the bottom showing all
 * year/date labels and previous/next arrow buttons.
 *
 * Must be a Client Component ("use client") because it uses useState for the
 * active-index cursor.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg            Section background (full bleed)
 *   --primary               Accent colour (progress bar, active year underline)
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

import { useState, useCallback }  from "react";
import { Container }              from "@/components/primitives/Container";
import { Section }                from "@/components/primitives/Section";
import { Text }                   from "@/components/primitives/Text";
import type { TimelineBlockData } from "@/page-config";

interface TimelineSliderProps {
  data:     TimelineBlockData;
  surface?: string;
}

// ── Arrow icons (inline SVG — no external dependency) ─────────────────────────

function ArrowLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "1.25rem", height: "1.25rem" }}
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "1.25rem", height: "1.25rem" }}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Media renderer ─────────────────────────────────────────────────────────────

interface SliderMediaProps {
  mediaType?: "image" | "video_file" | "youtube" | "vimeo";
  mediaUrl?:  string;
  posterUrl?: string;
  autoPlay?:  boolean;
  loop?:      boolean;
  alt?:       string;
}

function SliderMedia({ mediaType, mediaUrl, posterUrl, autoPlay, loop, alt }: SliderMediaProps) {
  if (!mediaType || !mediaUrl) {
    // Placeholder when no media is configured
    return (
      <div
        style={{
          width:           "100%",
          height:          "100%",
          minHeight:       "22rem",
          background:      "rgba(0,0,0,0.15)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          color:           "rgba(255,255,255,0.3)",
          fontSize:        "0.875rem",
        }}
      >
        Geen media
      </div>
    );
  }

  if (mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl}
        alt={alt ?? ""}
        style={{
          width:      "100%",
          height:     "100%",
          objectFit:  "cover",
          display:    "block",
        }}
      />
    );
  }

  if (mediaType === "video_file") {
    return (
      <video
        src={mediaUrl}
        poster={posterUrl}
        autoPlay={autoPlay}
        loop={loop}
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }

  // YouTube or Vimeo embed. Browsers only honour autoplay when the player is
  // muted, and the mute param name differs per platform (YouTube: `mute`,
  // Vimeo: `muted`). YouTube additionally needs `playlist=<id>` (a single-video
  // playlist) to actually loop. Mirrors the proven VideoBlock embed logic.
  const u = new URL(mediaUrl);
  u.searchParams.set("rel", "0");
  if (mediaType === "vimeo") {
    if (autoPlay) { u.searchParams.set("autoplay", "1"); u.searchParams.set("muted", "1"); }
    if (loop) u.searchParams.set("loop", "1");
  } else {
    // youtube
    if (autoPlay) { u.searchParams.set("autoplay", "1"); u.searchParams.set("mute", "1"); }
    if (loop) {
      u.searchParams.set("loop", "1");
      const id = u.pathname.split("/").pop();
      if (id) u.searchParams.set("playlist", id);
    }
  }
  const src = u.toString();

  return (
    <iframe
      // Remount on src change so the embed reloads (and autoplay re-fires) when
      // navigating between slides — a plain src swap on a reused iframe doesn't
      // reliably re-trigger autoplay.
      key={src}
      src={src}
      title={alt ?? "Video"}
      allow="autoplay; fullscreen"
      allowFullScreen
      style={{
        width:   "100%",
        height:  "100%",
        border:  "none",
        display: "block",
      }}
    />
  );
}

// ── Main slider component ─────────────────────────────────────────────────────

export function TimelineSlider({ data, surface }: TimelineSliderProps) {
  const { heading, items } = data;
  const [activeIndex, setActiveIndex] = useState(0);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i > 0 ? i - 1 : items.length - 1));
  }, [items.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i < items.length - 1 ? i + 1 : 0));
  }, [items.length]);

  const active = items[activeIndex];
  if (!active) return null;

  const sectionBg = surface ?? "var(--section-bg, var(--bg))";

  return (
    <Section
      spacing="none"
      style={{ background: sectionBg, overflow: "hidden" }}
    >
      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      {heading && (
        <Container size="lg">
          <div style={{ paddingTop: "3rem", paddingBottom: "1.5rem" }}>
            <Text
              variant="h2"
              balance
              style={{
                fontFamily:  "var(--font-heading)",
                fontWeight:  "var(--font-heading-weight)",
              }}
            >
              {heading}
            </Text>
          </div>
        </Container>
      )}

      {/* ── Main slide area ─────────────────────────────────────────────────── */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight:           "26rem",
          position:            "relative",
        }}
      >
        {/* Left — media */}
        <div
          style={{
            position:   "relative",
            overflow:   "hidden",
            minHeight:  "24rem",
          }}
        >
          {/* Angled clip on the right edge (matching the design's slanted corner) */}
          <div
            style={{
              position:  "absolute",
              inset:     0,
              clipPath:  "polygon(0 0, calc(100% - 2.5rem) 0, 100% 100%, 0 100%)",
              overflow:  "hidden",
            }}
          >
            <SliderMedia
              mediaType={active.mediaType}
              mediaUrl={active.mediaUrl}
              posterUrl={active.posterUrl}
              autoPlay={active.autoPlay}
              loop={active.loop}
              alt={active.title}
            />
          </div>
        </div>

        {/* Right — content */}
        <div
          style={{
            padding:        "3rem 3rem 3rem 4rem",
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            gap:            "1rem",
          }}
        >
          {/* Date / Year — displayed as large italic heading */}
          {active.date && (
            <p
              style={{
                fontFamily:  "var(--font-heading, serif)",
                fontWeight:  "var(--font-heading-weight, 700)",
                fontSize:    "clamp(3rem, 6vw, 5rem)",
                lineHeight:  1,
                fontStyle:   "italic",
                margin:      0,
                color:       "currentColor",
              }}
            >
              {active.date}
            </p>
          )}

          {/* Title (when separate from date) */}
          {active.title && active.title !== active.date && (
            <Text
              variant="h3"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--font-heading-weight)",
                marginTop:  active.date ? "0.25rem" : 0,
              }}
            >
              {active.title}
            </Text>
          )}

          {/* Description */}
          {active.description && (
            <Text variant="body" color="muted" style={{ maxWidth: "42ch" }}>
              {active.description}
            </Text>
          )}
        </div>

        {/* Overflow right-side partial preview ghost (optional, gives depth) */}
      </div>

      {/* ── Bottom navigation bar ────────────────────────────────────────────── */}
      <div
        style={{
          borderTop:       "1px solid var(--card-border, rgba(255,255,255,0.12))",
          paddingTop:      "1rem",
          paddingBottom:   "1.5rem",
        }}
      >
        <Container size="lg">
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            "1rem",
              position:       "relative",
            }}
          >
            {/* Prev button */}
            <button
              onClick={prev}
              aria-label="Vorig item"
              style={{
                flexShrink:      0,
                width:           "2.75rem",
                height:          "2.75rem",
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                border:          "1px solid var(--card-border, currentColor)",
                borderRadius:    "0.25rem",
                background:      "transparent",
                cursor:          "pointer",
                color:           "currentColor",
                opacity:         activeIndex === 0 ? 0.4 : 1,
                transition:      "opacity 0.15s",
              }}
            >
              <ArrowLeft />
            </button>

            {/* Year markers */}
            <div
              style={{
                flex:           1,
                display:        "flex",
                alignItems:     "flex-end",
                gap:            0,
                overflowX:      "auto",
                scrollbarWidth: "none",
              }}
            >
              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                const label    = item.date ?? item.title;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Ga naar ${label}`}
                    aria-current={isActive ? "true" : undefined}
                    style={{
                      flex:            "1 1 0",
                      minWidth:        "3.5rem",
                      padding:         "0 0 0.5rem",
                      border:          "none",
                      background:      "transparent",
                      cursor:          "pointer",
                      textAlign:       "center",
                      color:           isActive ? "currentColor" : "var(--text-muted, currentColor)",
                      fontWeight:      isActive ? 700 : 400,
                      fontSize:        "0.875rem",
                      fontFamily:      "var(--font-heading)",
                      opacity:         isActive ? 1 : 0.55,
                      transition:      "opacity 0.15s, font-weight 0.15s",
                      position:        "relative",
                      paddingBottom:   "0.625rem",
                    }}
                  >
                    {label}
                    {/* Active accent underline */}
                    <span
                      style={{
                        position:   "absolute",
                        bottom:     0,
                        left:       0,
                        right:      0,
                        height:     "0.2rem",
                        background: isActive ? "var(--primary, #e07b39)" : "transparent",
                        transition: "background 0.2s",
                        borderRadius: "2px",
                      }}
                    />
                  </button>
                );
              })}

            </div>

            {/* Progress track — spans the full nav row, inset to clear the arrows.
                Lives directly under the position:relative row so it stays anchored
                here instead of escaping to a higher ancestor (which made it bleed
                over the hero), and is outside the overflow:auto markers div. */}
            <div
              style={{
                position:       "absolute",
                bottom:         "1.5rem",
                left:           "4.5rem",
                right:          "4.5rem",
                height:         "1px",
                background:     "var(--card-border, rgba(255,255,255,0.15))",
                pointerEvents:  "none",
              }}
            />

            {/* Next button */}
            <button
              onClick={next}
              aria-label="Volgend item"
              style={{
                flexShrink:      0,
                width:           "2.75rem",
                height:          "2.75rem",
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                border:          "1px solid var(--card-border, currentColor)",
                borderRadius:    "0.25rem",
                background:      "transparent",
                cursor:          "pointer",
                color:           "currentColor",
                opacity:         activeIndex === items.length - 1 ? 0.4 : 1,
                transition:      "opacity 0.15s",
              }}
            >
              <ArrowRight />
            </button>
          </div>
        </Container>
      </div>
    </Section>
  );
}
