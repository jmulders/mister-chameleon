/**
 * Package Options — UI-ready projections of PackageDefinition
 *
 * This module derives a `PackageOption` shape from the authoritative
 * `PackageDefinition` constants.  The projection is purpose-built for UI
 * flows (onboarding package selectors, admin package summaries, pricing
 * comparison tables) so those callers receive pre-shaped, pre-formatted data
 * instead of re-mapping the canonical model inline.
 *
 * ─── Why a separate projection? ──────────────────────────────────────────────
 *
 *   PackageDefinition is the source of truth for entitlement enforcement and
 *   runtime checks — it stays close to the domain model and must remain stable.
 *
 *   PackageOption is a read-only view shaped for rendering:
 *     • Pre-formatted price strings  ("$599 / mo", "Contact us")
 *     • isContactSales boolean       (branch without null-checking price)
 *     • Flat feature and limit fields (no pricing.*, allowedFeatures.* nesting)
 *     • UI-idiomatic names           (label, highlights vs displayName, salesHighlights)
 *
 *   Each caller rendering a package card imports PackageOption once and gets
 *   a consistent interface.  New fields (e.g. badge text, badge color) can be
 *   added here without touching the canonical PackageDefinition.
 *
 * ─── Pre-computed at module load ──────────────────────────────────────────────
 *
 *   Options are derived from plain constants (no I/O), computed once at import
 *   time, and returned by reference.  Calls to getAllPackageOptions() are O(1)
 *   and the returned array is referentially stable.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { getAllPackageOptions, getPackageOption } from "@/tenant";
 *
 *   // Render all tiers in canonical order (onboarding picker, pricing page):
 *   const options = getAllPackageOptions();
 *   options.map((opt) => <PackageCard key={opt.key} option={opt} />)
 *
 *   // Look up one tier (admin package summary, current-plan badge):
 *   const opt = getPackageOption("growth");
 *   opt.label             // "Growth"
 *   opt.monthlyPriceLabel // "$599 / mo"
 *   opt.isContactSales    // false
 *   opt.features.ai       // false
 *   opt.limits.maxSites   // 3
 *
 * ─── Relationship to PackageDefinition ───────────────────────────────────────
 *
 *   PackageOption is derived from PackageDefinition — never diverges.
 *   To change copy or values, edit the constants in packages.ts.
 *   PackageOption will reflect the change on the next import.
 *
 * ─── Safe in any context ──────────────────────────────────────────────────────
 *
 *   No I/O, no Next.js deps, no server-only imports.
 *   Import from "@/tenant" (client-safe barrel) or "@/tenant/server".
 */

import type { PackageKey } from "./types";
import { getPackageDefinition, getAllPackageDefinitions } from "./packages";
import type { PackageDefinition } from "./packages";

// ── PackageOption ─────────────────────────────────────────────────────────────

/**
 * A UI-ready snapshot of one package tier.
 *
 * Derived from `PackageDefinition` at module load time.  Fields are shaped
 * for direct use in selection cards, comparison tables, and onboarding UIs
 * without further mapping or formatting in the component.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   key               Stable PackageKey — use for form values, API calls,
 *                     and as the React key prop.
 *
 *   label             Human-readable tier name.  e.g. "Growth".
 *                     Use for headings, buttons, and selection options.
 *
 *   shortDescription  One-sentence positioning statement.
 *                     Use as the card subtitle or dropdown hint.
 *
 *   recommendedFor    Ideal-buyer description from the buyer's perspective.
 *                     Use in onboarding guidance and sales tooltips.
 *
 *   highlights        Ordered selling points (most-to-least important).
 *                     Use for feature bullet lists in cards and comparison rows.
 *                     Typically 4–6 items; safe to truncate at any index.
 *
 *   monthlyPrice      Raw indicative monthly price in USD.
 *                     null = enterprise / Contact us pricing.
 *                     Prefer monthlyPriceLabel for display.
 *
 *   annualPrice       Raw indicative annual monthly-equivalent in USD.
 *                     null = not offered or Contact us.
 *                     Prefer annualPriceLabel for display.
 *
 *   monthlyPriceLabel Pre-formatted string for direct rendering.
 *                     "$199 / mo"  or  "Contact us".
 *                     No null-check required in the component.
 *
 *   annualPriceLabel  Pre-formatted annual equivalent string, or null when
 *                     no annual option is available.
 *                     "$159 / mo"  or  null.
 *
 *   isContactSales    True when pricing is enterprise-negotiated.
 *                     Use to swap a price display for a "Talk to us" CTA.
 *
 *   features          Boolean platform feature flags.
 *                     Use in comparison table ✓ / ✗ rows.
 *
 *   limits            Key operational limits.
 *                     Use in comparison table value rows.
 *                     Infinity = unlimited; 0 = not permitted.
 */
export interface PackageOption {
  readonly key:              PackageKey;
  readonly label:            string;
  readonly shortDescription: string;
  readonly recommendedFor:   string;
  readonly highlights:       readonly string[];

  readonly monthlyPrice:      number | null;
  readonly annualPrice:       number | null;
  readonly monthlyPriceLabel: string;
  readonly annualPriceLabel:  string | null;
  readonly isContactSales:    boolean;

  readonly features: {
    readonly experiments: boolean;
    readonly ai:          boolean;
    readonly analytics:   boolean;
  };

  readonly limits: {
    readonly maxSites:           number;
    readonly maxExperiments:     number;
    readonly maxVariantsPerSlot: number;
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Formats a raw monthly price for display.  null → "Contact us". */
function formatMonthly(n: number | null): string {
  return n !== null ? `$${n} / mo` : "Contact us";
}

/** Formats an annual monthly-equivalent price.  null → null (not offered). */
function formatAnnual(n: number | null): string | null {
  return n !== null ? `$${n} / mo` : null;
}

/** Projects a PackageDefinition into a PackageOption. */
function toPackageOption(pkg: PackageDefinition): PackageOption {
  const { monthlyPriceIndicative, annualPriceIndicative } = pkg.pricing;

  return {
    key:              pkg.key,
    label:            pkg.displayName,
    shortDescription: pkg.shortDescription,
    recommendedFor:   pkg.pricing.recommendedFor,
    highlights:       pkg.pricing.salesHighlights,

    monthlyPrice:      monthlyPriceIndicative,
    annualPrice:       annualPriceIndicative,
    monthlyPriceLabel: formatMonthly(monthlyPriceIndicative),
    annualPriceLabel:  formatAnnual(annualPriceIndicative),
    isContactSales:    monthlyPriceIndicative === null,

    features: {
      experiments: pkg.allowedFeatures.experiments,
      ai:          pkg.allowedFeatures.ai,
      analytics:   pkg.allowedFeatures.analytics,
    },

    limits: {
      maxSites:           pkg.limits.maxSites,
      maxExperiments:     pkg.limits.maxExperiments,
      maxVariantsPerSlot: pkg.limits.maxVariantsPerSlot,
    },
  };
}

// ── Pre-computed options ───────────────────────────────────────────────────────
//
// Computed once at module load from the canonical PackageDefinition constants.
// Both the ordered array and the key-indexed map are referentially stable —
// callers that memoize on reference equality will not re-render unnecessarily.

const ALL_OPTIONS: readonly PackageOption[] =
  getAllPackageDefinitions().map(toPackageOption);

const OPTIONS_BY_KEY: Record<PackageKey, PackageOption> =
  Object.fromEntries(ALL_OPTIONS.map((opt) => [opt.key, opt])) as Record<
    PackageKey,
    PackageOption
  >;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all package options in canonical ascending tier order.
 *
 * The array is pre-computed at module load and returned by reference —
 * referentially stable, safe to use as a dependency in React hooks.
 *
 * @returns  All PackageOption objects: [starter, growth, pro].
 *
 * @example
 * const options = getAllPackageOptions();
 * options.map((opt) => (
 *   <PackageCard
 *     key={opt.key}
 *     label={opt.label}
 *     price={opt.monthlyPriceLabel}
 *     highlights={opt.highlights}
 *     isContactSales={opt.isContactSales}
 *   />
 * ));
 */
export function getAllPackageOptions(): readonly PackageOption[] {
  return ALL_OPTIONS;
}

/**
 * Returns the UI-ready option for a given package key.
 *
 * The result is pre-computed at module load and returned by reference —
 * referentially stable, safe to use as a dependency in React hooks.
 *
 * @param key  The package tier key.
 * @returns    The corresponding PackageOption.
 *
 * @example
 * const opt = getPackageOption("growth");
 * opt.label             // "Growth"
 * opt.monthlyPriceLabel // "$599 / mo"
 * opt.annualPriceLabel  // "$479 / mo"
 * opt.isContactSales    // false
 * opt.features.ai       // false
 * opt.limits.maxSites   // 3
 * opt.highlights[0]     // "Everything in Starter"
 */
export function getPackageOption(key: PackageKey): PackageOption {
  return OPTIONS_BY_KEY[key];
}
