/**
 * Context Simulator Provider
 *
 * React context that makes the active simulator scenario available to all
 * stories in the tree.  Components opt in by calling `useContextSimulator()`.
 *
 * ─── Usage in a story ─────────────────────────────────────────────────────────
 *
 *   // In a story args or render function:
 *   const sim = useContextSimulator();
 *   const heroKey = sim.activeScenario?.decision.heroKey ?? "hero_google_problem";
 *
 * ─── Toolbar integration ──────────────────────────────────────────────────────
 *
 *   The Storybook preview.tsx decorator reads `context.globals.scenario` and
 *   passes the resolved SimulatorScenario down to this provider.
 *   Selecting a scenario in the toolbar immediately re-renders all stories.
 *
 * ─── Debug overlay ────────────────────────────────────────────────────────────
 *
 *   When `showDebug` is true (default), a small floating overlay shows the
 *   active scenario details: visitor type, funnel stage, decision keys, etc.
 */

"use client";

import React, { createContext, useContext, useState } from "react";
import type { ContextSimulatorValue, SimulatorScenario } from "./types";
import { PREDEFINED_SCENARIOS }                           from "./scenarios";

// ── Context ───────────────────────────────────────────────────────────────────

const ContextSimulatorContext = createContext<ContextSimulatorValue>({
  activeScenario: null,
  scenarios:      PREDEFINED_SCENARIOS as SimulatorScenario[],
  setScenario:    () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

interface ContextSimulatorProviderProps {
  children:        React.ReactNode;
  /** Initial scenario key. Pass from Storybook globals.scenario. */
  scenarioKey?:    string | null;
  /** Whether to show the floating debug overlay. Default: true. */
  showDebug?:      boolean;
}

export function ContextSimulatorProvider({
  children,
  scenarioKey,
  showDebug = true,
}: ContextSimulatorProviderProps) {
  const [activeKey, setActiveKey] = useState<string | null>(scenarioKey ?? null);

  // When the Storybook toolbar changes scenarioKey, propagate it.
  // (This handles re-renders from global changes.)
  const resolvedKey   = scenarioKey !== undefined ? scenarioKey : activeKey;
  const activeScenario = resolvedKey
    ? (PREDEFINED_SCENARIOS.find((s) => s.key === resolvedKey) ?? null)
    : null;

  const value: ContextSimulatorValue = {
    activeScenario,
    scenarios:  PREDEFINED_SCENARIOS as SimulatorScenario[],
    setScenario: setActiveKey,
  };

  return (
    <ContextSimulatorContext.Provider value={value}>
      {children}
      {showDebug && activeScenario && (
        <SimulatorDebugOverlay scenario={activeScenario} />
      )}
    </ContextSimulatorContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current Context Simulator value.
 * Use `activeScenario.decision` to get the simulated experience plan.
 */
export function useContextSimulator(): ContextSimulatorValue {
  return useContext(ContextSimulatorContext);
}

// ── Debug overlay ─────────────────────────────────────────────────────────────

function SimulatorDebugOverlay({ scenario }: { scenario: SimulatorScenario }) {
  const [collapsed, setCollapsed] = useState(false);

  const BAND_COLOUR: Record<string, string> = {
    low:       "#94a3b8",
    medium:    "#3b82f6",
    high:      "#f59e0b",
    very_high: "#10b981",
  };

  return (
    <div
      style={{
        position:   "fixed",
        top:        "8px",
        right:      "8px",
        zIndex:     9998,
        background: "#1e293b",
        color:      "#f1f5f9",
        borderRadius: "8px",
        fontFamily: "ui-monospace,Cascadia Code,Fira Code,monospace",
        fontSize:   "11px",
        boxShadow:  "0 4px 16px rgba(0,0,0,0.3)",
        minWidth:   "220px",
        maxWidth:   "280px",
        overflow:   "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        "6px",
          padding:    "6px 10px",
          background: "#0f172a",
          cursor:     "pointer",
          userSelect: "none",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontSize: "9px", background: "#10b981", color: "#fff", borderRadius: "2px", padding: "1px 4px", fontWeight: 700 }}>
          SIM
        </span>
        <span style={{ fontWeight: 600, flex: 1 }}>{scenario.label}</span>
        <span style={{ color: "#94a3b8" }}>{collapsed ? "▸" : "▾"}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: "8px 10px" }}>
          {/* Visitor + funnel */}
          <Row k="visitor" v={scenario.visitorType} />
          <Row k="source" v={scenario.source} />
          <Row k="stage" v={scenario.funnelStage} />
          <Row k="intent" v={`${scenario.intentScore}/100`} />
          <Row k="confidence" v={
            <span style={{ color: BAND_COLOUR[scenario.confidenceBand] ?? "#94a3b8", fontWeight: 700 }}>
              {scenario.confidenceBand}
            </span>
          } />
          {scenario.company && (
            <Row k="company" v={scenario.company.name} />
          )}
          {scenario.interest && (
            <Row k="interest" v={scenario.interest} />
          )}

          {/* Decision output */}
          <div style={{ marginTop: "6px", borderTop: "1px solid #334155", paddingTop: "6px" }}>
            <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>
              DECISION
            </div>
            {scenario.decision.ruleLabel && (
              <Row k="rule" v={<span style={{ color: "#fbbf24" }}>{scenario.decision.ruleLabel}</span>} />
            )}
            <Row k="hero" v={scenario.decision.heroKey} />
            <Row k="proof" v={scenario.decision.proofKey} />
            <Row k="cta" v={scenario.decision.ctaKey} />
            {scenario.decision.themeKey && (
              <Row k="theme" v={scenario.decision.themeKey} />
            )}
          </div>

          {scenario.description && (
            <div style={{ marginTop: "6px", color: "#64748b", fontSize: "10px", lineHeight: 1.4 }}>
              {scenario.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  k, v,
}: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "2px" }}>
      <span style={{ color: "#64748b", minWidth: "60px" }}>{k}:</span>
      <span style={{ color: "#e2e8f0" }}>{v}</span>
    </div>
  );
}
