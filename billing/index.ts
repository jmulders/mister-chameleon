/**
 * billing/index.ts — Public API barrel
 *
 * The stable import surface for the billing module.
 *
 * ─── What is exported ────────────────────────────────────────────────────────
 *
 *   Types     → all shared billing types (client-safe)
 *   Format    → pure formatting and display helpers (client-safe)
 *   Plans     → plan/bundle definitions and lookup helpers
 *   Calculator → billing estimation (pure, no DB/Stripe)
 *
 * ─── What is NOT exported (import directly) ──────────────────────────────────
 *
 *   billing/usage.ts  — server-only DB operations (Supabase)
 *   billing/stripe.ts — server-only Stripe SDK operations
 *
 *   These files are intentionally excluded from the barrel to prevent
 *   accidental bundling into client components.  Import them directly:
 *
 *     import { getUsageSummary }      from "@/billing/usage";
 *     import { createCheckoutSession } from "@/billing/stripe";
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Types — anywhere
 *   import type { BillingPlan, UsageSummary, BillingEstimate } from "@/billing";
 *
 *   // Formatting — anywhere (client-safe)
 *   import { formatCents, creditUsagePercent } from "@/billing";
 *
 *   // Plan data — server or client (Stripe Price IDs will be null on client)
 *   import { BILLING_PLANS, CREDIT_BUNDLES, getPlan } from "@/billing";
 *
 *   // Calculations — server or client (pure functions)
 *   import { calculateBillingEstimate } from "@/billing";
 */

// ── Types ─────────────────────────────────────────────────────────────────────
// Client-safe: no logic, no env vars, no SDK imports
export type {
  BillingPlanId,
  BillingCycle,
  SubscriptionStatus,
  BillingPlan,
  CreditBundle,
  BillingLineItem,
  BillingEstimate,
  CreditTxType,
  CreditTransaction,
  CreditBalance,
  UsageSummary,
  DeductionResult,
} from "./types";

// ── Formatting ────────────────────────────────────────────────────────────────
// Client-safe: pure functions only
export {
  formatCents,
  annualSavingPercent,
  creditUsagePercent,
  shouldWarnOverage,
  daysRemainingInPeriod,
} from "./format";

// ── Plans ─────────────────────────────────────────────────────────────────────
// Note: stripePriceIds are null on the client (server-only env vars)
export {
  BILLING_PLANS,
  CREDIT_BUNDLES,
  getPlan,
  findPlan,
  isValidPlanId,
} from "./plans";

// ── Calculator ────────────────────────────────────────────────────────────────
// Pure: no DB, no Stripe SDK, safe everywhere
export {
  calculateBillingEstimate,
} from "./calculator";

// ── Usage event types (client-safe type exports only) ─────────────────────────
// The usage-events.ts module is server-only (DB access).
// Import server functions directly: import { trackUsageEvent } from "@/billing/usage-events";
export type {
  UsageEventType,
  UsageEventInput,
  UsageEvent,
  UsageEventSummary,
  UsageEventBreakdownItem,
} from "./types";

// ── Credit model (client-safe) ────────────────────────────────────────────────
// Core credit categories, EVENT_CATEGORY map, fallback modes, and formatters.
export type {
  CreditCategory,
  FallbackMode,
  CreditSettings,
  CategoryUsageSummary,
} from "./credits";
export {
  CREDIT_CATEGORIES,
  EVENT_CATEGORY,
  FALLBACK_MODES,
  CREDIT_SETTINGS_DEFAULTS,
  computeCategoryBreakdown,
  getEffectiveMode,
  estimateSavings,
  fmtCredits,
  creditsToEuro,
} from "./credits";

// ── Static pricing defaults (client-safe) ─────────────────────────────────────
// Dynamic DB functions (getCreditPricingRow, getAllActivePricing) are server-only.
// Import them directly: import { getCreditPricingRow } from "@/billing/pricing";
export type { StaticPricingEntry } from "./pricing";
export {
  CREDIT_PRICING_DEFAULTS,
  PRICING_FEATURE_KEYS,
  getStaticCustomerPrice,
  getStaticInternalCost,
  getStaticCategory,
  getStaticMarginPercent,
} from "./pricing";

// ── Credit + wallet types (client-safe type exports only) ─────────────────────
export type {
  TenantWallet,
  WalletDebitResult,
  WalletGuardResult,
  CreditPricingRow,
  UsageSummaryRow,
} from "./types";

// ── Usage summary period helpers (client-safe) ────────────────────────────────
// DB query functions are server-only — import directly from @/billing/usage-summary.
export { currentPeriodKey, periodKeyFromDate } from "./usage-summary";
