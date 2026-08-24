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
import { useRouter, useSearchParams } from "next/navigation";
import { activateScenario, clearScenario } from "./scenario-store";
import { SCENARIO_PRESETS } from "./scenario-presets";
import { getDemoContextSet, getDemoAttributeSet } from "./demo-context-sets";
import type { DemoContext, DemoAttribute } from "./demo-context-sets";
import type { ScenarioState, ScenarioOverrides } from "./scenario-store";

/** The display fields shared by a persona Role and a tenant DemoContext. */
type DemoRowItem = { label: string; sub: string; icon: string; color: string; img?: string };

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

/** Which Simulate-time button is active, derived the same way as timeLabel. */
function activeTime(o: ScenarioOverrides): "day" | "evening" | "weekend" | null {
  if (o.isWeekend) return "weekend";
  if (o.timeOfDay === "evening" || o.timeOfDay === "night") return "evening";
  if (o.timeOfDay) return "day";
  return null;
}

export function DemoStageSection({
  scenario,
  onApply,
}: {
  scenario: ScenarioState;
  onApply:  () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const o = scenario.overrides ?? {};
  const active = activeSegment(o);

  // Tenant-specific demo contexts (e.g. cluistra) replace the generic personas.
  const tenant     = searchParams.get("tenant");
  const contextSet = getDemoContextSet(tenant);
  const attrSet    = getDemoAttributeSet(tenant);
  const activeKey  = o._scenarioKey ?? null;
  const currentAttrs = (o.customAttributes ?? {}) as Record<string, string | number | boolean>;

  // Flip a demo attribute on the REAL rule path (no bypass) so AttributeConditions
  // can fire. Setting one drops any active forced-context: attributes are a
  // separate axis, evaluated by the real engine.
  function setAttr(key: string, value: string | number | boolean | undefined) {
    const next: Record<string, string | number | boolean> = { ...currentAttrs };
    if (value === undefined) delete next[key];
    else next[key] = value;
    if (Object.keys(next).length > 0) {
      activateScenario({ customAttributes: next }, "demo_attrs", "Attributes");
    } else {
      clearScenario();
    }
    onApply();
    startTransition(() => router.refresh());
  }

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

  // Activate a tenant demo context: force its plan via the demo bypass so the page
  // visibly switches even though the production rules need real signals.
  function pickContext(ctx: DemoContext) {
    activateScenario({ ...(ctx.overrides ?? {}), bypass: true }, ctx.key, ctx.label);
    onApply();
    startTransition(() => router.refresh());
  }

  function resetDemo() {
    clearScenario();
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
      {/* ── Context / persona picker ───────────────────────────────────────── */}
      {contextSet ? (
        <div>
          <div style={S.sectionLabel}>Visitor context</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {contextSet.map((ctx) => (
              <RoleRow
                key={ctx.key}
                role={ctx}
                active={activeKey === ctx.key}
                disabled={pending}
                onClick={() => pickContext(ctx)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={resetDemo}
            disabled={pending}
            style={{
              marginTop: 8, background: "none", border: "none", padding: 0,
              fontSize: 11, fontWeight: 600, color: "#6366f1",
              cursor: pending ? "wait" : "pointer",
            }}
          >
            Reset to real time
          </button>
        </div>
      ) : (
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
      )}

      {/* ── Readout (generic persona path only) ────────────────────────────── */}
      {contextSet ? null : (
        <div style={S.readout}>
          <div style={S.sectionLabel}>What the site knows</div>
          <Row label="Role"     value={roleText} />
          <Row label="Interest" value={interestText} />
          <Row label="Stage"    value={String(stageText)} />
          <Row label="Intent"   value={intentText} />
          <Row label="Time"     value={timeLabel(o)} />
        </div>
      )}

      {/* ── Time simulator ─────────────────────────────────────────────────── */}
      <div>
        <div style={S.sectionLabel}>Simulate time</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TimeBtn label="Day"     active={activeTime(o) === "day"}     disabled={pending} onClick={() => setTime("day")} />
          <TimeBtn label="Evening" active={activeTime(o) === "evening"} disabled={pending} onClick={() => setTime("evening")} />
          <TimeBtn label="Weekend" active={activeTime(o) === "weekend"} disabled={pending} onClick={() => setTime("weekend")} />
        </div>
      </div>

      {/* ── Attribute simulator (real rule path) ───────────────────────────── */}
      {attrSet && attrSet.length > 0 && (
        <div>
          <div style={S.sectionLabel}>Page attributes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attrSet.map((attr) => (
              <AttrRow
                key={attr.key}
                attr={attr}
                value={currentAttrs[attr.key]}
                disabled={pending}
                onChange={(v) => setAttr(attr.key, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttrRow({
  attr, value, disabled, onChange,
}: {
  attr:     DemoAttribute;
  value:    string | number | boolean | undefined;
  disabled: boolean;
  onChange: (v: string | number | boolean | undefined) => void;
}) {
  // Encode the current value to a string for the <select>; "" means unset.
  const current = value === undefined ? "" : String(value);
  const opts = attr.kind === "boolean"
    ? [{ label: "Yes", raw: "true" }, { label: "No", raw: "false" }]
    : (attr.options ?? []).map((o) => ({ label: String(o), raw: String(o) }));

  function decode(raw: string): string | number | boolean | undefined {
    if (raw === "") return undefined;
    if (attr.kind === "boolean") return raw === "true";
    const opt = (attr.options ?? []).find((o) => String(o) === raw);
    return typeof opt === "number" ? opt : raw;
  }

  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#374151" }}>{attr.label}</span>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(decode(e.target.value))}
        style={{
          border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 8px",
          fontSize: 11, background: "#fff", color: "#111827",
          cursor: disabled ? "wait" : "pointer", minWidth: 120,
        }}
      >
        <option value="">Unset</option>
        {opts.map((o) => (
          <option key={o.raw} value={o.raw}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function Avatar({ role }: { role: DemoRowItem }) {
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
}: { role: DemoRowItem; active: boolean; disabled: boolean; onClick: () => void }) {
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

function TimeBtn({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        flex: 1, borderRadius: 8, padding: "6px 4px",
        fontSize: 11, fontWeight: active ? 700 : 600, cursor: disabled ? "wait" : "pointer",
        // Same active treatment as the persona rows (S.row): indigo border + tint.
        border: active ? "1.5px solid #6366f1" : "1px solid #e5e7eb",
        background: active ? "#eef2ff" : "#f8fafc",
        color: active ? "#4338ca" : "#374151",
        transition: "border-color 140ms ease, background 140ms ease",
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
