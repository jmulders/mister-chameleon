/**
 * Site Starters Catalog
 *
 * A starter is a pre-configured, use-case-driven template bundle that combines
 * three independent concerns into a single actionable choice for the operator:
 *
 *   siteTypeKey  — structural archetype  (corporate | saas | recruitment | …)
 *   themeKey     — visual identity       (dark-ai | clean-corporate | …)
 *   blueprintKey — behavioral scaffold   (dark_ai_saas | careers_platform | …)
 *
 * ─── Why starters? ───────────────────────────────────────────────────────────
 *
 *   Asking an operator to first choose a "site type", then a "theme", then a
 *   "blueprint" creates three sequential decisions with little mental model.
 *   Starters collapse that into one meaningful choice: "What am I building?"
 *
 *   The underlying three-way model is preserved — the starter just provides
 *   a sensible default tuple.  Operators can adjust theme and blueprint
 *   independently after initialization.
 *
 * ─── Model position ──────────────────────────────────────────────────────────
 *
 *   Starters live at the UX layer, not the data layer.  They are purely
 *   presentational shortcuts.  Nothing in the runtime system references a
 *   starter key — only the three resolved values (siteTypeKey, themeKey,
 *   blueprintKey) are ever persisted or acted upon.
 *
 * ─── Blueprint coverage ──────────────────────────────────────────────────────
 *
 *   Starters 1–5 map to purpose-built blueprints.
 *   Starters 6–8 reference the closest available blueprint for behavioral rules
 *   and scoring logic; a dedicated blueprint improves fit but is not required
 *   for the starter to be useful.
 *
 * ─── Adding a new starter ────────────────────────────────────────────────────
 *
 *   1. Define a new SiteStarter object below with a unique key.
 *   2. Add it to SITE_STARTERS in the desired sortOrder position.
 *   3. Drop a 480×320 preview image at
 *      /public/images/starters/<key>.png  (optional but recommended).
 */

import type { SiteType }       from "./site-presets";
import type { ThemePresetKey } from "@/design-system/theme/presets";

// ── Type ──────────────────────────────────────────────────────────────────────

/**
 * A use-case-driven starter template bundle.
 *
 * key                 — Stable machine-readable identifier (snake_case).
 * label               — Short display name shown on the card.
 * tagline             — One-line value proposition (≤ 6 words).
 * description         — Two-sentence description shown under the tagline.
 * siteTypeKey         — Structural archetype resolved from this starter.
 * themeKey            — Visual identity resolved from this starter.
 * blueprintKey        — Behavioral scaffold resolved from this starter.
 *                       May reference a purpose-built or closest-fit blueprint.
 * recommendedUseCases — Short use-case chips shown on the card.
 * previewImage        — Path (relative to /public) for the card thumbnail.
 *                       Falls back to a generated placeholder when absent.
 * sortOrder           — Position in the display grid (1-indexed, ascending).
 */
export interface SiteStarter {
  readonly key:                 string;
  readonly label:               string;
  readonly tagline:             string;
  readonly description:         string;
  readonly siteTypeKey:         SiteType;
  readonly themeKey:            ThemePresetKey;
  readonly blueprintKey:        string;
  readonly recommendedUseCases: readonly string[];
  readonly previewImage?:       string;
  readonly sortOrder:           number;
}

// ── Catalog ───────────────────────────────────────────────────────────────────

/**
 * The eight use-case-driven starter bundles.
 *
 * Ordered by sortOrder — display this array as-is in the UI grid.
 */
export const SITE_STARTERS: readonly SiteStarter[] = [

  // ── 1. AI Product Landing ─────────────────────────────────────────────────
  //
  // Audience:  AI tool builders, ML platform teams, developer API vendors.
  // Goal:      Convert engineers and technical buyers with precision,
  //            depth-first content, and a dark-mode authority aesthetic.
  // Blueprint: dark_ai_saas — high-intent CTAs, technical proof, depth scoring.
  // Theme:     dark-ai — near-black, indigo-violet, Manrope headings, glow.

  {
    key:                 "ai_product_landing",
    label:               "AI Product",
    tagline:             "Launch fast. Convert engineers.",
    description:         "Premium dark-mode setup for AI tools, developer APIs, and ML infrastructure. " +
                         "Built for technical buyers who need depth before they decide.",
    siteTypeKey:         "saas",
    themeKey:            "dark-ai",
    blueprintKey:        "dark_ai_saas",
    recommendedUseCases: ["AI / ML product", "Developer tool", "API platform"],
    previewImage:        "/images/starters/ai_product_landing.png",
    sortOrder:           1,
  },

  // ── 2. B2B Lead Generation ────────────────────────────────────────────────
  //
  // Audience:  B2B marketers, demand-gen teams, professional services firms.
  // Goal:      Capture qualified leads — hero → features → testimonials → CTA.
  // Blueprint: clean_corporate_saas — trust-first, sky-blue, balanced layout.
  // Theme:     clean-corporate — white, sky-blue, structured, clear hierarchy.

  {
    key:                 "b2b_lead_generation",
    label:               "B2B Lead Gen",
    tagline:             "Qualify buyers. Book meetings.",
    description:         "Clean, structured layout built for inbound lead capture. " +
                         "Guides prospects from first impression to a conversion event.",
    siteTypeKey:         "corporate",
    themeKey:            "clean-corporate",
    blueprintKey:        "clean_corporate_saas",
    recommendedUseCases: ["B2B marketing", "Lead generation", "Professional services"],
    previewImage:        "/images/starters/b2b_lead_generation.png",
    sortOrder:           2,
  },

  // ── 3. Product-Led SaaS ───────────────────────────────────────────────────
  //
  // Audience:  PLG SaaS teams, self-serve product builders, integration hubs.
  // Goal:      Drive free-trial signups through feature depth and editorial
  //            architecture — integrations strip, changelog, deep docs linking.
  // Blueprint: structured_saas — hairline borders, amber warm, deep content.
  // Theme:     structured-saas — warm stone, amber-orange, Plus Jakarta Sans.

  {
    key:                 "product_led_saas",
    label:               "Product-Led SaaS",
    tagline:             "Self-serve from landing to signup.",
    description:         "Editorial-product aesthetic with deep content structure and integrations focus. " +
                         "Amber warm tones, hairline borders, and feature-depth architecture.",
    siteTypeKey:         "saas",
    themeKey:            "structured-saas",
    blueprintKey:        "structured_saas",
    recommendedUseCases: ["PLG / self-serve SaaS", "Integrations directory", "Product docs"],
    previewImage:        "/images/starters/product_led_saas.png",
    sortOrder:           3,
  },

  // ── 4. Enterprise SaaS ────────────────────────────────────────────────────
  //
  // Audience:  Enterprise SaaS vendors, IT services firms, vendors with long
  //            sales cycles and multiple buying-committee stakeholders.
  // Goal:      Build institutional trust — ROI stats, case studies, compliance
  //            badges — and direct high-intent visitors to a sales call.
  // Blueprint: b2b_saas — pricing-intent detection, progressive CTAs.
  // Theme:     corporate-trust — authoritative, dark navy, trust-forward.

  {
    key:                 "enterprise_saas",
    label:               "Enterprise SaaS",
    tagline:             "Close deals with trust signals.",
    description:         "Authority-first layout for complex B2B deals: ROI stats, case studies, " +
                         "compliance badges, and a clear path to a sales conversation.",
    siteTypeKey:         "saas",
    themeKey:            "corporate-trust",
    blueprintKey:        "b2b_saas",
    recommendedUseCases: ["Enterprise sales", "IT services", "Long sales-cycle SaaS"],
    previewImage:        "/images/starters/enterprise_saas.png",
    sortOrder:           4,
  },

  // ── 5. Careers Platform ───────────────────────────────────────────────────
  //
  // Audience:  In-house recruitment teams, employer-brand managers,
  //            staffing agencies, werken-bij builders.
  // Goal:      Guide candidates through the application journey using adaptive
  //            personalization — awareness → vacancy explorer → high-intent → applied.
  // Blueprint: careers_platform — candidate journey model, application scoring.
  // Theme:     careers-human — warm, accessible, employer-brand forward.

  {
    key:                 "careers_platform",
    label:               "Careers Platform",
    tagline:             "Attract candidates. Build culture.",
    description:         "Employer brand and vacancy site with candidate journey personalization. " +
                         "Guides applicants from awareness to submitted application.",
    siteTypeKey:         "recruitment",
    themeKey:            "careers-human",
    blueprintKey:        "careers_platform",
    recommendedUseCases: ["Recruitment site", "Employer branding", "Werken-bij"],
    previewImage:        "/images/starters/careers_platform.png",
    sortOrder:           5,
  },

  // ── 6. Content & Blog ─────────────────────────────────────────────────────
  //
  // Audience:  Media companies, thought-leadership publishers, company blogs.
  // Goal:      Establish authority through editorial content — news feed,
  //            article detail, category pages, email CTA.
  // Blueprint: marketing_agency — brand + editorial scoring rules; closest fit.
  //            A dedicated content blueprint would further improve personalization.
  // Theme:     editorial-classic — typographic, serif-led, structured editorial.

  {
    key:                 "content_blog",
    label:               "Content & Blog",
    tagline:             "Publish, distribute, grow.",
    description:         "Editorial-first layout with news feed, article detail, and audience CTAs. " +
                         "Designed to build authority and drive newsletter or social follows.",
    siteTypeKey:         "content",
    themeKey:            "editorial-classic",
    blueprintKey:        "marketing_agency",
    recommendedUseCases: ["Media", "Company blog", "Thought leadership"],
    previewImage:        "/images/starters/content_blog.png",
    sortOrder:           6,
  },

  // ── 7. DTC Store ─────────────────────────────────────────────────────────
  //
  // Audience:  Direct-to-consumer brands, lifestyle / fashion shops,
  //            single-product or small-catalog stores.
  // Goal:      Tell the brand story, showcase product photography, and drive
  //            purchase through an emotional and visceral shopping experience.
  // Blueprint: marketing_agency — brand-led conversion patterns; closest fit.
  //            A dedicated ecommerce blueprint would add cart / PDP scoring.
  // Theme:     bold-marketing — vivid accent, conversion-forward, brand-confident.

  {
    key:                 "ecommerce_dtc",
    label:               "DTC Store",
    tagline:             "Brand story. Product love. Buy.",
    description:         "Direct-to-consumer storefront with brand story, product photography focus, " +
                         "and a streamlined checkout path.",
    siteTypeKey:         "shop",
    themeKey:            "bold-marketing",
    blueprintKey:        "marketing_agency",
    recommendedUseCases: ["DTC ecommerce", "Fashion / lifestyle", "Consumer brand"],
    previewImage:        "/images/starters/ecommerce_dtc.png",
    sortOrder:           7,
  },

  // ── 8. Performance Shop ───────────────────────────────────────────────────
  //
  // Audience:  Multi-product shops, B2C retailers prioritizing conversion rate,
  //            high-volume catalog stores.
  // Goal:      Maximize add-to-cart and purchase rate through minimal design,
  //            clear product hierarchy, and prominent trust signals.
  // Blueprint: b2b_saas — conversion scoring and intent-detection patterns are
  //            transferable; dedicated ecommerce blueprint will sharpen this.
  // Theme:     minimal-neutral — clean, uncluttered, letting the product lead.

  {
    key:                 "ecommerce_performance",
    label:               "Performance Shop",
    tagline:             "Minimize friction. Maximize carts.",
    description:         "Conversion-optimized shop with clean product hierarchy, fast-loading layouts, " +
                         "and trust signals that reduce hesitation before checkout.",
    siteTypeKey:         "shop",
    themeKey:            "minimal-neutral",
    blueprintKey:        "b2b_saas",
    recommendedUseCases: ["High-volume ecommerce", "B2C performance", "Multi-product catalog"],
    previewImage:        "/images/starters/ecommerce_performance.png",
    sortOrder:           8,
  },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all site starters in canonical sort order.
 */
export function getAllStarters(): readonly SiteStarter[] {
  return SITE_STARTERS;
}

/**
 * Returns the starter for the given key, or undefined.
 *
 * @example
 * findStarterByKey("ai_product_landing")?.themeKey  // "dark-ai"
 */
export function findStarterByKey(key: string): SiteStarter | undefined {
  return SITE_STARTERS.find((s) => s.key === key);
}

/**
 * Returns all starters for a given site type.
 *
 * @example
 * getStartersBySiteType("saas")  // ai_product_landing, product_led_saas, enterprise_saas
 */
export function getStartersBySiteType(siteTypeKey: SiteType): SiteStarter[] {
  return SITE_STARTERS.filter((s) => s.siteTypeKey === siteTypeKey);
}
