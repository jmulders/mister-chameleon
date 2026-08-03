"use client";

/**
 * useTopBannerInset — how far the demo chrome must drop to clear a top banner.
 *
 * The adaptive NotificationBlock can render a full-width banner pinned to the top
 * of the viewport (position="top"). The demo overlays (role bar + collapsed
 * handle) sit at a higher z-index, so without an offset they overlap that banner
 * — worst on mobile, where the banner wraps to two lines and grows taller.
 *
 * This hook measures the live banner (tagged `data-mc-top-banner`) and returns
 * its height plus a small gap, or 0 when no banner is present. It re-measures on
 * resize and whenever the DOM changes (banner appears, wraps, or is dismissed),
 * so the overlays follow the banner's real height rather than a guessed constant.
 */

import { useEffect, useState } from "react";

export function useTopBannerInset(gap = 8): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    const measure = () => {
      const el = document.querySelector("[data-mc-top-banner]") as HTMLElement | null;
      const h = el ? el.getBoundingClientRect().height : 0;
      setInset(h > 0 ? Math.round(h + gap) : 0);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    measure();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [gap]);

  return inset;
}
