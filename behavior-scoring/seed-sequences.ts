/**
 * behavior-scoring/seed-sequences.ts
 *
 * Preset sequence patterns for the mister-chameleon demo tenant.
 *
 * Each pattern describes an ordered series of visitor events that together
 * signal a meaningful step in the buyer journey.  When a visitor completes
 * all steps in order — within the allowed time gap — the sequence is recorded
 * and a score bonus is awarded.
 *
 * Slug → used in runtime-rules.json condition values (journey.matchedSequences).
 * Any rule referencing a slug here MUST use the exact same string.
 *
 * Current rule references:
 *   • homepage_to_product  → rule_consideration (priority 20)
 *
 * Usage:
 *   import { SEED_SEQUENCE_PATTERNS } from "@/behavior-scoring/seed-sequences";
 *
 * Called by:
 *   app/admin/tenants/[tenantId]/behavior/actions.ts → seedSequencePatternsAction
 */

export interface SeedSequenceStep {
  event_type:      string;
  event_value?:    string;
  page_category?:  string;
}

export interface SeedSequencePattern {
  slug:           string;
  label:          string;
  description:    string;
  sequence:       SeedSequenceStep[];
  maxGapMinutes:  number;
  score:          number;
}

export const SEED_SEQUENCE_PATTERNS: SeedSequencePattern[] = [

  // ── Awareness → Consideration ─────────────────────────────────────────────
  //
  // Visitor starts on the homepage and navigates to the pricing page.
  // A natural first step in a B2B SaaS evaluation journey.
  // Referenced by: rule_consideration in runtime-rules.json.
  {
    slug:          "homepage_to_product",
    label:         "Homepage → Pricing",
    description:   "Visitor starts on the homepage and visits the pricing page in the same session — early consideration signal.",
    sequence: [
      { event_type: "page_view", event_value: "/" },
      { event_type: "page_view", event_value: "/pricing" },
    ],
    maxGapMinutes: 60,
    score:         15,
  },

  // ── Consideration → Decision ───────────────────────────────────────────────
  //
  // Visitor moves from the pricing page to booking a demo.
  // Strong purchase-intent: they evaluated the price and took the next step.
  {
    slug:          "pricing_to_demo",
    label:         "Pricing → Book Demo",
    description:   "Visitor viewed pricing and then navigated to the demo-booking page — high-intent buying signal.",
    sequence: [
      { event_type: "page_view", event_value: "/pricing" },
      { event_type: "page_view", event_value: "/book-demo" },
    ],
    maxGapMinutes: 60,
    score:         30,
  },

  // ── Social Proof → Intent ──────────────────────────────────────────────────
  //
  // Visitor reads any case study page and then checks pricing.
  // Uses page_category: "social_proof" to match /cases/*, /klanten/*, etc.
  // Pattern: social proof convinced them to evaluate cost.
  {
    slug:          "case_to_pricing",
    label:         "Case Study → Pricing",
    description:   "Visitor read a customer case study and followed up with a pricing page visit — research-led intent.",
    sequence: [
      { event_type: "page_view", page_category: "social_proof" },
      { event_type: "page_view", event_value: "/pricing" },
    ],
    maxGapMinutes: 120,
    score:         20,
  },

];
