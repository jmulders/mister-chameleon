"use client";

/**
 * ScenarioControlSwitch
 *
 * The switch in the site menu that turns Scenario Control on and off for this
 * browser. Off: no panel and no button in the corner, on any page. On: the
 * panel opens.
 *
 * It stands in the top band of the header on a wide screen ("band") and in
 * the menu on a phone ("menu"). The header only renders it on a site whose
 * tenant has Scenario Control (debug.showScenarioControl).
 *
 * Rendered on the server as "off", which is what a browser that never chose
 * has, and corrected after mount for one that switched it on. It keeps its
 * width either way, so the links beside it do not move.
 */

import { useEffect, useState } from "react";
import {
  readDemoControlsEnabled, subscribeToDemoControls, writeDemoControlsEnabled,
} from "./demo-controls-state";

interface ScenarioControlSwitchProps {
  /** "band": compact, for the top band. "menu": a full row for the phone menu. */
  variant?: "band" | "menu";
  /** Called after the visitor switched, with the new state. */
  onSwitched?: (enabled: boolean) => void;
}

export function ScenarioControlSwitch({ variant = "band", onSwitched }: ScenarioControlSwitchProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readDemoControlsEnabled());
    // The switch on /demo-controls, or the other copy of this one, changed it.
    return subscribeToDemoControls(setEnabled);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    writeDemoControlsEnabled(next);
    onSwitched?.(next);
  }

  const menu = variant === "menu";
  // The track and the knob, sized for a mouse in the band and for a finger in the menu.
  const track = menu ? { width: 44, height: 24, knob: 18, pad: 3 } : { width: 30, height: 16, knob: 12, pad: 2 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      data-part="scenario-switch"
      data-variant={variant}
      onClick={toggle}
      className={
        menu
          ? "flex w-full items-center justify-between gap-3 rounded-md px-3 text-sm text-[var(--nav-dropdown-text,var(--text-muted))] hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2"
          : "flex items-center gap-2 rounded px-2.5 py-1 text-[var(--nav-link,var(--header-fg,var(--text)))] hover:bg-[var(--primary-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2"
      }
      style={{ minHeight: menu ? 44 : undefined, background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
    >
      <span>Scenario Control</span>
      <span
        aria-hidden="true"
        style={{
          position: "relative", flexShrink: 0, display: "inline-block",
          width: track.width, height: track.height, borderRadius: track.height,
          background: enabled ? "var(--primary)" : "var(--border, #d1d5db)",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute", top: track.pad,
            left: enabled ? track.width - track.knob - track.pad : track.pad,
            width: track.knob, height: track.knob, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            transition: "left 0.15s ease",
          }}
        />
      </span>
    </button>
  );
}
