/**
 * demo/block-contract.ts
 *
 * Strict JSON block-output contract for the Demo Importer / Prospect Demo generator.
 *
 * This module defines the canonical intermediate format produced by the AI generator
 * (or template engine) and consumed by the mapping layer. It sits between generation
 * and rendering:
 *
 *   AI / template  →  DemoSiteSpec / DemoPageSpec (this module)
 *        ↓  demo/block-mapper.ts
 *   ContentBlock[] + ResolvedContextSlot[] + context block data
 *        ↓  DemoViewer / Chameleon block components
 *   HTML output
 *
 * ─── Design rules ────────────────────────────────────────────────────────────────
 *
 *   1. Every DemoBlockSpec maps 1-to-1 to a known Chameleon block type or context
 *      slot. The mapping is declared in DEMO_BLOCK_TO_CHAMELEON below.
 *
 *   2. All content is localised. `content.en` is required; `content.nl` is optional.
 *      The mapper picks `content.nl` when the active language is NL and falls back
 *      to `content.en` when the NL translation is absent.
 *
 *   3. Variant strings must be valid for the corresponding Chameleon block type.
 *      The mapper validates them via resolveBlockVariant() and falls back to the
 *      default variant listed in DEMO_BLOCK_DEFAULT_VARIANTS.
 *
 *   4. Media config is separate from content — never embed image URLs inside text
 *      fields. The mapper attaches media to the block data shape at map time.
 *
 *   5. Scenario overrides are sparse — only the fields that differ from the base
 *      content need to be present. The mapper deep-merges them on top of the base
 *      content when the active scenario matches the key.
 *
 *   6. This file is client-safe — type definitions only, no server logic or env vars.
 */

import type { DemoScenarioId, DemoLanguage, SiteCategory } from "./types";

// ── Block type registry ───────────────────────────────────────────────────────

/**
 * All block types the demo generator can emit.
 * Each type maps to exactly one Chameleon block in the mapping layer.
 *
 * Context slots (hero, cta) are mapped to both a ResolvedContextSlot record and
 * a corresponding content block so the demo viewer can render them without the
 * full decision-engine pipeline.
 */
export type DemoBlockType =
  | "hero"           // → context slot "hero"      (HeroBlockData)
  | "features"       // → featureGrid               (FeatureGridBlockData)
  | "stats"          // → stats                     (StatsBlockData)
  | "testimonials"   // → testimonialSection        (TestimonialSectionBlockData)
  | "logos"          // → logoStrip                 (LogoStripBlockData)
  | "case_highlight" // → caseHighlight             (CaseHighlightBlockData)
  | "cta"            // → context slot "cta"        (CTABlockData) + ctaSection content block
  | "pricing"        // → pricingSection            (PricingSectionBlockData)
  | "careers"        // → contentSection + listing  (body intro + role cards)
  | "contact"        // → contactSection            (ContactSectionBlockData)
  | "text"           // → textSection               (TextSectionBlockData)
  | "faq"            // → faqSection                (FaqSectionBlockData)
  | "process";       // → processSteps              (ProcessStepsBlockData)

// ── Per-block content interfaces ──────────────────────────────────────────────
//
// Each interface maps directly to the corresponding Chameleon *BlockData shape,
// using demo-friendly field names. The mapper translates these to the exact
// internal field names expected by each block component.

/** Content for a hero context slot block */
export interface DemoHeroContent {
  headline:      string;
  subheadline:   string;
  primaryCta:    { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Eyebrow badge rendered above the headline (e.g. "Now with GPT-4") */
  tag?:          string;
}

/** Content for a features / featureGrid block */
export interface DemoFeaturesContent {
  heading?:    string;
  subheading?: string;
  items:       Array<{
    title:       string;
    description: string;
    /** Slug-style icon key resolved by the Chameleon icon registry, e.g. "lightning" */
    icon?:       string;
  }>;
  /** Optional CTA rendered below the feature grid */
  cta?: { label: string; href: string };
}

/** Content for a stats block */
export interface DemoStatsContent {
  heading?: string;
  items:    Array<{
    /** Display value, e.g. "3.2×", "94%", "< 3 days" */
    value:   string;
    label:   string;
    prefix?: string;
    suffix?: string;
  }>;
}

/** Content for a testimonials / testimonialSection block */
export interface DemoTestimonialsContent {
  heading?: string;
  items:    Array<{
    quote:    string;
    author:   string;
    company?: string;
    role?:    string;
    /** CDN URL of the author's avatar photo */
    avatar?:  string;
  }>;
}

/** Content for a logos / logoStrip block */
export interface DemoLogosContent {
  heading?: string;
  logos:    Array<{
    name: string;
    /** Resolved CDN URL of the logo image; rendered as text fallback when absent */
    src?: string;
  }>;
}

/** Content for a case_highlight / caseHighlight block */
export interface DemoCaseHighlightContent {
  heading?:   string;
  client:     string;
  challenge?: string;
  outcome?:   string;
  metrics?:   Array<{ label: string; value: string }>;
  ctaLabel?:  string;
  ctaHref?:   string;
}

/** Content for a cta context slot block and ctaSection content block */
export interface DemoCtaContent {
  heading:      string;
  body:         string;
  primaryCta:   { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /**
   * Background style resolved to a design token by the component.
   * "brand" renders the section with the brand accent colour (default for demos).
   */
  background?: "default" | "brand" | "dark";
}

/** Content for a pricing / pricingSection block */
export interface DemoPricingContent {
  heading?:    string;
  subheading?: string;
  tiers:       Array<{
    name:         string;
    /** Display price string, e.g. "€49", "Free", "Custom" */
    price:        string;
    /** Billing cadence, e.g. "/month", "/year", "forever" */
    period?:      string;
    description?: string;
    features:     string[];
    ctaLabel:     string;
    /**
     * CTA destination — defaults to "#" in the mapper when absent.
     * Use "#pricing" to keep the user on the demo page.
     */
    ctaHref?:     string;
    /** When true the tier renders with accent styling ("Most popular") */
    highlighted?: boolean;
    /** Short badge text overlaid on the card, e.g. "Most popular" */
    badge?:       string;
  }>;
  /** Optional billing footnote below the tier cards */
  footnote?: string;
}

/**
 * Content for a careers block.
 * The mapper expands this into two Chameleon blocks:
 *   1. contentSection  — the intro heading + body copy + optional CTA
 *   2. listing         — the role cards grid
 */
export interface DemoCareersContent {
  heading?:  string;
  /** Eyebrow label, e.g. "We're hiring" */
  eyebrow?:  string;
  /** Culture / team intro — plain text; mapper converts to a PortableText paragraph */
  body:      string;
  roles:     Array<{
    title:      string;
    department: string;
    location:   string;
    /** Role detail URL; defaults to "#" when absent */
    href?:      string;
  }>;
  ctaLabel?: string;
  ctaHref?:  string;
}

/** Content for a contact / contactSection block */
export interface DemoContactContent {
  heading?:     string;
  description?: string;
  email?:       string;
  phone?:       string;
  address?:     string;
  /** Business hours string, e.g. "Mon–Fri 09:00–17:00" */
  hours?:       string;
  /** URL for an embedded map or a Google Maps link */
  mapUrl?:      string;
  ctas?:        Array<{
    label:    string;
    href:     string;
    variant?: "primary" | "secondary" | "outline" | "ghost";
  }>;
}

/** Content for a text / textSection block */
export interface DemoTextContent {
  heading?:    string;
  /** Eyebrow label rendered above the heading */
  eyebrow?:    string;
  /** Body copy — plain text; mapper converts to a PortableText paragraph */
  body:        string;
  ctas?:       Array<{ label: string; href: string }>;
  alignment?:  "left" | "center";
}

/** Content for a faq / faqSection block */
export interface DemoFaqContent {
  heading?: string;
  items:    Array<{
    question: string;
    /** Plain text answer — rendered as a paragraph, not Portable Text */
    answer:   string;
  }>;
}

/** Content for a process / processSteps block */
export interface DemoProcessContent {
  heading?: string;
  steps:    Array<{
    title:        string;
    description?: string;
    /** Optional duration label, e.g. "1–2 weeks" */
    duration?:    string;
  }>;
}

/**
 * Discriminated union of all block content shapes.
 * The mapper narrows to the correct interface via the parent DemoBlockSpec.type.
 */
export type DemoBlockContent =
  | DemoHeroContent
  | DemoFeaturesContent
  | DemoStatsContent
  | DemoTestimonialsContent
  | DemoLogosContent
  | DemoCaseHighlightContent
  | DemoCtaContent
  | DemoPricingContent
  | DemoCareersContent
  | DemoContactContent
  | DemoTextContent
  | DemoFaqContent
  | DemoProcessContent;

// ── Media config ──────────────────────────────────────────────────────────────

/**
 * Media configuration attached to a block.
 *
 * Resolution order (highest priority first):
 *   1. url         — a resolved CDN URL; used directly without any API call.
 *   2. stockQuery  — a search query sent to the Unsplash API / curated fallback.
 *   3. aiPrompt    — a generation prompt for future AI image generation.
 *
 * Only the fields relevant to the current block's layout variant are used;
 * the mapper silently ignores media config on block types that have no media slot.
 */
export interface DemoMediaConfig {
  /** Resolved CDN URL — used directly when present */
  url?:             string;
  /** Alt text for accessibility */
  alt?:             string;
  /**
   * Unsplash search query, e.g. "modern b2b saas dashboard team".
   * Passed to getDemoImages() / searchUnsplash() at generation time.
   */
  stockQuery?:      string;
  /**
   * Descriptive prompt for AI image generation.
   * Reserved for future DALL-E / Stable Diffusion integration.
   */
  aiPrompt?:        string;
  /** Visual aspect ratio hint consumed by the block component */
  aspectRatio?:     "1:1" | "4:3" | "16:9" | "3:2";
  /**
   * Future: Sanity DAM asset reference (migration path from resolved URLs
   * to managed assets). Currently informational only.
   */
  sanityAssetRef?:  string;
}

// ── Scenario overrides ────────────────────────────────────────────────────────

/**
 * Per-scenario content override for a single block.
 *
 * Only the fields that differ from the base content need to be present.
 * The mapper deep-merges these on top of `content.en` / `content.nl` when
 * the active scenario matches the key.
 *
 * Example: a hero block with a high_intent override only changes the headline
 * and primaryCta — everything else is inherited from the base content.
 */
export type DemoBlockScenarioOverride = Partial<DemoBlockContent>;

// ── Block spec ────────────────────────────────────────────────────────────────

/**
 * A single block in the demo page output contract.
 *
 * This is the atomic unit produced by the AI generator / template engine.
 * One DemoBlockSpec produces one or more Chameleon ContentBlock instances
 * (the "careers" type expands to two blocks; all others produce exactly one).
 */
export interface DemoBlockSpec {
  /**
   * Stable block identifier — slug-style string, unique within the page.
   * Used as the React `key` prop and as the context slot variantKey.
   * Examples: "hero-main", "features-core", "pricing-main".
   */
  id:      string;

  /** Block type — maps 1-to-1 to a Chameleon block type or context slot */
  type:    DemoBlockType;

  /**
   * Visual variant key for this block.
   * Must be a valid variant string for the corresponding Chameleon block type.
   * The mapper validates via resolveBlockVariant() and falls back to the type's
   * default variant (see DEMO_BLOCK_DEFAULT_VARIANTS) when the value is invalid.
   */
  variant: string;

  /**
   * Localised content.
   * `en` is required and serves as the fallback for all languages.
   * `nl` is optional; when present the mapper uses it for Dutch-language renders.
   */
  content: {
    en:   DemoBlockContent;
    nl?:  DemoBlockContent;
  };

  /** Optional media configuration — see DemoMediaConfig */
  media?: DemoMediaConfig;

  /**
   * Per-scenario content overrides.
   * The mapper applies the matching override (if any) on top of the resolved
   * language content when `scenarioId` is set.
   * Absent keys mean "use the base content unchanged for this scenario".
   */
  scenarioOverrides?: Partial<Record<DemoScenarioId, DemoBlockScenarioOverride>>;
}

// ── Page spec ─────────────────────────────────────────────────────────────────

/**
 * A single page in the demo output contract.
 *
 * `blocks` contains all blocks for this page in render order.
 * Blocks of type "hero" and "cta" are mapped to context slots; all others
 * become content blocks in the Chameleon page model.
 */
export interface DemoPageSpec {
  /**
   * URL slug, e.g. "/", "/pricing", "/careers".
   * The demo viewer uses this to distinguish pages in multi-page demos.
   */
  slug:     string;

  /** Human-readable page title, shown in the viewer tab bar */
  title:    string;

  /**
   * Page template — controls which context slots (hero / cta) are expected.
   *   "marketing-page" — hero (before-content) + cta (after-content) slots
   *   "landing-page"   — hero (before-content) + cta (after-content), no proof slot
   *   "article-page"   — no context slots; pure content block array
   */
  template: "marketing-page" | "landing-page" | "article-page";

  /** SEO metadata for this page */
  seo?: {
    title?:       string;
    description?: string;
  };

  /**
   * Ordered block list.
   * The mapper preserves this order. Blocks of type "hero" render before all
   * content blocks; "cta" blocks render after all content blocks.
   */
  blocks: DemoBlockSpec[];
}

// ── Theme spec ────────────────────────────────────────────────────────────────

/**
 * Theme proposal derived from brand signal extraction (demo/analyzer.ts).
 * All colour values are CSS hex strings, e.g. "#3b82f6".
 * Applied as CSS custom properties by the DemoViewer component.
 */
export interface DemoThemeSpec {
  primaryColor:    string;
  secondaryColor:  string;
  textColor:       string;
  surfaceColor:    string;
  /** Detected heading font family, e.g. "Inter" */
  headingFont?:    string;
  /** Detected body font family, e.g. "Inter" */
  bodyFont?:       string;
  /** Google Fonts CSS URL for the detected fonts */
  googleFontsUrl?: string;
  borderRadius:    "none" | "sm" | "md" | "lg" | "full";
  headerVariant:   "header_default" | "header_centered" | "header_cta";
}

// ── Site meta ─────────────────────────────────────────────────────────────────

/** Site-level metadata for the demo, derived from SiteAnalysis */
export interface DemoSiteMeta {
  siteName:         string;
  siteUrl:          string;
  category:         SiteCategory;
  /** Primary language detected from the source site */
  detectedLanguage: DemoLanguage;
  faviconUrl?:      string;
  logoUrl?:         string;
}

// ── Site spec ─────────────────────────────────────────────────────────────────

/**
 * The complete demo output contract — top-level type produced by the generator
 * and persisted in the `demo_instances` table as part of the v2 content columns.
 *
 * A DemoSiteSpec can contain multiple pages (e.g. homepage + /pricing + /careers).
 * The demo viewer renders the first page by default and provides a tab bar for
 * switching between pages.
 */
export interface DemoSiteSpec {
  meta:      DemoSiteMeta;
  theme:     DemoThemeSpec;
  /**
   * Ordered list of pages. The first page is the default view.
   * Typically: ["/", "/pricing", "/careers"] for a SaaS demo.
   */
  pages:     DemoPageSpec[];
  /** Languages for which content has been generated */
  languages: DemoLanguage[];
}

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRY CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Default variant key for each demo block type.
 * Used by the mapper when the spec's variant is absent, empty, or fails
 * Chameleon validation (resolveBlockVariant returns "default").
 *
 * These defaults are chosen for their visual impact in a demo context:
 * - feature_grid_4up shows 4 cards — more impressive than 3-up for most demos
 * - hero_split provides an image panel slot — higher visual quality than hero_default
 * - testimonial_highlight foregrounds the strongest quote
 */
export const DEMO_BLOCK_DEFAULT_VARIANTS: Record<DemoBlockType, string> = {
  hero:           "hero_split",
  features:       "feature_grid_4up",
  stats:          "default",
  testimonials:   "testimonial_highlight",
  logos:          "muted",
  case_highlight: "default",
  cta:            "cta_split",
  pricing:        "pricing_tiers",
  careers:        "content_default",
  contact:        "contact_default",
  text:           "text_split",
  faq:            "faq_default",
  process:        "default",
} as const;

/**
 * Maps each DemoBlockType to its corresponding Chameleon block type string.
 *
 * "hero" and "cta" map to context slot IDs ("hero" / "cta").
 * All others map to ContentBlockType keys used in the ContentBlock discriminated union.
 *
 * Note: "careers" maps to "contentSection" — the mapper expands it to two blocks
 * (contentSection + listing) to support the intro copy + role cards layout.
 */
export const DEMO_BLOCK_TO_CHAMELEON: Record<DemoBlockType, string> = {
  hero:           "hero",              // context slot
  features:       "featureGrid",
  stats:          "stats",
  testimonials:   "testimonialSection",
  logos:          "logoStrip",
  case_highlight: "caseHighlight",
  cta:            "cta",               // context slot (+ ctaSection content fallback)
  pricing:        "pricingSection",
  careers:        "contentSection",    // expands to contentSection + listing
  contact:        "contactSection",
  text:           "textSection",
  faq:            "faqSection",
  process:        "processSteps",
} as const;

/**
 * Returns true when the block type maps to an adaptive context slot (hero or cta)
 * rather than a static content block.
 *
 * Context blocks require both a ResolvedContextSlot record and a HeroBlockData /
 * CTABlockData payload. The mapper handles them separately from content blocks.
 */
export function isContextBlock(type: DemoBlockType): type is "hero" | "cta" {
  return type === "hero" || type === "cta";
}

/**
 * Returns the set of DemoBlockTypes that are valid for demos of the given site
 * category. Used by the AI prompt builder to exclude irrelevant block types.
 *
 *   b2b_saas    — pricing is almost always relevant; careers optional
 *   agency      — case_highlight is core; pricing rare
 *   ecommerce   — logos + testimonials are core; pricing shown as tiers
 *   recruitment — careers block is core; contact is important
 *   general     — conservative selection; omit pricing + careers by default
 */
export function getRelevantBlockTypes(category: string): DemoBlockType[] {
  const shared: DemoBlockType[] = ["hero", "features", "stats", "testimonials", "cta"];
  const extras: Record<string, DemoBlockType[]> = {
    b2b_saas:    ["logos", "case_highlight", "pricing", "faq"],
    agency:      ["case_highlight", "process", "contact"],
    ecommerce:   ["logos", "faq", "contact"],
    recruitment: ["careers", "process", "contact"],
    general:     ["contact", "faq"],
  };
  return [...shared, ...(extras[category] ?? extras.general)];
}
