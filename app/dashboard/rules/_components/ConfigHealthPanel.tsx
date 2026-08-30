"use client";

/**
 * ConfigHealthPanel — surfaces the deterministic config-health analyzer findings
 * (D7 spoor 1) beside the rules editor: errors, warnings and info, each naming the
 * rule/variant and why. Live: the editor recomputes findings from its current
 * (unsaved) config, so problems show before Save + before validateStoredConfig
 * rejects the whole config.
 */

import { useState } from "react";
import type { ConfigHealthFinding, FindingSeverity } from "@/decision/rules/config-health";
import { summarizeFindings } from "@/decision/rules/config-health";

const STYLE: Record<FindingSeverity, { border: string; bg: string; fg: string; icon: string; label: string }> = {
  error:   { border: "#fca5a5", bg: "#fef2f2", fg: "#991b1b", icon: "⛔", label: "Error" },
  warning: { border: "#fcd34d", bg: "#fffbeb", fg: "#92400e", icon: "⚠", label: "Warning" },
  info:    { border: "#93c5fd", bg: "#eff6ff", fg: "#1e40af", icon: "ℹ", label: "Info" },
};

export function ConfigHealthPanel({ findings }: { findings: readonly ConfigHealthFinding[] }) {
  const counts = summarizeFindings(findings);
  const [open, setOpen] = useState<boolean>(counts.error > 0);

  const chip = (sev: FindingSeverity, n: number) =>
    n > 0 ? (
      <span key={sev} style={{
        display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700,
        padding: "1px 7px", borderRadius: 9999, border: `1px solid ${STYLE[sev].border}`,
        background: STYLE[sev].bg, color: STYLE[sev].fg,
      }}>{STYLE[sev].icon} {n} {STYLE[sev].label}{n === 1 ? "" : "s"}</span>
    ) : null;

  return (
    <section style={{ margin: "0.5rem 0 1rem", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          background: "#fafafa", border: "none", borderBottom: open ? "1px solid #e5e7eb" : "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Config health</span>
        {findings.length === 0 ? (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ No issues found</span>
        ) : (
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            {chip("error", counts.error)}{chip("warning", counts.warning)}{chip("info", counts.info)}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && findings.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {findings.map((f, i) => {
            const s = STYLE[f.severity];
            return (
              <li key={i} style={{ display: "flex", gap: 8, padding: "7px 12px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", fontSize: 12 }}>
                <span title={s.label} style={{ color: s.fg, flexShrink: 0 }}>{s.icon}</span>
                <span style={{ color: "#374151" }}>
                  {f.ruleLabel && <strong style={{ color: "#111827" }}>{f.ruleLabel}: </strong>}
                  {f.message}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
