"use client";

/**
 * BlueprintsClient — Interactive Blueprint Marketplace
 *
 * Renders blueprint cards with preview and activation UX:
 *   1. Browse — card grid showing all available blueprints.
 *   2. Preview — expanded modal-style view with pages, rules, scoring summary.
 *   3. Activate — confirmation warning + server action call.
 *   4. Result — success/error feedback.
 */

import { useState, useTransition } from "react";
import { applyBlueprint }          from "@/blueprints/apply-blueprint";

// ── Types (serializable subset of Blueprint for client) ───────────────────────

interface BlueprintSummary {
  key:                    string;
  name:                   string;
  description:            string;
  longDescription:        string | null;
  industry:               string;
  tags:                   string[];
  recommendedThemePreset: string | null;
  pageCount:              number;
  ruleCount:              number;
  scoringRuleCount:       number;
  sequenceCount:          number;
  pages:                  Array<{ slug: string; title: string; blocks: string[] }>;
  rules:                  Array<{ label: string; reason: string }>;
  scoringRules:           Array<{ label: string; event_type: string; score: number }>;
}

interface Props {
  tenantId:   string;
  blueprints: BlueprintSummary[];
}

const INDUSTRY_ICONS: Record<string, string> = {
  b2b_saas:                "⚙️",
  ecommerce:               "🛍️",
  healthcare:              "🏥",
  lead_gen:                "🎯",
  marketplace:             "🏪",
  professional_services:   "💼",
  recruitment:             "👥",
  media:                   "📰",
};

// ── Main component ────────────────────────────────────────────────────────────

export function BlueprintsClient({ tenantId, blueprints }: Props) {
  const [preview,   setPreview]   = useState<BlueprintSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [result,    setResult]    = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function openPreview(bp: BlueprintSummary) {
    setPreview(bp);
    setConfirming(false);
    setResult(null);
  }

  function closePreview() {
    setPreview(null);
    setConfirming(false);
    setResult(null);
    setForceMode(false);
  }

  function handleActivate() {
    if (!preview) return;
    startTransition(async () => {
      const res = await applyBlueprint({
        tenantId,
        blueprint: blueprints.find((b) => b.key === preview.key) as never,
        force:      forceMode,
        applyTheme: true,
      });
      setResult({
        ok:      res.ok,
        message: res.ok
          ? `✓ Blueprint applied. ${res.rulesCreated} rules, ${res.scoringRulesCreated} scoring rules, ${res.sequencesCreated} sequences created.${res.themeApplied ? " Theme updated." : ""}`
          : `Error: ${res.error ?? "Unknown error"}`,
      });
      setConfirming(false);
    });
  }

  return (
    <>
      {/* ── Blueprint card grid ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {blueprints.map((bp) => (
          <div
            key={bp.key}
            style={{
              border:       "1px solid #e5e7eb",
              borderRadius: "8px",
              padding:      "1.25rem",
              background:   "#fff",
              cursor:       "pointer",
              transition:   "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            onClick={() => openPreview(bp)}
          >
            <div style={{ fontSize: "24px", marginBottom: "0.5rem" }}>
              {INDUSTRY_ICONS[bp.industry] ?? "📦"}
            </div>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px", color: "#111827" }}>
              {bp.name}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "0.75rem", lineHeight: 1.4 }}>
              {bp.description}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              <Pill>{bp.pageCount} pages</Pill>
              <Pill>{bp.ruleCount} rules</Pill>
              <Pill>{bp.scoringRuleCount} scoring</Pill>
              {bp.recommendedThemePreset && (
                <Pill>{bp.recommendedThemePreset}</Pill>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Preview overlay ────────────────────────────────────────── */}
      {preview && (
        <div
          style={{
            position:   "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.4)",
            display:    "flex", alignItems: "center", justifyContent: "center",
            padding:    "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div style={{
            background:   "#fff",
            borderRadius: "12px",
            width:        "100%",
            maxWidth:     "680px",
            maxHeight:    "85vh",
            overflowY:    "auto",
            padding:      "1.5rem",
            fontFamily:   "system-ui, sans-serif",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>
                  {INDUSTRY_ICONS[preview.industry] ?? "📦"} {preview.name}
                </div>
                {preview.longDescription && (
                  <div style={{ fontSize: "13px", color: "#6b7280", maxWidth: "520px" }}>
                    {preview.longDescription}
                  </div>
                )}
              </div>
              <button
                onClick={closePreview}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#9ca3af", padding: "0 0 0 1rem" }}
              >
                ×
              </button>
            </div>

            {/* Includes summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <Section title="Pages">
                {preview.pages.map((p) => (
                  <div key={p.slug} style={{ marginBottom: "6px" }}>
                    <span style={{ fontWeight: 600, fontSize: "12px", color: "#374151" }}>{p.title}</span>{" "}
                    <span style={{ color: "#9ca3af", fontSize: "11px" }}>{p.slug}</span>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      {p.blocks.slice(0, 4).join(" → ")}{p.blocks.length > 4 ? " →…" : ""}
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Behavioral Rules">
                {preview.rules.map((r, i) => (
                  <div key={i} style={{ marginBottom: "6px", fontSize: "12px" }}>
                    <div style={{ fontWeight: 600, color: "#374151" }}>{r.label}</div>
                    <div style={{ color: "#6b7280" }}>{r.reason}</div>
                  </div>
                ))}
              </Section>
            </div>

            <Section title="Scoring Rules">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {preview.scoringRules.map((sr) => (
                  <div key={sr.label} style={{
                    border: "1px solid #e5e7eb", borderRadius: "4px",
                    padding: "3px 7px", fontSize: "11px",
                    background: "#f9fafb",
                  }}>
                    <strong>{sr.label}</strong>
                    {" "}
                    <span style={{ color: "#6b7280" }}>{sr.event_type}</span>
                    {" "}
                    <span style={{ color: "#10b981", fontWeight: 700 }}>+{sr.score}</span>
                  </div>
                ))}
              </div>
            </Section>

            {preview.recommendedThemePreset && (
              <div style={{ marginTop: "0.75rem", fontSize: "12px", color: "#6b7280" }}>
                Theme: <strong style={{ color: "#374151" }}>{preview.recommendedThemePreset}</strong> will be applied.
              </div>
            )}

            {/* Result banner */}
            {result && (
              <div style={{
                marginTop:    "1rem",
                padding:      "10px 14px",
                borderRadius: "6px",
                background:   result.ok ? "#dcfce7" : "#fee2e2",
                color:        result.ok ? "#166534" : "#991b1b",
                fontSize:     "13px",
                fontWeight:   600,
              }}>
                {result.message}
              </div>
            )}

            {/* Warning + actions */}
            {!result && (
              <>
                {confirming ? (
                  <div style={{ marginTop: "1rem", padding: "12px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", marginBottom: "8px" }}>
                      ⚠️ Are you sure?
                    </div>
                    <div style={{ fontSize: "12px", color: "#78350f", marginBottom: "10px" }}>
                      This will create behavioral rules, scoring rules, and sequences for this tenant.
                      Existing scoring rules/sequences with the same keys will be <strong>skipped</strong> unless you enable Force mode.
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#78350f", marginBottom: "12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={forceMode}
                        onChange={(e) => setForceMode(e.target.checked)}
                      />
                      Force overwrite (replaces existing rules and scoring rules)
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={handleActivate}
                        disabled={isPending}
                        style={{
                          padding: "8px 16px", background: "#111827", color: "#fff",
                          border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        {isPending ? "Applying…" : "Yes, apply blueprint"}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        style={{
                          padding: "8px 14px", background: "transparent", color: "#374151",
                          border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", marginTop: "1.25rem" }}>
                    <button
                      onClick={() => setConfirming(true)}
                      style={{
                        padding: "9px 20px", background: "#111827", color: "#fff",
                        border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Activate Blueprint
                    </button>
                    <button
                      onClick={closePreview}
                      style={{
                        padding: "9px 16px", background: "transparent", color: "#374151",
                        border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}

            {result?.ok && (
              <button
                onClick={closePreview}
                style={{
                  marginTop: "0.75rem",
                  padding: "8px 16px", background: "transparent", color: "#374151",
                  border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding:      "1px 7px",
      background:   "#f3f4f6",
      color:        "#374151",
      borderRadius: "99px",
      fontSize:     "11px",
      fontWeight:   500,
      border:       "1px solid #e5e7eb",
    }}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
