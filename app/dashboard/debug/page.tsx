/**
 * Decision Trace Debug Page  —  /dashboard/debug
 *
 * Operator reference for the runtime experience-selection explainability system.
 *
 * ─── What this page covers ───────────────────────────────────────────────────
 *
 *   1. Decision paths — what "rules", "experiment", "ai", and "fallback" mean.
 *   2. How to inspect a live trace — the homepage dev diagnostics panel.
 *   3. Provider chain — how the three layers nest and where to look for state.
 *   4. Links to other dashboard pages for per-request AI decision details.
 *   5. IP override — how to test enrichment with a synthetic visitor IP.
 *
 * ─── Why there's no live trace here ─────────────────────────────────────────
 *
 *   DecisionTrace is computed per request in composeHomepageExperience() and
 *   is attached to the ComposedHomepageExperience returned to the page server
 *   component.  It is not stored separately (the AI layer has its own
 *   ai_decision_logs table for persistence — see /dashboard/ai).
 *
 *   To inspect a live trace:
 *     1. Visit the homepage (/) in your browser.
 *     2. Scroll to the dev diagnostics section.
 *     3. Look at "Decision path", "Matched rule", "Applied experiments",
 *        and "AI trace" rows.
 *
 * ─── IP override ─────────────────────────────────────────────────────────────
 *
 *   Pass ?_ip=<addr>&_ip_override=1 to the homepage URL to test enrichment
 *   with a synthetic visitor IP address without changing your real IP.
 *
 *   Safety gate: only works in development (NODE_ENV=development) or when
 *   ENABLE_DEBUG_IP_OVERRIDE=true is set in the environment.  The params are
 *   silently ignored in production unless the env var is explicitly set.
 *
 *   Results are visible in the EnrichmentDebugPanel rendered at the bottom
 *   of the homepage (dev diagnostics section).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { IpOverrideTester } from "./_components/IpOverrideTester";

export const metadata: Metadata = { title: "Debug · Dashboard" };

// ── Path descriptions ─────────────────────────────────────────────────────────

const DECISION_PATHS = [
  {
    path:    "rules",
    colour:  "#2563eb",
    bg:      "#eff6ff",
    border:  "#bfdbfe",
    title:   "Rules",
    when:    "A stored or hardcoded rule matched the visitor's context.",
    detail:
      "The rules engine evaluates all active rules in priority order and " +
      "returns the plan of the first match. The matched rule's ID, label, " +
      "and priority are recorded in DecisionTrace.matchedRule.",
    inspect: "Look at \"Matched rule\" in the homepage diagnostics panel.",
    link:    { href: "/dashboard/rules", label: "Rules Editor →" },
  },
  {
    path:    "experiment",
    colour:  "#7c3aed",
    bg:      "#f5f3ff",
    border:  "#ddd6fe",
    title:   "Experiment",
    when:    "An A/B experiment overrode one or more variant slots.",
    detail:
      "The experiment layer runs after rules and may override hero, proof, " +
      "or CTA slots based on the visitor's session bucket. All applied " +
      "assignments are recorded in DecisionTrace.appliedExperiments.",
    inspect: "Look at \"Applied experiments\" in the homepage diagnostics panel.",
    link:    { href: "/dashboard/experiments", label: "Experiments →" },
  },
  {
    path:    "ai",
    colour:  "#059669",
    bg:      "#ecfdf5",
    border:  "#a7f3d0",
    title:   "AI",
    when:
      "The AI provider's plan passed the confidence policy (live mode only).",
    detail:
      "The AI layer calls the configured model with the visitor's context. " +
      "If the returned confidence score meets the tenant's threshold, the AI " +
      "plan is served. The provider name, mode (shadow/live), confidence, and " +
      "any fallback reason are in DecisionTrace.ai.",
    inspect: "Look at \"AI trace\" in the homepage diagnostics panel.",
    link:    { href: "/dashboard/ai", label: "AI Decision Logs →" },
  },
  {
    path:    "fallback",
    colour:  "#d97706",
    bg:      "#fffbeb",
    border:  "#fde68a",
    title:   "Fallback",
    when:
      "No rule matched, no experiment was active, and AI was disabled or " +
      "context was too sparse.",
    detail:
      "The default plan from runtime-rules.json (or SEED_RULES_CONFIG) is " +
      "served. DecisionTrace.matchedRule and appliedExperiments will be null " +
      "or empty; DecisionTrace.ai will be null.",
    inspect:
      "Check that at least one rule covers the visitor's traffic source and " +
      "device type, or that the AI mode is not \"disabled\".",
    link:    { href: "/dashboard/rules", label: "Rules Editor →" },
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function DebugPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">Debug</h1>
        <p className="text-sm text-neutral-500">
          Explainability reference for the runtime experience-selection engine
          and debug tooling for enrichment testing.
        </p>
      </div>

      {/* Live inspection callout */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm font-medium text-neutral-800">
            Inspecting a live trace
          </p>
          <p className="text-sm text-neutral-600">
            A <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">DecisionTrace</code>{" "}
            is produced on every homepage render and attached to the{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">ComposedHomepageExperience</code>.
            It is not stored separately — inspect it via the dev diagnostics
            section at the bottom of the homepage.
          </p>
          <ol className="flex flex-col gap-1 text-sm text-neutral-600 list-decimal list-inside">
            <li>
              Visit{" "}
              <Link href="/" className="font-medium text-brand-700 underline underline-offset-2">
                the homepage (/)
              </Link>{" "}
              in your browser.
            </li>
            <li>Scroll to the dev diagnostics section at the bottom of the page.</li>
            <li>
              Look for the{" "}
              <strong>Decision path</strong>,{" "}
              <strong>Matched rule</strong>,{" "}
              <strong>Applied experiments</strong>, and{" "}
              <strong>AI trace</strong> rows.
            </li>
          </ol>
          <p className="text-xs text-neutral-400">
            For per-request AI decision persistence, see{" "}
            <Link href="/dashboard/ai" className="text-brand-600 underline underline-offset-2">
              AI Decision Logs
            </Link>{" "}
            which stores every AI inference result in{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono">ai_decision_logs</code>.
          </p>
        </CardContent>
      </Card>

      {/* Decision paths */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
          Decision paths
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {DECISION_PATHS.map((p) => (
            <div
              key={p.path}
              className="rounded-lg border p-4 flex flex-col gap-2"
              style={{ background: p.bg, borderColor: p.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded px-2 py-0.5 text-xs font-mono font-semibold"
                  style={{ color: p.colour, background: "white", border: `1px solid ${p.border}` }}
                >
                  {p.path}
                </span>
                <span className="text-sm font-medium text-neutral-800">{p.title}</span>
              </div>
              <p className="text-xs text-neutral-600">
                <span className="font-medium text-neutral-700">When: </span>
                {p.when}
              </p>
              <p className="text-xs text-neutral-500">{p.detail}</p>
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-600">To inspect: </span>
                {p.inspect}
              </p>
              <Link
                href={p.link.href}
                className="mt-1 text-xs font-medium underline underline-offset-2"
                style={{ color: p.colour }}
              >
                {p.link.label}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Provider chain diagram */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
          Provider chain
        </h2>
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-sm text-neutral-600">
              The decision engine is a decorator stack. Each layer wraps the one below,
              potentially overriding the plan. The trace walks the chain after{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">getHomepagePlan()</code>{" "}
              returns to read last-call state from each layer.
            </p>
            <pre className="rounded-md bg-neutral-900 text-neutral-100 text-xs p-4 overflow-x-auto leading-relaxed">
{`AI layer           AiDecisionProvider (shadow or live)
  └─ experiments   ExperimentDecisionProvider
       └─ rules    RulesDecisionProvider          ← always the leaf

Trace state properties (read after getHomepagePlan() returns):

  AiDecisionProvider         .lastDecisionMeta
                             .fallbackProvider   → ExperimentDecisionProvider
  ExperimentDecisionProvider .lastAppliedExperiments
                             .innerProvider      → RulesDecisionProvider
  RulesDecisionProvider      .lastMatchedRuleInfo`}
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              When AI mode is <code className="font-mono">"disabled"</code>, the{" "}
              <code className="font-mono">AiDecisionProvider</code> layer is absent and{" "}
              <code className="font-mono">ExperimentDecisionProvider</code> is the top of the chain.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trace model */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
          DecisionTrace model
        </h2>
        <Card>
          <CardContent className="py-4">
            <pre className="rounded-md bg-neutral-900 text-neutral-100 text-xs p-4 overflow-x-auto leading-relaxed">
{`interface DecisionTrace {
  path:               "rules" | "experiment" | "ai" | "fallback";
  reason:             string;          // ExperiencePlan.reason
  heroKey:            string;
  proofKey:           string;
  ctaKey:             string;
  usedCmsFallback:    boolean;

  matchedRule:        RuleMatchInfo | null;
  // { ruleId, ruleLabel, priority }

  appliedExperiments: ExperimentAppliedInfo[] | null;
  // null = layer absent   [] = no experiments   [...] = applied
  // { experimentId, experimentName, slot, bucket, variantKey }

  ai:                 AiTraceInfo | null;
  // { providerName, aiMode, confidence, fallbackReason }

  context:            TraceContextSnapshot;
  // Safe redacted snapshot — no raw IPs, no auth tokens
  // { source, device, visitType, utmSource, utmCampaign,
  //   referrerDomain, pageViewCount, hasClickedCta,
  //   countryCode, companyName, companyIndustry,
  //   crmMatched, crmLifecycleStage, tenantId, pathname }

  resolvedAt:         number;          // Unix ms
  durationMs:         number;          // wall-clock composition time
}`}
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              Source:{" "}
              <code className="font-mono">decision/trace.ts</code> · Attached to{" "}
              <code className="font-mono">ComposedHomepageExperience.trace</code> by{" "}
              <code className="font-mono">experience/compose-experience.ts</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── IP override ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
          Enrichment: IP override
        </h2>

        {/* Interactive IP tester */}
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-neutral-800">
                Test enrichment with a synthetic visitor IP
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Enter any IP address below. The homepage will open in a new tab
                with the enrichment pipeline using that IP instead of your real
                one. Scroll to the <strong>Enrichment debug panel</strong> at the
                bottom of that page to see the resolved company, country, and ISP.
              </p>
            </div>

            <IpOverrideTester />

            <p className="text-xs text-neutral-400">
              The override is silently ignored unless the app is running in
              development mode or{" "}
              <code className="font-mono">ENABLE_DEBUG_IP_OVERRIDE=true</code> is
              set in the environment.
            </p>
          </CardContent>
        </Card>

        {/* Safety gate */}
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-neutral-800">Safety gate</p>
            <p className="mb-3 text-sm text-neutral-600">
              The IP override is silently ignored unless one of the following
              conditions is true:
            </p>
            <pre className="rounded-md bg-neutral-900 text-neutral-100 text-xs p-4 overflow-x-auto leading-relaxed">
{`NODE_ENV === "development"           // local dev server — always enabled
ENABLE_DEBUG_IP_OVERRIDE === "true"  // explicit production opt-in via env var`}
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              Set{" "}
              <code className="font-mono">ENABLE_DEBUG_IP_OVERRIDE=true</code> in your
              deployment environment variables to enable this on staging. Never set it
              on a public production environment.
            </p>
          </CardContent>
        </Card>

        {/* Where to see results */}
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-neutral-800">
              Where to see the results
            </p>
            <p className="mb-3 text-sm text-neutral-600">
              When an IP override is active,{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">
                capturedDebugInfo
              </code>{" "}
              is populated in the homepage server component and passed to{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">
                EnrichmentDebugPanel
              </code>.
              The panel is rendered at the bottom of the homepage and shows:
            </p>
            <pre className="rounded-md bg-neutral-900 text-neutral-100 text-xs p-4 overflow-x-auto leading-relaxed">
{`EnrichmentDebugPanel fields (from VisitorEnrichmentResult)
──────────────────────────────────────────────────────────
  overrideIp       the IP address supplied via ?_ip=
  resolvedIp       the IP actually used for lookup (same as overrideIp)
  companyName      resolved organisation name
  companyIndustry  resolved industry category
  countryCode      ISO-3166-1 alpha-2 country code
  isp              Internet Service Provider name
  source           enrichment provider that returned the result
  error            present only when enrichment failed`}
            </pre>
            <p className="mt-3 text-xs text-neutral-400">
              Source:{" "}
              <code className="font-mono">app/page.tsx</code> —{" "}
              <code className="font-mono">EnrichmentDebugPanel</code> is imported from{" "}
              <code className="font-mono">components/debug/EnrichmentDebugPanel</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
