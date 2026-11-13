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

// Colours come from the tenant theme (design-system/theme/theme.css), so the
// page follows the same contextual theme as the rest of the site. Until
// 13 Nov 2026 it used fixed white and near-black, and stayed white under a
// dark header.
const ON_INVERSE_MUTED = "color-mix(in srgb, var(--text-inverse) 72%, transparent)";
const ON_INVERSE_TINT  = "color-mix(in srgb, var(--text-inverse) 12%, transparent)";

function PlanCard({ plan }: { plan: BillingPlan }) {
  const popular = plan.id === "growth";
  const strong  = popular ? "var(--text-inverse)" : "var(--text)";
  const muted   = popular ? ON_INVERSE_MUTED      : "var(--text-muted)";
  const accent  = popular ? "var(--text-inverse)" : "var(--text-brand)";

  return (
    <div
      className="relative flex flex-col rounded-2xl border p-6"
      style={popular
        ? { background: "var(--bg-inverse)", borderColor: "var(--bg-inverse)", color: "var(--text-inverse)" }
        : { background: "var(--card-bg)",    borderColor: "var(--card-border)", color: "var(--text)" }}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="rounded-full border px-3 py-0.5 text-xs font-semibold"
            style={{ background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text)" }}
          >
            Meest gekozen
          </span>
        </div>
      )}

      <h3 className="text-lg font-semibold" style={{ color: strong }}>{plan.name}</h3>
      <p className="mt-1 text-sm" style={{ color: muted }}>{PLAN_FOR_WHO[plan.id]}</p>

      <div className="mt-5 flex items-end gap-1">
        <span className="text-3xl font-bold" style={{ color: strong }}>
          {euro(plan.monthlyPriceCents)}
        </span>
        <span className="mb-1 text-sm" style={{ color: muted }}>per maand</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: accent }}>
        {euro(plan.annualMonthlyCents)} per maand als je per jaar betaalt
      </p>

      <div
        className="mt-4 rounded-lg px-3 py-2 text-sm"
        style={{ background: popular ? ON_INVERSE_TINT : "var(--bg-subtle)" }}
      >
        <span className="font-semibold" style={{ color: strong }}>
          {count(plan.limits.personalizedSessionsPerMonth)}
        </span>{" "}
        <span style={{ color: muted }}>
          gepersonaliseerde bezoeken per maand
        </span>
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {planFeatures(plan).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <span aria-hidden className="mt-0.5" style={{ color: accent }}>✓</span>
            <span style={{ color: popular ? ON_INVERSE_MUTED : "var(--text)" }}>{feature}</span>
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
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{
        background:  "var(--card-bg)",
        borderColor: pkg.highlight ? "var(--text)" : "var(--card-border)",
        boxShadow:   pkg.highlight ? "0 0 0 1px var(--text)" : undefined,
      }}
    >
      <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{count(pkg.credits)} credits</h3>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{pkg.forWho}</p>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-3xl font-bold" style={{ color: "var(--text)" }}>{euro(pkg.priceCents)}</span>
        <span className="mb-1 text-sm" style={{ color: "var(--text-muted)" }}>eenmalig</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{pkg.perCredit}</p>

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
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--text)" }}>
          Wat kost website personalisatie?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: "var(--text-muted)" }}>
          Drie pakketten. Je betaalt per maand voor een aantal gepersonaliseerde bezoeken.
          Je kunt elk pakket 14 dagen gratis proberen. Je betaalt pas na 14 dagen.
        </p>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section id="pakketten" aria-label="Pakketten" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: "var(--section-subtle-bg)" }}>
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: "var(--text)" }}>Goed om te weten</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUESTIONS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border p-6"
                style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
              >
                <h3 className="font-semibold" style={{ color: "var(--text)" }}>{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credits ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text)" }}>Credits voor bedrijven herkennen</h2>
          <p className="mt-3 text-base" style={{ color: "var(--text-muted)" }}>
            Je hebt ze alleen nodig als je bedrijven opzoekt. Credits verlopen niet.
            Wat je deze maand niet gebruikt, blijft staan.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIT_PACKAGES.map((pkg) => <CreditCard key={pkg.id} pkg={pkg} />)}
        </div>
      </section>

      {/* ── Call to action ───────────────────────────────────────────────── */}
      {/* data-part: the brand layer of the marketing site decorates this section (app/brand). */}
      <section
        data-part="cta-section"
        className="py-20 text-center"
        style={{ background: "var(--bg-inverse)", color: "var(--text-inverse)" }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-inverse)" }}>Zie het werken op je eigen site</h2>
          <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: ON_INVERSE_MUTED }}>
            In een demo van dertig minuten laten we zien hoe jouw homepage eruitziet voor drie
            verschillende bezoekers. Je kunt ook zelf beginnen. De eerste veertien dagen zijn gratis.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--text-inverse)", color: "var(--bg-inverse)" }}
            >
              Plan een demo
            </Link>
            <a
              href="#pakketten"
              className="rounded-xl border px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: ON_INVERSE_MUTED, color: "var(--text-inverse)" }}
            >
              Probeer 14 dagen gratis
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
