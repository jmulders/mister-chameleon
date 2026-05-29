"use client";

/**
 * JourneyDebugPanel — Client Component
 *
 * Dev-only diagnostic panel rendering the full behavioral personalization stack.
 * Shows live data by merging the client optimistic store with the DB state.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   1. Header bar       — funnel stage, confidence band, merge stats
 *   2. Confidence panel — per-dimension scores, overall band, gating decisions
 *   3. Event timeline   — merged events with source/sync badges
 *   4. Scores           — engagement, recency, intent, sequence (DB state)
 *   5. Funnel explainer — stage, confidence, human reason
 *   6. Page signals     — boolean visit flags
 *   7. Sequences        — matched pattern slugs + score
 *   8. Footer           — timestamps, raw counts
 *
 * ─── Live updates ─────────────────────────────────────────────────────────────
 *
 *   On every pathname change:
 *   a. Reads window.__journey events immediately (local optimistic display).
 *   b. Re-fetches /api/journey/state after 600 ms (DB write settle time).
 *   c. Merges DB events + local events by eventId (O(n) algorithm).
 *   d. Derives client-side state from merged events for instant display.
 *   e. Updates confidence and adaptive gating from merged state.
 *
 * ─── No "No journey data yet" ─────────────────────────────────────────────────
 *
 *   If the DB has not yet processed events, local events from the optimistic
 *   store are shown immediately with ⚡ badges.  Scores show as "pending DB".
 */

import { useState, useEffect, useRef }     from "react";
import { usePathname }                      from "next/navigation";
import type { JourneyState, JourneyEventRow } from "@/lib/journey/types";
import type { RuleMatchInfo }                 from "@/decision/trace";
import { deriveFunnelStage }                  from "@/lib/journey/derive-funnel-stage";
import { gateAdaptiveDecisions }              from "@/lib/journey/compute-confidence";
import {
  getJourneyStoreEvents,
  getJourneyStoreVisitorId,
  getJourneyStoreSessionId,
} from "@/tracking/journey-store";
import {
  mergeJourneyEvents,
  deriveClientState,
  computeMergeStats,
} from "@/tracking/merge-journey-events";
import type { MergedEvent, MergeStats, ClientDerivedState } from "@/tracking/merge-journey-events";
import { getConsent, onConsentChange } from "@/tracking/consent-store";
import type { ConsentState }           from "@/tracking/consent-types";
import type { AdaptiveGating }         from "@/lib/journey/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ExperiencePlanSnapshot {
  heroKey:   string;
  proofKey:  string;
  ctaKey:    string;
  themeKey?: string | null;
}

export interface JourneyDebugPanelProps {
  /** Effective journey state — already has scenario overrides applied when scenario is active. */
  journey?:        JourneyState | null;
  recentEvents?:   JourneyEventRow[];
  matchedRule?:    RuleMatchInfo | null;
  experiencePlan?: ExperiencePlanSnapshot | null;
  /** Output from gateAdaptiveDecisions() — which slots are allowed at current confidence. */
  adaptiveGating?: AdaptiveGating | null;
  /** Human-readable explanation of any gating that was applied. */
  gatingSummary?:  string | null;
  /**
   * The unmodified, real journey state from the DB — passed alongside `journey`
   * when a scenario is active so the panel can display a real-vs-effective diff.
   * Omitted (undefined) when no scenario is active.
   */
  realJourney?:    JourneyState | null;
  /** True when a scenario cookie was detected by the server this request. */
  scenarioActive?: boolean;
  /** Display label for the active scenario (preset name or "Custom"). */
  scenarioLabel?:  string | null;
}

// ── Style constants ───────────────────────────────────────────────────────────

const FUNNEL_COLOURS: Record<string, string> = {
  awareness:     "#94a3b8",
  consideration: "#3b82f6",
  intent:        "#f59e0b",
  high_intent:   "#ef4444",
  customer:      "#10b981",
};

const BAND_COLOURS: Record<string, string> = {
  low:       "#94a3b8",
  medium:    "#3b82f6",
  high:      "#f59e0b",
  very_high: "#10b981",
};

const EVENT_ICON: Record<string, string> = {
  page_view:   "📄",
  cta_click:   "🖱️",
  form_start:  "✍️",
  form_submit: "✅",
  download:    "⬇️",
};

const SOURCE_BADGE: Record<string, { label: string; bg: string; colour: string }> = {
  local:   { label: "⚡ local",     bg: "#fef3c7", colour: "#92400e" },
  backend: { label: "🗄 db",        bg: "#ede9fe", colour: "#5b21b6" },
  both:    { label: "✓ confirmed", bg: "#dcfce7", colour: "#166534" },
};

const SYNC_BADGE: Record<string, { label: string; bg: string; colour: string }> = {
  pending:    { label: "⏳ pending",    bg: "#fef3c7", colour: "#92400e" },
  synced:     { label: "✓ synced",      bg: "#dcfce7", colour: "#166534" },
  failed:     { label: "✗ failed",      bg: "#fee2e2", colour: "#991b1b" },
  confirmed:  { label: "✓ confirmed",   bg: "#dcfce7", colour: "#166534" },
  // suppressed — server returned 200 + suppressed:true (consent denied server-side).
  // Event is NOT in the DB and will never be retried.
  suppressed: { label: "⊘ suppressed",  bg: "#f3f4f6", colour: "#6b7280" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function pct(v: number): string { return `${Math.round(v * 100)}%`; }

function Chip({ label, bg, colour }: { label: string; bg: string; colour: string }) {
  return (
    <span style={{ padding: "0 5px", background: bg, color: colour, borderRadius: "3px", fontSize: "9px", fontWeight: 700, border: `1px solid ${colour}30`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100, colour }: { value: number; max?: number; colour: string }) {
  const p = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", background: colour, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontWeight: 700, color: colour, minWidth: "2rem", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ConfidenceBar({ value, colour }: { value: number; colour: string }) {
  const p = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", background: colour, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontWeight: 700, color: colour, minWidth: "2.5rem", textAlign: "right", fontSize: "10px" }}>{pct(value)}</span>
    </div>
  );
}

// ── Journey state API response ────────────────────────────────────────────────

interface JourneyStateApiResponse {
  journey:   JourneyState | null;
  events:    JourneyEventRow[];
}

// ── Main component ────────────────────────────────────────────────────────────

export function JourneyDebugPanel({
  journey:      journeyProp,
  recentEvents: recentEventsProp,
  matchedRule,
  experiencePlan,
  adaptiveGating,
  gatingSummary,
  realJourney:    realJourneyProp,
  scenarioActive: scenarioActiveProp,
  scenarioLabel:  scenarioLabelProp,
}: JourneyDebugPanelProps) {

  const ssrJourney = journeyProp ?? null;
  const ssrEvents  = recentEventsProp ?? [];

  const [dbJourney,   setDbJourney]   = useState<JourneyState | null>(ssrJourney);
  const [dbEvents,    setDbEvents]    = useState<JourneyEventRow[]>(ssrEvents);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "done">("idle");
  const [consent,     setConsent]     = useState<ConsentState>(() => getConsent());

  const pathname     = usePathname();
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Track consent changes live ──────────────────────────────────────────
  useEffect(() => {
    setConsent(getConsent());
    return onConsentChange((state) => setConsent(state));
  }, []);

  // ── Read local store on every route change ──────────────────────────────
  // (Triggers re-render so merged events update immediately.)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    forceUpdate((n) => n + 1);
  }, [pathname]);

  // ── Re-fetch DB state on route change ───────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFetchStatus("loading");
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/journey/state", { cache: "no-store" });
        if (res.ok) {
          const data: JourneyStateApiResponse = await res.json();
          setDbJourney(data.journey);
          setDbEvents(data.events);
          forceUpdate((n) => n + 1);
        }
      } catch { /* silent */ }
      finally { setFetchStatus("done"); }
    }, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pathname]);

  // ── Merge local + backend events ────────────────────────────────────────
  const localEvents = getJourneyStoreEvents();
  const merged      = mergeJourneyEvents(localEvents, dbEvents);
  const stats       = computeMergeStats(merged);

  // ── Derive client-side state from merged events ─────────────────────────
  const derived: ClientDerivedState = deriveClientState(merged, dbJourney);

  // Use DB state for scores/sequences if available (more accurate).
  const displayJourney: JourneyState = dbJourney ?? derived;

  // ── Compute adaptive gating from display confidence ──────────────────────
  const gating = gateAdaptiveDecisions(displayJourney.confidence, displayJourney);

  const hasAnyData = merged.length > 0 || displayJourney.fromDatabase;

  return (
    <details open style={{ margin: "0.75rem 0", border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden", fontFamily: "ui-monospace,'Cascadia Code','Fira Code',monospace", fontSize: "12px" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <summary style={{ cursor: "pointer", padding: "0.5rem 0.75rem", background: scenarioActiveProp ? "#450a0a" : "#1e293b", color: "#f1f5f9", display: "flex", alignItems: "center", gap: "0.75rem", listStyle: "none", userSelect: "none", flexWrap: "wrap" }}>

        <span style={{ background: scenarioActiveProp ? "#ef4444" : "#10b981", color: "#fff", borderRadius: "3px", padding: "0 5px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em" }}>
          {scenarioActiveProp ? "⚡ SCENARIO" : "JOURNEY"}
        </span>

        <span style={{ fontWeight: 600 }}>Behavioral Personalization</span>

        {scenarioActiveProp && (
          <span style={{ background: "#ef4444", color: "#fff", borderRadius: "3px", padding: "1px 6px", fontSize: "10px", fontWeight: 700 }}>
            SCENARIO MODE — overrides active
          </span>
        )}

        {/* Funnel stage + confidence */}
        {hasAnyData ? (
          <>
            <span style={{ color: "#94a3b8", fontSize: "11px" }}>
              stage: <strong style={{ color: FUNNEL_COLOURS[displayJourney.funnelStage] ?? "#94a3b8" }}>
                {displayJourney.funnelStage}
              </strong>
            </span>
            <span style={{ color: BAND_COLOURS[displayJourney.confidence.band] ?? "#94a3b8", fontSize: "11px", fontWeight: 700 }}>
              [{displayJourney.confidence.band}]
              {" "}{pct(displayJourney.confidence.overallConfidence)}
            </span>
          </>
        ) : (
          <span style={{ color: "#6b7280", fontSize: "11px" }}>
            {fetchStatus === "loading" ? "loading…" : "no data yet"}
          </span>
        )}

        {/* Merge stats */}
        <span style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "10px" }}>
          {stats.localOnly > 0 && (
            <Chip label={`⚡ ${stats.localOnly} local`} bg="#fef3c7" colour="#92400e" />
          )}
          {stats.failed > 0 && (
            <Chip label={`✗ ${stats.failed} failed`} bg="#fee2e2" colour="#991b1b" />
          )}
          {stats.suppressed > 0 && (
            <Chip label={`⊘ ${stats.suppressed} suppressed`} bg="#f3f4f6" colour="#6b7280" />
          )}
          <Chip label={`${stats.total} merged`} bg="#f1f5f9" colour="#475569" />
          {fetchStatus === "loading" && (
            <span style={{ color: "#64748b" }}>⟳</span>
          )}
        </span>
      </summary>

      <div style={{ padding: "0.75rem" }}>

        {/* ── Consent panel (always shown) ────────────────────────────────── */}
        <ConsentDebugPanel consent={consent} />

        {/* ── Scenario override banner (shown when scenario cookie is active) ─ */}
        {scenarioActiveProp && (
          <ScenarioOverrideBanner
            realJourney={realJourneyProp ?? null}
            effectiveJourney={dbJourney ?? journeyProp ?? null}
            scenarioLabel={scenarioLabelProp ?? null}
          />
        )}

        {!hasAnyData ? (
          <div style={{ padding: "1rem", background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: "4px", color: "#94a3b8", textAlign: "center" }}>
            <div style={{ fontSize: "20px", marginBottom: "0.25rem" }}>🌱</div>
            {!consent.hasResponded ? (
              <div>⚠️ Consent banner not yet accepted — tracking suppressed. Accept cookies to start collecting events.</div>
            ) : !consent.analytics || !consent.personalization ? (
              <div>🚫 Analytics or personalization consent denied — event tracking is suppressed by user choice.</div>
            ) : (
              <div>No journey data yet. Navigate to another page to generate events.</div>
            )}
          </div>
        ) : (
          <div>

            {/* ── Behavioral scenario banner ─────────────────────────── */}
            {matchedRule?.ruleId.startsWith("behavioral_") && displayJourney.fromDatabase && (
              <BehavioralScenarioBanner
                matchedRule={matchedRule}
                journey={displayJourney}
                experiencePlan={experiencePlan ?? null}
                gating={gating}
              />
            )}

            {/* ── Confidence panel ───────────────────────────────────── */}
            <ConfidencePanel journey={displayJourney} gating={gating} />

            {/* ── Server-applied gating notice ──────────────────────── */}
            {/* Shows when the server actually replaced adaptive slots   */}
            {/* due to insufficient confidence.  The confidence panel     */}
            {/* above shows what the CURRENT client-computed gating is;  */}
            {/* this notice shows what happened at request time.         */}
            {gatingSummary && (
              <div style={{ background: "#fef3c7", border: "1px solid #f59e0b40", borderLeft: "3px solid #f59e0b", borderRadius: "4px", padding: "0.5rem 0.625rem", marginBottom: "0.625rem", fontSize: "10px" }}>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: "0.25rem" }}>
                  ⚠️ Confidence gate was applied this request
                </div>
                {gatingSummary.split("\n").map((line, i) => (
                  <div key={i} style={{ color: "#78350f" }}>{line}</div>
                ))}
              </div>
            )}
            {adaptiveGating && !gatingSummary && (
              <div style={{ background: "#dcfce7", border: "1px solid #10b98140", borderLeft: "3px solid #10b981", borderRadius: "4px", padding: "0.5rem 0.625rem", marginBottom: "0.625rem", fontSize: "10px", color: "#166534" }}>
                ✓ No slots gated this request — confidence sufficient for all active adaptive outputs.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>

              {/* ── Left column ─────────────────────────────────────── */}
              <div>
                {displayJourney.fromDatabase ? (
                  <>
                    <ScorePanel journey={displayJourney} />
                    <FunnelStageExplainer journey={displayJourney} />
                    <PageFlagsSection journey={displayJourney} />
                  </>
                ) : (
                  <LocalOnlyScorePanel derived={derived} />
                )}
              </div>

              {/* ── Right column ────────────────────────────────────── */}
              <div>
                <EventTimeline events={merged} />
                {displayJourney.fromDatabase && <SequenceSection journey={displayJourney} />}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <DebugPanelFooter journey={displayJourney} stats={stats} />
    </details>
  );
}

// ── Footer with identity correlation fields ───────────────────────────────────

function DebugPanelFooter({
  journey,
  stats,
}: {
  journey: JourneyState;
  stats:   MergeStats;
}) {
  // Read IDs lazily — only available in browser, not during SSR.
  const [visitorId,  setVisitorId]  = useState<string | null>(null);
  const [sessionId,  setSessionId]  = useState<string | null>(null);

  useEffect(() => {
    setVisitorId(getJourneyStoreVisitorId());
    setSessionId(getJourneyStoreSessionId());
  }, []);

  return (
    <div style={{ padding: "0.35rem 0.75rem", background: "#f8fafc", borderTop: "1px solid #e5e7eb", color: "#94a3b8", fontSize: "10px", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      <span>first seen: {formatTs(journey.firstSeenAt)}</span>
      <span>last seen: {formatTs(journey.lastSeenAt)}</span>
      <span>views: {journey.pageViewCount}</span>
      <span>clicks: {journey.ctaClickCount}</span>
      <span>forms: {journey.formStartCount}/{journey.formSubmitCount}</span>
      <span style={{ borderLeft: "1px solid #e5e7eb", paddingLeft: "0.75rem", color: "#94a3b8" }}>
        src: {stats.localOnly}L / {stats.backendOnly}DB / {stats.confirmed}✓
      </span>
      {/* Identity correlation — lets engineers match client events to DB rows. */}
      <span
        title={`visitor_id: ${visitorId ?? "—"}\nsession_id (client): ${sessionId ?? "—"}\nNote: server mc_session_id (httpOnly cookie) is a separate ID.`}
        style={{ borderLeft: "1px solid #e5e7eb", paddingLeft: "0.75rem", cursor: "help", color: "#94a3b8" }}
      >
        vid: <code style={{ fontSize: "9px", background: "#f1f5f9", padding: "0 3px", borderRadius: "2px" }}>
          {visitorId ? visitorId.slice(0, 8) + "…" : "—"}
        </code>
        {" "}
        sid: <code style={{ fontSize: "9px", background: "#f1f5f9", padding: "0 3px", borderRadius: "2px" }}>
          {sessionId ? sessionId.slice(0, 8) + "…" : "—"}
        </code>
      </span>
    </div>
  );
}

// ── Consent debug panel ───────────────────────────────────────────────────────

/**
 * Shows current consent state and which personalization features are enabled
 * or disabled because of consent.  Always rendered at the top of the panel.
 */
function ConsentDebugPanel({ consent }: { consent: ConsentState }) {
  const dot = (on: boolean) => (
    <span style={{
      display:         "inline-block",
      width:           "8px",
      height:          "8px",
      borderRadius:    "50%",
      backgroundColor: on ? "#10b981" : "#ef4444",
      marginRight:     "4px",
      flexShrink:      0,
    }} />
  );

  const trackingAllowed      = consent.analytics && consent.personalization;
  const enrichmentAllowed    = consent.enrichment;
  const personalizationBlocked = !consent.personalization;

  const borderColor = trackingAllowed ? "#10b98140" : "#ef444440";
  const accentColor = trackingAllowed ? "#10b981" : "#ef4444";

  return (
    <div style={{ background: "#f0fdf4", border: `1px solid ${borderColor}`, borderLeft: `3px solid ${accentColor}`, borderRadius: "4px", padding: "0.5rem 0.625rem", marginBottom: "0.625rem", fontSize: "11px" }}>
      <div style={{ fontWeight: 700, marginBottom: "0.375rem", color: "#374151" }}>
        🔒 Consent State
        {!consent.hasResponded && (
          <span style={{ marginLeft: "0.5rem", padding: "1px 5px", background: "#fef3c7", color: "#92400e", borderRadius: "3px", fontWeight: 600, fontSize: "9px" }}>
            BANNER PENDING
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.25rem", marginBottom: "0.375rem" }}>
        <span style={{ display: "flex", alignItems: "center" }}>{dot(consent.analytics)} analytics</span>
        <span style={{ display: "flex", alignItems: "center" }}>{dot(consent.personalization)} personalization</span>
        <span style={{ display: "flex", alignItems: "center" }}>{dot(consent.enrichment)} enrichment</span>
      </div>

      {/* Effect summary */}
      {!consent.hasResponded && (
        <div style={{ color: "#92400e", background: "#fef3c7", padding: "2px 6px", borderRadius: "3px", fontSize: "10px" }}>
          ⚠️ Awaiting consent — all tracking is suppressed (privacy-first default).
        </div>
      )}
      {consent.hasResponded && personalizationBlocked && (
        <div style={{ color: "#991b1b", background: "#fee2e2", padding: "2px 6px", borderRadius: "3px", fontSize: "10px" }}>
          🚫 Personalization denied — behavioral tracking + adaptive content suppressed.
          Default experience will be served.
        </div>
      )}
      {consent.hasResponded && trackingAllowed && !enrichmentAllowed && (
        <div style={{ color: "#92400e", background: "#fef3c7", padding: "2px 6px", borderRadius: "3px", fontSize: "10px" }}>
          ℹ️ Enrichment denied — IP-to-company and Leadinfo lookups suppressed.
        </div>
      )}
      {consent.hasResponded && trackingAllowed && enrichmentAllowed && (
        <div style={{ color: "#166534", fontSize: "10px" }}>
          ✓ Full consent — tracking, personalization, and enrichment active.
        </div>
      )}
    </div>
  );
}

// ── Confidence panel ──────────────────────────────────────────────────────────

function ConfidencePanel({
  journey,
  gating,
}: {
  journey: JourneyState;
  gating:  ReturnType<typeof gateAdaptiveDecisions>;
}) {
  const { confidence } = journey;
  const bandColour = BAND_COLOURS[confidence.band] ?? "#94a3b8";

  return (
    <div style={{ background: "#f8fafc", border: `1px solid ${bandColour}40`, borderLeft: `3px solid ${bandColour}`, borderRadius: "4px", padding: "0.625rem", marginBottom: "0.625rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "#374151" }}>Confidence</span>
        <span style={{ padding: "1px 8px", background: `${bandColour}20`, color: bandColour, borderRadius: "9999px", fontWeight: 700, fontSize: "11px" }}>
          {confidence.band}
        </span>
        <span style={{ color: "#9ca3af", fontSize: "10px" }}>
          overall: {pct(confidence.overallConfidence)}
        </span>
      </div>

      {/* Per-dimension bars */}
      <div style={{ display: "grid", gap: "0.3rem", marginBottom: "0.5rem" }}>
        {[
          { label: "intent",       value: confidence.intentConfidence,      colour: "#f59e0b" },
          { label: "sequence",     value: confidence.sequenceConfidence,     colour: "#8b5cf6" },
          { label: "funnel stage", value: confidence.funnelStageConfidence,  colour: "#3b82f6" },
          { label: "overall",      value: confidence.overallConfidence,      colour: bandColour },
        ].map(({ label, value, colour }) => (
          <div key={label}>
            <div style={{ color: "#6b7280", fontSize: "10px", marginBottom: "1px" }}>{label}</div>
            <ConfidenceBar value={value} colour={colour} />
          </div>
        ))}
      </div>

      {/* Adaptive gating table */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.4rem" }}>
        <div style={{ color: "#6b7280", fontSize: "10px", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Adaptive gating
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {([
            { key: "cta",   label: "CTA",   allowed: gating.cta },
            { key: "proof", label: "Proof", allowed: gating.proof },
            { key: "hero",  label: "Hero",  allowed: gating.hero },
            { key: "theme", label: "Theme", allowed: gating.theme },
          ] as const).map(({ key: _key, label, allowed }) => (
            <span
              key={label}
              style={{
                padding:      "1px 7px",
                background:   allowed ? "#dcfce7" : "#f1f5f9",
                color:        allowed ? "#166534" : "#9ca3af",
                borderRadius: "3px",
                fontSize:     "10px",
                fontWeight:   700,
                border:       `1px solid ${allowed ? "#86efac" : "#e2e8f0"}`,
              }}
            >
              {allowed ? "✓" : "✗"} {label}
            </span>
          ))}
        </div>
        {gating.blockedReasons.length > 0 && (
          <div style={{ marginTop: "0.35rem" }}>
            {gating.blockedReasons.map((r, i) => (
              <div key={i} style={{ color: "#9ca3af", fontSize: "10px" }}>· {r}</div>
            ))}
          </div>
        )}
      </div>

      {/* Confidence reasons */}
      {confidence.reasons.length > 0 && (
        <details style={{ marginTop: "0.35rem" }}>
          <summary style={{ color: "#6b7280", fontSize: "10px", cursor: "pointer" }}>
            why ({confidence.reasons.length} signals)
          </summary>
          <div style={{ paddingTop: "0.25rem" }}>
            {confidence.reasons.map((r, i) => (
              <div key={i} style={{ color: "#6b7280", fontSize: "10px" }}>· {r}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Score panel (DB state) ────────────────────────────────────────────────────

function ScorePanel({ journey }: { journey: JourneyState }) {
  const freshnessLabel = journey.intentFreshness >= 0.8 ? "very fresh"
    : journey.intentFreshness >= 0.5 ? "fresh"
    : journey.intentFreshness > 0    ? "historical"
    : "—";
  const repeatLabel = journey.repeatSessionBonus === 0 ? "first/same-day"
    : journey.repeatSessionBonus <= 0.5  ? "returning (2–3d)"
    : journey.repeatSessionBonus <= 0.75 ? "returning (4–6d)"
    : "engaged returner (7d+)";

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "0.625rem", marginBottom: "0.625rem" }}>
      <div style={{ fontWeight: 700, color: "#374151", marginBottom: "0.5rem" }}>Scores (0–100)</div>
      <div style={{ display: "grid", gap: "0.375rem" }}>
        {[
          { label: "Intent",      sub: "scoring rules × decay", value: journey.intentScore,     colour: "#f59e0b" },
          { label: "Engagement",  sub: "views, clicks, forms",  value: journey.engagementScore, colour: "#3b82f6" },
          { label: "Recency",     sub: "how recently active",   value: journey.recencyScore,    colour: "#8b5cf6" },
          ...(journey.sequenceScore > 0
            ? [{ label: "Sequence bonus", sub: "", value: journey.sequenceScore, colour: "#10b981" }]
            : []),
        ].map(({ label, sub, value, colour }) => (
          <div key={label}>
            <div style={{ color: "#6b7280", marginBottom: "2px", fontSize: "11px" }}>
              {label} {sub && <span style={{ fontSize: "10px" }}>— {sub}</span>}
            </div>
            <ScoreBar value={value} colour={colour} />
          </div>
        ))}
      </div>

      {/* v2 signals */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
        <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: "0.375rem" }}>
          Journey Engine v2
        </div>
        <div style={{ display: "grid", gap: "0.375rem" }}>
          <div>
            <div style={{ color: "#6b7280", marginBottom: "2px", fontSize: "11px" }}>
              Short-term intent <span style={{ fontSize: "10px" }}>— last 24h</span>
            </div>
            <ScoreBar value={journey.shortTermIntentScore} colour="#f97316" />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: "2px", fontSize: "11px" }}>
              Long-term affinity <span style={{ fontSize: "10px" }}>— 7–90d</span>
            </div>
            <ScoreBar value={journey.longTermAffinityScore} colour="#0ea5e9" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.375rem", fontSize: "10px", color: "#6b7280", flexWrap: "wrap" }}>
          <span>freshness: <strong style={{ color: "#374151" }}>{freshnessLabel}</strong> ({Math.round(journey.intentFreshness * 100)}%)</span>
          <span>session: <strong style={{ color: "#374151" }}>{repeatLabel}</strong></span>
        </div>
      </div>

      {/* v3 anti-noise signals */}
      <NoisePanel journey={journey} />
    </div>
  );
}

// ── v3 noise/anti-false-positive panel ───────────────────────────────────────

function NoisePanel({ journey }: { journey: JourneyState }) {
  const friction      = journey.frictionScore      ?? 0;
  const burst         = journey.burstPenalty        ?? 0;
  const diversity     = journey.signalDiversityScore ?? 0;
  const uniqueSignals = journey.uniqueSignalCount    ?? 0;
  const dedupCount    = journey.deduplicatedEventCount ?? 0;

  // Colour by friction level
  const frictionColour =
    friction >= 70 ? "#ef4444" :
    friction >= 40 ? "#f59e0b" :
    "#10b981";

  const burstColour =
    burst >= 0.3 ? "#ef4444" :
    burst >  0   ? "#f59e0b" :
    "#10b981";

  const diversityColour =
    diversity >= 0.4 ? "#10b981" :
    diversity >= 0.2 ? "#f59e0b" :
    "#ef4444";

  // Suppression summary
  const suppressions: string[] = [];
  if (friction >= 70) suppressions.push("high friction → hero/theme blocked");
  else if (friction >= 60) suppressions.push("friction ≥ 60 → high_intent gate closed");
  else if (friction >= 40) suppressions.push("moderate friction → intent confidence reduced");
  if (burst >= 0.3) suppressions.push("burst ≥ 0.30 → hero blocked");
  if (uniqueSignals < 2 && dedupCount > 0) suppressions.push("< 2 distinct signals → high_intent diversity gate closed");
  if (uniqueSignals < 1) suppressions.push("0 distinct signals → intent diversity gate closed");
  if (diversity < 0.20 && dedupCount > 0) suppressions.push("low diversity → intent confidence capped at 30%");

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
      <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: "0.375rem" }}>
        Journey Engine v3 — Anti-Noise
      </div>

      <div style={{ display: "grid", gap: "0.3rem", marginBottom: "0.375rem" }}>
        {/* Friction score */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1px" }}>
            <span style={{ color: "#6b7280", fontSize: "11px" }}>Friction score</span>
            <span style={{ fontWeight: 700, color: frictionColour, fontSize: "11px" }}>{friction} / 100</span>
          </div>
          <div style={{ height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, friction)}%`, height: "100%", background: frictionColour, borderRadius: "3px", transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Burst penalty */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1px" }}>
            <span style={{ color: "#6b7280", fontSize: "11px" }}>Burst penalty</span>
            <span style={{ fontWeight: 700, color: burstColour, fontSize: "11px" }}>{burst.toFixed(2)}</span>
          </div>
          <div style={{ height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, burst * 200)}%`, height: "100%", background: burstColour, borderRadius: "3px", transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Signal diversity */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1px" }}>
            <span style={{ color: "#6b7280", fontSize: "11px" }}>
              Signal diversity{" "}
              <span style={{ fontSize: "10px" }}>— {uniqueSignals}/10 types</span>
            </span>
            <span style={{ fontWeight: 700, color: diversityColour, fontSize: "11px" }}>{Math.round(diversity * 100)}%</span>
          </div>
          <div style={{ height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, diversity * 100)}%`, height: "100%", background: diversityColour, borderRadius: "3px", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {/* Dedup count */}
      {dedupCount > 0 && (
        <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "0.25rem" }}>
          🔁 {dedupCount} duplicate event{dedupCount === 1 ? "" : "s"} downweighted (×0.10)
        </div>
      )}

      {/* Suppression reasons */}
      {suppressions.length > 0 ? (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderLeft: "3px solid #f97316", borderRadius: "3px", padding: "0.3rem 0.5rem", marginTop: "0.25rem" }}>
          <div style={{ fontWeight: 700, color: "#c2410c", fontSize: "10px", marginBottom: "0.2rem" }}>⚠ Noise suppression active</div>
          {suppressions.map((s, i) => (
            <div key={i} style={{ color: "#9a3412", fontSize: "10px" }}>· {s}</div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "10px", color: "#10b981" }}>✓ No noise suppression — signals are clean</div>
      )}
    </div>
  );
}

// ── Local-only scores (when no DB state yet) ──────────────────────────────────

function LocalOnlyScorePanel({ derived }: { derived: ClientDerivedState }) {
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: "4px", padding: "0.625rem", marginBottom: "0.625rem" }}>
      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: "0.375rem" }}>⚡ Partial scores (local events)</div>
      <div style={{ display: "grid", gap: "0.375rem" }}>
        {[
          { label: "Engagement (local)", value: derived.engagementScore, colour: "#3b82f6" },
          { label: "Recency (local)",    value: derived.recencyScore,    colour: "#8b5cf6" },
        ].map(({ label, value, colour }) => (
          <div key={label}>
            <div style={{ color: "#78350f", marginBottom: "2px", fontSize: "11px" }}>{label}</div>
            <ScoreBar value={value} colour={colour} />
          </div>
        ))}
      </div>
      <div style={{ color: "#b45309", fontSize: "10px", marginTop: "0.375rem" }}>
        Intent/sequence scores require DB write to complete. Auto-updates in ~600 ms.
      </div>
    </div>
  );
}

// ── Funnel stage explainer ────────────────────────────────────────────────────

function FunnelStageExplainer({ journey }: { journey: JourneyState }) {
  const { reason } = deriveFunnelStage({
    intentScore:           journey.intentScore,
    engagementScore:       journey.engagementScore,
    hasVisitedPricing:     journey.hasVisitedPricing,
    hasVisitedAbout:       journey.hasVisitedAbout,
    hasVisitedCases:       journey.hasVisitedCases,
    hasVisitedContact:     journey.hasVisitedContact,
    hasSubmittedForm:      journey.hasSubmittedForm,
    formStartCount:        journey.formStartCount,
    pageViewCount:         journey.pageViewCount,
    matchedSequences:      journey.matchedSequences,
    shortTermIntentScore:  journey.shortTermIntentScore,
    longTermAffinityScore: journey.longTermAffinityScore,
    repeatSessionBonus:    journey.repeatSessionBonus,
    sequenceMatchedAt:     journey.sequenceMatchedAt,
    // v3 — pass through so the explainer shows why a stage was gated
    frictionScore:         journey.frictionScore,
    uniqueSignalCount:     journey.uniqueSignalCount,
    signalDiversityScore:  journey.signalDiversityScore,
    burstPenalty:          journey.burstPenalty,
  });
  const colour     = FUNNEL_COLOURS[journey.funnelStage] ?? "#94a3b8";
  const confidence = Math.round(journey.funnelStageConfidence * 100);
  return (
    <div style={{ background: "#f8fafc", border: `1px solid ${colour}40`, borderLeft: `3px solid ${colour}`, borderRadius: "4px", padding: "0.625rem", marginBottom: "0.625rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
        <span style={{ fontWeight: 700, color: "#374151" }}>Funnel Stage</span>
        <span style={{ padding: "1px 8px", borderRadius: "9999px", background: `${colour}20`, color: colour, fontWeight: 700, fontSize: "11px" }}>
          {journey.funnelStage}
        </span>
        <span style={{ color: "#9ca3af", fontSize: "10px" }}>{confidence}% confidence</span>
      </div>
      <div style={{ color: "#6b7280", fontSize: "11px" }}>
        <span style={{ color: "#374151" }}>Why: </span>{reason}
      </div>
    </div>
  );
}

// ── Page flags ────────────────────────────────────────────────────────────────

function PageFlagsSection({ journey }: { journey: JourneyState }) {
  const flags: [string, boolean][] = [
    ["Visited pricing",  journey.hasVisitedPricing],
    ["Visited about",    journey.hasVisitedAbout],
    ["Visited cases",    journey.hasVisitedCases],
    ["Visited contact",  journey.hasVisitedContact],
    ["Clicked CTA",      journey.hasClickedCta],
    ["Started form",     journey.formStartCount > 0],
    ["Submitted form",   journey.hasSubmittedForm],
  ];
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "0.625rem" }}>
      <div style={{ fontWeight: 700, color: "#374151", marginBottom: "0.375rem" }}>Page Signals</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 0.5rem" }}>
        {flags.map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: "0.375rem", color: value ? "#374151" : "#9ca3af", fontSize: "11px" }}>
            <span style={{ color: value ? "#10b981" : "#d1d5db" }}>{value ? "✓" : "·"}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sequences ─────────────────────────────────────────────────────────────────

function SequenceSection({ journey }: { journey: JourneyState }) {
  if (journey.matchedSequences.length === 0) {
    return (
      <div style={{ background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: "4px", padding: "0.5rem 0.625rem", color: "#9ca3af", marginTop: "0.625rem", fontSize: "11px" }}>
        No sequences matched yet.
      </div>
    );
  }
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "4px", padding: "0.625rem", marginTop: "0.625rem" }}>
      <div style={{ fontWeight: 700, color: "#374151", marginBottom: "0.375rem" }}>
        Matched Sequences ({journey.matchedSequences.length})
      </div>
      {journey.matchedSequences.map((slug) => (
        <span key={slug} style={{ padding: "2px 6px", background: "#10b981", color: "#fff", borderRadius: "3px", fontSize: "11px", display: "inline-block", marginRight: "4px", marginBottom: "4px", fontWeight: 600 }}>
          {slug}
        </span>
      ))}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "10px", color: "#6b7280", marginTop: "0.25rem" }}>
        {journey.sequenceScore > 0 && (
          <span style={{ color: "#10b981" }}>+{journey.sequenceScore} score bonus</span>
        )}
        {journey.sequenceMatchedAt && (
          <span>last completed: {formatTs(journey.sequenceMatchedAt)}</span>
        )}
      </div>
    </div>
  );
}

// ── Event timeline ────────────────────────────────────────────────────────────

function EventTimeline({ events }: { events: MergedEvent[] }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
      <div style={{ padding: "0.5rem 0.625rem", background: "#f1f5f9", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: "#374151", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Events ({events.length})</span>
      </div>
      {events.length === 0 ? (
        <div style={{ padding: "0.75rem", color: "#9ca3af", textAlign: "center", fontSize: "11px" }}>
          No events yet.
        </div>
      ) : (
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          {events.map((event, i) => {
            const srcBadge  = SOURCE_BADGE[event.source];
            const syncBadge = SYNC_BADGE[event.syncStatus];
            return (
              <div
                key={event.eventId}
                style={{
                  padding:      "0.375rem 0.625rem",
                  borderBottom: i < events.length - 1 ? "1px solid #f1f5f9" : "none",
                  display:      "flex",
                  gap:          "0.5rem",
                  alignItems:   "flex-start",
                  background:   event.source === "local" ? "#fffbeb" : undefined,
                }}
              >
                <span style={{ fontSize: "13px", lineHeight: "1.4", flexShrink: 0 }}>
                  {EVENT_ICON[event.eventType] ?? "🔵"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{event.eventType}</span>
                    {event.eventValue && (
                      <span style={{ padding: "0 4px", background: "#e0e7ff", color: "#4338ca", borderRadius: "3px", fontSize: "10px", fontWeight: 600, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={event.eventValue}>
                        {event.eventValue}
                      </span>
                    )}
                    {srcBadge && <Chip label={srcBadge.label} bg={srcBadge.bg} colour={srcBadge.colour} />}
                    {/* Show sync badge only when it differs from source badge */}
                    {event.syncStatus !== "confirmed" && syncBadge && (
                      <Chip label={syncBadge.label} bg={syncBadge.bg} colour={syncBadge.colour} />
                    )}
                  </div>
                </div>
                <div style={{ color: "#9ca3af", fontSize: "10px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {formatTs(event.occurredAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Behavioral scenario banner ────────────────────────────────────────────────

const SCENARIO_META: Record<string, { label: string; desc: string; icon: string }> = {
  behavioral_high_intent:               { icon: "🔥", label: "High Intent",          desc: "intent_score ≥ 60 or composite high-intent signals." },
  behavioral_form_started_no_submit:    { icon: "🔄", label: "Form Dropout",          desc: "Started a form but did not submit." },
  behavioral_intent_pricing:            { icon: "💰", label: "Pricing Intent",        desc: "Visited pricing / matched commercial sequences." },
  behavioral_consideration_research:    { icon: "🔍", label: "Research Mode",         desc: "Consideration stage — evaluating options." },
  behavioral_awareness_new_visitor:     { icon: "🌱", label: "New Visitor",           desc: "New or low-signal visitor." },
};

// ── ScenarioOverrideBanner ────────────────────────────────────────────────────

/**
 * Shown at the top of the Journey debug panel when a scenario cookie was
 * detected server-side.  Displays:
 *   1. A red "SCENARIO MODE ACTIVE" banner with the preset label.
 *   2. A collapsible "Real vs Effective" diff table showing which fields changed.
 */
function ScenarioOverrideBanner({
  realJourney,
  effectiveJourney,
  scenarioLabel,
}: {
  realJourney:      JourneyState | null;
  effectiveJourney: JourneyState | null;
  scenarioLabel:    string | null;
}) {
  function diffRow(label: string, real: unknown, effective: unknown) {
    const changed = JSON.stringify(real) !== JSON.stringify(effective);
    if (!changed) return null;
    return (
      <tr key={label} style={{ background: "#fff7ed" }}>
        <td style={{ padding: "2px 6px", color: "#92400e", fontWeight: 600, fontSize: 10 }}>{label}</td>
        <td style={{ padding: "2px 6px", color: "#6b7280",  fontFamily: "monospace", fontSize: 10 }}>
          {String(real ?? "—")}
        </td>
        <td style={{ padding: "2px 6px", color: "#c2410c", fontFamily: "monospace", fontSize: 10, fontWeight: 700 }}>
          {String(effective ?? "—")}
        </td>
      </tr>
    );
  }

  const rows = realJourney && effectiveJourney ? [
    diffRow("funnelStage",        realJourney.funnelStage,           effectiveJourney.funnelStage),
    diffRow("intentScore",        realJourney.intentScore,           effectiveJourney.intentScore),
    diffRow("frictionScore",      realJourney.frictionScore,         effectiveJourney.frictionScore),
    diffRow("confidence.band",    realJourney.confidence.band,       effectiveJourney.confidence.band),
    diffRow("overallConfidence",  realJourney.confidence.overallConfidence, effectiveJourney.confidence.overallConfidence),
    diffRow("hasVisitedPricing",  realJourney.hasVisitedPricing,     effectiveJourney.hasVisitedPricing),
    diffRow("hasVisitedAbout",    realJourney.hasVisitedAbout,       effectiveJourney.hasVisitedAbout),
    diffRow("hasVisitedCases",    realJourney.hasVisitedCases,       effectiveJourney.hasVisitedCases),
    diffRow("hasClickedCta",      realJourney.hasClickedCta,         effectiveJourney.hasClickedCta),
    diffRow("hasSubmittedForm",   realJourney.hasSubmittedForm,      effectiveJourney.hasSubmittedForm),
    diffRow("matchedSequences",   realJourney.matchedSequences?.join(",") ?? "—",
                                  effectiveJourney.matchedSequences?.join(",") ?? "—"),
  ].filter(Boolean) : [];

  return (
    <div style={{
      margin: "0.5rem 0 0.75rem",
      border: "2px solid #ef4444",
      borderRadius: "6px",
      overflow: "hidden",
      fontSize: "11px",
    }}>
      {/* Banner header */}
      <div style={{
        background: "#ef4444",
        color: "#fff",
        padding: "5px 10px",
        fontWeight: 700,
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span>⚡ SCENARIO MODE ACTIVE</span>
        {scenarioLabel && (
          <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 3, padding: "0 6px", fontSize: 10 }}>
            {scenarioLabel}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 10, opacity: 0.85 }}>
          No real data was modified — server cookie override only
        </span>
      </div>

      {/* Diff table — only shown when both real and effective are available */}
      {rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fffbeb" }}>
          <thead>
            <tr style={{ background: "#fef3c7" }}>
              <th style={{ padding: "3px 6px", textAlign: "left", fontSize: 10, color: "#78350f", fontWeight: 700 }}>Field</th>
              <th style={{ padding: "3px 6px", textAlign: "left", fontSize: 10, color: "#78350f", fontWeight: 700 }}>Real (DB)</th>
              <th style={{ padding: "3px 6px", textAlign: "left", fontSize: 10, color: "#c2410c", fontWeight: 700 }}>Effective (override)</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      ) : (
        <div style={{ padding: "6px 10px", color: "#92400e", fontSize: 10, background: "#fffbeb" }}>
          {!realJourney
            ? "Real journey unavailable (first visit or no DB record)."
            : "No differences detected — overrides match real values."}
        </div>
      )}
    </div>
  );
}

function BehavioralScenarioBanner({
  matchedRule,
  journey,
  experiencePlan,
  gating,
}: {
  matchedRule:    RuleMatchInfo;
  journey:        JourneyState;
  experiencePlan: ExperiencePlanSnapshot | null;
  gating:         ReturnType<typeof gateAdaptiveDecisions>;
}) {
  const meta    = SCENARIO_META[matchedRule.ruleId];
  const icon    = meta?.icon  ?? "🎯";
  const label   = meta?.label ?? matchedRule.ruleLabel;
  const desc    = meta?.desc  ?? "";

  const signals: string[] = [
    `funnel: ${journey.funnelStage}`,
    `intent: ${journey.intentScore}`,
    `engagement: ${journey.engagementScore}`,
    `confidence: ${pct(journey.confidence.overallConfidence)} [${journey.confidence.band}]`,
    ...(journey.hasVisitedPricing ? ["pricing ✓"] : []),
    ...(journey.hasVisitedContact ? ["contact ✓"] : []),
    ...(journey.hasClickedCta     ? ["CTA click ✓"] : []),
    ...(journey.formStartCount > 0? [`form ×${journey.formStartCount}`] : []),
    ...(journey.matchedSequences.length > 0 ? [`seq: ${journey.matchedSequences.join(", ")}`] : []),
  ];

  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderLeft: "4px solid #f59e0b", borderRadius: "4px", padding: "0.625rem 0.75rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "16px" }}>{icon}</span>
        <span style={{ fontWeight: 700, color: "#92400e", fontSize: "12px", letterSpacing: "0.05em" }}>BEHAVIORAL RULE MATCHED</span>
        <span style={{ padding: "1px 8px", background: "#f59e0b", color: "#fff", borderRadius: "9999px", fontWeight: 700, fontSize: "11px" }}>{label}</span>
        <span style={{ color: "#b45309", fontSize: "10px" }}>
          rule: <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: "2px" }}>{matchedRule.ruleId}</code>
          {" "}· priority {matchedRule.priority}
        </span>
      </div>
      {desc && <div style={{ color: "#78350f", fontSize: "11px", marginBottom: "0.375rem" }}>{desc}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
        {/* Signals */}
        <div>
          <div style={{ fontWeight: 600, color: "#92400e", fontSize: "10px", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Signals</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
            {signals.map((s, i) => (
              <span key={i} style={{ padding: "1px 5px", background: "#fef3c7", color: "#92400e", borderRadius: "3px", fontSize: "10px", border: "1px solid #fde68a" }}>{s}</span>
            ))}
          </div>
        </div>
        {/* Experience */}
        {experiencePlan && (
          <div>
            <div style={{ fontWeight: 600, color: "#92400e", fontSize: "10px", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Experience</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {[
                { l: "hero",  v: experiencePlan.heroKey,  c: "#3b82f6", allowed: gating.hero },
                { l: "proof", v: experiencePlan.proofKey, c: "#8b5cf6", allowed: gating.proof },
                { l: "cta",   v: experiencePlan.ctaKey,   c: "#10b981", allowed: gating.cta },
                ...(experiencePlan.themeKey ? [{ l: "theme", v: experiencePlan.themeKey, c: "#f59e0b", allowed: gating.theme }] : []),
              ].map(({ l, v, c, allowed }) => (
                <span key={l} style={{ padding: "1px 5px", background: allowed ? `${c}15` : "#f1f5f9", color: allowed ? c : "#9ca3af", borderRadius: "3px", fontSize: "10px", border: `1px solid ${allowed ? `${c}40` : "#e2e8f0"}`, fontWeight: 600 }}>
                  {allowed ? "✓" : "✗"} {l}: {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Blocked */}
        {gating.blockedReasons.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: "#92400e", fontSize: "10px", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Blocked by confidence</div>
            {gating.blockedReasons.map((r, i) => (
              <div key={i} style={{ color: "#9ca3af", fontSize: "10px" }}>· {r}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
