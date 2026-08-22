"use client";

/**
 * PresetColourExplorer
 *
 * "Find by colour" on the Presets tab: the operator picks colours they like, the
 * tool ranks the gallery presets by colour similarity (CIEDE2000 over the chosen
 * swatch roles) and shows the closest matches with an Apply button. When nothing
 * fits well, it offers to turn the chosen colours into a custom complete look,
 * saved as a token set via the existing actions (so it appears on the Token sets
 * tab and can be applied like any set), with all four font vars set.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DESIGN_PRESET_GALLERY } from "@/tenant/design-presets-gallery";
import {
  rankPresets, presetIsLight, presetHueFamily, buildCustomLookTokens,
  NO_MATCH_THRESHOLD, HEADING_FONTS, BODY_FONTS, type ChosenColours,
} from "@/lib/design/preset-colour-match";
import type { HueFamily } from "@/lib/color";
import { applyDesignPresetAction } from "@/app/admin/tenants/[tenantId]/actions";
import { saveDesignTokenSetAction, applyDesignTokenSetAction } from "../token-set-actions";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RESULT_LIMIT = 8;
const HUE_OPTIONS: Array<HueFamily | "all"> = [
  "all", "neutral", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink",
];

const inputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";

interface RoleState { on: boolean; hex: string }

function ColourField({
  label, required, state, onChange,
}: {
  label: string; required?: boolean; state: RoleState; onChange: (s: RoleState) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      {required ? (
        <span style={{ width: 96, fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</span>
      ) : (
        <label style={{ width: 96, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
          <input type="checkbox" checked={state.on} onChange={(e) => onChange({ ...state, on: e.target.checked })} />
          {label}
        </label>
      )}
      <input
        type="color"
        value={HEX_RE.test(state.hex) ? state.hex : "#000000"}
        disabled={!required && !state.on}
        onChange={(e) => onChange({ on: true, hex: e.target.value })}
        style={{ width: 34, height: 28, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, background: "none" }}
      />
      <input
        className={inputCls}
        value={state.hex}
        disabled={!required && !state.on}
        placeholder="#2563eb"
        onChange={(e) => onChange({ on: state.on || required === true, hex: e.target.value })}
        style={{ width: 110, fontFamily: "monospace" }}
      />
    </div>
  );
}

function Swatch({ colors }: { colors: string[] }) {
  return (
    <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb" }}>
      {colors.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
    </div>
  );
}

export function PresetColourExplorer({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [primary, setPrimary]       = useState<RoleState>({ on: true, hex: "#2563eb" });
  const [background, setBackground] = useState<RoleState>({ on: false, hex: "#f5f8ff" });
  const [accent, setAccent]         = useState<RoleState>({ on: false, hex: "#7aa7f0" });
  const [foreground, setForeground] = useState<RoleState>({ on: false, hex: "#0f1e3a" });

  const [lightFilter, setLightFilter] = useState<"all" | "light" | "dark">("all");
  const [hueFilter, setHueFilter]     = useState<HueFamily | "all">("all");

  const [headingStack, setHeadingStack] = useState(HEADING_FONTS[1].stack); // Playfair Display
  const [bodyStack, setBodyStack]       = useState(BODY_FONTS[0].stack);    // Inter
  const [customName, setCustomName]     = useState("");
  const [status, setStatus]             = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const chosen: ChosenColours | null = useMemo(() => {
    if (!HEX_RE.test(primary.hex)) return null;
    return {
      primary: primary.hex,
      ...(background.on && HEX_RE.test(background.hex) ? { background: background.hex } : {}),
      ...(accent.on && HEX_RE.test(accent.hex) ? { accent: accent.hex } : {}),
      ...(foreground.on && HEX_RE.test(foreground.hex) ? { foreground: foreground.hex } : {}),
    };
  }, [primary, background, accent, foreground]);

  const ranked = useMemo(() => (chosen ? rankPresets(DESIGN_PRESET_GALLERY, chosen) : []), [chosen]);

  const filtered = useMemo(() => ranked.filter((r) => {
    if (lightFilter !== "all" && (lightFilter === "light") !== presetIsLight(r.preset)) return false;
    if (hueFilter !== "all" && presetHueFamily(r.preset) !== hueFilter) return false;
    return true;
  }), [ranked, lightFilter, hueFilter]);

  const results = filtered.slice(0, RESULT_LIMIT);
  const best = ranked[0];
  const noGoodMatch = !best || best.deltaE > NO_MATCH_THRESHOLD;

  function applyPreset(id: string) {
    setStatus(null);
    startTransition(async () => {
      const r = await applyDesignPresetAction(tenantId, id);
      if (r.ok) { setStatus({ kind: "ok", text: "Preset applied." }); router.refresh(); }
      else setStatus({ kind: "error", text: r.error });
    });
  }

  function saveCustom() {
    if (!chosen || !best) return;
    const name = customName.trim() || "Custom colour look";
    const { tokens } = buildCustomLookTokens(chosen, best.preset, headingStack, bodyStack);
    setStatus(null);
    startTransition(async () => {
      const res = await saveDesignTokenSetAction(tenantId, { name, tokens, baseTheme: "custom" });
      if (!res.ok) { setStatus({ kind: "error", text: res.errors.join(" ") }); return; }
      const applied = await applyDesignTokenSetAction(tenantId, res.id);
      if (applied.ok) {
        setStatus({ kind: "ok", text: `Saved "${name}" to the Token sets tab and applied it.` });
        router.refresh();
      } else {
        setStatus({ kind: "ok", text: `Saved "${name}" to the Token sets tab. Apply it there.` });
      }
    });
  }

  const customSwatch = chosen
    ? [chosen.primary, chosen.background ?? "#ffffff", chosen.foreground ?? "#111111", chosen.accent ?? chosen.primary]
    : [];

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20, background: "#fcfcfd" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Find by colour</div>
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0, marginBottom: 12 }}>
        Pick colours you like. Presets are ranked by colour similarity. If none fit, create a custom preset from your colours.
      </p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Colour composer */}
        <div>
          <ColourField label="Primary" required state={primary} onChange={setPrimary} />
          <ColourField label="Background" state={background} onChange={setBackground} />
          <ColourField label="Accent" state={accent} onChange={setAccent} />
          <ColourField label="Foreground" state={foreground} onChange={setForeground} />
          {!chosen && <div style={{ fontSize: 11, color: "#b91c1c" }}>Enter a valid primary hex to search.</div>}
        </div>

        {/* Facets */}
        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Filter</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["all", "light", "dark"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setLightFilter(v)}
                className={btn} style={lightFilter === v ? { borderColor: "#4f46e5", background: "#eef2ff", color: "#4f46e5" } : undefined}>
                {v === "all" ? "All" : v === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
          <label style={{ display: "block", color: "#374151", marginBottom: 4 }}>Hue family</label>
          <select className={inputCls} value={hueFilter} onChange={(e) => setHueFilter(e.target.value as HueFamily | "all")}>
            {HUE_OPTIONS.map((h) => <option key={h} value={h}>{h === "all" ? "Any hue" : h}</option>)}
          </select>
        </div>
      </div>

      {status && (
        <div style={{ marginTop: 10, fontSize: 12, color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>{status.text}</div>
      )}

      {/* Ranked results */}
      {chosen && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            {results.length > 0
              ? `Closest matches${noGoodMatch ? " (no strong match; consider a custom preset below)" : ""}:`
              : "No presets match the current filters."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {results.map(({ preset, deltaE, label }) => (
              <div key={preset.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fff" }}>
                <Swatch colors={[preset.swatch.primary, preset.swatch.background, preset.swatch.foreground, preset.swatch.accent]} />
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{preset.name}</span>
                  <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{label} ({deltaE.toFixed(1)})</span>
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 8 }}>{preset.category}</div>
                <button type="button" disabled={pending} onClick={() => applyPreset(preset.id)}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom preset */}
      {chosen && (
        <div style={{
          marginTop: 16, borderRadius: 10, padding: 12,
          border: noGoodMatch ? "1px solid #fed7aa" : "1px solid #e5e7eb",
          background: noGoodMatch ? "#fff7ed" : "#fff",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
            {noGoodMatch ? "No preset matches well. Create a custom preset from your colours" : "Or create a custom preset from your colours"}
          </div>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 0, marginBottom: 10 }}>
            Builds a complete look from your colours (structure seeded from the closest match) and saves it as a token set on the Token sets tab, with the fonts below applied across the whole UI.
          </p>
          <div style={{ marginBottom: 10, maxWidth: 320 }}><Swatch colors={customSwatch} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, color: "#374151" }}>
              <span style={{ display: "block", marginBottom: 2 }}>Heading font</span>
              <select className={inputCls} value={headingStack} onChange={(e) => setHeadingStack(e.target.value)}>
                {HEADING_FONTS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: "#374151" }}>
              <span style={{ display: "block", marginBottom: 2 }}>Body font</span>
              <select className={inputCls} value={bodyStack} onChange={(e) => setBodyStack(e.target.value)}>
                {BODY_FONTS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: "#374151" }}>
              <span style={{ display: "block", marginBottom: 2 }}>Name</span>
              <input className={inputCls} value={customName} placeholder="Custom colour look" onChange={(e) => setCustomName(e.target.value)} />
            </label>
            <button type="button" disabled={pending} onClick={saveCustom}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {pending ? "Saving..." : "Save as token set"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
