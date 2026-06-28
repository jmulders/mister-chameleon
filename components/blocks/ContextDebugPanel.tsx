/**
 * ContextDebugPanel
 *
 * Dev-only server component that renders a full context-variable inspection
 * view inside the homepage diagnostics section.
 *
 * ─── What this replaces ──────────────────────────────────────────────────────
 *
 *   The old one-liner:
 *     "Context snapshot: country=— company=— crm=no match"
 *
 *   This was misleading because it only surfaced three of ~45 configured
 *   context variables, and gave no indication of what was missing vs resolved.
 *
 * ─── What this shows ─────────────────────────────────────────────────────────
 *
 *   1. Compact summary row   — "n / total resolved" per source, inline
 *   2. Per-source detail view — each group is a collapsible <details> block
 *      showing every variable: key, resolved value, type badge, and
 *      availability flags (rules / AI).
 *   3. Unresolved variables  — explicitly shown as "—" in muted colour
 *      so "not resolved" is never hidden.
 *
 * ─── Interactivity ────────────────────────────────────────────────────────────
 *
 *   Uses native HTML <details>/<summary> — zero JavaScript, zero Tailwind,
 *   works in any browser without hydration.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Render this only when NODE_ENV === "development" or ?debug=1 is set.
 *   The caller (page.tsx) is responsible for that guard.
 */

import type { FullContextSnapshot }              from "@/context/debug-snapshot";
import { SOURCE_DISPLAY_ORDER, formatContextValue } from "@/context/debug-snapshot";
import type { ContextVarSource }                 from "@/context/registry";
import type { EnrichmentFieldTrace }             from "@/enrichment/types";
import type { ScenarioOverrides }                from "@/components/scenario/scenario-store";
import type { KnownLeadContext }                 from "@/decision/decision-context";
import { CONTEXT_FAMILIES }                      from "@/context/library";
import type { ContextMatch }                     from "@/context/library";
import type { ThemeDecisionTrace }               from "@/decision/theme-decision";
import type { ScoringDebugPayload }              from "@/lib/journey/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContextDebugPanelProps {
  snapshot:          FullContextSnapshot;
  /** When scenario mode is active, display which fields are being overridden. */
  scenarioOverrides?: ScenarioOverrides;
}

// ── Source display metadata ───────────────────────────────────────────────────

const SOURCE_META: Record<
  ContextVarSource,
  { label: string; colour: string; bg: string; border: string }
> = {
  request: {
    label:  "Request",
    colour: "#2563eb",
    bg:     "#eff6ff",
    border: "#bfdbfe",
  },
  session: {
    label:  "Session",
    colour: "#7c3aed",
    bg:     "#f5f3ff",
    border: "#ddd6fe",
  },
  history: {
    label:  "History",
    colour: "#0891b2",
    bg:     "#ecfeff",
    border: "#a5f3fc",
  },
  tenant: {
    label:  "Tenant",
    colour: "#d97706",
    bg:     "#fffbeb",
    border: "#fde68a",
  },
  page: {
    label:  "Page",
    colour: "#059669",
    bg:     "#ecfdf5",
    border: "#a7f3d0",
  },
  enrichment: {
    label:  "Enrichment",
    colour: "#be185d",
    bg:     "#fdf2f8",
    border: "#fbcfe8",
  },
  time: {
    label:  "Time",
    colour: "#64748b",
    bg:     "#f8fafc",
    border: "#e2e8f0",
  },
  client: {
    label:  "Client / Browser",
    colour: "#0f766e",
    bg:     "#f0fdfa",
    border: "#99f6e4",
  },
  derived: {
    label:  "Derived",
    colour: "#ea580c",
    bg:     "#fff7ed",
    border: "#fed7aa",
  },
  intent: {
    label:  "Intent",
    colour: "#7c3aed",
    bg:     "#faf5ff",
    border: "#e9d5ff",
  },
};

// ── Main component ─────────────────────────────────────────────────────────────

// ── Scenario override summary ─────────────────────────────────────────────────

/** Labels for each ScenarioOverrides key shown in the override summary block. */
const OVERRIDE_LABELS: Partial<Record<keyof ScenarioOverrides, string>> = {
  visitType:           "visitType",
  source:              "source",
  utmSource:           "utmSource",
  utmMedium:           "utmMedium",
  utmCampaign:         "utmCampaign",
  ipAddress:           "ipAddress",
  city:                "city",
  companyName:         "companyName",
  latitude:            "latitude",
  longitude:           "longitude",
  interestPrimary:     "interestPrimary",
  interestSecondary:   "interestSecondary",
  interestConfidence:  "interestConfidence",
  funnelStage:         "funnelStage",
  intentScore:         "intentScore",
  frictionScore:       "frictionScore",
  overallConfidence:   "overallConfidence",
  isCustomer:          "isCustomer",
  planTier:            "planTier",
  hasVisitedPricing:   "hasVisitedPricing",
  hasStartedForm:      "hasStartedForm",
  hasSubmittedForm:    "hasSubmittedForm",
  matchedSequences:    "matchedSequences",
  pageViewCount:       "pageViewCount",
  // Time / temporal overrides
  currentHour:         "currentHour",
  dayOfWeek:           "dayOfWeek",
  isWeekend:           "isWeekend",
  month:               "month",
  dateKey:             "dateKey",
  timeOfDay:           "timeOfDay",
  seasonalEvent:       "seasonalEvent",
};

/** Groups for the override summary — maps each override key to a group label. */
const OVERRIDE_GROUPS: Record<string, (keyof ScenarioOverrides)[]> = {
  "Request / Session": ["visitType", "source", "utmSource", "utmMedium", "utmCampaign", "ipAddress"],
  "Time / Temporal":   ["timeOfDay", "currentHour", "dayOfWeek", "isWeekend", "month", "dateKey", "seasonalEvent"],
  "Enrichment":        ["city", "companyName", "latitude", "longitude"],
  "Interests":         ["interestPrimary", "interestSecondary", "interestConfidence"],
  "Behavior":          ["funnelStage", "intentScore", "frictionScore", "overallConfidence",
                        "hasVisitedPricing", "hasStartedForm", "hasSubmittedForm", "matchedSequences"],
  "Lifecycle":         ["isCustomer", "planTier"],
  "Other":             ["pageViewCount"],
};

function ScenarioOverrideSummary({ overrides }: { overrides: ScenarioOverrides }) {
  const entries = Object.entries(overrides).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;

  // Bucket entries into their groups.
  const grouped: Record<string, [string, unknown][]> = {};
  const usedKeys = new Set<string>();

  for (const [groupLabel, keys] of Object.entries(OVERRIDE_GROUPS)) {
    const hits: [string, unknown][] = [];
    for (const k of keys) {
      if (overrides[k] !== undefined) {
        hits.push([OVERRIDE_LABELS[k] ?? k, overrides[k]]);
        usedKeys.add(k);
      }
    }
    if (hits.length > 0) grouped[groupLabel] = hits;
  }

  // Anything not in a group falls under "Other".
  const ungrouped = entries.filter(([k]) => !usedKeys.has(k));
  if (ungrouped.length > 0) {
    grouped["Other"] = [...(grouped["Other"] ?? []), ...ungrouped.map(([k, v]) => [k, v] as [string, unknown])];
  }

  return (
    <div style={{
      margin:       "0.75rem 0",
      padding:      "10px 14px",
      background:   "#fff7ed",
      border:       "1px solid #fb923c",
      borderRadius: "8px",
      fontSize:     "12px",
    }}>
      <div style={{ fontWeight: 700, color: "#c2410c", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        ⚡ Scenario overrides active — {entries.length} field{entries.length !== 1 ? "s" : ""} overridden
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div style={{ fontWeight: 600, color: "#9a3412", fontSize: 10, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: 4 }}>
              {group}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
              {items.map(([label, value]) => (
                <span key={label} style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          4,
                  background:   "#fed7aa",
                  borderRadius: 4,
                  padding:      "2px 7px",
                  fontSize:     11,
                  fontFamily:   "monospace",
                  color:        "#7c2d12",
                  border:       "1px solid #fb923c",
                }}>
                  <span style={{ color: "#9a3412", fontFamily: "inherit" }}>{label}</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span style={{ fontWeight: 700 }}>
                    {Array.isArray(value)
                      ? (value as unknown[]).length === 0 ? "[]" : `[${(value as unknown[]).join(", ")}]`
                      : String(value ?? "null")}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#c2410c", fontStyle: "italic" }}>
        Effective context below reflects these overrides. Real values restored when scenario exits.
      </div>
    </div>
  );
}

// ── ABM known-lead section ─────────────────────────────────────────────────────

/**
 * Always-visible badge shown when the visitor arrived via a personalized URL
 * (the mc_lead cookie resolved to an active lead). Surfaces the deterministic
 * identity + the segment it forced, so it's clear at a glance what the redirect
 * injected — which the Scenario Control panel (a manual override) does not show.
 */
function KnownLeadSection({ lead, forcedSegment }: { lead: KnownLeadContext; forcedSegment: string | null }) {
  const chips: Array<{ label: string; value: string }> = [
    ...(lead.name        ? [{ label: "Name",     value: lead.name }]        : (lead.firstName ? [{ label: "Name", value: lead.firstName }] : [])),
    ...(lead.company     ? [{ label: "Company",  value: lead.company }]     : []),
    ...(lead.role        ? [{ label: "Role",     value: lead.role }]        : []),
    ...(lead.industry    ? [{ label: "Industry", value: lead.industry }]    : []),
    ...(lead.companySize ? [{ label: "Size",     value: lead.companySize }] : []),
  ];
  return (
    <div style={{
      margin:       "0.75rem 0",
      border:       "1px solid #c7d2fe",
      borderRadius: "6px",
      background:   "#eef2ff",
      padding:      "0.6rem 0.75rem",
      fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
      fontSize:     "12px",
    }}>
      <div style={{ fontWeight: 700, color: "#3730a3", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        🎯 ABM — Known lead
        <span style={{ background: "#4338ca", color: "#fff", borderRadius: 3, padding: "0 5px", fontSize: 10, letterSpacing: "0.05em" }}>
          {lead.confidence}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
        {chips.map((c) => (
          <span key={c.label} style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 3, padding: "1px 6px", color: "#3730a3" }}>
            <span style={{ color: "#6366f1" }}>{c.label}:</span> {c.value}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#4338ca" }}>
        Forced segment:{" "}
        {forcedSegment
          ? <code style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 3, padding: "0 4px" }}>{forcedSegment}</code>
          : <span style={{ color: "#818cf8", fontStyle: "italic" }}>none linked</span>}
        <span style={{ marginLeft: 10, color: "#6366f1", fontStyle: "italic" }}>
          Firmographics loaded into enrichment (companyName / companyIndustry / companySize / targetAccountMatched).
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ContextDebugPanel({ snapshot, scenarioOverrides }: ContextDebugPanelProps) {
  const { bySource, totalResolved, totalVars, matchedContexts, themeDecision, scoringDebug, knownLead, forcedSegment } = snapshot;

  // Build the ordered list of sources that are actually present.
  const orderedSources = [
    ...SOURCE_DISPLAY_ORDER.filter((s) => bySource[s]),
    ...Object.keys(bySource).filter(
      (s) => !SOURCE_DISPLAY_ORDER.includes(s as ContextVarSource),
    ) as ContextVarSource[],
  ];

  return (
    <>
      {/* ABM known-lead identity — always visible at the top when present */}
      {knownLead && <KnownLeadSection lead={knownLead} forcedSegment={forcedSegment ?? null} />}

      {/* Scenario override summary — rendered outside the <details> so it's always visible */}
      {scenarioOverrides && <ScenarioOverrideSummary overrides={scenarioOverrides} />}

      {/* Behavioral scoring debug */}
      {scoringDebug !== undefined && (
        <ScoringDebugSection debug={scoringDebug} />
      )}

      {/* Theme decision explainability */}
      {themeDecision !== undefined && (
        <ThemeDecisionSection trace={themeDecision} />
      )}

      {/* Context Library matched audience profiles */}
      {matchedContexts !== undefined && (
        <MatchedContextsSection matches={matchedContexts} />
      )}

    <details
      open
      style={{
        margin:       "0.75rem 0",
        border:       "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow:     "hidden",
        fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        fontSize:     "12px",
      }}
    >
      {/* ── Panel header / summary ─────────────────────────────────────── */}
      <summary
        style={{
          cursor:          "pointer",
          padding:         "0.5rem 0.75rem",
          background:      "#1e293b",
          color:           "#f1f5f9",
          display:         "flex",
          alignItems:      "center",
          gap:             "0.75rem",
          listStyle:       "none",
          userSelect:      "none",
        }}
      >
        <span
          style={{
            background:   "#f59e0b",
            color:        "#1c1917",
            borderRadius: "3px",
            padding:      "0 5px",
            fontWeight:   700,
            fontSize:     "10px",
            letterSpacing: "0.05em",
          }}
        >
          CTX
        </span>

        <span style={{ fontWeight: 600 }}>
          Context Variables
        </span>

        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
          {totalResolved} / {totalVars} resolved
        </span>

        {/* Compact per-source summary pills */}
        <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {orderedSources.map((src) => {
            const entries = bySource[src] ?? [];
            const resolved = entries.filter((e) => e.isResolved).length;
            const meta = SOURCE_META[src] ?? { label: src, colour: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };
            const allResolved = resolved === entries.length;

            return (
              <span
                key={src}
                style={{
                  padding:      "1px 6px",
                  borderRadius: "9999px",
                  border:       `1px solid ${meta.border}`,
                  background:   meta.bg,
                  color:        allResolved ? meta.colour : "#6b7280",
                  fontSize:     "10px",
                  whiteSpace:   "nowrap",
                }}
                title={`${meta.label}: ${resolved}/${entries.length} resolved`}
              >
                {meta.label.toLowerCase()} {resolved}/{entries.length}
              </span>
            );
          })}
        </span>
      </summary>

      {/* ── Source groups ──────────────────────────────────────────────── */}
      <div style={{ background: "#ffffff" }}>
        {orderedSources.map((src) => {
          const entries = bySource[src] ?? [];
          const resolved = entries.filter((e) => e.isResolved).length;
          const meta = SOURCE_META[src] ?? { label: src, colour: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };

          return (
            <details
              key={src}
              open
              style={{
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              {/* Group header */}
              <summary
                style={{
                  cursor:          "pointer",
                  padding:         "0.35rem 0.75rem",
                  background:      meta.bg,
                  borderLeft:      `3px solid ${meta.colour}`,
                  display:         "flex",
                  alignItems:      "center",
                  gap:             "0.5rem",
                  listStyle:       "none",
                  userSelect:      "none",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color:      meta.colour,
                    minWidth:   "80px",
                  }}
                >
                  {meta.label}
                </span>
                <span style={{ color: "#6b7280", fontSize: "11px" }}>
                  {resolved} / {entries.length} resolved
                </span>
                {resolved === 0 && (
                  <span
                    style={{
                      marginLeft:   "auto",
                      color:        "#9ca3af",
                      fontSize:     "10px",
                      fontStyle:    "italic",
                    }}
                  >
                    all unresolved
                  </span>
                )}
              </summary>

              {/* Variable rows */}
              <table
                style={{
                  width:           "100%",
                  borderCollapse:  "collapse",
                  fontSize:        "11px",
                  tableLayout:     "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr
                    style={{
                      background:   "#f8fafc",
                      borderBottom: "1px solid #e5e7eb",
                      color:        "#94a3b8",
                    }}
                  >
                    <th style={{ padding: "3px 8px", textAlign: "left", fontWeight: 600 }}>key</th>
                    <th style={{ padding: "3px 8px", textAlign: "left", fontWeight: 600 }}>value</th>
                    <th style={{ padding: "3px 8px", textAlign: "center", fontWeight: 600 }}>type</th>
                    <th style={{ padding: "3px 8px", textAlign: "center", fontWeight: 600 }}>rules</th>
                    <th style={{ padding: "3px 8px", textAlign: "center", fontWeight: 600 }}>AI</th>
                    <th style={{ padding: "3px 8px", textAlign: "left", fontWeight: 600 }}>label</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const displayValue = formatContextValue(entry);
                    const isEven = i % 2 === 0;

                    return (
                      <tr
                        key={entry.key}
                        style={{
                          background:   entry.isOverridden
                            ? "#fffbeb"   // amber-50 — overridden by Scenario Control
                            : isEven ? "#ffffff" : "#fafafa",
                          borderBottom: entry.isOverridden
                            ? "1px solid #fde68a"   // amber-200
                            : "1px solid #f1f5f9",
                        }}
                        title={entry.isOverridden ? `⚡ Overridden by Scenario Control — ${entry.description}` : entry.description}
                      >
                        {/* key */}
                        <td
                          style={{
                            padding:    "4px 8px",
                            color:      entry.isResolved ? "#1e293b" : "#94a3b8",
                            fontWeight: entry.isResolved ? 600 : 400,
                            overflow:   "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.isOverridden && (
                            <span
                              style={{
                                display:      "inline-flex",
                                alignItems:   "center",
                                marginRight:  "4px",
                                padding:      "0 3px",
                                background:   "#f59e0b",
                                borderRadius: "2px",
                                fontSize:     "9px",
                                fontWeight:   700,
                                color:        "#1c1917",
                                verticalAlign: "middle",
                                letterSpacing: "0.03em",
                              }}
                            >
                              ⚡
                            </span>
                          )}
                          {entry.key}
                        </td>

                        {/* value + optional raw/override display + enrichment trace badge */}
                        <td
                          style={{
                            padding:      "4px 8px",
                            overflow:     "hidden",
                          }}
                        >
                          {displayValue !== null ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flexWrap: "nowrap" }}>
                              {/* If overridden AND rawValue is available, show "raw → effective" */}
                              {entry.isOverridden && entry.rawValue !== undefined ? (
                                <span style={{ display: "flex", alignItems: "center", gap: "3px", overflow: "hidden", flex: "1 1 0", minWidth: 0 }}>
                                  <span
                                    style={{
                                      color:          "#94a3b8",
                                      textDecoration: "line-through",
                                      overflow:       "hidden",
                                      textOverflow:   "ellipsis",
                                      whiteSpace:     "nowrap",
                                      fontSize:       "10px",
                                    }}
                                    title="Raw value (before scenario override)"
                                  >
                                    {entry.rawValue === null ? "null" : String(entry.rawValue)}
                                  </span>
                                  <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>→</span>
                                  <span
                                    style={{
                                      color:        "#b45309",
                                      fontStyle:    "italic",
                                      overflow:     "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace:   "nowrap",
                                    }}
                                    title="Effective value (scenario override active)"
                                  >
                                    {displayValue}
                                  </span>
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: entry.isOverridden
                                      ? "#b45309"   // amber-700 for overridden values
                                      : entry.type === "boolean"
                                        ? (entry.value === true ? "#059669" : "#dc2626")
                                        : "#1e293b",
                                    overflow:     "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace:   "nowrap",
                                    flex:         "1 1 0",
                                    minWidth:     0,
                                    fontStyle:    entry.isOverridden ? "italic" : "normal",
                                  }}
                                >
                                  {displayValue}
                                </span>
                              )}
                              {entry.trace && (
                                <EnrichmentTraceBadge trace={entry.trace} />
                              )}
                            </span>
                          ) : (
                            <span style={{ color: "#d1d5db", fontStyle: "italic" }}>
                              — null
                            </span>
                          )}
                        </td>

                        {/* type badge */}
                        <td style={{ padding: "4px 8px", textAlign: "center" }}>
                          <TypeBadge type={entry.type} />
                        </td>

                        {/* rules flag */}
                        <td style={{ padding: "4px 8px", textAlign: "center", color: entry.availableToRules ? "#2563eb" : "#d1d5db" }}>
                          {entry.availableToRules ? "✓" : "·"}
                        </td>

                        {/* AI flag */}
                        <td style={{ padding: "4px 8px", textAlign: "center", color: entry.availableToAI ? "#059669" : "#d1d5db" }}>
                          {entry.availableToAI ? "✓" : "·"}
                        </td>

                        {/* label */}
                        <td
                          style={{
                            padding:      "4px 8px",
                            color:        "#64748b",
                            overflow:     "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace:   "nowrap",
                          }}
                        >
                          {entry.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>

      {/* ── Footer legend ──────────────────────────────────────────────── */}
      <div
        style={{
          padding:     "0.35rem 0.75rem",
          background:  "#f8fafc",
          borderTop:   "1px solid #e5e7eb",
          color:       "#94a3b8",
          fontSize:    "10px",
          display:     "flex",
          gap:         "1rem",
          flexWrap:    "wrap",
        }}
      >
        <span>— null  =  not resolved (no data available)</span>
        <span>rules ✓ = usable in rule conditions</span>
        <span>AI ✓ = included in AI context snapshot</span>
        <span>hover a row for description</span>
      </div>
    </details>
    </>
  );
}

// ── Internal sub-components ───────────────────────────────────────────────────

/**
 * Shows a compact enrichment provenance chip next to a resolved value.
 * Displays the provider label and a cache-status indicator (hit/miss/n/a).
 *
 * Rendered inline in the value cell for `source === "enrichment"` rows
 * that have a `trace` attached via buildFullContextSnapshot().
 */
function EnrichmentTraceBadge({ trace }: { trace: EnrichmentFieldTrace }) {
  const cacheColour =
    trace.cacheStatus === "hit"  ? "#059669" :
    trace.cacheStatus === "miss" ? "#d97706" :
    "#94a3b8"; // n/a

  const cacheLabel =
    trace.cacheStatus === "hit"  ? "cache" :
    trace.cacheStatus === "miss" ? "fresh" :
    "n/a";

  return (
    <span
      title={`Provider: ${trace.provider}\nSource: ${trace.source}\nCache: ${trace.cacheStatus}\nInputs: ${trace.inputsUsed.join(", ") || "—"}`}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "3px",
        flexShrink:   0,
        cursor:       "default",
      }}
    >
      {/* Provider chip */}
      <span
        style={{
          padding:      "0 4px",
          borderRadius: "3px",
          background:   "#f1f5f9",
          color:        "#475569",
          fontSize:     "9px",
          fontWeight:   600,
          whiteSpace:   "nowrap",
          maxWidth:     "70px",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {trace.provider}
      </span>
      {/* Cache-status dot */}
      <span
        style={{
          display:      "inline-block",
          width:        "6px",
          height:       "6px",
          borderRadius: "50%",
          background:   cacheColour,
          flexShrink:   0,
        }}
        title={cacheLabel}
      />
    </span>
  );
}

// ── Scoring debug section ─────────────────────────────────────────────────────

/**
 * Shows a per-rule scoring breakdown for the intentScore.
 *
 * Only rendered when snapshot.scoringDebug is populated (i.e. a fresh
 * deriveBehaviorState() was run in the same request, typically after event
 * recording or when ?debug=1 forces recompute).
 */
function ScoringDebugSection({ debug }: { debug: ScoringDebugPayload }) {
  const total = debug.ruleContributions.reduce((s, r) => s + r.effectiveScore, 0);
  const maxScore = Math.max(...debug.ruleContributions.map((r) => r.effectiveScore), 1);

  return (
    <details
      style={{
        margin:       "0.75rem 0",
        border:       "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow:     "hidden",
        fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        fontSize:     "12px",
      }}
    >
      {/* Header */}
      <summary
        style={{
          cursor:     "pointer",
          padding:    "0.5rem 0.75rem",
          background: "#1e293b",
          color:      "#f1f5f9",
          display:    "flex",
          alignItems: "center",
          gap:        "0.75rem",
          listStyle:  "none",
          userSelect: "none",
          flexWrap:   "wrap",
        }}
      >
        <span style={{
          background: "#0891b2", color: "#fff", borderRadius: "3px",
          padding: "0 5px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em",
        }}>
          SCORE
        </span>
        <span style={{ fontWeight: 600 }}>Behavioral Scoring Breakdown</span>
        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
          {debug.ruleContributions.length} rule{debug.ruleContributions.length !== 1 ? "s" : ""} fired
        </span>
        <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "11px" }}>
          raw intentScore: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{Math.round(Math.min(total, 100))}</span>
        </span>
      </summary>

      {/* Body */}
      <div style={{ background: "#fff", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem",
          background: "#f8fafc", borderRadius: "5px", padding: "0.5rem 0.75rem",
          fontSize: "11px",
        }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Events</div>
            <div style={{ color: "#1e293b", fontWeight: 700 }}>{debug.processedEventCount}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Deduped</div>
            <div style={{ color: "#dc2626", fontWeight: 700 }}>{debug.deduplicatedCount}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Raw sum</div>
            <div style={{ color: "#1e293b", fontWeight: 700 }}>{Math.round(debug.rawTotalScore * 10) / 10}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Clamped</div>
            <div style={{ color: "#059669", fontWeight: 700 }}>{Math.round(Math.min(debug.rawTotalScore, 100))}</div>
          </div>
        </div>

        {/* Per-rule bars */}
        {debug.ruleContributions.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "11px", fontStyle: "italic" }}>
            No scoring rules matched any events in this session.
          </p>
        ) : (
          <div>
            <div style={{
              fontSize: "10px", fontWeight: 700, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px",
            }}>
              Rule contributions (sorted by impact)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {debug.ruleContributions.map((r) => {
                const barWidth = Math.round((r.effectiveScore / maxScore) * 100);
                const pct      = Math.round(total > 0 ? (r.effectiveScore / total) * 100 : 0);
                return (
                  <div
                    key={r.ruleKey}
                    style={{
                      border: "1px solid #f1f5f9", borderRadius: "4px",
                      padding: "4px 8px", background: "#fafafa",
                    }}
                  >
                    {/* Rule name + event type */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "3px" }}>
                      <span style={{ color: "#1e293b", fontWeight: 600, fontSize: "11px" }}>
                        {r.ruleName}
                      </span>
                      <span style={{
                        fontFamily: "monospace", fontSize: "9px",
                        background: "#e0e7ff", color: "#4338ca",
                        padding: "0 3px", borderRadius: "2px",
                      }}>
                        {r.eventType}
                      </span>
                      <span style={{ marginLeft: "auto", color: "#059669", fontWeight: 700, fontSize: "11px" }}>
                        +{Math.round(r.effectiveScore * 10) / 10}
                      </span>
                      <span style={{ color: "#94a3b8", fontSize: "10px" }}>{pct}%</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      height: "4px", background: "#e5e7eb", borderRadius: "2px",
                      overflow: "hidden", marginBottom: "3px",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: "2px",
                        background: "#0891b2",
                        width: `${barWidth}%`,
                        transition: "width 0.2s ease",
                      }} />
                    </div>

                    {/* Metadata row */}
                    <div style={{ display: "flex", gap: "0.5rem", fontSize: "10px", color: "#94a3b8" }}>
                      <span>{r.eventCount} event{r.eventCount !== 1 ? "s" : ""}</span>
                      <span>raw: {Math.round(r.rawScore * 10) / 10}</span>
                      <span>decay: {r.decayProfile}</span>
                      <span>key: <span style={{ fontFamily: "monospace", color: "#64748b" }}>{r.ruleKey}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </details>
  );
}

// ── Theme decision section ────────────────────────────────────────────────────

const TRIGGER_MODE_BADGE: Record<
  ThemeDecisionTrace["triggerMode"],
  { label: string; bg: string; color: string }
> = {
  raw_condition:          { label: "RAW",     bg: "#f1f5f9", color: "#475569"  },
  context_match:          { label: "CTX",     bg: "#eef2ff", color: "#4338ca"  },
  context_plus_condition: { label: "CTX+",    bg: "#f5f3ff", color: "#7c3aed"  },
  session_lock:           { label: "LOCKED",  bg: "#fef9c3", color: "#854d0e"  },
  default:                { label: "DEFAULT", bg: "#f0fdf4", color: "#15803d"  },
};

/**
 * Theme decision explainability panel.
 *
 * Shows:
 *  - The resolved theme, trigger mode, and matched rule
 *  - Context Library IDs that were matched (for CTX / CTX+ modes)
 *  - All evaluated candidate rules in priority order (matched first)
 *  - Why the winning rule fired (or why the default was used)
 */
function ThemeDecisionSection({ trace }: { trace: ThemeDecisionTrace }) {
  const badge = TRIGGER_MODE_BADGE[trace.triggerMode];
  const matchedCount = trace.candidates.filter((c) => c.matched).length;

  return (
    <details
      open
      style={{
        margin:       "0.75rem 0",
        border:       "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow:     "hidden",
        fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        fontSize:     "12px",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <summary
        style={{
          cursor:     "pointer",
          padding:    "0.5rem 0.75rem",
          background: "#1e293b",
          color:      "#f1f5f9",
          display:    "flex",
          alignItems: "center",
          gap:        "0.75rem",
          listStyle:  "none",
          userSelect: "none",
          flexWrap:   "wrap",
        }}
      >
        {/* THEME badge */}
        <span style={{
          background: "#f59e0b", color: "#fff", borderRadius: "3px",
          padding: "0 5px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em",
        }}>
          THEME
        </span>

        <span style={{ fontWeight: 600 }}>Theme Decision</span>

        {/* Trigger mode badge */}
        <span style={{
          padding: "1px 6px", borderRadius: "9999px",
          background: badge.bg, color: badge.color,
          fontSize: "10px", fontWeight: 700,
        }}>
          {badge.label}
        </span>

        {/* Resolved theme */}
        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
          →{" "}
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{trace.resolvedTheme}</span>
        </span>

        {/* Candidate count */}
        {trace.candidates.length > 0 && (
          <span style={{ marginLeft: "auto", color: "#64748b", fontSize: "11px" }}>
            {matchedCount}/{trace.candidates.length} rule{trace.candidates.length !== 1 ? "s" : ""} evaluated
          </span>
        )}
      </summary>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* Resolution summary row */}
        <div style={{
          display:      "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:          "0.5rem",
          background:   "#f8fafc",
          borderRadius: "5px",
          padding:      "0.5rem 0.75rem",
          fontSize:     "11px",
        }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Resolved</div>
            <div style={{ color: "#1e293b", fontWeight: 700 }}>{trace.resolvedTheme}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Default</div>
            <div style={{ color: "#64748b" }}>{trace.tenantDefault}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Session</div>
            <div style={{ color: "#64748b" }}>
              {trace.sessionLocked ? `locked (${trace.lockSource})` : trace.lockSource}
            </div>
          </div>
        </div>

        {/* Winning rule */}
        {trace.matchedRuleId ? (
          <div style={{
            border:       "1px solid #bbf7d0",
            borderRadius: "5px",
            background:   "#f0fdf4",
            padding:      "0.5rem 0.75rem",
            fontSize:     "11px",
          }}>
            <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Winning rule
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ color: "#166534", fontWeight: 700 }}>✓</span>
              <span style={{ color: "#1e293b", fontWeight: 600 }}>{trace.matchedRuleLabel}</span>
              <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: "10px" }}>{trace.matchedRuleId}</span>
              {trace.matchedPriority !== null && (
                <span style={{
                  background: "#dcfce7", color: "#15803d",
                  padding: "0 5px", borderRadius: "3px", fontSize: "10px", fontWeight: 600,
                }}>
                  priority {trace.matchedPriority}
                </span>
              )}
            </div>
            {/* Context Library IDs that matched */}
            {trace.matchedContextLibraryIds.length > 0 && (
              <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                <span style={{ color: "#6b7280", fontSize: "10px" }}>Matched context IDs:</span>
                {trace.matchedContextLibraryIds.map((id) => (
                  <span key={id} style={{
                    fontFamily: "monospace", fontSize: "10px",
                    padding: "0 4px", borderRadius: "3px",
                    background: "#eef2ff", color: "#4338ca",
                  }}>
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : trace.triggerMode === "session_lock" ? (
          <div style={{
            border: "1px solid #fef08a", borderRadius: "5px",
            background: "#fefce8", padding: "0.5rem 0.75rem", fontSize: "11px",
            color: "#854d0e",
          }}>
            Session lock applied — rules not re-evaluated. Theme from prior page view.
          </div>
        ) : (
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: "5px",
            background: "#f8fafc", padding: "0.5rem 0.75rem", fontSize: "11px",
            color: "#6b7280", fontStyle: "italic",
          }}>
            No rule matched. Using tenant default: <strong style={{ fontStyle: "normal" }}>{trace.tenantDefault}</strong>.
          </div>
        )}

        {/* Candidate rules */}
        {trace.candidates.length > 0 && (
          <div>
            <div style={{
              fontSize: "10px", fontWeight: 700, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px",
            }}>
              All evaluated rules (priority order)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {trace.candidates.map((c) => {
                const modeBadge = TRIGGER_MODE_BADGE[c.triggerMode];
                return (
                  <div
                    key={c.ruleId}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          "0.5rem",
                      padding:      "4px 6px",
                      borderRadius: "4px",
                      background:   c.matched ? "#f0fdf4" : "#fafafa",
                      border:       `1px solid ${c.matched ? "#bbf7d0" : "#f1f5f9"}`,
                      fontSize:     "11px",
                      flexWrap:     "wrap",
                    }}
                  >
                    {/* Pass/fail indicator */}
                    <span style={{
                      width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: !c.evaluated ? "#f1f5f9" : c.matched ? "#dcfce7" : "#fee2e2",
                      color:      !c.evaluated ? "#9ca3af" : c.matched ? "#15803d" : "#dc2626",
                      fontWeight: 700, fontSize: "9px",
                    }}>
                      {!c.evaluated ? "?" : c.matched ? "✓" : "✗"}
                    </span>

                    {/* Priority */}
                    <span style={{
                      fontFamily: "monospace",
                      background: "#f1f5f9", color: "#475569",
                      padding: "0 4px", borderRadius: "3px", fontSize: "10px",
                    }}>
                      {c.priority}
                    </span>

                    {/* Mode badge */}
                    <span style={{
                      padding: "0 4px", borderRadius: "3px",
                      background: modeBadge.bg, color: modeBadge.color,
                      fontSize: "10px", fontWeight: 600,
                    }}>
                      {modeBadge.label}
                    </span>

                    {/* Label */}
                    <span style={{ color: "#334155", fontWeight: c.matched ? 600 : 400 }}>
                      {c.label}
                    </span>

                    {/* Theme */}
                    <span style={{ marginLeft: "auto", color: c.matched ? "#059669" : "#9ca3af", fontSize: "10px" }}>
                      → {c.themeKey}
                    </span>

                    {/* Context library IDs for this candidate */}
                    {c.matchedContextLibraryIds && c.matchedContextLibraryIds.length > 0 && (
                      <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "2px", paddingLeft: "20px" }}>
                        {c.matchedContextLibraryIds.map((id) => (
                          <span key={id} style={{
                            fontFamily: "monospace", fontSize: "9px",
                            padding: "0 3px", borderRadius: "2px",
                            background: "#eef2ff", color: "#4338ca",
                          }}>
                            {id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </details>
  );
}

// ── Matched Context Library section ───────────────────────────────────────────

/**
 * Renders a collapsible panel showing which named Context Library audience
 * profiles matched the current visitor.
 *
 * Only shown when `snapshot.matchedContexts` is populated (i.e. the caller
 * passed `includeContextLibrary: true` to `buildFullContextSnapshot`).
 */
function MatchedContextsSection({ matches }: { matches: ContextMatch[] }) {
  const familyMap = new Map(CONTEXT_FAMILIES.map((f) => [f.key, f]));

  if (matches.length === 0) {
    return (
      <details
        style={{
          margin:       "0.75rem 0",
          border:       "1px solid #e5e7eb",
          borderRadius: "6px",
          overflow:     "hidden",
          fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
          fontSize:     "12px",
        }}
      >
        <summary
          style={{
            cursor:     "pointer",
            padding:    "0.5rem 0.75rem",
            background: "#1e293b",
            color:      "#f1f5f9",
            display:    "flex",
            alignItems: "center",
            gap:        "0.75rem",
            listStyle:  "none",
            userSelect: "none",
          }}
        >
          <span style={{
            background: "#6366f1", color: "#fff", borderRadius: "3px",
            padding: "0 5px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em",
          }}>
            LIB
          </span>
          <span style={{ fontWeight: 600 }}>Context Library Matches</span>
          <span style={{ color: "#94a3b8", fontSize: "11px" }}>0 matched</span>
        </summary>
        <div style={{ padding: "0.75rem", background: "#fff", color: "#9ca3af", fontSize: "11px", fontStyle: "italic" }}>
          No audience profiles matched the current visitor context.
        </div>
      </details>
    );
  }

  return (
    <details
      open
      style={{
        margin:       "0.75rem 0",
        border:       "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow:     "hidden",
        fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        fontSize:     "12px",
      }}
    >
      {/* Panel header */}
      <summary
        style={{
          cursor:     "pointer",
          padding:    "0.5rem 0.75rem",
          background: "#1e293b",
          color:      "#f1f5f9",
          display:    "flex",
          alignItems: "center",
          gap:        "0.75rem",
          listStyle:  "none",
          userSelect: "none",
        }}
      >
        <span style={{
          background: "#6366f1", color: "#fff", borderRadius: "3px",
          padding: "0 5px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em",
        }}>
          LIB
        </span>
        <span style={{ fontWeight: 600 }}>Context Library Matches</span>
        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
          {matches.length} audience profile{matches.length !== 1 ? "s" : ""} matched
        </span>

        {/* Quick family pills */}
        <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {Array.from(new Set(matches.map((m) => m.definition.family))).map((fKey) => {
            const fam = familyMap.get(fKey);
            const count = matches.filter((m) => m.definition.family === fKey).length;
            return (
              <span
                key={fKey}
                style={{
                  padding:      "1px 6px",
                  borderRadius: "9999px",
                  background:   "#334155",
                  color:        "#cbd5e1",
                  fontSize:     "10px",
                  whiteSpace:   "nowrap",
                }}
              >
                {fam?.label ?? fKey} {count}
              </span>
            );
          })}
        </span>
      </summary>

      {/* Match cards */}
      <div style={{ background: "#fff", padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {matches.map((match) => {
          const def    = match.definition;
          const family = familyMap.get(def.family);
          const confPct = Math.round(match.confidence * 100);
          const confColour = confPct >= 80 ? "#059669" : confPct >= 50 ? "#d97706" : "#6b7280";
          const requiredResults = match.criteriaResults.filter((r) => !r.optional);
          const optionalResults = match.criteriaResults.filter((r) => r.optional);

          return (
            <details
              key={def.id}
              style={{
                border:       "1px solid #e5e7eb",
                borderRadius: "5px",
                overflow:     "hidden",
              }}
            >
              <summary
                style={{
                  cursor:      "pointer",
                  padding:     "6px 10px",
                  background:  "#f8fafc",
                  display:     "flex",
                  alignItems:  "center",
                  gap:         "0.5rem",
                  listStyle:   "none",
                  userSelect:  "none",
                  flexWrap:    "wrap",
                }}
              >
                {/* Family badge */}
                {family && (
                  <span style={{
                    padding: "1px 6px", borderRadius: "9999px",
                    background: "#e0e7ff", color: "#3730a3",
                    fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    {family.label}
                  </span>
                )}

                {/* Status badge */}
                <span style={{
                  padding: "1px 6px", borderRadius: "9999px",
                  background: def.status === "active" ? "#dcfce7" : "#fef9c3",
                  color:      def.status === "active" ? "#15803d" : "#a16207",
                  fontSize: "10px", fontWeight: 600,
                }}>
                  {def.status}
                </span>

                {/* Label */}
                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "12px" }}>
                  {def.label}
                </span>

                {/* Confidence */}
                <span style={{
                  marginLeft: "auto", fontSize: "11px",
                  color: confColour, fontWeight: 700,
                }}>
                  {confPct}%
                </span>
              </summary>

              {/* Card body */}
              <div style={{ padding: "8px 10px", background: "#fff", display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* Description */}
                <p style={{ margin: 0, color: "#475569", fontSize: "11px", lineHeight: "1.5" }}>
                  {def.description}
                </p>

                {/* Match reason */}
                <p style={{ margin: 0, color: "#64748b", fontSize: "11px", fontStyle: "italic" }}>
                  <span style={{ fontStyle: "normal", fontWeight: 600, color: "#334155" }}>Match reason: </span>
                  {def.matchReason}
                </p>

                {/* Required criteria */}
                {requiredResults.length > 0 && (
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
                      letterSpacing: "0.06em", marginBottom: "3px" }}>
                      Criteria
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {requiredResults.map((cr, i) => (
                        <span key={i} style={{
                          display:    "flex",
                          alignItems: "center",
                          gap:        "5px",
                          fontSize:   "10px",
                        }}>
                          <span style={{
                            width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0,
                            background: cr.passed ? "#dcfce7" : "#fee2e2",
                            color:      cr.passed ? "#15803d" : "#dc2626",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "9px",
                          }}>
                            {cr.passed ? "✓" : "✗"}
                          </span>
                          <span style={{ fontFamily: "monospace", color: "#334155" }}>
                            {cr.field}
                          </span>
                          <span style={{ color: "#94a3b8" }}>{cr.op}</span>
                          <span style={{ color: "#64748b" }}>
                            {cr.resolvedValue === undefined ? "(absent)" :
                             cr.resolvedValue === null      ? "null" :
                             String(cr.resolvedValue)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional criteria (if any) */}
                {optionalResults.length > 0 && (
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
                      letterSpacing: "0.06em", marginBottom: "3px" }}>
                      Optional criteria
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {optionalResults.map((cr, i) => (
                        <span key={i} style={{
                          display:    "flex",
                          alignItems: "center",
                          gap:        "5px",
                          fontSize:   "10px",
                          opacity:    cr.passed ? 1 : 0.5,
                        }}>
                          <span style={{
                            width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0,
                            background: cr.passed ? "#dcfce7" : "#f1f5f9",
                            color:      cr.passed ? "#15803d" : "#9ca3af",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "9px",
                          }}>
                            {cr.passed ? "✓" : "·"}
                          </span>
                          <span style={{ fontFamily: "monospace", color: "#64748b" }}>
                            {cr.field}
                          </span>
                          <span style={{ color: "#94a3b8" }}>{cr.op}</span>
                          <span style={{ color: "#9ca3af" }}>
                            {cr.resolvedValue === undefined ? "(absent)" :
                             cr.resolvedValue === null      ? "null" :
                             String(cr.resolvedValue)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Usage note */}
                {def.usageNote && (
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "10px", lineHeight: "1.5" }}>
                    <span style={{ fontWeight: 600, color: "#6b7280" }}>Tip: </span>
                    {def.usageNote}
                  </p>
                )}

                {/* Definition id */}
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#cbd5e1" }}>
                  {def.id}
                </span>
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colours: Record<string, { bg: string; text: string }> = {
    enum:    { bg: "#eff6ff", text: "#2563eb" },
    string:  { bg: "#f0fdf4", text: "#16a34a" },
    number:  { bg: "#fff7ed", text: "#c2410c" },
    boolean: { bg: "#fdf4ff", text: "#7e22ce" },
  };
  const c = colours[type] ?? { bg: "#f1f5f9", text: "#64748b" };

  return (
    <span
      style={{
        display:      "inline-block",
        padding:      "1px 4px",
        borderRadius: "3px",
        background:   c.bg,
        color:        c.text,
        fontSize:     "10px",
        fontWeight:   600,
        letterSpacing: "0.03em",
      }}
    >
      {type}
    </span>
  );
}
