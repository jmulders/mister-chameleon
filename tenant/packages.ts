/**
 * Tenant Package Definitions
 *
 * The three commercial tiers available on the platform.  Each package is a
 * complete, self-contained description of what a tenant on that tier is
 * entitled to: which adaptive blocks they can activate, which CMS content
 * block types editors may create, which platform features are unlocked, which
 * pre-built themes are available, what operational limits apply, and how the
 * package is positioned commercially.
 *
 * ─── Package tiers ────────────────────────────────────────────────────────────
 *
 *   starter   Rules-based personalisation for a single site.
 *             The adaptive engine selects the best hero, proof, and CTA variant
 *             for each visitor using a deterministic rules set.  No A/B test
 *             overhead, no AI inference cost.  One site, one theme, basic
 *             analytics, up to 2 CMS variants per adaptive slot.
 *
 *   growth    Adds A/B experiments and richer editorial layouts.
 *             Up to 5 concurrent experiments (3 variants each), up to 4 CMS
 *             variants per adaptive slot, feature grids and FAQ sections,
 *             two theme options.  Up to 3 sites.  No AI.
 *
 *   pro       The full adaptive platform.
 *             Shadow or live AI decision layer, unlimited experiments and
 *             variants, all block types, all themes including fully custom,
 *             unlimited sites.  AI mode is configurable per tenant.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Look up one package by key:
 *   import { getPackageDefinition } from "@/tenant";
 *   const pkg = getPackageDefinition("growth");
 *
 *   // Iterate all packages in canonical tier order (pricing pages, admin UIs):
 *   import { getAllPackageDefinitions } from "@/tenant";
 *   const packages = getAllPackageDefinitions();
 *
 *   // Check a feature entitlement:
 *   if (pkg.allowedFeatures.ai) { ... }
 *
 *   // Check a block entitlement:
 *   if (pkg.allowedBlocks.context.includes("proof")) { ... }
 *
 *   // Check a limit:
 *   if (experiments.length >= pkg.limits.maxExperiments) { ... }
 *
 *   // Read commercial metadata:
 *   pkg.pricing.monthlyPriceIndicative   // number | null
 *   pkg.pricing.recommendedFor           // ideal customer description
 *   pkg.pricing.salesHighlights          // ordered selling points
 *
 * ─── No I/O ───────────────────────────────────────────────────────────────────
 *
 *   All values are plain constants — no DB reads, no env var reads.
 *   Packages are resolved at import time; there is no async work here.
 *   Safe to import from any context: Server Components, Client Components,
 *   Edge middleware, tests.
 *
 * ─── Extending packages ───────────────────────────────────────────────────────
 *
 *   1. Add the new key to `PackageKey` in tenant/types.ts.
 *   2. Add the new `PackageDefinition` constant below.
 *   3. Add it to `PACKAGE_DEFINITIONS` and `PACKAGE_ORDER`.
 *   4. Both `getPackageDefinition` and `getAllPackageDefinitions` pick it up.
 */

import type {
  PackageKey,
  TenantBlocks,
  TenantFeatures,
  ThemeKey,
  ContextBlockKey,
  ContentBlockKey,
} from "./types";

// ── PackageLimits ─────────────────────────────────────────────────────────────

/**
 * Operational limits for a package tier.
 *
 * All numeric limits use `Infinity` to express "no platform-enforced cap"
 * rather than a magic sentinel like -1, so callers can write
 * `value <= limit.maxExperiments` without special-casing.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   maxSites
 *     How many separate site deployments (tenants) a client on this package
 *     may create.  Each site is a distinct `tenantId` in the store.
 *     starter=1, growth=3, pro=Infinity (unlimited).
 *
 *   maxExperiments
 *     How many A/B experiments may run concurrently across all active slots.
 *     starter=0 (experiments not permitted), growth=5, pro=Infinity.
 *
 *   maxVariantsPerExperiment
 *     How many variants a single experiment may define.
 *     Absent when there is no platform-enforced cap.
 *     growth=3, starter/pro=absent.
 *
 *   maxVariantsPerSlot
 *     How many CMS-authored variants an editor may create for a single
 *     adaptive slot (hero, proof, cta).  The rules engine can only select
 *     from variants that exist in the CMS; this cap controls how many a
 *     client is allowed to maintain.
 *     starter=2, growth=4, pro=Infinity (unlimited).
 */
export interface PackageLimits {
  readonly maxSites:                  number;
  readonly maxExperiments:            number;
  readonly maxVariantsPerExperiment?: number;
  readonly maxVariantsPerSlot:        number;
}

// ── PackagePricingMeta ────────────────────────────────────────────────────────

/**
 * Commercial metadata for a package tier.
 *
 * These values are intentionally kept as plain code constants so they are easy
 * to edit without a database migration or CMS publish step.  They are
 * informational only — actual billing is handled externally (Stripe, invoicing,
 * etc.) and is not enforced by this module.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   monthlyPriceIndicative
 *     Indicative monthly price in USD, billed monthly.
 *     `null` signals "contact us" / enterprise-negotiated pricing.
 *     Display as "$X / month" or "Contact us" depending on null-ness.
 *     These are display values — do not use for entitlement gating.
 *
 *   annualPriceIndicative
 *     Indicative monthly equivalent when billed annually, in USD.
 *     `null` if no annual option exists for this tier.
 *     Typically lower than `monthlyPriceIndicative` to incentivise annual.
 *
 *   recommendedFor
 *     One sentence describing the ideal buyer for this tier.
 *     Written from the buyer's perspective.
 *     Used in onboarding guidance, sales decks, and admin package selectors.
 *
 *   salesHighlights
 *     Key selling points for this tier, ordered most-to-least important.
 *     Each entry is a standalone fragment — no trailing punctuation.
 *     Used in comparison tables, onboarding checklists, and sales collateral.
 *     Typically 4–6 items; avoid duplicating what is already obvious from
 *     `shortDescription`.
 */
export interface PackagePricingMeta {
  readonly monthlyPriceIndicative: number | null;
  readonly annualPriceIndicative:  number | null;
  readonly recommendedFor:         string;
  readonly salesHighlights:        readonly string[];
}

// ── PackageDefinition ──────────────────────────────────────────────────────────

/**
 * The complete commercial and operational definition of a subscription tier.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   key               Stable `PackageKey` identifier — never changes.
 *
 *   displayName       Human-readable name for admin UIs, invoices, and
 *                     package selectors.  e.g. "Starter", "Growth", "Pro".
 *
 *   shortDescription  One-sentence positioning statement — surfaces on pricing
 *                     pages, capability summaries, and the admin status panel.
 *                     Written from the buyer's perspective, not the platform's.
 *
 *   allowedBlocks     Which adaptive (context) and CMS (content) blocks the
 *                     tenant may activate.  Strict allow-list: blocks absent
 *                     from this list must not be rendered, regardless of what
 *                     the CMS or rules engine returns.
 *
 *   allowedFeatures   Which platform feature flags the tenant may enable.
 *                     The package is the ceiling; the per-tenant setting is
 *                     the actual switch within that ceiling.
 *
 *   allowedThemes     Which named design presets the tenant may select.
 *                     Theme keys outside this list are rejected on save and
 *                     silently downgraded at runtime.
 *
 *   limits            Numeric operational caps — see PackageLimits above.
 *
 *   pricing           Commercial metadata — price points, ideal customer
 *                     description, and ordered selling points.
 *                     See PackagePricingMeta above.
 */
export interface PackageDefinition {
  readonly key:              PackageKey;
  readonly displayName:      string;
  readonly shortDescription: string;
  readonly allowedBlocks:    TenantBlocks;
  readonly allowedFeatures:  TenantFeatures;
  readonly allowedThemes:    readonly ThemeKey[];
  readonly limits:           PackageLimits;
  readonly pricing:          PackagePricingMeta;
}

// ── Block allow-list shorthands ───────────────────────────────────────────────
// Named constants keep the package objects below readable at a glance.

const ALL_CONTEXT_BLOCKS: readonly ContextBlockKey[] = ["hero", "proof", "cta"];

const STARTER_CONTENT_BLOCKS: readonly ContentBlockKey[] = [
  // Live blocks only — keep the starter surface simple
  "textSection",
];

const GROWTH_CONTENT_BLOCKS: readonly ContentBlockKey[] = [
  // Live blocks
  "textSection",
  "featureGrid",
  "testimonialSection",
  "faqSection",
  "ctaSection",
  "formSection",
  // Defined blocks (promoted as their renderers ship)
  "richText",
  "image",
  "quote",
  "logoStrip",
  "stats",
  // Listing / editorial — blog overview + article detail pages
  "listing",
  "articleBody",
  "articleMeta",
  "relatedContent",
  // Full-text search input block
  "search",
];

const PRO_CONTENT_BLOCKS: readonly ContentBlockKey[] = [
  // Live blocks
  "textSection",
  "featureGrid",
  "testimonialSection",
  "faqSection",
  "ctaSection",
  "formSection",
  // Defined blocks (promoted as their renderers ship)
  "richText",
  "image",
  "video",
  "quote",
  "logoStrip",
  "stats",
  "slider",
  "about",
  "newsList",
  "caseHighlight",
  // Listing / editorial
  "listing",
  "articleBody",
  "articleMeta",
  "relatedContent",
  // Vacancy-specific blocks
  "vacancyMeta",
  "applyPanel",
  // Interactive listing features + full-text search
  "filterBar",
  "search",
];

// ── Starter ───────────────────────────────────────────────────────────────────

/**
 * Starter package.
 *
 * ─── Intent ───────────────────────────────────────────────────────────────────
 *
 *   Entry-level adaptive experience for a single site.  The rules engine
 *   personalises hero, proof, and CTA for each visitor using deterministic
 *   rules — no experimentation overhead, no AI inference cost.  One content
 *   block type (text sections) keeps the editorial surface simple.
 *
 * ─── Entitlements ─────────────────────────────────────────────────────────────
 *
 *   Context blocks:    hero, proof, cta
 *   Content blocks:    textSection
 *   Features:          analytics only (no experiments, no AI)
 *   Themes:            default only
 *   Sites:             1
 *   Experiments:       not permitted (maxExperiments: 0)
 *   Variants per slot: up to 2 CMS variants per adaptive slot
 */
export const STARTER_PACKAGE: PackageDefinition = {
  key:         "starter",
  displayName: "Starter",

  shortDescription:
    "Rules-based personalisation for a single site. " +
    "No experiments, no AI — just adaptive content that works.",

  allowedBlocks: {
    context: ALL_CONTEXT_BLOCKS,
    content: STARTER_CONTENT_BLOCKS,
  },

  allowedFeatures: {
    experiments: false,
    ai:          false,
    analytics:   true,
  },

  allowedThemes: ["default"],

  limits: {
    maxSites:            1,
    maxExperiments:      0,
    // maxVariantsPerExperiment: absent — experiments not permitted on Starter
    maxVariantsPerSlot:  2,
  },

  pricing: {
    monthlyPriceIndicative: 199,
    annualPriceIndicative:  159,
    recommendedFor:
      "Small teams launching their first adaptive site — one deployment, " +
      "no experiment overhead, personalisation that works on day one.",
    salesHighlights: [
      "Adaptive hero, proof, and CTA blocks on one site",
      "Rules-based personalisation — no AI inference cost",
      "Analytics and served-variant logging included",
      "Up to 2 CMS variants per adaptive slot",
      "Default theme",
    ],
  },
};

// ── Growth ────────────────────────────────────────────────────────────────────

/**
 * Growth package.
 *
 * ─── Intent ───────────────────────────────────────────────────────────────────
 *
 *   For teams ready to iterate on their conversion funnel with structured
 *   A/B experiments alongside the adaptive rules engine.  More CMS block types
 *   let editors build richer layouts.  Two themes give basic brand flexibility
 *   without full custom-theme overhead.  Up to 3 sites.
 *
 * ─── Entitlements ─────────────────────────────────────────────────────────────
 *
 *   Context blocks:       hero, proof, cta
 *   Content blocks:       textSection, featureGrid, faqSection, listing/editorial,
 *                         forms, and the search input block
 *   Features:             experiments + analytics (no AI)
 *   Themes:               default, minimal
 *   Sites:                up to 3
 *   Experiments:          up to 5 concurrent, up to 3 variants each
 *   Variants per slot:    up to 4 CMS variants per adaptive slot
 */
export const GROWTH_PACKAGE: PackageDefinition = {
  key:         "growth",
  displayName: "Growth",

  shortDescription:
    "A/B experiments, richer layouts, and two theme options. " +
    "Up to 3 sites and 5 concurrent experiments.",

  allowedBlocks: {
    context: ALL_CONTEXT_BLOCKS,
    content: GROWTH_CONTENT_BLOCKS,
  },

  allowedFeatures: {
    experiments: true,
    ai:          false,
    analytics:   true,
  },

  allowedThemes: ["default", "minimal"],

  limits: {
    maxSites:                 3,
    maxExperiments:           5,
    maxVariantsPerExperiment: 3,
    maxVariantsPerSlot:       4,
  },

  pricing: {
    monthlyPriceIndicative: 599,
    annualPriceIndicative:  479,
    recommendedFor:
      "Growth teams running structured conversion experiments alongside personalisation — " +
      "up to 3 sites, richer editorial layouts, and two brand theme options.",
    salesHighlights: [
      "Everything in Starter",
      "A/B experiments — up to 5 concurrent, 3 variants each",
      "All live block types plus rich-text, image, quote, logo strip, and stats",
      "Testimonials and CTA section blocks included",
      "Listing, editorial, and full-text search block",
      "Minimal theme for a cleaner brand look",
      "Up to 3 sites and 4 CMS variants per adaptive slot",
    ],
  },
};

// ── Pro ───────────────────────────────────────────────────────────────────────

/**
 * Pro package.
 *
 * ─── Intent ───────────────────────────────────────────────────────────────────
 *
 *   The full adaptive platform.  The AI decision layer can run in shadow mode
 *   to log and evaluate model quality, or in live mode to serve AI-selected
 *   experience plans when confidence is sufficient.  All block types, all
 *   themes including fully bespoke custom, unlimited experiments and variants,
 *   unlimited sites.
 *
 * ─── Entitlements ─────────────────────────────────────────────────────────────
 *
 *   Context blocks:       hero, proof, cta
 *   Content blocks:       all block types including rich-text, image, video,
 *                         quote, logo strip, stats, slider, about, news-list,
 *                         case-highlight, vacancy blocks, and full-text search
 *   Features:             experiments + AI (shadow or live) + analytics
 *   Themes:               default, minimal, bold, custom
 *   Sites:                unlimited
 *   Experiments:          unlimited concurrent; variants uncapped
 *   Variants per slot:    unlimited
 */
export const PRO_PACKAGE: PackageDefinition = {
  key:         "pro",
  displayName: "Pro",

  shortDescription:
    "The full adaptive platform — AI decision layer, unlimited experiments, " +
    "all themes, and unlimited sites.",

  allowedBlocks: {
    context: ALL_CONTEXT_BLOCKS,
    content: PRO_CONTENT_BLOCKS,
  },

  allowedFeatures: {
    experiments: true,
    ai:          true,
    analytics:   true,
  },

  allowedThemes: ["default", "minimal", "bold", "custom"],

  limits: {
    maxSites:            Infinity,
    maxExperiments:      Infinity,
    // maxVariantsPerExperiment: absent — no platform-enforced cap on Pro
    maxVariantsPerSlot:  Infinity,
  },

  pricing: {
    monthlyPriceIndicative: null,   // Contact us — enterprise-negotiated
    annualPriceIndicative:  null,
    recommendedFor:
      "Scale-ups and enterprise teams who need the full platform — " +
      "AI-assisted decisions, unlimited experiments, all block types, " +
      "fully custom themes, and no site cap.",
    salesHighlights: [
      "Everything in Growth",
      "AI decision layer — shadow mode for evaluation, live mode for serving",
      "All 15 block types: video, slider, about, news list, case highlight, and more",
      "Bold and fully custom theme presets",
      "Unlimited sites, experiments, and variants",
      "Enterprise SLA and dedicated onboarding available",
    ],
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Canonical tier order — lowest to highest.
 *
 * Used by `getAllPackageDefinitions()` to return packages in a stable,
 * display-ready sequence (ascending from entry-level to full platform).
 * Add new keys here when extending the tier set.
 */
const PACKAGE_ORDER: readonly PackageKey[] = ["starter", "growth", "pro"] as const;

/**
 * Map of all package definitions, keyed by `PackageKey`.
 *
 * TypeScript ensures this is exhaustive: adding a new value to `PackageKey`
 * without a matching entry here will produce a compile-time error.
 */
const PACKAGE_DEFINITIONS: Record<PackageKey, PackageDefinition> = {
  starter: STARTER_PACKAGE,
  growth:  GROWTH_PACKAGE,
  pro:     PRO_PACKAGE,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieve the package definition for a given subscription tier key.
 *
 * Returns the authoritative `PackageDefinition` for the named tier.
 * The return type is always defined — TypeScript ensures `packageKey` is a
 * valid `PackageKey`, and `PACKAGE_DEFINITIONS` is exhaustive over that union.
 *
 * @param packageKey  The subscription tier key.
 * @returns           The corresponding `PackageDefinition`.
 *
 * @example
 * const pkg = getPackageDefinition("growth");
 * pkg.allowedFeatures.experiments           // true
 * pkg.limits.maxExperiments                 // 5
 * pkg.pricing.monthlyPriceIndicative        // 599
 * pkg.pricing.salesHighlights[0]            // "Everything in Starter"
 */
export function getPackageDefinition(packageKey: PackageKey): PackageDefinition {
  return PACKAGE_DEFINITIONS[packageKey];
}

/**
 * Returns all package definitions in canonical ascending tier order.
 *
 * The returned array is stable and ordered from entry-level to full platform:
 * `[starter, growth, pro]`.  Use this for pricing pages, admin selectors, and
 * capability comparison tables where displaying all tiers side-by-side makes
 * sense.
 *
 * The return value is a readonly array — do not mutate it.
 *
 * @returns  All `PackageDefinition` objects in canonical tier order.
 *
 * @example
 * const packages = getAllPackageDefinitions();
 * // → [STARTER_PACKAGE, GROWTH_PACKAGE, PRO_PACKAGE]
 *
 * // Render a pricing comparison:
 * packages.map((pkg) => (
 *   <PricingCard
 *     key={pkg.key}
 *     title={pkg.displayName}
 *     description={pkg.shortDescription}
 *     price={pkg.pricing.monthlyPriceIndicative}
 *     highlights={pkg.pricing.salesHighlights}
 *   />
 * ));
 */
export function getAllPackageDefinitions(): readonly PackageDefinition[] {
  return PACKAGE_ORDER.map((key) => PACKAGE_DEFINITIONS[key]);
}
