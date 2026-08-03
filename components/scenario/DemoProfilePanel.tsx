"use client";

/**
 * DemoProfilePanel — the "what the site thinks it knows" panel, in a corner.
 *
 * Reflects the live scenario state in plain language: which role, which interest,
 * which stage, and the simulated time. Includes a small time control (Day /
 * Evening / Weekend) so the presenter can slide time and watch the page move —
 * the advisor's "tijdschuif". Demo-only; English, consistent with the platform UI.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getScenarioState, subscribeToScenario, activateScenario } from "./scenario-store";
import { isDemoChromeCollapsed, subscribeDemoChrome } from "./demo-ui-store";
import { useIsMobile } from "./use-is-mobile";
import type { ScenarioOverrides } from "./scenario-store";

const NAVY = "#0E2A38", TEAL = "#0FA3A3", ICE = "#CFE8E6", WHITE = "#FFFFFF", MUTED = "#8FB0AE";

const ROLE_LABELS: Record<string, string> = {
  "demo-role-marketeer": "Marketer",
  "demo-role-bureau":    "Agency owner",
  "demo-role-technisch": "Technical lead",
};

function demoEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1") return true;
  const q = new URLSearchParams(window.location.search);
  return q.get("scenario") === "true" || q.get("demo") === "1";
}

function timeLabel(o: ScenarioOverrides): string {
  if (o.isWeekend) return "Weekend";
  if (o.timeOfDay === "evening" || o.timeOfDay === "night") return "Evening";
  if (o.timeOfDay) return "Day";
  return "Now (real time)";
}

export function DemoProfilePanel() {
  const router = useRouter();
  const [state, setState] = useState(() => getScenarioState());
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(() => isDemoChromeCollapsed());
  const isMobile = useIsMobile();

  useEffect(() => subscribeToScenario(() => setState(getScenarioState())), []);
  // Fold together with the top bar via the shared collapse store.
  useEffect(() => subscribeDemoChrome(setCollapsed), []);

  if (!demoEnabled()) return null;
  // When collapsed, the top-bar "🎭 Demo" handle brings everything back.
  if (collapsed) return null;

  const o = state.overrides ?? {};
  const role = o.audienceSegmentIds ? (ROLE_LABELS[o.audienceSegmentIds] ?? o.audienceSegmentIds) : "—";
  const interest = o.interestPrimary
    ? `${o.interestPrimary}${typeof o.interestConfidence === "number" ? ` (${Math.round(o.interestConfidence * 100)}%)` : ""}`
    : "—";
  const stage = o.funnelStage ?? "—";
  const intent = typeof o.intentScore === "number" ? String(o.intentScore) : "—";

  function setTime(kind: "day" | "evening" | "weekend") {
    const base = { ...(getScenarioState().overrides ?? {}) };
    if (kind === "day")     { base.timeOfDay = "afternoon"; base.currentHour = 14; base.isWeekend = false; }
    if (kind === "evening") { base.timeOfDay = "evening";   base.currentHour = 20; base.isWeekend = false; }
    if (kind === "weekend") { base.timeOfDay = "afternoon"; base.currentHour = 14; base.isWeekend = true;  }
    activateScenario(base, "demo_time", "Time");
    setPending(true);
    router.refresh();
    setTimeout(() => setPending(false), 600);
  }

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "3px 0" }}>
      <span style={{ color: MUTED, fontSize: 12 }}>{label}</span>
      <span style={{ color: WHITE, fontSize: 12, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );

  const timeBtn = (label: string, kind: "day" | "evening" | "weekend") => (
    <button
      type="button"
      onClick={() => setTime(kind)}
      disabled={pending}
      style={{
        flex: 1, border: "none", borderRadius: 8, padding: "6px 4px",
        fontSize: 11, fontWeight: 600, cursor: pending ? "wait" : "pointer",
        background: "rgba(255,255,255,0.10)", color: ICE,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? 10 : 16,
        left: isMobile ? 10 : 16,
        right: isMobile ? 10 : undefined,
        zIndex: 10001,
        width: isMobile ? "auto" : 232,
        maxWidth: isMobile ? 300 : undefined,
        background: NAVY, color: WHITE, borderRadius: 14, padding: isMobile ? 12 : 14,
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
      aria-label="Demo — what the site knows"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: TEAL, display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: ICE, letterSpacing: 0.3 }}>
          What the site knows
        </span>
      </div>
      {row("Role", role)}
      {row("Interest", interest)}
      {row("Stage", String(stage))}
      {row("Intent", intent)}
      {row("Time", timeLabel(o))}
      <div style={{ marginTop: 10 }}>
        <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Simulate time</div>
        <div style={{ display: "flex", gap: 6 }}>
          {timeBtn("Day", "day")}
          {timeBtn("Evening", "evening")}
          {timeBtn("Weekend", "weekend")}
        </div>
      </div>
    </div>
  );
}
