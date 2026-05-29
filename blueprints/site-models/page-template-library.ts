/**
 * Page Template Library
 *
 * Defines the five reusable structural PageTypes.  These are the
 * industry-neutral building blocks that SiteModels reference.
 *
 * ─── Page types ──────────────────────────────────────────────────────────────
 *
 *   homepage  — Primary landing: hero → proof → features → CTA
 *   overview  — Listing / grid: header → cards → filter pager → CTA
 *   detail    — Single-item: title → body → media → related → CTA
 *   form      — Conversion: contextual header → form → trust signals
 *   process   — Journey / how-it-works: steps → FAQ → CTA
 *
 * ─── Block type naming ───────────────────────────────────────────────────────
 *
 *   All block types here use CANONICAL ContentBlockKey values (from tenant/types.ts).
 *   Previous informal aliases have been replaced:
 *
 *   Old alias       Canonical key       Notes
 *   ─────────────   ─────────────────   ────────────────────────────────────────
 *   cardGrid        listing             Use `listing` block with card layout variant
 *   mediaSection    slider              Use `slider` block for photo/media gallery
 *   featureList     featureGrid         Use `featureGrid` with checklist variant
 *   relatedGrid     relatedContent      Use `relatedContent` block
 *   stepsSection    processSteps        Use `processSteps` block
 *   reviewSection   testimonialSection  Use `testimonialSection` block
 *
 *   SiteModel.noteOverrides keys must also use canonical names.
 *   The old aliases are still accepted via BlockContentContract.templateAliases
 *   in blueprints/block-contracts/contracts.ts.
 *
 * ─── Using the library ───────────────────────────────────────────────────────
 *
 *   SiteModels import the type they need and wrap it in a SiteModelPage:
 *
 *     {
 *       pageTypeKey:    "overview",
 *       slug:           "/vacatures",
 *       title:          "Vacatures",
 *       noteOverrides:  {
 *         textSection: "Vacatures-header: 'Werken bij ons — vind jouw rol'",
 *         listing:     "Vacaturekaarten: functietitel, locatie, type (fulltime/part)",
 *       },
 *     }
 *
 *   The `compose.ts` helper merges the PageType's default block notes with the
 *   SiteModelPage's noteOverrides to produce the final BlueprintPage.
 */

import type { PageType } from "./types";

// ── Homepage ──────────────────────────────────────────────────────────────────
//
//   Structure: hero → logo strip → proof (stats/testimonials) →
//              feature grid → secondary proof → CTA
//
//   Used by: all five site models (each with domain-specific note overrides)

export const HOMEPAGE_PAGE_TYPE: PageType = {
  key:         "homepage",
  label:       "Homepage",
  description: "Primary landing page: hero → proof → features → CTA.",
  defaultSlug: "/",
  blocks: [
    {
      type: "hero",
      note: "Main hero: primary headline, sub-headline, and primary CTA button.",
    },
    {
      type: "logoStrip",
      note: "Trust strip: client logos, partner logos, or certification badges.",
    },
    {
      type: "stats",
      note: "Key impact numbers: 3–4 statistics that demonstrate credibility and scale.",
    },
    {
      type: "featureGrid",
      note: "Feature / service grid: 4–6 cards with icon, title, and one-line description.",
    },
    {
      type: "testimonialSection",
      note: "Social proof: 2–3 quotes with name, role, company, and concrete result.",
    },
    {
      type: "ctaSection",
      note: "Bottom CTA: primary action with supporting statement.",
    },
  ],
};

// ── Overview ──────────────────────────────────────────────────────────────────
//
//   Structure: header → filter/sort controls (optional) → card grid → pagination → CTA
//
//   Used by: service (services overview), careers (job listings), catalog (listings),
//            product-saas (features overview)

export const OVERVIEW_PAGE_TYPE: PageType = {
  key:         "overview",
  label:       "Overview / Listing",
  description: "Listing / grid page: header → cards → optional filter → CTA.",
  defaultSlug: "/overview",
  blocks: [
    {
      type: "textSection",
      note: "Overview page header: title, introductory paragraph, and optional filter controls.",
    },
    {
      type: "listing",
      note: "Card grid: each card should show title, short description, and a call-to-action link.",
    },
    {
      type: "ctaSection",
      note: "Bottom CTA: prompt visitors who haven't found what they need to reach out.",
    },
  ],
};

// ── Detail ────────────────────────────────────────────────────────────────────
//
//   Structure: title/meta → body content → media → related items → CTA
//
//   Used by: service (service detail), careers (job detail), catalog (item detail),
//            product-saas (feature detail)
//
//   Key insight: job detail = service detail = property detail — one shared structure.

export const DETAIL_PAGE_TYPE: PageType = {
  key:         "detail",
  label:       "Detail Page",
  description: "Single-item deep-dive: title → body → media → related → CTA.",
  defaultSlug: "/detail/[slug]",
  blocks: [
    {
      type: "textSection",
      note: "Detail header: item title, meta info (date, location, category), and introductory summary.",
    },
    {
      type: "richText",
      note: "Main body content: full description, requirements, or specifications.",
    },
    {
      type: "slider",
      note: "Supporting media: photo gallery, video, or illustrated diagram relevant to this item.",
    },
    {
      type: "featureGrid",
      note: "Key attributes or highlights: 4–8 items (requirements, features, benefits). Use checklist variant.",
    },
    {
      type: "relatedContent",
      note: "Related items: 3 similar items to reduce dead-ends and encourage further exploration.",
    },
    {
      type: "ctaSection",
      note: "Bottom CTA: primary conversion action for this item (apply, enquire, buy, book).",
    },
  ],
};

// ── Form ──────────────────────────────────────────────────────────────────────
//
//   Structure: contextual header → form → trust signals (logo strip / quote)
//
//   Used by: service (contact), careers (application), product-saas (demo request),
//            commerce (checkout)

export const FORM_PAGE_TYPE: PageType = {
  key:         "form",
  label:       "Form / Conversion Page",
  description: "Conversion page: header → form → trust signals.",
  defaultSlug: "/contact",
  blocks: [
    {
      type: "textSection",
      note: "Form page header: reassuring headline and 1–2 sentences describing what happens next.",
    },
    {
      type: "formSection",
      note: "Primary form: collect required fields + optional qualification question.",
    },
    {
      type: "logoStrip",
      note: "Below-form trust strip: client logos or certification badges to reduce form anxiety.",
    },
  ],
};

// ── Process ───────────────────────────────────────────────────────────────────
//
//   Structure: intro → numbered steps → FAQ → CTA
//
//   Used by: careers (how-to-apply / onboarding), service (how-we-work),
//            product-saas (onboarding flow), commerce (shipping / returns)

export const PROCESS_PAGE_TYPE: PageType = {
  key:         "process",
  label:       "Process / How It Works",
  description: "Step-by-step page: intro → numbered steps → FAQ → CTA.",
  defaultSlug: "/how-it-works",
  blocks: [
    {
      type: "textSection",
      note: "Process intro: headline and brief paragraph framing why the process matters.",
    },
    {
      type: "processSteps",
      note: "Numbered steps: 3–5 steps, each with icon/number, title, and 1–2 sentence description.",
    },
    {
      type: "faqSection",
      note: "FAQ: 4–6 questions addressing common concerns about the process.",
    },
    {
      type: "ctaSection",
      note: "CTA: encourage visitors to take the first step.",
    },
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

import type { PageTypeKey } from "./types";

export const PAGE_TYPE_LIBRARY: Record<PageTypeKey, PageType> = {
  homepage: HOMEPAGE_PAGE_TYPE,
  overview: OVERVIEW_PAGE_TYPE,
  detail:   DETAIL_PAGE_TYPE,
  form:     FORM_PAGE_TYPE,
  process:  PROCESS_PAGE_TYPE,
};

/** Resolve a PageType by key. Throws if the key is invalid. */
export function getPageType(key: PageTypeKey): PageType {
  const pt = PAGE_TYPE_LIBRARY[key];
  if (!pt) throw new Error(`[page-template-library] Unknown PageTypeKey: "${key}"`);
  return pt;
}
