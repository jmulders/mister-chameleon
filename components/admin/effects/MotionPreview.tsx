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

import { useEffect, useMemo, useState } from "react";
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

  const [revealed, setRevealed] = useState(false);

  // Re-play whenever the effect changes or the Replay signal bumps. Reset to the
  // hidden state, let it paint, then reveal so the entrance transition runs again.
  useEffect(() => {
    ensureEffectRuntimeCss();
    if (!attrs) { setRevealed(true); return; }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) { setRevealed(true); return; } // end state, no auto-play
    setRevealed(false);
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    return () => cancelAnimationFrame(raf1);
  }, [attrs, replaySignal]);

  const className = ["mc-fx-preview", attrs?.className, revealed ? "mc-fx-in" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={attrs?.style as React.CSSProperties | undefined}
      {...(attrs?.data ?? {})}
    >
      {children}
    </div>
  );
}
