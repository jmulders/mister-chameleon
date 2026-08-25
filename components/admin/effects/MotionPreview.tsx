"use client";

/**
 * MotionPreview
 *
 * Wraps the block-drawer live preview and applies the block's CURRENT (unsaved)
 * Motion effect to the preview node, using the shared registry resolution
 * (resolveBlockEffects + effectsToAttrs) and the shared runtime CSS
 * (EFFECT_RUNTIME_CSS) as the single source of truth — no separate effect
 * definitions. A "Replay motion" trigger (replaySignal) re-runs the entrance so
 * the operator can see exactly how it plays on the real block.
 *
 * Reduced-motion: the end state is shown immediately (no auto-play).
 *
 * The reveal state is React-managed (a `revealed` flag drives the mc-fx-in class)
 * so a re-render never wipes it — the same reconciliation trap the platform
 * runtime guards against.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  resolveBlockEffects, effectsToAttrs,
  type BlockEffectRef, type EffectSet,
} from "@/design-system/effects/effect-ref";
import { EFFECT_RUNTIME_CSS } from "@/design-system/effects/effect-runtime";

/** Inject the shared effect CSS + enable the ready gate in the admin document once. */
function ensureEffectRuntimeCss(): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById("mc-fx-style")) {
    const st = document.createElement("style");
    st.id = "mc-fx-style";
    st.textContent = EFFECT_RUNTIME_CSS;
    document.head.appendChild(st);
  }
  // Entrance hiding CSS is gated on html.mc-fx-ready. The admin has no other mc-fx
  // blocks, so enabling it here only affects this preview.
  document.documentElement.classList.add("mc-fx-ready");
}

export function MotionPreview({
  effectRef,
  effectSets,
  replaySignal,
  children,
}: {
  effectRef?:   BlockEffectRef;
  effectSets:   readonly EffectSet[];
  replaySignal: number;
  children:     React.ReactNode;
}) {
  const attrs = useMemo(
    () => effectsToAttrs(resolveBlockEffects(effectRef, effectSets)),
    [effectRef, effectSets],
  );

  const rootRef = useRef<HTMLDivElement>(null);

  // Re-play whenever the effect changes or the Replay signal bumps.
  //
  // The entrance effects are CSS *transitions* (opacity / transform / filter /
  // clip-path), not @keyframes animations. Restarting a transition is NOT the same
  // as restarting an animation: simply removing mc-fx-in does not snap the element
  // to the hidden state — it starts a 600ms transition TOWARD hidden, which the
  // immediate re-add retargets back to shown, so the value never leaves the revealed
  // state and nothing replays (this is why the earlier reflow-only fix looked inert
  // in the real drawer). The double-rAF fix before that was correct for transitions
  // but rAF is paused for the drawer's scaled-down preview column, so it never ran.
  //
  // Correct restart: disable the transition so the hidden state commits INSTANTLY,
  // force a reflow to lock it in, then re-enable the transition and reveal so it
  // animates hidden -> shown. All synchronous (no rAF), so it works regardless of
  // rAF being paused. The rendered className never carries mc-fx-in, so React
  // reconciliation leaves the imperatively-toggled class alone; when the className
  // prop changes (a new effect => new attrs) this effect re-runs and re-reveals.
  useEffect(() => {
    ensureEffectRuntimeCss();
    const el = rootRef.current;
    if (!el) return;
    if (!attrs) { el.classList.add("mc-fx-in"); return; } // no effect: nothing to hide
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) { el.classList.add("mc-fx-in"); return; } // end state, no auto-play
    el.style.transition = "none";   // disable so the hidden state applies instantly
    el.classList.remove("mc-fx-in"); // snap to the hidden "before" state
    void el.offsetWidth;             // commit it with no transition
    el.style.transition = "";        // restore the CSS transition
    el.classList.add("mc-fx-in");    // reveal -> the entrance transition runs
  }, [attrs, replaySignal]);

  const className = ["mc-fx-preview", attrs?.className].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={className}
      style={attrs?.style as React.CSSProperties | undefined}
      {...(attrs?.data ?? {})}
    >
      {children}
    </div>
  );
}
