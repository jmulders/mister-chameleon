/**
 * PalettePreview
 *
 * LAB Colour Library style palette card: the four swatch roles rendered as
 * adjacent colour blocks (a large primary field + three narrower strips), each
 * captioned with its resolved colour name, role, and hex. Pure presentation over
 * the existing swatch data; used by both the colour explorer results and the
 * PresetGallery cards.
 */

import { nearestColorName } from "@/lib/color/color-names";

export interface PaletteSwatch {
  primary:    string;
  background: string;
  accent:     string;
  foreground: string;
}

const ROLES: ReadonlyArray<{ key: keyof PaletteSwatch; label: string; grow: number }> = [
  { key: "primary",    label: "Primary",    grow: 2 },
  { key: "background", label: "Background", grow: 1 },
  { key: "accent",     label: "Accent",     grow: 1 },
  { key: "foreground", label: "Foreground", grow: 1 },
];

export function PalettePreview({ swatch }: { swatch: PaletteSwatch }) {
  return (
    <div>
      {/* Adjacent colour blocks: one large field + narrower strips. */}
      <div style={{ display: "flex", height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
        {ROLES.map((r) => (
          <div key={r.key} style={{ flex: r.grow, background: swatch[r.key] }} aria-hidden="true" />
        ))}
      </div>
      {/* Caption under each block: name + role + hex. */}
      <div style={{ display: "flex", marginTop: 6, gap: 6 }}>
        {ROLES.map((r) => {
          const hex = swatch[r.key];
          const named = nearestColorName(hex);
          return (
            <div key={r.key} style={{ flex: r.grow, minWidth: 0 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.03em", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {named.name}
              </div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280" }}>{hex}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
