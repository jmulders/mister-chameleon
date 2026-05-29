"use client";

/**
 * components/blocks/InterestDebugPanel.tsx
 *
 * Debug panel for the behavioral interest scoring engine.
 *
 * ─── Rendering ────────────────────────────────────────────────────────────────
 *
 *   Rendered as a collapsible <details> element — open by default in dev,
 *   closed by default in production.
 *
 *   Sections:
 *     1. Active profiles strip   — dominant badge + weak/strong badges
 *     2. All scored profiles     — score bar, activation level, contributions
 *     3. Disabled for tenant     — profiles with scores excluded by enabledKeys filter
 *     4. Context variables       — interestPrimary, interestSecondary, confidence
 *     5. Session info            — visitor ID, URLs visited, decay note, timestamp
 *     6. Manual event tester     — fire test events from the debug panel
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { InterestDebugPanel } from "@/components/blocks/InterestDebugPanel";
 *   import { useInterestScoring } from "@/hooks/useInterestScoring";
 *
 *   function MyPage() {
 *     const scoring = useInterestScoring();
 *     return (
 *       <>
 *         ...page content...
 *         {process.env.NODE_ENV === "development" && (
 *           <InterestDebugPanel scoring={scoring} />
 *         )}
 *       </>
 *     );
 *   }
 *
 * ─── Display-only ────────────────────────────────────────────────────────────
 *
 *   This component is display-only by default — it does NOT call useInterestScoring
 *   internally.  The parent passes the scoring state.  This makes it testable
 *   with arbitrary state and avoids double-loading.
 *
 * ─── Style ───────────────────────────────────────────────────────────────────
 *
 *   Monochrome / admin style — no colour dependencies on the site theme.
 *   Uses Tailwind utility classes only.
 */

import { useState }            from "react";
import type { InterestScoringState } from "@/hooks/useInterestScoring";
import { SCORE_THRESHOLDS, MAX_SCORE_PER_PROFILE } from "@/interest-profiles/behavioral-scoring";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Scoring state from useInterestScoring(). */
  scoring: InterestScoringState;
  /** Whether the panel starts open. Defaults to true in development. */
  defaultOpen?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPoints(pts: number): string {
  return Number.isInteger(pts) ? String(pts) : pts.toFixed(1);
}

function fmtTs(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour12: false });
}

function activationColour(level: string): string {
  switch (level) {
    case "strong":   return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
    case "weak":     return "bg-sky-100 text-sky-800 ring-1 ring-sky-300";
    case "disabled": return "bg-orange-50 text-orange-600 ring-1 ring-orange-200";
    default:         return "bg-neutral-100 text-neutral-500";
  }
}

function scoreBarWidth(pts: number): string {
  const pct = Math.min(100, Math.round((pts / MAX_SCORE_PER_PROFILE) * 100));
  return `${pct}%`;
}

// ── Event tester ──────────────────────────────────────────────────────────────

const TEST_EVENTS = [
  { label: "page_view /pricing",       event: { type: "page_view"   as const, url:   "/pricing"         } },
  { label: "page_view /careers",       event: { type: "page_view"   as const, url:   "/careers"         } },
  { label: "page_view /producten",     event: { type: "page_view"   as const, url:   "/producten"       } },
  { label: "page_view /woningen",      event: { type: "page_view"   as const, url:   "/woningen"        } },
  { label: "cta_click: pricing",       event: { type: "cta_click"   as const, label: "pricing"          } },
  { label: "cta_click: apply",         event: { type: "cta_click"   as const, label: "apply"            } },
  { label: "cta_click: add_to_cart",   event: { type: "cta_click"   as const, label: "add_to_cart"      } },
  { label: "cta_click: book_viewing",  event: { type: "cta_click"   as const, label: "book_viewing"     } },
  { label: "form_start /contact",      event: { type: "form_start"  as const, url:   "/contact"         } },
  { label: "form_submit /demo",        event: { type: "form_submit" as const, url:   "/demo"             } },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function InterestDebugPanel({ scoring, defaultOpen }: Props) {
  const isDev     = process.env.NODE_ENV === "development";
  const isOpen    = defaultOpen ?? isDev;
  const { snapshot, contextVars, activeProfiles, dominant, track } = scoring;

  const [lastFired, setLastFired] = useState<string | null>(null);

  const fireTest = (label: string, event: Parameters<typeof track>[0]) => {
    track(event);
    setLastFired(label);
  };

  return (
    <details
      open={isOpen}
      className="mt-6 rounded-lg border border-neutral-200 bg-white text-xs font-mono shadow-sm"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 select-none">
        <span className="text-neutral-400">▶</span>
        Interest Scoring Debug
        {dominant && (
          <span className="ml-auto inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300">
            dominant: {dominant}
          </span>
        )}
        {!dominant && (
          <span className="ml-auto text-xs text-neutral-400 font-normal">no active profile</span>
        )}
      </summary>

      <div className="divide-y divide-neutral-100 px-4 pb-4">

        {/* ── 1. Active profiles ─────────────────────────────────────────────── */}
        <section className="py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Active Profiles
          </p>
          {activeProfiles.length === 0 ? (
            <p className="text-neutral-400">None — score below WEAK threshold ({SCORE_THRESHOLDS.WEAK} pts)</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeProfiles.map((p) => (
                <span
                  key={p.key}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${activationColour(p.activation)}`}
                >
                  {p.isDominant && <span title="dominant">★</span>}
                  {p.key}
                  <span className="opacity-60">{fmtPoints(p.points)} pts</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── 2. All scored profiles ─────────────────────────────────────────── */}
        {snapshot && snapshot.allScores.length > 0 && (
          <section className="py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              All Scores (WEAK ≥ {SCORE_THRESHOLDS.WEAK} · STRONG ≥ {SCORE_THRESHOLDS.STRONG} · max {MAX_SCORE_PER_PROFILE})
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-neutral-400">
                  <th className="pr-3 pb-1 font-normal">profile</th>
                  <th className="pr-3 pb-1 font-normal">pts</th>
                  <th className="pb-1 font-normal">bar</th>
                  <th className="pl-3 pb-1 font-normal">level</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.allScores.map((e) => (
                  <tr key={e.key} className="align-middle">
                    <td className="pr-3 py-0.5 text-neutral-700">{e.key}</td>
                    <td className="pr-3 py-0.5 text-neutral-500 tabular-nums">{fmtPoints(e.points)}</td>
                    <td className="py-0.5 w-28">
                      <div className="relative h-1.5 w-full rounded-full bg-neutral-100">
                        <div
                          className="absolute left-0 top-0 h-1.5 rounded-full bg-neutral-400"
                          style={{ width: scoreBarWidth(e.points) }}
                        />
                        {/* WEAK threshold line */}
                        <div
                          className="absolute top-0 h-1.5 w-px bg-sky-400"
                          style={{ left: scoreBarWidth(SCORE_THRESHOLDS.WEAK) }}
                          title={`WEAK threshold: ${SCORE_THRESHOLDS.WEAK} pts`}
                        />
                        {/* STRONG threshold line */}
                        <div
                          className="absolute top-0 h-1.5 w-px bg-emerald-500"
                          style={{ left: scoreBarWidth(SCORE_THRESHOLDS.STRONG) }}
                          title={`STRONG threshold: ${SCORE_THRESHOLDS.STRONG} pts`}
                        />
                      </div>
                    </td>
                    <td className="pl-3 py-0.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${activationColour(e.activation)}`}>
                        {e.activation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Contributions accordion */}
            {snapshot.allScores.some((e) => e.contributions.length > 0) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-600 select-none">
                  ▶ Contributions
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {snapshot.allScores
                    .filter((e) => e.contributions.length > 0)
                    .map((e) => (
                      <div key={e.key}>
                        <p className="text-[10px] font-semibold text-neutral-500 mb-0.5">{e.key}</p>
                        {e.contributions.map((c, i) => (
                          <div key={i} className="flex gap-2 text-[10px] text-neutral-500">
                            <span className="w-14 text-right tabular-nums text-neutral-400">{fmtTs(c.at)}</span>
                            <span className="text-emerald-700 tabular-nums">+{fmtPoints(c.points)}</span>
                            <span className="truncate">{c.reason}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </details>
            )}
          </section>
        )}

        {/* ── 3. Disabled for tenant ────────────────────────────────────────────── */}
        {snapshot && snapshot.disabledProfiles.length > 0 && (
          <section className="py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
              Disabled for tenant
            </p>
            <p className="mb-2 text-[10px] text-neutral-400">
              These profiles accumulated scores but are <span className="font-semibold text-orange-500">disabled for this tenant</span>.
              They are excluded from interestPrimary / interestSecondary and all decision context.
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-neutral-400">
                  <th className="pr-3 pb-1 font-normal">profile</th>
                  <th className="pr-3 pb-1 font-normal">pts</th>
                  <th className="pb-1 font-normal">bar</th>
                  <th className="pl-3 pb-1 font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.disabledProfiles.map((e) => (
                  <tr key={e.key} className="align-middle opacity-60">
                    <td className="pr-3 py-0.5 text-neutral-500 line-through">{e.key}</td>
                    <td className="pr-3 py-0.5 text-neutral-400 tabular-nums">{fmtPoints(e.points)}</td>
                    <td className="py-0.5 w-28">
                      <div className="relative h-1.5 w-full rounded-full bg-neutral-100">
                        <div
                          className="absolute left-0 top-0 h-1.5 rounded-full bg-orange-200"
                          style={{ width: scoreBarWidth(e.points) }}
                        />
                      </div>
                    </td>
                    <td className="pl-3 py-0.5">
                      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-orange-50 text-orange-600 ring-1 ring-orange-200">
                        disabled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── 4. Context variables ───────────────────────────────────────────── */}
        <section className="py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Context Variables
          </p>
          <table className="text-left">
            <tbody>
              <CtxRow label="interestPrimary"    value={contextVars.interestPrimary    || "(none)"} />
              <CtxRow label="interestSecondary"  value={contextVars.interestSecondary  || "(none)"} />
              <CtxRow label="interestConfidence" value={contextVars.interestConfidence.toFixed(2)}  />
            </tbody>
          </table>
          {Object.keys(contextVars.perProfile).length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-neutral-400 mb-0.5">perProfile</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(contextVars.perProfile).map(([k, v]) => (
                  <span key={k} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
                    {k}: {v.toFixed(3)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── 5. Session info ────────────────────────────────────────────────── */}
        {snapshot && (
          <section className="py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Session
            </p>
            <table className="text-left">
              <tbody>
                <CtxRow label="visitorId"    value={snapshot.visitorId} />
                <CtxRow label="urlsVisited"  value={String(snapshot.urlsVisited)} />
                <CtxRow label="dominant"     value={snapshot.dominant ?? "(none)"} />
                <CtxRow label="decay"        value={snapshot.decayNote} />
                <CtxRow label="snapshot at"  value={fmtTs(snapshot.timestamp)} />
              </tbody>
            </table>
          </section>
        )}

        {/* ── 6. Event tester ───────────────────────────────────────────────── */}
        <section className="py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Fire Test Event
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEST_EVENTS.map(({ label, event }) => (
              <button
                key={label}
                onClick={() => fireTest(label, event)}
                className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          {lastFired && (
            <p className="mt-1.5 text-[10px] text-neutral-400">
              Last fired: <span className="text-neutral-700">{lastFired}</span>
            </p>
          )}
        </section>

      </div>
    </details>
  );
}

// ── Internal: context variable row ────────────────────────────────────────────

function CtxRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4 py-0.5 text-neutral-400">{label}</td>
      <td className="py-0.5 text-neutral-700 truncate max-w-xs">{value}</td>
    </tr>
  );
}
