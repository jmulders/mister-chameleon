"use client";

/**
 * EffectSwatch
 *
 * A small, looping demo of one declarative effect on a placeholder block, shown
 * beside each effect in the pickers (EffectsEditor, the block-drawer Motion field,
 * and the block-type editor — all via the shared EffectListEditor). It is fed
 * straight from the registry (effectsToAttrs) and the shared runtime CSS
 * (EFFECT_RUNTIME_CSS), so it stays faithful to the real effect. Click to replay.
 *
 * How each group is demoed:
 *   entrance                  — loop reset -> reveal (mc-fx-in) using the params.
 *   emphasis (pulse / glow)   — the CSS keyframe loop plays on its own.
 *   hover-lift                — pure CSS; lifts when you hover the swatch.
 *   ken-burns                 — the CSS zoom loop plays (mc-fx-kb-play).
 *   scroll-fade / -scale / parallax — a small JS loop drives the scroll variable,
 *                               since there is no scroll inside a swatch.
 *   sticky                    — shown static (no meaningful box demo).
 *
 * Reduced-motion: the end state is shown and nothing animates.
 */

import { useEffect, useRef, useState } from "react";
import { effectsToAttrs, type BlockEffectConfig } from "@/design-system/effects/effect-ref";
import { effectGroup } from "@/design-system/effects/effect-defs";
import { EFFECT_RUNTIME_CSS } from "@/design-system/effects/effect-runtime";

function ensureEffectRuntimeCss(): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById("mc-fx-style")) {
    const st = document.createElement("style");
    st.id = "mc-fx-style";
    st.textContent = EFFECT_RUNTIME_CSS;
    document.head.appendChild(st);
  }
  document.documentElement.classList.add("mc-fx-ready");
}

export function EffectSwatch({ config }: { config: BlockEffectConfig }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [nonce, setNonce] = useState(0); // click-to-replay
  const id = config.effect;
  const paramsKey = JSON.stringify(config.params ?? {});
  const attrs = effectsToAttrs([config]);

  useEffect(() => {
    ensureEffectRuntimeCss();
    const el = boxRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const group = effectGroup(id);

    if (reduced) { el.classList.add("mc-fx-in"); return; } // end state, no motion

    let interval: number | undefined;
    let raf = 0;
    let start = 0;

    if (group === "entrance") {
      const dur = Number(config.params?.duration ?? 600);
      const cycle = () => {
        el.classList.remove("mc-fx-in");
        void el.offsetHeight;                     // commit the hidden state
        requestAnimationFrame(() => el.classList.add("mc-fx-in"));
      };
      cycle();
      interval = window.setInterval(cycle, Math.max(1700, dur + 1300));
    } else if (id === "ken-burns") {
      el.classList.add("mc-fx-kb-play");          // CSS zoom loop
    } else if (id === "scroll-fade" || id === "scroll-scale" || id === "parallax") {
      const from = Number(config.params?.from ?? 0.85);
      const to   = Number(config.params?.to ?? 1);
      const loop = (ts: number) => {
        if (!start) start = ts;
        const p = (Math.sin((ts - start) / 850) + 1) / 2; // 0..1 oscillation
        if (id === "scroll-fade") el.style.opacity = p.toFixed(3);
        else if (id === "scroll-scale") el.style.setProperty("--mc-fx-scroll-scale", (from + (to - from) * p).toFixed(3));
        else el.style.setProperty("--mc-fx-parallax-y", `${((p - 0.5) * 18).toFixed(1)}px`);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    // pulse / glow-pulse: CSS keyframe loop. hover-lift: CSS on hover. sticky: static.

    return () => { if (interval) clearInterval(interval); if (raf) cancelAnimationFrame(raf); };
    // config is captured via id + paramsKey (its serialised params).
  }, [nonce, id, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const className = ["mc-fx-swatch-block", attrs?.className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      title="Replay demo"
      aria-label={`Replay ${id} demo`}
      onClick={() => setNonce((n) => n + 1)}
      style={{
        flexShrink: 0, width: 44, height: 30, padding: 4, borderRadius: 6,
        border: "1px solid #e5e7eb", background: "#f8fafc", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      <div
        ref={boxRef}
        className={className}
        style={{ ...(attrs?.style as React.CSSProperties), width: 22, height: 14, borderRadius: 3, background: "#6366f1" }}
        {...(attrs?.data ?? {})}
      />
    </button>
  );
}
