/**
 * billing/copy.ts
 *
 * Canonical terminology and UI copy for the Chameleon Credits billing model.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────────
 *
 *   As the platform grows, billing concepts can be named inconsistently across
 *   the admin UI, pricing page, tenant-facing dashboard, emails, and debug logs.
 *   This file defines the canonical names, labels, and copy for every concept
 *   so the whole product speaks the same language.
 *
 * ─── Canonical terminology ────────────────────────────────────────────────────
 *
 *   The experience is called "Credits & Usage" in tenant-facing contexts and
 *   "Billing & Wallet" in admin contexts.  These are deliberate: tenants think
 *   in credits and usage, admins think in wallet balance and billing state.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   All exports are plain strings, objects, or pure functions.
 *   Safe to import in any context (server, client, edge, email templates).
 */

// ── Page / nav labels ──────────────────────────────────────────────────────────

/** Canonical tab labels (tenant-facing and admin contexts). */
export const LABELS = {
  // Primary page title variants
  PAGE_ADMIN:        "Billing & Wallet",
  PAGE_TENANT:       "Credits & Usage",

  // Tab labels
  TAB_CREDITS:       "Credits & Usage",
  TAB_WALLET:        "Wallet",
  TAB_HISTORY:       "History",
  TAB_SUBSCRIPTION:  "Plan",
  TAB_DEBUG:         "Debug",

  // Section headings (Credits & Usage tab)
  SECTION_BALANCE:         "Credit Balance",
  SECTION_CATEGORIES:      "Usage by Category",
  SECTION_FEATURES:        "Feature Breakdown",
  SECTION_BUDGET:          "Monthly Budget",
  SECTION_COST_CONTROLS:   "Cost Controls",

  // Section headings (Wallet tab)
  SECTION_PAYMENT:         "Payment & Stripe",
  SECTION_AUTO_RELOAD:     "Auto-Reload",
  SECTION_NOTIFICATIONS:   "Notifications",

  // Section headings (History tab)
  SECTION_LEDGER:          "Transaction History",

  // Primary product name
  PRODUCT:           "Chameleon Credits",
} as const;

// ── Wallet status ──────────────────────────────────────────────────────────────

export type WalletStatusKey =
  | "healthy"
  | "low"
  | "empty"
  | "suspended"
  | "frozen"
  | "cap_reached"
  | "no_wallet";

export interface WalletStatusDisplay {
  label:       string;
  description: string;
  /** Tailwind colour class for the badge background. */
  badgeBg:     string;
  /** Tailwind colour class for the badge text. */
  badgeText:   string;
  /** Tailwind colour class for the hero border. */
  heroBorder:  string;
  /** Tailwind colour class for the icon/accent. */
  accent:      string;
  /** Emoji icon. */
  icon:        string;
  /** Severity: 0=info, 1=warning, 2=error */
  severity:    0 | 1 | 2;
}

export const WALLET_STATUS: Record<WalletStatusKey, WalletStatusDisplay> = {
  healthy: {
    label:       "Healthy",
    description: "Your wallet is active and has sufficient credits.",
    badgeBg:     "bg-emerald-100",
    badgeText:   "text-emerald-700",
    heroBorder:  "border-emerald-200",
    accent:      "text-emerald-600",
    icon:        "✓",
    severity:    0,
  },
  low: {
    label:       "Low Balance",
    description: "Credits are running low. Consider topping up to avoid any interruption.",
    badgeBg:     "bg-amber-100",
    badgeText:   "text-amber-700",
    heroBorder:  "border-amber-300",
    accent:      "text-amber-600",
    icon:        "⚠",
    severity:    1,
  },
  empty: {
    label:       "Empty",
    description: "No credits remaining. Enrichments are paused until you top up.",
    badgeBg:     "bg-red-100",
    badgeText:   "text-red-700",
    heroBorder:  "border-red-300",
    accent:      "text-red-600",
    icon:        "✕",
    severity:    2,
  },
  suspended: {
    label:       "Suspended",
    description: "Wallet is suspended — enrichments are paused. Top up to reactivate.",
    badgeBg:     "bg-red-100",
    badgeText:   "text-red-700",
    heroBorder:  "border-red-300",
    accent:      "text-red-600",
    icon:        "⊘",
    severity:    2,
  },
  frozen: {
    label:       "Frozen",
    description: "Wallet has been frozen by an admin. Contact support to unlock.",
    badgeBg:     "bg-slate-200",
    badgeText:   "text-slate-700",
    heroBorder:  "border-slate-300",
    accent:      "text-slate-600",
    icon:        "❄",
    severity:    2,
  },
  cap_reached: {
    label:       "Budget cap reached",
    description: "Monthly spend limit has been reached. Fallback mode is now active.",
    badgeBg:     "bg-amber-100",
    badgeText:   "text-amber-700",
    heroBorder:  "border-amber-300",
    accent:      "text-amber-600",
    icon:        "◎",
    severity:    1,
  },
  no_wallet: {
    label:       "Not set up",
    description: "No wallet has been initialised for this account yet.",
    badgeBg:     "bg-neutral-100",
    badgeText:   "text-neutral-500",
    heroBorder:  "border-neutral-200",
    accent:      "text-neutral-400",
    icon:        "○",
    severity:    0,
  },
};

// ── Credit categories (customer-facing copy) ──────────────────────────────────

export interface CategoryCopy {
  label:           string;
  tagline:         string;
  /** Plain-language explanation for non-technical users. */
  explanation:     string;
  /** Comma list of features for the pricing page. */
  featuresShort:   string;
  /** Example features formatted as a readable list. */
  examplesLong:    string;
  /** Icon/emoji. */
  icon:            string;
  /** Cost label shown to tenants. */
  costLabel:       string;
  /** Tailwind colour token without prefix (bg-, text-, etc.). */
  color:           "blue" | "purple" | "orange";
}

export const CATEGORY_COPY: Record<"recognition" | "adaptation" | "brainpower", CategoryCopy> = {
  recognition: {
    label:       "Recognition",
    tagline:     "Know who's visiting",
    explanation: "Recognition helps Mister Chameleon understand who each visitor is — where they're from, what company they work for, and how they arrived. This is the foundation of personalisation.",
    featuresShort: "IP geo-location, company lookup, reverse geocode, B2B identification",
    examplesLong: "IP geo-location · Company & industry lookup · Reverse geocoding · B2B visitor identification via Leadinfo",
    icon:        "🔍",
    costLabel:   "3 credits per visitor",
    color:       "blue",
  },
  adaptation: {
    label:       "Adaptation",
    tagline:     "Choose the right experience",
    explanation: "Adaptation uses real-time signals — visitor intent, weather, device context — to pick the best version of your page. Low cost, high impact.",
    featuresShort: "Intent signals, weather context, device & session context",
    examplesLong: "Behavioural intent signals · Real-time weather context · Session engagement scoring",
    icon:        "🔄",
    costLabel:   "3 credits per visitor",
    color:       "purple",
  },
  brainpower: {
    label:       "Brainpower",
    tagline:     "Deep enrichment & AI",
    explanation: "Brainpower taps into external APIs and AI models to generate personalised content, match CRM records, and fetch analytics history. Higher value, higher cost — use it where it counts.",
    featuresShort: "CRM matching, GA4 history, AI-generated headlines, full blueprint generation",
    examplesLong: "CRM contact & company matching · GA4 session history · AI-generated headlines & CTAs · Full page blueprint generation",
    icon:        "🧠",
    costLabel:   "6–15 credits per visitor",
    color:       "orange",
  },
};

// ── Feature / enrichment names (customer-facing) ──────────────────────────────

export const FEATURE_NAMES: Record<string, string> = {
  ip_enrich:            "IP Geo-location",
  reverse_geocode:      "Reverse Geocode",
  company_lookup:       "Company Lookup",
  leadinfo_lookup:      "B2B Identification (Leadinfo)",
  intent_enrich:        "Intent Signals",
  weather_enrich:       "Weather Context",
  ga4_history:          "GA4 Visit History",
  crm_lookup:           "CRM Matching",
  hero_generation:      "AI Hero Generation",
  block_generation:     "AI Block Generation",
  blueprint_generation: "Blueprint Generation",
};

/**
 * Returns the human-friendly name for a feature key, or the raw key as fallback.
 * Safe to call with null, undefined, or empty string — returns "Unknown feature".
 */
export function featureName(key: string | null | undefined): string {
  if (!key) return "Unknown feature";
  return FEATURE_NAMES[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Ledger / transaction labels ────────────────────────────────────────────────

export const LEDGER_TYPE_LABELS: Record<string, string> = {
  top_up_manual:      "Manual top-up",
  top_up_auto_reload: "Auto-reload",
  top_up_grant:       "Credit grant",
  enrichment_debit:   "Enrichment usage",
  sim_debit:          "Simulated debit",
  sim_credit:         "Simulated credit",
  sim_top_up:         "Simulated top-up",
  refund:             "Refund",
  adjustment:         "Adjustment",
  failed_reload:      "Failed reload",
};

export function ledgerTypeLabel(entryType: string): string {
  return LEDGER_TYPE_LABELS[entryType] ?? entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Fallback mode labels (customer-facing) ────────────────────────────────────

export const FALLBACK_MODE_COPY: Record<string, { label: string; description: string; tag: string }> = {
  full_adaptive: {
    label:       "Full Adaptive",
    description: "All enrichments stay on. No interruption to personalisation.",
    tag:         "No limit enforced",
  },
  smart_lite: {
    label:       "Smart Lite",
    description: "Recognition keeps running, Adaptation and Brainpower pause. Visitors still get geo-personalisation at zero extra cost.",
    tag:         "Partial — Recognition only",
  },
  default: {
    label:       "Static Fallback",
    description: "All enrichments pause when the budget is reached. Pages show your default content. Zero credit cost.",
    tag:         "All enrichments paused",
  },
};

// ── Admin-facing anomaly / status labels ──────────────────────────────────────

export const ANOMALY_LABELS = {
  NO_STRIPE_SUBSCRIPTION:   "No Stripe subscription",
  NO_WALLET_INITIALIZED:    "Wallet not yet initialised",
  WALLET_SUSPENDED:         "Wallet suspended — enrichments paused",
  WALLET_FROZEN:            "Wallet frozen — admin action required",
  CREDITS_EXHAUSTED:        "Credits exhausted",
  MONTHLY_CAP_REACHED:      "Monthly budget cap reached — fallback mode active",
  ENRICHMENT_BLOCKED:       "Enrichments blocked by budget cap",
  SIMULATED_WALLET:         "Running in Simulated Wallet mode",
  STRIPE_TEST_MODE:         "Stripe is in Test mode — no real charges",
  STRIPE_LIVE_MODE:         "Stripe is in Live mode",
  AUTO_RELOAD_FAILED:       "Last auto-reload attempt failed",
  AUTO_RELOAD_NO_METHOD:    "Auto-reload enabled but no payment method linked",
  STRIPE_NOT_CONFIGURED:    "Stripe keys not configured",
  LOW_BALANCE:              "Balance below low-balance threshold",
};

// ── Empty state copy ───────────────────────────────────────────────────────────

export interface EmptyStateCopy {
  title:   string;
  body:    string;
  cta?:    string;
}

export const EMPTY_STATES: Record<string, EmptyStateCopy> = {
  no_wallet: {
    title: "Wallet not set up",
    body:  "This tenant doesn't have a wallet yet. A wallet is created automatically the first time enrichments run.",
    cta:   "Top up to initialise",
  },
  no_usage: {
    title: "No usage this month",
    body:  "No enrichments have run yet this period. Usage will appear here as visitors are processed.",
  },
  no_transactions: {
    title: "No transactions yet",
    body:  "The transaction ledger will fill up as credits are added and enrichments run.",
    cta:   "Add credits to get started",
  },
  no_stripe: {
    title: "Stripe not linked",
    body:  "No Stripe subscription is linked to this tenant. The wallet can still be topped up manually.",
    cta:   "Link Stripe subscription",
  },
  no_plan: {
    title: "No plan assigned",
    body:  "This tenant has no active subscription plan. Assign one to enable billing features.",
  },
  no_reload_attempts: {
    title: "No reload attempts yet",
    body:  "Auto-reload history will appear here once the first automatic reload runs.",
  },
};

// ── Notification / email copy ──────────────────────────────────────────────────

export interface NotificationTemplate {
  subject:  string;
  headline: string;
  body:     string;
  cta?:     string;
  ctaUrl?:  string;
  tone:     "info" | "warning" | "alert" | "success";
}

export const NOTIFICATION_COPY: Record<string, NotificationTemplate> = {
  low_balance: {
    subject:  "Your Chameleon Credits are running low",
    headline: "Credits running low",
    body:     "Your credit balance is running low. To keep personalisation running without interruption, top up your wallet now.",
    cta:      "Top up credits",
    tone:     "warning",
  },
  wallet_empty: {
    subject:  "Personalisation paused — credits exhausted",
    headline: "Credits exhausted",
    body:     "Your wallet has run out of credits. Enrichments are paused and your site is showing default content. Top up now to resume personalisation.",
    cta:      "Restore credits",
    tone:     "alert",
  },
  auto_reload_success: {
    subject:  "Auto-reload successful — credits topped up",
    headline: "Credits automatically added",
    body:     "Your wallet was automatically topped up. Personalisation continues without interruption.",
    tone:     "success",
  },
  auto_reload_failed: {
    subject:  "Auto-reload failed — action required",
    headline: "Auto-reload failed",
    body:     "We weren't able to automatically top up your credits. Check your payment method and top up manually to avoid any interruption.",
    cta:      "Update payment method",
    tone:     "alert",
  },
  enrichments_paused: {
    subject:  "Personalisation paused — budget cap reached",
    headline: "Monthly budget cap reached",
    body:     "Your monthly credit budget has been reached. Personalisation has switched to your configured fallback mode for the rest of this month. Credits reset on the 1st.",
    tone:     "warning",
  },
  budget_cap_reached: {
    subject:  "Monthly budget cap reached",
    headline: "Budget limit active",
    body:     "Your account has reached its monthly spending limit. Your fallback mode is now active to protect you from unexpected charges. You can raise the limit or wait for the monthly reset.",
    cta:      "Adjust budget",
    tone:     "warning",
  },
};

// ── Pricing page copy ─────────────────────────────────────────────────────────

export const PRICING_COPY = {
  PAGE_HEADLINE:    "Simple credits. Powerful personalisation.",
  PAGE_SUBHEADLINE: "Start with your plan, top up credits as you grow. You decide how much to spend — and we'll never surprise you with unexpected charges.",

  CREDIT_EXPLAINER: "1 Chameleon Credit = €0.01. Credits are used when your site enriches a visitor with Recognition, Adaptation, or Brainpower. Cache hits are free. You only pay for real, fresh data.",

  PLAN_HEADLINE:    "Pick a plan, top up when you need more",
  BUNDLE_HEADLINE:  "Credit packages",
  CATEGORY_HEADLINE: "Three categories. All under your control.",

  TRUST_HEADLINE:   "Built-in spending controls",
  TRUST_BODY:       "Every account has a monthly budget cap, auto-reload, and per-category cost controls. You choose how much is spent — and the engine will never exceed it.",

  FAQ_ITEMS: [
    {
      q: "What happens when I run out of credits?",
      a: "Enrichments pause automatically and your site shows its default content. You won't get a surprise invoice — just top up when ready.",
    },
    {
      q: "Do I pay for cached results?",
      a: "No. Cache hits are completely free. You only pay for fresh enrichment calls that go to external providers.",
    },
    {
      q: "Can I cap my monthly spend?",
      a: "Yes. Set a monthly credit budget in your dashboard. When reached, the engine automatically switches to your chosen fallback mode — keeping the site running at lower cost.",
    },
    {
      q: "What is Smart Lite mode?",
      a: "Smart Lite keeps Recognition running (so geo-personalisation stays on) while pausing Adaptation and Brainpower. A good balance between savings and continued personalisation.",
    },
    {
      q: "Can I disable expensive features?",
      a: "Yes. Each category — Recognition, Adaptation, and Brainpower — can be toggled on or off independently. You can also disable individual enrichments like CRM matching or AI generation.",
    },
    {
      q: "Is auto-reload mandatory?",
      a: "No. Auto-reload is optional. You can top up manually at any time. Auto-reload is there so you never have to think about it if you don't want to.",
    },
  ],
} as const;

// ── Scenario examples (pricing page) ─────────────────────────────────────────

export interface UsageScenario {
  label:          string;
  description:    string;
  creditsPerMonth: number;
  driverSummary:  string;
  protectedBy:    string;
}

export const USAGE_SCENARIOS: UsageScenario[] = [
  {
    label:          "Small tester",
    description:    "A boutique site with 2,000 monthly visitors running IP geo-location and weather context.",
    creditsPerMonth: 500,
    driverSummary:  "~2,000 Recognition calls × 3 cr + ~1,000 Adaptation calls × 3 cr",
    protectedBy:    "Monthly cap at 500 cr ensures zero overages. Smart Lite fallback if limit is hit.",
  },
  {
    label:          "Growing B2B site",
    description:    "A SaaS marketing site with 10,000 monthly visitors using Recognition, Intent, and CRM matching for sales leads.",
    creditsPerMonth: 4500,
    driverSummary:  "10k Recognition × 3 cr + 5k Intent × 3 cr + 500 CRM matches × 6 cr",
    protectedBy:    "Budget cap at 5,000 cr. If limit is hit, CRM matching (Brainpower) pauses — Recognition keeps running.",
  },
  {
    label:          "Enterprise heavy-user",
    description:    "A high-traffic B2B platform with 100k monthly visitors using full Recognition, Adaptation, and AI-powered blueprint generation.",
    creditsPerMonth: 45000,
    driverSummary:  "100k Recognition × 3 cr + 50k Adaptation × 3 cr + 2k Blueprint × 15 cr",
    protectedBy:    "Budget cap with Smart Lite fallback. Blueprint generation is toggled off if spend approaches cap.",
  },
];
