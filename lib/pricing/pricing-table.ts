/**
 * Canonical Pricing Table Model
 *
 * The single source of truth for the Mister Chameleon pricing table:
 * plan content, feature lists, CTA flow types, billing references,
 * and enrichment credit bundles.
 *
 * ─── Design principles ────────────────────────────────────────────────────────
 *
 *   This file is NOT a UI component — it is a typed data model.
 *   The pricing table React component reads from this model; it does not
 *   hard-code any prices, feature strings, or CTA labels.
 *
 *   Stripe price IDs are NOT stored here. They live in environment variables
 *   and are resolved via lib/billing/plan-map.ts → getSubscriptionPriceId().
 *   This prevents fragile UI-to-payment wiring.
 *
 *   CTA behavior is resolved at render time via resolvePlanCtaHref(), which
 *   routes based on ctaFlowType and runtime billing configuration:
 *     trial    → /registreren  (free trial signup, no payment required)
 *     demo     → /demo         (demo request form)
 *     checkout → /api/billing/checkout?plan=X&cycle=Y  (Stripe Checkout Session)
 *
 * ─── Adaptive pricing behavior ────────────────────────────────────────────────
 *
 *   The pricing table content itself never changes — it is canonical.
 *   What the adaptive experience layer controls is:
 *     pricingEmphasis  — whether pricing is shown as teaser, standard, or emphasized
 *     pricingCtaMode   — which CTA type to show in the pricing section
 *
 *   See decision/types.ts for ExperiencePlan.pricingEmphasis / pricingCtaMode.
 *   The pricing table component reads these from the experience plan and adjusts
 *   visual weight and CTA labels without modifying the underlying pricing data.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   lib/pricing/pricing-table.ts    ← YOU ARE HERE — canonical pricing model
 *   lib/billing/plan-map.ts         → Stripe price ID resolution (env vars)
 *   lib/billing/plan-config.ts      → Normalized plan billing config + checkout
 *   decision/types.ts               → pricingEmphasis, pricingCtaMode on ExperiencePlan
 */

// ── Plan key ──────────────────────────────────────────────────────────────────

/**
 * The three SaaS subscription plan tiers.
 *
 * These align with the Stripe product SKUs and the PackageKey in tenant/types.ts.
 *   starter → entry-level, trial eligible, 1 website
 *   growth  → mid-tier, full behavior engine, demo-first
 *   pro     → full platform, multi-site/team, demo-first
 */
export type PricingPlanKey = "starter" | "growth" | "pro";

/**
 * Billing cycle for subscription pricing.
 *
 * Note: "yearly" here corresponds to "annual" in plan-map.ts / BillingCycle.
 * The translation happens in plan-config.ts.
 */
export type PricingBillingCycle = "monthly" | "yearly";

// ── CTA flow type ─────────────────────────────────────────────────────────────

/**
 * The conversion flow a plan's CTA button triggers.
 *
 * trial         → Free trial signup. No credit card. Lands on /registreren.
 *                 Used for Starter when configured as trial-eligible.
 * demo          → Demo request form. Lands on /demo.
 *                 Used for Growth and Pro by default.
 * checkout      → Stripe Checkout Session. Used when direct checkout is enabled.
 *                 Falls back to demo if Stripe env vars are not configured.
 * onboarding    → Post-conversion: sends customer to their dashboard/onboarding.
 * expansion     → Sends existing customer to plan upgrade / expansion flow.
 * dashboard     → Direct link to the customer dashboard. Suppresses acquisition CTA.
 */
export type CTAFlowType =
  | "trial"
  | "demo"
  | "checkout"
  | "onboarding"
  | "expansion"
  | "dashboard";

// ── Plan CTA resolution ───────────────────────────────────────────────────────

/**
 * The resolved CTA for a plan × visitor context combination.
 *
 * label  — button text to display (adapts to visitor lifecycle)
 * href   — where clicking the CTA takes the visitor
 * type   — the underlying flow type (for analytics and styling)
 */
export interface ResolvedPlanCta {
  label: string;
  href:  string;
  type:  CTAFlowType;
}

// ── Plan card ─────────────────────────────────────────────────────────────────

/**
 * A single pricing plan card in the pricing table.
 *
 * All monetary values are in EUR cents (integer).
 * Display formatting (€ symbol, /mo, /year) is handled by the component.
 */
export interface PricingPlanCard {
  /**
   * Stable machine-readable plan key.
   * Maps to Stripe product / PackageKey in tenant/types.ts.
   */
  key: PricingPlanKey;

  /** Display name shown in the pricing table header. */
  name: string;

  /**
   * Monthly price when billed monthly, in EUR.
   * Displayed as "€X / maand" in the toggle-off state.
   */
  monthlyPrice: number;

  /**
   * Total price when billed yearly, in EUR.
   * Displayed as "€X / jaar" (≈ X/12 per month shown in parentheses).
   */
  yearlyPrice: number;

  /**
   * 1–2 sentence description of who this plan is for.
   * Shown below the plan name and price.
   */
  forWho: string;

  /**
   * Features included in this plan.
   * Rendered with a checkmark icon in the pricing table.
   */
  includedFeatures: readonly string[];

  /**
   * Features explicitly NOT included in this plan.
   * Rendered with a cross icon to show upgrade path.
   * Omit for the highest tier.
   */
  excludedFeatures?: readonly string[];

  /**
   * The default CTA label for this plan card.
   * May be overridden at render time based on pricingCtaMode.
   */
  ctaLabel: string;

  /**
   * The default CTA flow for this plan card.
   * trial   = free trial, no card, for Starter
   * demo    = book a demo, for Growth and Pro
   * checkout = direct Stripe checkout (when configured and enabled)
   */
  ctaType: CTAFlowType;

  /**
   * Stripe price IDs referenced from environment variables via plan-map.ts.
   * NOT stored here — this field carries the env var key names, not the IDs.
   * Resolved at runtime via getSubscriptionPriceId(key, cycle).
   *
   * example: { monthly: "STRIPE_PRICE_STARTER_MONTHLY", annual: "STRIPE_PRICE_STARTER_ANNUAL" }
   */
  billingEnvKeys: {
    monthly: string;
    annual:  string;
  };

  /** When true, this plan is visually highlighted as the recommended option. */
  isRecommended?: boolean;

  /**
   * Customer lifecycle CTA overrides.
   * When the visitor is in a specific lifecycle state, the CTA adapts.
   *
   * onboarding — visitor just converted; show onboarding CTA instead of acquisition
   * expansion  — existing customer; show upgrade/expansion CTA
   */
  customerCtaOverrides?: {
    onboarding?: ResolvedPlanCta;
    expansion?:  ResolvedPlanCta;
  };
}

// ── Enrichment credit bundle ───────────────────────────────────────────────────

/**
 * A one-time enrichment credit bundle.
 *
 * Credits are consumed by enrichment lookups (IP recognition, CRM matching, etc.).
 * Bundles are one-time purchases, separate from subscription pricing.
 */
export interface EnrichmentBundle {
  /** Number of credits in this bundle. */
  credits: number;
  /** Display price in EUR. */
  priceEur: number;
  /**
   * Reference to the Stripe Price ID env var key.
   * Resolved via getCreditBundles() in lib/billing/plan-map.ts.
   * null = use the closest match from plan-map.ts getCreditBundles().
   */
  billingEnvKey?: string;
  /** Whether this bundle is highlighted as best value. */
  isPopular?: boolean;
}

/**
 * An example of credit consumption for a specific enrichment type.
 * Used in the enrichment section to make credits concrete.
 */
export interface EnrichmentExample {
  action:  string;
  credits: number;
}

/**
 * The enrichment credits section below the main pricing plans.
 */
export interface EnrichmentSection {
  headline: string;
  text:     string;
  bundles:  readonly EnrichmentBundle[];
  examples: readonly EnrichmentExample[];
  /**
   * When true, bundle prices are admin-configurable via the billing catalog.
   * When false, the hardcoded priceEur values are authoritative.
   *
   * Set to true once admin billing catalog integration is wired.
   */
  adminConfigurable?: boolean;
}

// ── Pricing table config ──────────────────────────────────────────────────────

/**
 * The complete pricing table configuration.
 *
 * This is the data contract between the backend pricing model and the
 * frontend pricing table component. It is tenant-agnostic — the component
 * adapts visual presentation based on ExperiencePlan.pricingEmphasis and
 * pricingCtaMode from the adaptive decision engine.
 */
export interface PricingTableConfig {
  /**
   * The pricing plans to display, in order (lowest → highest tier).
   */
  plans: readonly PricingPlanCard[];

  /**
   * The enrichment credits section.
   * Displayed below the plan cards.
   */
  enrichmentSection: EnrichmentSection;

  /**
   * Whether the monthly/yearly toggle is displayed.
   * When false, only monthly pricing is shown.
   */
  showYearlyToggle: boolean;

  /**
   * Default billing cycle shown when the page loads.
   */
  defaultCycle: PricingBillingCycle;
}

// ── CTA href resolver ─────────────────────────────────────────────────────────

/**
 * Resolve the CTA href for a plan × flow type combination.
 *
 * This is the single place where plan key + flow type → URL mapping lives.
 * It does NOT call Stripe directly — for checkout, it builds the checkout
 * initiation URL that hits the /api/billing/checkout route.
 *
 * Fallback strategy:
 *   checkout  → /api/billing/checkout?plan=X&cycle=Y (if Stripe not configured, component falls back to demo)
 *   trial     → /registreren?plan=X
 *   demo      → /demo
 *   onboarding → /dashboard/onboarding
 *   expansion  → /dashboard/upgrade
 *   dashboard  → /dashboard
 *
 * @param planKey   The subscription plan this CTA is for.
 * @param flowType  The conversion flow to initiate.
 * @param cycle     The billing cycle (used for checkout and trial flows).
 */
export function resolvePlanCtaHref(
  planKey:  PricingPlanKey,
  flowType: CTAFlowType,
  cycle:    PricingBillingCycle = "monthly",
): string {
  switch (flowType) {
    case "checkout":
      return `/api/billing/checkout?plan=${planKey}&cycle=${cycle === "yearly" ? "annual" : "monthly"}`;
    case "trial":
      return `/registreren?plan=${planKey}`;
    case "demo":
      return `/demo`;
    case "onboarding":
      return `/dashboard/onboarding`;
    case "expansion":
      return `/dashboard/upgrade`;
    case "dashboard":
      return `/dashboard`;
  }
}

/**
 * Resolve the full ResolvedPlanCta for a plan given the visitor's pricingCtaMode.
 *
 * pricingCtaMode is set by the adaptive decision engine based on the visitor's
 * lifecycle stage. This function maps that mode to concrete CTA label + href + type.
 *
 * Used by the pricing table component to adapt each plan card's CTA without
 * modifying the underlying plan data.
 *
 * @param plan          The pricing plan card.
 * @param ctaMode       The adaptive CTA mode from ExperiencePlan.pricingCtaMode.
 * @param cycle         The currently selected billing cycle.
 */
export function resolvePlanCtaForMode(
  plan:    PricingPlanCard,
  ctaMode: string | undefined,
  cycle:   PricingBillingCycle = "monthly",
): ResolvedPlanCta {
  switch (ctaMode) {
    case "onboarding":
      // Customer just converted — suppress acquisition, show onboarding path.
      return (
        plan.customerCtaOverrides?.onboarding ?? {
          label: "Ga naar dashboard",
          href:  resolvePlanCtaHref(plan.key, "onboarding", cycle),
          type:  "onboarding",
        }
      );

    case "expansion":
      // Existing customer revisiting pricing — show upgrade path.
      return (
        plan.customerCtaOverrides?.expansion ?? {
          label: "Upgrade je plan",
          href:  resolvePlanCtaHref(plan.key, "expansion", cycle),
          type:  "expansion",
        }
      );

    case "trial":
      // Trial-ready visitor — emphasise the no-card free start.
      return plan.ctaType === "trial"
        ? {
            label: "Gratis starten",
            href:  resolvePlanCtaHref(plan.key, "trial", cycle),
            type:  "trial",
          }
        : {
            label: plan.ctaLabel,
            href:  resolvePlanCtaHref(plan.key, plan.ctaType, cycle),
            type:  plan.ctaType,
          };

    case "demo":
    default:
      // Default or demo mode — use the plan's canonical CTA.
      return {
        label: plan.ctaLabel,
        href:  resolvePlanCtaHref(plan.key, plan.ctaType, cycle),
        type:  plan.ctaType,
      };
  }
}

// ── Canonical Mister Chameleon pricing table ──────────────────────────────────

/**
 * The canonical pricing table content for Mister Chameleon's own platform.
 *
 * This is the authoritative source for the /pricing page content.
 * All prices are in EUR. Feature strings are in Dutch (platform language).
 *
 * This config is seeded into the CMS via apply-blueprint() and is editable
 * per tenant after seeding. Changes to this file update blueprint-source
 * entries on the next blueprint application (system/blueprint source entries
 * are safe to overwrite; tenant-edited entries are protected).
 *
 * ─── Billing wiring ──────────────────────────────────────────────────────────
 *
 *   billingEnvKeys reference environment variable names (not values).
 *   Actual Stripe price IDs are resolved at checkout initiation time via:
 *     getSubscriptionPriceId(planKey, cycle)  in lib/billing/plan-map.ts
 *
 *   This means pricing content can be deployed and staged without Stripe
 *   being configured yet — the checkout endpoint simply won't be available
 *   until the env vars are set.
 */
export const SAAS_PRICING_TABLE: PricingTableConfig = {
  showYearlyToggle: true,
  defaultCycle:     "monthly",

  plans: [
    // ── STARTER ────────────────────────────────────────────────────────────────

    {
      key:          "starter",
      name:         "Starter",
      monthlyPrice: 79,
      yearlyPrice:  760,
      forWho:       "Voor teams die willen starten met adaptive experiences.",
      ctaLabel:     "Start gratis",
      ctaType:      "trial",
      isRecommended: false,

      billingEnvKeys: {
        monthly: "STRIPE_PRICE_STARTER_MONTHLY",
        annual:  "STRIPE_PRICE_STARTER_ANNUAL",
      },

      includedFeatures: [
        "1 website",
        "Basis personalisatie",
        "Simpele rules",
        "Standaard block variants",
        "Basis analytics",
        "Scenario preview light",
      ],

      excludedFeatures: [
        "Advanced sequences",
        "Lifecycle logic",
        "Enrichment workflows",
      ],

      customerCtaOverrides: {
        onboarding: {
          label: "Plan je onboarding",
          href:  "/dashboard/onboarding",
          type:  "onboarding",
        },
        expansion: {
          label: "Upgrade naar Growth",
          href:  "/dashboard/upgrade?from=starter&to=growth",
          type:  "expansion",
        },
      },
    },

    // ── GROWTH ─────────────────────────────────────────────────────────────────

    {
      key:          "growth",
      name:         "Growth",
      monthlyPrice: 249,
      yearlyPrice:  2390,
      forWho:       "Voor teams die serieus willen optimaliseren.",
      ctaLabel:     "Plan demo",
      ctaType:      "demo",
      isRecommended: true,

      billingEnvKeys: {
        monthly: "STRIPE_PRICE_GROWTH_MONTHLY",
        annual:  "STRIPE_PRICE_GROWTH_ANNUAL",
      },

      includedFeatures: [
        "Alles in Starter",
        "Volledige behavior engine",
        "Sequence detection",
        "Funnel stages",
        "Confidence model",
        "Scenario control",
        "Post-conversion logic",
        "Expanded rules",
      ],

      customerCtaOverrides: {
        onboarding: {
          label: "Plan je onboarding",
          href:  "/dashboard/onboarding",
          type:  "onboarding",
        },
        expansion: {
          label: "Upgrade naar Pro",
          href:  "/dashboard/upgrade?from=growth&to=pro",
          type:  "expansion",
        },
      },
    },

    // ── PRO ────────────────────────────────────────────────────────────────────

    {
      key:          "pro",
      name:         "Pro",
      monthlyPrice: 599,
      yearlyPrice:  5750,
      forWho:       "Voor teams die hun website als revenue engine inzetten.",
      ctaLabel:     "Plan demo",
      ctaType:      "demo",
      isRecommended: false,

      billingEnvKeys: {
        monthly: "STRIPE_PRICE_PRO_MONTHLY",
        annual:  "STRIPE_PRICE_PRO_ANNUAL",
      },

      includedFeatures: [
        "Alles in Growth",
        "Multi-site / multi-team",
        "Advanced lifecycle logic",
        "Expansion / retention modes",
        "CRM-ready integration layer",
        "Priority support",
        "AI-ready architecture",
      ],

      customerCtaOverrides: {
        onboarding: {
          label: "Plan je onboarding",
          href:  "/dashboard/onboarding",
          type:  "onboarding",
        },
        expansion: {
          label: "Activeer enrichments",
          href:  "/dashboard/upgrade?from=pro&to=pro-credits",
          type:  "expansion",
        },
      },
    },
  ],

  // ── Enrichment credits ──────────────────────────────────────────────────────

  enrichmentSection: {
    headline: "Gebruik extra data als je die nodig hebt",
    text:
      "Enrichments zoals bedrijfsherkenning, geolocatie of CRM-matching werken op basis van credits. " +
      "Je site blijft altijd werken, ook zonder credits.",
    adminConfigurable: true, // Prices can be overridden from admin billing catalog
    bundles: [
      {
        credits:       1000,
        priceEur:      10,
        billingEnvKey: "STRIPE_PRICE_CREDITS_100",
      },
      {
        credits:       5000,
        priceEur:      40,
        isPopular:     true,
        billingEnvKey: "STRIPE_PRICE_CREDITS_500",
      },
      {
        credits:       20000,
        priceEur:      120,
        billingEnvKey: "STRIPE_PRICE_CREDITS_1000",
      },
    ],
    examples: [
      { action: "IP bedrijfsherkenning", credits: 1 },
      { action: "CRM match",             credits: 2 },
      { action: "AI verrijking",         credits: 3 },
    ],
  },
};

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the PricingPlanCard for a given plan key from the canonical table.
 */
export function getPricingPlan(key: PricingPlanKey): PricingPlanCard | undefined {
  return SAAS_PRICING_TABLE.plans.find((p) => p.key === key);
}

/**
 * Returns all plans in tier order (Starter → Growth → Pro).
 */
export function getOrderedPricingPlans(): readonly PricingPlanCard[] {
  return SAAS_PRICING_TABLE.plans;
}

/**
 * Returns the recommended plan (isRecommended === true).
 * Returns the middle plan if none is marked as recommended.
 */
export function getRecommendedPlan(): PricingPlanCard {
  const plans = SAAS_PRICING_TABLE.plans;
  return plans.find((p) => p.isRecommended) ?? plans[Math.floor(plans.length / 2)];
}
