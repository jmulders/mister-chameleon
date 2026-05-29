/**
 * behavior-scoring/seed.ts
 *
 * Preset scoring rules for the Behavioral Personalization system.
 *
 * These rules represent a well-balanced, production-ready starting point that
 * covers the most important visitor intent signals:
 *   — High-intent page views (pricing, demo, contact)
 *   — General engagement (scrolls, reads, video)
 *   — Form interactions (start → submit)
 *   — CTA clicks (any → primary)
 *   — Friction signals (quick exit)
 *
 * All scores use the canonical `score` column (numeric(10,3)).
 * Decay profiles reference the standard platform profiles seeded by migration 070.
 *
 * Usage:
 *   import { SEED_SCORING_RULES } from "@/behavior-scoring/seed";
 *
 * Called by:
 *   app/admin/tenants/[tenantId]/behavior/actions.ts → seedScoringRulesAction
 */

export interface SeedScoringRule {
  key:           string;
  label:         string;
  description?:  string;
  eventType:     string;
  eventValue?:   string | null;
  pageCategory?: string | null;
  score:         number;
  decayProfile:  string;
  isActive:      boolean;
  priority:      number;
}

export const SEED_SCORING_RULES: SeedScoringRule[] = [

  // ── High-intent page views ─────────────────────────────────────────────────
  {
    key:         "pricing_page_view",
    label:       "Pricing page view",
    description: "Visitor viewed the pricing page — strong purchase-intent signal.",
    eventType:   "page_view",
    eventValue:  "/pricing",
    score:       40,
    decayProfile:"standard",
    isActive:    true,
    priority:    10,
  },
  {
    key:         "demo_page_view",
    label:       "Demo / book-a-call page view",
    description: "Visitor viewed a demo-request or booking page.",
    eventType:   "page_view",
    eventValue:  "/demo",
    score:       45,
    decayProfile:"standard",
    isActive:    true,
    priority:    12,
  },
  {
    key:         "contact_page_view",
    label:       "Contact page view",
    description: "Visitor viewed the contact page — indicates readiness to reach out.",
    eventType:   "page_view",
    eventValue:  "/contact",
    score:       30,
    decayProfile:"standard",
    isActive:    true,
    priority:    15,
  },
  {
    key:         "highvalue_page_view",
    label:       "High-intent page view",
    description: "Visited any page categorised as high-intent (pricing, demo, contact).",
    eventType:   "page_view",
    pageCategory:"high-intent",
    score:       25,
    decayProfile:"standard",
    isActive:    true,
    priority:    50,
  },

  // ── General page views ─────────────────────────────────────────────────────
  {
    key:         "homepage_view",
    label:       "Homepage view",
    description: "Visitor landed on the homepage — low signal, high volume.",
    eventType:   "page_view",
    eventValue:  "/",
    score:       5,
    decayProfile:"standard",
    isActive:    true,
    priority:    100,
  },
  {
    key:         "generic_page_view",
    label:       "Page view",
    description: "Visitor viewed any page not covered by a more specific rule.",
    eventType:   "page_view",
    eventValue:  null,
    score:       3,
    decayProfile:"standard",
    isActive:    true,
    priority:    200,
  },

  // ── CTA clicks ─────────────────────────────────────────────────────────────
  {
    key:         "cta_click",
    label:       "CTA click",
    description: "Clicked any call-to-action button.",
    eventType:   "cta_click",
    score:       20,
    decayProfile:"standard",
    isActive:    true,
    priority:    30,
  },
  {
    key:         "primary_cta_click",
    label:       "Primary CTA click",
    description: "Clicked the primary CTA — the strongest single-click intent signal.",
    eventType:   "cta_click",
    eventValue:  "primary",
    score:       35,
    decayProfile:"standard",
    isActive:    true,
    priority:    20,
  },

  // ── Form interactions ──────────────────────────────────────────────────────
  {
    key:         "form_start",
    label:       "Form started",
    description: "Visitor started filling in a form — moderate intent signal.",
    eventType:   "form_start",
    score:       25,
    decayProfile:"fast",
    isActive:    true,
    priority:    25,
  },
  {
    key:         "form_submit",
    label:       "Form submitted",
    description: "Visitor completed and submitted a form — strongest conversion signal.",
    eventType:   "form_submit",
    score:       80,
    decayProfile:"slow",
    isActive:    true,
    priority:    10,
  },

  // ── Engagement signals ─────────────────────────────────────────────────────
  {
    key:         "content_download",
    label:       "Content download",
    description: "Downloaded a content asset (brochure, guide, whitepaper).",
    eventType:   "download",
    score:       30,
    decayProfile:"engagement",
    isActive:    true,
    priority:    35,
  },
  {
    key:         "video_play",
    label:       "Video play",
    description: "Played an embedded video — sustained engagement signal.",
    eventType:   "video_play",
    score:       12,
    decayProfile:"engagement",
    isActive:    true,
    priority:    90,
  },
  {
    key:         "long_read",
    label:       "Long read",
    description: "Spent 2+ minutes on a page — highly engaged reader.",
    eventType:   "time_on_page_long",
    score:       18,
    decayProfile:"engagement",
    isActive:    true,
    priority:    70,
  },
  {
    key:         "deep_scroll",
    label:       "Deep scroll",
    description: "Scrolled past 75% of a page — read the full content.",
    eventType:   "scroll_depth",
    eventValue:  "75",
    score:       6,
    decayProfile:"standard",
    isActive:    true,
    priority:    120,
  },

  // ── Friction signals ───────────────────────────────────────────────────────
  {
    key:         "quick_exit",
    label:       "Quick exit",
    description: "Left the page in under 10 seconds — likely a mismatch or low-intent visit.",
    eventType:   "quick_exit",
    score:       -10,
    decayProfile:"friction",
    isActive:    true,
    priority:    300,
  },
];
