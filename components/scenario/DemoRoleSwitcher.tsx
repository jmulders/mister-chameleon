"use client";

/**
 * DemoRoleSwitcher — de schone, prospect-gerichte schakelaar bovenin het scherm.
 *
 * Anders dan het volledige ScenarioControlPanel (operator-tool, rechtsonder, vol
 * presets/schuifjes) toont dit alleen de drie publieksrollen + "Standaard". Dit
 * is wat je in Demo 1 de prospect voorschuift: "Wie ben je?" → hij kiest zichzelf,
 * en alleen hero + cta wisselen op het échte regel-pad (geen bypass).
 *
 * Zichtbaar in demo-modus: NODE_ENV=development, `?scenario=true` / `?demo=1`, of
 * NEXT_PUBLIC_SHOW_SCENARIO_PANEL=1. Client-only (via een ssr:false mount).
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateScenario, clearScenario, getScenarioState, subscribeToScenario } from "./scenario-store";
import { SCENARIO_PRESETS } from "./scenario-presets";

const NAVY = "#0E2A38", TEAL = "#0FA3A3", ICE = "#CFE8E6", WHITE = "#FFFFFF";

const ROLES: Array<{ key: string; label: string; segment: string }> = [
  { key: "demo_role_marketeer", label: "Marketer",       segment: "demo-role-marketeer" },
  { key: "demo_role_bureau",    label: "Agency owner",   segment: "demo-role-bureau" },
  { key: "demo_role_technisch", label: "Technical lead", segment: "demo-role-technisch" },
];

/**
 * Derive the active role from the live scenario state instead of a local
 * useState. This keeps the top-bar highlight in sync no matter who changed the
 * store — the time slider (left panel), the operator panel, or this switcher.
 * We match on the applied audience segment, not on presetKey, so the highlight
 * survives actions that overwrite presetKey (e.g. the time slider sets it to
 * "demo_time" while the role's segment stays in the overrides).
 */
function activeRoleFromState(): string | null {
  const seg = getScenarioState().overrides?.audienceSegmentIds;
  const asText = Array.isArray(seg) ? seg.join(",") : (typeof seg === "string" ? seg : "");
  if (!asText) return null;
  return ROLES.find((r) => asText.includes(r.segment))?.key ?? null;
}

function demoEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1") return true;
  const q = new URLSearchParams(window.location.search);
  return q.get("scenario") === "true" || q.get("demo") === "1";
}

export function DemoRoleSwitcher() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(() => activeRoleFromState());

  // Follow the shared store: any change (this switcher, the time slider, or the
  // operator panel) re-derives the active role so the highlight stays truthful.
  useEffect(() => subscribeToScenario(() => setActive(activeRoleFromState())), []);

  if (!demoEnabled()) return null;

  function apply(key: string | null) {
    if (key) {
      const preset = SCENARIO_PRESETS[key];
      if (preset) activateScenario(preset.overrides, preset.key, preset.label);
    } else {
      clearScenario();
    }
    // setActive volgt via de store-subscription; hier alleen de server-refresh.
    startTransition(() => router.refresh());
  }

  function pill(label: string, key: string | null) {
    const isActive = active === key;
    return (
      <button
        key={key ?? "__default__"}
        type="button"
        onClick={() => apply(key)}
        disabled={pending}
        style={{
          border: "none",
          borderRadius: 999,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          cursor: pending ? "wait" : "pointer",
          background: isActive ? TEAL : "rgba(255,255,255,0.10)",
          color: isActive ? WHITE : ICE,
          transition: "background 160ms ease, color 160ms ease",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: NAVY,
        padding: "6px 8px 6px 14px",
        borderRadius: 999,
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        maxWidth: "96vw",
      }}
      aria-label="Demo — kies een rol"
    >
      <span style={{ color: ICE, fontSize: 12, fontWeight: 700, marginRight: 4 }}>
        Who are you?
      </span>
      {ROLES.map((r) => pill(r.label, r.key))}
      {pill("Default", null)}
    </div>
  );
}
