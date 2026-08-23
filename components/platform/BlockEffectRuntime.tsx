"use client";

/**
 * BlockEffectRuntime
 *
 * The versioned client player for declarative block effects. Mounted once per
 * site page. It branches per effect using the effect id (data-mc-fx-ids):
 *
 *   entrance   (reveal / fade / slide / zoom) — IntersectionObserver adds
 *              `mc-fx-in` when the block enters the viewport; CSS transitions it.
 *   continuous (parallax / sticky / Ken Burns) — ADVANCED, default-off. Each is
 *              feature-detected before activating and is NEVER activated under
 *              prefers-reduced-motion (CSS is a second line of defence).
 *
 * ─── Versioning ───────────────────────────────────────────────────────────────
 *
 *   SUPPORTED_VERSIONS lists the schema versions this runtime can play; a wrapper
 *   authored under an unsupported version is revealed immediately (never hidden).
 *
 * ─── Accessibility / no-JS ────────────────────────────────────────────────────
 *
 *   Entrance initial-hidden CSS is gated on html.mc-fx-ready (added pre-paint), so
 *   content is always visible without JS. Advanced effects only ever run from
 *   here, so no-JS pages never animate them. Hover lift is pure CSS.
 */

import { useEffect } from "react";
import { effectGroup } from "@/design-system/effects/effect-defs";

const SUPPORTED_VERSIONS = new Set(["1"]);

export function BlockEffectRuntime() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-mc-fx]"));
    if (els.length === 0) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const canObserve = "IntersectionObserver" in window;
    const canRaf = typeof requestAnimationFrame === "function";
    const canSticky = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("position", "sticky");

    const entranceEls: HTMLElement[] = [];
    const parallaxEls: HTMLElement[] = [];

    for (const el of els) {
      const version = el.getAttribute("data-mc-fx-v") ?? "1";
      if (!SUPPORTED_VERSIONS.has(version)) { el.classList.add("mc-fx-in"); continue; }

      const ids = (el.getAttribute("data-mc-fx-ids") ?? "").split(/\s+/).filter(Boolean);
      let hasEntrance = false;
      for (const id of ids) {
        const group = effectGroup(id);
        if (group === "entrance") { hasEntrance = true; continue; }
        // Advanced continuous effects: never under reduced-motion, feature-detected.
        if (group === "continuous" && !reduced) {
          if (id === "sticky") { if (canSticky) el.classList.add("mc-fx-sticky-on"); }
          else if (id === "ken-burns") { el.classList.add("mc-fx-kb-play"); }
          else if (id === "parallax") { if (canRaf) parallaxEls.push(el); }
        }
      }

      if (hasEntrance) {
        if (canObserve) entranceEls.push(el);
        else el.classList.add("mc-fx-in"); // no IO → reveal immediately
      }
    }

    // ── Entrance reveal ──────────────────────────────────────────────────────
    let io: IntersectionObserver | undefined;
    if (entranceEls.length > 0) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) { e.target.classList.add("mc-fx-in"); io!.unobserve(e.target); }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
      );
      for (const el of entranceEls) io.observe(el);
    }

    // ── Parallax (rAF-throttled scroll) ──────────────────────────────────────
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        for (const el of parallaxEls) {
          const rect = el.getBoundingClientRect();
          const speed = parseFloat(getComputedStyle(el).getPropertyValue("--mc-fx-parallax-speed")) || 0.2;
          const center = rect.top + rect.height / 2;
          const delta = (center - vh / 2) * -speed;
          el.style.setProperty("--mc-fx-parallax-y", `${delta.toFixed(1)}px`);
        }
      });
    };
    if (parallaxEls.length > 0) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }

    return () => {
      io?.disconnect();
      if (parallaxEls.length > 0) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return null;
}
