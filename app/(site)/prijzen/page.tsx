/**
 * app/(site)/prijzen/page.tsx
 *
 * The public price list of Mister Chameleon, in Dutch.
 *
 * ─── Structure ────────────────────────────────────────────────────────────────
 *
 *   1. Heading and one paragraph: three plans, a price per month, a free trial.
 *   2. The three plans: Starter, Growth, Pro.
 *   3. Four questions every buyer has: what counts as a visit, what happens
 *      over the limit, how company lookups are paid, and the yearly discount.
 *   4. Credit bundles, for company lookups.
 *   5. Closing call to action.
 *
 * The page starts with the plans, because that is what a visitor came for.
 * Credits come last: they only matter once you look up companies.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 *
 *   Server component, no database calls. Prices, limits and features come from
 *   billing/plans.ts, so the page cannot drift from what is charged.
 *
 * The English page used to live on /pricing. On misterchameleon.nl that address
 * redirects here (see next.config.mjs).
 */

import Link from "next/link";
import type { Metadata } from "next";
import { BILLING_PLANS, type BillingPlan } from "@/billing/plans";
import { PlanCartButton, CreditCartButton } from "./_components/CartButtons";

export const metadata: Metadata = {
  title:       "Prijzen website personalisatie | Mister Chameleon",
  description: "Vanaf € 149 per maand voor 25.000 gepersonaliseerde bezoeken. Bekijk de drie pakketten en probeer 14 dagen gratis.",
  alternates:  { canonical: "/prijzen" },
};

// ── Copy per plan ─────────────────────────────────────────────────────────────

const PLAN_FOR_WHO: Record<BillingPlan["id"], string> = {
  starter: "Je begint met je homepage en een paar regels.",
  growth:  "Je wilt AI, bedrijven herkennen en het volledige dashboard.",
  pro:     "Je beheert meerdere sites, bijvoorbeeld als bureau.",
};

function planFeatures(plan: BillingPlan): string[] {
  const list = ["Onbeperkt regels, doelgroepen en A/B-tests", "Meten met een controlegroep"];
  if (plan.features.analyticsDashboard)  list.push("Het volledige dashboard");
  if (plan.features.aiPersonalization)   list.push("AI die meedenkt");
  if (plan.features.crmAbmEnrichment)    list.push("Bedrijven herkennen en je CRM koppelen");
  if (plan.features.multiTenant)         list.push("Meerdere sites in één omgeving");
  if (plan.features.prioritySupport)     list.push("Voorrang bij support");
  return list;
}

// ── Credit bundles ────────────────────────────────────────────────────────────
//
// The names are what the cart shows, so they stay as the cart knows them.

const CREDIT_PACKAGES = [
  { id: "hatchling", name: "The Hatchling", credits: 5_000,   priceCents: 5_000,  perCredit: "€ 0,01 per credit",   forWho: "Voor een kleine site of een eerste proef.",   highlight: false },
  { id: "climber",   name: "The Climber",   credits: 25_000,  priceCents: 20_000, perCredit: "€ 0,008 per credit",  forWho: "Voor een site met vast zakelijk bezoek.",     highlight: true  },
  { id: "dragon",    name: "The Dragon",    credits: 100_000, priceCents: 75_000, perCredit: "€ 0,0075 per credit", forWho: "Voor een drukke site of meerdere sites.",     highlight: false },
] as const;

// ── Questions ─────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    q: "Wat telt als een bezoek?",
    a: "Eén bezoek van één bezoeker telt één keer. Hoeveel pagina's hij ook bekijkt.",
  },
  {
    q: "Wat als je over je aantal gaat?",
    a: "Dan zien nieuwe bezoekers je gewone site. Er komt geen onverwachte rekening. Je kunt een bundel bijkopen of een pakket hoger gaan.",
  },
  {
    q: "Bedrijven herkennen gaat per opzoeking",
    a: "Voor het opzoeken van een bedrijf betaal je met credits. Eén credit is één cent. Je stelt zelf een maximum per maand in.",
  },
  {
    q: "Per jaar betalen is voordeliger",
    a: "Betaal je een jaar vooruit, dan ben je per maand 17 tot 20 procent goedkoper uit.",
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function euro(cents: number): string {
  const whole = cents % 100 === 0;
  return `€ ${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function count(n: number): string {
  return n.toLocaleString("nl-NL");
}

// ── Components ────────────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: BillingPlan }) {
  const popular = plan.id === "growth";
  const muted   = popular ? "text-neutral-400" : "text-neutral-500";

  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 ${
      popular ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-neutral-900">
            Meest gekozen
          </span>
        </div>
      )}

      <h3 className={`text-lg font-semibold ${popular ? "text-white" : "text-neutral-900"}`}>{plan.name}</h3>
      <p className={`mt-1 text-sm ${muted}`}>{PLAN_FOR_WHO[plan.id]}</p>

      <div className="mt-5 flex items-end gap-1">
        <span className={`text-3xl font-bold ${popular ? "text-white" : "text-neutral-900"}`}>
          {euro(plan.monthlyPriceCents)}
        </span>
        <span className={`mb-1 text-sm ${muted}`}>per maand</span>
      </div>
      <p className={`mt-1 text-xs ${popular ? "text-emerald-400" : "text-emerald-700"}`}>
        {euro(plan.annualMonthlyCents)} per maand als je per jaar betaalt
      </p>

      <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${popular ? "bg-white/10" : "bg-neutral-50"}`}>
        <span className={`font-semibold ${popular ? "text-white" : "text-neutral-900"}`}>
          {count(plan.limits.personalizedSessionsPerMonth)}
        </span>{" "}
        <span className={popular ? "text-neutral-300" : "text-neutral-600"}>
          gepersonaliseerde bezoeken per maand
        </span>
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {planFeatures(plan).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <span aria-hidden className={`mt-0.5 ${popular ? "text-emerald-400" : "text-emerald-600"}`}>✓</span>
            <span className={popular ? "text-neutral-300" : "text-neutral-700"}>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <PlanCartButton planId={plan.id} isPopular={popular} label="Probeer 14 dagen gratis" />
      </div>
    </div>
  );
}

function CreditCard({ pkg }: { pkg: typeof CREDIT_PACKAGES[number] }) {
  return (
    <div className={`flex flex-col rounded-2xl border bg-white p-6 ${
      pkg.highlight ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"
    }`}>
      <h3 className="text-lg font-semibold text-neutral-900">{count(pkg.credits)} credits</h3>
      <p className="mt-1 text-sm text-neutral-500">{pkg.forWho}</p>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-3xl font-bold text-neutral-900">{euro(pkg.priceCents)}</span>
        <span className="mb-1 text-sm text-neutral-500">eenmalig</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{pkg.perCredit}</p>

      <div className="mt-6">
        <CreditCartButton
          bundleId={pkg.id}
          label={pkg.name}
          priceCentsEach={pkg.priceCents}
          creditsEach={pkg.credits}
          buttonLabel="In winkelwagen"
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrijzenPage() {
  const plans = Object.values(BILLING_PLANS);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Wat kost website personalisatie?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
          Drie pakketten. Je betaalt per maand voor een aantal gepersonaliseerde bezoeken.
          Je kunt elk pakket 14 dagen gratis proberen, zonder creditcard.
        </p>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section id="pakketten" aria-label="Pakketten" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────────────────── */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900 sm:text-3xl">Goed om te weten</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUESTIONS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-neutral-200 bg-white p-6">
                <h3 className="font-semibold text-neutral-900">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credits ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Credits voor bedrijven herkennen</h2>
          <p className="mt-3 text-base text-neutral-600">
            Je hebt ze alleen nodig als je bedrijven opzoekt. Credits verlopen niet.
            Wat je deze maand niet gebruikt, blijft staan.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIT_PACKAGES.map((pkg) => <CreditCard key={pkg.id} pkg={pkg} />)}
        </div>
      </section>

      {/* ── Call to action ───────────────────────────────────────────────── */}
      <section className="bg-neutral-900 py-20 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Zie het werken op je eigen site</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-neutral-300">
            In een demo van dertig minuten laten we zien hoe jouw homepage eruitziet voor drie
            verschillende bezoekers. Je kunt ook zelf beginnen. De eerste veertien dagen zijn gratis.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Plan een demo
            </Link>
            <a
              href="#pakketten"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white"
            >
              Probeer 14 dagen gratis
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
