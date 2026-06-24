/**
 * PresetBuilder
 *
 * Compose a custom design preset with friendly controls + a live preview, then
 * save it to the tenant. Saving routes through applyDesignTokensAction (grouped
 * format) so the upload validator runs (per-key allowlist + injection guard).
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DESIGN_PRESET_GALLERY } from "@/tenant/design-presets-gallery";
import { applyDesignTokensAction, importDesignPresetAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantDesignSettings } from "@/tenant/types";

interface Props {
  tenantId: string;
  design:   TenantDesignSettings;
}

type Groups = {
  color:      Record<string, string>;
  typography: Record<string, string>;
  radius:     Record<string, string>;
  shadow:     Record<string, string>;
  button:     Record<string, string>;
  layout:     Record<string, string>;
  spacing:    Record<string, string>;
  border:     Record<string, string>;
  motion:     Record<string, string>;
  focus:      Record<string, string>;
};

const FONTS: [string, string][] = [
  ["'Inter', system-ui, sans-serif", "Inter"],
  ["'Manrope', system-ui, sans-serif", "Manrope"],
  ["'DM Sans', system-ui, sans-serif", "DM Sans"],
  ["'Space Grotesk', system-ui, sans-serif", "Space Grotesk"],
  ["'Cormorant Garamond', Georgia, serif", "Cormorant (serif)"],
  ["'Oswald', sans-serif", "Oswald (caps)"],
];

const SEED = DESIGN_PRESET_GALLERY[0];

function seedFrom(presetId: string): Groups {
  const p = DESIGN_PRESET_GALLERY.find((x) => x.id === presetId) ?? SEED;
  const t = p.tokenOverrides as Record<string, Record<string, string> | undefined>;
  return {
    color:      { ...t.color },
    typography: { ...t.typography },
    radius:     { ...t.radius },
    shadow:     { ...t.shadow },
    button:     { ...t.button },
    layout:     { ...t.layout },
    spacing:    { ...t.spacing },
    border:     { ...t.border },
    motion:     { ...t.motion },
    focus:      { ...t.focus },
  };
}

// ── Option tables for the extended controls ───────────────────────────────────
const SECTION_PADDING: [string, string][] = [
  ["clamp(28px,4vw,48px)", "Compact"],
  ["clamp(40px,6vw,80px)", "Normaal"],
  ["clamp(64px,9vw,128px)", "Ruim"],
];
const CONTAINER_WIDTH: [string, string][] = [
  ["64rem", "Smal"], ["72rem", "Normaal"], ["80rem", "Breed"], ["100%", "Volledig"],
];
const BORDER_WIDTH: [string, string][] = [["0px", "Geen"], ["1px", "Dun"], ["2px", "Normaal"], ["3px", "Dik"]];
const HOVER_LIFT: [string, string][]  = [["0px", "Geen"], ["-2px", "Subtiel"], ["-4px", "Sterk"]];
const RING_WIDTH: [string, string][]  = [["1px", "Dun"], ["2px", "Normaal"], ["3px", "Dik"]];

function contrastText(hex: string): string {
  try {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#15151a" : "#ffffff";
  } catch { return "#ffffff"; }
}

const COLOR_FIELDS: [string, string][] = [
  ["primary", "Primair"], ["secondary", "Secundair"], ["accent", "Accent"],
  ["background", "Achtergrond"], ["foreground", "Tekst"], ["card", "Kaart"],
  ["border", "Rand"], ["mutedForeground", "Subtiele tekst"],
];

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 4px" };
const sel: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", border: "1px solid #e6e8ec", borderRadius: 8, background: "#fff" };
const sub: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#94a3b8", margin: "16px 0 8px" };

export function PresetBuilder({ tenantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [base, setBase] = useState<string>(SEED.id);
  const [g, setG] = useState<Groups>(() => seedFrom(SEED.id));
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function set(group: keyof Groups, key: string, value: string) {
    setG((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  }
  function pickBase(id: string) { setBase(id); setG(seedFrom(id)); setMsg(null); }

  // Header style derived control (light/dark/transparent) → layout colors.
  function setHeader(style: string) {
    const c = g.color;
    if (style === "light")       setG((p) => ({ ...p, layout: { ...p.layout, headerBg: c.background, headerFg: c.foreground, headerBorder: c.border } }));
    else if (style === "dark")   setG((p) => ({ ...p, layout: { ...p.layout, headerBg: c.foreground, headerFg: c.background, headerBorder: c.foreground } }));
    else                          setG((p) => ({ ...p, layout: { ...p.layout, headerBg: "transparent", headerFg: c.foreground, headerBorder: "transparent" } }));
  }

  const onPrimary = g.color.onPrimary || contrastText(g.color.primary || "#4f46e5");

  const preview = useMemo(() => {
    const c = g.color, ty = g.typography, r = g.radius, l = g.layout, b = g.button;
    const radInt = r.interactive || "8px", radCard = r.card || "12px";
    const hT = (ty.headingTransform || "none") as React.CSSProperties["textTransform"];
    return (
      <div style={{ background: c.background, color: c.foreground, fontFamily: ty.fontBody, borderRadius: 10, overflow: "hidden", border: "1px solid #e6e8ec" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: l.headerBg || c.background, color: l.headerFg || c.foreground, borderBottom: `1px solid ${l.headerBorder || c.border}` }}>
          <span style={{ fontFamily: ty.fontHeading, fontWeight: Number(ty.headingWeight) || 700, textTransform: hT, letterSpacing: ty.letterSpacing, fontSize: 15 }}>Mijn merk</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 11, opacity: .9 }}><span>Features</span><span>Prijzen</span><span>Cases</span></span>
          <span style={{ background: c.primary, color: onPrimary, borderRadius: radInt, padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Start</span>
        </div>
        <div style={{ padding: "22px 20px" }}>
          <span style={{ display: "inline-block", background: c.accent, color: c.primary, borderRadius: 999, padding: "3px 9px", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>PERSONALISATIE</span>
          <div style={{ fontFamily: ty.fontHeading, fontWeight: Number(ty.headingWeight) || 700, textTransform: hT, letterSpacing: ty.letterSpacing, fontSize: 28, lineHeight: 1.1, marginBottom: 8 }}>Jouw site past zich aan</div>
          <div style={{ color: c.mutedForeground, fontSize: 13, marginBottom: 16, maxWidth: "44ch" }}>Dezelfde blokken, een totaal andere look &amp; feel — puur via design-tokens.</div>
          <div style={{ display: "flex", gap: 9, marginBottom: 18 }}>
            <span style={{ background: c.primary, color: onPrimary, borderRadius: radInt, padding: "8px 14px", fontSize: 13, fontWeight: Number(b.weight) || 600, textTransform: (b.transform || "none") as React.CSSProperties["textTransform"], letterSpacing: b.tracking, boxShadow: b.shadow }}>Bekijk demo</span>
            <span style={{ background: "transparent", color: c.foreground, border: `${g.border.width || "1px"} solid ${c.border}`, borderRadius: radInt, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>Outline</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {["34% meer leads", "Privacy-vriendelijk"].map((tt) => (
              <div key={tt} style={{ background: c.card, border: `${g.border.width || "1px"} solid ${c.border}`, borderRadius: radCard, boxShadow: g.shadow.md, padding: "13px 14px" }}>
                <div style={{ fontFamily: ty.fontHeading, fontWeight: Number(ty.headingWeight) || 700, fontSize: 14, marginBottom: 3 }}>{tt}</div>
                <div style={{ color: c.mutedForeground, fontSize: 12 }}>Gemiddeld na 90 dagen.</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [g, onPrimary]);

  async function onImportFile(file: File) {
    setMsg(null);
    const text = await file.text();
    // Seed the builder + preview from the file so the result is visible at once.
    // Only seed from a FLAT string map per group — a DTCG / Figma export nests
    // values ({ "$value": … }), which would corrupt the field state and crash
    // the render. For those, we skip the optimistic seed and let the server
    // action apply the converted tokens (the public site still updates).
    const flat = (v: unknown): Record<string, string> | null => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null;
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val !== "string") return null;
        out[k] = val;
      }
      return out;
    };
    try {
      const o = JSON.parse(text) as Record<string, unknown>;
      setG((prev) => {
        const merge = (cur: Record<string, string>, next: unknown) => {
          const f = flat(next);
          return f ? { ...cur, ...f } : cur;
        };
        return {
          color:      merge(prev.color,      o.color),
          typography: merge(prev.typography, o.typography),
          radius:     merge(prev.radius,     o.radius),
          shadow:     merge(prev.shadow,     o.shadow),
          button:     merge(prev.button,     o.button),
          layout:     merge(prev.layout,     o.layout),
        };
      });
    } catch {
      // Non-fatal — the server action returns the precise JSON error below.
    }
    startTransition(async () => {
      try {
        const r = await importDesignPresetAction(tenantId, text);
        if (r.ok) {
          setMsg({ text: `Geïmporteerd${r.name ? `: ${r.name}` : ""} ✓ — opgeslagen op tenant.`, ok: true });
          router.refresh();
        } else {
          setMsg({ text: r.errors.join(" "), ok: false });
        }
      } catch {
        // A thrown error here (vs an {ok:false} result) is almost always a stale
        // server-action reference after a redeploy — the POST 404s. Surface the
        // fix instead of letting it crash to a raw 404 page.
        setMsg({
          text: "Import mislukt — waarschijnlijk een verlopen sessie na een nieuwe deploy. Ververs de pagina (⌘/Ctrl-Shift-R) en probeer opnieuw.",
          ok: false,
        });
      }
    });
  }

  function save() {
    setMsg(null);
    const payload = {
      theme: "custom",
      color: { ...g.color, onPrimary },
      typography: g.typography,
      radius: g.radius,
      shadow: g.shadow,
      button: g.button,
      layout: g.layout,
      spacing: g.spacing,
      border: g.border,
      motion: g.motion,
      focus: g.focus,
    };
    startTransition(async () => {
      const r = await applyDesignTokensAction(tenantId, payload);
      if (r.ok) { setMsg({ text: "Opgeslagen ✓ — bekijk de publieke site.", ok: true }); router.refresh(); }
      else setMsg({ text: r.errors.join(" "), ok: false });
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
      {/* Controls */}
      <div style={{ border: "1px solid #e6e8ec", borderRadius: 12, padding: 16, background: "#fff" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Begin vanaf</label>
          <select style={sel} value={base} onChange={(e) => pickBase(e.target.value)}>
            {DESIGN_PRESET_GALLERY.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Of importeer een preset-JSON (ook Figma / DTCG)</label>
          <label
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9,
              border: "1px solid #4f46e5", background: "#eef2ff", color: "#4f46e5",
              cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
            }}
          >
            <span aria-hidden="true">📂</span> Kies preset-JSON…
            <input
              type="file"
              accept=".json,application/json"
              disabled={pending}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }}
              style={{ display: "none" }}
            />
          </label>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Onze preset-JSON of een Figma/Tokens-Studio-export — wordt als complete look toegepast (vervangt de huidige tokens).
          </div>
          {pending && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4 }}>Bezig met importeren…</div>}
          {msg && (
            <div style={{ fontSize: 11, color: msg.ok ? "#16a34a" : "#b91c1c", marginTop: 4 }}>{msg.text}</div>
          )}
        </div>

        <div style={sub}>Kleuren</div>
        {COLOR_FIELDS.map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <input type="color" value={/^#([0-9a-f]{6})$/i.test(g.color[k] || "") ? g.color[k] : "#000000"} onChange={(e) => set("color", k, e.target.value)} style={{ width: 34, height: 30, padding: 0, border: "1px solid #e6e8ec", borderRadius: 6 }} />
            <span style={{ fontSize: 12.5, color: "#334155", flex: 1 }}>{label}</span>
            <input type="text" value={g.color[k] || ""} onChange={(e) => set("color", k, e.target.value)} style={{ width: 92, fontSize: 11, fontFamily: "monospace", padding: "5px 7px", border: "1px solid #e6e8ec", borderRadius: 6 }} />
          </div>
        ))}

        <div style={sub}>Typografie</div>
        <label style={lbl}>Heading-font</label>
        <select style={sel} value={g.typography.fontHeading || FONTS[0][0]} onChange={(e) => set("typography", "fontHeading", e.target.value)}>
          {FONTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <label style={{ ...lbl, marginTop: 9 }}>Body-font</label>
        <select style={sel} value={g.typography.fontBody || FONTS[0][0]} onChange={(e) => set("typography", "fontBody", e.target.value)}>
          {FONTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 9 }}>
          <div>
            <label style={lbl}>Heading-gewicht</label>
            <select style={sel} value={g.typography.headingWeight || "700"} onChange={(e) => set("typography", "headingWeight", e.target.value)}>
              {["500", "600", "700", "800"].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Hoofdletters</label>
            <select style={sel} value={g.typography.headingTransform || "none"} onChange={(e) => set("typography", "headingTransform", e.target.value)}>
              <option value="none">Aa</option><option value="uppercase">AA</option><option value="capitalize">Aa-begin</option>
            </select>
          </div>
        </div>

        <div style={sub}>Vorm &amp; knoppen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div>
            <label style={lbl}>Knop-radius</label>
            <select style={sel} value={g.radius.interactive || "8px"} onChange={(e) => set("radius", "interactive", e.target.value)}>
              {["0px", "4px", "8px", "16px", "9999px"].map((v) => <option key={v} value={v}>{v === "9999px" ? "pill" : v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Kaart-radius</label>
            <select style={sel} value={g.radius.card || "12px"} onChange={(e) => set("radius", "card", e.target.value)}>
              {["0px", "6px", "12px", "20px"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Knop-gewicht</label>
            <select style={sel} value={g.button.weight || "600"} onChange={(e) => set("button", "weight", e.target.value)}>
              {["500", "600", "700"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Knop-hoofdletters</label>
            <select style={sel} value={g.button.transform || "none"} onChange={(e) => set("button", "transform", e.target.value)}>
              <option value="none">Aa</option><option value="uppercase">AA</option>
            </select>
          </div>
        </div>

        <div style={sub}>Header</div>
        <select style={sel} onChange={(e) => setHeader(e.target.value)} defaultValue="">
          <option value="" disabled>Kies header-stijl…</option>
          <option value="light">Licht</option><option value="dark">Donker</option><option value="transparent">Transparant</option>
        </select>

        <div style={sub}>Ruimte &amp; secties</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div>
            <label style={lbl}>Sectie-ruimte</label>
            <select style={sel} value={g.spacing.sectionPadding || SECTION_PADDING[1][0]} onChange={(e) => set("spacing", "sectionPadding", e.target.value)}>
              {SECTION_PADDING.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Content-breedte</label>
            <select style={sel} value={g.spacing.container || CONTAINER_WIDTH[1][0]} onChange={(e) => set("spacing", "container", e.target.value)}>
              {CONTAINER_WIDTH.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Uitlijning</label>
            <select style={sel} value={g.spacing.align || "left"} onChange={(e) => set("spacing", "align", e.target.value)}>
              <option value="left">Links</option><option value="center">Gecentreerd</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Rand-dikte</label>
            <select style={sel} value={g.border.width || "1px"} onChange={(e) => set("border", "width", e.target.value)}>
              {BORDER_WIDTH.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={sub}>Interactie &amp; focus</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div>
            <label style={lbl}>Hover-lift (knoppen)</label>
            <select style={sel} value={g.motion.hoverLift || "0px"} onChange={(e) => set("motion", "hoverLift", e.target.value)}>
              {HOVER_LIFT.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Focus-ring dikte</label>
            <select style={sel} value={g.focus.ringWidth || "2px"} onChange={(e) => set("focus", "ringWidth", e.target.value)}>
              {RING_WIDTH.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ ...lbl, margin: 0 }}>Focus-ring kleur</label>
            <input
              type="color"
              value={/^#([0-9a-f]{6})$/i.test(g.focus.ringColor || "") ? g.focus.ringColor : (g.color.primary || "#4f46e5")}
              onChange={(e) => set("focus", "ringColor", e.target.value)}
              style={{ width: 34, height: 30, padding: 0, border: "1px solid #e6e8ec", borderRadius: 6 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={save} disabled={pending}
            style={{ fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: pending ? "wait" : "pointer" }}>
            {pending ? "Opslaan…" : "Opslaan op tenant"}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? "#16a34a" : "#b91c1c" }}>{msg.text}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <div style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 8px" }}>Live preview</div>
        {preview}
      </div>
    </div>
  );
}
