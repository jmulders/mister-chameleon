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
 *
 * ─── Never-blank guarantees ───────────────────────────────────────────────────
 *
 *   Because the mc-fx-ready CSS hides EVERY entrance block until it gets
 *   `mc-fx-in`, a reveal that never happens leaves content permanently blank —
 *   and with tenant-default effects on every block that is the whole page. Three
 *   safeguards prevent that:
 *     1. Blocks already IN the viewport at mount are revealed synchronously (via
 *        getBoundingClientRect), NOT via IntersectionObserver — whose initial
 *        callback does not fire while document.visibilityState === "hidden" (a
 *        background-tab load), which was the blank-homepage root cause.
 *     2. On `visibilitychange` (tab becomes visible) any still-hidden in-view
 *        block is revealed, covering IO notifications dropped while hidden.
 *     3. A hard failsafe timer reveals every remaining block after FAILSAFE_MS,
 *        so nothing can stay hidden regardless of IO / scroll behaviour.
 *   A separate inline failsafe in app/(site)/layout.tsx removes mc-fx-ready if
 *   THIS component never runs at all (hydration failure).
 */

import { useEffect } from "react";
import { effectGroup } from "@/design-system/effects/effect-defs";

const SUPPORTED_VERSIONS = new Set(["1"]);

/** Reveal every remaining entrance block no later than this, so content is never stuck hidden. */
const FAILSAFE_MS = 2000;

/** True when any part of the element is within the viewport (works while the tab is hidden). */
function inViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}

export function BlockEffectRuntime() {
  useEffect(() => {
    // Signal to the inline layout failsafe that the runtime is alive, so it does
    // not strip mc-fx-ready out from under us.
    (window as unknown as { __mcFxAlive?: boolean }).__mcFxAlive = true;
    const clearInline = (window as unknown as { __mcFxClearFailsafe?: () => void }).__mcFxClearFailsafe;
    if (typeof clearInline === "function") clearInline();

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const canObserve = "IntersectionObserver" in window;
    const canRaf = typeof requestAnimationFrame === "function";
    const canSticky = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("position", "sticky");

    // Reveal an entrance block. A stagger wrapper reveals its prepared children
    // instead (their per-child transition-delay produces the stagger); the wrapper
    // is also marked so the failsafe's pending() check sees it as done.
    const reveal = (el: Element) => {
      if (el instanceof HTMLElement && el.dataset.mcFxStagger === "1") {
        el.querySelectorAll<HTMLElement>(":scope > [data-mc-fx-stagger-child]").forEach((c) => c.classList.add("mc-fx-in"));
      }
      el.classList.add("mc-fx-in");
    };
    const entranceEls: HTMLElement[] = [];   // all entrance blocks seen (for the failsafe)
    const parallaxEls: HTMLElement[] = [];
    let io: IntersectionObserver | undefined;
    if (!reduced && canObserve) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) { reveal(e.target); io!.unobserve(e.target); }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
      );
    }

    // ── Scroll-linked effects (rAF-throttled), wired once when the first appears ─
    const scrollFadeEls: HTMLElement[] = [];
    const scrollScaleEls: HTMLElement[] = [];
    let scrollWired = false;
    let rafId = 0;
    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
    // 0 when the element top is at the bottom edge, 1 after it has scrolled up by
    // `range` * viewport — i.e. how far the element has entered the viewport.
    const scrollProgress = (rect: DOMRect, vh: number, range: number) =>
      clamp01((vh - rect.top) / (vh * (range > 0 ? range : 0.6)));
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
        for (const el of scrollFadeEls) {
          const cs = getComputedStyle(el);
          const range = parseFloat(cs.getPropertyValue("--mc-fx-scroll-range")) || 0.6;
          el.style.opacity = scrollProgress(el.getBoundingClientRect(), vh, range).toFixed(3);
        }
        for (const el of scrollScaleEls) {
          const cs = getComputedStyle(el);
          const from = parseFloat(cs.getPropertyValue("--mc-fx-scroll-from")) || 0.85;
          const to   = parseFloat(cs.getPropertyValue("--mc-fx-scroll-to"))   || 1;
          const range = parseFloat(cs.getPropertyValue("--mc-fx-scroll-range")) || 0.6;
          const p = scrollProgress(el.getBoundingClientRect(), vh, range);
          el.style.setProperty("--mc-fx-scroll-scale", (from + (to - from) * p).toFixed(4));
        }
      });
    };
    function scheduleScroll(): void {
      if (scrollWired) { onScroll(); return; }
      scrollWired = true;
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }

    // Prepare a stagger wrapper: give each direct child (up to the max) the chosen
    // base entrance class and an incremental transition-delay, so revealing them
    // together produces a one-by-one reveal. reveal() targets these children.
    function setupStagger(el: HTMLElement): void {
      el.dataset.mcFxStagger = "1";
      const cs = getComputedStyle(el);
      const step = parseFloat(cs.getPropertyValue("--mc-fx-stagger-step")) || 80;
      const max  = parseInt(cs.getPropertyValue("--mc-fx-stagger-max"), 10) || 12;
      const rawBase = cs.getPropertyValue("--mc-fx-stagger-base").trim();
      const base = effectGroup(rawBase) === "entrance" && rawBase !== "stagger" ? rawBase : "reveal";
      const children = Array.from(el.children) as HTMLElement[];
      children.forEach((child, idx) => {
        if (idx >= Math.max(1, max)) return; // beyond the cap: leave visible, no entrance
        child.setAttribute("data-mc-fx-stagger-child", "1");
        child.classList.add("mc-fx", `mc-fx-${base}`);
        if (!reduced) child.style.transitionDelay = `${idx * step}ms`;
      });
    }

    // Process one [data-mc-fx] wrapper. Idempotent via data-mc-fx-seen so the
    // MutationObserver never re-processes a block. Entrance blocks are revealed
    // immediately when in view (NOT via IO, whose first callback never fires while
    // the tab is hidden — the blank-homepage root cause) and observed otherwise.
    function processEl(el: HTMLElement): void {
      if (el.getAttribute("data-mc-fx-seen")) return;
      el.setAttribute("data-mc-fx-seen", "1");

      const version = el.getAttribute("data-mc-fx-v") ?? "1";
      if (!SUPPORTED_VERSIONS.has(version)) { reveal(el); return; }

      const ids = (el.getAttribute("data-mc-fx-ids") ?? "").split(/\s+/).filter(Boolean);
      let hasEntrance = false;
      for (const id of ids) {
        if (id === "stagger") { hasEntrance = true; setupStagger(el); continue; }
        const group = effectGroup(id);
        if (group === "entrance") { hasEntrance = true; continue; }
        if (group === "continuous" && !reduced) {
          if (id === "sticky") { if (canSticky) el.classList.add("mc-fx-sticky-on"); }
          else if (id === "ken-burns") { el.classList.add("mc-fx-kb-play"); }
          else if (id === "parallax") { if (canRaf) { parallaxEls.push(el); scheduleScroll(); } }
          else if (id === "scroll-fade") { if (canRaf) { scrollFadeEls.push(el); scheduleScroll(); } }
          else if (id === "scroll-scale") { if (canRaf) { scrollScaleEls.push(el); scheduleScroll(); } }
        }
      }
      if (!hasEntrance) return;

      if (entranceEls.indexOf(el) < 0) entranceEls.push(el); // no dup on re-process (replay)
      if (reduced || !io) reveal(el);          // reduced-motion / no-IO → show now
      else if (inViewport(el)) reveal(el);     // above the fold → show now (IO-independent)
      else io.observe(el);                     // below the fold → scroll-reveal
    }

    // Re-play the entrance after a SOFT re-render (e.g. router.refresh from a
    // scenario switch). React resets a wrapper's className to the server value,
    // dropping the runtime-added mc-fx-in and leaving the block hidden — but our
    // data-mc-fx-seen marker persists, so processEl would skip it (blank + no
    // replay). When a seen entrance wrapper loses mc-fx-in, clear the marker and
    // re-process on the NEXT frame so the hidden state paints first and the
    // entrance transition runs again on the new content. Same never-blank
    // guarantee as the initial-load path, now for the soft-refresh route.
    const replayScheduled = new WeakSet<HTMLElement>();
    function replayIfReset(el: HTMLElement): void {
      if (!el.hasAttribute("data-mc-fx")) return;
      if (!el.getAttribute("data-mc-fx-seen")) return;   // only blocks we already handled
      if (el.classList.contains("mc-fx-in")) return;      // still revealed → nothing to do
      const ids = (el.getAttribute("data-mc-fx-ids") ?? "").split(/\s+/);
      const isEntrance = ids.some((id) => id === "stagger" || effectGroup(id) === "entrance");
      if (!isEntrance || replayScheduled.has(el)) return;
      replayScheduled.add(el);
      const run = () => {
        replayScheduled.delete(el);
        el.removeAttribute("data-mc-fx-seen");
        processEl(el);   // re-hidden (base class) → revealed → entrance transition replays
      };
      if (canRaf) requestAnimationFrame(run); else run();
    }

    // (1) Process everything present at mount.
    document.querySelectorAll<HTMLElement>("[data-mc-fx]").forEach(processEl);

    // (2) Handle blocks added later (client-side navigation / streamed content):
    //     the layout — and this runtime — persist across (site) navigations, so
    //     new mc-fx wrappers would otherwise stay hidden forever.
    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        if (rec.type === "attributes") {
          if (rec.target instanceof HTMLElement) replayIfReset(rec.target);
          continue;
        }
        for (const node of rec.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.hasAttribute("data-mc-fx")) processEl(node);
          node.querySelectorAll<HTMLElement>("[data-mc-fx]").forEach(processEl);
        }
      }
    });
    // attributeFilter ["class"] so a soft re-render that resets a wrapper's
    // className (dropping mc-fx-in) triggers replayIfReset; the handler ignores
    // non-mc-fx elements cheaply.
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    // (3) When a hidden tab becomes visible, reveal anything now in view — covers
    //     IO notifications that were dropped/deferred while the document was hidden.
    const pending = () => entranceEls.filter((el) => !el.classList.contains("mc-fx-in"));
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      for (const el of pending()) if (inViewport(el)) { reveal(el); io?.unobserve(el); }
    };
    document.addEventListener("visibilitychange", onVisible);

    // (4) Hard failsafe: after FAILSAFE_MS reveal any block that is IN VIEW but
    //     still hidden (something went wrong — IO never fired). This guarantees
    //     visible content is never stuck blank while preserving scroll-reveal for
    //     below-the-fold blocks. If innerHeight is 0 (a frozen/hidden tab, where
    //     nothing is really "in view"), reveal all pending as a last resort so a
    //     restored tab is never blank. The inline layout failsafe covers the case
    //     where THIS runtime never runs at all.
    const failsafe = window.setTimeout(() => {
      const stuck = pending();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      (vh > 0 ? stuck.filter(inViewport) : stuck).forEach(reveal);
    }, FAILSAFE_MS);

    return () => {
      io?.disconnect();
      mo.disconnect();
      window.clearTimeout(failsafe);
      document.removeEventListener("visibilitychange", onVisible);
      if (scrollWired) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return null;
}
