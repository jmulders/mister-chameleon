/**
 * billing/types.ts
 *
 * All shared billing types — used by both server-side and client-side code.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   This file is safe to import in any context (server components, client
 *   components, API routes).  It contains only type definitions — no logic,
 *   no env var access, no Supabase/Stripe SDK imports.
 *
 * ─── Import pattern ───────────────────────────────────────────────────────────
 *
 *   import type { BillingPlan, UsageSummary } from "@/billing/types";
 *   // or from the barrel:
 *   import type { BillingPlan, UsageSummary } from "@/billing";
 */

// ── Stripe mode ────────────────────────────────────────────────────────────────

/**
 * Stripe operational mode — controls which API keys and customers are used.
 *
 *   live  — real Stripe keys (sk_live_…), real money. Default for all tenants.
 *   test  — Stripe test keys (sk_test_…), test customers, zero real charges.
 *
 * Distinct from WalletTestMode ("wallet_simulated") which skips Stripe entirely.
 * See billing/stripe-config.ts for the full mode model.
 */
export type StripeMode = "live" | "test";

/**
 * Safe summary of the Stripe configuration — passed from server to client UI.
 * Never contains actual key values.
 */
export interface StripeModeInfo {
  mode:                     StripeMode;
  isTest:                   boolean;
  isLive:                   boolean;
  testKeyPresent:           boolean;
  liveKeyPresent:           boolean;
  testWebhookSecretPresent: boolean;
  liveWebhookSecretPresent: boolean;
}

// ── Plan types ─────────────────────────────────────────────────────────────────

export type BillingPlanId = "starter" | "growth" | "pro";

export type BillingCycle = "monthly" | "annual";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface BillingPlan {
  id:          BillingPlanId;
  name:        string;
  description: string;

  /** Base monthly price in euro cents. */
  monthlyPriceCents: number;
  /** Base annual price in euro cents (total, not per-month). */
  annualPriceCents:  number;
  /** Effective monthly cost when billed annually (annualPriceCents / 12). */
  annualMonthlyCents: number;

  /**
   * @deprecated Plans no longer include a monthly credit allowance.
   * Credits are purchased separately (Option B model).
   * Kept for backwards compatibility with pricing page display only.
   */
  includedCredits?:      number;
  /** @deprecated No overage billing — credits are a separate consumable. */
  overageCentPerCredit?: number;

  /**
   * Stripe Price IDs — resolved from environment variables at runtime.
   * These are undefined/null on the client (env vars are server-only).
   */
  stripePriceIds: {
    monthly: string | null;
    annual:  string | null;
  };

  /**
   * Feature flags — controls which premium capabilities are accessible.
   *
   * All plans have unlimited rules, segments, scoring rules, experiments, and
   * interest profiles.  Only genuinely premium capabilities are gated here.
   */
  features: {
    /** AI-augmented personalisation decisions (Growth+). */
    aiPersonalization:   boolean;
    /** CRM (HubSpot/Salesforce) and ABM (target-account list) enrichment (Growth+). */
    crmAbmEnrichment:    boolean;
    /** Custom decay profiles in behavioural scoring (Growth+). */
    customDecayProfiles: boolean;
    /** Agency multi-tenant management — single login across many tenants (Pro). */
    multiTenant:         boolean;
    /** Full analytics dashboard (Growth+). */
    analyticsDashboard:  boolean;
    /** Priority support channel (Pro). */
    prioritySupport:     boolean;
  };

  /**
   * Session-based soft cap.
   *
   * When a tenant exceeds personalizedSessionsPerMonth, subsequent requests
   * receive the default (unmodified) experience instead of personalised content.
   * No errors are thrown — it degrades gracefully.
   *
   * 0 = unlimited (used internally for Pro+ enterprise overrides).
   */
  limits: {
    /** Max unique visitor sessions that receive personalised content per calendar month. */
    personalizedSessionsPerMonth: number;
  };
}

export interface CreditBundle {
  /** Stable machine-readable ID used in checkout metadata, e.g. "credits_250". */
  id:           string;
  /** Display label, e.g. "250 Credits". */
  label:        string;
  credits:      number;
  /** Price in euro cents. */
  priceCents:   number;
  /**
   * Stripe Price ID — resolved from env vars at runtime.
   * Undefined on the client (env vars are server-only).
   */
  stripePrice?: string;
}

/**
 * A session credit bundle — additional personalised sessions a tenant can
 * purchase on top of their monthly plan allowance.
 *
 * Sessions purchased never expire; they roll over until consumed.
 * One session credit = one unique personalised visitor session beyond the
 * monthly plan cap.
 *
 * Pricing rationale (per 1 K sessions):
 *   Starter plan   €5.96 / 1K  (most expensive — small plan, many features included)
 *   Growth plan    €2.33 / 1K
 *   Pro plan       €1.50 / 1K
 *   Top-up credits €2.49 / 1K  (between Growth and Starter; upgrading Pro is better value for heavy users)
 */
export interface SessionCreditBundle {
  /** Stable machine-readable ID, e.g. "sessions_10k". */
  id:              string;
  /** Display label, e.g. "10,000 Sessions". */
  label:           string;
  /** Number of additional sessions purchased. */
  sessions:        number;
  /** Price in euro cents. */
  priceCents:      number;
  /** Effective rate per 1,000 sessions in euro cents (for display). */
  centsPerThousand: number;
  /**
   * Stripe Price ID — resolved from env vars at runtime.
   * Undefined on the client (env vars are server-only).
   */
  stripePrice?:    string;
}

// ── Calculator types ───────────────────────────────────────────────────────────

export interface BillingLineItem {
  label:      string;
  quantity:   number | null;
  unitCents:  number | null;
  totalCents: number;
  /** true for items that are estimated (not yet invoiced by Stripe). */
  isEstimate: boolean;
}

export interface BillingEstimate {
  tenantId:     string;
  planId:       BillingPlanId;
  billingCycle: BillingCycle;
  periodStart:  string | null;
  periodEnd:    string | null;

  lineItems:      BillingLineItem[];
  subtotalCents:  number;
  taxCents:       number;
  totalCents:     number;

  /** Human-readable formatted total (e.g. "€ 349,00"). */
  formattedTotal: string;

  /** true if the tenant is in overage this period. */
  hasOverage:     boolean;
  overageAlert?:  string;
}

// ── Usage / credit types ───────────────────────────────────────────────────────

export type CreditTxType = "purchase" | "deduction" | "grant" | "refund" | "expiry";

export interface CreditTransaction {
  id:              string;
  tenant_id:       string;
  type:            CreditTxType;
  /** Positive = added, negative = deducted. */
  amount:          number;
  balance_after:   number;
  stripe_event_id?: string | null;
  bundle_id?:      string | null;
  feature?:        string | null;
  description?:    string | null;
  created_at:      string;
}

export interface CreditBalance {
  tenant_id:  string;
  balance:    number;
  updated_at: string;
}

export interface UsageSummary {
  tenantId:         string;
  currentBalance:   number;
  /** The plan's included credit quota for this period. */
  includedCredits:  number;
  /** Credits consumed this period, capped at includedCredits (plan quota). */
  usedCredits:      number;
  /** Raw ledger debits this period — not capped; used for reconciliation. */
  deductedCredits:  number;
  /** Credits added via bundle purchases this period. */
  purchasedCredits: number;
  /** Credits consumed beyond the plan quota this period (billable overage). */
  overageCredits:   number;
  periodStart:      string | null;
  periodEnd:        string | null;
}

export interface DeductionResult {
  success:      boolean;
  balanceAfter: number;
  error?:       string;
}

// ── Wallet types ───────────────────────────────────────────────────────────────

/**
 * Operational status of a tenant wallet.
 *
 *   active    — enrichment calls are allowed; balance is positive.
 *   suspended — balance depleted; billable enrichments are blocked until funds added.
 *   frozen    — admin-frozen; all enrichments blocked regardless of balance.
 */
export type WalletStatus = "active" | "suspended" | "frozen";

/**
 * Type of a wallet ledger entry.
 *
 *   top_up_manual       — funds added by tenant/admin (manual bank transfer or card charge).
 *   top_up_auto_reload  — funds added by automatic reload triggered by low balance.
 *   top_up_refund       — refund credited back to the wallet.
 *   enrichment_debit    — enrichment API call charged against the wallet.
 *   manual_adjustment   — admin correction (positive or negative amount).
 *   failed_reload       — auto-reload was attempted but payment failed.
 */
export type WalletEntryType =
  | "top_up_manual"
  | "top_up_auto_reload"
  | "top_up_refund"
  | "enrichment_debit"
  | "manual_adjustment"
  | "failed_reload"
  // ── Simulated entries (test_simulated mode only) ────────────────────────────
  // All simulated entries are prefixed [SIM] in their `note` field and use
  // these distinct entry_type values so they can never be confused with real
  // financial events in queries or reports.
  | "sim_top_up"        // simulated credit (set balance / add funds)
  | "sim_debit"         // simulated debit  (drain funds)
  | "sim_auto_reload"   // simulated successful auto-reload
  | "sim_failed_reload"; // simulated failed auto-reload

/**
 * Wallet operating mode.
 *
 *   live            — real money; real Stripe; default for all tenants.
 *   test_simulated  — no real charges; sim_* RPCs used; ledger entries marked [SIM].
 */
export type WalletTestMode = "live" | "test_simulated";

/**
 * Tenant wallet row — one per tenant.
 * Amounts are in euro cents (integer) — parallel NUMERIC column added by migration 076.
 */
export interface TenantWallet {
  tenant_id:                          string;
  balance_cents:                      number;
  /**
   * Current wallet balance in decimal credits (NUMERIC).
   * 1 credit = €0.01. Supports fractional credits (e.g. 97.2500).
   * Added by migration 076. NULL for wallets not yet updated.
   * Kept in sync with balance_cents by all wallet RPCs.
   */
  balance?:                           number;
  /**
   * Credits included by the active subscription plan.
   * Credits are a separate consumable — not reset per billing period.
   * Consumed before purchased_credits.
   * Added by migration 092.
   */
  subscription_credits?:              number;
  /**
   * Credits purchased via top-up bundles.
   * Never reset — roll over indefinitely.
   * Added by migration 092.
   */
  purchased_credits?:                 number;
  currency:                           string;
  status:                             WalletStatus;

  low_balance_threshold_cents:        number;

  /**
   * Maximum credits (= euro cents) the tenant may spend per calendar month.
   * 0 = no cap (unlimited spend). When exceeded, `fallback_mode` is engaged.
   */
  monthly_credit_cap_cents:           number;

  /**
   * Fallback mode engaged when monthly_credit_cap_cents is reached.
   *   full_adaptive — all enrichments enabled (unreachable as a fallback)
   *   smart_lite    — recognition only; Adaptation + Brainpower disabled
   *   default       — static content; no enrichments; zero cost
   */
  fallback_mode:                      "full_adaptive" | "smart_lite" | "default";

  auto_reload_enabled:                boolean;
  auto_reload_trigger_cents:          number;
  auto_reload_amount_cents:           number;
  auto_reload_monthly_limit_cents:    number;
  auto_reload_spent_this_month_cents: number;
  auto_reload_month_reset_at:         string | null;

  /**
   * Live-mode Stripe payment method ID (pm_…).
   * Used for auto-reload charges when STRIPE_MODE=live.
   */
  stripe_payment_method_id:           string | null;

  /**
   * Test-mode Stripe customer ID (cus_… from sk_test_… environment).
   * Stored separately from stripe_customer_id — never mixed with live IDs.
   * Populated when tenant uses Stripe test mode for top-ups or auto-reload.
   */
  stripe_test_customer_id:            string | null;

  /**
   * Test-mode Stripe payment method ID (pm_… from sk_test_… environment).
   * Stored separately — used only when STRIPE_MODE=test.
   */
  stripe_test_payment_method_id:      string | null;

  notify_email:                       boolean;
  notify_sms:                         boolean;
  notification_email:                 string | null;
  notification_phone:                 string | null;

  /**
   * Operating mode for this wallet.
   *   live            — real Stripe charges; production default.
   *   test_simulated  — simulated balance only; no real charges ever made.
   */
  test_mode:                          WalletTestMode;

  created_at:                         string;
  updated_at:                         string;
}

/**
 * A single wallet ledger entry row.
 * amount_cents is positive for credits (top-ups), negative for debits (spend).
 * amount / balance_after NUMERIC columns were added by migration 076.
 */
export interface WalletLedgerEntry {
  id:                   string;
  tenant_id:            string;
  entry_type:           WalletEntryType;
  /**
   * Credit category for this ledger entry.
   * Enrichment debits carry the Chameleon Credits category; top-ups use 'topup'.
   * NULL for legacy entries created before migration 051.
   */
  category:             "recognition" | "adaptation" | "brainpower" | "topup" | "refund" | "adjustment" | null;
  /**
   * Credits moved by this entry (NUMERIC, added by migration 076).
   * Negative for debits, positive for credits.
   * Supports sub-credit precision (e.g. -0.2500).
   * NULL for entries created before migration 076.
   */
  amount?:              number;
  /** Legacy integer alias (euro cents). Kept in sync with amount. */
  amount_cents:         number;
  /**
   * Wallet balance in credits after this entry (NUMERIC, added by migration 076).
   * NULL for entries created before migration 076.
   */
  balance_after?:       number;
  /** Legacy integer alias (euro cents). Kept in sync with balance_after. */
  balance_after_cents:  number;
  reference_type:       string | null;
  reference_id:         string | null;
  note:                 string | null;
  /**
   * TRUE for ledger entries written in test_simulated wallet mode.
   * Simulated entries are clearly distinguished from real financial events.
   */
  simulated:            boolean;
  created_at:           string;
}

/**
 * Result of a wallet debit operation.
 *
 * balanceAfter is in decimal credits (1 credit = €0.01), matching the NUMERIC
 * column added by migration 076.  The debit_wallet RPC returns NUMERIC directly.
 */
export interface WalletDebitResult {
  success:       boolean;
  /**
   * New wallet balance in decimal credits after the debit.
   * 1 credit = €0.01.  Supports fractional precision (e.g. 97.2500).
   */
  balanceAfter:  number;
  error?:        "insufficient_balance" | "wallet_not_active" | "wallet_not_found" | "unknown";
}

/**
 * Extended wallet state returned by the `get_wallet_state` RPC (migration 055).
 *
 * Extends TenantWallet with pre-computed spend summaries and boolean flags so
 * the billing page can retrieve everything it needs in a single round-trip.
 *
 * Additional fields over TenantWallet:
 *   is_low_balance          — balance < low_balance_threshold_cents (and threshold > 0)
 *   has_payment_method      — stripe_payment_method_id IS NOT NULL
 *   spend_today_cents       — wallet debits since midnight UTC
 *   spend_this_month_cents  — wallet debits since the 1st of the current month
 *   period_spend_cents      — wallet debits since billing period start
 *   period_start            — billing period start (from subscriptions, or month start)
 *   period_end              — billing period end (from subscriptions, or null)
 */
export interface WalletState extends TenantWallet {
  is_low_balance:         boolean;
  has_payment_method:     boolean;
  spend_today_cents:      number;
  spend_this_month_cents: number;
  period_spend_cents:     number;
  period_start:           string | null;
  period_end:             string | null;
}

// ── Reload attempt types ────────────────────────────────────────────────────────

/**
 * Lifecycle state of a single wallet auto-reload attempt.
 *
 *   pending          — attempt row created; Stripe PaymentIntent not yet created
 *   processing       — Stripe PaymentIntent created; awaiting webhook confirmation
 *   succeeded        — payment confirmed; wallet credited
 *   failed           — payment failed; wallet NOT credited
 *   action_required  — 3DS / SCA authentication needed from the tenant
 *   cancelled        — abandoned (monthly cap exceeded after intent was created)
 */
export type ReloadAttemptStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "action_required"
  | "cancelled";

/**
 * A single wallet_reload_attempts row.
 *
 * One row is created for every auto-reload trigger event.  The row tracks
 * the attempt from creation through Stripe confirmation.
 *
 * Uniqueness guarantee: at most ONE row with status IN ('pending', 'processing')
 * can exist per tenant_id at any time (enforced by DB partial unique index).
 */
export interface WalletReloadAttempt {
  id:                         string;
  tenant_id:                  string;
  trigger_balance_cents:      number;
  reload_amount_cents:        number;
  status:                     ReloadAttemptStatus;
  idempotency_key:            string;
  stripe_payment_intent_id:   string | null;
  failure_reason:             string | null;
  created_at:                 string;
  updated_at:                 string;
}

/**
 * Result of the pre-call wallet guard check.
 */
export interface WalletGuardResult {
  /** Whether billable enrichments should be blocked for this request. */
  blocked:      boolean;
  /** Machine-readable reason for the block. */
  blockReason?: "insufficient_balance" | "wallet_suspended" | "wallet_frozen" | "monthly_cap_exceeded";
  /** Current wallet balance in cents at time of check. */
  balanceCents: number;
  /**
   * When blockReason = "monthly_cap_exceeded", the fallback mode the caller
   * should apply (from tenant_wallets.fallback_mode).
   */
  fallbackMode?: "full_adaptive" | "smart_lite" | "default";
  /** Month-to-date spend in cents (populated when cap is configured). */
  mtdSpendCents?: number;
  /** Monthly credit cap in cents (populated when cap is configured). */
  capCents?: number;
}

/**
 * An enrichment_usage row — per-call activity log, cents-based.
 */
export interface EnrichmentUsageRecord {
  id:                string;
  tenant_id:         string;
  enrichment_type:   string;
  quantity:          number;
  unit_price_cents:  number;
  total_price_cents: number;
  cache_hit:         boolean;
  billable:          boolean;
  wallet_blocked:    boolean;
  success:           boolean;
  error_code:        string | null;
  request_id:        string | null;
  idempotency_key:   string | null;
  metadata:          Record<string, unknown>;
  created_at:        string;
}

/**
 * Per-type enrichment spend summary over a time window.
 */
export interface EnrichmentUsageSummaryRow {
  enrichment_type:    string;
  call_count:         number;
  success_count:      number;
  failure_count:      number;
  cache_hit_count:    number;
  fresh_call_count:   number;
  blocked_count:      number;
  total_price_cents:  number;
}

/**
 * Auto-reload execution result.
 */
export interface AutoReloadResult {
  success:        boolean;
  amountCents?:   number;
  newBalance?:    number;
  error?:         string;
}

// ── Webhook event types ────────────────────────────────────────────────────────

/**
 * A single row from wallet_webhook_events — the Stripe webhook audit log.
 *
 * One row per Stripe event delivery.  The unique constraint on stripe_event_id
 * ensures idempotent recording (duplicate deliveries are silently ignored).
 */
export interface WalletWebhookEvent {
  id:              string;
  stripe_event_id: string;
  event_type:      string;
  livemode:        boolean;
  tenant_id:       string | null;
  handled:         boolean;
  action:          string | null;
  error:           string | null;
  received_at:     string;
}

/**
 * Enrichment pricing row from the enrichment_pricing table.
 */
export interface EnrichmentPricingRow {
  enrichment_type:  string;
  unit_price_cents: number;
  display_name:     string;
  description:      string | null;
  billable:         boolean;
  updated_at:       string;
}

// ── Usage event types ──────────────────────────────────────────────────────────

/**
 * Every billable enrichment action type.
 *
 * One credit = one successful live enrichment API call.
 * Cache hits and failed calls cost 0 credits (see creditsCost / cacheHit on UsageEventInput).
 *
 * ─── Credit costs ─────────────────────────────────────────────────────────────
 *   1 credit  — ip_enrich, reverse_geocode, weather_enrich, company_lookup,
 *               leadinfo_lookup, intent_enrich
 *   2 credits — ga4_history, crm_lookup  (hit external quota-constrained APIs)
 *
 * See billing/enrichment-pricing.ts for the authoritative per-type pricing.
 */
export type UsageEventType =
  | "leadinfo_lookup"   // Leadinfo B2B company identification (client-side API, 1 credit per match)
  | "ip_enrich"         // IPinfo Lite geolocation + network enrichment (1 credit)
  | "weather_enrich"    // Open-Meteo weather context enrichment (1 credit)
  | "intent_enrich"     // Intent / behavioural signal enrichment (1 credit)
  | "crm_lookup"        // HubSpot / Salesforce CRM contact + company lookup (2 credits)
  | "reverse_geocode"   // Reverse geocode: lat/lng → address (LocationIQ / BigDataCloud, 1 credit)
  | "ga4_history"       // Google Analytics 4 visitor history lookup (2 credits)
  | "company_lookup";   // Reverse-IP firmographic lookup (OpenKvK / Clearbit, 1 credit)

/**
 * Input for recording a single usage event.
 */
export interface UsageEventInput {
  tenantId:             string;
  eventType:            UsageEventType;
  /** Number of units consumed — almost always 1 unless batched. */
  quantity?:            number;
  /** Credits charged for this event (0 for free/cached calls). Customer-facing amount. */
  creditsCost:          number;
  /**
   * Fractional credits deducted from the wallet.
   * Supports sub-cent precision (e.g. 0.25 credits).
   * Defaults to creditsCost when absent.
   */
  creditsUsed?:         number;
  /**
   * EUR price charged for this event (supports fractions: 0.001, 0.030).
   * Stored in usage_events.price. Defaults to creditsCost / 100 when absent.
   */
  price?:               number;
  /**
   * Whether this stage was intended to be billed.
   * false = cache hit, free tier, or pre-flight block.
   * Defaults to true.
   */
  billable?:            boolean;
  /**
   * Actual provider cost in euro cents.
   * May be lower than creditsCost (margin) or absent when unknown.
   * Stored in usage_events.internal_cost_cents for margin analysis.
   */
  internalCostCents?:   number;
  /**
   * Chameleon Credits category for this event.
   * Defaults to the value from EVENT_CATEGORY[eventType] in billing/credits.ts.
   */
  category?:            "recognition" | "adaptation" | "brainpower";
  /**
   * Feature key — matches credit_pricing.feature_key.
   * Defaults to eventType when not explicitly supplied.
   */
  featureKey?:          string;
  /** Whether the underlying enrichment call succeeded. */
  success:              boolean;
  /**
   * True when the result was served from an in-process ProviderCache with no
   * external API call.  Cache hits always have creditsCost = 0.
   * Defaults to false when absent.
   */
  cacheHit?:            boolean;
  /** Machine-readable error code when success=false, e.g. "rate_limited". */
  errorCode?:           string;
  /** Visitor session ID for correlating enrichment with visitor behaviour. */
  sessionId?:           string;
  /**
   * Stable key to prevent double-recording on retries.
   * Recommended pattern: `{eventType}:{tenantId}:{sessionId}`.
   * If omitted, the event is always inserted (no deduplication).
   */
  idempotencyKey?:      string;
  /** Event-specific structured metadata (company name, IP range, etc.). */
  metadata?:            Record<string, unknown>;
  /**
   * TRUE when recording in test_simulated wallet mode.
   * Simulated events are excluded from real usage summaries.
   */
  simulated?:           boolean;
}

/**
 * A single usage event row as returned from the DB.
 */
export interface UsageEvent {
  id:                   string;
  tenant_id:            string;
  event_type:           UsageEventType;
  quantity:             number;
  /** Customer-facing credit cost (= euro cents charged to wallet). Integer for backward compat. */
  credits_cost:         number;
  /**
   * Fractional credits deducted from the wallet.
   * Supports sub-cent precision (e.g. 0.25 credits).
   * Added by migration 068.
   */
  credits_used:         number;
  /**
   * EUR price charged for this event (supports fractions: 0.001, 0.030).
   * Added by migration 068.
   */
  price:                number;
  /**
   * Whether this stage was intended to be billed.
   * Added by migration 068.
   */
  billable:             boolean;
  /** Actual provider cost in euro cents — may differ from credits_cost. */
  internal_cost_cents:  number | null;
  /** Chameleon Credits category: recognition | adaptation | brainpower */
  category:             "recognition" | "adaptation" | "brainpower" | null;
  /** Feature key matching credit_pricing.feature_key (e.g. "ip_enrich"). */
  feature_key:          string | null;
  success:              boolean;
  /**
   * True when the result was served from the ProviderCache (no external API call).
   * credits_cost is 0 for all cache hits.
   */
  cache_hit:            boolean;
  error_code:           string | null;
  session_id:           string | null;
  idempotency_key:      string | null;
  metadata:             Record<string, unknown>;
  /** TRUE for events recorded in test_simulated mode (excluded from real summaries). */
  simulated:            boolean;
  created_at:           string;
}

// ── Credit pricing types ───────────────────────────────────────────────────────

/**
 * A row from the credit_pricing table.
 *
 * Tracks both what tenants are charged (customer_price_cents) and what the
 * platform pays providers (internal_cost_cents), enabling margin analysis.
 *
 * 1 customer credit = €0.01 = 1 euro cent.
 */
export interface CreditPricingRow {
  id:                   string;
  /** Feature or enrichment identifier — e.g. "ip_enrich", "hero_generation". */
  feature_key:          string;
  /** Chameleon Credits category: recognition | adaptation | brainpower */
  category:             "recognition" | "adaptation" | "brainpower";
  /** Credits charged to tenant per live API call (1 credit = 1 euro cent). */
  customer_price_cents: number;
  /** Actual provider cost per call in euro cents (optional; may be null). */
  internal_cost_cents:  number | null;
  /** Billing granularity: per_call | per_token | per_kb | per_request */
  billing_unit:         "per_call" | "per_token" | "per_kb" | "per_request";
  description:          string | null;
  active:               boolean;
  created_at:           string;
  updated_at:           string;
}

// ── Canonical enrichment pricing row (migration 065) ─────────────────────────

/**
 * A row from the `enrichment_pricing` table (migration 065).
 *
 * All monetary values in EUR (not cents) with up to 6 decimal places.
 * Replaces the legacy CreditPricingRow / credit_pricing table.
 *
 * unit_price   = EUR per call (e.g. 0.030000 = €0.03, 0.001000 = €0.001)
 * credit_cost  = credits deducted per call (e.g. 3.000 or fractional 0.250)
 * internal_cost = actual provider cost per call in EUR (for margin analysis)
 */
export interface EnrichmentPricingDbRow {
  id:              string;
  /** Canonical enrichment type key (e.g. "ip_enrich"). */
  enrichment_type: string;
  label:           string;
  category:        "recognition" | "adaptation" | "brainpower";
  /** EUR per successful live API call (supports fractions like 0.001000). */
  unit_price:      number;
  /** Credits deducted per call (supports fractions like 0.250). */
  credit_cost:     number;
  /** Actual provider cost in EUR per call (nullable). */
  internal_cost:   number | null;
  billing_unit:    "per_call" | "per_token" | "per_kb" | "per_request";
  description:     string | null;
  billable:        boolean;
  active:          boolean;
  created_at:      string;
  updated_at:      string;
}

/**
 * A row from the `billing_plans` table (migration 065 fractional schema).
 * All prices in EUR (not cents).
 */
export interface BillingPlanDbRow {
  plan_id:                  string;
  label:                    string;
  monthly_price:            number;
  yearly_price:             number;
  annual_monthly_price:     number;
  included_credits:         number;
  overage_price_per_credit: number;
  features:                 Record<string, boolean>;
  limits:                   Record<string, number>;
  stripe_monthly_price_id:  string | null;
  stripe_yearly_price_id:   string | null;
  active:                   boolean;
  sort_order:               number;
  created_at:               string;
  updated_at:               string;
}

/**
 * A row from the `billing_defaults` table (migration 065 fractional schema).
 * All threshold/amount values in EUR (not cents).
 */
export interface BillingDefaultsDbRow {
  id:                       string;
  currency:                 string;
  low_balance_threshold:    number;
  auto_reload_trigger:      number;
  auto_reload_amount:       number;
  monthly_auto_reload_cap:  number | null;
  updated_at:               string;
}

// ── Usage summary types ────────────────────────────────────────────────────────

/**
 * A row from the usage_summary VIEW.
 *
 * Aggregates usage_events by tenant × billing month × category × feature.
 * Excludes simulated (test mode) events.
 */
export interface UsageSummaryRow {
  tenant_id:             string;
  /** Billing month in YYYY-MM format, e.g. "2025-01". */
  period_key:            string;
  /** Credit category (or "unknown" for legacy events without category). */
  category:              string;
  /** Feature key (falls back to event_type when feature_key is NULL). */
  feature_key:           string;
  total_calls:           number;
  /** Calls that cost credits (live, successful, non-cached). */
  billable_calls:        number;
  cache_hit_calls:       number;
  /** Total credits charged to tenant for this group. */
  total_cost_cents:      number;
  /** Total actual provider cost (sum of internal_cost_cents). */
  internal_cost_cents_sum: number;
}

/**
 * Per-event-type breakdown within a time window.
 */
export interface UsageEventBreakdownItem {
  eventType:        UsageEventType;
  callCount:        number;
  successCount:     number;
  failureCount:     number;
  /** Calls that hit the ProviderCache (no external API call, 0 credits). */
  cacheHitCount:    number;
  /** Live external API calls (may have cost credits). */
  freshCallCount:   number;
  totalCredits:     number;
}

/**
 * Aggregated usage event summary for a tenant over a time period.
 */
export interface UsageEventSummary {
  tenantId:         string;
  periodStart:      string;
  periodEnd:        string;
  totalCalls:       number;
  totalCredits:     number;
  successCalls:     number;
  failureCalls:     number;
  /** Calls served from ProviderCache (0 credits). */
  cacheHitCalls:    number;
  /** Live external API calls (may have deducted credits). */
  freshCallCount:   number;
  breakdown:        UsageEventBreakdownItem[];
}
