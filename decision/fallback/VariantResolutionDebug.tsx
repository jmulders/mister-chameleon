"use client";

/**
 * VariantResolutionDebug
 *
 * Inline debug component that shows the fallback hierarchy resolution trace
 * for a single adaptive block.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <VariantResolutionDebug
 *     blockLabel="Hero CTA"
 *     trace={resolutionTrace}
 *   />
 *
 * ─── Shows ─────────────────────────────────────────────────────────────────────
 *
 *   • Chosen variant key + which layer won
 *   • Confidence at time of resolution
 *   • Why skipped variants were not selected (layer by layer)
 */

import type { VariantResolutionTrace } from "./variant-hierarchy-types";

interface Props {
  /** Human-readable label for this block (e.g. "Hero CTA"). */
  blockLabel: string;
  /** The resolution trace produced by resolveBlockVariant(). */
  trace:      VariantResolutionTrace;
}

const LAYER_COLOURS: Record<string, { bg: string; colour: string; label: string }> = {
  personalized: { bg: "#dcfce7", colour: "#166534", label: "✓ Personalized" },
  segmented:    { bg: "#dbeafe", colour: "#1e40af", label: "~ Segmented" },
  default:      { bg: "#f3f4f6", colour: "#374151", label: "◦ Default" },
};

export function VariantResolutionDebug({ blockLabel, trace }: Props) {
  const layerStyle = LAYER_COLOURS[trace.layer] ?? LAYER_COLOURS.default;
  const conf       = `${Math.round(trace.confidence * 100)}%`;

  return (
    <div
      style={{
        border:       `1px solid ${layerStyle.colour}30`,
        borderLeft:   `3px solid ${layerStyle.colour}`,
        borderRadius: "4px",
        padding:      "0.5rem 0.625rem",
        fontSize:     "11px",
        fontFamily:   "ui-monospace,Cascadia Code,Fira Code,monospace",
        background:   "#fafafa",
        marginBottom: "0.5rem",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: trace.skipped.length > 0 ? "0.375rem" : 0 }}>
        <span style={{ fontWeight: 700, color: "#374151" }}>{blockLabel}</span>

        <span style={{ padding: "1px 5px", borderRadius: "3px", background: layerStyle.bg, color: layerStyle.colour, fontWeight: 700, fontSize: "9px" }}>
          {layerStyle.label.toUpperCase()}
        </span>

        <span style={{ color: "#9ca3af", fontSize: "10px" }}>
          winner: <strong style={{ color: "#374151" }}>{trace.winner}</strong>
        </span>

        <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "10px" }}>
          conf: <strong style={{ color: "#374151" }}>{conf}</strong>
        </span>
      </div>

      {/* Skipped variants */}
      {trace.skipped.length > 0 && (
        <div>
          {trace.skipped.map((skip, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", color: "#9ca3af", fontSize: "10px", marginTop: "2px" }}>
              <span style={{ flexShrink: 0 }}>↳</span>
              <span>
                <span style={{ textDecoration: "line-through" }}>{skip.variantKey}</span>
                {" — "}
                {skip.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rule/segment info */}
      {trace.layer === "personalized" && trace.ruleId && (
        <div style={{ marginTop: "3px", color: "#166534", fontSize: "10px" }}>
          rule: {trace.ruleId}
        </div>
      )}
      {trace.layer === "segmented" && trace.segment && (
        <div style={{ marginTop: "3px", color: "#1e40af", fontSize: "10px" }}>
          segment: {JSON.stringify(trace.segment)}
        </div>
      )}
    </div>
  );
}

// ── Multi-block summary ───────────────────────────────────────────────────────

interface MultiProps {
  /** Map of blockLabel → VariantResolutionTrace */
  traces: Array<{ blockLabel: string; trace: VariantResolutionTrace }>;
}

/**
 * Shows resolution traces for multiple blocks in a compact panel.
 * Useful in the JourneyDebugPanel.
 */
export function VariantResolutionPanel({ traces }: MultiProps) {
  if (traces.length === 0) return null;

  return (
    <div style={{
      border:       "1px solid #e5e7eb",
      borderRadius: "4px",
      padding:      "0.625rem",
      marginBottom: "0.625rem",
      background:   "#f8fafc",
    }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
        Variant Fallback Resolution
      </div>
      {traces.map(({ blockLabel, trace }) => (
        <VariantResolutionDebug key={blockLabel} blockLabel={blockLabel} trace={trace} />
      ))}
    </div>
  );
}
