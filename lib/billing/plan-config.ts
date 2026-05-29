/**
 * Canonical Plan Billing Config
 *
 * Bridges the pricing table content model (lib/pricing/pricing-table.ts) and
 * the Stripe price ID resolver (lib/billing/plan-map.ts) without either file
 * depending on the other.
 *
 * ─── Responsibilities ─────────────────────────────────────────────────────────
 *
 *   This file owns:
 *     • The CTA strategy for each plan (which flow type to use by default)
 *     • Whether direct checkout is supported for a given plan
 *     • The checkout API URL builder (plan + cycle → safe checkout href)
 *     • A guard that returns a demo href if Stripe is not configured
 *
 *   It does NOT own:
 *     • Stripe SDK calls (those live in lib/billing/stripe-client.ts)
 *     • Stripe session creation (that lives in the /api/billing/checkout route)
 *     • Plan display content (that lives in lib/pricing/pricing-table.ts)
 *
 * ─── CTA strategy ─────────────────────────────────────────────────────────────
 *
 *   Each plan has a default CTA strategy. The adaptive experience engine may
 *   override this via ExperiencePlan.pricingCtaMode, which shifts the CTA
 *   emphasis without changing which plan is shown.
 *
 *   Plan     Default strategy       Can switch to checkout?
 *   ──────   ─────────────────      ───────────────────────
 *   starter  trial (free signup)    Yes — when ENABLE_DIRECT_CHECKOUT=true
 *   growth   demo (book a call)     Yes — when ENABLE_DIRECT_CHECKOUT=true
 *   pro      demo (book a call)     Yes — when ENABLE_DIRECT_CHECKOUT=true
 *
 * ─── Switching from demo-first to checkout-first ──────────────────────────────
 *
 *   Set environment variable: ENABLE_DIRECT_CHECKOUT=true
 *   This changes the default CTA strategy for all plans to "checkout".
 *   Starter keeps its trial CTA unless STARTER_DIRECT_CHECKOUT=true.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   lib/billing/plan-map.ts     → Stripe price ID resolution (env vars)
 *   lib/billing/plan-config.ts  ← YOU ARE HERE — CTA strategy + checkout URL
 *   lib/billing/billing-store.ts → Billing state management
 *   lib/pricing/pricing-table.ts → Plan content (features, prices, copy)
 */

import type { PricingPlanKey, PricingBillingCycle, CTAFlowType } from "@/lib/pricing/pricing-table";
import type { BillingCycle } from "@/lib/billing/plan-map";

// ── Checkout feature flag ──────────────────────────────────────────────────────

/**
 * Returns true when direct Stripe Checkout is enabled for this deployment.
 *
 * Controlled by the ENABLE_DIRECT_CHECKOUT environment variable.
 * When false (default), all plans default to demo or trial CTA flows.
 * When true, plans default to checkout flows (where Stripe env vars are set).
 *
 * This allows the checkout strategy to be switched at deploy time without
 * code changes — useful for A/B testing demo-first vs checkout-first funnels.
 */
export function isDirectCheckoutEnabled(): boolean {
  return process.env.ENABLE_DIRECT_CHECKOUT === "true";
}

/**
 * Returns true when the Starter plan is configured for direct checkout.
 *
 * Starter defaults to a free trial flow. To enable direct Stripe checkout for
 * Starter, set both ENABLE_DIRECT_CHECKOUT=true and STARTER_DIRECT_CHECKOUT=true.
 */
export function isStarterDirectCheckoutEnabled(): boolean {
  return isDirectCheckoutEnabled() && process.env.STARTER_DIRECT_CHECKOUT === "true";
}

// ── CTA strategy per plan ─────────────────────────────────────────────────────

/**
 * The default CTA flow strategy for a plan, considering deployment configuration.
 *
 * This is the flow used when no adaptive override (pricingCtaMode) is in effect.
 * The adaptive engine may override this per visitor — e.g. switching to "trial"
 * when pricingCtaMode="trial" is set by the trial-ready rule.
 */
export function getDefaultPlanCtaStrategy(planKey: PricingPlanKey): CTAFlowType {
  switch (planKey) {
    case "starter":
      return isStarterDirectCheckoutEnabled() ? "checkout" : "trial";
    case "growth":
    case "pro":
      return isDirectCheckoutEnabled() ? "checkout" : "demo";
  }
}

// ── Checkout URL builder ───────────────────────────────────────────────────────

/**
 * Converts a PricingBillingCycle to the BillingCycle used in plan-map.ts.
 *
 * Pricing table uses "yearly"; plan-map uses "annual". This is the translation
 * bridge between the two naming conventions.
 */
export function toPlanMapCycle(cycle: PricingBillingCycle): BillingCycle {
  return cycle === "yearly" ? "annual" : "monthly";
}

/**
 * Builds the safe checkout initiation URL for a plan + billing cycle.
 *
 * This URL points to the /api/billing/checkout route, which:
 *   1. Resolves the Stripe price ID via getSubscriptionPriceId()
 *   2. Creates a Stripe Checkout Session
 *   3. Redirects to the Stripe-hosted checkout page
 *
 * The UI does NOT need to know the Stripe price ID — it only knows this URL.
 * This keeps Stripe configuration confined to the server-side API route.
 *
 * If direct checkout is not enabled or Stripe is not configured, the component
 * should fall back to the demo href. The API route itself returns a 400 with
 * a clear error if Stripe env vars are missing.
 */
export function buildCheckoutHref(
  planKey: PricingPlanKey,
  cycle:   PricingBillingCycle,
): string {
  const cycleParam = toPlanMapCycle(cycle);
  return `/api/billing/checkout?plan=${planKey}&cycle=${cycleParam}`;
}

/**
 * Builds the credit bundle purchase URL for a given bundle ID.
 *
 * Points to the /api/billing/credits route which creates a one-time
 * Stripe Checkout Session for the credit bundle.
 */
export function buildCreditPurchaseHref(bundleId: string): string {
  return `/api/billing/credits?bundle=${bundleId}`;
}

// ── Adaptive CTA resolution ────────────────────────────────────────────────────

/**
 * Plan-specific CTA descriptor resolved for a visitor's adaptive context.
 *
 * The adaptive engine sets pricingCtaMode on the ExperiencePlan.
 * This function translates that mode + plan into a concrete label + href.
 *
 * Used by the pricing table component to render the right CTA per plan per visitor.
 */
export interface AdaptivePlanCta {
  label: string;
  href:  string;
  type:  CTAFlowType;
  /** True when this CTA suppresses the acquisition flow (customer lifecycle). */
  suppressesAcquisition: boolean;
}

/**
 * Labels by plan + adaptive mode. Written in Dutch (platform language).
 */
const ADAPTIVE_LABELS: Record<PricingPlanKey, Record<string, string>> = {
  starter: {
    trial:      "Gratis starten",
    demo:       "Bekijk demo",
    checkout:   "Abonnement starten",
    onboarding: "Plan je onboarding",
    expansion:  "Upgrade naar Growth",
    none:       "",
  },
  growth: {
    trial:      "Probeer Growth",
    demo:       "Plan demo",
    checkout:   "Growth activeren",
    onboarding: "Plan je onboarding",
    expansion:  "Upgrade naar Pro",
    none:       "",
  },
  pro: {
    trial:      "Probeer Pro",
    demo:       "Plan demo",
    checkout:   "Pro activeren",
    onboarding: "Plan je onboarding",
    expansion:  "Activeer enrichments",
    none:       "",
  },
};

/**
 * Resolves the adaptive CTA for a plan given the visitor's pricingCtaMode.
 *
 * @param planKey   The subscription plan.
 * @param ctaMode   From ExperiencePlan.pricingCtaMode (e.g. "trial", "demo", "onboarding").
 * @param cycle     The billing cycle currently selected in the UI.
 */
export function resolveAdaptivePlanCta(
  planKey: PricingPlanKey,
  ctaMode: string | undefined,
  cycle:   PricingBillingCycle = "monthly",
): AdaptivePlanCta {
  const mode = ctaMode ?? "demo";
  const label = ADAPTIVE_LABELS[planKey][mode] ?? ADAPTIVE_LABELS[planKey]["demo"];

  switch (mode) {
    case "onboarding":
      return {
        label,
        href:                  "/dashboard/onboarding",
        type:                  "onboarding",
        suppressesAcquisition: true,
      };

    case "expansion": {
      const expansionTargets: Record<PricingPlanKey, string> = {
        starter: "/dashboard/upgrade?from=starter&to=growth",
        growth:  "/dashboard/upgrade?from=growth&to=pro",
        pro:     "/dashboard/upgrade?from=pro&to=pro-credits",
      };
      return {
        label,
        href:                  expansionTargets[planKey],
        type:                  "expansion",
        suppressesAcquisition: true,
      };
    }

    case "trial":
      return {
        label,
        href:                  `/registreren?plan=${planKey}`,
        type:                  "trial",
        suppressesAcquisition: false,
      };

    case "checkout":
      return {
        label,
        href:                  buildCheckoutHref(planKey, cycle),
        type:                  "checkout",
        suppressesAcquisition: false,
      };

    case "none":
      return {
        label:                 "",
        href:                  "",
        type:                  "demo",
        suppressesAcquisition: true,
      };

    case "demo":
    default:
      return {
        label,
        href:                  "/demo",
        type:                  "demo",
        suppressesAcquisition: false,
      };
  }
}

// ── Plan config index ──────────────────────────────────────────────────────────

/**
 * Static plan billing config — metadata about each plan's billing behavior.
 * Does not include Stripe price IDs (those are in env vars / plan-map.ts).
 */
export interface PlanBillingConfig {
  planKey:               PricingPlanKey;
  defaultCtaStrategy:    CTAFlowType;
  supportsDirectCheckout: boolean;
  supportsFreeTrial:     boolean;
  /** The Stripe env var keys for monthly and annual prices. */
  stripeEnvKeys: { monthly: string; annual: string };
}

/**
 * All plan billing configs, indexed by plan key.
 *
 * Use this for programmatic plan lookup without UI concerns.
 * Content/display data stays in SAAS_PRICING_TABLE (pricing-table.ts).
 */
export const PLAN_BILLING_CONFIGS: Record<PricingPlanKey, PlanBillingConfig> = {
  starter: {
    planKey:                "starter",
    defaultCtaStrategy:     "trial",
    supportsDirectCheckout: true,
    supportsFreeTrial:      true,
    stripeEnvKeys: {
      monthly: "STRIPE_PRICE_STARTER_MONTHLY",
      annual:  "STRIPE_PRICE_STARTER_ANNUAL",
    },
  },
  growth: {
    planKey:                "growth",
    defaultCtaStrategy:     "demo",
    supportsDirectCheckout: true,
    supportsFreeTrial:      false,
    stripeEnvKeys: {
      monthly: "STRIPE_PRICE_GROWTH_MONTHLY",
      annual:  "STRIPE_PRICE_GROWTH_ANNUAL",
    },
  },
  pro: {
    planKey:                "pro",
    defaultCtaStrategy:     "demo",
    supportsDirectCheckout: true,
    supportsFreeTrial:      false,
    stripeEnvKeys: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY",
      annual:  "STRIPE_PRICE_PRO_ANNUAL",
    },
  },
};

/**
 * Returns the billing config for a given plan key.
 */
export function getPlanBillingConfig(planKey: PricingPlanKey): PlanBillingConfig {
  return PLAN_BILLING_CONFIGS[planKey];
}
