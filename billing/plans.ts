/**
 * billing/plans.ts
 *
 * Billing plan and credit bundle definitions for Mister Chameleon.
 *
 * ─── Three plans ─────────────────────────────────────────────────────────────
 *
 *   starter   €149/mo — entry-level personalisation
 *   growth    €349/mo — campaigns, A/B, analytics
 *   pro       €749/mo — AI decisioning, full platform
 *
 * ─── Usage-based enrichment credits ─────────────────────────────────────────
 *
 *   Each plan includes a monthly credit allowance.
 *   One credit = one enrichment API call (IP lookup, weather, etc.).
 *   Overages are billed at the plan's overage rate.
 *
 * ─── Credit bundles (add-on purchases) ────────────────────────────────────────
 *
 *   Tenants can buy extra credits at any time via the billing panel.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   BILLING_PLANS and CREDIT_BUNDLES access process.env for Stripe Price IDs.
 *   These env vars are server-only (no NEXT_PUBLIC_ prefix) — they resolve to
 *   null/undefined in client bundles. This is intentional: client components
 *   only need plan metadata (name, price, features), not Stripe Price IDs.
 *
 *   If you need Stripe price IDs client-side for any reason, use API routes.
 *
 * ─── Formatting helpers ─────────────────────────────────────────────────────
 *
 *   Moved to billing/format.ts.  Re-exported here for backwards compatibility.
 */

import type { BillingPlanId, BillingCycle, BillingPlan, CreditBundle, SessionCreditBundle } from "./types";
import { getPlatformStripeSettings } from "@/platform/platform-store";

// Re-export types for consumers that import from this file
export type { BillingPlanId, BillingCycle, BillingPlan, CreditBundle, SessionCreditBundle };

// Re-export formatting helpers (moved to format.ts; re-exported here for backwards compat)
export { formatCents, annualSavingPercent } from "./format";

// ── Plan definitions ───────────────────────────────────────────────────────────
//
//   Three plans — differentiated by monthly personalised-session cap and
//   access to premium capabilities (AI, CRM/ABM, multi-tenant, decay profiles).
//
//   All plans have UNLIMITED: rules, experiments, interest profiles, scoring
//   rules, audience segments, and pages.  We charge for delivered value (a
//   personalised visitor session), not for configuration complexity.

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  starter: {
    id:          "starter",
    name:        "Starter",
    description: "Adaptive homepage personalisation for growing teams. Up to 25K personalised sessions/month.",

    monthlyPriceCents:  14900,   // €149/mo
    annualPriceCents:   148800,  // €1488/yr (€124/mo — 17% saving)
    annualMonthlyCents: 12400,

    stripePriceIds: {
      monthly: process.env["STRIPE_PRICE_STARTER_MONTHLY"] ?? null,
      annual:  process.env["STRIPE_PRICE_STARTER_ANNUAL"]  ?? null,
    },

    features: {
      aiPersonalization:   false,
      crmAbmEnrichment:    false,
      customDecayProfiles: false,
      multiTenant:         false,
      analyticsDashboard:  false,
      prioritySupport:     false,
    },

    limits: {
      personalizedSessionsPerMonth: 25_000,
    },
  },

  growth: {
    id:          "growth",
    name:        "Growth",
    description: "AI personalisation, CRM/ABM enrichment, and the full analytics dashboard. Up to 150K sessions/month.",

    monthlyPriceCents:  34900,   // €349/mo
    annualPriceCents:   334800,  // €3348/yr (€279/mo — 20% saving)
    annualMonthlyCents: 27900,

    stripePriceIds: {
      monthly: process.env["STRIPE_PRICE_GROWTH_MONTHLY"] ?? null,
      annual:  process.env["STRIPE_PRICE_GROWTH_ANNUAL"]  ?? null,
    },

    features: {
      aiPersonalization:   true,
      crmAbmEnrichment:    true,
      customDecayProfiles: true,
      multiTenant:         false,
      analyticsDashboard:  true,
      prioritySupport:     false,
    },

    limits: {
      personalizedSessionsPerMonth: 150_000,
    },
  },

  pro: {
    id:          "pro",
    name:        "Pro",
    description: "Full platform with agency multi-tenant management and priority support. Up to 500K sessions/month.",

    monthlyPriceCents:  74900,   // €749/mo
    annualPriceCents:   718800,  // €7188/yr (€599/mo — 20% saving)
    annualMonthlyCents: 59900,

    stripePriceIds: {
      monthly: process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? null,
      annual:  process.env["STRIPE_PRICE_PRO_ANNUAL"]  ?? null,
    },

    features: {
      aiPersonalization:   true,
      crmAbmEnrichment:    true,
      customDecayProfiles: true,
      multiTenant:         true,
      analyticsDashboard:  true,
      prioritySupport:     true,
    },

    limits: {
      // 0 = effectively unlimited; enforced as 500K in UI but overrideable per tenant
      personalizedSessionsPerMonth: 500_000,
    },
  },
};

// ── Credit bundles ─────────────────────────────────────────────────────────────

export const CREDIT_BUNDLES: CreditBundle[] = [
  {
    id:         "credits_250",
    label:      "250 Credits",
    credits:    250,
    priceCents: 650,  // €6.50 = €0.026/credit
    stripePrice: process.env["STRIPE_PRICE_CREDITS_250"] ?? undefined,
  },
  {
    id:         "credits_1000",
    label:      "1,000 Credits",
    credits:    1000,
    priceCents: 2200, // €22 = €0.022/credit
    stripePrice: process.env["STRIPE_PRICE_CREDITS_1000"] ?? undefined,
  },
  {
    id:         "credits_5000",
    label:      "5,000 Credits",
    credits:    5000,
    priceCents: 9900, // €99 = €0.02/credit
    stripePrice: process.env["STRIPE_PRICE_CREDITS_5000"] ?? undefined,
  },
];

// ── Session credit bundles ─────────────────────────────────────────────────────
//
//   Tenants can purchase additional personalised sessions beyond their monthly
//   plan allowance.  Purchased session credits never expire — they roll over
//   until consumed.
//
//   Pricing: €2.49 / 1K sessions (flat rate across all plans).
//   Upgrading to Pro is more cost-effective for tenants consistently needing
//   more than 50K extra sessions per month.
//
//   Rate comparison (per 1K sessions):
//     Starter plan:  €5.96 / 1K  (25K sessions for €149/mo)
//     Growth plan:   €2.33 / 1K  (150K sessions for €349/mo)
//     Pro plan:      €1.50 / 1K  (500K sessions for €749/mo)
//     Top-up (any):  €2.49 / 1K  ← purposely above Pro to incentivise upgrading

export const SESSION_CREDIT_BUNDLES: SessionCreditBundle[] = [
  {
    id:               "sessions_10k",
    label:            "10,000 Sessions",
    sessions:         10_000,
    priceCents:       2490,          // €24.90  — €2.49/1K
    centsPerThousand: 249,
    stripePrice:      process.env["STRIPE_PRICE_SESSIONS_10K"] ?? undefined,
  },
  {
    id:               "sessions_50k",
    label:            "50,000 Sessions",
    sessions:         50_000,
    priceCents:       9900,          // €99  — €1.98/1K (slight bulk discount)
    centsPerThousand: 198,
    stripePrice:      process.env["STRIPE_PRICE_SESSIONS_50K"] ?? undefined,
  },
  {
    id:               "sessions_200k",
    label:            "200,000 Sessions",
    sessions:         200_000,
    priceCents:       34900,         // €349  — €1.75/1K (best top-up rate)
    centsPerThousand: 175,
    stripePrice:      process.env["STRIPE_PRICE_SESSIONS_200K"] ?? undefined,
  },
];

// ── Resolved credit bundles (DB + env) ────────────────────────────────────────

/**
 * Returns credit bundles with Stripe Price IDs resolved from both the database
 * (platform_settings.stripe) and environment variables.
 *
 * Resolution order for each price ID (highest priority first):
 *   1. Environment variable  (STRIPE_PRICE_CREDITS_* — same source as dev/staging keys)
 *   2. platform_settings DB  (set via /admin/platform/integrations/stripe)
 *   3. undefined             (bundle shows as "Not configured" in UI)
 *
 * This is an async server-only function — never call from client components.
 * Use `CREDIT_BUNDLES` (sync, env-only) for build-time access.
 */
export async function getResolvedCreditBundles(): Promise<CreditBundle[]> {
  // Load DB price IDs — used as fallback when env vars are absent.
  let dbSettings: import("@/platform/platform-store").PlatformStripeSettings = {};
  try {
    const result = await getPlatformStripeSettings();
    if (result.ok) dbSettings = result.data;
  } catch {
    // Non-fatal — DB settings simply won't contribute
  }

  const resolve = (envVar: string, dbValue: string | undefined): string | undefined =>
    process.env[envVar] || dbValue || undefined;

  return [
    {
      id:          "credits_250",
      label:       "250 Credits",
      credits:     250,
      priceCents:  650,
      stripePrice: resolve("STRIPE_PRICE_CREDITS_250",  dbSettings.creditBundle250PriceId),
    },
    {
      id:          "credits_1000",
      label:       "1,000 Credits",
      credits:     1000,
      priceCents:  2200,
      stripePrice: resolve("STRIPE_PRICE_CREDITS_1000", dbSettings.creditBundle1000PriceId),
    },
    {
      id:          "credits_5000",
      label:       "5,000 Credits",
      credits:     5000,
      priceCents:  9900,
      stripePrice: resolve("STRIPE_PRICE_CREDITS_5000", dbSettings.creditBundle5000PriceId),
    },
  ];
}

// ── Resolved plan Stripe price IDs (DB + env) ─────────────────────────────────

/**
 * Resolve the Stripe Price ID for a plan + billing cycle.
 *
 * Resolution order (highest priority first):
 *   1. STRIPE_PRICE_<PLAN>_MONTHLY/ANNUAL env var       (production / CI)
 *   2. STRIPE_TEST_PRICE_<PLAN>_MONTHLY/ANNUAL env var  (test-mode local dev)
 *   3. platform_settings DB  (set via Admin → Integrations → Stripe)
 *   4. billing_plans DB table  (per-plan rows; mode-aware column selection)
 *   5. undefined — caller must handle a missing price gracefully
 *
 * Pass `mode` from resolveStripeCredentials() so the correct test/live source
 * is selected without requiring duplicate admin fields.
 *
 * Server-only async function — do not call from client components.
 */
export async function getResolvedPlanStripePriceId(
  planId:       string,
  billingCycle: "monthly" | "annual",
  mode?:        "live" | "test",
): Promise<string | undefined> {
  const suffix  = billingCycle === "annual" ? "ANNUAL" : "MONTHLY";
  const planUp  = planId.toUpperCase();

  // 1. Production env var (STRIPE_PRICE_STARTER_MONTHLY, etc.)
  const prodEnvKey = `STRIPE_PRICE_${planUp}_${suffix}`;
  if (process.env[prodEnvKey]) return process.env[prodEnvKey]!;

  // 2. Test-mode env var (STRIPE_TEST_PRICE_STARTER_MONTHLY, etc.)
  //    Accepted in both test and live mode so local .env.local configs work
  //    regardless of whether mode detection fired yet.
  const testEnvKey = `STRIPE_TEST_PRICE_${planUp}_${suffix}`;
  if (process.env[testEnvKey]) return process.env[testEnvKey]!;

  // 3. platform_settings DB (set via Admin → Integrations → Stripe dashboard)
  try {
    const result = await getPlatformStripeSettings();
    if (result.ok) {
      const db = result.data;
      // Map planId + cycle to the corresponding PlatformStripeSettings field
      const fieldMap: Record<string, string | undefined> = {
        starter_monthly: db.planStarterMonthlyPriceId,
        starter_annual:  db.planStarterAnnualPriceId,
        growth_monthly:  db.planGrowthMonthlyPriceId,
        growth_annual:   db.planGrowthAnnualPriceId,
        pro_monthly:     db.planProMonthlyPriceId,
        pro_annual:      db.planProAnnualPriceId,
      };
      const dbVal = fieldMap[`${planId}_${billingCycle}`];
      if (dbVal) return dbVal;
    }
  } catch {
    // Non-fatal — fall through to billing_plans table
  }

  // 4. billing_plans DB table (per-plan rows with separate live/test columns)
  try {
    const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseSrvc) return undefined;

    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(supabaseUrl, supabaseSrvc, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await db
      .from("billing_plans")
      .select("stripe_monthly_price_id, stripe_yearly_price_id, stripe_test_monthly_price_id, stripe_test_yearly_price_id")
      .eq("plan_id", planId)
      .maybeSingle();

    if (!data) return undefined;

    const row = data as Record<string, string | null>;

    // Prefer test-mode columns when mode=test, fall back to live columns if
    // the test column is empty (so plans with only live IDs still work in test).
    if (mode === "test") {
      const testCol = billingCycle === "annual" ? "stripe_test_yearly_price_id"  : "stripe_test_monthly_price_id";
      const liveCol = billingCycle === "annual" ? "stripe_yearly_price_id"        : "stripe_monthly_price_id";
      return row[testCol] ?? row[liveCol] ?? undefined;
    }

    const col = billingCycle === "annual" ? "stripe_yearly_price_id" : "stripe_monthly_price_id";
    return row[col] ?? undefined;
  } catch {
    // Non-fatal — DB lookup simply won't contribute.
    return undefined;
  }
}

// ── Plan helpers ───────────────────────────────────────────────────────────────

/**
 * Get a plan by ID.
 * Throws if the plan ID is unknown — use this in server-side code where an
 * invalid ID is a programming error, not a user error.
 */
export function getPlan(id: string): BillingPlan {
  const plan = BILLING_PLANS[id as BillingPlanId];
  if (!plan) throw new Error(`[billing] Unknown billing plan: "${id}". Valid: ${Object.keys(BILLING_PLANS).join(", ")}`);
  return plan;
}

/**
 * Get a plan by ID without throwing.
 * Returns null for unknown IDs — use this for user-supplied input.
 */
export function findPlan(id: string): BillingPlan | null {
  return BILLING_PLANS[id as BillingPlanId] ?? null;
}

/**
 * Whether a plan ID is valid.
 */
export function isValidPlanId(id: string): id is BillingPlanId {
  return id in BILLING_PLANS;
}
