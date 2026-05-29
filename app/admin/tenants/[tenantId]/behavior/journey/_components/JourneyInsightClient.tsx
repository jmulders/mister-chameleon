"use client";

/**
 * Journey Insight Client
 *
 * Behavioral intelligence visualization layer for tenant admins.
 * Translates raw journey signals into clear, human-readable decision
 * intelligence that marketers and product owners can use in demos,
 * strategy calls, and day-to-day decision-making.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   1. Session Selector   — search or pick from recent sessions
 *   2. Journey Overview   — stage, confidence, friction, adaptive mode
 *   3. Journey Timeline   — visual funnel progression bar
 *   4. Confidence Panel   — 4-dimension confidence breakdown
 *   5. Friction Panel     — friction score + what's causing it
 *   6. Why This Exp?      — adaptive decisions explained
 *   7. Event Timeline     — recent events in readable form
 *   8. Matched Sequences  — detected behavioral patterns
 */

import React, { useState, useEffect, useTransition } from "react";
import type {
  JourneySessionSummary,
  SessionJourneyPayload,
} from "../actions";
import {
  fetchRecentJourneySessionsAction,
  fetchSessionJourneyAction,
} from "../actions";
import type { JourneyState, JourneyEventRow, JourneyFunnelStage, ConfidenceBand } from "@/lib/journey/types";
import type { SequenceDetectionResult, SequenceMatchDetail, SequenceNearMiss } from "@/lib/journey/detect-sequences";
import type { VisitorCrmIdentity, CrmLifecycleStage } from "@/lib/crm/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  tenantId:        string;
  initialSessions: JourneySessionSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms  = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STAGE_ORDER: JourneyFunnelStage[] = [
  "awareness", "consideration", "intent", "high_intent", "customer",
];

const STAGE_LABELS: Record<JourneyFunnelStage, string> = {
  awareness:    "Awareness",
  consideration:"Consideration",
  intent:       "Intent",
  high_intent:  "High Intent",
  customer:     "Customer",
};

const STAGE_DESC: Record<JourneyFunnelStage, string> = {
  awareness:    "First visit — no strong signals yet",
  consideration:"Exploring content and pages",
  intent:       "Pricing, forms, or key sequences detected",
  high_intent:  "Multiple intent signals, actively evaluating",
  customer:     "Converted — form submitted",
};

const STAGE_COLOR: Record<JourneyFunnelStage, string> = {
  awareness:    "bg-slate-400",
  consideration:"bg-blue-400",
  intent:       "bg-amber-400",
  high_intent:  "bg-orange-500",
  customer:     "bg-green-500",
};

const STAGE_RING: Record<JourneyFunnelStage, string> = {
  awareness:    "ring-slate-400 text-slate-700 bg-slate-50",
  consideration:"ring-blue-400 text-blue-700 bg-blue-50",
  intent:       "ring-amber-400 text-amber-700 bg-amber-50",
  high_intent:  "ring-orange-500 text-orange-700 bg-orange-50",
  customer:     "ring-green-500 text-green-700 bg-green-50",
};

const BAND_LABEL: Record<ConfidenceBand, string> = {
  low:       "Low confidence",
  medium:    "Medium confidence",
  high:      "High confidence",
  very_high: "Very high confidence",
};

const BAND_COLOR: Record<ConfidenceBand, string> = {
  low:       "text-red-600    bg-red-50    border-red-200",
  medium:    "text-amber-600  bg-amber-50  border-amber-200",
  high:      "text-blue-600   bg-blue-50   border-blue-200",
  very_high: "text-green-600  bg-green-50  border-green-200",
};

const BAND_BAR: Record<ConfidenceBand, string> = {
  low:       "bg-red-400",
  medium:    "bg-amber-400",
  high:      "bg-blue-500",
  very_high: "bg-green-500",
};

const EVENT_LABELS: Record<string, string> = {
  page_view:   "Page View",
  cta_click:   "CTA Click",
  form_start:  "Form Started",
  form_submit: "Form Submitted",
  download:    "Download",
};

const EVENT_COLOR: Record<string, string> = {
  page_view:   "bg-slate-100 text-slate-600",
  cta_click:   "bg-amber-100 text-amber-700",
  form_start:  "bg-blue-100  text-blue-700",
  form_submit: "bg-green-100 text-green-700",
  download:    "bg-purple-100 text-purple-700",
};

/** Map confidence band to adaptive mode label for the Overview card. */
function deriveAdaptiveMode(band: ConfidenceBand, frictionScore: number): string {
  if (frictionScore >= 60) return "Minimal — high friction detected";
  switch (band) {
    case "very_high": return "Fully Personalised";
    case "high":      return "Personalised";
    case "medium":    return "Segmented";
    default:          return "Default";
  }
}

/** Describe which adaptive outputs are unlocked. */
function deriveUnlockedOutputs(band: ConfidenceBand, frictionScore: number): string[] {
  if (frictionScore >= 60) return ["Default hero", "Default CTAs", "Default proof"];
  const base = ["CTA variant", "Proof block variant"];
  if (band === "high" || band === "very_high") base.push("Hero variant");
  if (band === "very_high") base.push("Theme / layout changes");
  return base;
}

/** Describe what is blocked and why. */
function deriveBlockedOutputs(band: ConfidenceBand, frictionScore: number): string[] {
  const blocked: string[] = [];
  if (frictionScore >= 60) {
    blocked.push("All personalisation suppressed — friction score " + frictionScore);
    return blocked;
  }
  if (band === "low" || band === "medium") {
    blocked.push("Hero variant (requires high confidence)");
  }
  if (band !== "very_high") {
    blocked.push("Theme changes (requires very high confidence)");
  }
  return blocked;
}

/** Explain friction causes in plain language. */
function explainFriction(j: JourneyState): string[] {
  const causes: string[] = [];
  if (j.hasVisitedPricing && j.pageViewCount > 0) {
    const pricingRatio = j.hasVisitedPricing ? (j.intentScore > 0 ? j.intentScore : 0) : 0;
    if (pricingRatio > 0) {
      // High pricing repetition but no other signals
      if (j.signalDiversityScore < 0.3) {
        causes.push("Repeated pricing page visits with few other signals");
      }
    }
  }
  if (j.burstPenalty > 0.2) {
    causes.push(`Bursty navigation detected — many events in a short window (penalty: ${Math.round(j.burstPenalty * 100)}%)`);
  }
  if (j.deduplicatedEventCount > 2) {
    causes.push(`${j.deduplicatedEventCount} near-duplicate events were downweighted`);
  }
  if (j.signalDiversityScore < 0.2 && j.pageViewCount > 3) {
    causes.push("Shallow navigation — same pages visited repeatedly");
  }
  if (causes.length === 0 && j.frictionScore > 0) {
    causes.push("Repetitive behavior pattern detected");
  }
  return causes;
}

/** Derive the main confidence drivers in human terms. */
function explainConfidenceDrivers(j: JourneyState): string[] {
  const drivers: string[] = [];
  if (j.repeatSessionBonus > 0.5) drivers.push("Returning visitor across multiple days");
  if (j.matchedSequences.length > 0) drivers.push(`Matched ${j.matchedSequences.length} behavioral sequence${j.matchedSequences.length > 1 ? "s" : ""}`);
  if (j.signalDiversityScore >= 0.5) drivers.push("Diverse engagement signals across page types");
  if (j.hasSubmittedForm) drivers.push("Form submitted (high-intent conversion signal)");
  if (j.hasClickedCta) drivers.push("Clicked a call-to-action");
  if (j.shortTermIntentScore > 30) drivers.push("Active in-session research (high recency)");
  if (j.longTermAffinityScore > 20) drivers.push("Sustained affinity — interest built over time");
  if (drivers.length === 0) {
    if (j.pageViewCount > 0) drivers.push("Some pages visited, building initial picture");
    else drivers.push("No signal data yet — confidence is low by default");
  }
  return drivers;
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-neutral-200 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {badge}
    </div>
  );
}

function Meter({ value, max = 100, color = "bg-indigo-500", label }: {
  value: number; max?: number; color?: string; label?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      {label && <div className="w-36 text-xs text-neutral-500 shrink-0 truncate">{label}</div>}
      <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs font-semibold text-neutral-700 tabular-nums">{pct}</div>
    </div>
  );
}

function ScoreChip({ label, value, max = 100, color }: {
  label: string; value: number; max?: number; color: string;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-col gap-1 ${color}`}>
      <span className="text-2xl font-bold tabular-nums">{Math.round(value)}</span>
      <span className="text-xs font-medium opacity-70">/{max} {label}</span>
    </div>
  );
}

function StageDot({ stage, current }: { stage: JourneyFunnelStage; current: JourneyFunnelStage }) {
  const isReached  = STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(current);
  const isCurrent  = stage === current;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className={[
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 transition-all",
        isCurrent
          ? `${STAGE_COLOR[stage]} ring-neutral-900 text-white shadow-md scale-110`
          : isReached
            ? `${STAGE_COLOR[stage]} ring-transparent text-white opacity-70`
            : "bg-neutral-100 ring-neutral-200 text-neutral-400",
      ].join(" ")}>
        {STAGE_ORDER.indexOf(stage) + 1}
      </div>
      <span className={[
        "text-xs font-medium text-center leading-tight",
        isCurrent ? "text-neutral-900" : "text-neutral-400",
      ].join(" ")}>
        {STAGE_LABELS[stage]}
      </span>
    </div>
  );
}

function StageLine({ stage, current }: { stage: JourneyFunnelStage; current: JourneyFunnelStage }) {
  const isReached = STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(current);
  return (
    <div className={[
      "flex-1 h-0.5 mb-6 transition-all",
      isReached ? "bg-neutral-400" : "bg-neutral-200",
    ].join(" ")} />
  );
}

// ── Section: Session Selector ─────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  google:   "G",
  linkedin: "in",
  direct:   "↗",
  unknown:  "?",
};

const SOURCE_COLOR: Record<string, string> = {
  google:   "bg-blue-50 text-blue-700 border-blue-200",
  linkedin: "bg-sky-50 text-sky-700 border-sky-200",
  direct:   "bg-neutral-100 text-neutral-600 border-neutral-200",
  unknown:  "bg-neutral-100 text-neutral-400 border-neutral-200",
};

const DEVICE_ICON: Record<string, string> = {
  mobile:  "📱",
  desktop: "💻",
};

type StageFilter = "all" | JourneyFunnelStage;

function SessionSelector({
  tenantId,
  sessions,
  selectedId,
  onSelect,
  compact = false,
}: {
  tenantId:   string;
  sessions:   JourneySessionSummary[];
  selectedId: string | null;
  onSelect:   (id: string) => void;
  compact?:   boolean;
}) {
  // ── Compact mode: inline dropdown to switch sessions ─────────────────────
  if (compact) {
    return (
      <select
        value={selectedId ?? ""}
        onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
        className="text-xs border border-neutral-200 rounded-md px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[280px]"
      >
        <option value="" disabled>Switch session…</option>
        {sessions.map((s) => (
          <option key={s.sessionId} value={s.sessionId}>
            {STAGE_LABELS[s.funnelStage as JourneyFunnelStage] ?? s.funnelStage}
            {" · "}{s.sessionId.slice(0, 8)}…
            {" · "}{fmtRelative(s.lastSeenAt)}
          </option>
        ))}
      </select>
    );
  }

  const [search,      setSearch]      = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  // Read the visitor's own mc_session_id cookie client-side (runs once on mount).
  React.useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)mc_session_id=([^;]+)/);
    if (match?.[1]) setMySessionId(match[1]);
  }, []);

  const filtered = sessions.filter((s) => {
    const matchesSearch =
      !search.trim() || s.sessionId.toLowerCase().includes(search.toLowerCase());
    const matchesStage =
      stageFilter === "all" || s.funnelStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) onSelect(trimmed);
  }

  const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
    { value: "all",          label: "All" },
    { value: "awareness",    label: "Awareness" },
    { value: "consideration",label: "Consideration" },
    { value: "intent",       label: "Intent" },
    { value: "high_intent",  label: "High Intent" },
    { value: "customer",     label: "Customer" },
  ];

  const stageCounts: Partial<Record<StageFilter, number>> = { all: sessions.length };
  for (const s of sessions) {
    stageCounts[s.funnelStage as JourneyFunnelStage] =
      (stageCounts[s.funnelStage as JourneyFunnelStage] ?? 0) + 1;
  }

  return (
    <Card>
      <CardHeader
        title="Select a Visitor Session"
        subtitle="Pick a recent session or paste a session ID to visualize its journey."
      />
      <div className="p-5 space-y-4">

        {/* ── "Use my session" shortcut ───────────────────────────────────── */}
        {mySessionId && (
          <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-800">Your test session detected</p>
              <p className="font-mono text-xs text-indigo-500 truncate">{mySessionId}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(mySessionId)}
              className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 transition-colors"
            >
              Load my session
            </button>
          </div>
        )}

        {/* ── Direct ID input ─────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Paste a session ID, or filter the list below…"
            className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!search.trim() || isPending}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Look up
          </button>
        </form>

        {/* ── Stage filter tabs ───────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {STAGE_FILTERS.map(({ value, label }) => {
              const count = stageCounts[value];
              if (value !== "all" && !count) return null;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStageFilter(value)}
                  className={[
                    "text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
                    stageFilter === value
                      ? value === "all"
                        ? "bg-neutral-800 text-white border-neutral-800"
                        : `${STAGE_RING[value as JourneyFunnelStage] ?? "bg-neutral-800 text-white border-neutral-800"} ring-1`
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400",
                  ].join(" ")}
                >
                  {label}
                  {count !== undefined && (
                    <span className="ml-1 opacity-60">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Session list ────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-neutral-400 text-sm">
            {sessions.length === 0 ? (
              <div className="max-w-xs mx-auto space-y-2">
                <div className="font-medium text-neutral-500">No visitor sessions yet</div>
                <p className="text-xs leading-relaxed">
                  Sessions appear here once visitors interact with the site{" "}
                  <strong className="text-neutral-500">with the cookie banner accepted</strong>.
                  Events are silently blocked until consent is granted.
                </p>
                <p className="text-xs text-neutral-300">
                  Use the "Seed test events" button (visible after selecting a session) to inject
                  test data directly without needing consent.
                </p>
              </div>
            ) : (
              "No sessions match your filter."
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">
              {filtered.length} session{filtered.length !== 1 ? "s" : ""}
              {stageFilter !== "all" ? ` · ${STAGE_LABELS[stageFilter as JourneyFunnelStage]}` : ""}
            </p>
            {filtered.map((s) => {
              const srcColor = SOURCE_COLOR[s.source ?? "unknown"] ?? SOURCE_COLOR["unknown"];
              const srcIcon  = SOURCE_ICON[s.source ?? "unknown"]  ?? "?";
              const devIcon  = DEVICE_ICON[s.device ?? ""]         ?? "";
              return (
                <button
                  key={s.sessionId}
                  onClick={() => onSelect(s.sessionId)}
                  className={[
                    "w-full text-left border rounded-lg px-4 py-3 transition-all hover:border-indigo-300 hover:bg-indigo-50",
                    selectedId === s.sessionId
                      ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                      : "border-neutral-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Source badge */}
                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${srcColor}`}>
                          {srcIcon}
                        </span>
                        {/* Device icon */}
                        {devIcon && (
                          <span className="text-xs leading-none" title={s.device ?? ""}>{devIcon}</span>
                        )}
                        <span className="font-mono text-xs text-neutral-500 truncate">{s.sessionId}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_RING[s.funnelStage as JourneyFunnelStage] ?? "bg-neutral-100 text-neutral-500"} ring-1`}>
                          {STAGE_LABELS[s.funnelStage as JourneyFunnelStage] ?? s.funnelStage}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${BAND_COLOR[s.confidenceBand as ConfidenceBand]}`}>
                          {BAND_LABEL[s.confidenceBand as ConfidenceBand]}
                        </span>
                        {s.frictionScore >= 40 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                            ⚠ friction
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-neutral-400">{fmtRelative(s.lastSeenAt)}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">{s.pageViewCount} pages</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Section: Journey Overview ─────────────────────────────────────────────────

function JourneyOverviewPanel({ journey }: { journey: JourneyState }) {
  const band        = journey.confidence.band;
  const adaptMode   = deriveAdaptiveMode(band, journey.frictionScore);
  const adaptColor  = {
    "Fully Personalised":            "bg-green-50  border-green-200 text-green-800",
    "Personalised":                   "bg-blue-50   border-blue-200  text-blue-800",
    "Segmented":                      "bg-amber-50  border-amber-200 text-amber-800",
    "Default":                        "bg-neutral-50 border-neutral-200 text-neutral-600",
    "Minimal — high friction detected":"bg-red-50   border-red-200   text-red-700",
  }[adaptMode] ?? "bg-neutral-50 border-neutral-200 text-neutral-600";

  const stageIdx     = STAGE_ORDER.indexOf(journey.funnelStage);
  const isCustomer   = journey.funnelStage === "customer";

  return (
    <Card>
      <CardHeader
        title="Journey Overview"
        subtitle="Current state of this visitor's behavioral profile at a glance."
        badge={
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${BAND_COLOR[band]}`}>
            {BAND_LABEL[band]}
          </span>
        }
      />
      <div className="p-5">
        {/* Primary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <ScoreChip
            label="Intent Score"
            value={journey.intentScore}
            color="border-amber-200 bg-amber-50 text-amber-700"
          />
          <ScoreChip
            label="Engagement"
            value={journey.engagementScore}
            color="border-blue-200 bg-blue-50 text-blue-700"
          />
          <ScoreChip
            label="Friction"
            value={journey.frictionScore}
            color={journey.frictionScore >= 60
              ? "border-red-200 bg-red-50 text-red-700"
              : journey.frictionScore >= 30
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-green-200 bg-green-50 text-green-700"}
          />
          <ScoreChip
            label="Recency"
            value={journey.recencyScore}
            color="border-purple-200 bg-purple-50 text-purple-700"
          />
        </div>

        {/* Adaptive mode */}
        <div className={`flex items-center justify-between border rounded-lg px-4 py-3 mb-4 ${adaptColor}`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">Adaptive Mode</div>
            <div className="font-semibold text-sm">{adaptMode}</div>
          </div>
          <div className="text-xl">
            {isCustomer ? "🎉" : band === "very_high" ? "✨" : band === "high" ? "🎯" : band === "medium" ? "🔍" : "🌱"}
          </div>
        </div>

        {/* Key flags */}
        <div className="flex flex-wrap gap-2">
          {journey.hasVisitedPricing  && <Flag label="Visited Pricing"   color="bg-amber-100 text-amber-700" />}
          {journey.hasVisitedCases    && <Flag label="Read Case Studies"  color="bg-blue-100  text-blue-700" />}
          {journey.hasVisitedAbout    && <Flag label="Visited About"      color="bg-slate-100 text-slate-700" />}
          {journey.hasVisitedContact  && <Flag label="Visited Contact"    color="bg-violet-100 text-violet-700" />}
          {journey.hasClickedCta      && <Flag label="Clicked CTA"        color="bg-orange-100 text-orange-700" />}
          {journey.hasSubmittedForm   && <Flag label="Form Submitted"     color="bg-green-100 text-green-700" />}
          {journey.matchedSequences.length > 0 && (
            <Flag
              label={`${journey.matchedSequences.length} sequence${journey.matchedSequences.length > 1 ? "s" : ""} matched`}
              color="bg-indigo-100 text-indigo-700"
            />
          )}
          {journey.repeatSessionBonus > 0.3 && (
            <Flag label="Returning visitor" color="bg-teal-100 text-teal-700" />
          )}
          {stageIdx >= 0 && (
            <div className="text-xs text-neutral-400 self-center">
              Last seen: {fmtRelative(journey.lastSeenAt)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Flag({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{label}</span>
  );
}

// ── Section: Journey Timeline ─────────────────────────────────────────────────

function JourneyTimeline({ journey }: { journey: JourneyState }) {
  const current   = journey.funnelStage;
  const currentIdx = STAGE_ORDER.indexOf(current);

  return (
    <Card>
      <CardHeader
        title="Journey Timeline"
        subtitle="Progression through the behavioral funnel — where this visitor is today."
      />
      <div className="p-5">
        {/* Stage progression bar */}
        <div className="flex items-center mb-6">
          {STAGE_ORDER.map((stage, i) => (
            <React.Fragment key={stage}>
              <StageDot stage={stage} current={current} />
              {i < STAGE_ORDER.length - 1 && (
                <StageLine stage={stage} current={current} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current stage callout */}
        <div className={`border rounded-xl px-5 py-4 ${STAGE_RING[current]}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Current Stage
              </div>
              <div className="text-xl font-bold">{STAGE_LABELS[current]}</div>
              <div className="mt-1 text-sm opacity-80">{STAGE_DESC[current]}</div>
            </div>
            <div className={`w-10 h-10 rounded-full ${STAGE_COLOR[current]} flex-shrink-0 mt-0.5`} />
          </div>

          {/* Next stage hint */}
          {currentIdx < STAGE_ORDER.length - 1 && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20 text-xs opacity-70">
              <span className="font-semibold">Next: </span>
              {STAGE_LABELS[STAGE_ORDER[currentIdx + 1]]} — {STAGE_DESC[STAGE_ORDER[currentIdx + 1]]}
            </div>
          )}
          {current === "customer" && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20 text-xs opacity-70">
              This visitor has converted. The experience is in post-conversion mode.
            </div>
          )}
        </div>

        {/* First/last seen */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-neutral-500">
          <div>
            <span className="font-medium text-neutral-700">First seen:</span>{" "}
            {fmtTime(journey.firstSeenAt)}
          </div>
          <div>
            <span className="font-medium text-neutral-700">Last seen:</span>{" "}
            {fmtTime(journey.lastSeenAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Section: Confidence Panel ─────────────────────────────────────────────────

function ConfidencePanel({ journey }: { journey: JourneyState }) {
  const c    = journey.confidence;
  const band = c.band;

  const dimensions = [
    {
      label:  "Intent Confidence",
      value:  Math.round(c.intentConfidence * 100),
      hint:   "How certain we are about the visitor's intent signals",
    },
    {
      label:  "Sequence Confidence",
      value:  Math.round(c.sequenceConfidence * 100),
      hint:   "Based on matched behavioral sequences",
    },
    {
      label:  "Stage Confidence",
      value:  Math.round(c.funnelStageConfidence * 100),
      hint:   "How certain we are about the assigned funnel stage",
    },
    {
      label:  "Overall Confidence",
      value:  Math.round(c.overallConfidence * 100),
      hint:   "Weighted composite score that gates adaptive decisions",
    },
  ];

  const drivers = explainConfidenceDrivers(journey);

  return (
    <Card>
      <CardHeader
        title="Confidence"
        subtitle="How much the system trusts the current behavioral interpretation."
        badge={
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${BAND_COLOR[band]}`}>
            {BAND_LABEL[band]}
          </span>
        }
      />
      <div className="p-5 space-y-5">
        {/* Dimension bars */}
        <div className="space-y-3">
          {dimensions.map(({ label, value, hint }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-neutral-700">{label}</span>
                <span className="text-xs text-neutral-400">{hint}</span>
              </div>
              <Meter
                value={value}
                color={BAND_BAR[band]}
              />
            </div>
          ))}
        </div>

        {/* Gating table */}
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Adaptive Output</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Requires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                { output: "CTA variant",     ok: band !== "low",     requires: "Medium confidence" },
                { output: "Proof variant",   ok: band !== "low",     requires: "Medium confidence" },
                { output: "Hero variant",    ok: band === "high" || band === "very_high", requires: "High confidence" },
                { output: "Theme changes",   ok: band === "very_high", requires: "Very high confidence" },
              ].map(({ output, ok, requires }) => (
                <tr key={output} className={ok ? "bg-white" : "bg-neutral-50"}>
                  <td className="px-3 py-2 font-medium text-neutral-700">{output}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${ok ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"}`}>
                      {ok ? "✓ Unlocked" : "Locked"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{requires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Confidence drivers */}
        {drivers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Why this confidence level
            </div>
            <ul className="space-y-1.5">
              {drivers.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="text-green-500 mt-0.5 shrink-0">●</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* System reasons */}
        {c.reasons.length > 0 && (
          <div className="bg-neutral-50 rounded-lg px-4 py-3 text-xs text-neutral-500 space-y-1">
            {c.reasons.map((r) => <div key={r}>{r}</div>)}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Section: Friction Panel ───────────────────────────────────────────────────

function FrictionPanel({ journey }: { journey: JourneyState }) {
  const score    = journey.frictionScore;
  const band     = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const causes   = explainFriction(journey);

  const frictionConfig = {
    high:   { label: "High Friction",   color: "bg-red-50 border-red-200 text-red-700",    bar: "bg-red-500",    icon: "⚠️" },
    medium: { label: "Moderate Friction",color: "bg-amber-50 border-amber-200 text-amber-700", bar: "bg-amber-400", icon: "⚡" },
    low:    { label: "Clean Signal",    color: "bg-green-50 border-green-200 text-green-700", bar: "bg-green-500", icon: "✓" },
  }[band];

  return (
    <Card>
      <CardHeader
        title="Friction & Noise"
        subtitle="Patterns that indicate confusion, repetition, or bursty behavior — not genuine intent."
        badge={
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${frictionConfig.color}`}>
            {frictionConfig.icon} {frictionConfig.label}
          </span>
        }
      />
      <div className="p-5 space-y-5">
        {/* Gauge */}
        <div className={`border rounded-xl px-5 py-4 ${frictionConfig.color}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Friction Score</span>
            <span className="text-3xl font-bold tabular-nums">{score}</span>
          </div>
          <div className="bg-white/50 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${frictionConfig.bar}`}
              style={{ width: `${Math.min(100, score)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 opacity-60">
            <span>Clean signal</span>
            <span>Extreme friction</span>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-3">
          <Meter
            label="Signal diversity"
            value={Math.round(journey.signalDiversityScore * 100)}
            color="bg-teal-500"
          />
          <Meter
            label="Burst penalty"
            value={Math.round(journey.burstPenalty * 200)} // 0–0.5 → 0–100
            color="bg-orange-400"
          />
          <Meter
            label="Dedup downweighted"
            value={Math.min(100, journey.deduplicatedEventCount * 10)}
            color="bg-red-400"
          />
          <div className="text-xs text-neutral-400">
            Unique signal types active: {journey.uniqueSignalCount} of 10
          </div>
        </div>

        {/* Causes */}
        {causes.length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              What's causing friction
            </div>
            <ul className="space-y-2">
              {causes.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="text-amber-500 mt-0.5 shrink-0">●</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No significant friction patterns detected. Signal looks clean.
          </p>
        )}

        {/* Suppression note */}
        {score >= 60 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <span className="font-semibold">Personalization suppressed.</span>{" "}
            High friction prevents confident intent inference. The visitor sees the default experience until signals stabilise.
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Section: Why This Experience ──────────────────────────────────────────────

function WhyThisExperiencePanel({ journey }: { journey: JourneyState }) {
  const band     = journey.confidence.band;
  const unlocked = deriveUnlockedOutputs(band, journey.frictionScore);
  const blocked  = deriveBlockedOutputs(band, journey.frictionScore);
  const mode     = deriveAdaptiveMode(band, journey.frictionScore);

  const fallbackLevel =
    band === "very_high" ? "personalized" :
    band === "high"      ? "personalized (hero)" :
    band === "medium"    ? "segmented" : "default";

  return (
    <Card>
      <CardHeader
        title="Why This Experience?"
        subtitle="Decision intelligence — why the system chose this adaptive experience for this visitor."
      />
      <div className="p-5 space-y-5">
        {/* Chosen mode */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
          <div className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-1">
            Current adaptive mode
          </div>
          <div className="text-xl font-bold text-indigo-900">{mode}</div>
          <div className="text-sm text-indigo-700 mt-1">
            Fallback level: <strong>{fallbackLevel}</strong>
          </div>
        </div>

        {/* What's unlocked */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Experience components active
          </div>
          <ul className="space-y-1.5">
            {unlocked.map((u) => (
              <li key={u} className="flex items-center gap-2 text-sm text-green-700">
                <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                {u}
              </li>
            ))}
          </ul>
        </div>

        {/* What's blocked */}
        {blocked.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Stronger options not yet unlocked
            </div>
            <ul className="space-y-1.5">
              {blocked.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center text-xs shrink-0">–</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Signal summary */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Signals that influenced this decision
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Intent Score",        value: `${journey.intentScore}/100`,         show: true },
              { label: "Engagement Score",    value: `${journey.engagementScore}/100`,     show: true },
              { label: "Sequence Matches",    value: `${journey.matchedSequences.length}`, show: true },
              { label: "Diversity Score",     value: `${Math.round(journey.signalDiversityScore * 100)}%`, show: true },
              { label: "Recency",             value: journey.lastSeenAt ? fmtRelative(journey.lastSeenAt) : "—", show: !!journey.lastSeenAt },
              { label: "Short-term intent",   value: `${journey.shortTermIntentScore}/100`, show: journey.shortTermIntentScore > 0 },
              { label: "Long-term affinity",  value: `${journey.longTermAffinityScore}/100`, show: journey.longTermAffinityScore > 0 },
              { label: "Repeat visit bonus",  value: `${Math.round(journey.repeatSessionBonus * 100)}%`, show: journey.repeatSessionBonus > 0 },
            ].filter((r) => r.show).map(({ label, value }) => (
              <div key={label} className="flex justify-between border border-neutral-100 rounded px-2.5 py-1.5 bg-neutral-50">
                <span className="text-neutral-500">{label}</span>
                <span className="font-semibold text-neutral-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Section: Event Timeline ───────────────────────────────────────────────────

function EventTimelinePanel({ events }: { events: JourneyEventRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? events : events.slice(-10);

  return (
    <Card>
      <CardHeader
        title="Recent Journey Events"
        subtitle="Behavioral signals recorded for this session, in chronological order."
        badge={
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
            {events.length} events
          </span>
        }
      />
      <div className="p-5">
        {events.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No events yet"
            description="Journey events appear here as the visitor navigates the site."
          />
        ) : (
          <>
            <div className="space-y-0.5">
              {displayed.map((ev, i) => (
                <div key={ev.id ?? i} className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0">
                  {/* Timeline dot */}
                  <div className="mt-0.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-indigo-300 mt-1" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EVENT_COLOR[ev.event_type] ?? "bg-neutral-100 text-neutral-600"}`}>
                        {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                      </span>
                      {ev.page_path && (
                        <span className="text-xs text-neutral-500 font-mono truncate max-w-[200px]">
                          {ev.page_path}
                        </span>
                      )}
                      {ev.event_value && ev.event_value !== ev.page_path && (
                        <span className="text-xs text-neutral-400 font-mono truncate max-w-[160px]">
                          {ev.event_value}
                        </span>
                      )}
                    </div>
                    {ev.page_category && (
                      <span className="mt-1 inline-block text-xs text-neutral-400">
                        Category: {ev.page_category}
                      </span>
                    )}
                  </div>
                  {/* Timestamp */}
                  <div className="shrink-0 text-xs text-neutral-400 tabular-nums">
                    {fmtRelative(ev.occurred_at)}
                  </div>
                </div>
              ))}
            </div>
            {events.length > 10 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 text-xs text-indigo-600 hover:underline w-full text-center"
              >
                {expanded ? "Show fewer" : `Show all ${events.length} events`}
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ── Section: Matched Sequences ────────────────────────────────────────────────

/** Renders a single fully-matched sequence with its step-by-step match path. */
function MatchedSequenceRow({ detail }: { detail: SequenceMatchDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-100/60 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-indigo-900">{detail.name}</div>
          <div className="text-xs text-indigo-600 mt-0.5">
            {detail.stepCount}-step sequence · score +{detail.score} · confidence +{Math.round(detail.confidenceContribution * 100)}% · completed {fmtTime(detail.completedAt)}
          </div>
        </div>
        <span className="text-indigo-400 text-xs">{open ? "▲ hide path" : "▼ match path"}</span>
      </button>

      {/* Match path */}
      {open && detail.matchPath.length > 0 && (
        <div className="border-t border-indigo-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Match path
          </div>
          <div className="space-y-1">
            {detail.matchPath.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {step.stepIndex + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-neutral-700">{step.step.event_type}</span>
                  {step.step.event_value    && <span className="text-neutral-400"> · {step.step.event_value}</span>}
                  {step.step.page_path      && <span className="text-neutral-400"> · path: {step.step.page_path}</span>}
                  {step.step.page_category  && <span className="text-neutral-400"> · cat: {step.step.page_category}</span>}
                  <span className="text-neutral-400 ml-2">{fmtTime(step.occurredAt)}</span>
                  {step.gapMinutes !== null && (
                    <span className="text-neutral-300 ml-1">(+{step.gapMinutes}m gap)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders a single near-miss (partial sequence) with blocked reason. */
function NearMissRow({ miss }: { miss: SequenceNearMiss }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(miss.progress * 100);

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-100/60 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {pct}%
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-amber-900">{miss.name}</div>
          <div className="text-xs text-amber-700 mt-0.5">
            {miss.stepsMatched}/{miss.totalSteps} steps matched
            {miss.blockedReason && ` · ${miss.blockedReason}`}
          </div>
        </div>
        {miss.matchPath.length > 0 && (
          <span className="text-amber-400 text-xs">{open ? "▲ hide" : "▼ steps"}</span>
        )}
      </button>
      {open && miss.matchPath.length > 0 && (
        <div className="border-t border-amber-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Steps matched so far
          </div>
          <div className="space-y-1">
            {miss.matchPath.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {step.stepIndex + 1}
                </span>
                <div>
                  <span className="font-mono text-neutral-700">{step.step.event_type}</span>
                  {step.step.event_value   && <span className="text-neutral-400"> · {step.step.event_value}</span>}
                  {step.step.page_path     && <span className="text-neutral-400"> · path: {step.step.page_path}</span>}
                  {step.step.page_category && <span className="text-neutral-400"> · cat: {step.step.page_category}</span>}
                  <span className="text-neutral-400 ml-2">{fmtTime(step.occurredAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SequencesPanel({
  journey,
  sequenceDetection,
}: {
  journey:           JourneyState;
  sequenceDetection: SequenceDetectionResult | null;
}) {
  // Prefer rich detection result when available; fall back to stored slugs.
  const matchDetails  = sequenceDetection?.matchDetails  ?? [];
  const nearMisses    = sequenceDetection?.nearMisses    ?? [];
  const fallbackSlugs = sequenceDetection
    ? []
    : journey.matchedSequences.filter(
        (slug) => !matchDetails.some((d) => d.slug === slug),
      );

  const totalMatched = matchDetails.length + fallbackSlugs.length;

  return (
    <Card>
      <CardHeader
        title="Matched Behavioral Sequences"
        subtitle="Ordered patterns of behavior that indicate deeper intent than individual events. Each row expands to show the step-by-step match path and timing."
        badge={
          totalMatched > 0 ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              {totalMatched} matched
            </span>
          ) : nearMisses.length > 0 ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {nearMisses.length} in progress
            </span>
          ) : null
        }
      />
      <div className="p-5 space-y-5">

        {/* Fully matched */}
        {totalMatched === 0 && nearMisses.length === 0 ? (
          <EmptyState
            icon="🔗"
            title="No sequences matched yet"
            description="Sequences fire when a visitor completes a defined ordered pattern of actions — for example, visiting About then Pricing within 2 hours. This visitor hasn't completed any yet."
          />
        ) : (
          <>
            {/* Rich match detail rows */}
            {matchDetails.length > 0 && (
              <div className="space-y-3">
                {matchDetails.map((detail) => (
                  <MatchedSequenceRow key={detail.slug} detail={detail} />
                ))}
              </div>
            )}

            {/* Fallback slug rows when detection result is unavailable */}
            {fallbackSlugs.length > 0 && (
              <div className="space-y-3">
                {fallbackSlugs.map((slug) => (
                  <div key={slug} className="flex items-center gap-3 border border-indigo-200 bg-indigo-50 rounded-lg px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                    <div>
                      <div className="text-sm font-semibold text-indigo-900">{slug}</div>
                      <div className="text-xs text-indigo-600 mt-0.5">
                        Completed — contributed a score bonus and strengthened intent signals.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {journey.sequenceMatchedAt && (
              <div className="text-xs text-neutral-400">
                Last sequence matched: {fmtTime(journey.sequenceMatchedAt)}
              </div>
            )}

            {/* Near-misses */}
            {nearMisses.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                  Near Misses — {nearMisses.length} sequence{nearMisses.length > 1 ? "s" : ""} in progress
                </div>
                <div className="space-y-2">
                  {nearMisses.map((miss) => (
                    <NearMissRow key={miss.slug} miss={miss} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Confidence contribution summary */}
        {sequenceDetection && sequenceDetection.totalConfidenceContribution > 0 && (
          <div className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
            Sequence confidence contribution: +{Math.round(sequenceDetection.totalConfidenceContribution * 100)}%
            {" "}· Score bonus: +{sequenceDetection.totalScore}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Section: CRM Status ───────────────────────────────────────────────────────

/**
 * Maps the behavioral funnel stage to the canonical CRM lifecycle stage.
 * Used when CRM enrichment data is not available in this debug view.
 */
function behavioralStageToLifecycle(stage: JourneyFunnelStage): CrmLifecycleStage {
  switch (stage) {
    case "customer":   return "customer";
    case "high_intent":
    case "intent":     return "opportunity";
    case "consideration": return "lead";
    default:           return "unknown";
  }
}

const LIFECYCLE_LABELS: Record<CrmLifecycleStage, string> = {
  unknown:     "Unknown",
  lead:        "Lead",
  opportunity: "Opportunity",
  customer:    "Customer",
  churned:     "Churned",
};

const LIFECYCLE_COLOR: Record<CrmLifecycleStage, string> = {
  unknown:     "bg-neutral-100 text-neutral-600 border-neutral-200",
  lead:        "bg-blue-50 text-blue-700 border-blue-200",
  opportunity: "bg-amber-50 text-amber-700 border-amber-200",
  customer:    "bg-green-50 text-green-700 border-green-200",
  churned:     "bg-red-50 text-red-600 border-red-200",
};

const CUSTOMER_MODE_LABELS: Record<string, string> = {
  acquisition_mode: "Acquisition",
  onboarding_mode:  "Onboarding",
  active_usage_mode:"Active Usage",
  expansion_mode:   "Expansion",
  churn_risk_mode:  "Churn Risk",
};

const CUSTOMER_MODE_COLOR: Record<string, string> = {
  acquisition_mode: "bg-slate-100 text-slate-600 border-slate-200",
  onboarding_mode:  "bg-teal-50 text-teal-700 border-teal-200",
  active_usage_mode:"bg-green-50 text-green-700 border-green-200",
  expansion_mode:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  churn_risk_mode:  "bg-red-50 text-red-600 border-red-200",
};

const CUSTOMER_MODE_DESC: Record<string, string> = {
  acquisition_mode: "Visitor has not yet converted — seeing the acquisition experience.",
  onboarding_mode:  "Recently converted customer — seeing onboarding and activation content.",
  active_usage_mode:"Established customer with regular engagement — in retention/upsell mode.",
  expansion_mode:   "High feature interest + engagement signals — showing upgrade or expansion content.",
  churn_risk_mode:  "Low recency, low engagement — at risk. Seeing re-engagement experience.",
};

/** Derive a rough customer mode from journey signals without CRM enrichment. */
function deriveBehavioralCustomerMode(journey: JourneyState): string {
  const isCustomer = journey.funnelStage === "customer";
  if (!isCustomer) return "acquisition_mode";

  // Churn risk: very low recency + low engagement
  if (journey.recencyScore < 15 && journey.engagementScore < 20) return "churn_risk_mode";

  // Expansion: high intent + diverse signals
  if (journey.intentScore > 60 && journey.signalDiversityScore >= 0.5) return "expansion_mode";

  // Onboarding: few page views, just converted
  if (journey.pageViewCount < 8 && journey.engagementScore < 40) return "onboarding_mode";

  return "active_usage_mode";
}

/** Mask a string for privacy — show first + last chars with asterisks in between. */
function maskId(value: string, keep = 6): string {
  if (value.length <= keep * 2) return value;
  return value.slice(0, keep) + "…" + value.slice(-4);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return maskId(email, 3);
  return local.slice(0, 2) + "****@" + domain;
}

const CRM_SOURCE_LABELS: Record<string, string> = {
  hubspot:    "HubSpot",
  salesforce: "Salesforce",
  other:      "Custom CRM",
};

const RESOLVED_VIA_LABELS: Record<string, string> = {
  email:      "Email form submission",
  crm_cookie: "CRM tracking cookie",
  manual:     "Manually resolved",
};

function CrmStatusPanel({
  journey,
  crmIdentity,
}: {
  journey:     JourneyState;
  crmIdentity: VisitorCrmIdentity | null;
}) {
  const behavioralLifecycle = behavioralStageToLifecycle(journey.funnelStage);
  const customerMode        = deriveBehavioralCustomerMode(journey);
  const isMatched           = !!crmIdentity;

  // Determine the effective lifecycle stage for display
  // (identity resolved but no enrichment output cached = behavioral fallback)
  const effectiveLifecycle: CrmLifecycleStage = behavioralLifecycle;
  const lifecycleSource = isMatched ? "crm-identity-resolved" : "behavior";

  return (
    <Card>
      <CardHeader
        title="CRM Status"
        subtitle="Identity resolution, lifecycle stage, and customer mode for this session."
        badge={
          <span className={[
            "text-xs font-semibold px-3 py-1 rounded-full border",
            isMatched
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-neutral-100 text-neutral-500 border-neutral-200",
          ].join(" ")}>
            {isMatched ? "✓ CRM matched" : "Not resolved"}
          </span>
        }
      />
      <div className="p-5 space-y-6">

        {/* ── Identity Resolution ─────────────────────────────────────────── */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Identity Resolution
          </div>
          {isMatched ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status */}
              <div className="col-span-full flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold shrink-0">✓</div>
                <div>
                  <div className="text-sm font-semibold text-green-800">Visitor identified</div>
                  <div className="text-xs text-green-600 mt-0.5">
                    Session linked to a CRM contact via {RESOLVED_VIA_LABELS[crmIdentity.resolvedVia] ?? crmIdentity.resolvedVia}.
                    Resolved {fmtRelative(crmIdentity.resolvedAt)}.
                  </div>
                </div>
              </div>

              {/* Contact ID */}
              <CrmField
                label="Contact ID"
                value={maskId(crmIdentity.contactId, 8)}
                icon="👤"
              />

              {/* CRM Source */}
              <CrmField
                label="CRM System"
                value={CRM_SOURCE_LABELS[crmIdentity.crmSource] ?? crmIdentity.crmSource}
                icon="🔗"
              />

              {/* Email */}
              {crmIdentity.email && (
                <CrmField
                  label="Email"
                  value={maskEmail(crmIdentity.email)}
                  icon="✉️"
                />
              )}

              {/* Account ID */}
              {crmIdentity.accountId && (
                <CrmField
                  label="Account ID"
                  value={maskId(crmIdentity.accountId, 8)}
                  icon="🏢"
                />
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-4">
              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-sm shrink-0">?</div>
              <div>
                <div className="text-sm font-semibold text-neutral-700">No CRM identity resolved</div>
                <div className="text-xs text-neutral-500 mt-1">
                  This visitor session has not been matched to a CRM contact yet.
                  Identity resolves automatically when the visitor submits a form with their
                  email address, or when their CRM tracking cookie is detected.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Lifecycle & Customer Mode ────────────────────────────────────── */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Lifecycle Stage & Customer Mode
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lifecycle stage */}
            <div className={`border rounded-lg px-4 py-3 ${LIFECYCLE_COLOR[effectiveLifecycle]}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Lifecycle Stage
              </div>
              <div className="text-xl font-bold">{LIFECYCLE_LABELS[effectiveLifecycle]}</div>
              <div className="text-xs mt-1 opacity-70">
                Source: {lifecycleSource === "crm-identity-resolved"
                  ? "CRM identity matched — stage from live enrichment"
                  : "Derived from behavioral funnel signals"}
              </div>
            </div>

            {/* Customer mode */}
            <div className={`border rounded-lg px-4 py-3 ${CUSTOMER_MODE_COLOR[customerMode] ?? "bg-neutral-50 border-neutral-200 text-neutral-600"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Customer Mode
              </div>
              <div className="text-xl font-bold">{CUSTOMER_MODE_LABELS[customerMode] ?? customerMode}</div>
              <div className="text-xs mt-1 opacity-70">
                Behavioral derivation (CRM enrichment at request time)
              </div>
            </div>
          </div>

          {/* Mode explanation */}
          <div className="mt-3 bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 text-sm text-neutral-600">
            {CUSTOMER_MODE_DESC[customerMode] ?? "Mode calculated from CRM and behavioral signals."}
          </div>
        </div>

        {/* ── Decision Attribution ─────────────────────────────────────────── */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Decision Attribution
          </div>
          <div className="border border-neutral-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Decision Signal</th>
                  <th className="px-3 py-2 text-left font-semibold">Source</th>
                  <th className="px-3 py-2 text-left font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {[
                  {
                    signal:  "Funnel Stage",
                    source:  "Behavioral",
                    value:   STAGE_LABELS[journey.funnelStage],
                    crmDriven: false,
                  },
                  {
                    signal:  "Lifecycle Stage",
                    source:  isMatched ? "CRM (via enrichment)" : "Behavioral fallback",
                    value:   LIFECYCLE_LABELS[effectiveLifecycle],
                    crmDriven: isMatched,
                  },
                  {
                    signal:  "Is Customer",
                    source:  isMatched ? "CRM identity" : "Behavioral funnel",
                    value:   journey.funnelStage === "customer" ? "Yes" : "No",
                    crmDriven: isMatched && journey.funnelStage === "customer",
                  },
                  {
                    signal:  "Customer Mode",
                    source:  "CRM + Behavioral",
                    value:   CUSTOMER_MODE_LABELS[customerMode] ?? customerMode,
                    crmDriven: isMatched,
                  },
                  {
                    signal:  "CTA Personalization",
                    source:  "Behavioral confidence",
                    value:   journey.confidence.band !== "low" ? "Active" : "Suppressed",
                    crmDriven: false,
                  },
                  {
                    signal:  "Hero Personalization",
                    source:  "Behavioral confidence",
                    value:   (journey.confidence.band === "high" || journey.confidence.band === "very_high") ? "Active" : "Not unlocked",
                    crmDriven: false,
                  },
                ].map(({ signal, source, value, crmDriven }) => (
                  <tr key={signal}>
                    <td className="px-3 py-2 font-medium text-neutral-700">{signal}</td>
                    <td className="px-3 py-2">
                      <span className={[
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        crmDriven
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-neutral-100 text-neutral-600",
                      ].join(" ")}>
                        {crmDriven ? "⚡" : "📊"} {source}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-neutral-700">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            ⚡ = CRM-influenced decision &nbsp;·&nbsp; 📊 = Behavioral signal
          </div>
        </div>

        {/* ── Live enrichment note ─────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          <span className="font-semibold">Note:</span>{" "}
          Full CRM profile data (lifecycle stage, plan tier, deal stage, account owner) is evaluated
          live at request time via the enrichment pipeline. The lifecycle shown here is derived from
          stored behavioral signals. Enable CRM enrichment in the tenant settings to activate
          real-time CRM overrides.
        </div>

      </div>
    </Card>
  );
}

/** Small helper atom for a labeled CRM field. */
function CrmField({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 border border-neutral-100 rounded-lg px-3 py-2.5 bg-white">
      <span className="text-base shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-neutral-400 font-medium">{label}</div>
        <div className="text-sm font-semibold text-neutral-800 font-mono truncate">{value}</div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-medium text-neutral-700 mb-1">{title}</div>
      <p className="text-sm text-neutral-400 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

// ── No-data state ─────────────────────────────────────────────────────────────

/**
 * NoDataState
 *
 * Shown when a session has no journey data (fromDatabase === false).
 *
 * The most common cause is the consent gate: trackEvent() silently drops all
 * events when mc_consent lacks a:true + p:true.  This component:
 *   1. Reads mc_consent client-side (NOT httpOnly, so document.cookie works)
 *   2. Shows a green / amber consent status indicator
 *   3. Lists actionable diagnostic steps
 *   4. Offers a "Seed test events" button that calls /api/scenario/event (bypasses consent)
 *      so admins can verify the pipeline without accepting the cookie banner
 */
function NoDataState({ sessionId }: { sessionId: string }) {
  // ── Consent diagnosis ───────────────────────────────────────────────────────
  const [consentStatus, setConsentStatus] = useState<"unknown" | "ok" | "missing">("unknown");
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<"idle" | "ok" | "error">("idle");
  const [seedLog, setSeedLog] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("mc_consent="));
      if (!raw) {
        setConsentStatus("missing");
        return;
      }
      const val = decodeURIComponent(raw.split("=").slice(1).join("="));
      const parsed: Record<string, unknown> = JSON.parse(val);
      const ok = parsed["a"] === true && parsed["p"] === true;
      setConsentStatus(ok ? "ok" : "missing");
    } catch {
      setConsentStatus("missing");
    }
  }, []);

  // ── Seed test events ────────────────────────────────────────────────────────
  async function handleSeedEvents() {
    setSeeding(true);
    setSeedResult("idle");
    setSeedLog([]);

    const testPages = [
      { pagePath: "/",           pageCategory: "home",     label: "Home" },
      { pagePath: "/features",   pageCategory: "features", label: "Features" },
      { pagePath: "/pricing",    pageCategory: "pricing",  label: "Pricing" },
      { pagePath: "/cases",      pageCategory: "cases",    label: "Cases" },
      { pagePath: "/contact",    pageCategory: "contact",  label: "Contact" },
    ];

    const log: string[] = [];
    let allOk = true;

    for (const { pagePath, pageCategory, label } of testPages) {
      try {
        const res = await fetch("/api/scenario/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType:    "page_view",
            pagePath,
            pageCategory,
            demoFlow:     "admin-seed",
            occurredAt:   new Date().toISOString(),
          }),
        });
        if (res.ok) {
          log.push(`✓ ${label} (${pagePath})`);
        } else {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          log.push(`✗ ${label}: ${String((err as Record<string,unknown>).error ?? res.status)}`);
          allOk = false;
        }
      } catch (e) {
        log.push(`✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
        allOk = false;
      }
      // Small delay so the DB has time to process each event sequentially.
      await new Promise((r) => setTimeout(r, 120));
    }

    // CTA click on pricing to boost intent score
    try {
      await fetch("/api/scenario/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType:    "cta_click",
          pagePath:     "/pricing",
          pageCategory: "pricing",
          eventValue:   "cta-pricing-primary",
          demoFlow:     "admin-seed",
          occurredAt:   new Date().toISOString(),
        }),
      });
      log.push("✓ CTA click (pricing)");
    } catch {
      // non-fatal
    }

    setSeedLog(log);
    setSeedResult(allOk ? "ok" : "error");
    setSeeding(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const consentOk = consentStatus === "ok";

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="text-2xl mt-0.5">🌱</div>
          <div>
            <div className="font-semibold text-neutral-800 mb-0.5">No journey data for this session</div>
            <p className="text-xs text-neutral-500">
              Session{" "}
              <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-[11px]">
                {sessionId.slice(0, 16)}…
              </code>
            </p>
          </div>
        </div>

        {/* Consent status */}
        <div className={[
          "flex items-start gap-3 rounded-lg border px-4 py-3 mb-4 text-sm",
          consentOk
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-200 text-amber-800",
        ].join(" ")}>
          <span className="text-base mt-0.5">{consentOk ? "✅" : "⚠️"}</span>
          <div>
            <div className="font-medium mb-0.5">
              {consentStatus === "unknown"
                ? "Checking consent cookie…"
                : consentOk
                ? "Consent granted — events should reach the DB"
                : "Consent missing or incomplete (mc_consent)"}
            </div>
            {!consentOk && consentStatus !== "unknown" && (
              <p className="text-xs mt-1 text-amber-700">
                <code className="font-mono bg-amber-100 px-1 rounded">trackEvent()</code> silently
                drops all events when the{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">mc_consent</code> cookie
                does not have{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">{`{"a":true,"p":true}`}</code>.
                Accept the cookie banner on the site to fix this, or use the seed button below.
              </p>
            )}
          </div>
        </div>

        {/* Checklist */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Troubleshooting steps
          </div>
          <ol className="space-y-1.5 text-sm text-neutral-600">
            {[
              "Open the site in a new tab (e.g. localhost:3000)",
              "Accept the cookie / consent banner",
              "Browse a few pages and click a CTA",
              "Come back here — sessions appear within ~5 seconds",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Seed button */}
        <div className="border-t border-neutral-100 pt-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Admin shortcut — bypass consent gate
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Seeds 5 test page views + a pricing CTA click into the pipeline for this browser session.
            Uses <code className="font-mono bg-neutral-100 px-1 rounded">/api/scenario/event</code> which
            skips the consent check.
          </p>
          <button
            type="button"
            onClick={handleSeedEvents}
            disabled={seeding || seedResult === "ok"}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              seeding
                ? "bg-indigo-50 text-indigo-400 border border-indigo-200 cursor-wait"
                : seedResult === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                : "bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent",
            ].join(" ")}
          >
            {seeding ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Seeding events…
              </>
            ) : seedResult === "ok" ? (
              <>✓ Events seeded — refresh the session list</>
            ) : (
              <>🔬 Seed test events for this session</>
            )}
          </button>

          {/* Seed log */}
          {seedLog.length > 0 && (
            <div className={[
              "mt-3 rounded-lg border px-3 py-2.5 text-xs font-mono",
              seedResult === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700",
            ].join(" ")}>
              {seedLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {seedResult === "ok" && (
                <div className="mt-2 font-sans font-medium text-emerald-800">
                  ✓ Done. Click "Refresh" in the session list to see the new journey data.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Live poll interval ────────────────────────────────────────────────────────

const LIVE_POLL_MS = 3000;

// ── Delta tracker ─────────────────────────────────────────────────────────────
// Records which numeric journey fields changed in the last poll so we can
// flash a subtle highlight on the relevant card.

type DeltaKey = "intentScore" | "frictionScore" | "engagementScore" | "funnelStage" | "confidence";

function computeDeltas(
  prev: SessionJourneyPayload | null,
  next: SessionJourneyPayload,
): Set<DeltaKey> {
  const changed = new Set<DeltaKey>();
  if (!prev) return changed;
  const p = prev.journey;
  const n = next.journey;
  if (Math.round(p.intentScore)     !== Math.round(n.intentScore))     changed.add("intentScore");
  if (Math.round(p.frictionScore)   !== Math.round(n.frictionScore))   changed.add("frictionScore");
  if (Math.round(p.engagementScore) !== Math.round(n.engagementScore)) changed.add("engagementScore");
  if (p.funnelStage                 !== n.funnelStage)                  changed.add("funnelStage");
  if (p.confidence.band             !== n.confidence.band)              changed.add("confidence");
  return changed;
}

// ── Live status bar ───────────────────────────────────────────────────────────

function LiveStatusBar({
  sessionId,
  lastUpdated,
  isPolling,
  onStop,
  onManualRefresh,
}: {
  sessionId:       string;
  lastUpdated:     Date | null;
  isPolling:       boolean;
  onStop:          () => void;
  onManualRefresh: () => void;
}) {
  const [ageLabel, setAgeLabel] = useState("—");

  React.useEffect(() => {
    function tick() {
      if (!lastUpdated) { setAgeLabel("—"); return; }
      const s = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
      setAgeLabel(s <= 1 ? "just now" : `${s}s ago`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        {/* Pulsing live dot */}
        <span className={`relative flex h-2.5 w-2.5 shrink-0 ${isPolling ? "" : "opacity-40"}`}>
          {isPolling && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600" />
        </span>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-indigo-800">
            {isPolling ? "Live monitor" : "Paused"}
          </span>
          <span className="ml-2 font-mono text-xs text-indigo-400 truncate">
            {sessionId.slice(0, 8)}…
          </span>
        </div>
        <span className="text-xs text-indigo-400 shrink-0">updated {ageLabel}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onManualRefresh}
          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
        >
          ↻ Refresh
        </button>
        <button
          type="button"
          onClick={onStop}
          className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
        >
          {isPolling ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function JourneyInsightClient({ tenantId, initialSessions }: Props) {
  const [sessions, setSessions]       = useState<JourneySessionSummary[]>(initialSessions);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [payload, setPayload]         = useState<SessionJourneyPayload | null>(null);
  const [notFound, setNotFound]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // Live monitor state
  const [isLive,       setIsLive]       = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [changedKeys,  setChangedKeys]  = useState<Set<DeltaKey>>(new Set());
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const payloadRef    = React.useRef<SessionJourneyPayload | null>(null);

  // Keep refs in sync so the interval closure always has fresh values.
  React.useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  React.useEffect(() => { payloadRef.current    = payload;    }, [payload]);

  // ── Auto-detect own session on mount ─────────────────────────────────────
  // Call /api/journey/state which reads the httpOnly mc_session_id cookie
  // server-side and echoes the sessionId back.  Auto-load it immediately.
  React.useEffect(() => {
    fetch("/api/journey/state", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { sessionId?: string } | null) => {
        if (data?.sessionId) handleSelectSession(data.sessionId, true);
      })
      .catch(() => {/* offline */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Silent refresh (poll tick) ────────────────────────────────────────────
  async function silentRefresh() {
    const sid = selectedIdRef.current;
    if (!sid) return;
    try {
      const result = await fetchSessionJourneyAction(tenantId, sid);
      if (result) {
        const deltas = computeDeltas(payloadRef.current, result);
        setPayload(result);
        setLastUpdated(new Date());
        if (deltas.size > 0) {
          setChangedKeys(deltas);
          setTimeout(() => setChangedKeys(new Set()), 1800);
        }
      }
    } catch { /* ignore */ }
  }

  // ── Start / stop live polling ─────────────────────────────────────────────
  function startLive() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { void silentRefresh(); }, LIVE_POLL_MS);
    setIsLive(true);
  }

  function stopLive() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setIsLive(false);
  }

  function toggleLive() { isLive ? stopLive() : startLive(); }

  // Cleanup on unmount.
  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Select session ────────────────────────────────────────────────────────
  function handleSelectSession(sessionId: string, autoStart = false) {
    setSelectedId(sessionId);
    setPayload(null);
    setNotFound(false);
    setError(null);

    startTransition(async () => {
      try {
        const result = await fetchSessionJourneyAction(tenantId, sessionId);
        if (!result) {
          setNotFound(true);
        } else {
          setPayload(result);
          setLastUpdated(new Date());
          if (autoStart) startLive();
        }
      } catch {
        setError("Failed to load journey data. Please try again.");
      }
    });
  }

  // delta ring helper — adds a ring highlight to a card when any of its keys changed.
  // Accepts 1–N DeltaKeys; returns the ring classes if any key is in changedKeys.
  function deltaRing(...keys: DeltaKey[]) {
    return keys.some((k) => changedKeys.has(k))
      ? "ring-2 ring-indigo-400 ring-offset-2 transition-all duration-300 rounded-xl"
      : "";
  }

  return (
    <div className="space-y-6">
      {/* Session picker — collapsed once a session is loaded */}
      {!selectedId ? (
        <SessionSelector
          tenantId={tenantId}
          sessions={sessions}
          selectedId={selectedId}
          onSelect={(id) => handleSelectSession(id, false)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { stopLive(); setSelectedId(null); setPayload(null); }}
            className="text-xs text-indigo-600 hover:underline"
          >
            ← Change session
          </button>
          <span className="text-neutral-300 text-xs">|</span>
          <SessionSelector
            tenantId={tenantId}
            sessions={sessions}
            selectedId={selectedId}
            onSelect={(id) => handleSelectSession(id, isLive)}
            compact
          />
        </div>
      )}

      {/* Live status bar */}
      {selectedId && (payload || notFound) && !isPending && (
        <LiveStatusBar
          sessionId={selectedId}
          lastUpdated={lastUpdated}
          isPolling={isLive}
          onStop={toggleLive}
          onManualRefresh={() => void silentRefresh()}
        />
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-16 text-neutral-400 text-sm gap-3">
          <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          Loading journey data…
        </div>
      )}

      {/* Error state */}
      {!isPending && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* No data state */}
      {!isPending && notFound && selectedId && (
        <NoDataState sessionId={selectedId} />
      )}

      {/* Full visualization */}
      {!isPending && payload && (
        <div className="space-y-6">
          {/* Row 1: Overview + Timeline */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className={deltaRing("intentScore", "engagementScore", "funnelStage")}>
              <JourneyOverviewPanel journey={payload.journey} />
            </div>
            <div className={deltaRing("funnelStage")}>
              <JourneyTimeline journey={payload.journey} />
            </div>
          </div>

          {/* Row 2: Confidence + Friction */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className={deltaRing("confidence")}>
              <ConfidencePanel journey={payload.journey} />
            </div>
            <div className={deltaRing("frictionScore")}>
              <FrictionPanel journey={payload.journey} />
            </div>
          </div>

          {/* Row 3: Why This Experience */}
          <div className={deltaRing("intentScore", "confidence", "frictionScore")}>
            <WhyThisExperiencePanel journey={payload.journey} />
          </div>

          {/* Row 4: CRM Status */}
          <CrmStatusPanel journey={payload.journey} crmIdentity={payload.crmIdentity} />

          {/* Row 5: Events + Sequences */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <EventTimelinePanel events={payload.events} />
            <SequencesPanel
              journey={payload.journey}
              sequenceDetection={payload.sequenceDetection ?? null}
            />
          </div>
        </div>
      )}

      {/* Initial prompt */}
      {!isPending && !selectedId && (
        <div className="border border-dashed border-neutral-200 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-semibold text-neutral-700 mb-2">
            Select a session to begin
          </div>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            Pick a visitor session from the list above to see a full behavioral breakdown:
            journey stage, confidence, friction, why they're seeing the experience they are,
            and what they'd need to unlock stronger personalization.
          </p>
        </div>
      )}
    </div>
  );
}
