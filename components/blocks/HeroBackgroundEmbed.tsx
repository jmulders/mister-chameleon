"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Cover-trick sizing for a 16:9 iframe so it fills the hero at any aspect ratio.
 * (Kept identical to the inline version previously in HeroBlock — only the
 * mounting is now deferred.)
 *
 *   • width  must be ≥ container width  AND ≥ container height × (16/9)
 *   • height must be ≥ container height AND ≥ container width  × (9/16)
 *
 * Using vh/vw gives the correct cross-axis reference, guaranteeing full coverage
 * without letterboxing.
 */
const COVER_STYLE: React.CSSProperties = {
  position:      "absolute",
  top:           "50%",
  left:          "50%",
  transform:     "translate(-50%, -50%)",
  width:         "max(100%, calc(100vh * (16 / 9)))",
  height:        "max(100%, calc(100vw * (9 / 16)))",
  pointerEvents: "none",
  zIndex:        0,
};

/**
 * Deferred full-coverage background embed (YouTube / Vimeo).
 *
 * The YouTube / Vimeo player pulls in ~800 KiB of third-party JavaScript.
 * Loading the iframe eagerly blocks first paint and delays LCP. Instead we:
 *
 *   1. Paint a lightweight poster image immediately — this becomes the LCP
 *      element and needs zero JavaScript.
 *   2. Mount the real iframe only after the browser is idle AND the hero is in
 *      view. Muted autoplay still kicks in a beat later, but it's off the
 *      critical rendering path.
 *
 * The component renders nothing interactive (aria-hidden, pointer-events: none)
 * because it is a decorative background layer.
 */
export function HeroBackgroundEmbed({
  src,
  poster,
  allow,
}: {
  src:     string;
  poster?: string;
  allow:   string;
}) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden
    >
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative bg poster, sizing handled manually
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {mounted && (
        <div style={COVER_STYLE}>
          <iframe
            src={src}
            title=""
            allow={allow}
            className="h-full w-full border-0"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
