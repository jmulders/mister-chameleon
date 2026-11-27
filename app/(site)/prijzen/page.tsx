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
 *   4. Credits: what they are for. Nothing is sold here; credits are bought
 *      in the account.
 *   5. Closing call to action.
 *
 * The page starts with the plans, because that is what a visitor came for.
 * Credits come last: they only matter once you look up companies.
 *
 * ─── Advice for this visitor ─────────────────────────────────────────────────
 *
 *   Above the plans the page can show one piece of advice, chosen by the
 *   tenant's rules: for an agency it points at Pro, for a visitor who is ready
 *   to start it says how the trial works. The texts live in the adaptive block
 *   `feature_page_prijzen`, one variant per audience, so the owner edits them
 *   in the admin. When the advice links to `#pakket-<plan>`, that plan is the
 *   one the page lifts out. Without advice the page is what it always was.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 *
 *   Server component. Prices, limits and features come from billing/plans.ts,
 *   so the page cannot drift from what is charged. The advice is the only part
 *   that depends on the visitor.
 *
 * The English page used to live on /pricing. On misterchameleon.nl that address
 * redirects here (see next.config.mjs).
 */

import Link from "next/link";
import type { Metadata } from "next";
import { BILLING_PLANS, type BillingPlan } from "@/billing/plans";
import { PlanCartButton } from "./_components/CartButtons";
import { resolveOwnBlockVariant } from "@/lib/page-owned-variant";
import { adviceFrom, type PricingAdvice } from "@/lib/pricing-advice";
import { getPublicLookupPrices, type PublicLookupPrices } from "@/lib/billing/public-lookup-prices";
import { CreditCalculator } from "./_components/CreditCalculator";

export const metadata: Metadata = {
  title:       "Prijzen website personalisatie | Mister Chameleon",
  description: "Vanaf € 149 per maand voor 1.500 gepersonaliseerde bezoeken. Bekijk de drie pakketten en probeer 14 dagen gratis.",
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

// ── Credits ───────────────────────────────────────────────────────────────────
//
// What credits are, in four facts. Until 25 Nov 2026 this section sold three
// bundles ("The Hatchling", "The Climber", "The Dragon") through the cart. The
// checkout never charged or credited them: it only sends the plan to the
// payment provider. Credits are bought in the account, so the page explains
// them and sells nothing.
//
// Under the facts come the price per lookup and a calculator. Both read their
// prices from the table the platform charges from (lib/billing/
// public-lookup-prices.ts), so the page cannot name another price than the one
// taken from the wallet. When that table cannot be read, neither is shown.

const CREDIT_FACTS = [
  {
    title: "Eén credit is één cent",
    text:  "Je koopt credits vooraf, in je account. Ze verlopen niet. Wat je deze maand niet gebruikt, blijft staan.",
  },
  {
    title: "Alleen met toestemming",
    text:  "Je site zoekt alleen iets op bij een bezoeker die daar toestemming voor gaf. Bekijkt hij meer pagina's in hetzelfde bezoek, dan zoekt je site één keer.",
  },
  {
    title: "Je bepaalt het maximum",
    text:  "Je stelt in je account een maximum per maand in. Daarboven zoekt je site niets meer op.",
  },
  {
    title: "Is je tegoed op, dan stopt het",
    text:  "Je site blijft werken en je regels blijven gelden. Er komt geen rekening achteraf.",
  },
] as const;

/** The price list under the facts: what one lookup costs, in credits. */
function lookupRows(prices: PublicLookupPrices): readonly { what: string; credits: number }[] {
  return [
    { what: "Het netwerk en de plaats van een bezoek",          credits: prices.network     },
    { what: "Het bedrijf achter een bezoek",                    credits: prices.company     },
    { what: "Een bezoeker die je site voor het eerst herkent",  credits: prices.recognition },
    { what: "De klant in je CRM",                               credits: prices.crm         },
    { what: "Eerdere bezoeken uit Google Analytics",            credits: prices.analytics   },
    { what: "Het weer op de plek van het bezoek",               credits: prices.weather     },
  ];
}

function credit(n: number): string {
  return `${n.toLocaleString("nl-NL", { maximumFractionDigits: 3 })} credit`;
}

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
    q: "Opzoeken gaat met credits",
    a: "Voor wat je site opzoekt, zoals het bedrijf achter een bezoek of de klant in je CRM, betaal je met credits. Eén credit is één cent. Je stelt zelf een maximum per maand in.",
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

function PlanCard({ plan, advised }: { plan: BillingPlan; advised?: BillingPlan["id"] }) {
  // The plan the page lifts out: the one the advice names, and Growth without advice.
  const popular = plan.id === (advised ?? "growth");
  const strong  = popular ? "var(--text-inverse)" : "var(--text)";
  const muted   = popular ? ON_INVERSE_MUTED      : "var(--text-muted)";
  const accent  = popular ? "var(--text-inverse)" : "var(--text-brand)";

  return (
    <div
      // The advice above the plans links here.
      id={`pakket-${plan.id}`}
      className="relative flex scroll-mt-28 flex-col rounded-2xl border p-6"
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
            {advised ? "Ons advies voor jou" : "Meest gekozen"}
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

// ── Page ──────────────────────────────────────────────────────────────────────

function AdviceNote({ advice }: { advice: PricingAdvice }) {
  const linkClass = "shrink-0 text-sm font-semibold underline underline-offset-4";
  return (
    <section aria-label="Advies" className="mx-auto max-w-5xl px-6 pb-8">
      <div
        data-part="pricing-advice"
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border p-5 text-left sm:flex-row sm:items-center sm:gap-6"
        style={{ background: "var(--bg-subtle)", borderColor: "var(--card-border)" }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text-brand)" }}>{advice.title}</p>
          <p className="mt-1 text-base leading-relaxed" style={{ color: "var(--text)" }}>{advice.text}</p>
        </div>
        {advice.linkHref && advice.linkLabel && (
          advice.linkHref.startsWith("#")
            ? <a href={advice.linkHref} className={linkClass} style={{ color: "var(--text)" }}>{advice.linkLabel}</a>
            : <Link href={advice.linkHref} className={linkClass} style={{ color: "var(--text)" }}>{advice.linkLabel}</Link>
        )}
      </div>
    </section>
  );
}

export default async function PrijzenPage() {
  const plans = Object.values(BILLING_PLANS);

  // One piece of advice for this visitor, when the rules picked an audience the
  // block has a variant for. A bot and the control group get none.
  const own    = await resolveOwnBlockVariant("prijzen", "feature", "feature_page_prijzen");
  const advice = own ? adviceFrom(own.content, Object.keys(BILLING_PLANS)) : null;

  // What a lookup costs, from the table the platform charges from.
  const lookupPrices = await getPublicLookupPrices();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--text)" }}>
          Wat kost het?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: "var(--text-muted)" }}>
          Drie pakketten. Je betaalt per maand voor een aantal gepersonaliseerde bezoeken.
          Je kunt elk pakket 14 dagen gratis proberen. Je betaalt pas na 14 dagen.
        </p>
      </section>

      {advice && <AdviceNote advice={advice} />}

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section id="pakketten" aria-label="Pakketten" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} advised={advice?.planId as BillingPlan["id"] | undefined} />)}
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
      <section id="credits" className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text)" }}>Credits, voor wat je site opzoekt</h2>
          <p className="mt-3 text-base" style={{ color: "var(--text-muted)" }}>
            Je pakket dekt je bezoeken. Credits betalen wat je site daarbij opzoekt, zoals het bedrijf
            achter een bezoek of de klant in je CRM. Je hebt ze alleen nodig als je zo&apos;n bron aanzet.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CREDIT_FACTS.map((fact) => (
            <div
              key={fact.title}
              className="rounded-2xl border p-6"
              style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>{fact.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{fact.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Je begint zonder credits. Je koopt ze pas als je een bron aanzet waarvoor ze nodig zijn.
        </p>

        {lookupPrices && (
          <>
            <div className="mx-auto mt-14 max-w-2xl">
              <h3 className="text-center text-lg font-semibold" style={{ color: "var(--text)" }}>Wat een opzoeking kost</h3>
              <ul data-part="lookup-prices" className="mt-5 divide-y" style={{ borderColor: "var(--card-border)" }}>
                {lookupRows(lookupPrices).map((row) => (
                  <li
                    key={row.what}
                    className="flex items-baseline justify-between gap-4 py-3 text-sm"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <span style={{ color: "var(--text)" }}>{row.what}</span>
                    <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--text)" }}>{credit(row.credits)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <CreditCalculator prices={lookupPrices} />
          </>
        )}
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
