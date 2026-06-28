"use client";

/**
 * Scenario Control Panel  (v3)
 *
 * A complete context control surface for testing, demoing, and debugging
 * behavioral personalization.  Only renders in dev + preview mode.
 *
 * ─── What's new in v3 ─────────────────────────────────────────────────────────
 *
 *   Apply / Recompute:
 *     Explicit "Apply Overrides" button triggers router.refresh() so the full
 *     RSC pipeline (rules, enrichment, debug, adaptive blocks) re-evaluates
 *     with the new overrides — WITHOUT a manual browser refresh.
 *
 *   Auto Apply:
 *     Toggle to automatically call router.refresh() on every field change
 *     (debounced 600ms to avoid flooding). Useful for live demos.
 *
 *   Full enrichment coverage:
 *     All fields visible in the debug panel are now editable, grouped into:
 *     Request · Geo · Network/IP · Company · Ads · CRM · ABM · Weather ·
 *     History/Interest · Behavior · Lifecycle
 *
 *   Enricher Actions:
 *     Re-run any enricher (IP, GA4, Weather, OpenKVK, Leadinfo, HubSpot, all)
 *     in mock or live mode.  Result is stored as an enrichmentPatch override
 *     and applied immediately via router.refresh().
 *
 *   Effective Summary:
 *     Always-visible compact strip showing the current effective context at
 *     a glance: visitor type, intent, enrichment, and gating status.
 *
 * ─── Tabs ─────────────────────────────────────────────────────────────────────
 *
 *   1. Context     — Quick Presets + Action Bar + full override sections
 *   2. Why This?   — Human-readable rule explanation
 *   3. Live State  — Raw behavioral data inspection
 *   4. Demo Flows  — Step-by-step event sequences
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 *   • Only mounts when NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1" OR
 *     NODE_ENV === "development" OR ?scenario=true query param.
 *   • All overrides are sessionStorage-scoped — never reach the visitor DB.
 *   • Enricher re-runs store results as scenario overrides only — no real data.
 *   • One-click "Restore Real" clears all overrides instantly.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { JourneyState } from "@/lib/journey/types";
import { gateAdaptiveDecisions } from "@/lib/journey/compute-confidence";

import {
  getScenarioState,
  activateScenario,
  clearScenario,
  subscribeToScenario,
  patchScenarioOverride,
  type ScenarioState,
  type ScenarioOverrides,
} from "./scenario-store";
import { SCENARIO_PRESET_LIST } from "./scenario-presets";
import { DEMO_FLOW_LIST, runDemoFlow, type DemoFlowProgress } from "./demo-flows";
import { applyScenarioOverride } from "./apply-scenario-override";
import { ENRICHER_REGISTRY, type EnricherKey } from "@/lib/scenario/enricher-registry";

import {
  getJourneyStoreEvents,
  pushToJourneyStore,
  generateEventId,
} from "@/tracking/journey-store";
import {
  mergeJourneyEvents,
  deriveClientState,
} from "@/tracking/merge-journey-events";
import {
  resetWebsiteSession,
  resetWebsiteSessionAndVisitor,
  type DebugResetResult,
} from "./debug-reset";

// ── Visibility guard ──────────────────────────────────────────────────────────

function shouldShowPanel(): boolean {
  if (typeof window === "undefined") return false;
  const isDev = process.env.NODE_ENV === "development";
  const isEnvEnabled = process.env.NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1";
  const isQueryEnabled = new URLSearchParams(window.location.search).get("scenario") === "true";
  return isDev || isEnvEnabled || isQueryEnabled;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  neutral: { bg: "#f1f5f9", text: "#475569" },
  blue:    { bg: "#dbeafe", text: "#1e40af" },
  green:   { bg: "#dcfce7", text: "#166534" },
  orange:  { bg: "#ffedd5", text: "#9a3412" },
  red:     { bg: "#fee2e2", text: "#991b1b" },
  purple:  { bg: "#ede9fe", text: "#6d28d9" },
  amber:   { bg: "#fef3c7", text: "#92400e" },
  teal:    { bg: "#ccfbf1", text: "#0f766e" },
};

function badge(color: string, text: string) {
  const c = BADGE_COLORS[color] ?? BADGE_COLORS.neutral!;
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: 10, fontWeight: 600,
      padding: "2px 6px", borderRadius: 99,
      display: "inline-block", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    awareness: "neutral", consideration: "blue", intent: "amber",
    high_intent: "orange", customer: "green",
  };
  return badge(map[stage] ?? "neutral", stage.replace(/_/g, " "));
}

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function score(v: number) { return `${Math.round(v)}/100`; }

// ── Enricher status ───────────────────────────────────────────────────────────

interface EnricherStatus {
  key:        EnricherKey;
  state:      "idle" | "running" | "success" | "error";
  durationMs?: number;
  error?:      string;
  mockMode?:   boolean;
  lastRunAt?:  string;
}

// ── Shared subcomponents ──────────────────────────────────────────────────────

function Divider() {
  return <div style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 5 }}>
      {children}
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, color,
}: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: color ?? "#111827" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color ?? "#6366f1", height: 4 }}
      />
    </div>
  );
}

function DropdownRow({
  label, hint, value, options, onChange, isOverridden,
}: {
  label: string; hint?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
  isOverridden?: boolean;
}) {
  const active = !!value;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 2 }}>
        <label style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</label>
        {active && (
          <button onClick={() => onChange(undefined)}
            style={{ fontSize: 10, color: "#9ca3af", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}>
            ✕ reset
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{hint}</div>}
      <select value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        style={{ width: "100%", padding: "3px 7px", borderRadius: 5, border: "1px solid",
          borderColor: active ? "#6366f1" : "#e5e7eb",
          background: active ? "#eef2ff" : "#fff",
          fontSize: 11, color: active ? "#4f46e5" : "#374151" }}>
        <option value="">— real value —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextRow({
  label, hint, value, placeholder, onChange,
}: {
  label: string; hint?: string; value: string; placeholder?: string;
  onChange: (v: string | null | undefined) => void;
}) {
  const isDirty = value !== "";
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 2 }}>
        <label style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</label>
        {isDirty && (
          <button onClick={() => onChange(undefined)}
            style={{ fontSize: 10, color: "#9ca3af", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}>
            ✕ reset
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{hint}</div>}
      <input type="text" value={value} placeholder={placeholder ?? "— real value —"}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ width: "100%", padding: "3px 7px", borderRadius: 5,
          border: "1px solid", borderColor: isDirty ? "#6366f1" : "#e5e7eb",
          background: isDirty ? "#eef2ff" : "#fff",
          fontSize: 11, color: isDirty ? "#4f46e5" : "#374151", boxSizing: "border-box" }}
      />
    </div>
  );
}

function NumericRow({
  label, hint, value, placeholder, min, max, step, onChange,
}: {
  label: string; hint?: string; value: string; placeholder?: string;
  min?: number; max?: number; step?: number;
  onChange: (v: number | null | undefined) => void;
}) {
  const isDirty = value !== "";
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 2 }}>
        <label style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</label>
        {isDirty && (
          <button onClick={() => onChange(undefined)}
            style={{ fontSize: 10, color: "#9ca3af", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}>
            ✕ reset
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{hint}</div>}
      <input type="number" value={value} placeholder={placeholder ?? "— real value —"}
        min={min} max={max} step={step}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        style={{ width: "100%", padding: "3px 7px", borderRadius: 5,
          border: "1px solid", borderColor: isDirty ? "#6366f1" : "#e5e7eb",
          background: isDirty ? "#eef2ff" : "#fff",
          fontSize: 11, color: isDirty ? "#4f46e5" : "#374151", boxSizing: "border-box" }}
      />
    </div>
  );
}

function CheckRow({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void;
}) {
  const isDirty = value !== undefined;
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 6,
      fontSize: 11, color: "#374151", marginBottom: 5, cursor: "pointer" }}>
      <input type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked ? true : undefined)}
        style={{ accentColor: "#6366f1", marginTop: 1, flexShrink: 0 }}
      />
      <div>
        <span style={{ fontWeight: isDirty ? 600 : 400, color: isDirty ? "#4f46e5" : "#374151" }}>
          {label}
        </span>
        {hint && <div style={{ fontSize: 10, color: "#9ca3af" }}>{hint}</div>}
      </div>
      {isDirty && (
        <button onClick={(e) => { e.preventDefault(); onChange(undefined); }}
          style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none",
            cursor: "pointer", padding: 0, marginLeft: "auto", flexShrink: 0 }}>
          ✕
        </button>
      )}
    </label>
  );
}

/** Collapsible accordion group with active-override count badge. */
function OverrideGroup({
  title, children, defaultOpen = false, activeCount = 0,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; activeCount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);

  // Auto-open when overrides become active.
  useEffect(() => {
    if (activeCount > 0) setOpen(true);
  }, [activeCount]);

  return (
    <div style={{ marginBottom: 5, border: "1px solid", borderRadius: 6, overflow: "hidden",
      borderColor: activeCount > 0 ? "#c7d2fe" : "#e5e7eb" }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "5px 9px", background: activeCount > 0 ? "#eef2ff" : "#f8fafc",
          border: "none", cursor: "pointer", fontSize: 11,
          fontWeight: activeCount > 0 ? 700 : 600,
          color: activeCount > 0 ? "#4f46e5" : "#374151",
        }}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {activeCount > 0 && (
            <span style={{ background: "#6366f1", color: "#fff", borderRadius: 99,
              fontSize: 10, fontWeight: 700, padding: "0 5px", lineHeight: "16px" }}>
              {activeCount}
            </span>
          )}
          <span style={{ fontSize: 10, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: "9px 9px 3px", background: "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select row backed by a small scrollable checkbox list.
 * Stores selected values as a comma-joined string (matching audienceSegmentIds format).
 * value="" means "no override" (show real evaluated segments).
 */
function MultiSelectRow({
  label, hint, value, options, onChange,
}: {
  label: string; hint?: string;
  /** Current comma-joined value, "" = no override */
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string | null | undefined) => void;
}) {
  const selected = value ? value.split(",").filter(Boolean) : [];
  const active   = selected.length > 0;

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    onChange(next.length > 0 ? next.join(",") : undefined);
  }

  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 2 }}>
        <label style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</label>
        {active && (
          <button onClick={() => onChange(undefined)}
            style={{ fontSize: 10, color: "#9ca3af", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}>
            ✕ reset
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{hint}</div>}
      {options.length === 0 ? (
        <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
          No active segments defined for this tenant.
        </div>
      ) : (
        <div style={{
          maxHeight: 120, overflowY: "auto", border: "1px solid",
          borderColor: active ? "#c7d2fe" : "#e5e7eb",
          borderRadius: 5, padding: "4px 6px",
          background: active ? "#eef2ff" : "#fff",
        }}>
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label key={o.value} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, padding: "2px 0", cursor: "pointer",
                color: checked ? "#4f46e5" : "#374151",
                fontWeight: checked ? 600 : 400,
              }}>
                <input type="checkbox" checked={checked}
                  onChange={() => toggle(o.value)}
                  style={{ accentColor: "#6366f1", flexShrink: 0 }}
                />
                <span style={{ lineHeight: 1.3 }}>
                  {o.label}
                  <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4 }}>
                    ({o.value})
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {active && (
        <div style={{ fontSize: 10, color: "#6366f1", marginTop: 3 }}>
          Active: {selected.join(", ")}
        </div>
      )}
    </div>
  );
}

/** Reset section button — only shown when there are active overrides. */
function ResetSection({
  activeCount, onClick,
}: { activeCount: number; onClick: () => void }) {
  if (activeCount === 0) return null;
  return (
    <button onClick={onClick}
      style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none",
        cursor: "pointer", padding: "0 0 5px", display: "block" }}>
      ↩ Reset this section
    </button>
  );
}

// ── Known-lead indicator (ABM) ─────────────────────────────────────────────────
//
// Read-only. Reads the deterministic identity injected by the lead link (the
// httpOnly mc_lead cookie, resolved server-side via /api/abm/known-lead). This is
// NOT a manual override — it shows what the redirect injects live, so it sits
// apart from the editable override sections below.

interface KnownLeadData {
  knownLead: {
    firstName:   string | null;
    name:        string | null;
    company:     string | null;
    role:        string | null;
    industry:    string | null;
    companySize: string | null;
  } | null;
  forcedSegment: string | null;
}

function KnownLeadIndicator() {
  const [data, setData] = useState<KnownLeadData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/abm/known-lead", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: KnownLeadData) => { if (alive) setData(d); })
      .catch(() => { /* fail-open: indicator simply doesn't render */ });
    return () => { alive = false; };
  }, []);

  const kl = data?.knownLead;
  if (!kl) return null;

  const chips: Array<{ label: string; value: string }> = [
    ...(kl.name ? [{ label: "Name", value: kl.name }] : (kl.firstName ? [{ label: "Name", value: kl.firstName }] : [])),
    ...(kl.company     ? [{ label: "Company",  value: kl.company }]     : []),
    ...(kl.role        ? [{ label: "Role",     value: kl.role }]        : []),
    ...(kl.industry    ? [{ label: "Industry", value: kl.industry }]    : []),
    ...(kl.companySize ? [{ label: "Size",     value: kl.companySize }] : []),
  ];

  return (
    <div style={{
      background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 6,
      padding: "8px 10px", marginBottom: 8,
    }}>
      <div style={{ fontWeight: 700, color: "#3730a3", fontSize: 11, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        🎯 Known lead actief
        <span style={{ background: "#4338ca", color: "#fff", borderRadius: 3, padding: "0 5px", fontSize: 9, fontWeight: 600 }}>
          auto via lead-link
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", marginBottom: 6 }}>
        {chips.map((c) => (
          <span key={c.label} style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#3730a3" }}>
            <span style={{ color: "#6366f1" }}>{c.label}:</span> {c.value}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#4338ca" }}>
        Forced segment:{" "}
        {data?.forcedSegment
          ? <code style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 3, padding: "0 4px" }}>{data.forcedSegment}</code>
          : <span style={{ color: "#818cf8", fontStyle: "italic" }}>none linked</span>}
        <span style={{ display: "block", marginTop: 3, color: "#6366f1", fontStyle: "italic" }}>
          Injected server-side from the lead link — not a manual override.
        </span>
      </div>
    </div>
  );
}

// ── Effective Summary strip ───────────────────────────────────────────────────

function EffectiveSummary({ journey, overrides }: {
  journey: JourneyState | null;
  overrides: ScenarioOverrides;
}) {
  if (!journey) return null;

  const company = overrides.companyName ?? null;
  const city    = overrides.city ?? null;
  const crm     = overrides.crmLifecycleStage ?? null;

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb",
      borderRadius: 6, padding: "7px 9px", marginBottom: 8, fontSize: 11 }}>
      <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4, fontSize: 11 }}>
        Effective Context
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {stageBadge(journey.funnelStage)}
        {badge("blue", `intent ${score(journey.intentScore)}`)}
        {badge(journey.confidence.band === "high" || journey.confidence.band === "very_high" ? "green" : "neutral",
          `conf ${pct(journey.confidence.overallConfidence)}`)}
        {company && badge("teal", `🏢 ${company}`)}
        {city && badge("neutral", `📍 ${city}`)}
        {crm && badge("purple", `CRM: ${crm}`)}
        {overrides.isRaining && badge("blue", "🌧 raining")}
        {overrides.targetAccountMatched && badge("amber", "🎯 target acct")}
      </div>
      {overrides.enrichmentPatch && Object.keys(overrides.enrichmentPatch).length > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#6b7280" }}>
          ⚡ Enricher patch active ({Object.keys(overrides.enrichmentPatch).length} fields)
        </div>
      )}
    </div>
  );
}

// ── Action Bar ────────────────────────────────────────────────────────────────

function ActionBar({
  overrides,
  autoApply,
  applying,
  onApply,
  onRestore,
  onToggleAutoApply,
}: {
  overrides:          ScenarioOverrides;
  autoApply:          boolean;
  applying:           boolean;
  onApply:            () => void;
  onRestore:          () => void;
  onToggleAutoApply:  () => void;
}) {
  const overrideCount = Object.keys(overrides).filter(
    (k) => (overrides as Record<string, unknown>)[k] !== undefined
  ).length;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
        <button
          onClick={onApply}
          disabled={applying}
          style={{
            flex: 1, padding: "6px 8px", borderRadius: 6,
            background: applying ? "#c7d2fe" : "#6366f1",
            color: "#fff", border: "none", cursor: applying ? "wait" : "pointer",
            fontSize: 11, fontWeight: 700, transition: "background 150ms",
          }}>
          {applying ? "⏳ Applying…" : `▶ Apply Overrides${overrideCount > 0 ? ` (${overrideCount})` : ""}`}
        </button>
        <button
          onClick={onRestore}
          style={{
            padding: "6px 10px", borderRadius: 6,
            background: "#fee2e2", color: "#dc2626",
            border: "1px solid #fca5a5", cursor: "pointer",
            fontSize: 11, fontWeight: 600,
          }}>
          ⟳ Restore Real
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6,
        fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
        <input type="checkbox" checked={autoApply} onChange={onToggleAutoApply}
          style={{ accentColor: "#6366f1" }} />
        <span>Auto Apply <span style={{ fontSize: 10, color: "#9ca3af" }}>(recomputes on every change)</span></span>
      </label>
    </div>
  );
}

// ── Enricher Actions section ──────────────────────────────────────────────────

function EnricherActionsSection({
  statuses,
  mockMode,
  onRun,
  onToggleMock,
}: {
  statuses:      Record<string, EnricherStatus>;
  mockMode:      boolean;
  onRun:         (key: EnricherKey) => Promise<void>;
  onToggleMock:  () => void;
}) {
  function statusColor(s: EnricherStatus["state"]) {
    if (s === "success") return "#10b981";
    if (s === "error")   return "#ef4444";
    if (s === "running") return "#f59e0b";
    return "#9ca3af";
  }

  function statusLabel(st: EnricherStatus) {
    if (st.state === "running") return "⏳";
    if (st.state === "success") return `✓ ${st.durationMs}ms${st.mockMode ? " (mock)" : " (live)"}`;
    if (st.state === "error")   return `✗ ${st.error ?? "failed"}`;
    return "—";
  }

  const enricherList = [
    ...ENRICHER_REGISTRY.filter((e) => e.key !== "all"),
    { key: "all" as const, label: "Run All Enrichers", description: "Re-runs every enricher in sequence.", icon: "🚀", outputFields: [], mockOutput: {} },
  ];

  return (
    <div style={{ marginTop: 2 }}>
      {/* Mock / Live toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 7 }}>
        <SectionLabel>Enricher Actions</SectionLabel>
        <label style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 10, color: "#6b7280", cursor: "pointer" }}>
          <input type="checkbox" checked={mockMode} onChange={onToggleMock}
            style={{ accentColor: "#6366f1" }} />
          <span style={{ fontWeight: mockMode ? 600 : 400, color: mockMode ? "#4f46e5" : "#6b7280" }}>
            Mock mode
          </span>
        </label>
      </div>

      {!mockMode && (
        <div style={{ padding: "5px 7px", background: "#fff7ed", border: "1px solid #fed7aa",
          borderRadius: 5, fontSize: 10, color: "#9a3412", marginBottom: 7 }}>
          ⚠️ Live mode calls real APIs. Results are stored as scenario overrides only —
          no real user data is modified.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {enricherList.map((enricher) => {
          const st = statuses[enricher.key];
          const isRunning = st?.state === "running";

          return (
            <div key={enricher.key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 8px", borderRadius: 5, border: "1px solid",
              borderColor: st?.state === "success" ? "#a7f3d0"
                : st?.state === "error" ? "#fecaca"
                : "#e5e7eb",
              background: st?.state === "success" ? "#f0fdf4"
                : st?.state === "error" ? "#fff5f5" : "#fff",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
                  {enricher.icon} {enricher.label}
                </div>
                {st && (
                  <div style={{ fontSize: 10, color: statusColor(st.state) }}>
                    {statusLabel(st)}
                  </div>
                )}
              </div>
              <button
                onClick={() => void onRun(enricher.key)}
                disabled={isRunning}
                style={{
                  padding: "3px 9px", borderRadius: 5, border: "none",
                  background: isRunning ? "#e5e7eb" : "#6366f1",
                  color: isRunning ? "#9ca3af" : "#fff",
                  fontSize: 10, fontWeight: 600, cursor: isRunning ? "wait" : "pointer",
                  flexShrink: 0,
                }}>
                {isRunning ? "…" : enricher.key === "all" ? "Run All" : "Re-run"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>
        Re-run results are stored as enrichmentPatch override and applied via Apply Overrides.
        They never modify real visitor data.
      </div>
    </div>
  );
}

// ── Tab 1: Context ────────────────────────────────────────────────────────────

function ContextTab({
  scenario,
  journey,
  autoApply,
  applying,
  onApply,
  onRestore,
  onToggleAutoApply,
  enricherStatuses,
  enricherMockMode,
  onRunEnricher,
  onToggleEnricherMock,
  onResetSession,
  onResetVisitor,
  isResetting = false,
}: {
  scenario:            ScenarioState;
  journey:             JourneyState | null;
  autoApply:           boolean;
  applying:            boolean;
  onApply:             () => void;
  onRestore:           () => void;
  onToggleAutoApply:   () => void;
  enricherStatuses:    Record<string, EnricherStatus>;
  enricherMockMode:    boolean;
  onRunEnricher:       (key: EnricherKey) => Promise<void>;
  onToggleEnricherMock: () => void;
  onResetSession:      () => void;
  /** Phase 5 — true full wipe: clears ALL cookies, entire localStorage, entire sessionStorage. */
  onResetVisitor:      () => void;
  isResetting?:        boolean;
}) {
  const [overrides, setOverrides] = useState<ScenarioOverrides>(scenario.overrides);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Available audience segments (fetched once from /api/segments) ──────────
  const [availableSegments, setAvailableSegments] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetch("/api/segments", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { segments?: { key: string; label: string }[] }) => {
        if (data.segments) {
          setAvailableSegments(data.segments.map((s) => ({ value: s.key, label: s.label })));
        }
      })
      .catch(() => { /* silent — panel still works without segment list */ });
  }, []);

  useEffect(() => { setOverrides(scenario.overrides); }, [scenario]);

  function applyPreset(key: string) {
    const preset = SCENARIO_PRESET_LIST.find((p) => p.key === key);
    if (!preset) return;
    activateScenario(preset.overrides, preset.key, preset.label);
  }

  function patch(p: Partial<ScenarioOverrides>) {
    const next = { ...overrides, ...p };
    // Remove undefined keys so the cookie stays clean.
    for (const k of Object.keys(next) as (keyof ScenarioOverrides)[]) {
      if (next[k] === undefined) delete (next as Record<string, unknown>)[k];
    }
    setOverrides(next);
    patchScenarioOverride(p);
  }

  function clearManual() {
    setOverrides({});
    clearScenario();
  }

  function resetSection(keys: (keyof ScenarioOverrides)[]) {
    const reset: Partial<ScenarioOverrides> = {};
    for (const k of keys) reset[k] = undefined;
    patch(reset);
  }

  const countActive = (keys: (keyof ScenarioOverrides)[]) =>
    keys.filter((k) => (overrides as Record<string, unknown>)[k] !== undefined).length;

  // ── Key groups ──────────────────────────────────────────────────────────────
  const requestKeys:   (keyof ScenarioOverrides)[] = ["visitType", "device", "source", "utmSource", "utmMedium", "utmCampaign"];
  const geoKeys:       (keyof ScenarioOverrides)[] = ["countryCode", "region", "city", "latitude", "longitude"];
  const networkKeys:   (keyof ScenarioOverrides)[] = ["ipAddress", "networkOrg", "ipVersion", "isCloudProvider"];
  const companyKeys:   (keyof ScenarioOverrides)[] = ["companyName", "companyDomain", "companyIndustry", "companySize"];
  const adsKeys:       (keyof ScenarioOverrides)[] = ["adCampaign", "adAdGroup", "adKeyword"];
  const crmKeys:       (keyof ScenarioOverrides)[] = ["crmMatched", "crmLifecycleStage", "crmDealStage", "crmSegment"];
  const abmKeys:       (keyof ScenarioOverrides)[] = ["targetAccountMatched", "targetAccountTier"];
  const weatherKeys:   (keyof ScenarioOverrides)[] = ["weatherCode", "temperatureNow", "isRaining", "windSpeed"];
  const timeKeys:      (keyof ScenarioOverrides)[] = ["currentHour", "dayOfWeek", "isWeekend", "month", "dateKey", "timeOfDay", "seasonalEvent"];
  const interestKeys:  (keyof ScenarioOverrides)[] = ["interestPrimary", "interestSecondary", "interestConfidence"];
  const behaviorKeys:  (keyof ScenarioOverrides)[] = [
    "funnelStage", "intentScore", "frictionScore", "overallConfidence",
    "hasVisitedPricing", "hasVisitedAbout", "hasVisitedCases", "hasVisitedContact",
    "hasClickedCta", "hasStartedForm", "hasSubmittedForm", "matchedSequences", "pageViewCount",
  ];
  const lifecycleKeys: (keyof ScenarioOverrides)[] = ["isCustomer", "planTier"];
  const segmentKeys:   (keyof ScenarioOverrides)[] = ["audienceSegmentIds"];
  const batchKeys:     (keyof ScenarioOverrides)[] = ["enrichmentPatch"];

  const totalOverrides = Object.keys(overrides).filter(
    (k) => (overrides as Record<string, unknown>)[k] !== undefined
  ).length;

  return (
    <div>
      {/* ── Quick Presets ──────────────────────────────────────────────────── */}
      <SectionLabel>Quick Presets</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 3 }}>
        {SCENARIO_PRESET_LIST.map((preset) => {
          const active = scenario.presetKey === preset.key;
          return (
            <button key={preset.key} onClick={() => applyPreset(preset.key)}
              title={preset.description}
              style={{
                padding: "4px 7px", borderRadius: 5, border: "1px solid",
                borderColor: active ? "#6366f1" : "#e5e7eb",
                background: active ? "#eef2ff" : "#fff",
                color: active ? "#4f46e5" : "#374151",
                fontSize: 10, fontWeight: active ? 700 : 500,
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 4,
              }}>
              <span style={{ fontSize: 12 }}>{preset.icon}</span>
              <span style={{ lineHeight: 1.2 }}>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {scenario.active && scenario.presetKey && (
        <button onClick={clearScenario}
          style={{ width: "100%", marginTop: 2, padding: "3px 8px",
            background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5",
            borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
          ✕ Exit "{scenario.label ?? scenario.presetKey}"
        </button>
      )}

      <Divider />

      {/* ── Action Bar ────────────────────────────────────────────────────── */}
      <ActionBar
        overrides={overrides}
        autoApply={autoApply}
        applying={applying}
        onApply={onApply}
        onRestore={onRestore}
        onToggleAutoApply={onToggleAutoApply}
      />

      {/* ── ABM known-lead (read-only, live from the lead link) ───────────── */}
      <KnownLeadIndicator />

      {/* ── Effective Summary ─────────────────────────────────────────────── */}
      <EffectiveSummary journey={journey} overrides={overrides} />

      {/* ── Override header ───────────────────────────────────────────────── */}
      {totalOverrides > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            {totalOverrides} field{totalOverrides !== 1 ? "s" : ""} overridden
          </span>
          <button onClick={clearManual}
            style={{ fontSize: 10, color: "#ef4444", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}>
            clear all
          </button>
        </div>
      )}

      {/* ── Request ───────────────────────────────────────────────────────── */}
      <OverrideGroup title="🌐 Request" activeCount={countActive(requestKeys)}>
        <DropdownRow label="Visit Type"
          hint="new = first-touch · returning = repeat session"
          value={overrides.visitType ?? ""}
          options={[
            { value: "new",       label: "new — first-touch" },
            { value: "returning", label: "returning — repeat" },
          ]}
          onChange={(v) => patch({ visitType: (v as ScenarioOverrides["visitType"]) ?? undefined })}
        />
        <DropdownRow label="Device Type"
          hint="Simulates mobile vs. desktop device detection"
          value={overrides.device ?? ""}
          options={[
            { value: "mobile",  label: "mobile" },
            { value: "desktop", label: "desktop" },
          ]}
          onChange={(v) => patch({ device: (v as ScenarioOverrides["device"]) ?? undefined })}
        />
        <DropdownRow label="Traffic Source"
          hint="Detected channel — drives source-based rules"
          value={overrides.source ?? ""}
          options={[
            { value: "linkedin", label: "LinkedIn" },
            { value: "google",   label: "Google" },
            { value: "direct",   label: "Direct" },
            { value: "unknown",  label: "Unknown" },
          ]}
          onChange={(v) => patch({ source: (v as ScenarioOverrides["source"]) ?? undefined })}
        />
        <TextRow label="UTM Source" hint="utm_source, e.g. google, newsletter"
          value={overrides.utmSource ?? ""}
          onChange={(v) => patch({ utmSource: v ?? undefined })} />
        <TextRow label="UTM Medium" hint="utm_medium, e.g. cpc, email"
          value={overrides.utmMedium ?? ""}
          onChange={(v) => patch({ utmMedium: v ?? undefined })} />
        <TextRow label="UTM Campaign" hint="utm_campaign, e.g. brand-search, q2-launch"
          value={overrides.utmCampaign ?? ""}
          onChange={(v) => patch({ utmCampaign: v ?? undefined })} />
        <ResetSection activeCount={countActive(requestKeys)}
          onClick={() => resetSection(requestKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — Geo ─────────────────────────────────────────────── */}
      <OverrideGroup title="📍 Enrichment — Geo" activeCount={countActive(geoKeys)}>
        <DropdownRow label="Country Code"
          hint="ISO 3166-1 alpha-2, e.g. NL, US, DE"
          value={overrides.countryCode ?? ""}
          options={[
            { value: "NL", label: "NL — Netherlands" },
            { value: "DE", label: "DE — Germany" },
            { value: "BE", label: "BE — Belgium" },
            { value: "GB", label: "GB — United Kingdom" },
            { value: "US", label: "US — United States" },
            { value: "FR", label: "FR — France" },
          ]}
          onChange={(v) => patch({ countryCode: v ?? undefined })}
        />
        <TextRow label="Region"
          hint="State / province, e.g. Noord-Holland, Bavaria"
          value={overrides.region ?? ""}
          placeholder="e.g. Noord-Holland"
          onChange={(v) => patch({ region: v ?? undefined })} />
        <TextRow label="City"
          hint="City from geo IP enrichment"
          value={overrides.city ?? ""}
          placeholder="e.g. Amsterdam"
          onChange={(v) => patch({ city: v ?? undefined })} />
        <NumericRow label="Latitude" hint="City-level precision, e.g. 52.37"
          value={overrides.latitude !== undefined && overrides.latitude !== null ? String(overrides.latitude) : ""}
          placeholder="e.g. 52.37" min={-90} max={90} step={0.01}
          onChange={(v) => patch({ latitude: v ?? undefined })} />
        <NumericRow label="Longitude"
          value={overrides.longitude !== undefined && overrides.longitude !== null ? String(overrides.longitude) : ""}
          placeholder="e.g. 4.89" min={-180} max={180} step={0.01}
          onChange={(v) => patch({ longitude: v ?? undefined })} />
        <ResetSection activeCount={countActive(geoKeys)}
          onClick={() => resetSection(geoKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — Network / IP ─────────────────────────────────────── */}
      <OverrideGroup title="🔌 Enrichment — Network / IP" activeCount={countActive(networkKeys)}>
        <TextRow label="IP Address"
          hint="Override the visitor IP shown in context / used for enrichment re-run"
          value={overrides.ipAddress ?? ""}
          placeholder="e.g. 85.148.0.1"
          onChange={(v) => patch({ ipAddress: v ?? undefined })} />
        <TextRow label="Network Org"
          hint="ISP / organization from ASN, e.g. Google LLC, ASML"
          value={overrides.networkOrg ?? ""}
          placeholder="e.g. Amsterdam Internet Exchange"
          onChange={(v) => patch({ networkOrg: v ?? undefined })} />
        <DropdownRow label="IP Version"
          value={overrides.ipVersion ?? ""}
          options={[
            { value: "ipv4", label: "IPv4" },
            { value: "ipv6", label: "IPv6" },
          ]}
          onChange={(v) => patch({ ipVersion: (v as "ipv4" | "ipv6") || undefined })}
        />
        <CheckRow label="Is Cloud Provider"
          hint="True = skip company lookup (CDN / datacenter IP)"
          value={overrides.isCloudProvider === null ? undefined : overrides.isCloudProvider}
          onChange={(v) => patch({ isCloudProvider: v })} />
        <ResetSection activeCount={countActive(networkKeys)}
          onClick={() => resetSection(networkKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — Company ──────────────────────────────────────────── */}
      <OverrideGroup title="🏢 Enrichment — Company" activeCount={countActive(companyKeys)}>
        <TextRow label="Company Name" hint="From reverse-IP lookup, e.g. Acme BV"
          value={overrides.companyName ?? ""} placeholder="e.g. ASML"
          onChange={(v) => patch({ companyName: v ?? undefined })} />
        <TextRow label="Company Domain"
          value={overrides.companyDomain ?? ""} placeholder="e.g. asml.com"
          onChange={(v) => patch({ companyDomain: v ?? undefined })} />
        <DropdownRow label="Industry"
          value={overrides.companyIndustry ?? ""}
          options={[
            { value: "Software",              label: "Software" },
            { value: "Financial Services",    label: "Financial Services" },
            { value: "Semiconductor Equipment", label: "Semiconductor Equipment" },
            { value: "Healthcare",            label: "Healthcare" },
            { value: "Manufacturing",         label: "Manufacturing" },
            { value: "Logistics",             label: "Logistics" },
            { value: "Consulting",            label: "Consulting" },
            { value: "Retail",               label: "Retail" },
          ]}
          onChange={(v) => patch({ companyIndustry: v ?? undefined })}
        />
        <DropdownRow label="Company Size"
          value={overrides.companySize ?? ""}
          options={[
            { value: "1-10",       label: "1–10 employees" },
            { value: "11-50",      label: "11–50 employees" },
            { value: "51-200",     label: "51–200 employees" },
            { value: "201-1000",   label: "201–1000 employees" },
            { value: "1001-5000",  label: "1001–5000 employees" },
            { value: "5001+",      label: "5001+ employees" },
          ]}
          onChange={(v) => patch({ companySize: v ?? undefined })}
        />
        <ResetSection activeCount={countActive(companyKeys)}
          onClick={() => resetSection(companyKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — Ads ─────────────────────────────────────────────── */}
      <OverrideGroup title="📢 Enrichment — Ads" activeCount={countActive(adsKeys)}>
        <TextRow label="Ad Campaign" hint="Campaign name / ID, e.g. brand-search-nl"
          value={overrides.adCampaign ?? ""} placeholder="e.g. brand-search-nl"
          onChange={(v) => patch({ adCampaign: v ?? undefined })} />
        <TextRow label="Ad Group"
          value={overrides.adAdGroup ?? ""} placeholder="e.g. mister-chameleon-brand"
          onChange={(v) => patch({ adAdGroup: v ?? undefined })} />
        <TextRow label="Ad Keyword"
          value={overrides.adKeyword ?? ""} placeholder="e.g. personalisatie platform"
          onChange={(v) => patch({ adKeyword: v ?? undefined })} />
        <ResetSection activeCount={countActive(adsKeys)}
          onClick={() => resetSection(adsKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — CRM ─────────────────────────────────────────────── */}
      <OverrideGroup title="📊 Enrichment — CRM" activeCount={countActive(crmKeys)}>
        <CheckRow label="CRM Matched"
          hint="True = a CRM record exists for this visitor"
          value={overrides.crmMatched === null ? undefined : overrides.crmMatched}
          onChange={(v) => patch({ crmMatched: v })} />
        <DropdownRow label="Lifecycle Stage"
          value={overrides.crmLifecycleStage ?? ""}
          options={[
            { value: "subscriber",   label: "Subscriber" },
            { value: "lead",         label: "Lead" },
            { value: "mql",          label: "MQL" },
            { value: "sql",          label: "SQL" },
            { value: "opportunity",  label: "Opportunity" },
            { value: "customer",     label: "Customer" },
            { value: "evangelist",   label: "Evangelist" },
          ]}
          onChange={(v) => patch({ crmLifecycleStage: v ?? undefined })}
        />
        <DropdownRow label="Deal Stage"
          value={overrides.crmDealStage ?? ""}
          options={[
            { value: "discovery",     label: "Discovery" },
            { value: "proposal",      label: "Proposal" },
            { value: "negotiation",   label: "Negotiation" },
            { value: "closed_won",    label: "Closed Won" },
            { value: "closed_lost",   label: "Closed Lost" },
          ]}
          onChange={(v) => patch({ crmDealStage: v ?? undefined })}
        />
        <TextRow label="CRM Segment"
          hint="Marketing segment, e.g. enterprise-prospect"
          value={overrides.crmSegment ?? ""} placeholder="e.g. enterprise-prospect"
          onChange={(v) => patch({ crmSegment: v ?? undefined })} />
        <ResetSection activeCount={countActive(crmKeys)}
          onClick={() => resetSection(crmKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — ABM / Account List ──────────────────────────────── */}
      <OverrideGroup title="🎯 Enrichment — ABM" activeCount={countActive(abmKeys)}>
        <CheckRow label="Target Account Matched"
          hint="True = visitor company is on a target account list"
          value={overrides.targetAccountMatched === null ? undefined : overrides.targetAccountMatched}
          onChange={(v) => patch({ targetAccountMatched: v })} />
        <DropdownRow label="Account Tier"
          value={overrides.targetAccountTier ?? ""}
          options={[
            { value: "tier-1", label: "Tier 1 — Named accounts" },
            { value: "tier-2", label: "Tier 2 — ICP match" },
            { value: "tier-3", label: "Tier 3 — Broad target" },
          ]}
          onChange={(v) => patch({ targetAccountTier: v ?? undefined })}
        />
        <ResetSection activeCount={countActive(abmKeys)}
          onClick={() => resetSection(abmKeys)} />
      </OverrideGroup>

      {/* ── Enrichment — Weather ─────────────────────────────────────────── */}
      <OverrideGroup title="🌤 Enrichment — Weather" activeCount={countActive(weatherKeys)}>
        <DropdownRow label="Weather Code (WMO)"
          hint="0=clear, 1-3=partly cloudy, 51-67=rain, 71-77=snow, 95+=thunder"
          value={overrides.weatherCode !== undefined && overrides.weatherCode !== null ? String(overrides.weatherCode) : ""}
          options={[
            { value: "0",  label: "0 — Clear sky" },
            { value: "1",  label: "1 — Mainly clear" },
            { value: "2",  label: "2 — Partly cloudy" },
            { value: "3",  label: "3 — Overcast" },
            { value: "51", label: "51 — Light drizzle" },
            { value: "61", label: "61 — Slight rain" },
            { value: "63", label: "63 — Moderate rain" },
            { value: "71", label: "71 — Light snow" },
            { value: "95", label: "95 — Thunderstorm" },
          ]}
          onChange={(v) => patch({ weatherCode: v ? Number(v) : undefined })}
        />
        <NumericRow label="Temperature (°C)"
          value={overrides.temperatureNow !== undefined && overrides.temperatureNow !== null ? String(overrides.temperatureNow) : ""}
          placeholder="e.g. 12" min={-30} max={45} step={0.5}
          onChange={(v) => patch({ temperatureNow: v ?? undefined })} />
        <CheckRow label="Is Raining"
          hint="True = active precipitation (rain, drizzle, snow)"
          value={overrides.isRaining === null ? undefined : overrides.isRaining}
          onChange={(v) => patch({ isRaining: v })} />
        <NumericRow label="Wind Speed (km/h)"
          value={overrides.windSpeed !== undefined && overrides.windSpeed !== null ? String(overrides.windSpeed) : ""}
          placeholder="e.g. 18" min={0} max={120} step={1}
          onChange={(v) => patch({ windSpeed: v ?? undefined })} />
        <ResetSection activeCount={countActive(weatherKeys)}
          onClick={() => resetSection(weatherKeys)} />
      </OverrideGroup>

      {/* ── Time / Temporal Context ──────────────────────────────────────── */}
      <OverrideGroup title="🕐 Time / Temporal" activeCount={countActive(timeKeys)}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6, lineHeight: 1.4 }}>
          Overrides use tenant local time. Changing any field automatically
          recomputes daySegment, isWorkHours, season, and isHoliday.
        </div>
        <NumericRow label="Current Hour (0–23)"
          hint="Hour of day in tenant local time — drives timeOfDay + daySegment"
          value={overrides.currentHour !== undefined && overrides.currentHour !== null ? String(overrides.currentHour) : ""}
          placeholder="0–23"
          min={0} max={23} step={1}
          onChange={(v) => {
            const h = v ?? undefined;
            // Auto-derive isWeekend and timeOfDay hints (user can still override)
            const todBucket: ScenarioOverrides["timeOfDay"] =
              h === undefined ? undefined :
              h >= 6  && h < 12 ? "morning"   :
              h >= 12 && h < 18 ? "afternoon" :
              h >= 18 && h < 22 ? "evening"   : "night";
            patch({ currentHour: h, ...(h !== undefined && overrides.timeOfDay === undefined ? { timeOfDay: todBucket } : {}) });
          }}
        />
        <DropdownRow label="Day of Week"
          hint="Drives isWeekend, daySegment, and isWorkHours"
          value={overrides.dayOfWeek ?? ""}
          options={[
            { value: "monday",    label: "Monday" },
            { value: "tuesday",   label: "Tuesday" },
            { value: "wednesday", label: "Wednesday" },
            { value: "thursday",  label: "Thursday" },
            { value: "friday",    label: "Friday" },
            { value: "saturday",  label: "Saturday" },
            { value: "sunday",    label: "Sunday" },
          ]}
          onChange={(v) => {
            const day = (v as ScenarioOverrides["dayOfWeek"]) ?? undefined;
            const weekend = day === "saturday" || day === "sunday" ? true :
                            day ? false : undefined;
            patch({ dayOfWeek: day, ...(day && overrides.isWeekend === undefined ? { isWeekend: weekend } : {}) });
          }}
        />
        <CheckRow label="Is Weekend"
          hint="Drives isWorkHours — auto-set when Day of Week is Saturday/Sunday"
          value={overrides.isWeekend === null ? undefined : overrides.isWeekend}
          onChange={(v) => patch({ isWeekend: v })} />
        <DropdownRow label="Time of Day"
          hint="morning 06–11 · afternoon 12–17 · evening 18–21 · night 22–05"
          value={overrides.timeOfDay ?? ""}
          options={[
            { value: "morning",   label: "Morning (06:00–11:59)" },
            { value: "afternoon", label: "Afternoon (12:00–17:59)" },
            { value: "evening",   label: "Evening (18:00–21:59)" },
            { value: "night",     label: "Night (22:00–05:59)" },
          ]}
          onChange={(v) => patch({ timeOfDay: (v as ScenarioOverrides["timeOfDay"]) ?? undefined })}
        />
        <DropdownRow label="Month (1–12)"
          hint="Drives season (spring/summer/autumn/winter)"
          value={overrides.month !== undefined && overrides.month !== null ? String(overrides.month) : ""}
          options={[
            { value: "1",  label: "January" },
            { value: "2",  label: "February" },
            { value: "3",  label: "March" },
            { value: "4",  label: "April" },
            { value: "5",  label: "May" },
            { value: "6",  label: "June" },
            { value: "7",  label: "July" },
            { value: "8",  label: "August" },
            { value: "9",  label: "September" },
            { value: "10", label: "October" },
            { value: "11", label: "November" },
            { value: "12", label: "December" },
          ]}
          onChange={(v) => patch({ month: v ? Number(v) : undefined })}
        />
        <TextRow label="Date Key (YYYY-MM-DD)"
          hint="Override the exact calendar date"
          value={overrides.dateKey ?? ""}
          placeholder="e.g. 2025-12-25"
          onChange={(v) => {
            // Auto-fill month and isWeekend from date key when possible
            const dateKey = v ?? undefined;
            const extra: Partial<ScenarioOverrides> = {};
            if (dateKey) {
              const d = new Date(dateKey);
              if (!isNaN(d.getTime())) {
                if (overrides.month === undefined) extra.month = d.getMonth() + 1;
                if (overrides.isWeekend === undefined) {
                  const dow = d.getDay(); // 0=Sun, 6=Sat
                  extra.isWeekend = dow === 0 || dow === 6;
                }
              }
            }
            patch({ dateKey, ...extra });
          }}
        />
        <DropdownRow label="Seasonal Event"
          hint="Active marketing holiday — drives isHoliday flag"
          value={overrides.seasonalEvent ?? ""}
          options={[
            { value: "none",           label: "None — regular day" },
            { value: "new-year",       label: "New Year" },
            { value: "valentines",     label: "Valentine's Day" },
            { value: "easter",         label: "Easter" },
            { value: "back-to-school", label: "Back to School" },
            { value: "halloween",      label: "Halloween" },
            { value: "black-friday",   label: "Black Friday" },
            { value: "cyber-monday",   label: "Cyber Monday" },
            { value: "christmas",      label: "Christmas" },
          ]}
          onChange={(v) => patch({ seasonalEvent: (v as ScenarioOverrides["seasonalEvent"]) ?? undefined })}
        />
        <ResetSection activeCount={countActive(timeKeys)}
          onClick={() => resetSection(timeKeys)} />
      </OverrideGroup>

      {/* ── History / Interests ───────────────────────────────────────────── */}
      <OverrideGroup title="🎯 History / Interests" activeCount={countActive(interestKeys)}>
        <TextRow label="Primary Interest"
          hint="Profile key with highest score, e.g. logistics, hr-tech"
          value={overrides.interestPrimary ?? ""}
          placeholder="e.g. enterprise_personalization"
          onChange={(v) => patch({ interestPrimary: v ?? undefined })} />
        <TextRow label="Secondary Interest"
          value={overrides.interestSecondary ?? ""}
          placeholder="e.g. warehousing"
          onChange={(v) => patch({ interestSecondary: v ?? undefined })} />
        <SliderRow
          label={`Interest Confidence ${overrides.interestConfidence !== undefined ? `(${Math.round(overrides.interestConfidence * 100)}%)` : "(— real —)"}`}
          value={Math.round((overrides.interestConfidence ?? 0) * 100)}
          min={0} max={100} step={5}
          onChange={(v) => patch({ interestConfidence: v === 0 && overrides.interestConfidence === undefined ? undefined : v / 100 })}
          color="#8b5cf6"
        />
        <ResetSection activeCount={countActive(interestKeys)}
          onClick={() => resetSection(interestKeys)} />
      </OverrideGroup>

      {/* ── Behavior ─────────────────────────────────────────────────────── */}
      <OverrideGroup title="📊 Behavior" defaultOpen={true} activeCount={countActive(behaviorKeys)}>
        <DropdownRow label="Funnel Stage"
          value={overrides.funnelStage ?? ""}
          options={[
            { value: "awareness",     label: "awareness" },
            { value: "consideration", label: "consideration" },
            { value: "intent",        label: "intent" },
            { value: "high_intent",   label: "high intent" },
            { value: "customer",      label: "customer" },
          ]}
          onChange={(v) => patch({ funnelStage: (v as ScenarioOverrides["funnelStage"]) ?? undefined })}
        />
        <SliderRow label="Intent Score" value={overrides.intentScore ?? 0}
          min={0} max={100} step={5}
          onChange={(v) => patch({ intentScore: v || undefined })} color="#f59e0b" />
        <SliderRow label="Friction Score" value={overrides.frictionScore ?? 0}
          min={0} max={100} step={5}
          onChange={(v) => patch({ frictionScore: v || undefined })} color="#ef4444" />
        <SliderRow label="Overall Confidence"
          value={Math.round((overrides.overallConfidence ?? 0) * 100)}
          min={0} max={100} step={5}
          onChange={(v) => patch({ overallConfidence: v ? v / 100 : undefined })} color="#10b981" />
        <NumericRow label="Page View Count"
          value={overrides.pageViewCount !== undefined ? String(overrides.pageViewCount) : ""}
          placeholder="e.g. 4" min={0} max={999} step={1}
          onChange={(v) => patch({ pageViewCount: v ?? undefined })} />

        <div style={{ marginTop: 6, marginBottom: 3 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 4 }}>
            Page Flags
          </div>
          {([
            ["hasVisitedPricing", "Visited Pricing",  "/pricing page visited"],
            ["hasVisitedAbout",   "Visited About",    "/about page visited"],
            ["hasVisitedCases",   "Visited Cases",    "/cases or case studies page"],
            ["hasVisitedContact", "Visited Contact",  "/contact page visited"],
            ["hasClickedCta",     "Clicked CTA",      "clicked a main CTA button"],
            ["hasStartedForm",    "Started Form",     "opened a form (formStartCount > 0)"],
            ["hasSubmittedForm",  "Submitted Form",   "completed form submission"],
          ] as const).map(([field, label, hint]) => (
            <CheckRow key={field} label={label} hint={hint}
              value={overrides[field]}
              onChange={(v) => patch({ [field]: v } as Partial<ScenarioOverrides>)} />
          ))}
        </div>
        <ResetSection activeCount={countActive(behaviorKeys)}
          onClick={() => resetSection(behaviorKeys)} />
      </OverrideGroup>

      {/* ── Lifecycle / Customer ─────────────────────────────────────────── */}
      <OverrideGroup title="👤 Lifecycle / Customer" activeCount={countActive(lifecycleKeys)}>
        <CheckRow label="Is Customer"
          hint="Forces customer-mode rules and post-conversion CTAs"
          value={overrides.isCustomer}
          onChange={(v) => patch({ isCustomer: v })} />
        <DropdownRow label="Plan Tier"
          hint="Active subscription — used by tier-based rules"
          value={overrides.planTier ?? ""}
          options={[
            { value: "starter", label: "Starter" },
            { value: "growth",  label: "Growth" },
            { value: "pro",     label: "Pro" },
          ]}
          onChange={(v) => patch({ planTier: v ?? undefined })}
        />
        <ResetSection activeCount={countActive(lifecycleKeys)}
          onClick={() => resetSection(lifecycleKeys)} />
      </OverrideGroup>

      {/* ── Audience Segments ────────────────────────────────────────────── */}
      <OverrideGroup title="🎯 Audience Segments" activeCount={countActive(segmentKeys)}>
        <MultiSelectRow
          label="Active Segments"
          hint="Override which audience segments are matched. Bypasses real-time evaluation — use to test segment-specific rules without needing the right visitor signals."
          value={overrides.audienceSegmentIds ?? ""}
          options={availableSegments}
          onChange={(v) => patch({ audienceSegmentIds: v === undefined ? undefined : (v ?? null) })}
        />
        <ResetSection activeCount={countActive(segmentKeys)}
          onClick={() => resetSection(segmentKeys)} />
      </OverrideGroup>

      <Divider />

      {/* ── Enricher Actions ─────────────────────────────────────────────── */}
      <EnricherActionsSection
        statuses={enricherStatuses}
        mockMode={enricherMockMode}
        onRun={onRunEnricher}
        onToggleMock={onToggleEnricherMock}
      />

      <Divider />

      {/* ── Advanced / Raw ─────────────────────────────────────────────────── */}
      <div>
        <button onClick={() => setShowAdvanced((v) => !v)}
          style={{ fontSize: 10, color: "#9ca3af", background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}>
          {showAdvanced ? "▲" : "▼"} Advanced / Raw JSON
        </button>
        {showAdvanced && (
          <pre style={{ fontSize: 9, background: "#f8fafc", borderRadius: 5,
            padding: "7px 9px", overflowX: "auto", margin: 0,
            border: "1px solid #e5e7eb", maxHeight: 200, overflowY: "auto",
            color: "#374151", lineHeight: 1.5 }}>
            {JSON.stringify(overrides, null, 2)}
          </pre>
        )}
      </div>

      <Divider />

      {/* ── Debug Reset ────────────────────────────────────────────────────── */}
      <OverrideGroup title="🔄 Debug Reset" defaultOpen={false} activeCount={0}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, lineHeight: 1.5 }}>
          Reset the current browser session to simulate a clean first visit.
          Does <em>not</em> modify real visitor data.
        </div>

        {/* Reset scenario overrides only */}
        <button onClick={onRestore}
          style={{
            width: "100%", marginBottom: 6, padding: "6px 10px",
            background: "#f1f5f9", color: "#374151",
            border: "1px solid #e5e7eb", borderRadius: 6,
            fontSize: 10, fontWeight: 600, cursor: "pointer",
            textAlign: "left", display: "flex", alignItems: "center", gap: 6,
          }}>
          <span style={{ fontSize: 13 }}>🎭</span>
          <span>
            <strong>Reset scenario overrides</strong>
            <span style={{ display: "block", fontWeight: 400, color: "#9ca3af" }}>
              Clears all overrides — reverts to real behavioral data
            </span>
          </span>
        </button>

        {/* Reset website session */}
        <button onClick={isResetting ? undefined : onResetSession}
          disabled={isResetting}
          style={{
            width: "100%", marginBottom: 6, padding: "6px 10px",
            background: isResetting ? "#fef9c3" : "#fffbeb", color: "#92400e",
            border: "1px solid #fde68a", borderRadius: 6,
            fontSize: 10, fontWeight: 600,
            cursor: isResetting ? "not-allowed" : "pointer",
            textAlign: "left", display: "flex", alignItems: "center", gap: 6,
            opacity: isResetting ? 0.7 : 1,
          }}>
          <span style={{ fontSize: 13 }}>{isResetting ? "⏳" : "🔁"}</span>
          <span>
            <strong>{isResetting ? "Resetting…" : "Reset website session"}</strong>
            <span style={{ display: "block", fontWeight: 400, color: "#b45309" }}>
              {isResetting
                ? "Clearing session state — reloading…"
                : "Clears session, journey events, collector flags, and all session cookies — simulates a new visit"}
            </span>
          </span>
        </button>

        {/* Reset session + visitor identity — Phase 5 true full wipe */}
        <button onClick={isResetting ? undefined : onResetVisitor}
          disabled={isResetting}
          style={{
            width: "100%", padding: "6px 10px",
            background: isResetting ? "#ffe4e6" : "#fff1f2", color: "#9f1239",
            border: "1px solid #fecdd3", borderRadius: 6,
            fontSize: 10, fontWeight: 600,
            cursor: isResetting ? "not-allowed" : "pointer",
            textAlign: "left", display: "flex", alignItems: "center", gap: 6,
            opacity: isResetting ? 0.7 : 1,
          }}>
          <span style={{ fontSize: 13 }}>{isResetting ? "⏳" : "🧹"}</span>
          <span>
            <strong>{isResetting ? "Full wipe in progress…" : "Reset session + visitor identity"}</strong>
            <span style={{ display: "block", fontWeight: 400, color: "#be123c" }}>
              {isResetting
                ? "Clearing all cookies, storage & caches — reloading…"
                : "True full wipe — ALL cookies, ALL localStorage, ALL sessionStorage. Simulates brand new first-time visitor."}
            </span>
          </span>
        </button>
      </OverrideGroup>
    </div>
  );
}

// ── Tab 2: Why This Experience ────────────────────────────────────────────────

function humanFunnelReason(j: JourneyState): string {
  if (j.hasSubmittedForm) return "submitted the contact form — conversion confirmed.";
  if (j.funnelStage === "high_intent") {
    const parts: string[] = [];
    if (j.hasVisitedPricing)   parts.push("visited pricing");
    if (j.hasClickedCta)       parts.push("clicked the main CTA");
    if (j.formStartCount > 0)  parts.push("started a form");
    if (j.matchedSequences.length > 0) parts.push(`matched ${j.matchedSequences.length} sequence(s)`);
    return parts.length > 0 ? `${parts.join(", ")}.` : "high intent score and strong engagement.";
  }
  if (j.funnelStage === "intent") {
    const parts: string[] = [];
    if (j.hasVisitedPricing) parts.push("visited pricing");
    if (j.intentScore >= 30)  parts.push(`intent score ${score(j.intentScore)}`);
    return parts.length > 0 ? `${parts.join(", ")}.` : "reached the intent threshold.";
  }
  if (j.funnelStage === "consideration") {
    const parts: string[] = [];
    if (j.hasVisitedAbout)   parts.push("explored the About page");
    if (j.hasVisitedCases)   parts.push("read case studies");
    if (j.pageViewCount >= 3) parts.push(`${j.pageViewCount} page views`);
    return parts.length > 0 ? `${parts.join(", ")}.` : "enough engagement for consideration.";
  }
  return "not enough behavioral signals yet.";
}

function humanConfidenceReason(j: JourneyState): string[] {
  const r: string[] = [];
  if (j.confidence.band === "low")      r.push("Not enough diverse signals yet");
  if (j.confidence.band === "medium")   r.push("Some signals but no confirmed intent");
  if (j.confidence.band === "high")     r.push("Strong signals across multiple dimensions");
  if (j.confidence.band === "very_high") r.push("Conversion confirmed or maximum signals reached");
  if (j.frictionScore > 50)             r.push(`High friction (${score(j.frictionScore)}) suppressing confidence`);
  if (j.signalDiversityScore < 0.2)     r.push("Low signal diversity — only one type of action seen");
  if (j.repeatSessionBonus > 0.4)       r.push("Return visit — stronger confidence base");
  return r;
}

function humanGatingExplanation(j: JourneyState) {
  const gating = gateAdaptiveDecisions(j.confidence, j);
  const allowed: Array<{ slot: string; label: string }> = [];
  const blocked: Array<{ slot: string; label: string; reason: string }> = [];
  if (gating.cta)   allowed.push({ slot: "cta",   label: "CTA text & variant" });
  else              blocked.push({ slot: "cta",   label: "CTA text & variant",        reason: "Requires medium+ confidence" });
  if (gating.proof) allowed.push({ slot: "proof", label: "Proof block" });
  else              blocked.push({ slot: "proof", label: "Proof / social proof block", reason: "Requires medium+ confidence" });
  if (gating.hero)  allowed.push({ slot: "hero",  label: "Hero section" });
  else              blocked.push({ slot: "hero",  label: "Hero section",               reason: "Requires high confidence" });
  if (gating.theme) allowed.push({ slot: "theme", label: "Full theme change" });
  else              blocked.push({ slot: "theme", label: "Full theme & layout",        reason: "Requires very_high confidence" });
  return { allowed, blocked };
}

function WhyThisTab({ journey }: { journey: JourneyState | null }) {
  if (!journey) return (
    <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
      Loading behavioral state…
    </div>
  );

  const { allowed, blocked } = humanGatingExplanation(journey);
  const confidenceReasons = humanConfidenceReason(journey);

  return (
    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>Current State</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
          {stageBadge(journey.funnelStage)}
          {badge(journey.confidence.band === "high" || journey.confidence.band === "very_high" ? "green" : "neutral",
            journey.confidence.band.replace("_", " "))}
          {journey.frictionScore > 40 && badge("red", `friction ${Math.round(journey.frictionScore)}`)}
          {journey.matchedSequences.length > 0 && badge("purple", `${journey.matchedSequences.length} seq`)}
        </div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>
          intent {score(journey.intentScore)} · confidence {pct(journey.confidence.overallConfidence)}
          {journey.frictionScore > 0 ? ` · friction ${score(journey.frictionScore)}` : ""}
        </div>
      </div>

      <SectionLabel>Why this stage?</SectionLabel>
      <p style={{ marginBottom: 10, fontSize: 12 }}>
        Stage is <strong>{journey.funnelStage.replace(/_/g, " ")}</strong> because:{" "}
        {humanFunnelReason(journey)}
      </p>

      <SectionLabel>Why this confidence?</SectionLabel>
      <ul style={{ margin: "0 0 10px", padding: "0 0 0 16px", fontSize: 11, color: "#6b7280" }}>
        {confidenceReasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      {allowed.length > 0 && (
        <>
          <SectionLabel>Personalization active</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            {allowed.map((a) => (
              <div key={a.slot} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                <span>{a.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {blocked.length > 0 && (
        <>
          <SectionLabel>Blocked — confidence too low</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            {blocked.map((b) => (
              <div key={b.slot} style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11 }}>
                <span style={{ color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>✗</span>
                <div>
                  <span style={{ fontWeight: 600 }}>{b.label}</span>
                  <span style={{ color: "#9ca3af" }}> — {b.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Key Signals</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {journey.hasVisitedPricing  && badge("blue",    "visited pricing")}
        {journey.hasVisitedAbout    && badge("neutral", "visited about")}
        {journey.hasVisitedCases    && badge("neutral", "visited cases")}
        {journey.hasVisitedContact  && badge("blue",    "visited contact")}
        {journey.hasClickedCta      && badge("amber",   "clicked CTA")}
        {journey.formStartCount > 0 && badge("orange",  "started form")}
        {journey.hasSubmittedForm   && badge("green",   "submitted form")}
        {journey.frictionScore > 50 && badge("red",     "high friction")}
        {!journey.hasVisitedPricing && !journey.hasClickedCta && !journey.hasVisitedAbout && (
          <span style={{ color: "#9ca3af", fontSize: 11 }}>No strong signals yet</span>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Live State ─────────────────────────────────────────────────────────

function LiveStateTab({ journey, mergedEventCount, onRefresh, lastRefreshed }: {
  journey: JourneyState | null;
  mergedEventCount: number;
  onRefresh: () => void;
  lastRefreshed: Date | null;
}) {
  // All sections open by default — this is a developer tool and users want
  // to see data immediately.  State is persisted in localStorage so it
  // survives tab switches and page navigations (LiveStateTab remounts when
  // the user switches away from this tab).
  const LIVE_STATE_SECTIONS = ["scores", "confidence", "flags", "counts", "sequences", "timing"] as const;
  const defaultOpen = Object.fromEntries(LIVE_STATE_SECTIONS.map((k) => [k, true]));

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("mc_live_state_open");
      if (stored) return { ...defaultOpen, ...JSON.parse(stored) as Record<string, boolean> };
    } catch { /* localStorage unavailable */ }
    return defaultOpen;
  });

  const toggle = (k: string) => setOpen((s) => {
    const next = { ...s, [k]: !s[k] };
    try { localStorage.setItem("mc_live_state_open", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // Format the last-refreshed timestamp as a relative "X seconds ago" string.
  const [refreshLabel, setRefreshLabel] = useState("—");
  useEffect(() => {
    function update() {
      if (!lastRefreshed) { setRefreshLabel("—"); return; }
      const s = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);
      setRefreshLabel(s <= 1 ? "just now" : `${s}s ago`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  if (!journey) return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: "#9ca3af", fontSize: 11 }}>No behavioral state available yet.</span>
        <button onClick={onRefresh} style={{ background: "#f1f5f9", border: "1px solid #e5e7eb",
          borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#6b7280", cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>
    </div>
  );

  function Section({ k, title, children }: { k: string; title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 5 }}>
        <button onClick={() => toggle(k)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between",
            background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 6,
            padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#374151" }}>
          <span>{title}</span><span>{open[k] ? "▲" : "▼"}</span>
        </button>
        {open[k] && <div style={{ border: "1px solid #e5e7eb", borderTop: "none",
          borderRadius: "0 0 5px 5px", padding: "7px 9px", fontSize: 11, background: "#fff" }}>
          {children}
        </div>}
      </div>
    );
  }

  function Row({ label, value }: { label: string; value: string | number | boolean | null }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2,
        borderBottom: "1px solid #f1f5f9", paddingBottom: 2 }}>
        <span style={{ color: "#9ca3af" }}>{label}</span>
        <span style={{ fontWeight: 600, color: "#374151", fontFamily: "monospace", fontSize: 10 }}>
          {String(value ?? "—")}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {mergedEventCount} merged events · from {journey.fromDatabase ? "database" : "local store"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>↻ {refreshLabel}</span>
          <button onClick={onRefresh} style={{ background: "#f1f5f9", border: "1px solid #e5e7eb",
            borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#6b7280", cursor: "pointer",
            fontWeight: 600 }}>
            Refresh
          </button>
        </div>
      </div>
      <Section k="scores" title="📊 Scores">
        <Row label="Intent Score"        value={journey.intentScore} />
        <Row label="Short-term Intent"   value={journey.shortTermIntentScore} />
        <Row label="Long-term Affinity"  value={journey.longTermAffinityScore} />
        <Row label="Engagement Score"    value={journey.engagementScore} />
        <Row label="Friction Score"      value={journey.frictionScore} />
        <Row label="Sequence Score"      value={journey.sequenceScore} />
        <Row label="Signal Diversity"    value={pct(journey.signalDiversityScore)} />
      </Section>
      <Section k="confidence" title="🎯 Confidence">
        <Row label="Overall"             value={pct(journey.confidence.overallConfidence)} />
        <Row label="Band"                value={journey.confidence.band} />
        <Row label="Intent Confidence"   value={pct(journey.confidence.intentConfidence)} />
        <Row label="Sequence Confidence" value={pct(journey.confidence.sequenceConfidence)} />
        <Row label="Funnel Confidence"   value={pct(journey.confidence.funnelStageConfidence)} />
      </Section>
      <Section k="flags" title="🚩 Page Flags">
        <Row label="Visited Pricing"  value={journey.hasVisitedPricing} />
        <Row label="Visited About"    value={journey.hasVisitedAbout} />
        <Row label="Visited Cases"    value={journey.hasVisitedCases} />
        <Row label="Visited Contact"  value={journey.hasVisitedContact} />
        <Row label="Clicked CTA"      value={journey.hasClickedCta} />
        <Row label="Form Starts"      value={journey.formStartCount} />
        <Row label="Form Submitted"   value={journey.hasSubmittedForm} />
      </Section>
      <Section k="counts" title="📋 Counts">
        <Row label="Page Views"   value={journey.pageViewCount} />
        <Row label="CTA Clicks"   value={journey.ctaClickCount} />
      </Section>
      {journey.matchedSequences.length > 0 && (
        <Section k="sequences" title="🔗 Sequences">
          {journey.matchedSequences.map((s) => <Row key={s} label={s} value="matched ✓" />)}
        </Section>
      )}
      <Section k="timing" title="🕐 Timing">
        <Row label="First seen"   value={journey.firstSeenAt ? new Date(journey.firstSeenAt).toLocaleString() : "—"} />
        <Row label="Last seen"    value={journey.lastSeenAt  ? new Date(journey.lastSeenAt).toLocaleString()  : "—"} />
        <Row label="From DB"      value={journey.fromDatabase} />
      </Section>
    </div>
  );
}

// ── Tab 4: Demo Flows ─────────────────────────────────────────────────────────

function DemoFlowsTab({
  onRefreshState,
  onRefreshPage,
}: {
  /** Refetch /api/journey/state so Live State tab shows new values. */
  onRefreshState: () => void;
  /** Call router.refresh() so page RSC re-renders with new journey data. */
  onRefreshPage:  () => void;
}) {
  const [activeFlow,    setActiveFlow]    = useState<string | null>(null);
  const [completedFlow, setCompletedFlow] = useState<string | null>(null);
  const [progress,      setProgress]      = useState<DemoFlowProgress | null>(null);
  const [cancel,        setCancel]        = useState<(() => void) | null>(null);
  const [countdown,     setCountdown]     = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startFlow(flowKey: string) {
    const flow = DEMO_FLOW_LIST.find((f) => f.key === flowKey);
    if (!flow) return;
    if (cancel) cancel();
    setActiveFlow(flowKey);
    setCompletedFlow(null);
    setProgress(null);
    setCountdown(null);

    const cancelFn = runDemoFlow(
      flow,
      // Use /api/scenario/event instead of trackEvent so demo flow events bypass
      // the client-side + server-side consent gate.  The normal trackEvent path
      // silently drops events when the cookie banner hasn't been accepted, which
      // leaves journey state empty and the Journey Intelligence page stuck on
      // "Not enough signal yet".  Scenario events are admin test injections —
      // they don't require visitor consent.
      (type, payload) => {
        const p = payload ?? {};
        fetch("/api/scenario/event", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType:    type,
            pagePath:     typeof p["page_path"]     === "string" ? p["page_path"]     : undefined,
            pageCategory: typeof p["page_category"] === "string" ? p["page_category"] : undefined,
            eventValue:   typeof p["event_value"]   === "string" ? p["event_value"]   : undefined,
            pageKeywords: Array.isArray(p["page_keywords"]) ? p["page_keywords"] as string[] : undefined,
            demoFlow:     typeof p["demo_flow"]      === "string" ? p["demo_flow"]     : undefined,
            demoStep:     typeof p["demo_step"]      === "number" ? p["demo_step"]     : undefined,
            occurredAt:   new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => { /* fire-and-forget */ });
      },
      (p) => setProgress(p),
      () => {
        // Flow is done — all events have been fired.
        setActiveFlow(null);
        setCancel(null);
        setCompletedFlow(flowKey);

        // Activate a scenario override matching the flow's expected funnel stage.
        //
        // This writes `_scenarioKey` into the mc_scenario cookie (the same
        // mechanism used by Scenario Presets).  On router.refresh() the
        // server-side pipeline detects _scenarioKey and calls getDemoScenarioPlan()
        // which bypasses the rule engine and returns a deterministic variant plan
        // (e.g. "high_intent" → hero_intent_direct + proof_stats + cta_meeting).
        //
        // Without this, the page refresh after flow completion reads the freshly-
        // written visitor_behavior_state, but the rule engine still returns the
        // default plan because most demo tenants have no matching rules configured.
        //
        // The overrides object is intentionally empty — activateScenario()
        // injects _scenarioKey automatically from the presetKey argument.
        activateScenario({}, flow.expectedStage, flow.label);

        // Give the server a moment to write + score the events, then
        // refresh both the panel's journey state AND the page content.
        // Two-phase: quick state refresh after 800 ms, page refresh after 1.5 s.
        let secs = 2;
        setCountdown(secs);
        countdownRef.current = setInterval(() => {
          secs -= 1;
          setCountdown(secs);
          if (secs <= 0) {
            clearInterval(countdownRef.current!);
            setCountdown(null);
          }
        }, 1000);

        setTimeout(() => { onRefreshState(); }, 800);
        setTimeout(() => {
          onRefreshPage();
          onRefreshState(); // second pass after the page RSC has re-run
        }, 1800);
      },
    );
    setCancel(() => cancelFn);
  }

  function stopFlow() {
    if (cancel) cancel();
    if (countdownRef.current) clearInterval(countdownRef.current);
    setActiveFlow(null);
    setProgress(null);
    setCancel(null);
    setCountdown(null);
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>
        Demo flows fire real tracking events step-by-step.
        When complete the page adapts and Live State updates automatically.
      </p>
      {DEMO_FLOW_LIST.map((flow) => {
        const isActive    = activeFlow    === flow.key;
        const isCompleted = completedFlow === flow.key && !isActive;
        return (
          <div key={flow.key} style={{
            border: `1px solid ${isActive ? "#818cf8" : isCompleted ? "#86efac" : "#e5e7eb"}`,
            borderRadius: 7, padding: 9, marginBottom: 7,
            background: isActive ? "#eff6ff" : isCompleted ? "#f0fdf4" : "#fff",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#111827" }}>
                  {flow.icon} {flow.label}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{flow.description}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                  {flow.steps.length} steps · expected: {flow.expectedStage.replace("_"," ")}
                </div>
              </div>
              {isActive ? (
                <button onClick={stopFlow} style={{ padding: "3px 9px", background: "#fee2e2",
                  color: "#991b1b", border: "none", borderRadius: 5, fontSize: 11,
                  fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Stop</button>
              ) : (
                <button onClick={() => startFlow(flow.key)}
                  disabled={activeFlow !== null}
                  style={{ padding: "3px 9px", background: "#6366f1", color: "#fff",
                    border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", flexShrink: 0,
                    opacity: activeFlow !== null ? 0.4 : 1 }}>
                  {isCompleted ? "Run again" : "Run"}
                </button>
              )}
            </div>

            {/* In-progress bar */}
            {isActive && progress && (
              <div style={{ marginTop: 7 }}>
                <div style={{ background: "#e0e7ff", borderRadius: 4, height: 3, overflow: "hidden" }}>
                  <div style={{
                    background: "#6366f1", height: "100%",
                    width: `${Math.round(((progress.stepIndex + 1) / progress.totalSteps) * 100)}%`,
                    transition: "width 300ms",
                  }} />
                </div>
                <div style={{ fontSize: 10, color: "#6366f1", marginTop: 3 }}>
                  Step {progress.stepIndex + 1}/{progress.totalSteps}: {progress.label}
                  {progress.done && " ✓"}
                </div>
              </div>
            )}

            {/* Completion notice */}
            {isCompleted && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>
                  ✓ Done — all {flow.steps.length} events fired
                </span>
                {countdown !== null && countdown > 0 && (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>
                    · refreshing page in {countdown}s…
                  </span>
                )}
                {countdown === null && (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>· page updated</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "context",  label: "Context" },
  { key: "why",      label: "Why This?" },
  { key: "state",    label: "Live State" },
  { key: "flows",    label: "Demo Flows" },
] as const;

type TabKey = typeof TABS[number]["key"];

export function ScenarioControlPanel() {
  const [mounted,   setMounted]   = useState(false);
  // Initialise synchronously from window so the panel never flashes to null
  // during router.refresh() or soft navigation re-renders.
  // ScenarioControlMount uses ssr:false, so there is no hydration mismatch risk.
  const [visible,   setVisible]   = useState(() => {
    if (typeof window === "undefined") return false;
    return shouldShowPanel();
  });
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    // On the demo-controls page the panel is always open so visitors can
    // immediately interact with it.  Ignore any persisted minimized preference.
    if (window.location.pathname === "/demo-controls") return false;
    return localStorage.getItem("mc_scenario_panel_minimized") === "1";
  });
  // Whether the DemoControlsToggle on /demo-controls has enabled the panel.
  // Default true — absence of the key means "enabled".
  const [demoControlsEnabled, setDemoControlsEnabled] = useState(true);

  const [tab, setTabRaw] = useState<TabKey>(() => {
    // Restore the last-active tab from localStorage so it survives remounts
    // caused by router.refresh() or page navigation.
    try {
      const stored = localStorage.getItem("mc_scenario_panel_tab") as TabKey | null;
      if (stored && TABS.some((t) => t.key === stored)) return stored;
    } catch { /* localStorage unavailable */ }
    return "context";
  });

  const setTab = useCallback((next: TabKey) => {
    setTabRaw(next);
    try { localStorage.setItem("mc_scenario_panel_tab", next); } catch { /* ignore */ }
  }, []);
  const [scenario,  setScenario]  = useState<ScenarioState>(() => getScenarioState());
  const [journey,   setJourney]   = useState<JourneyState | null>(null);
  const [merged,    setMerged]    = useState<number>(0);

  // Apply / recompute state.
  const [autoApply,  setAutoApply]  = useState(false);
  const [applying,   setApplying]   = useState(false);
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enricher state.
  const [enricherStatuses,  setEnricherStatuses]  = useState<Record<string, EnricherStatus>>({});
  const [enricherMockMode,  setEnricherMockMode]  = useState(true);

  // Debug Reset state.
  const [resetToast,     setResetToast]     = useState<DebugResetResult | null>(null);
  const resetToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isResetting,    setIsResetting]    = useState(false);

  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    setMounted(true);
    setVisible(shouldShowPanel());
    // Read the demo-controls toggle state set by DemoControlsToggle.
    try {
      setDemoControlsEnabled(localStorage.getItem("mc_demo_controls_active") !== "0");
    } catch { /* localStorage unavailable */ }
  }, []);

  // Listen for toggle changes dispatched by DemoControlsToggle (same tab).
  useEffect(() => {
    function handleToggle(e: Event) {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      setDemoControlsEnabled(detail.enabled);
      // Re-open when re-enabled; collapse to minimized when disabled.
      if (detail.enabled) setMinimized(false);
    }
    window.addEventListener("mc_demo_controls_changed", handleToggle);
    return () => window.removeEventListener("mc_demo_controls_changed", handleToggle);
  }, []);

  // Force the panel open whenever the visitor is on /demo-controls
  // AND the toggle is enabled.
  // This handles client-side navigation (e.g. clicking a link to the page)
  // where the initial useState value is not re-evaluated.
  useEffect(() => {
    if (pathname === "/demo-controls" && demoControlsEnabled) {
      setMinimized(false);
    }
  }, [pathname, demoControlsEnabled]);

  // ── Router refresh helper ─────────────────────────────────────────────────
  const triggerRefresh = useCallback(() => {
    setApplying(true);
    router.refresh();
    // After a short delay, clear the "applying" state.
    setTimeout(() => setApplying(false), 600);
  }, [router]);

  // ── Debug reset helpers ───────────────────────────────────────────────────

  /** Show a toast and auto-dismiss it after 4 s. */
  function showResetToast(result: DebugResetResult) {
    setResetToast(result);
    if (resetToastTimerRef.current) clearTimeout(resetToastTimerRef.current);
    resetToastTimerRef.current = setTimeout(() => setResetToast(null), 4000);
  }

  const handleResetSession = useCallback(() => {
    if (isResetting) return;
    setIsResetting(true);
    // Async: awaits the server-side cookie-clear route (for httpOnly cookies)
    // BEFORE navigating so the browser receives the Set-Cookie: Max-Age=0 headers.
    void resetWebsiteSession().then((result) => {
      showResetToast(result);
      // Hard-navigate to the current path with "?" to force a fresh server render.
      // The "?" differs from a bare reload because it adds a query string,
      // ensuring the browser issues a new request even if the current URL has a
      // fragment or no query string.
      if (typeof window !== "undefined") {
        window.location.href = window.location.pathname + "?";
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResetting]);

  const handleResetVisitor = useCallback(() => {
    if (isResetting) return;
    setIsResetting(true);
    // Async: awaits the server-side cookie-clear route (for httpOnly cookies)
    // BEFORE navigating so the browser receives the Set-Cookie: Max-Age=0 headers.
    void resetWebsiteSessionAndVisitor().then((result) => {
      showResetToast(result);
      // Full hard reload so a new visitor ID is generated on the next request.
      if (typeof window !== "undefined") {
        window.location.href = window.location.pathname + "?";
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResetting]);


  // ── Subscribe to scenario state changes ───────────────────────────────────
  // Refresh RSC when preset changes or scenario is activated/cleared.
  // Manual field patches do NOT auto-refresh (use Apply button or Auto Apply).
  useEffect(() => {
    let prevActive    = getScenarioState().active;
    let prevPresetKey = getScenarioState().presetKey;

    return subscribeToScenario((s) => {
      setScenario(s);

      const activeChanged  = s.active !== prevActive;
      const presetChanged  = s.active && s.presetKey !== prevPresetKey && s.presetKey !== null;

      if (activeChanged || presetChanged) {
        prevActive    = s.active;
        prevPresetKey = s.presetKey;
        triggerRefresh();
        return;
      }

      // Auto Apply mode: debounce field changes.
      if (autoApply && s.active) {
        if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = setTimeout(() => {
          triggerRefresh();
        }, 600);
      }

      prevActive    = s.active;
      prevPresetKey = s.presetKey;
    });
  }, [autoApply, triggerRefresh]);

  // ── Re-derive journey state ───────────────────────────────────────────────
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Keep a ref to the latest scenario so refreshJourneyState can read it
  // without taking it as a dep.  Without this, every scenario state change
  // creates a new refreshJourneyState reference, which tears down and
  // recreates the 3-second poll interval — causing gaps and stale data.
  const scenarioRef = useRef(scenario);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);

  // Tracks the last pathname for which we pushed a panel page_view into the
  // local journey store.  Lives outside refreshJourneyState so the ref persists
  // across calls without needing to be in the useCallback dep array.
  const lastTrackedPanelPathRef = useRef<string | null>(null);

  const refreshJourneyState = useCallback(async () => {
    try {
      // ── Inline page-view tracking (consent-gate bypass) ──────────────────
      //
      // trackEvent() silently drops events when the user hasn't accepted the
      // consent banner (DEFAULT_CONSENT = all false).  For the ScenarioControlPanel
      // — a developer/admin tool — we bypass the gate entirely:
      //
      //   1. pushToJourneyStore() directly: writes to window.__journey RIGHT
      //      HERE, before getJourneyStoreEvents() reads it below, so the count
      //      is always up-to-date with zero effect-ordering issues.
      //
      //   2. POST /api/scenario/event: persists to the DB (same endpoint the
      //      demo flow steps use, already tagged scenario_event=true).
      //
      // The ref guard prevents double-counting on the 3-second poll interval.
      const currentPath = typeof window !== "undefined" ? window.location.pathname : null;
      if (currentPath && lastTrackedPanelPathRef.current !== currentPath) {
        lastTrackedPanelPathRef.current = currentPath;

        // Only push if this pathname has no page_view yet in the local store.
        // Guards against double-counting when PageTracker or a previous component
        // mount already pushed an event for this path (seen as eventsBefore > 0
        // for the same path on first load).
        const existing = getJourneyStoreEvents();
        const alreadyHasView = existing.some(
          (e) => e.eventType === "page_view" &&
                 (e.payload["page_path"] === currentPath || e.payload["pathname"] === currentPath),
        );
        if (!alreadyHasView) {
          pushToJourneyStore(generateEventId(), "page_view", {
            page_path:      currentPath,
            pathname:       currentPath,
            client:         true,
            scenario_panel: true,
          });
        }
        // Fire-and-forget DB write regardless — /api/scenario/event handles
        // dedup server-side so this is safe to always send.
        fetch("/api/scenario/event", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ eventType: "page_view", pagePath: currentPath }),
          credentials: "include",
        }).catch(() => {/* ignore */});
      }

      const local = getJourneyStoreEvents();
      let backendState: JourneyState | null = null;
      try {
        const r = await fetch("/api/journey/state", { credentials: "include" });
        if (r.ok) {
          const data = await r.json() as { journey?: JourneyState };
          backendState = data.journey ?? null;
        }
      } catch { /* offline / preview */ }

      const mergedEvents = mergeJourneyEvents(local, []);
      setMerged(mergedEvents.length);

      // Always derive from local events, seeded from backendState for server-only
      // fields (intentScore, sequences, decay profiles) that the client cannot
      // recompute.  This ensures local events (page_view, cta_click, etc.) are
      // reflected in the panel immediately — even before the DB write completes —
      // rather than being ignored whenever a non-null backendState is present.
      //
      // Counts (pageViewCount, ctaClickCount) are intentionally session-scoped:
      // they reflect only what has accumulated in this tab, not DB lifetime totals.
      let derived: JourneyState | null = deriveClientState(
        mergedEvents,
        backendState,
      ) as unknown as JourneyState;

      const sc = scenarioRef.current;
      if (derived && sc.active && Object.keys(sc.overrides).length > 0) {
        derived = applyScenarioOverride(derived, sc.overrides);
      }
      // Only overwrite journey state with a non-null value — keeps the last
      // known state visible while navigating between pages so the panel never
      // goes blank mid-session.
      if (derived !== null) {
        setJourney(derived);
        setLastRefreshed(new Date());
      }
    } catch {
      // silently ignore — panel is best-effort
    }
  // Stable callback — no deps that change frequently.
  // scenario is accessed via scenarioRef so the poll interval is never torn down.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial + pathname/scenario-change refresh.
  useEffect(() => {
    void refreshJourneyState();
  }, [pathname, refreshJourneyState]);

  // ── Auto-poll journey state ───────────────────────────────────────────────
  // Poll every 3 s whenever the panel is not minimized, regardless of which
  // tab is active.  refreshJourneyState is stable so this interval is only
  // set up/torn down when minimized changes — never on every scenario update.
  useEffect(() => {
    if (minimized) return;
    const intervalId = setInterval(() => {
      void refreshJourneyState();
    }, 3000);
    return () => clearInterval(intervalId);
  }, [minimized, refreshJourneyState]);

  // ── Enricher re-run ───────────────────────────────────────────────────────
  const handleRunEnricher = useCallback(async (key: EnricherKey) => {
    setEnricherStatuses((prev) => ({
      ...prev,
      [key]: { key, state: "running" },
    }));

    const startMs = Date.now();
    try {
      const res = await fetch("/api/scenario/enricher", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enricherKey: key, mockMode: enricherMockMode }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as {
        output: Record<string, unknown>;
        durationMs: number;
        mockMode: boolean;
        error?: string;
      };

      // Merge the enricher output INTO the existing enrichmentPatch (don't
      // replace it) — so running IP/Geo and then Weather accumulates both sets of
      // fields, instead of the later run wiping the earlier ones. "Restore Real"
      // clears the patch when you want to start fresh.
      const currentPatch = (getScenarioState().overrides.enrichmentPatch ?? {}) as Record<string, unknown>;
      patchScenarioOverride({ enrichmentPatch: { ...currentPatch, ...data.output } });

      setEnricherStatuses((prev) => ({
        ...prev,
        [key]: {
          key,
          state:     "success",
          durationMs: data.durationMs,
          mockMode:   data.mockMode,
          lastRunAt:  new Date().toISOString(),
        },
      }));

      // Auto-apply after enricher re-run.
      triggerRefresh();

    } catch (err) {
      setEnricherStatuses((prev) => ({
        ...prev,
        [key]: {
          key,
          state:     "error",
          durationMs: Date.now() - startMs,
          error:     err instanceof Error ? err.message : "unknown error",
          lastRunAt:  new Date().toISOString(),
        },
      }));
    }
  }, [enricherMockMode, triggerRefresh]);

  // The DemoControlsToggle on /demo-controls persists its state in localStorage.
  // When the host disables the control, it should be hidden across ALL pages —
  // not just on /demo-controls — so a demo walkthrough stays clean everywhere.
  // `mounted` is intentionally NOT checked here.  ScenarioControlMount uses
  // next/dynamic with ssr:false so this component only ever runs in the browser —
  // there is no hydration-mismatch risk.  Gating on `mounted` causes the panel
  // to return null for one render cycle every time the layout re-renders (e.g.
  // after router.refresh()), which resets the expanded/minimized state and
  // makes the panel appear to collapse on every page navigation.
  if (!visible) return null;
  if (!demoControlsEnabled) return null;

  const panelWidth = 360;

  return (
    <>
      {/* Debug Reset toast notification */}
      {resetToast && (
        <div style={{
          position: "fixed", bottom: 76, right: 16, zIndex: 10000,
          background: resetToast.visitorIdentityReset ? "#1e293b" : "#0f172a",
          color: "#f1f5f9", borderRadius: 10, padding: "10px 14px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 11, maxWidth: 300, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span>{resetToast.visitorIdentityReset ? "🧹" : "🔁"}</span>
            <span>{resetToast.visitorIdentityReset ? "Session + identity reset" : "Session reset"}</span>
            <button onClick={() => setResetToast(null)}
              style={{ marginLeft: "auto", background: "none", border: "none",
                color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: 0 }}>
              ✕
            </button>
          </div>
          <div style={{ color: "#94a3b8" }}>
            Cleared: {resetToast.cleared.join(" · ")}
          </div>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 10 }}>
            Navigating to a fresh session…
          </div>
        </div>
      )}

      {/* Floating toggle button (shown when panel is minimized) */}
      {minimized && (
        <button onClick={() => { localStorage.setItem("mc_scenario_panel_minimized", "0"); setMinimized(false); }}
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 9999,
            background: scenario.active ? "#ef4444" : "#1e293b",
            color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
          {scenario.active ? "⚡ SCENARIO ACTIVE" : "🎭 Scenario Control"}
        </button>
      )}

      {/* Main panel */}
      {!minimized && (
        <div style={{
          position: "fixed", bottom: 16, right: 16, width: panelWidth,
          maxHeight: "88vh", zIndex: 9998,
          display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "9px 13px", borderBottom: "1px solid #e5e7eb",
            background: scenario.active ? "#fef2f2" : "#f8fafc",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 14 }}>🎭</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  Scenario Control
                </div>
                {scenario.active ? (
                  <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                    ⚡ {scenario.label ?? "SCENARIO MODE ACTIVE"}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>Real behavioral data</div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {scenario.active && (
                <button onClick={() => { clearScenario(); triggerRefresh(); }}
                  style={{ padding: "2px 7px", background: "#fee2e2", color: "#dc2626",
                    border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700,
                    cursor: "pointer" }}>
                  Exit
                </button>
              )}
              <button onClick={() => { if (pathname !== "/demo-controls") localStorage.setItem("mc_scenario_panel_minimized", "1"); setMinimized(true); }}
                style={{ padding: "2px 7px", background: "#f1f5f9", color: "#6b7280",
                  border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                ▾
              </button>
            </div>
          </div>

          {/* Scenario mode banner */}
          {scenario.active && (
            <div style={{
              background: "#fef2f2", borderBottom: "1px solid #fecaca",
              padding: "4px 13px", fontSize: 10, color: "#dc2626", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}>
              ⚠️ SCENARIO MODE — overrides are session-scoped. No real user data modified.
              {applying && <span style={{ marginLeft: "auto", color: "#9ca3af" }}>⏳ recomputing…</span>}
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc", flexShrink: 0,
          }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: "6px 3px", border: "none", background: "transparent",
                  borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
                  fontSize: 10, fontWeight: tab === t.key ? 700 : 500,
                  color: tab === t.key ? "#4f46e5" : "#9ca3af",
                  cursor: "pointer",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ overflowY: "auto", flex: 1, padding: "12px 12px" }}>
            {tab === "context" && (
              <ContextTab
                scenario={scenario}
                journey={journey}
                autoApply={autoApply}
                applying={applying}
                onApply={triggerRefresh}
                onRestore={() => { clearScenario(); triggerRefresh(); }}
                onToggleAutoApply={() => setAutoApply((v) => !v)}
                enricherStatuses={enricherStatuses}
                enricherMockMode={enricherMockMode}
                onRunEnricher={handleRunEnricher}
                onToggleEnricherMock={() => setEnricherMockMode((v) => !v)}
                onResetSession={handleResetSession}
                onResetVisitor={handleResetVisitor}
                isResetting={isResetting}
              />
            )}
            {tab === "why"     && <WhyThisTab   journey={journey} />}
            {tab === "state"   && <LiveStateTab  journey={journey} mergedEventCount={merged} onRefresh={refreshJourneyState} lastRefreshed={lastRefreshed} />}
            {tab === "flows"   && <DemoFlowsTab onRefreshState={refreshJourneyState} onRefreshPage={triggerRefresh} />}
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e5e7eb", padding: "5px 13px",
            fontSize: 10, color: "#9ca3af", background: "#f8fafc",
            display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
            <span>dev only · session-scoped · {autoApply ? "auto-apply ON" : "manual apply"}</span>
            <span>
              {journey?.funnelStage ?? "—"} ·{" "}
              {journey ? pct(journey.confidence.overallConfidence) : "—"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Re-export type for convenience ────────────────────────────────────────────
import type { JourneyFunnelStage } from "@/lib/journey/types";
