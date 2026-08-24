/**
 * Shared effect runtime assets, derived from the effect registry (the SoT).
 *
 * Both the platform CSS (app/globals.css mirrors EFFECT_RUNTIME_CSS) and the
 * snippet (which injects EFFECT_RUNTIME_CSS into the host page and inlines
 * EFFECT_GROUP_MAP into its player) use these so there is exactly one set of
 * effect definitions. The snippet cannot import app CSS or the registry at run
 * time, so buildSnippetSource() interpolates these build-time values into the
 * generated snippet string.
 */

import { EFFECT_DEFINITIONS, type EffectGroupKey } from "./effect-defs";

/** id → group, generated from the registry so the snippet player needs no copy. */
export const EFFECT_GROUP_MAP: Readonly<Record<string, EffectGroupKey>> =
  Object.fromEntries(EFFECT_DEFINITIONS.map((d) => [d.id, d.group]));

/**
 * The vanilla (ES5, no-framework) effect player, as a string, for the JS snippet.
 *
 * It is the snippet-side twin of components/platform/BlockEffectRuntime.tsx: same
 * versioning, same reduced-motion + feature-detect guards, same per-effect
 * branching. The id → group table is inlined from EFFECT_GROUP_MAP (the registry)
 * so there is no separate definition. It defines window.__mcFxPlay(root); the
 * snippet calls it after applying blocks. Auto-runs once on load too, so it works
 * on a static host page (used by the dev-check).
 */
export function effectRuntimeJs(): string {
  return `;(function(){
  if (window.__mcFxPlay) return;
  var GROUPS = ${JSON.stringify(EFFECT_GROUP_MAP)};
  var SUPPORTED = { "1": 1 };
  function addClass(el, c){ if ((" " + el.className + " ").indexOf(" " + c + " ") < 0) el.className += " " + c; }
  function play(root){
    var scope = root || document;
    var els = scope.querySelectorAll("[data-mc-fx]");
    if (!els.length) return;
    var reduced = false; try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch(e){}
    var canObs = "IntersectionObserver" in window;
    var canRaf = typeof requestAnimationFrame === "function";
    var canSticky = false; try { canSticky = !!(window.CSS && CSS.supports && CSS.supports("position","sticky")); } catch(e){}
    var entrance = [], parallax = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute("data-mc-fx-done")) continue; // idempotent: play() may run twice
      el.setAttribute("data-mc-fx-done", "1");
      var v = el.getAttribute("data-mc-fx-v") || "1";
      if (!SUPPORTED[v]) { addClass(el, "mc-fx-in"); continue; }
      var ids = (el.getAttribute("data-mc-fx-ids") || "").split(/\\s+/);
      var hasEntrance = false;
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k]; if (!id) continue;
        var g = GROUPS[id];
        if (g === "entrance") { hasEntrance = true; }
        else if (g === "continuous" && !reduced) {
          if (id === "sticky") { if (canSticky) addClass(el, "mc-fx-sticky-on"); }
          else if (id === "ken-burns") { addClass(el, "mc-fx-kb-play"); }
          else if (id === "parallax") { if (canRaf) parallax.push(el); }
        }
      }
      if (hasEntrance) { if (canObs) entrance.push(el); else addClass(el, "mc-fx-in"); }
    }
    if (entrance.length && canObs) {
      var io = new IntersectionObserver(function(ents){
        for (var e = 0; e < ents.length; e++) { if (ents[e].isIntersecting) { addClass(ents[e].target, "mc-fx-in"); io.unobserve(ents[e].target); } }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
      for (var m = 0; m < entrance.length; m++) io.observe(entrance[m]);
    }
    if (parallax.length) {
      var raf = 0;
      var onScroll = function(){
        if (raf) return;
        raf = requestAnimationFrame(function(){
          raf = 0; var vh = window.innerHeight || document.documentElement.clientHeight;
          for (var p = 0; p < parallax.length; p++) {
            var pe = parallax[p]; var r = pe.getBoundingClientRect();
            var sp = parseFloat(getComputedStyle(pe).getPropertyValue("--mc-fx-parallax-speed")) || 0.2;
            var d = ((r.top + r.height / 2) - vh / 2) * -sp;
            pe.style.setProperty("--mc-fx-parallax-y", d.toFixed(1) + "px");
          }
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }
  }
  window.__mcFxPlay = play;
  if (document.readyState !== "loading") play(); else document.addEventListener("DOMContentLoaded", function(){ play(); });
})();`;
}

/**
 * The canonical effect CSS. Kept byte-identical to the block in app/globals.css
 * (a test asserts both contain the same rules). Gated on html.mc-fx-ready so
 * content is visible without the runtime; prefers-reduced-motion shows everything
 * and fully disables the advanced effects.
 */
export const EFFECT_RUNTIME_CSS = `
html.mc-fx-ready .mc-fx-reveal,
html.mc-fx-ready .mc-fx-fade-in,
html.mc-fx-ready .mc-fx-slide-in-up,
html.mc-fx-ready .mc-fx-slide-in-left,
html.mc-fx-ready .mc-fx-slide-in-right,
html.mc-fx-ready .mc-fx-zoom-in {
  transition:
    opacity   var(--mc-fx-duration, 600ms) ease var(--mc-fx-delay, 0ms),
    transform var(--mc-fx-duration, 600ms) ease var(--mc-fx-delay, 0ms);
  will-change: opacity, transform;
}
html.mc-fx-ready .mc-fx-reveal:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-fade-in:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-slide-in-up:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-slide-in-left:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-slide-in-right:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-zoom-in:not(.mc-fx-in) {
  opacity: 0;
}
html.mc-fx-ready .mc-fx-reveal:not(.mc-fx-in),
html.mc-fx-ready .mc-fx-slide-in-up:not(.mc-fx-in) {
  transform: translateY(var(--mc-fx-distance, 24px));
}
html.mc-fx-ready .mc-fx-slide-in-left:not(.mc-fx-in) {
  transform: translateX(calc(-1 * var(--mc-fx-distance, 24px)));
}
html.mc-fx-ready .mc-fx-slide-in-right:not(.mc-fx-in) {
  transform: translateX(var(--mc-fx-distance, 24px));
}
html.mc-fx-ready .mc-fx-zoom-in:not(.mc-fx-in) {
  transform: scale(0.96);
}
.mc-fx-in {
  opacity: 1;
  transform: none;
}
.mc-fx-hover-lift {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.mc-fx-hover-lift:hover {
  transform: translateY(calc(-1 * var(--mc-fx-lift, 4px)));
}
.mc-fx-parallax {
  transform: translate3d(0, var(--mc-fx-parallax-y, 0px), 0);
  will-change: transform;
}
.mc-fx-sticky.mc-fx-sticky-on {
  position: sticky;
  top: var(--mc-fx-sticky-top, 16px);
}
@keyframes mc-fx-kenburns {
  from { transform: scale(1); }
  to   { transform: scale(var(--mc-fx-kb-scale, 1.15)); }
}
.mc-fx-ken-burns {
  overflow: hidden;
}
.mc-fx-ken-burns.mc-fx-kb-play {
  animation: mc-fx-kenburns var(--mc-fx-kb-duration, 12000ms) ease-in-out infinite alternate;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  html.mc-fx-ready [class*="mc-fx-"] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .mc-fx-hover-lift:hover {
    transform: none;
  }
  .mc-fx-ken-burns,
  .mc-fx-ken-burns.mc-fx-kb-play {
    animation: none !important;
  }
  .mc-fx-sticky.mc-fx-sticky-on {
    position: static !important;
  }
}`.trim();
