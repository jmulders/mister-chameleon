"use client";

/**
 * DemoControlsToggle
 *
 * Rendered at the top of /demo-controls to let the host enable or disable the
 * floating ScenarioControlPanel without navigating away.
 *
 * State is persisted in localStorage under "mc_demo_controls_active" so that
 * refreshing the page preserves the choice.
 *
 * Communication with ScenarioControlPanel (a sibling mounted in the layout)
 * is done via a custom window event — "mc_demo_controls_changed" — so there
 * is no need for a shared context or prop-drilling through the RSC tree.
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "mc_demo_controls_active";
const CHANGE_EVENT = "mc_demo_controls_changed";

function readEnabled(): boolean {
  try {
    // Default: enabled (key absent or set to "1").
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function DemoControlsToggle() {
  const [mounted,  setMounted]  = useState(false);
  const [enabled,  setEnabled]  = useState(true);

  useEffect(() => {
    setMounted(true);
    setEnabled(readEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      // Notify the ScenarioControlPanel (same tab; storage event won't fire).
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: next } }));
    } catch {
      // localStorage unavailable — state stays in React memory only.
    }
  }

  // Don't render during SSR — localStorage is client-only.
  if (!mounted) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 20px",
        marginBottom: 4,
        background: enabled ? "#f0fdf4" : "#fafafa",
        border: `1px solid ${enabled ? "#86efac" : "#e5e7eb"}`,
        borderRadius: 10,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Label */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
          Scenario Control Panel
        </div>
        <div style={{ fontSize: 12, color: enabled ? "#15803d" : "#9ca3af" }}>
          {enabled
            ? "Active — the floating control panel is visible on this page."
            : "Disabled — the control panel is hidden. Enable it to switch visitor scenarios."}
        </div>
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        style={{
          flexShrink: 0,
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          background: enabled ? "#16a34a" : "#d1d5db",
          transition: "background 0.2s",
          padding: 0,
        }}
      >
        <span
          style={{
            display: "block",
            position: "absolute",
            top: 3,
            left: enabled ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 0.18s ease",
          }}
        />
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {enabled ? "Disable scenario controls" : "Enable scenario controls"}
        </span>
      </button>
    </div>
  );
}
