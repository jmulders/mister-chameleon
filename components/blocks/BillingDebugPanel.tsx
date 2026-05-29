"use client";

/**
 * components/blocks/BillingDebugPanel.tsx
 *
 * Billing / Usage per request — dev debug panel.
 *
 * ─── What this shows ─────────────────────────────────────────────────────────
 *
 *   A compact, filterable view of what the billing system did (or will do) for
 *   the current page load.  Rendered inside the site debug overlay at
 *   debugLevel === "full".
 *
 *   Since billing fires fire-and-forget AFTER the page is served, this panel
 *   shows the INTENT derived from the enrichment stage trace — which is
 *   deterministic and 100% accurate for diagnosing:
 *
 *     • why a page load did or did not charge credits
 *     • which stages were cache hits vs. live API calls
 *     • what the expected debit amount is
 *     • anomalies (billing disabled, simulated mode, debit failures)
 *
 *   For actual post-hoc outcomes, see Admin → Tenants → Billing → Debug.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   debug  — BillingRequestDebug built from the stage trace in page.tsx.
 *            Built synchronously from static pricing — no DB call needed.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   "use client" — uses useState for filter toggles.
 *   The debug data is serialized from the server component (page.tsx) and
 *   passed as a plain prop.
 */

import { useState } from "react";
import type {
  BillingRequestDebug,
  BillingStageDebugEntry,
  BillingStageResult,
} from "@/billing/request-debug";

// ── Result badge config ───────────────────────────────────────────────────────

const RESULT_CONFIG: Record<BillingStageResult, { label: string; bg: string; text: string }> = {
  charged:   { label: "CHARGED",   bg: "#dcfce7", text: "#15803d" },
  cached:    { label: "CACHED",    bg: "#dbeafe", text: "#1d4ed8" },
  skipped:   { label: "SKIPPED",   bg: "#f3f4f6", text: "#6b7280" },
  failed:    { label: "FAILED",    bg: "#fee2e2", text: "#b91c1c" },
  simulated: { label: "SIMULATED", bg: "#fef9c3", text: "#a16207" },
  free:      { label: "FREE",      bg: "#f0fdf4", text: "#16a34a" },
};

// ── Mode badge ────────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: BillingRequestDebug["billingMode"] }) {
  const cfg = {
    live:      { bg: "#dcfce7", text: "#15803d", label: "LIVE" },
    simulated: { bg: "#fef9c3", text: "#a16207", label: "SIMULATED" },
    disabled:  { bg: "#fee2e2", text: "#b91c1c", label: "DISABLED" },
  }[mode];
  return (
    <span style={{
      background: cfg.bg, color: cfg.text,
      padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: "0.04em",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Result badge ──────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: BillingStageResult }) {
  const cfg = RESULT_CONFIG[result];
  return (
    <span style={{
      background: cfg.bg, color: cfg.text,
      padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Stage row ─────────────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: BillingStageDebugEntry }) {
  const dimmed = stage.result === "skipped" || stage.result === "free";
  return (
    <tr style={{ opacity: dimmed ? 0.45 : 1 }}>
      <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 11, color: "#111827" }}>
        {stage.stageLabel}
      </td>
      <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>
        {stage.enrichmentType ?? "—"}
      </td>
      <td style={{ padding: "4px 8px", textAlign: "center" }}>
        <ResultBadge result={stage.result} />
      </td>
      <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>
        {stage.centsCharged > 0
          ? `€${(stage.centsCharged / 100).toFixed(4)}`
          : stage.result === "cached"
            ? "cached"
            : "—"}
      </td>
      <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
        {stage.creditCost > 0 && stage.result !== "cached" ? stage.creditCost.toFixed(2) : "—"}
      </td>
      <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
        {stage.durationMs > 0 ? `${stage.durationMs}ms` : "—"}
      </td>
      {stage.error && (
        <td colSpan={1} style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#b91c1c" }}>
          {stage.error}
        </td>
      )}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BillingDebugPanel({ debug }: { debug: BillingRequestDebug }) {
  const [onlyBillable,   setOnlyBillable]   = useState(false);
  const [onlyFailures,   setOnlyFailures]   = useState(false);
  const [onlyCache,      setOnlyCache]      = useState(false);
  const [onlyLive,       setOnlyLive]       = useState(false);

  const filtered = debug.stages.filter((s) => {
    if (onlyBillable && !s.billable) return false;
    if (onlyFailures && s.result !== "failed") return false;
    if (onlyCache    && !s.cacheHit)           return false;
    if (onlyLive     && (s.cacheHit || s.result === "skipped" || s.result === "free")) return false;
    return true;
  });

  const charged   = debug.stages.filter((s) => s.result === "charged").length;
  const cached    = debug.stages.filter((s) => s.result === "cached").length;
  const failed    = debug.stages.filter((s) => s.result === "failed").length;
  const simulated = debug.stages.filter((s) => s.result === "simulated").length;
  const free      = debug.stages.filter((s) => s.result === "free").length;
  const skipped   = debug.stages.filter((s) => s.result === "skipped").length;

  const labelStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    fontSize: 11, cursor: "pointer", userSelect: "none", color: "#374151",
  };

  return (
    <details open style={{ marginTop: 0 }}>
      <summary style={{
        cursor: "pointer", fontWeight: 700, fontSize: 13,
        color: "#111827", padding: "6px 0", listStyle: "none",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        💳 Billing / Usage per request
        <ModeBadge mode={debug.billingMode} />
        {debug.totalChargedCents > 0 && (
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#15803d", fontWeight: 600 }}>
            −€{(debug.totalChargedCents / 100).toFixed(4)} this request
          </span>
        )}
        {debug.demoMode && (
          <span style={{ fontSize: 10, background: "#fef9c3", color: "#a16207", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
            DEMO
          </span>
        )}
      </summary>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── Request summary ─────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6,
        }}>
          {[
            { label: "Charged",   value: charged,    color: "#15803d" },
            { label: "Cached",    value: cached,     color: "#1d4ed8" },
            { label: "Free",      value: free,       color: "#16a34a" },
            { label: "Skipped",   value: skipped,    color: "#6b7280" },
            { label: "Failed",    value: failed,     color: "#b91c1c" },
            { label: "Simulated", value: simulated,  color: "#a16207" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 6, padding: "6px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Wallet before / after ────────────────────────────────────────────── */}
        {debug.walletBeforeCents !== null && (
          <div style={{
            display: "flex", gap: 16, padding: "6px 10px",
            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6,
            fontSize: 11, fontFamily: "monospace",
          }}>
            <span><strong>Before:</strong> €{(debug.walletBeforeCents / 100).toFixed(4)}</span>
            <span style={{ color: "#6b7280" }}>→</span>
            <span><strong>After:</strong> €{((debug.walletAfterCents ?? debug.walletBeforeCents) / 100).toFixed(4)}</span>
            <span style={{ color: "#15803d" }}>
              −€{(debug.totalChargedCents / 100).toFixed(4)} charged
            </span>
          </div>
        )}

        {/* ── Anomalies ────────────────────────────────────────────────────────── */}
        {debug.anomalies.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {debug.anomalies.map((a, i) => (
              <div key={i} style={{
                padding: "5px 10px",
                background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6,
                fontSize: 11, color: "#92400e", fontFamily: "monospace",
              }}>
                ⚠ {a}
              </div>
            ))}
          </div>
        )}

        {/* ── Filter toggles ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Only billable", active: onlyBillable,   set: setOnlyBillable },
            { label: "Only failures", active: onlyFailures,   set: setOnlyFailures },
            { label: "Only cache hits", active: onlyCache,    set: setOnlyCache    },
            { label: "Only live calls", active: onlyLive,     set: setOnlyLive     },
          ].map(({ label, active, set }) => (
            <label key={label} style={labelStyle}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => set(e.target.checked)}
                style={{ accentColor: "#4f46e5" }}
              />
              <span style={{ color: active ? "#4f46e5" : "#6b7280" }}>{label}</span>
            </label>
          ))}
        </div>

        {/* ── Stage table ──────────────────────────────────────────────────────── */}
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: 11,
            border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden",
          }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                {["Stage", "Type", "Result", "Charged (€)", "Credits", "Duration"].map((h) => (
                  <th key={h} style={{
                    padding: "5px 8px", textAlign: h === "Stage" || h === "Type" ? "left" : "right",
                    fontSize: 10, fontWeight: 700, color: "#374151",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid #e5e7eb",
                  }}>
                    {h === "Result" ? <span style={{ textAlign: "center", display: "block" }}>{h}</span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "12px 8px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
                    No stages match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((stage, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? "1px solid #f3f4f6" : undefined }}>
                    <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 11, color: "#111827" }}>
                      {stage.stageLabel}
                    </td>
                    <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>
                      {stage.enrichmentType ?? "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <ResultBadge result={stage.result} />
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>
                      {stage.centsCharged > 0
                        ? `€${(stage.centsCharged / 100).toFixed(4)}`
                        : stage.result === "cached" ? "cached" : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
                      {stage.result === "charged" ? stage.creditCost.toFixed(3) : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>
                      {stage.durationMs > 0 ? `${stage.durationMs}ms` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Source note ──────────────────────────────────────────────────────── */}
        <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontStyle: "italic" }}>
          {debug.source === "trace"
            ? "Intent view — built from stage trace before async billing fires. " +
              "For actual outcomes see Admin → Tenants → Billing → Debug."
            : `Actual outcomes from usage_events DB. Request: ${debug.requestId}`
          }
        </p>
      </div>
    </details>
  );
}
