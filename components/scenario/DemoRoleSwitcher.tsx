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

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateScenario, clearScenario } from "./scenario-store";
import { SCENARIO_PRESETS } from "./scenario-presets";

const NAVY = "#0E2A38", TEAL = "#0FA3A3", ICE = "#CFE8E6", WHITE = "#FFFFFF";

const ROLES: Array<{ key: string; label: string }> = [
  { key: "demo_role_marketeer", label: "Marketer" },
  { key: "demo_role_bureau",    label: "Agency owner" },
  { key: "demo_role_technisch", label: "Technical lead" },
];

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
  const [active, setActive] = useState<string | null>(null);

  if (!demoEnabled()) return null;

  function apply(key: string | null) {
    if (key) {
      const preset = SCENARIO_PRESETS[key];
      if (preset) activateScenario(preset.overrides, preset.key, preset.label);
    } else {
      clearScenario();
    }
    setActive(key);
    // Re-render server-side met de nieuwe mc_scenario-cookie → echte regels.
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
