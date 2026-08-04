"use client";

/**
 * DemoStageSection — the prospect-facing demo, folded into the Scenario Control
 * panel as its first "Demo" tab.
 *
 * Replaces the two standalone overlays (DemoRoleSwitcher + DemoProfilePanel):
 * a persona picker ("Who are you?") on the real rule path, a plain-language
 * readout of what the site now thinks it knows, and a small time simulator.
 * English UI, consistent with the rest of the operator console.
 *
 * Each persona shows a round avatar. It falls back to a coloured emoji chip, but
 * a real photo can be dropped in later by setting `img` on the role (a path under
 * /public, e.g. "/demo/avatars/marketeer.jpg").
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateScenario, clearScenario } from "./scenario-store";
import { SCENARIO_PRESETS } from "./scenario-presets";
import type { ScenarioState, ScenarioOverrides } from "./scenario-store";

interface Role {
  key:     string;   // SCENARIO_PRESETS key
  segment: string;   // audienceSegmentIds value the rule matches on
  label:   string;
  sub:     string;
  icon:    string;   // emoji fallback avatar
  color:   string;   // avatar background
  img?:    string;   // optional real photo (path under /public)
}

const ROLES: Role[] = [
  { key: "demo_role_marketeer", segment: "demo-role-marketeer", label: "Marketer",       sub: "Marketing manager (end client)", icon: "📣", color: "#7c3aed" },
  { key: "demo_role_bureau",    segment: "demo-role-bureau",    label: "Agency owner",    sub: "Agency / bureau owner",          icon: "🏢", color: "#2563eb" },
  { key: "demo_role_technisch", segment: "demo-role-technisch", label: "Technical lead",  sub: "Technical lead / developer",     icon: "🛠️", color: "#16a34a" },
];

const ROLE_LABELS: Record<string, string> = {
  "demo-role-marketeer": "Marketer",
  "demo-role-bureau":    "Agency owner",
  "demo-role-technisch": "Technical lead",
};

function activeSegment(o: ScenarioOverrides): string | null {
  const seg = o.audienceSegmentIds;
  return typeof seg === "string" && seg ? seg : null;
}

function timeLabel(o: ScenarioOverrides): string {
  if (o.isWeekend) return "Weekend";
  if (o.timeOfDay === "evening" || o.timeOfDay === "night") return "Evening";
  if (o.timeOfDay) return "Day";
  return "Now (real time)";
}

export function DemoStageSection({
  scenario,
  onApply,
}: {
  scenario: ScenarioState;
  onApply:  () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const o = scenario.overrides ?? {};
  const active = activeSegment(o);

  function pickRole(role: Role | null) {
    if (role) {
      const preset = SCENARIO_PRESETS[role.key];
      if (preset) activateScenario(preset.overrides, preset.key, preset.label);
    } else {
      clearScenario();
    }
    onApply();
    startTransition(() => router.refresh());
  }

  function setTime(kind: "day" | "evening" | "weekend") {
    const base = { ...(scenario.overrides ?? {}) };
    if (kind === "day")     { base.timeOfDay = "afternoon"; base.currentHour = 14; base.isWeekend = false; }
    if (kind === "evening") { base.timeOfDay = "evening";   base.currentHour = 20; base.isWeekend = false; }
    if (kind === "weekend") { base.timeOfDay = "afternoon"; base.currentHour = 14; base.isWeekend = true;  }
    activateScenario(base, "demo_time", "Time");
    onApply();
    startTransition(() => router.refresh());
  }

  // ── Readout values ──────────────────────────────────────────────────────────
  const roleText = active ? (ROLE_LABELS[active] ?? active) : "—";
  const interestText = o.interestPrimary
    ? `${o.interestPrimary}${typeof o.interestConfidence === "number" ? ` (${Math.round(o.interestConfidence * 100)}%)` : ""}`
    : "—";
  const stageText  = o.funnelStage ?? "—";
  const intentText = typeof o.intentScore === "number" ? String(o.intentScore) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Persona picker ─────────────────────────────────────────────────── */}
      <div>
        <div style={S.sectionLabel}>Who are you?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ROLES.map((r) => (
            <RoleRow
              key={r.key}
              role={r}
              active={active === r.segment}
              disabled={pending}
              onClick={() => pickRole(r)}
            />
          ))}
          <DefaultRow active={!active} disabled={pending} onClick={() => pickRole(null)} />
        </div>
      </div>

      {/* ── Readout ────────────────────────────────────────────────────────── */}
      <div style={S.readout}>
        <div style={S.sectionLabel}>What the site knows</div>
        <Row label="Role"     value={roleText} />
        <Row label="Interest" value={interestText} />
        <Row label="Stage"    value={String(stageText)} />
        <Row label="Intent"   value={intentText} />
        <Row label="Time"     value={timeLabel(o)} />
      </div>

      {/* ── Time simulator ─────────────────────────────────────────────────── */}
      <div>
        <div style={S.sectionLabel}>Simulate time</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TimeBtn label="Day"     disabled={pending} onClick={() => setTime("day")} />
          <TimeBtn label="Evening" disabled={pending} onClick={() => setTime("evening")} />
          <TimeBtn label="Weekend" disabled={pending} onClick={() => setTime("weekend")} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function Avatar({ role }: { role: Role }) {
  if (role.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={role.img} alt="" width={34} height={34} style={{ ...S.avatar, objectFit: "cover" }} />
    );
  }
  return (
    <span style={{ ...S.avatar, background: role.color, fontSize: 16 }} aria-hidden="true">
      {role.icon}
    </span>
  );
}

function RoleRow({
  role, active, disabled, onClick,
}: { role: Role; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={S.row(active, disabled)}>
      <Avatar role={role} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#4338ca" : "#111827" }}>{role.label}</span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>{role.sub}</span>
      </span>
    </button>
  );
}

function DefaultRow({
  active, disabled, onClick,
}: { active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={S.row(active, disabled)}>
      <span style={{ ...S.avatar, background: "#94a3b8", fontSize: 16 }} aria-hidden="true">👤</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#4338ca" : "#111827" }}>Default</span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>Anonymous visitor</span>
      </span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" }}>
      <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
      <span style={{ color: "#111827", fontSize: 11, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function TimeBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 4px",
        fontSize: 11, fontWeight: 600, cursor: disabled ? "wait" : "pointer",
        background: "#f8fafc", color: "#374151",
      }}
    >
      {label}
    </button>
  );
}

// ── Inline styles ───────────────────────────────────────────────────────────────

const S = {
  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const,
    color: "#9ca3af", marginBottom: 6,
  },
  readout: {
    border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", background: "#fafafa",
  },
  avatar: {
    width: 34, height: 34, borderRadius: 999, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "#fff",
  } as const,
  row: (active: boolean, disabled: boolean) => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    textAlign: "left" as const, padding: "7px 9px", borderRadius: 10,
    border: active ? "1.5px solid #6366f1" : "1px solid #e5e7eb",
    background: active ? "#eef2ff" : "#fff",
    cursor: disabled ? "wait" : "pointer",
    transition: "border-color 140ms ease, background 140ms ease",
  }),
};
