/**
 * Admin — Intent Context Inspector
 *
 * Accessible at /admin/context/intent.
 *
 * Displays the full intent layer signal model — available intent types,
 * their contributing signals, point weights, and thresholds.
 *
 * This is a read-only inspection page.  The scoring heuristics are defined
 * in `context/intent-context.ts` and are intentionally deterministic so
 * operators can reason about them without black-box AI.
 *
 * ─── What operators can learn here ───────────────────────────────────────────
 *
 *   • Which intent types the platform recognises
 *   • Which context signals contribute to each intent score
 *   • How many points each signal is worth (max)
 *   • The thresholds used to select primary vs secondary intent
 *   • Which context variables are available in debug and AI
 */

import Link from "next/link";
import {
  INTENT_DEFINITIONS,
  type SignalContribution,
} from "@/context/intent-context";
import { CONTEXT_VARS_BY_SOURCE } from "@/context/registry";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function IntentContextInspectorPage() {
  const intentVars = CONTEXT_VARS_BY_SOURCE["intent"] ?? [];

  return (
    <div className="p-8 max-w-4xl space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
          <Link href="/admin/context" className="hover:text-brand-700 transition-colors">
            Context variables
          </Link>
          <span>/</span>
          <span className="text-neutral-600">Intent</span>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Intent Layer</h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          The intent layer predicts visitor goals from observed context signals using deterministic,
          inspectable heuristics — no black-box AI required. Each intent type receives an independent
          score (0–100), and the highest scorer becomes the primary intent.
        </p>
      </div>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 space-y-2">
        <p className="font-semibold">How intent is derived</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>All context layers (request, history, derived, enrichment, page) are assembled.</li>
          <li>Each intent type is scored independently using the signal rules below (0–100).</li>
          <li><strong>intentPrimary</strong> = the intent type with the highest score.</li>
          <li><strong>intentSecondary</strong> = the runner-up, only when its score ≥ 20.</li>
          <li><strong>intentConfidence</strong> = primaryScore ÷ 100 (normalised 0–1).</li>
          <li>The <strong>intentReason</strong> field explains the top contributing signals for debug.</li>
        </ol>
      </section>

      {/* ── Intent type cards ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-base font-semibold text-neutral-800">Intent types and scoring signals</h2>

        {INTENT_DEFINITIONS.map((def) => (
          <IntentTypeCard key={def.type} definition={def} />
        ))}
      </section>

      {/* ── Context variables ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-800">Context variables (source: intent)</h2>
        <p className="text-sm text-neutral-500">
          These variables are populated by the intent engine and are available to AI providers
          and the debug overlay. They can be added to rules in a future update.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-neutral-200 rounded-lg overflow-hidden">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200">Key</th>
                <th className="px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200">Label</th>
                <th className="px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200">Type</th>
                <th className="px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200">AI</th>
                <th className="px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200">Description</th>
              </tr>
            </thead>
            <tbody>
              {intentVars.map((v) => (
                <tr key={v.key} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 font-mono text-neutral-700">{v.key}</td>
                  <td className="px-3 py-2 text-neutral-700 font-medium">{v.label}</td>
                  <td className="px-3 py-2">
                    <TypeBadge type={v.type} />
                  </td>
                  <td className="px-3 py-2">
                    {v.availableToAI
                      ? <span className="text-green-700 font-medium">Yes</span>
                      : <span className="text-neutral-400">No</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-neutral-500 max-w-xs truncate" title={v.description}>
                    {v.description.split(".")[0]}.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function IntentTypeCard({ definition }: { definition: typeof INTENT_DEFINITIONS[number] }) {
  const sourceColors: Record<SignalContribution["source"], string> = {
    pathname:   "bg-indigo-100 text-indigo-700",
    derived:    "bg-violet-100 text-violet-700",
    history:    "bg-amber-100  text-amber-700",
    enrichment: "bg-blue-100   text-blue-700",
    utm:        "bg-green-100  text-green-700",
    template:   "bg-pink-100   text-pink-700",
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-neutral-100 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{definition.label}</span>
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-mono text-neutral-500">
              {definition.type}
            </code>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">{definition.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Strong at score</p>
          <p className="text-lg font-bold text-brand-700">≥ {definition.strongThreshold}</p>
        </div>
      </div>

      {/* Signal table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 font-medium text-neutral-500 text-left">Signal</th>
              <th className="px-4 py-2 font-medium text-neutral-500 text-left">Source</th>
              <th className="px-4 py-2 font-medium text-neutral-500 text-left">Description</th>
              <th className="px-4 py-2 font-medium text-neutral-500 text-right">Max pts</th>
            </tr>
          </thead>
          <tbody>
            {definition.signals.map((sig, i) => (
              <tr key={i} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-neutral-700">{sig.signal}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceColors[sig.source] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {sig.source}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-500">{sig.description}</td>
                <td className="px-4 py-2 text-right font-semibold text-neutral-700">+{sig.maxPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    enum:    "bg-purple-100 text-purple-700",
    number:  "bg-blue-100   text-blue-700",
    string:  "bg-green-100  text-green-700",
    boolean: "bg-amber-100  text-amber-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[type] ?? "bg-neutral-100 text-neutral-600"}`}>
      {type}
    </span>
  );
}
