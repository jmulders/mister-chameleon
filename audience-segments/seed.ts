/**
 * Audience Segments — Seed Definitions
 *
 * Ten predefined audience segments that cover the most useful visitor personas
 * for a B2B SaaS homepage personalization deployment.
 *
 * Each segment uses the same RuleCondition tree format as the decision rules
 * engine (field-registry.ts / stored-rule.ts), so criteria are validated by
 * the same evaluateCondition() runtime.
 *
 * ─── Philosophy ───────────────────────────────────────────────────────────────
 *
 *   Segments are designed to be:
 *   1. Immediately useful out of the box — they work with the base data that
 *      every deployment produces (journey signals, traffic source, visit type).
 *   2. Progressively richer as enrichment is configured — ABM and CRM segments
 *      only match once those enrichment providers are wired up; until then they
 *      simply produce zero matches without errors.
 *   3. Non-overlapping in intent — each segment targets a meaningfully distinct
 *      visitor persona so downstream rules can use them to serve different copy.
 *
 * ─── Seeding behaviour ────────────────────────────────────────────────────────
 *
 *   seedAudienceSegmentsAction() is idempotent: it skips any segment whose key
 *   already exists for the tenant.  Re-running the seed never overwrites
 *   customisations the tenant has made to an existing segment.
 *
 * ─── Criteria format ─────────────────────────────────────────────────────────
 *
 *   FieldCondition  { type:"field",  field, operator, value? }
 *   GroupCondition  { type:"group",  logic:"and"|"or", conditions:[] }
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SeedAudienceSegment {
  key:         string;
  label:       string;
  description: string;
  criteria:    Record<string, unknown>;
  /** true = active at seed time (subject to plan limit check). */
  isActive:    boolean;
}

// ── Seed definitions ─────────────────────────────────────────────────────────

export const SEED_AUDIENCE_SEGMENTS: SeedAudienceSegment[] = [

  // ── 1. High-Intent Visitor ────────────────────────────────────────────────
  {
    key:   "high-intent",
    label: "High-Intent Visitor",
    description:
      "Visitors whose behavioural scoring has reached an intent score of 60 or above. "
    + "These visitors have engaged deeply enough to be worth showing conversion-focused messaging.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "journey.intentScore",
      operator: "greater_than_or_equal",
      value:    60,
    },
  },

  // ── 2. Enterprise Prospect ────────────────────────────────────────────────
  {
    key:   "enterprise-prospect",
    label: "Enterprise Prospect",
    description:
      "Visitors from large or mid-market companies identified through IP-to-company enrichment. "
    + "Warrants enterprise-specific social proof, case studies, and security messaging.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "companyType",
      operator: "in",
      value:    ["enterprise", "mid-market"],
    },
  },

  // ── 3. SMB / Startup ─────────────────────────────────────────────────────
  {
    key:   "smb-startup",
    label: "SMB / Startup",
    description:
      "Visitors from small businesses and early-stage startups. "
    + "Responds better to fast-setup, low-friction, and time-to-value messaging.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "companyType",
      operator: "in",
      value:    ["smb", "startup"],
    },
  },

  // ── 4. LinkedIn Traffic ───────────────────────────────────────────────────
  {
    key:   "linkedin-traffic",
    label: "LinkedIn Traffic",
    description:
      "Visitors arriving from LinkedIn — typically driven by a specific post, ad, or profile link. "
    + "High professional intent; respond well to credibility, peer validation, and targeted CTAs.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "source",
      operator: "equals",
      value:    "linkedin",
    },
  },

  // ── 5. Pricing Researcher ─────────────────────────────────────────────────
  {
    key:   "pricing-researcher",
    label: "Pricing Researcher",
    description:
      "Visitors who have viewed the pricing page OR whose interest scoring indicates strong "
    + "pricing intent (score ≥ 0.4). A strong signal of active commercial evaluation.",
    isActive: true,
    criteria: {
      type:  "group",
      logic: "or",
      conditions: [
        {
          type:     "field",
          field:    "journey.hasVisitedPricing",
          operator: "equals",
          value:    true,
        },
        {
          type:     "field",
          field:    "interestPricingScore",
          operator: "greater_than_or_equal",
          value:    0.4,
        },
      ],
    },
  },

  // ── 6. Returning Engager ─────────────────────────────────────────────────
  {
    key:   "returning-engager",
    label: "Returning Engager",
    description:
      "Visitors who have been to the site before AND have accumulated meaningful engagement "
    + "(score ≥ 40). They know who you are — treat them differently from cold traffic.",
    isActive: true,
    criteria: {
      type:  "group",
      logic: "and",
      conditions: [
        {
          type:     "field",
          field:    "visitType",
          operator: "equals",
          value:    "returning",
        },
        {
          type:     "field",
          field:    "journey.engagementScore",
          operator: "greater_than_or_equal",
          value:    40,
        },
      ],
    },
  },

  // ── 7. Ready to Convert ───────────────────────────────────────────────────
  {
    key:   "ready-to-convert",
    label: "Ready to Convert",
    description:
      "Visitors where the derived isReadyToConvert signal is true AND intent score is above 50. "
    + "Dual-gated to reduce false positives. Show trial CTAs, demos, or direct sales contact.",
    isActive: true,
    criteria: {
      type:  "group",
      logic: "and",
      conditions: [
        {
          type:     "field",
          field:    "isReadyToConvert",
          operator: "equals",
          value:    true,
        },
        {
          type:     "field",
          field:    "journey.intentScore",
          operator: "greater_than_or_equal",
          value:    50,
        },
      ],
    },
  },

  // ── 8. Paid Acquisition ───────────────────────────────────────────────────
  {
    key:   "paid-acquisition",
    label: "Paid Acquisition",
    description:
      "Visitors arriving from paid search or paid social campaigns. "
    + "These visitors typically have high keyword intent; reflect their specific need back to them.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "channelGroup",
      operator: "in",
      value:    ["paid-search", "paid-social"],
    },
  },

  // ── 9. ABM Target Account ─────────────────────────────────────────────────
  {
    key:   "target-account",
    label: "ABM Target Account",
    description:
      "Visitor's company matched an account in the configured target account list (ABM). "
    + "Requires ABM enrichment to be configured. Warrants named-account messaging and case studies.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "targetAccountMatched",
      operator: "equals",
      value:    true,
    },
  },

  // ── 10. CRM-Known Contact ─────────────────────────────────────────────────
  {
    key:   "crm-known",
    label: "CRM-Known Contact",
    description:
      "Visitor matched a record in the connected CRM (HubSpot / Salesforce). "
    + "Enables treating known contacts differently — e.g. hide acquisition CTAs, show upgrade messaging.",
    isActive: true,
    criteria: {
      type:     "field",
      field:    "crmMatched",
      operator: "equals",
      value:    true,
    },
  },

];
