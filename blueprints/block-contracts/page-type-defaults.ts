/**
 * Page Type Default Block Mappings (Part 2)
 *
 * Maps each PageTypeKey to an ordered list of canonical block types.
 * This is the definitive source of truth for:
 *
 *   • What blocks are scaffolded when a page type is initialised
 *   • What blocks a blueprint page template should resolve to
 *   • What a "valid" page of each type looks like structurally
 *
 * ─── Block role vocabulary ────────────────────────────────────────────────────
 *
 *   "hero"           → context slot — rendered by the decision engine
 *   "required"       → block must be present for the page to function
 *   "recommended"    → strongly encouraged; page works without but is weaker
 *   "optional"       → nice to have; page is complete without it
 *
 * ─── Relationship to site models ─────────────────────────────────────────────
 *
 *   Page types define STRUCTURAL shape.
 *   Site models supply INDUSTRY CONTEXT (slugs, copy notes, rules).
 *   The same page type is reused across multiple models via the
 *   SiteModelPage.noteOverrides mechanism.
 */

import type { PageTypeKey } from "../site-models/types";

// ── Page block entry ──────────────────────────────────────────────────────────

export type PageBlockRole = "context-slot" | "required" | "recommended" | "optional";

export interface PageBlockDefault {
  /**
   * Canonical block type key (ContentBlockKey or context slot id).
   * This is the value that resolves via getBlockContract().
   */
  blockType:  string;
  /** Role of the block within the page */
  role:       PageBlockRole;
  /** Why this block belongs here */
  rationale?: string;
}

export interface PageTypeBlockDefaults {
  pageType:    PageTypeKey;
  label:       string;
  description: string;
  blocks:      PageBlockDefault[];
}

// ── Homepage ──────────────────────────────────────────────────────────────────
//
//   Primary landing.  Must establish attention (hero), build credibility
//   (proof), show capabilities (features), and convert (CTA).
//   Context slot "hero" is first — rendered via decision engine.

export const HOMEPAGE_DEFAULTS: PageTypeBlockDefaults = {
  pageType:    "homepage",
  label:       "Homepage",
  description: "Primary landing page.  Establishes brand, builds credibility, and converts.",
  blocks: [
    { blockType: "hero",               role: "context-slot",  rationale: "Primary hero rendered via decision engine — variant driven by visitor segment." },
    { blockType: "logoStrip",          role: "recommended",   rationale: "Trust signal immediately after the hero.  Clients/partners reduce friction fast." },
    { blockType: "stats",              role: "recommended",   rationale: "Impact numbers substantiate the hero promise with concrete evidence." },
    { blockType: "featureGrid",        role: "required",      rationale: "Explains the offering — what you do or sell.  No page works without this." },
    { blockType: "testimonialSection", role: "recommended",   rationale: "Social proof for mid-funnel visitors who need validation." },
    { blockType: "listing",            role: "optional",      rationale: "Featured items (cases, products, jobs) give specific evidence of value." },
    { blockType: "teamSection",        role: "optional",      rationale: "Humanises the brand; particularly important for service and careers sites." },
    { blockType: "ctaSection",         role: "required",      rationale: "Bottom conversion — every homepage needs a clear terminal CTA." },
  ],
};

// ── Overview ──────────────────────────────────────────────────────────────────
//
//   Listing / catalogue page.  Must let visitors filter, browse, and act.
//   No context slots — this page is structural, not personalized at the slot level.

export const OVERVIEW_DEFAULTS: PageTypeBlockDefaults = {
  pageType:    "overview",
  label:       "Overview / Listing",
  description: "Listing and catalogue pages.  Enables browsing, filtering, and item discovery.",
  blocks: [
    { blockType: "textSection",  role: "required",     rationale: "Page header with title and intro — orients the visitor and sets context." },
    { blockType: "filterBar",    role: "optional",      rationale: "Essential for large catalogues (50+ items); optional for small sets." },
    { blockType: "listing",      role: "required",      rationale: "The actual content grid — this IS the page without it." },
    { blockType: "ctaSection",   role: "recommended",   rationale: "Bottom CTA for visitors who did not find what they needed." },
  ],
};

// ── Detail ────────────────────────────────────────────────────────────────────
//
//   Single-item deep-dive.  Must answer all questions and provide a clear
//   conversion action.  Used for: job detail, service detail, product detail,
//   case study, article — ONE structural shape, industry copy notes vary.

export const DETAIL_DEFAULTS: PageTypeBlockDefaults = {
  pageType:    "detail",
  label:       "Detail Page",
  description: "Single-item deep-dive.  One structural shape reused across jobs, services, products, cases, and articles.",
  blocks: [
    { blockType: "textSection",    role: "required",     rationale: "Page header: title, meta, summary — anchors the page before body content." },
    { blockType: "richText",       role: "required",     rationale: "Full description / body — the core information the visitor came for." },
    { blockType: "slider",         role: "optional",      rationale: "Supporting media: photo gallery, video, or product imagery." },
    { blockType: "featureGrid",    role: "recommended",   rationale: "Key attributes: requirements, specs, or highlights — scannable list form." },
    { blockType: "teamSection",    role: "optional",      rationale: "For service/careers: the person responsible (recruiter, account manager, specialist)." },
    { blockType: "relatedContent", role: "recommended",   rationale: "Prevents dead-ends — 3 related items keeps visitors engaged." },
    { blockType: "ctaSection",     role: "required",      rationale: "Terminal conversion action: apply, enquire, buy, or book." },
  ],
};

// ── Form ──────────────────────────────────────────────────────────────────────
//
//   Conversion page.  Must contextualise the ask, collect data efficiently,
//   and reduce anxiety with trust signals.  Context slot CTA is absent here —
//   the form IS the CTA.

export const FORM_DEFAULTS: PageTypeBlockDefaults = {
  pageType:    "form",
  label:       "Form / Conversion Page",
  description: "Conversion page.  Contextualises the ask, collects efficiently, and reduces form anxiety.",
  blocks: [
    { blockType: "textSection",   role: "required",     rationale: "Reassuring header: what happens next, why it is worth filling in." },
    { blockType: "formSection",   role: "required",     rationale: "The form itself — central purpose of the page." },
    { blockType: "logoStrip",     role: "recommended",  rationale: "Trust signals below the form reduce submission anxiety." },
    { blockType: "faqSection",    role: "optional",     rationale: "Pre-empt objections alongside the form." },
    { blockType: "contactSection",role: "optional",     rationale: "Alternative contact info for visitors who prefer not to use the form." },
  ],
};

// ── Process ───────────────────────────────────────────────────────────────────
//
//   Step-by-step explanation page.  Must narrate a journey, answer questions,
//   and end with a clear action.  Used for: how-it-works, how-to-apply,
//   onboarding, shipping/returns.

export const PROCESS_DEFAULTS: PageTypeBlockDefaults = {
  pageType:    "process",
  label:       "Process / How It Works",
  description: "Step-by-step page.  Narrates a journey, answers questions, and ends with action.",
  blocks: [
    { blockType: "textSection",    role: "required",     rationale: "Process intro: what the journey is and why it matters." },
    { blockType: "processSteps",   role: "required",     rationale: "Numbered steps — the core content of the page." },
    { blockType: "stats",          role: "optional",     rationale: "Reassurance numbers (time to value, success rate) build confidence." },
    { blockType: "teamSection",    role: "optional",     rationale: "For careers/service: the people the visitor will meet in the process." },
    { blockType: "faqSection",     role: "recommended",  rationale: "FAQs address concerns that often block action at this stage." },
    { blockType: "ctaSection",     role: "required",     rationale: "Call to take the first step after reading the process." },
  ],
};

// ── Master map ────────────────────────────────────────────────────────────────

export const PAGE_TYPE_BLOCK_DEFAULTS: Record<PageTypeKey, PageTypeBlockDefaults> = {
  homepage: HOMEPAGE_DEFAULTS,
  overview: OVERVIEW_DEFAULTS,
  detail:   DETAIL_DEFAULTS,
  form:     FORM_DEFAULTS,
  process:  PROCESS_DEFAULTS,
};

/** Return the block defaults for a page type. */
export function getPageTypeDefaults(pageType: PageTypeKey): PageTypeBlockDefaults {
  return PAGE_TYPE_BLOCK_DEFAULTS[pageType];
}

/**
 * Return the ordered list of canonical block types for a page type,
 * filtered to a specific role or all roles.
 */
export function getDefaultBlocksForPageType(
  pageType: PageTypeKey,
  filterRole?: PageBlockRole,
): string[] {
  const defaults = PAGE_TYPE_BLOCK_DEFAULTS[pageType];
  if (!defaults) return [];
  const blocks = filterRole
    ? defaults.blocks.filter((b) => b.role === filterRole)
    : defaults.blocks;
  return blocks.map((b) => b.blockType);
}

/**
 * Return all page types that support a given block type.
 */
export function getPageTypesForBlock(blockType: string): PageTypeKey[] {
  return (Object.entries(PAGE_TYPE_BLOCK_DEFAULTS) as [PageTypeKey, PageTypeBlockDefaults][])
    .filter(([, defaults]) => defaults.blocks.some((b) => b.blockType === blockType))
    .map(([key]) => key);
}
