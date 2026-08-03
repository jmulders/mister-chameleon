"use client";

/**
 * useIsMobile — tiny viewport-width hook for the demo chrome.
 *
 * The demo overlays (top role bar, bottom-left profile panel) use inline styles,
 * so they can't rely on CSS media queries. This hook exposes a boolean that flips
 * when the viewport crosses a breakpoint, letting the components branch their
 * inline styles for phones. SSR-safe: returns false until mounted.
 */

import { useEffect, useState } from "react";

export function useIsMobile(maxWidth = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}
