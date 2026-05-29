/**
 * Context Simulator Types
 *
 * Defines the shape of a mock behavioral/visitor context scenario.
 * Used by the Storybook Context Simulator toolbar and decorator.
 */

import type { JourneyFunnelStage, ConfidenceBand } from "@/lib/journey/types";

// ── Scenario input ─────────────────────────────────────────────────────────────

/**
 * A concrete set of visitor signals that define a behavioral scenario.
 * Used to compute a simulated experience decision and render components accordingly.
 */
export interface SimulatorScenario {
  /** Unique scenario key, e.g. "cold_visitor". */
  key:             string;
  /** Human-readable label shown in the toolbar. */
  label:           string;
  /** Optional description shown in the debug overlay. */
  description?:    string;

  // ── Visitor classification ────────────────────────────────────────────────
  /** "new" | "returning" | "high_intent" */
  visitorType:     "new" | "returning" | "high_intent";

  // ── Traffic source ────────────────────────────────────────────────────────
  source:          string; // e.g. "organic", "google", "linkedin", "direct"
  utmSource?:      string | null;
  utmMedium?:      string | null;
  utmCampaign?:    string | null;

  // ── Behavioral state ──────────────────────────────────────────────────────
  funnelStage:     JourneyFunnelStage;
  intentScore:     number;   // 0–100
  engagementScore: number;   // 0–100
  confidenceBand:  ConfidenceBand;

  /** Flags set by the journey system. */
  hasVisitedPricing?:  boolean;
  hasVisitedAbout?:    boolean;
  hasVisitedContact?:  boolean;
  hasClickedCta?:      boolean;
  hasSubmittedForm?:   boolean;

  // ── Enrichment context ────────────────────────────────────────────────────
  company?: {
    name:        string;
    industry?:   string;
    employeeCount?: number;
  } | null;

  interest?:       string | null; // e.g. "sustainability", "enterprise_software"

  // ── Decision output ───────────────────────────────────────────────────────
  /**
   * The simulated experience decision.
   * What the rule engine would have resolved for this scenario.
   */
  decision: {
    heroKey:  string;
    proofKey: string;
    ctaKey:   string;
    themeKey?: string | null;
    ruleLabel?: string;
    ruleReason?: string;
  };
}

// ── Runtime context shape ─────────────────────────────────────────────────────

/** The value provided by the ContextSimulatorProvider. */
export interface ContextSimulatorValue {
  /** The currently active scenario. Null = no simulator active (production-like). */
  activeScenario: SimulatorScenario | null;
  /** All available scenarios. */
  scenarios:      SimulatorScenario[];
  /** Switch to a different scenario by key. */
  setScenario:    (key: string | null) => void;
}
