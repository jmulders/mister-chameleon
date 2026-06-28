/**
 * KnownLeadBadge — presentational ABM identity badge.
 *
 * Pure, dependency-free markup (inline styles) shown in debug surfaces when the
 * visitor arrived via a personalized URL (the `mc_lead` cookie resolved to an
 * active lead). Surfaces the deterministic identity + the segment it forces, so
 * it's clear at a glance what the redirect injected — which the Scenario Control
 * panel (a manual override) does not show.
 *
 * Used by ContextDebugPanel (homepage / demo) and AbmKnownLeadDebugBadge
 * (non-homepage target pages).
 */

import type { KnownLeadContext } from "@/decision/decision-context";

export function KnownLeadBadge({
  lead,
  forcedSegment,
}: {
  lead:          KnownLeadContext;
  forcedSegment: string | null;
}) {
  const chips: Array<{ label: string; value: string }> = [
    ...(lead.name
      ? [{ label: "Name", value: lead.name }]
      : lead.firstName ? [{ label: "Name", value: lead.firstName }] : []),
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
