"use client";

/**
 * BlockEffectRuntime
 *
 * The versioned client player for declarative block effects. Mounted once per
 * site page. It only plays the scroll-triggered entrance effects: it observes
 * every [data-mc-fx] wrapper and adds `mc-fx-in` when it enters the viewport,
 * which the CSS transitions to the resting state.
 *
 * ─── Versioning ───────────────────────────────────────────────────────────────
 *
 *   SUPPORTED_VERSIONS lists the effect schema versions this runtime can play.
 *   A wrapper authored under an unsupported version is revealed immediately
 *   (never left hidden) so future/older content degrades gracefully.
 *
 * ─── Accessibility / no-JS ────────────────────────────────────────────────────
 *
 *   The initial-hidden CSS is gated on `html.mc-fx-ready`, which a tiny inline
 *   script in the site layout adds before the content paints. Without JS the
 *   class is never added, so content is always visible. prefers-reduced-motion is
 *   handled entirely in CSS (no transform/opacity, no transition) — the runtime
 *   still adds `mc-fx-in`, it just has no visible motion.
 *
 *   Hover effects (mc-fx-hover-lift) are pure CSS and need no runtime.
 */

import { useEffect } from "react";

const SUPPORTED_VERSIONS = new Set(["1"]);

export function BlockEffectRuntime() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-mc-fx]'));
    if (els.length === 0) return;

    // Reveal now for: unsupported version, no scroll trigger, or no IO support.
    const canObserve = "IntersectionObserver" in window;
    const scrollEls: HTMLElement[] = [];
    for (const el of els) {
      const version = el.getAttribute("data-mc-fx-v") ?? "1";
      const triggers = (el.getAttribute("data-mc-fx-trigger") ?? "").split(/\s+/);
      if (!SUPPORTED_VERSIONS.has(version) || !triggers.includes("scroll") || !canObserve) {
        el.classList.add("mc-fx-in");
        continue;
      }
      scrollEls.push(el);
    }
    if (scrollEls.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("mc-fx-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    for (const el of scrollEls) io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}
