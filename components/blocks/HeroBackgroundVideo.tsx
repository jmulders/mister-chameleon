"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Deferred full-coverage background video (self-hosted / uploaded file).
 *
 * A self-hosted hero video used to render as a bare `<video src autoPlay>` with
 * no `preload` — so the browser's default `preload="auto"` pulled the whole file
 * aggressively, and with no poster the hero background stayed EMPTY until enough
 * had buffered. This mirrors <HeroBackgroundEmbed> (the YouTube/Vimeo path) so the
 * upload path behaves the same:
 *
 *   1. Paint something immediately — the poster image if provided, otherwise a
 *      neutral placeholder background — so the hero is never blank before playback.
 *   2. Mount the real <video> only after the browser is idle AND the hero is in
 *      view, with `preload="metadata"` so it never competes with first paint.
 *
 * Muted autoplay still kicks in a beat later. The layer is decorative
 * (aria-hidden, pointer-events: none).
 */
export function HeroBackgroundVideo({
  url,
  poster,
  objectPosition,
  muted    = true,
  autoplay = true,
  loop     = true,
  controls = false,
}: {
  url:             string;
  poster?:         string;
  /** CSS object-position for the cover crop (framing), applied to poster + video. */
  objectPosition?: string;
  muted?:          boolean;
  autoplay?:       boolean;
  loop?:           boolean;
  controls?:       boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Schedule work for an idle moment so it lands after first paint. Fall back
    // to a short timeout where requestIdleCallback is unavailable (Safari).
    const schedule = (cb: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(cb)
        : window.setTimeout(cb, 300);

    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      schedule(() => setMounted(true));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          schedule(() => setMounted(true));
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Once the <video> is mounted, force muted imperatively and kick off playback.
  // React's `muted` JSX prop does NOT reliably set the DOM `.muted` property, so
  // mobile browsers can see the element as un-muted and block autoplay. Setting
  // `.muted = true` (+ the attribute) before calling play() guarantees the
  // muted-autoplay policy is satisfied. A background video is always silent.
  // play() may still be rejected (e.g. iOS Low Power Mode) — the poster stays.
  useEffect(() => {
    if (!mounted) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.setAttribute("muted", "");
    void el.play().catch(() => { /* autoplay denied — poster remains */ });
  }, [mounted]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative bg poster, sizing handled manually
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      ) : (
        // No poster supplied — paint a neutral placeholder so the hero background
        // is never empty while the video mounts / buffers.
        <div className="absolute inset-0 h-full w-full bg-neutral-900" aria-hidden />
      )}
      {mounted && (
        <video
          ref={videoRef}
          src={url}
          poster={poster}
          preload="metadata"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore — React types don't accept undefined for muted
          muted={muted}
          autoPlay={autoplay}
          loop={loop}
          controls={controls}
          playsInline
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      )}
    </div>
  );
}
