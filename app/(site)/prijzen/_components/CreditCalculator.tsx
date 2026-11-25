"use client";

/**
 * The calculator under "Credits" on the price list.
 *
 * A buyer fills in visits per month, two shares of their own guessing and the
 * sources they would switch on. The outcome is an upper bound in credits and
 * euros (lib/credit-estimate.ts).
 *
 * The prices are props: the page reads them from the table the platform
 * charges from, so this component holds no price of its own.
 */

import { useId, useState } from "react";
import { estimateMonthlyCredits } from "@/lib/credit-estimate";
import type { PublicLookupPrices } from "@/lib/billing/public-lookup-prices";

type SourceKey = "network" | "company" | "crm" | "analytics" | "weather";

const SOURCES: readonly { key: SourceKey; label: string; per: "visit" | "company"; on: boolean }[] = [
  { key: "network",   label: "Het netwerk en de plaats van een bezoek", per: "visit",   on: true  },
  { key: "company",   label: "Het bedrijf achter een bezoek",           per: "company", on: true  },
  { key: "crm",       label: "De klant in je CRM",                      per: "visit",   on: false },
  { key: "analytics", label: "Eerdere bezoeken uit Google Analytics",   per: "visit",   on: false },
  { key: "weather",   label: "Het weer op de plek van het bezoek",      per: "visit",   on: false },
];

const number = (n: number, digits = 0): string =>
  n.toLocaleString("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
const euro = (cents: number): string =>
  `€ ${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FIELD = "mt-2 w-full rounded-lg border px-3 py-2 text-base";
const FIELD_STYLE = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" };

export function CreditCalculator({ prices }: { prices: PublicLookupPrices }) {
  const id = useId();
  const [visits, setVisits]         = useState(25_000);
  const [consent, setConsent]       = useState(50);
  const [recognised, setRecognised] = useState(10);
  const [on, setOn] = useState<Record<SourceKey, boolean>>(
    () => Object.fromEntries(SOURCES.map((s) => [s.key, s.on])) as Record<SourceKey, boolean>,
  );

  const creditsPerVisit = SOURCES
    .filter((s) => s.per === "visit" && on[s.key])
    .reduce((sum, s) => sum + prices[s.key], 0);
  // Recognising a company is the lookup plus the first recognition.
  const creditsPerCompany = on.company ? prices.company + prices.recognition : 0;

  const { credits, cents } = estimateMonthlyCredits({
    visits,
    consentShare:    consent / 100,
    recognisedShare: recognised / 100,
    creditsPerVisit,
    creditsPerCompany,
  });

  return (
    <div
      data-part="credit-calculator"
      className="mt-10 grid grid-cols-1 gap-6 rounded-2xl border p-6 text-left md:grid-cols-2 md:gap-10 md:p-8"
      style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Reken het uit</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Vul je eigen schatting in. Je kunt alles later bijstellen.
        </p>

        <label htmlFor={`${id}-visits`} className="mt-5 block text-sm font-medium" style={{ color: "var(--text)" }}>
          Bezoeken per maand
        </label>
        <input
          id={`${id}-visits`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={visits}
          onChange={(e) => setVisits(Math.max(0, Number(e.target.value) || 0))}
          className={FIELD}
          style={FIELD_STYLE}
        />

        <label htmlFor={`${id}-consent`} className="mt-5 block text-sm font-medium" style={{ color: "var(--text)" }}>
          Deel dat toestemming geeft <span style={{ color: "var(--text-muted)" }}>{consent} procent</span>
        </label>
        <input
          id={`${id}-consent`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={consent}
          onChange={(e) => setConsent(Number(e.target.value))}
          className="mt-2 w-full"
        />

        <label htmlFor={`${id}-recognised`} className="mt-5 block text-sm font-medium" style={{ color: "var(--text)" }}>
          Deel waarvan je site het bedrijf herkent <span style={{ color: "var(--text-muted)" }}>{recognised} procent</span>
        </label>
        <input
          id={`${id}-recognised`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={recognised}
          onChange={(e) => setRecognised(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </div>

      <div>
        <fieldset>
          <legend className="text-sm font-medium" style={{ color: "var(--text)" }}>Wat je aanzet</legend>
          <div className="mt-3 space-y-2">
            {SOURCES.map((source) => (
              <label key={source.key} className="flex items-start gap-3 text-sm" style={{ color: "var(--text)" }}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={on[source.key]}
                  onChange={(e) => setOn((prev) => ({ ...prev, [source.key]: e.target.checked }))}
                />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div
          aria-live="polite"
          className="mt-6 rounded-xl p-5"
          style={{ background: "var(--bg-subtle)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Hoogstens, per maand</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: "var(--text)" }}>
            <span data-part="credit-estimate">{number(credits)}</span> credits
          </p>
          <p className="mt-1 text-base" style={{ color: "var(--text)" }}>
            Dat is <span data-part="credit-estimate-euro">{euro(cents)}</span>.
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Dit is een bovengrens. Wat je site al weet, zoekt hij niet opnieuw op. Je echte verbruik zie je in je account.
        </p>
      </div>
    </div>
  );
}
