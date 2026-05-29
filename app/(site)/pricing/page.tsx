/**
 * app/(site)/pricing/page.tsx
 *
 * Public-facing Mister Chameleon pricing page.
 *
 * ─── Structure ────────────────────────────────────────────────────────────────
 *
 *   1. Hero — "Simple credits. Powerful personalisation."
 *   2. Subscription plan cards — Starter / Growth / Pro
 *   3. Credit packages — Hatchling / Climber / Dragon
 *   4. Category explanation — Recognition / Adaptation / Brainpower
 *   5. Budget trust section — cap, auto-reload, fallback, controls
 *   6. Example scenarios — small tester / growing B2B / enterprise
 *   7. FAQ — billing predictability questions
 *   8. CTA footer
 *
 * ─── Philosophy ───────────────────────────────────────────────────────────────
 *
 *   Customers should feel:
 *   - They start small and grow safely.
 *   - Credits are simple, not scary.
 *   - Expensive features are easy to cap or disable.
 *   - No surprise invoices.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 *
 *   Server component — no DB calls needed.
 *   All data from static billing/plans.ts, billing/credits.ts, billing/copy.ts.
 */

import { BILLING_PLANS } from "@/billing/plans";
import { CATEGORY_COPY, PRICING_COPY, USAGE_SCENARIOS } from "@/billing/copy";
import type { Metadata } from "next";
import { PlanCartButton, CreditCartButton } from "./_components/CartButtons";

export const metadata: Metadata = {
  title:       "Pricing — Mister Chameleon",
  description: "Simple credits. Powerful personalisation. Start small, stay in control, grow safely.",
};

// ── Credit packages (customer-facing top-up bundles) ──────────────────────────

const CREDIT_PACKAGES = [
  {
    id:          "hatchling",
    name:        "The Hatchling",
    emoji:       "🥚",
    credits:     5_000,
    priceCents:  5_000,   // €50
    highlight:   false,
    forWho:      "For small sites and first tests.",
    perCredit:   "€0.01 / credit",
    tag:         null,
  },
  {
    id:          "climber",
    name:        "The Climber",
    emoji:       "🦎",
    credits:     25_000,
    priceCents:  20_000,  // €200 (€0.008/credit — 20% saving)
    highlight:   true,
    forWho:      "For growing B2B sites with steady enrichment volume.",
    perCredit:   "€0.008 / credit",
    tag:         "Most popular",
  },
  {
    id:          "dragon",
    name:        "The Dragon",
    emoji:       "🐉",
    credits:     100_000,
    priceCents:  75_000,  // €750 (€0.0075/credit — 25% saving)
    highlight:   false,
    forWho:      "For high-traffic platforms and enterprise use.",
    perCredit:   "€0.0075 / credit",
    tag:         "Best value",
  },
] as const;

// ── Trust features ─────────────────────────────────────────────────────────────

const TRUST_FEATURES = [
  {
    icon:  "🎯",
    title: "Monthly budget cap",
    body:  "Set a credit limit per calendar month. When reached, the platform automatically switches to your chosen fallback mode — no overage invoice, no surprise charge.",
  },
  {
    icon:  "🔄",
    title: "Auto-reload (optional)",
    body:  "Top up automatically when your balance drops below a threshold. Set a monthly reload cap too, so auto-reload never exceeds your expected budget.",
  },
  {
    icon:  "🧩",
    title: "Smart Lite fallback",
    body:  "When credits run low or a cap is hit, switch to Smart Lite mode: Recognition keeps running at low cost, Adaptation and Brainpower pause. Personalisation continues.",
  },
  {
    icon:  "🔒",
    title: "Per-feature cost controls",
    body:  "Toggle expensive features on or off at any time — CRM matching, AI generation, blueprint creation. Each toggle updates instantly with no downtime.",
  },
] as const;

// ── Helper ─────────────────────────────────────────────────────────────────────

function fmtEuro(cents: number): string {
  if (cents % 100 === 0) return `€${cents / 100}`;
  return `€${(cents / 100).toFixed(2)}`;
}

// ── Components ─────────────────────────────────────────────────────────────────

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{children}</h2>
      {sub && <p className="mt-3 max-w-2xl mx-auto text-base text-neutral-500">{sub}</p>}
    </div>
  );
}

function PlanCard({ plan, cycle = "monthly" }: { plan: typeof BILLING_PLANS[keyof typeof BILLING_PLANS]; cycle?: "monthly" | "annual" }) {
  const price      = cycle === "annual" ? plan.annualMonthlyCents : plan.monthlyPriceCents;
  const isPopular  = plan.id === "growth";
  const featureList: string[] = [];

  featureList.push("Unlimited rules, segments & experiments");
  if (plan.features.analyticsDashboard)  featureList.push("Analytics dashboard");
  if (plan.features.aiPersonalization)   featureList.push("AI personalisation engine");
  if (plan.features.crmAbmEnrichment)    featureList.push("CRM & ABM enrichment");
  if (plan.features.customDecayProfiles) featureList.push("Custom decay profiles");
  if (plan.features.multiTenant)         featureList.push("Multi-tenant agency management");
  if (plan.features.prioritySupport)     featureList.push("Priority support");

  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 ${
      isPopular ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"
    }`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-neutral-900">
            Most popular
          </span>
        </div>
      )}

      <div>
        <h3 className={`text-lg font-semibold ${isPopular ? "text-white" : "text-neutral-900"}`}>{plan.name}</h3>
        <p className={`mt-1 text-sm ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>{plan.description}</p>
      </div>

      <div className="mt-5 flex items-end gap-1">
        <span className={`text-3xl font-bold ${isPopular ? "text-white" : "text-neutral-900"}`}>
          {fmtEuro(price)}
        </span>
        <span className={`mb-1 text-sm ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>/mo</span>
      </div>

      {cycle === "annual" && (
        <p className={`text-xs ${isPopular ? "text-emerald-400" : "text-emerald-600"}`}>
          Billed annually — save ~17–20%
        </p>
      )}

      <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${isPopular ? "bg-white/10" : "bg-neutral-50"}`}>
        <span className={`font-medium ${isPopular ? "text-white" : "text-neutral-800"}`}>
          Pay-as-you-go credits
        </span>
        <span className={`text-xs ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}> — top up any time</span>
      </div>

      <ul className="mt-5 space-y-2 flex-1">
        {featureList.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 ${isPopular ? "text-emerald-400" : "text-emerald-500"}`}>✓</span>
            <span className={isPopular ? "text-neutral-300" : "text-neutral-700"}>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <PlanCartButton planId={plan.id as "starter" | "growth" | "pro"} isPopular={isPopular} label="Start free trial" />
      </div>

      <p className={`mt-3 text-center text-xs ${isPopular ? "text-neutral-500" : "text-neutral-400"}`}>
        Credits never expire — buy as you go
      </p>
    </div>
  );
}

function CreditPackageCard({ pkg }: { pkg: typeof CREDIT_PACKAGES[number] }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 ${
      pkg.highlight ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200"
    }`}>
      {pkg.tag && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-neutral-900">
            {pkg.tag}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-3xl">{pkg.emoji}</span>
        <div>
          <h3 className="font-semibold text-neutral-900">{pkg.name}</h3>
          <p className="text-xs text-neutral-500">{pkg.forWho}</p>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-3xl font-bold text-neutral-900">{fmtEuro(pkg.priceCents)}</span>
        <span className="mb-1 text-sm text-neutral-400">one-time</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-lg font-semibold text-neutral-800">
          {pkg.credits.toLocaleString("nl-NL")} credits
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{pkg.perCredit}</span>
      </div>

      <div className="mt-6">
        <CreditCartButton
          bundleId={pkg.id}
          label={pkg.name}
          priceCentsEach={pkg.priceCents}
          creditsEach={pkg.credits}
          buttonLabel="Add to cart"
        />
      </div>
    </div>
  );
}

function CategoryCard({ cat }: { cat: keyof typeof CATEGORY_COPY }) {
  const copy = CATEGORY_COPY[cat];
  const colours = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-500",   badge: "bg-blue-100 text-blue-700"   },
    purple: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-500", badge: "bg-purple-100 text-purple-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-500", badge: "bg-orange-100 text-orange-700" },
  }[copy.color];

  return (
    <div className={`rounded-2xl border ${colours.border} ${colours.bg} p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-3xl ${colours.icon}`}>{copy.icon}</span>
          <div>
            <h3 className="font-semibold text-neutral-900">{copy.label}</h3>
            <p className="text-sm text-neutral-500">{copy.tagline}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colours.badge}`}>
          {copy.costLabel}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-neutral-600">{copy.explanation}</p>
      <div className="mt-4 rounded-lg bg-white/60 px-3 py-2">
        <p className="text-xs text-neutral-500">{copy.examplesLong}</p>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: typeof USAGE_SCENARIOS[number] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 className="font-semibold text-neutral-900">{scenario.label}</h3>
      <p className="mt-1 text-sm text-neutral-500">{scenario.description}</p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <span className="text-xs text-neutral-500">Est. credits / month</span>
          <span className="font-semibold text-neutral-800">{scenario.creditsPerMonth.toLocaleString("nl-NL")} cr</span>
        </div>
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-400">Usage drivers</p>
          <p className="mt-0.5 text-xs text-neutral-600">{scenario.driverSummary}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-600">🛡 Protected by: {scenario.protectedBy}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const plans = Object.values(BILLING_PLANS);

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-500 mb-6">
          <span>🦎</span> Chameleon Credits
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          {PRICING_COPY.PAGE_HEADLINE}
        </h1>
        <p className="mt-5 text-lg text-neutral-500 max-w-2xl mx-auto">
          {PRICING_COPY.PAGE_SUBHEADLINE}
        </p>

        {/* Credit explainer pill */}
        <div className="mt-8 inline-block rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-700 max-w-xl text-left">
          <span className="font-semibold">1 credit = €0.01</span> — Credits are consumed when your site enriches a visitor.
          Cache hits are completely free. You only pay for fresh, live data.
        </div>
      </section>

      {/* ── SUBSCRIPTION PLANS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeading
          sub="Monthly access to the Mister Chameleon platform. Each plan includes a monthly credit allowance."
        >
          {PRICING_COPY.PLAN_HEADLINE}
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
        <p className="mt-6 text-center text-sm text-neutral-400">
          All plans include a 14-day trial. No credit card required to start.
        </p>
      </section>

      {/* ── CREDIT PACKAGES ─────────────────────────────────────────────── */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading
            sub="Top up your wallet at any time. Buy more credits as you need them — no subscription required for top-ups."
          >
            {PRICING_COPY.BUNDLE_HEADLINE}
          </SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => <CreditPackageCard key={pkg.id} pkg={pkg} />)}
          </div>
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
            <strong className="text-neutral-800">Credits never expire</strong> and roll over month to month.
            Unused credits stay in your wallet until you use them.
            Cache hits — when the engine reuses a previous enrichment result — are always free.
          </div>
        </div>
      </section>

      {/* ── CATEGORY EXPLANATION ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          sub="Chameleon Credits are organised into three categories. Each one reflects what the engine is doing on behalf of your visitors."
        >
          {PRICING_COPY.CATEGORY_HEADLINE}
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["recognition", "adaptation", "brainpower"] as const).map((cat) => (
            <CategoryCard key={cat} cat={cat} />
          ))}
        </div>
      </section>

      {/* ── BUDGET / TRUST FEATURES ─────────────────────────────────────── */}
      <section className="bg-neutral-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{PRICING_COPY.TRUST_HEADLINE}</h2>
            <p className="mt-3 max-w-2xl mx-auto text-base text-neutral-400">
              {PRICING_COPY.TRUST_BODY}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TRUST_FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{f.icon}</span>
                  <div>
                    <h3 className="font-semibold text-white">{f.title}</h3>
                    <p className="mt-1 text-sm text-neutral-400">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAMPLE SCENARIOS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          sub="Real-world examples showing estimated credit usage, what drives the cost, and how budget controls protect each type of customer."
        >
          What does it cost in practice?
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {USAGE_SCENARIOS.map((s) => <ScenarioCard key={s.label} scenario={s} />)}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <SectionHeading>Common questions</SectionHeading>
          <div className="space-y-4">
            {PRICING_COPY.FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-xl border border-neutral-200 bg-white p-5">
                <h3 className="font-semibold text-neutral-900">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Start small. Stay in control. Grow.
        </h2>
        <p className="mt-4 max-w-lg mx-auto text-base text-neutral-500">
          Try Mister Chameleon with 500 included credits on the Starter plan.
          No surprise invoices. No commitment. Scale when you're ready.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="/contact"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            Start free trial
          </a>
          <a
            href="/demo"
            className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 transition-colors"
          >
            See a live demo
          </a>
        </div>
      </section>
    </div>
  );
}
