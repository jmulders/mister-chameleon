/**
 * Context Simulator — Demo Story
 *
 * Demonstrates the Context Simulator in action.  Select a scenario from the
 * "Scenario" toolbar to see how the simulated decision changes in real time.
 *
 * Use `useContextSimulator()` in your own stories to access the active
 * scenario and pass the simulated decision keys to adaptive components.
 *
 * @example
 *   // In HeroBlock.stories.tsx:
 *   export const WithSimulator: Story = {
 *     render: () => {
 *       const { activeScenario } = useContextSimulator();
 *       return (
 *         <HeroBlock
 *           data={heroData}
 *           ctaKey={activeScenario?.decision.ctaKey}
 *         />
 *       );
 *     },
 *   };
 */

import type { Meta, StoryObj }  from "@storybook/nextjs-vite";
import { useContextSimulator }  from "../storybook/context-simulator/ContextSimulatorProvider";
import { PREDEFINED_SCENARIOS } from "../storybook/context-simulator/scenarios";

const meta: Meta = {
  title:  "Personalization / Context Simulator",
  tags:   ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

// ── Demo component ────────────────────────────────────────────────────────────

function ContextSimulatorDemo() {
  const { activeScenario, scenarios, setScenario } = useContextSimulator();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "700px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
        🎭 Context Simulator
      </h2>
      <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "20px" }}>
        Select a scenario from the <strong>Scenario</strong> toolbar above to simulate
        different behavioral contexts. Components that call{" "}
        <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: "3px" }}>
          useContextSimulator()
        </code>{" "}
        will re-render with the simulated experience decision.
      </p>

      {/* Quick scenario switcher */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setScenario(null)}
          style={{
            padding:      "6px 12px",
            borderRadius: "6px",
            border:       `2px solid ${activeScenario === null ? "#111827" : "#e5e7eb"}`,
            background:   activeScenario === null ? "#111827" : "#fff",
            color:        activeScenario === null ? "#fff" : "#374151",
            fontSize:     "12px",
            fontWeight:   600,
            cursor:       "pointer",
          }}
        >
          None (default)
        </button>
        {scenarios.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenario(s.key)}
            style={{
              padding:      "6px 12px",
              borderRadius: "6px",
              border:       `2px solid ${activeScenario?.key === s.key ? "#3b82f6" : "#e5e7eb"}`,
              background:   activeScenario?.key === s.key ? "#eff6ff" : "#fff",
              color:        activeScenario?.key === s.key ? "#1d4ed8" : "#374151",
              fontSize:     "12px",
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Active scenario detail */}
      {activeScenario ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{
            background: "#1e293b", color: "#f1f5f9", padding: "10px 16px",
            fontFamily: "ui-monospace,Cascadia Code,monospace", fontSize: "12px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700 }}>🎭 {activeScenario.label}</span>
            <span style={{ color: "#64748b" }}>{activeScenario.key}</span>
          </div>

          <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            <div>
              <SectionTitle>Visitor Signals</SectionTitle>
              <Field k="Visitor type"   v={activeScenario.visitorType} />
              <Field k="Source"         v={activeScenario.source} />
              <Field k="Funnel stage"   v={activeScenario.funnelStage} />
              <Field k="Intent score"   v={`${activeScenario.intentScore}/100`} />
              <Field k="Engagement"     v={`${activeScenario.engagementScore}/100`} />
              <Field k="Confidence"     v={activeScenario.confidenceBand} />
              {activeScenario.company && (
                <Field k="Company" v={`${activeScenario.company.name}${activeScenario.company.industry ? ` (${activeScenario.company.industry})` : ""}`} />
              )}
              {activeScenario.interest && (
                <Field k="Interest" v={activeScenario.interest} />
              )}
            </div>

            <div>
              <SectionTitle>Simulated Decision</SectionTitle>
              {activeScenario.decision.ruleLabel && (
                <Field k="Rule"    v={activeScenario.decision.ruleLabel} highlight />
              )}
              <Field k="heroKey"  v={activeScenario.decision.heroKey} mono />
              <Field k="proofKey" v={activeScenario.decision.proofKey} mono />
              <Field k="ctaKey"   v={activeScenario.decision.ctaKey} mono />
              {activeScenario.decision.themeKey && (
                <Field k="themeKey" v={activeScenario.decision.themeKey} mono />
              )}
              {activeScenario.decision.ruleReason && (
                <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "11px", lineHeight: 1.5 }}>
                  {activeScenario.decision.ruleReason}
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        <div style={{
          padding:      "20px",
          border:       "1px dashed #d1d5db",
          borderRadius: "8px",
          color:        "#9ca3af",
          textAlign:    "center",
          fontSize:     "13px",
        }}>
          No scenario selected. Components render their default (cold visitor) experience.
        </div>
      )}

      {/* All scenarios table */}
      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: "#374151" }}>
          Available Scenarios
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Key", "Label", "Stage", "Confidence", "Decision Rule"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PREDEFINED_SCENARIOS.map((s) => (
              <tr
                key={s.key}
                style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: activeScenario?.key === s.key ? "#eff6ff" : "transparent" }}
                onClick={() => setScenario(s.key)}
              >
                <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#374151" }}>{s.key}</td>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{s.label}</td>
                <td style={{ padding: "6px 8px", color: "#6b7280" }}>{s.funnelStage}</td>
                <td style={{ padding: "6px 8px", color: "#6b7280" }}>{s.confidenceBand}</td>
                <td style={{ padding: "6px 8px", color: "#6b7280" }}>{s.decision.ruleLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Story ─────────────────────────────────────────────────────────────────────

export const Demo: StoryObj = {
  name:   "Context Simulator Demo",
  render: () => <ContextSimulatorDemo />,
};

// ── Helper components ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
      {children}
    </div>
  );
}

function Field({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "3px", fontSize: "12px" }}>
      <span style={{ color: "#9ca3af", minWidth: "80px" }}>{k}:</span>
      <span style={{
        color:       highlight ? "#1d4ed8" : "#374151",
        fontFamily:  mono ? "ui-monospace,Cascadia Code,monospace" : "inherit",
        fontWeight:  highlight ? 600 : 400,
      }}>
        {v}
      </span>
    </div>
  );
}
