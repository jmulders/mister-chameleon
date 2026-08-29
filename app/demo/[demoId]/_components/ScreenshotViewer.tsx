"use client";

/**
 * ScreenshotViewer — the "screenshot" demo mode (MVP: annotated hotspots).
 *
 * Renders the prospect's full-page screenshot as the visual base layer, with the
 * vision-detected personalization regions outlined on top. A persona switcher
 * swaps each region's callout between the original copy and the per-scenario
 * variant, so a sales conversation can show "this headline becomes THIS for a
 * high-intent visitor" without cloning the DOM.
 */

import { useState } from "react";
import type { DemoInstance, DemoScreenshot } from "@/demo/types";

const PERSONAS: { key: string; label: string }[] = [
  { key: "original",      label: "Original" },
  { key: "awareness",     label: "Awareness" },
  { key: "consideration", label: "Consideration" },
  { key: "high_intent",   label: "High intent" },
  { key: "form_dropout",  label: "Form drop-off" },
  { key: "customer",      label: "Customer" },
  { key: "expansion",     label: "Expansion" },
];

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

export function ScreenshotViewer({ demo, screenshot }: { demo: DemoInstance; screenshot: DemoScreenshot }) {
  const [persona, setPersona] = useState<string>("high_intent");
  const brand = demo.primary_color || "#4f46e5";

  const variantFor = (region: DemoScreenshot["regions"][number]): string =>
    persona === "original" ? region.originalText : (region.scenarios[persona] ?? region.originalText);

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Demo banner + persona switcher */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white">Demo</span>
          <span className="text-sm font-medium text-neutral-800 truncate">{demo.site_name}</span>
          <span className="text-xs text-neutral-400">{screenshot.regions.length} personalizable regions</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPersona(p.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  persona === p.key
                    ? "border-transparent text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
                style={persona === p.key ? { backgroundColor: brand } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screenshot + hotspots */}
      <div className="mx-auto max-w-5xl p-4">
        <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot.screenshotUrl} alt={demo.site_name} className="block w-full select-none" />

          {screenshot.regions.map((region, i) => {
            const hasVariant = persona !== "original" && Boolean(region.scenarios[persona]);
            return (
              <div key={region.slotKey} className="pointer-events-none absolute" style={{ left: pct(region.box.x), top: pct(region.box.y), width: pct(region.box.w), height: pct(region.box.h) }}>
                {/* Outlined hotspot */}
                <div className="absolute inset-0 rounded-md" style={{ border: `2px solid ${brand}`, backgroundColor: hasVariant ? `${brand}14` : "transparent" }} />
                {/* Number badge */}
                <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow" style={{ backgroundColor: brand }}>
                  {i + 1}
                </span>
                {/* Callout */}
                <div className="pointer-events-auto absolute left-0 top-full mt-1 max-w-[min(360px,80vw)] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ backgroundColor: brand }}>{i + 1}</span>
                    <span className="font-mono text-[10px] text-neutral-400">{region.slotKey}</span>
                  </div>
                  <p className="font-medium text-neutral-900">{variantFor(region)}</p>
                  {hasVariant && (
                    <p className="mt-1 border-t border-neutral-100 pt-1 text-[10px] text-neutral-400">
                      original: {region.originalText}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-neutral-400">
          Annotated preview — each outlined region shows what its copy becomes for the selected visitor persona.
        </p>
      </div>
    </div>
  );
}
