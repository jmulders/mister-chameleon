/**
 * PresetGallery
 *
 * Grid of curated design presets (DESIGN_PRESET_GALLERY). Each card shows a
 * live mini-preview rendered from the preset's own tokens; clicking "Apply"
 * writes the preset to the tenant via applyDesignPresetAction and refreshes.
 */

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DESIGN_PRESET_GALLERY, type DesignPresetCard } from "@/tenant/design-presets-gallery";
import { applyDesignPresetAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantDesignSettings } from "@/tenant/types";
import { PalettePreview } from "./PalettePreview";

interface Props {
  tenantId: string;
  design:   TenantDesignSettings;
}

/** Read a grouped token with a fallback. */
function tok(p: DesignPresetCard, group: string, key: string, fallback: string): string {
  const g = (p.tokenOverrides as Record<string, Record<string, string> | undefined>)[group];
  return (g && g[key]) || fallback;
}

function MiniPreview({ p }: { p: DesignPresetCard }) {
  const primary   = tok(p, "color", "primary", "#4f46e5");
  const onPrimary  = tok(p, "color", "onPrimary", "#ffffff");
  const bg         = tok(p, "color", "background", "#ffffff");
  const fg         = tok(p, "color", "foreground", "#0f172a");
  const mutedFg    = tok(p, "color", "mutedForeground", "#64748b");
  const accent     = tok(p, "color", "accent", "#eef2ff");
  const card       = tok(p, "color", "card", "#ffffff");
  const border     = tok(p, "color", "border", "#e2e8f0");
  const headerBg   = tok(p, "layout", "headerBg", bg);
  const headerFg   = tok(p, "layout", "headerFg", fg);
  const headerBd   = tok(p, "layout", "headerBorder", border);
  const fontH      = tok(p, "typography", "fontHeading", "inherit");
  const fontB      = tok(p, "typography", "fontBody", "inherit");
  const hWeight    = tok(p, "typography", "headingWeight", "700");
  const hTransform = tok(p, "typography", "headingTransform", "none");
  const letter     = tok(p, "typography", "letterSpacing", "normal");
  const radInt     = tok(p, "radius", "interactive", "8px");
  const radCard    = tok(p, "radius", "card", "12px");
  const shadow     = tok(p, "shadow", "md", "0 6px 18px rgba(2,6,23,.08)");

  return (
    <div style={{ background: bg, color: fg, fontFamily: fontB, borderRadius: "10px 10px 0 0", overflow: "hidden" }}>
      {/* header strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", background: headerBg, color: headerFg, borderBottom: `1px solid ${headerBd}` }}>
        <span style={{ fontFamily: fontH, fontWeight: Number(hWeight) || 700, textTransform: hTransform as React.CSSProperties["textTransform"], letterSpacing: letter, fontSize: 12 }}>{p.name}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: 9, opacity: .85 }}>
          <span>Features</span><span>Pricing</span>
        </span>
        <span style={{ background: primary, color: onPrimary, borderRadius: radInt, padding: "3px 7px", fontSize: 9, fontWeight: 600 }}>Start</span>
      </div>
      {/* hero */}
      <div style={{ padding: "14px 13px 13px" }}>
        <span style={{ display: "inline-block", background: accent, color: primary, borderRadius: 999, padding: "2px 7px", fontSize: 8.5, fontWeight: 700, marginBottom: 7 }}>PERSONALISATION</span>
        <div style={{ fontFamily: fontH, fontWeight: Number(hWeight) || 700, textTransform: hTransform as React.CSSProperties["textTransform"], letterSpacing: letter, fontSize: 17, lineHeight: 1.12, marginBottom: 5 }}>
          A site that adapts
        </div>
        <div style={{ color: mutedFg, fontSize: 10.5, marginBottom: 10, lineHeight: 1.4 }}>
          The same blocks, a different look &amp; feel.
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 11 }}>
          <span style={{ background: primary, color: onPrimary, borderRadius: radInt, padding: "5px 10px", fontSize: 10, fontWeight: 600 }}>Demo</span>
          <span style={{ background: "transparent", color: fg, border: `1px solid ${border}`, borderRadius: radInt, padding: "5px 10px", fontSize: 10, fontWeight: 600 }}>More</span>
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: radCard, boxShadow: shadow, padding: "9px 10px" }}>
          <div style={{ fontFamily: fontH, fontWeight: Number(hWeight) || 700, fontSize: 11, marginBottom: 2 }}>34% more leads</div>
          <div style={{ color: mutedFg, fontSize: 9.5 }}>On average after 90 days.</div>
        </div>
      </div>
    </div>
  );
}

export function PresetGallery({ tenantId, design }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Best-effort "currently applied" detection: compare the stored primary colour.
  const activePrimary = design.tokenOverrides?.color?.primary?.toLowerCase();

  function apply(id: string) {
    setBusyId(id);
    setMsg(null);
    startTransition(async () => {
      const r = await applyDesignPresetAction(tenantId, id);
      setBusyId(null);
      if (r.ok) {
        setMsg({ id, text: "Applied ✓", ok: true });
        router.refresh();
      } else {
        setMsg({ id, text: r.error, ok: false });
      }
    });
  }

  // Category groups in an explicit, sensible order: the base + LAB groups first,
  // then the statement / collection / pride-midnight expansions. Any unknown
  // category falls to the end in first-appearance order (future-proof).
  const CATEGORY_ORDER = [
    "General", "Neutrals & Stone", "Warm & Earthy", "Cool & Green", "Deep & Editorial",
    "Bold & Vivid", "Metallic", "Occasion & Themed", "Seasonal", "Pastel Neon",
    "Brand Archetypes", "Pride", "Midnight",
  ];
  const present = [...new Set(DESIGN_PRESET_GALLERY.map((p) => p.category))];
  const categories = present.slice().sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return present.indexOf(a) - present.indexOf(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const renderCard = (p: DesignPresetCard) => {
          const isActive = !!activePrimary && p.swatch.primary.toLowerCase() === activePrimary;
          return (
            <div
              key={p.id}
              style={{
                border: isActive ? "2px solid #4f46e5" : "1px solid #e6e8ec",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(16,24,40,.05)",
              }}
            >
              <MiniPreview p={p} />
              <div style={{ padding: "9px 11px", borderTop: "1px solid #eef1f4" }}>
                <strong style={{ fontSize: 13, display: "block" }}>{p.name}</strong>
                <div style={{ margin: "7px 0 8px" }}>
                  <PalettePreview swatch={p.swatch} />
                </div>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 9px", lineHeight: 1.35 }}>{p.description}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => apply(p.id)}
                    disabled={pending}
                    style={{
                      fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: pending ? "wait" : "pointer",
                      border: "1px solid #4f46e5",
                      background: isActive ? "#fff" : "#4f46e5",
                      color: isActive ? "#4f46e5" : "#fff",
                    }}
                  >
                    {busyId === p.id ? "Working…" : isActive ? "Reapply" : "Apply"}
                  </button>
                  {isActive && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Active</span>}
                  {msg && msg.id === p.id && (
                    <span style={{ fontSize: 11, color: msg.ok ? "#16a34a" : "#b91c1c" }}>{msg.text}</span>
                  )}
                </div>
              </div>
            </div>
          );
  };

  // Which category holds the currently-applied preset — opened by default so the
  // operator lands on their active look; everything else starts collapsed to cut
  // the long scroll. No active match → open the first category.
  const activeCat = activePrimary
    ? DESIGN_PRESET_GALLERY.find((p) => p.swatch.primary.toLowerCase() === activePrimary)?.category ?? null
    : null;
  const defaultOpenCat = activeCat ?? categories[0];

  function setAllOpen(open: boolean) {
    rootRef.current?.querySelectorAll("details").forEach((d) => { (d as HTMLDetailsElement).open = open; });
  }

  return (
    <div ref={rootRef}>
      <style>{`
        .mc-preset-cat > summary::-webkit-details-marker { display: none; }
        .mc-preset-cat > summary .mc-caret { transition: transform .15s ease; }
        .mc-preset-cat[open] > summary .mc-caret { transform: rotate(90deg); }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {DESIGN_PRESET_GALLERY.length} presets in {categories.length} categories
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setAllOpen(true)}
            style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
            Expand all
          </button>
          <button type="button" onClick={() => setAllOpen(false)}
            style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
            Collapse all
          </button>
        </div>
      </div>

      {categories.map((cat) => {
        const items = DESIGN_PRESET_GALLERY.filter((p) => p.category === cat);
        return (
          <details key={cat} className="mc-preset-cat" open={cat === defaultOpenCat} style={{ marginBottom: 12, borderTop: "1px solid #eef1f4" }}>
            <summary
              style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                listStyle: "none", padding: "10px 2px", userSelect: "none",
              }}
            >
              <span className="mc-caret" aria-hidden="true" style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1 }}>▶</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{cat}</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{items.length}</span>
              {cat === activeCat && (
                <span style={{ fontSize: 10.5, color: "#16a34a", fontWeight: 600, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 999, padding: "1px 7px" }}>Active look</span>
              )}
            </summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))",
                gap: 12,
                padding: "2px 0 12px",
              }}
            >
              {items.map(renderCard)}
            </div>
          </details>
        );
      })}
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, maxWidth: "70ch" }}>
        A preset sets the entire look in one go. Colors, typography, buttons, radius, header/footer, and the
        site-wide block tokens that carry through to every content block and adaptive slot. You can then fine-tune
        individual tokens in the Blocks, Advanced, or Typography tab.
      </p>
    </div>
  );
}
