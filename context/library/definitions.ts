/**
 * Context Library — Seed Definitions
 *
 * context/library/definitions.ts
 *
 * All named audience profiles, grouped into 12 families.
 *
 * ─── Status guide ─────────────────────────────────────────────────────────────
 *
 *   active    — broad, signal-rich definitions reliable across all site models
 *   suggested — domain-specific or lower-coverage; opt-in for operators
 *   draft     — under construction; excluded from matching
 *
 * ─── Adding definitions ───────────────────────────────────────────────────────
 *
 *   1. Pick an id that is globally unique (kebab-case).
 *   2. Choose the correct family and siteModels.
 *   3. Write criteria using fields from ContextEvalInput
 *      (built by buildContextEvalInput in match.ts).
 *   4. Set status: "suggested" if the definition requires domain-specific
 *      enrichment (careers, commerce, real-estate) or is still experimental.
 */

import type {
  ContextDefinition,
  ContextFamily,
  ContextFamilyKey,
} from "./types";

// ── Family metadata ────────────────────────────────────────────────────────────

export const CONTEXT_FAMILIES: readonly ContextFamily[] = [
  {
    key:         "acquisition",
    label:       "Acquisition",
    description: "How the visitor arrived — channel, medium, campaign, referrer.",
    color:       "bg-violet-100 text-violet-700",
  },
  {
    key:         "intent",
    label:       "Intent",
    description: "How strong the visitor's purchase or conversion signal is.",
    color:       "bg-orange-100 text-orange-700",
  },
  {
    key:         "lifecycle",
    label:       "Lifecycle",
    description: "Where the visitor sits in the acquisition funnel.",
    color:       "bg-blue-100 text-blue-700",
  },
  {
    key:         "account",
    label:       "Account / B2B",
    description: "CRM status, company size, and target-account signals.",
    color:       "bg-indigo-100 text-indigo-700",
  },
  {
    key:         "behavior",
    label:       "Behavior",
    description: "Engagement depth, page views, and friction patterns.",
    color:       "bg-teal-100 text-teal-700",
  },
  {
    key:         "confidence",
    label:       "Confidence",
    description: "Reliability of the enrichment and decision data.",
    color:       "bg-yellow-100 text-yellow-700",
  },
  {
    key:         "temporal",
    label:       "Temporal",
    description: "Time of day, day of week, and seasonal signals.",
    color:       "bg-sky-100 text-sky-700",
  },
  {
    key:         "geo",
    label:       "Geo",
    description: "Country, region, and IP-level geography.",
    color:       "bg-green-100 text-green-700",
  },
  {
    key:         "content",
    label:       "Content Interest",
    description: "What topics or product areas the visitor has signalled interest in.",
    color:       "bg-pink-100 text-pink-700",
  },
  {
    key:         "careers",
    label:       "Careers",
    description: "Job-seeker signals relevant to careers / recruitment sites.",
    color:       "bg-rose-100 text-rose-700",
  },
  {
    key:         "commerce",
    label:       "Commerce",
    description: "Shopping intent and cart/checkout signals for e-commerce sites.",
    color:       "bg-amber-100 text-amber-700",
  },
  {
    key:         "realestate",
    label:       "Real Estate",
    description: "Property-search signals for catalog and real-estate sites.",
    color:       "bg-lime-100 text-lime-700",
  },
];

/** Look up family metadata by key. */
export function getContextFamily(key: ContextFamilyKey): ContextFamily | undefined {
  return CONTEXT_FAMILIES.find((f) => f.key === key);
}

// ── Seed definitions ───────────────────────────────────────────────────────────

export const CONTEXT_DEFINITIONS: readonly ContextDefinition[] = [

  // ── Acquisition ─────────────────────────────────────────────────────────────

  {
    id:          "acq-paid-search",
    label:       "Paid Search Visitor",
    description: "Arrived via a paid search ad (CPC/PPC).",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "utmMedium", op: "eq", value: "cpc" },
    ],
    matchReason: "UTM medium is 'cpc' — visitor arrived via a paid search campaign.",
    usageNote:   "Use to show ROI-focused messaging or urgency elements for paid traffic.",
  },
  {
    id:          "acq-organic-search",
    label:       "Organic Search Visitor",
    description: "Arrived via an unpaid search engine result.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "source", op: "eq", value: "organic" },
    ],
    matchReason: "Traffic source is 'organic' — visitor found the site through a search engine.",
    usageNote:   "Pair with content-interest context to tailor landing messaging.",
  },
  {
    id:          "acq-paid-social",
    label:       "Paid Social Visitor",
    description: "Arrived via a paid social media campaign.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "utmMedium", op: "eq", value: "paid-social" },
    ],
    matchReason: "UTM medium is 'paid-social'.",
    usageNote:   "Social audiences often need more context — consider leading with brand story.",
  },
  {
    id:          "acq-direct",
    label:       "Direct / Branded Visitor",
    description: "Arrived with no referrer — typed URL, bookmark, or brand recall.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "source", op: "eq", value: "direct" },
    ],
    matchReason: "Source is 'direct' — high brand awareness, no referring channel.",
  },
  {
    id:          "acq-email-campaign",
    label:       "Email Campaign Visitor",
    description: "Arrived via an email marketing link.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "utmMedium", op: "in", value: ["email", "newsletter"] },
    ],
    matchReason: "UTM medium is 'email' or 'newsletter'.",
    usageNote:   "Visitors from email already know the brand — skip awareness, go straight to conversion.",
  },
  {
    id:          "acq-referral",
    label:       "Referral Visitor",
    description: "Arrived from another website via an inbound link.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "source", op: "eq", value: "referral" },
    ],
    matchReason: "Traffic source is 'referral'.",
  },
  {
    id:          "acq-retargeting",
    label:       "Retargeted Visitor",
    description: "Previously visited the site and was retargeted via ads.",
    family:      "acquisition",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "utmMedium", op: "eq",    value: "retargeting" },
    ],
    matchReason: "UTM medium is 'retargeting' — visitor has seen the brand before.",
    usageNote:   "Show proof and differentiation rather than awareness content.",
  },

  // ── Intent ───────────────────────────────────────────────────────────────────

  {
    id:          "intent-high",
    label:       "High-Intent Visitor",
    description: "Strong purchase or conversion signal based on behaviour and journey score.",
    family:      "intent",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "intentScore", op: "gte", value: 70 },
    ],
    matchReason: "Intent score ≥ 70 — visitor shows strong conversion signals.",
    usageNote:   "Show CTAs prominently; reduce friction.",
  },
  {
    id:          "intent-medium",
    label:       "Medium-Intent Visitor",
    description: "Moderate interest; evaluating but not yet committed.",
    family:      "intent",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "intentScore", op: "gte", value: 40 },
      { field: "intentScore", op: "lt",  value: 70 },
    ],
    matchReason: "Intent score between 40 and 70.",
  },
  {
    id:          "intent-low",
    label:       "Low-Intent / Browse-Mode Visitor",
    description: "Casually exploring; no strong conversion signal yet.",
    family:      "intent",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "intentScore", op: "lt", value: 40 },
    ],
    matchReason: "Intent score < 40 — visitor in browse mode.",
    usageNote:   "Lead with value and education rather than hard CTAs.",
  },
  {
    id:          "intent-pricing-visited",
    label:       "Pricing Page Visitor",
    description: "Has visited the pricing page — strong bottom-of-funnel signal.",
    family:      "intent",
    siteModels:  ["product-saas", "service", "commerce"],
    status:      "active",
    criteria: [
      { field: "hasVisitedPricing", op: "truthy" },
    ],
    matchReason: "Visitor has viewed the pricing page in this session.",
    usageNote:   "Ideal for social-proof modules, trial CTAs, and comparison tables.",
  },
  {
    id:          "intent-high-saas-evaluator",
    label:       "High-Intent SaaS Evaluator",
    description: "Visited pricing, high intent score, and arrived from organic or paid search.",
    family:      "intent",
    siteModels:  ["product-saas"],
    status:      "active",
    criteria: [
      { field: "intentScore",       op: "gte",    value: 60 },
      { field: "hasVisitedPricing", op: "truthy" },
      { field: "source",            op: "in",     value: ["organic", "cpc"], optional: true },
    ],
    matchReason: "High intent score combined with a pricing page visit — classic bottom-of-funnel SaaS evaluator.",
    usageNote:   "Prioritise free trial or demo CTA; show feature comparison.",
  },
  {
    id:          "intent-form-started",
    label:       "Form Started (Not Submitted)",
    description: "Began filling out a form but has not yet submitted it.",
    family:      "intent",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "formStartCount", op: "gte",    value: 1 },
      { field: "hasSubmittedForm", op: "falsy" },
    ],
    matchReason: "Visitor started a form but has not submitted — potential friction point.",
    usageNote:   "Consider exit-intent nudge or form assistance.",
  },

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  {
    id:          "lc-new-visitor",
    label:       "New Visitor",
    description: "First visit to this site — no prior session history.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "visitType", op: "eq", value: "new" },
    ],
    matchReason: "visitType is 'new' — first time on this site.",
    usageNote:   "Lead with brand story and value proposition.",
  },
  {
    id:          "lc-returning-visitor",
    label:       "Returning Visitor",
    description: "Has visited the site before this session.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "visitType", op: "eq", value: "returning" },
    ],
    matchReason: "visitType is 'returning' — visitor has been here before.",
    usageNote:   "Skip brand intro; surface new content or progress-based CTAs.",
  },
  {
    id:          "lc-tofu",
    label:       "Top-of-Funnel",
    description: "Early awareness stage — no strong intent signals.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "funnelStage", op: "eq", value: "awareness" },
    ],
    matchReason: "Funnel stage is 'awareness'.",
  },
  {
    id:          "lc-mofu",
    label:       "Mid-Funnel Evaluator",
    description: "Actively considering options — comparison and evaluation stage.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "funnelStage", op: "in", value: ["consideration", "evaluation"] },
    ],
    matchReason: "Funnel stage is 'consideration' or 'evaluation'.",
  },
  {
    id:          "lc-bofu",
    label:       "Bottom-of-Funnel",
    description: "Ready to decide — high intent, late-stage evaluation.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "funnelStage", op: "in", value: ["decision", "purchase"] },
    ],
    matchReason: "Funnel stage is 'decision' or 'purchase'.",
  },
  {
    id:          "lc-converted",
    label:       "Converted Visitor",
    description: "Has submitted a lead form or completed a conversion action.",
    family:      "lifecycle",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "hasSubmittedForm", op: "truthy" },
    ],
    matchReason: "Visitor has submitted a form in this session.",
    usageNote:   "Serve confirmation-oriented content; avoid duplicate lead CTAs.",
  },

  // ── Account / B2B ────────────────────────────────────────────────────────────

  {
    id:          "acct-identified-company",
    label:       "Identified Company Visitor",
    description: "Enrichment resolved a company name for this visitor's IP.",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "active",
    criteria: [
      { field: "companyName", op: "present" },
    ],
    matchReason: "Company name resolved from IP enrichment.",
    usageNote:   "Use for account-based personalisation (company name in headline).",
  },
  {
    id:          "acct-target-account",
    label:       "Target Account Visitor",
    description: "Company matched against the tenant's target account list.",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "suggested",
    criteria: [
      { field: "targetAccountMatched", op: "truthy" },
    ],
    matchReason: "IP resolved to a company on the tenant's target account list.",
    usageNote:   "Highest-priority personalisation — consider dedicated landing experience.",
  },
  {
    id:          "acct-crm-lead",
    label:       "Known CRM Lead",
    description: "Visitor's company is a CRM lead (not yet a customer).",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "suggested",
    criteria: [
      { field: "crmLifecycleStage", op: "in", value: ["lead", "qualified-lead", "opportunity"] },
    ],
    matchReason: "CRM lifecycle stage is lead, qualified lead, or opportunity.",
    usageNote:   "Personalise for velocity — help them move to the next stage.",
  },
  {
    id:          "acct-crm-customer",
    label:       "Existing Customer",
    description: "Visitor's company is an active customer in the CRM.",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "suggested",
    criteria: [
      { field: "crmIsCustomer", op: "truthy" },
    ],
    matchReason: "CRM identifies this company as an existing customer.",
    usageNote:   "Show upsell / cross-sell content or support resources rather than acquisition CTAs.",
  },
  {
    id:          "acct-enterprise",
    label:       "Enterprise-Scale Company",
    description: "Company size suggests an enterprise account (200+ employees).",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "suggested",
    criteria: [
      { field: "companySize", op: "gte", value: 200 },
    ],
    matchReason: "Company has ≥ 200 employees.",
    usageNote:   "Emphasise enterprise features, security, compliance, and dedicated support.",
  },
  {
    id:          "acct-smb",
    label:       "SMB Visitor",
    description: "Small-to-medium business (1–199 employees).",
    family:      "account",
    siteModels:  ["service", "product-saas"],
    status:      "suggested",
    criteria: [
      { field: "companySize", op: "gte", value: 1 },
      { field: "companySize", op: "lt",  value: 200 },
    ],
    matchReason: "Company size is between 1 and 199 employees.",
    usageNote:   "Highlight ease of setup, self-serve pricing, and quick time-to-value.",
  },

  // ── Behavior ─────────────────────────────────────────────────────────────────

  {
    id:          "beh-deep-engaged",
    label:       "Deeply Engaged Visitor",
    description: "High page depth and low friction in this session.",
    family:      "behavior",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "pageViewCount",  op: "gte", value: 5 },
      { field: "frictionScore",  op: "lt",  value: 30 },
    ],
    matchReason: "Visitor has viewed ≥ 5 pages and has low friction.",
    usageNote:   "Ready for a conversion offer — consider personalised CTA.",
  },
  {
    id:          "beh-high-friction",
    label:       "High-Friction Visitor",
    description: "Visitor shows signs of confusion or hesitation.",
    family:      "behavior",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "frictionScore", op: "gte", value: 60 },
    ],
    matchReason: "Friction score ≥ 60 — visitor may be confused or hesitant.",
    usageNote:   "Reduce cognitive load; simplify CTAs; consider chat widget or FAQ nudge.",
  },
  {
    id:          "beh-single-page",
    label:       "Single-Page Visitor",
    description: "Only viewed one page — likely a bouncer or very narrow intent.",
    family:      "behavior",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "pageViewCount", op: "lte", value: 1 },
    ],
    matchReason: "Visitor has viewed only one page.",
    usageNote:   "Optimise the landing page itself — no navigation assumptions.",
  },
  {
    id:          "beh-multi-session",
    label:       "Multi-Session Researcher",
    description: "Returning visitor across multiple sessions — thorough evaluator.",
    family:      "behavior",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "visitType",    op: "eq",  value: "returning" },
      { field: "sessionCount", op: "gte", value: 3 },
    ],
    matchReason: "Returning visitor who has had ≥ 3 sessions — active researcher.",
    usageNote:   "Highlight differentiators and bottom-of-funnel proof points.",
  },
  {
    id:          "beh-sequence-matched",
    label:       "Journey Sequence Matched",
    description: "Visitor triggered at least one pre-defined journey sequence.",
    family:      "behavior",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "matchedSequenceCount", op: "gte", value: 1 },
    ],
    matchReason: "Visitor matched ≥ 1 journey sequence.",
  },

  // ── Confidence ───────────────────────────────────────────────────────────────

  {
    id:          "conf-high-decision",
    label:       "High-Confidence Decision",
    description: "Decision engine has sufficient signal to personalise with high confidence.",
    family:      "confidence",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "overallConfidence", op: "gte", value: 70 },
    ],
    matchReason: "Overall decision confidence ≥ 70.",
    usageNote:   "Safe to show personalised content — signal reliability is high.",
  },
  {
    id:          "conf-low-signal",
    label:       "Low-Signal Visitor",
    description: "Insufficient context to personalise with confidence — show defaults.",
    family:      "confidence",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "overallConfidence", op: "lt", value: 35 },
    ],
    matchReason: "Overall decision confidence < 35 — limited data available.",
    usageNote:   "Fall back to universal messaging; avoid risky personalisation.",
  },
  {
    id:          "conf-cloud-provider",
    label:       "Cloud / Data Centre Traffic",
    description: "Request originates from a known cloud provider or data centre.",
    family:      "confidence",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "isCloudProvider", op: "truthy" },
    ],
    matchReason: "IP identified as cloud or data centre — may be automated traffic.",
    usageNote:   "Suppress heavy personalisation; treat as low-confidence session.",
  },

  // ── Temporal ──────────────────────────────────────────────────────────────────

  {
    id:          "temp-business-hours",
    label:       "Business Hours Visit",
    description: "Visit occurring during typical weekday business hours (Mon–Fri, 09:00–17:00).",
    family:      "temporal",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "isWeekend",    op: "falsy" },
      { field: "currentHour",  op: "gte",  value: 9 },
      { field: "currentHour",  op: "lt",   value: 17 },
    ],
    matchReason: "Visit is on a weekday between 09:00 and 17:00 tenant time.",
    usageNote:   "Safe to show chat widget and 'Talk to sales' CTAs — team is available.",
  },
  {
    id:          "temp-out-of-hours",
    label:       "Out-of-Hours Visit",
    description: "Visit outside business hours — evening, night, or weekend.",
    family:      "temporal",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "timeOfDay", op: "in", value: ["evening", "night"] },
    ],
    matchReason: "Visit is in the evening or at night.",
    usageNote:   "Replace live-chat CTA with async alternative (email / demo booking).",
  },
  {
    id:          "temp-weekend",
    label:       "Weekend Visitor",
    description: "Visit on a Saturday or Sunday.",
    family:      "temporal",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "isWeekend", op: "truthy" },
    ],
    matchReason: "Visit is on a weekend.",
  },
  {
    id:          "temp-morning-peak",
    label:       "Morning Rush Visitor",
    description: "Visit during the morning peak hours (07:00–09:00).",
    family:      "temporal",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "currentHour", op: "gte", value: 7 },
      { field: "currentHour", op: "lt",  value: 9 },
    ],
    matchReason: "Visit is between 07:00 and 09:00 tenant time.",
  },
  {
    id:          "temp-seasonal-q4",
    label:       "Q4 / Holiday Season Visitor",
    description: "Visit during Q4 — Black Friday, Cyber Monday, or Christmas.",
    family:      "temporal",
    siteModels:  ["commerce", "catalog"],
    status:      "suggested",
    criteria: [
      { field: "month", op: "in", value: [10, 11, 12] },
    ],
    matchReason: "Visit is in October, November, or December.",
    usageNote:   "Activate seasonal promotions and gift-oriented content.",
  },

  // ── Geo ───────────────────────────────────────────────────────────────────────

  {
    id:          "geo-netherlands",
    label:       "Netherlands Visitor",
    description: "Visitor's IP resolves to the Netherlands.",
    family:      "geo",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "countryCode", op: "eq", value: "NL" },
    ],
    matchReason: "Country code is NL.",
  },
  {
    id:          "geo-dach",
    label:       "DACH Region Visitor",
    description: "Visitor is from Germany, Austria, or Switzerland.",
    family:      "geo",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "countryCode", op: "in", value: ["DE", "AT", "CH"] },
    ],
    matchReason: "Country code is DE, AT, or CH.",
  },
  {
    id:          "geo-benelux",
    label:       "Benelux Visitor",
    description: "Visitor is from Belgium, the Netherlands, or Luxembourg.",
    family:      "geo",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "countryCode", op: "in", value: ["NL", "BE", "LU"] },
    ],
    matchReason: "Country code is NL, BE, or LU.",
  },
  {
    id:          "geo-uk",
    label:       "United Kingdom Visitor",
    description: "Visitor's IP resolves to the United Kingdom.",
    family:      "geo",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "countryCode", op: "eq", value: "GB" },
    ],
    matchReason: "Country code is GB.",
  },
  {
    id:          "geo-us",
    label:       "United States Visitor",
    description: "Visitor's IP resolves to the United States.",
    family:      "geo",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "countryCode", op: "eq", value: "US" },
    ],
    matchReason: "Country code is US.",
  },
  {
    id:          "geo-rainy-day",
    label:       "Rainy Day Visitor",
    description: "It is currently raining at the visitor's location.",
    family:      "geo",
    siteModels:  ["commerce", "service"],
    status:      "suggested",
    criteria: [
      { field: "isRaining", op: "truthy" },
    ],
    matchReason: "Weather API reports rain at the visitor's location.",
    usageNote:   "Trigger weather-aware messaging (e.g. 'Perfect day to browse from home').",
  },

  // ── Content Interest ─────────────────────────────────────────────────────────

  {
    id:          "content-primary-interest",
    label:       "Clear Primary Interest",
    description: "Visitor has expressed a clear primary topic interest.",
    family:      "content",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "interestPrimary", op: "present" },
    ],
    matchReason: "Interest profiling resolved a primary interest topic for this visitor.",
    usageNote:   "Tailor hero content, nav highlights, and recommended articles to this topic.",
  },
  {
    id:          "content-high-interest-confidence",
    label:       "High-Confidence Interest Profile",
    description: "Interest profiling is highly confident about this visitor's focus area.",
    family:      "content",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "interestConfidence", op: "gte", value: 0.75 },
    ],
    matchReason: "Interest confidence ≥ 0.75.",
    usageNote:   "Safe to apply strong topical personalisation.",
  },
  {
    id:          "content-secondary-interest",
    label:       "Secondary Interest Signal",
    description: "Visitor shows interest in a secondary topic area as well.",
    family:      "content",
    siteModels:  ["all"],
    status:      "active",
    criteria: [
      { field: "interestSecondary", op: "present" },
    ],
    matchReason: "Interest profiling resolved a secondary interest topic.",
  },

  // ── Careers ───────────────────────────────────────────────────────────────────

  {
    id:          "careers-active-jobseeker",
    label:       "Active Job Seeker",
    description: "High-intent visitor on a careers site — likely applying soon.",
    family:      "careers",
    siteModels:  ["careers"],
    status:      "suggested",
    criteria: [
      { field: "funnelStage",     op: "in",     value: ["consideration", "evaluation", "decision"] },
      { field: "intentScore",     op: "gte",    value: 50 },
    ],
    matchReason: "Mid-to-bottom-of-funnel visitor on careers site with intent score ≥ 50.",
    usageNote:   "Show job alerts sign-up, application tips, and 'Apply now' CTAs.",
  },
  {
    id:          "careers-casual-browser",
    label:       "Casual Career Browser",
    description: "Low-intent visitor exploring culture and values without applying.",
    family:      "careers",
    siteModels:  ["careers"],
    status:      "suggested",
    criteria: [
      { field: "intentScore", op: "lt",  value: 40 },
      { field: "funnelStage", op: "in",  value: ["awareness"] },
    ],
    matchReason: "Low-intent awareness-stage visitor on careers site.",
    usageNote:   "Lead with culture, team stories, and benefits rather than open vacancies.",
  },
  {
    id:          "careers-returning-candidate",
    label:       "Returning Candidate",
    description: "Visited the careers site before — likely conducting due diligence.",
    family:      "careers",
    siteModels:  ["careers"],
    status:      "suggested",
    criteria: [
      { field: "visitType", op: "eq", value: "returning" },
    ],
    matchReason: "Returning visitor on a careers site.",
    usageNote:   "Highlight new vacancies, recent awards, and news.",
  },
  {
    id:          "careers-referral-candidate",
    label:       "Referred Candidate",
    description: "Arrived via a referral link — may have been sent by an employee.",
    family:      "careers",
    siteModels:  ["careers"],
    status:      "suggested",
    criteria: [
      { field: "source", op: "eq", value: "referral" },
    ],
    matchReason: "Traffic source is 'referral' on a careers site.",
    usageNote:   "Show referral-specific welcome messaging.",
  },
  {
    id:          "careers-linkedin-visitor",
    label:       "LinkedIn Visitor",
    description: "Arrived from LinkedIn — likely a professional researching the employer.",
    family:      "careers",
    siteModels:  ["careers"],
    status:      "suggested",
    criteria: [
      { field: "utmSource", op: "eq", value: "linkedin" },
    ],
    matchReason: "UTM source is 'linkedin'.",
    usageNote:   "Connect LinkedIn audience data with employer branding messaging.",
  },

  // ── Commerce ─────────────────────────────────────────────────────────────────

  {
    id:          "commerce-cart-abandoner",
    label:       "Cart Abandoner",
    description: "Has items in the cart but has not completed checkout.",
    family:      "commerce",
    siteModels:  ["commerce"],
    status:      "suggested",
    criteria: [
      { field: "hasActiveCart",       op: "truthy" },
      { field: "hasCompletedCheckout", op: "falsy" },
    ],
    matchReason: "Visitor has an active cart but has not completed checkout.",
    usageNote:   "Show cart reminder or incentive (free shipping, discount).",
  },
  {
    id:          "commerce-repeat-buyer",
    label:       "Repeat Buyer",
    description: "Has completed at least one previous purchase.",
    family:      "commerce",
    siteModels:  ["commerce"],
    status:      "suggested",
    criteria: [
      { field: "crmIsCustomer",    op: "truthy" },
      { field: "purchaseCount",    op: "gte",   value: 1 },
    ],
    matchReason: "CRM identifies this visitor as a customer with ≥ 1 purchase.",
    usageNote:   "Show loyalty rewards, replenishment nudges, and personalised recommendations.",
  },
  {
    id:          "commerce-first-time-buyer",
    label:       "First-Time Buyer",
    description: "No prior purchase history — potential first-time buyer.",
    family:      "commerce",
    siteModels:  ["commerce"],
    status:      "suggested",
    criteria: [
      { field: "crmIsCustomer",   op: "falsy" },
      { field: "intentScore",     op: "gte",  value: 50 },
    ],
    matchReason: "High-intent visitor with no customer record — potential first purchase.",
    usageNote:   "Show new-customer incentive (discount, free returns).",
  },
  {
    id:          "commerce-high-value-shopper",
    label:       "High-Value Shopper",
    description: "Company or account associated with high purchase volume.",
    family:      "commerce",
    siteModels:  ["commerce"],
    status:      "suggested",
    criteria: [
      { field: "targetAccountMatched", op: "truthy" },
    ],
    matchReason: "Visitor matched a target / key-account in the enrichment layer.",
    usageNote:   "Surface B2B pricing or bulk ordering options.",
  },

  // ── Real Estate ───────────────────────────────────────────────────────────────

  {
    id:          "re-active-searcher",
    label:       "Active Property Searcher",
    description: "High-intent visitor actively looking for a property.",
    family:      "realestate",
    siteModels:  ["catalog"],
    status:      "suggested",
    criteria: [
      { field: "intentScore",  op: "gte", value: 60 },
      { field: "pageViewCount", op: "gte", value: 3 },
    ],
    matchReason: "High-intent visitor who has viewed ≥ 3 pages — active property search.",
    usageNote:   "Show saved-search CTA, mortgage calculator, and direct agent contact.",
  },
  {
    id:          "re-buyer-intent",
    label:       "Buyer-Intent Signal",
    description: "Interest profile points to buying rather than renting.",
    family:      "realestate",
    siteModels:  ["catalog"],
    status:      "suggested",
    criteria: [
      { field: "interestPrimary", op: "in", value: ["buy", "kopen", "purchase"] },
    ],
    matchReason: "Primary interest profile is a buying-intent keyword.",
    usageNote:   "Surface for-sale listings and mortgage / finance CTAs.",
  },
  {
    id:          "re-rental-intent",
    label:       "Rental-Intent Signal",
    description: "Interest profile points to renting rather than buying.",
    family:      "realestate",
    siteModels:  ["catalog"],
    status:      "suggested",
    criteria: [
      { field: "interestPrimary", op: "in", value: ["rent", "huren", "verhuur"] },
    ],
    matchReason: "Primary interest profile is a rental-intent keyword.",
    usageNote:   "Surface rental listings; suppress buying/mortgage content.",
  },
  {
    id:          "re-returning-searcher",
    label:       "Returning Property Searcher",
    description: "Multi-session visitor on a real-estate catalog site.",
    family:      "realestate",
    siteModels:  ["catalog"],
    status:      "suggested",
    criteria: [
      { field: "visitType",    op: "eq",  value: "returning" },
      { field: "sessionCount", op: "gte", value: 2 },
    ],
    matchReason: "Returning visitor with ≥ 2 sessions — active property search across sessions.",
    usageNote:   "Show recently viewed listings and saved search results.",
  },
  {
    id:          "re-local-market-visitor",
    label:       "Local Market Visitor",
    description: "Visitor's IP is in the same country as the primary property market.",
    family:      "realestate",
    siteModels:  ["catalog"],
    status:      "suggested",
    criteria: [
      { field: "countryCode", op: "in", value: ["NL", "BE"] },
    ],
    matchReason: "Visitor is in NL or BE — core market for Dutch/Belgian real estate.",
    usageNote:   "Enable local market context (municipalities, neighbourhoods).",
  },
];
