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
import type { HeroBannerMedia, HeroBannerVideoUpload } from "@/cms/types";
import { Text } from "@/components/primitives/Text";

export interface HeroCarouselSlide {
  heading?:    string;
  subheading?: string;
  /** Image (asset/URL) or video (upload/YouTube/Vimeo) — same union as the hero. */
  media?:      HeroBannerMedia;
  /** @deprecated legacy image-only field; superseded by `media`. */
  mediaUrl?:   string;
  /** @deprecated legacy image-only field; superseded by `media`. */
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
          // Match HeroBlock's headline exactly: display variant (responsive size +
          // heading tracking/transform profile) + the tenant hero-title tokens, so
          // carousel typography inherits the active design preset like every other
          // hero. Previously this used a hard-coded clamp()/weight/font and ignored
          // the design tokens — hence the mismatched size, colour, and font.
          <Text
            variant="display"
            align="center"
            balance
            className="whitespace-pre-line"
            style={{
              color:      "var(--hero-title-color)",
              fontFamily: "var(--block-heading-font-family, var(--font-heading))",
              fontWeight: "var(--block-heading-font-weight, var(--font-heading-weight))",
            }}
          >
            {slide.heading}
          </Text>
        )}
        {slide.subheading && (
          <Text
            variant="body"
            align="center"
            className="text-lg"
            style={{ color: "var(--hero-subtitle-color)", maxWidth: 680 }}
          >
            {slide.subheading}
          </Text>
        )}
        <SlideMedia slide={slide} eager={index === 0} />
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

/**
 * Renders a slide's media — image (asset/URL), uploaded video, or a YouTube /
 * Vimeo embed. Falls back to the deprecated `mediaUrl` image field for legacy
 * slides. Sizing is contained (centred, max ~680px) to fit the carousel layout.
 */
function SlideMedia({ slide, eager }: { slide: HeroCarouselSlide; eager: boolean }) {
  const media: HeroBannerMedia | undefined =
    slide.media ??
    (slide.mediaUrl ? { kind: "image", url: slide.mediaUrl, alt: slide.mediaAlt ?? "" } : undefined);

  if (!media) return null;

  const boxStyle: CSSProperties = { width: "min(680px, 80%)", marginTop: 8 };

  // ── Image ────────────────────────────────────────────────────────────────
  if (media.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt={media.alt ?? ""}
        loading={eager ? "eager" : "lazy"}
        style={{ ...boxStyle, maxHeight: 360, objectFit: "contain" }}
      />
    );
  }

  const { video } = media;

  // ── Uploaded / self-hosted video ─────────────────────────────────────────
  if (video.source === "upload") {
    return <UploadVideo video={video} boxStyle={boxStyle} />;
  }

  // ── YouTube / Vimeo embeds (16:9) ────────────────────────────────────────
  const frameStyle: CSSProperties = { ...boxStyle, position: "relative", aspectRatio: "16 / 9" };
  const innerStyle: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 };

  if (video.source === "youtube") {
    const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
    if (video.autoplay) { params.set("autoplay", "1"); params.set("mute", "1"); }
    if (video.loop)     { params.set("loop", "1"); params.set("playlist", video.videoId); }
    return (
      <div style={frameStyle}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={innerStyle}
        />
      </div>
    );
  }

  // vimeo
  const params = new URLSearchParams({ dnt: "1" });
  if (video.autoplay) { params.set("autoplay", "1"); params.set("muted", "1"); }
  if (video.loop)     { params.set("loop", "1"); }
  return (
    <div style={frameStyle}>
      <iframe
        src={`https://player.vimeo.com/video/${video.videoId}?${params}`}
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        style={innerStyle}
      />
    </div>
  );
}

/**
 * Uploaded-video slide media.
 *
 * Desktop autoplay reliability: React assigns `muted` unreliably (it's a DOM
 * property, not an attribute, and SSR markup can omit it), so the browser's
 * autoplay policy may see an "unmuted" video and block playback. We therefore
 * force `el.muted = true` and call `play()` from an effect once mounted — the
 * robust cross-browser pattern for muted hero-video autoplay.
 */
function UploadVideo({ video, boxStyle }: { video: HeroBannerVideoUpload; boxStyle: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  const autoplay = video.autoplay ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplay) return;
    el.muted = true; // required for autoplay; set the property explicitly
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* autoplay blocked — leave paused */ });
  }, [autoplay]);

  return (
    <video
      ref={ref}
      src={video.url}
      poster={video.poster}
      muted={video.muted ?? autoplay}
      autoPlay={autoplay}
      loop={video.loop ?? false}
      controls={video.controls ?? false}
      playsInline
      style={{ ...boxStyle, maxHeight: 380, objectFit: "contain" }}
    />
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
