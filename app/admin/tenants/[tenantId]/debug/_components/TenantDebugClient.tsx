"use client";

/**
 * TenantDebugClient
 *
 * Client component for the tenant Debug workspace tab.
 *
 * Controls the on-site debug overlay: a master switch (showDebugOverlay) and
 * a level selector (off / summary / full).
 *
 * ─── What this controls ───────────────────────────────────────────────────────
 *
 *   showDebugOverlay  — master on/off toggle for the entire debug section
 *   debugLevel        — granularity when the overlay is on:
 *       "off"     → same as showDebugOverlay = false (belt-and-suspenders)
 *       "summary" → hero/proof/cta keys, source, AI mode, fallback reason
 *       "full"    → summary + all context variable tables + enrichment trace
 *
 * ─── Safety note ──────────────────────────────────────────────────────────────
 *
 *   The runtime context-building and decision logic is NOT disabled — only the
 *   rendered output is gated.  Turning this off never affects personalisation.
 */

import { useState, useTransition }             from "react";
import { saveTenantDebugSettingsAction }        from "../actions";
import type { SaveDebugSettingsResult }         from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TenantDebugClientProps {
  tenantId:         string;
  showDebugOverlay: boolean;
  debugLevel:       "off" | "summary" | "full";
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Constants ──────────────────────────────────────────────────────────────────

const DEBUG_LEVELS: { value: "off" | "summary" | "full"; label: string; note: string }[] = [
  {
    value: "off",
    label: "Off",
    note:  "Nothing is rendered. Same as disabling the master switch.",
  },
  {
    value: "summary",
    label: "Summary",
    note:  "Compact panel: hero / proof / cta keys, traffic source, AI mode, fallback reason. Low noise.",
  },
  {
    value: "full",
    label: "Full",
    note:  "Everything: summary + all context variable tables + enrichment pipeline trace + IP / Leadinfo / GA4 detail.",
  },
];

// ── Root component ─────────────────────────────────────────────────────────────

export function TenantDebugClient({
  tenantId,
  showDebugOverlay: initialShowOverlay,
  debugLevel:       initialDebugLevel,
}: TenantDebugClientProps) {
  const [showOverlay, setShowOverlay] = useState(initialShowOverlay);
  const [debugLevel,  setDebugLevel]  = useState<"off" | "summary" | "full">(initialDebugLevel);
  const [saveState,   setSaveState]   = useState<SaveState>({ mode: "idle" });
  const [isPending,   startTransition] = useTransition();

  function handleShowOverlayChange(v: boolean) {
    setShowOverlay(v);
    setSaveState({ mode: "idle" });
  }

  function handleDebugLevelChange(v: "off" | "summary" | "full") {
    setDebugLevel(v);
    setSaveState({ mode: "idle" });
  }

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });

      const result: SaveDebugSettingsResult = await saveTenantDebugSettingsAction(tenantId, {
        showDebugOverlay: showOverlay,
        debugLevel,
      });

      if (result.ok) {
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  const isDisabled = isPending || saveState.mode === "saving";

  return (
    <div className="space-y-6">

      {/* ── Section card ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-neutral-900">On-site Debug Overlay</h2>
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
            Controls whether diagnostic information is rendered on the live site for this tenant.
            The runtime context-building and decision logic always runs regardless of this setting
            — only the rendered output is affected.
          </p>
        </div>

        {/* ── Master switch ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <Toggle
            id="showDebugOverlay"
            checked={showOverlay}
            onChange={handleShowOverlayChange}
            disabled={isDisabled}
            label="Show debug overlay on site"
            description={
              showOverlay
                ? "The debug panel is currently visible on the site. Disable to hide it."
                : "The debug panel is hidden. Enable to show diagnostic information on the site."
            }
          />
        </div>

        {/* ── Debug level ────────────────────────────────────────────────── */}
        <div className={showOverlay ? "" : "opacity-40 pointer-events-none"}>
          <p className="mb-2 text-xs font-medium text-neutral-700">Debug level</p>
          <p className="mb-3 text-[11px] text-neutral-400 leading-relaxed">
            Controls how much detail is shown when the overlay is enabled.
          </p>
          <div className="space-y-2">
            {DEBUG_LEVELS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  debugLevel === opt.value
                    ? "border-brand-300 bg-brand-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="debugLevel"
                  value={opt.value}
                  checked={debugLevel === opt.value}
                  onChange={() => handleDebugLevelChange(opt.value)}
                  disabled={isDisabled || !showOverlay}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-xs font-medium text-neutral-900">{opt.label}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{opt.note}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Info card ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">What does the debug overlay show?</p>
        <ul className="text-[11px] text-blue-600 leading-relaxed space-y-1 list-disc list-inside">
          <li><strong>Summary:</strong> Active tenant, CMS provider, traffic source, visit type, hero / proof / CTA variant keys, AI mode and confidence, fallback reason, theme, enabled blocks.</li>
          <li><strong>Full (adds):</strong> All context variables grouped by source (request, session, history, enrichment, time, client, derived) — each with value, type, and rules/AI availability flags. Enrichment pipeline stage timeline, effective IP, Leadinfo, GA4 history detail.</li>
        </ul>
        <p className="mt-2 text-[11px] text-blue-500">
          No secrets are ever included — API keys, write tokens, and service account credentials are not exposed in the overlay.
        </p>
      </div>

      {/* ── Save bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saveState.mode === "saving" ? "Saving…" : "Save debug settings"}
        </button>

        {saveState.mode === "success" && (
          <span className="text-xs text-green-600 font-medium">✓ Saved</span>
        )}
        {saveState.mode === "error" && (
          <span className="text-xs text-red-600">{saveState.message}</span>
        )}
      </div>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────

function Toggle({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  id:          string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
  disabled?:   boolean;
  label:       string;
  description: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        disabled
          ? "border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60"
          : "border-neutral-200 bg-white cursor-pointer hover:bg-neutral-50"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-900">{label}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
