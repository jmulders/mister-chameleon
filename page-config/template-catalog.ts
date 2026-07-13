/**
 * Template Catalog
 *
 * Defines the full set of page "templates" operators can include in a starter
 * site.  Each entry maps a logical page purpose (e.g. "home", "news-listing")
 * to the PagePreset used during provisioning and the UX metadata shown in the
 * site-setup checklist.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   Site types (site-presets.ts) are starter presets that recommend a subset
 *   of catalog entries.  Operators freely add or remove entries on top of those
 *   recommendations.
 *
 *   The selected catalog keys are persisted as `selectedTemplates` on
 *   TenantSettings — the authoritative provisioning input for createSiteAction.
 *   The site type is preserved as metadata only.
 *
 * ─── Per-site-type preset overrides ──────────────────────────────────────────
 *
 *   The "home" entry uses different PagePresets for recruitment vs corporate /
 *   content sites.  siteTypePresets provides that mapping so a single "home"
 *   catalog key can still resolve to the right preset at provisioning time.
 *
 * ─── Extending ────────────────────────────────────────────────────────────────
 *
 *   1. Add the new key to TemplateCatalogKey in tenant/types.ts.
 *   2. Add a PagePreset entry in page-presets.ts.
 *   3. Add a TemplateCatalogEntry here.
 *   4. Optionally add the key to the relevant SitePreset.recommendedTemplates
 *      in site-presets.ts.
 *   Done.
 */

import type { TemplateCatalogKey } from "@/tenant/types";
import type { SiteType }           from "./site-presets";

// ── Template preview type ─────────────────────────────────────────────────────

/**
 * Visual preview schematic type used by TemplatePreview to render an SVG
 * thumbnail of the page's structural layout.
 *
 * marketing — hero + proof strip + content blocks + cta banner
 * landing   — hero + content blocks + cta (no proof; focused conversion)
 * article   — article meta header + long-form content blocks
 * listing   — intro header + card grid (news, cases, vacancies, team)
 * detail    — entity meta header (image + title/meta) + body content
 */
export type TemplatePreviewType =
  | "marketing"
  | "landing"
  | "article"
  | "listing"
  | "detail";

// ── Catalog category ──────────────────────────────────────────────────────────

/**
 * Visual grouping category for the template selector checklist.
 *
 * core        — pages every site should have (home, contact)
 * news        — editorial / content marketing (news listing + article detail)
 * cases       — client case studies (cases listing + case detail)
 * recruitment — hiring pages (vacancies listing + vacancy detail)
 * events      — event pages (event listing + event detail)
 * utility     — supplemental pages (about, services, landing, team, faq)
 * shop        — e-commerce pages (shop home, product listing, product detail, cart, checkout)
 */
export type TemplateCatalogCategory =
  | "core"
  | "news"
  | "cases"
  | "recruitment"
  | "events"
  | "utility"
  | "shop";

/** Human-readable label for each category, used in the selector UI. */
export const TEMPLATE_CATALOG_CATEGORY_LABELS: Record<TemplateCatalogCategory, string> = {
  core:        "Core pages",
  news:        "News & editorial",
  cases:       "Case studies",
  recruitment: "Recruitment",
  events:      "Events",
  utility:     "Utility pages",
  shop:        "Shop & commerce",
};

// ── Catalog entry ─────────────────────────────────────────────────────────────

/**
 * A single entry in the template catalog.
 *
 * key               — Unique identifier (TemplateCatalogKey, defined in tenant/types.ts).
 * label             — Short display name shown in the selector checklist.
 * description       — One-sentence description of the page's purpose.
 * category          — Visual grouping for the checklist UI.
 * presetKey         — Default PAGE_PRESETS key used when provisioning this page.
 * siteTypePresets   — Optional per-site-type preset override map.  When the active
 *                     SiteType matches a key here, that presetKey is used instead of
 *                     the default.  Used by "home" to serve different preset structures
 *                     for recruitment vs corporate/content sites.
 * defaultTitle      — Page title written to the provisioned page.
 * defaultSlug       — URL slug for the provisioned page (no leading slash;
 *                     empty string = homepage).
 * required          — When true, the entry is always included and cannot be deselected
 *                     in the template selector UI.
 * previewType       — Which SVG schematic to render in the template preview card.
 *                     Determines the structural layout diagram shown to operators.
 * slots             — Human-readable ordered list of page sections shown in the
 *                     selector card (e.g. ["Hero", "Proof", "Content blocks", "CTA"]).
 */
export interface TemplateCatalogEntry {
  readonly key:              TemplateCatalogKey;
  readonly label:            string;
  readonly description:      string;
  readonly category:         TemplateCatalogCategory;
  readonly presetKey:        string;
  readonly siteTypePresets?: Partial<Record<SiteType, string>>;
  readonly defaultTitle:     string;
  readonly defaultSlug:      string;
  readonly required:         boolean;
  readonly previewType:      TemplatePreviewType;
  readonly slots:            readonly string[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * The full ordered template catalog.
 *
 * Category order: core → news → cases → recruitment → utility.
 * Within each category, entries are in the order shown in the selector UI.
 */
export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [

  // ── Core ──────────────────────────────────────────────────────────────────

  {
    key:         "home",
    label:       "Home",
    description: "Main landing page of your site.",
    category:    "core",
    // Corporate and content sites use the full marketing homepage.
    // Recruitment sites get the recruitment-optimised homepage variant.
    presetKey:       "homepage_corporate",
    siteTypePresets: { recruitment: "homepage_recruitment" },
    defaultTitle:    "Home",
    defaultSlug:     "",
    required:        true,
    previewType:     "marketing",
    slots:           ["Hero", "Proof", "Content blocks", "CTA"],
  },

  {
    key:          "contact",
    label:        "Contact",
    description:  "Contact page with a hero, intro section, and a form.",
    category:     "core",
    presetKey:    "contact_default",
    defaultTitle: "Contact",
    defaultSlug:  "contact",
    required:     false,
    previewType:  "landing",
    slots:        ["Hero", "Content blocks", "CTA"],
  },

  // ── News & editorial ──────────────────────────────────────────────────────

  {
    key:          "news-listing",
    label:        "News listing",
    description:  "News or blog archive — intro heading and a card grid of articles.",
    category:     "news",
    presetKey:    "listing_news",
    defaultTitle: "News",
    defaultSlug:  "news",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Article card grid"],
  },

  {
    key:          "news-detail",
    label:        "Article detail",
    description:  "Individual news article — meta header, body content, and related articles.",
    category:     "news",
    presetKey:    "detail_article",
    defaultTitle: "Article Detail",
    defaultSlug:  "news/article",
    required:     false,
    previewType:  "article",
    slots:        ["Article meta header", "Body content", "Related articles"],
  },

  // ── Case studies ──────────────────────────────────────────────────────────

  {
    key:          "cases-listing",
    label:        "Case studies listing",
    description:  "Client case studies archive — intro heading and a card grid.",
    category:     "cases",
    presetKey:    "listing_cases",
    defaultTitle: "Cases",
    defaultSlug:  "cases",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Case study card grid"],
  },

  {
    key:          "case-detail",
    label:        "Case study detail",
    description:  "Single case study — meta header, body content, and related cases.",
    category:     "cases",
    presetKey:    "detail_case",
    defaultTitle: "Case Detail",
    defaultSlug:  "cases/case",
    required:     false,
    previewType:  "detail",
    slots:        ["Entity meta header", "Body content", "Related cases"],
  },

  // ── Recruitment ───────────────────────────────────────────────────────────

  {
    key:          "vacancies-listing",
    label:        "Vacancies listing",
    description:  "Job board — filter bar and a card grid of open vacancies.",
    category:     "recruitment",
    presetKey:    "listing_vacancies",
    defaultTitle: "Jobs",
    defaultSlug:  "jobs",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Filter bar", "Vacancy card grid"],
  },

  {
    key:          "vacancy-detail",
    label:        "Vacancy detail",
    description:  "Single vacancy — meta header, apply panel, and related vacancies.",
    category:     "recruitment",
    presetKey:    "detail_vacancy",
    defaultTitle: "Vacancy Detail",
    defaultSlug:  "jobs/vacancy",
    required:     false,
    previewType:  "detail",
    slots:        ["Vacancy meta header", "Apply panel", "Related vacancies"],
  },

  // ── Utility pages ─────────────────────────────────────────────────────────

  {
    key:          "about",
    label:        "About",
    description:  "Company story with a hero, alternating media sections, and a CTA.",
    category:     "utility",
    presetKey:    "about_default",
    defaultTitle: "About Us",
    defaultSlug:  "about",
    required:     false,
    previewType:  "marketing",
    slots:        ["Hero", "Proof", "Content blocks", "CTA"],
  },

  {
    key:          "services",
    label:        "Services",
    description:  "Services overview page — hero, feature grid, and a closing CTA.",
    category:     "utility",
    presetKey:    "services_default",
    defaultTitle: "Services",
    defaultSlug:  "services",
    required:     false,
    previewType:  "marketing",
    slots:        ["Hero", "Feature grid", "CTA"],
  },

  {
    key:          "team",
    label:        "Team",
    description:  "Team overview page — intro heading and a card grid of team members from the team_members collection.",
    category:     "utility",
    presetKey:    "listing_team",
    defaultTitle: "Team",
    defaultSlug:  "team",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Team member grid"],
  },

  {
    key:          "faq",
    label:        "FAQ",
    description:  "Frequently asked questions — hero and accordion FAQ section.",
    category:     "utility",
    presetKey:    "faq_default",
    defaultTitle: "FAQ",
    defaultSlug:  "faq",
    required:     false,
    previewType:  "landing",
    slots:        ["Hero", "FAQ accordion", "CTA"],
  },

  {
    key:          "landing",
    label:        "Landing page",
    description:  "Focused conversion page — hero and a closing CTA.",
    category:     "utility",
    presetKey:    "landing_default",
    defaultTitle: "Landing",
    defaultSlug:  "landing",
    required:     false,
    previewType:  "landing",
    slots:        ["Hero", "Content blocks", "CTA"],
  },

  // ── Template registry additions ────────────────────────────────────────────
  //
  // The entries below back the new TemplateRegistryEntry records in
  // page-config/template-registry.ts.  They reuse the nearest matching
  // PagePreset so provisioning produces a sensible starter page.
  //
  // presetKey notes:
  //   content-page    → about_default (hero+proof+cta + content blocks)
  //   listing-generic → listing_news  (intro header + card grid structure)
  //   detail-generic  → detail_article (meta header + body content)
  //   basic-page      → landing_default (hero + CTA, simplest structure)
  //   sector-page     → services_default (hero+proof+features+cta)
  //   comparison-page → landing_default (hero + CTA, operator fills blocks)
  //   team-detail     → about_default (image + rich bio content)
  //   event-page      → landing_default (hero + conversion CTA)

  {
    key:          "content-page",
    label:        "Content page",
    description:  "General purpose editorial page — rich-text content blocks, no adaptive slots.",
    category:     "utility",
    presetKey:    "about_default",
    defaultTitle: "Content",
    defaultSlug:  "content",
    required:     false,
    previewType:  "article",
    slots:        ["Content blocks"],
  },

  {
    key:          "listing-generic",
    label:        "Listing page",
    description:  "Generic listing — intro header and a card grid of items.",
    category:     "utility",
    presetKey:    "listing_news",
    defaultTitle: "Listing",
    defaultSlug:  "listing",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Card grid"],
  },

  {
    key:          "detail-generic",
    label:        "Detail page",
    description:  "Generic entity detail — meta header, body content, and optional related items.",
    category:     "utility",
    presetKey:    "detail_article",
    defaultTitle: "Detail",
    defaultSlug:  "detail",
    required:     false,
    previewType:  "detail",
    slots:        ["Entity meta header", "Body content"],
  },

  {
    key:          "basic-page",
    label:        "Basic page",
    description:  "Minimal page — content blocks only, no adaptive slots.",
    category:     "utility",
    presetKey:    "landing_default",
    defaultTitle: "Page",
    defaultSlug:  "page",
    required:     false,
    previewType:  "article",
    slots:        ["Content blocks"],
  },

  {
    key:          "sector-page",
    label:        "Sector page",
    description:  "Industry or sector-specific landing — hero, features, trust signals, and CTA.",
    category:     "utility",
    presetKey:    "services_default",
    defaultTitle: "Sector",
    defaultSlug:  "sector",
    required:     false,
    previewType:  "marketing",
    slots:        ["Hero", "Feature highlight", "Trust signal", "CTA"],
  },

  {
    key:          "comparison-page",
    label:        "Comparison page",
    description:  "Product or plan comparison — hero, comparison blocks, and a conversion section.",
    category:     "utility",
    presetKey:    "landing_default",
    defaultTitle: "Compare",
    defaultSlug:  "compare",
    required:     false,
    previewType:  "landing",
    slots:        ["Hero", "Conversion"],
  },

  {
    key:          "team-detail",
    label:        "Team member detail",
    description:  "Individual team member — photo, bio, credentials, and related content.",
    category:     "utility",
    presetKey:    "about_default",
    defaultTitle: "Team Member",
    defaultSlug:  "team/member",
    required:     false,
    previewType:  "detail",
    slots:        ["Entity meta header", "Body content"],
  },

  // ── Events ───────────────────────────────────────────────────────────────

  {
    key:          "event-listing",
    label:        "Events listing",
    description:  "Upcoming events archive — intro heading and a card grid of events.",
    category:     "events",
    presetKey:    "listing_events",
    defaultTitle: "Events",
    defaultSlug:  "events",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Event card grid"],
  },

  {
    key:          "event-detail",
    label:        "Event detail",
    description:  "Single event page — hero, event details, and a registration CTA.",
    category:     "events",
    presetKey:    "detail_event",
    defaultTitle: "Event",
    defaultSlug:  "events/event",
    required:     false,
    previewType:  "marketing",
    slots:        ["Hero", "Event details", "Registration CTA"],
  },

  // ── Shop & commerce ───────────────────────────────────────────────────────

  {
    key:             "shop-home",
    label:           "Shop home",
    description:     "E-commerce homepage — hero, product overview grid, feature highlights, testimonials, and a CTA.",
    category:        "shop",
    presetKey:       "homepage_shop",
    siteTypePresets: { shop: "homepage_shop" },
    defaultTitle:    "Home",
    defaultSlug:     "",
    required:        false,
    previewType:     "marketing",
    slots:           ["Hero", "Product grid", "Feature grid", "Testimonials", "CTA"],
  },

  {
    key:          "products-listing",
    label:        "Product listing",
    description:  "Product catalogue — intro heading, product overview grid, and a closing CTA.",
    category:     "shop",
    presetKey:    "product_listing_page",
    defaultTitle: "Products",
    defaultSlug:  "products",
    required:     false,
    previewType:  "listing",
    slots:        ["Intro header", "Product card grid", "CTA"],
  },

  {
    key:          "product-detail",
    label:        "Product detail",
    description:  "Single product page — gallery, specs table, price, add-to-cart CTA, and related products.",
    category:     "shop",
    presetKey:    "product_detail_page",
    defaultTitle: "Product Detail",
    defaultSlug:  "products/product",
    required:     false,
    previewType:  "detail",
    slots:        ["Gallery", "Product copy & specs", "Related products"],
  },

  {
    key:          "cart",
    label:        "Cart",
    description:  "Shopping cart — cart summary with proceed-to-checkout and continue-shopping actions.",
    category:     "shop",
    presetKey:    "cart_page",
    defaultTitle: "Cart",
    defaultSlug:  "cart",
    required:     false,
    previewType:  "landing",
    slots:        ["Cart summary", "Actions"],
  },

  {
    key:          "checkout",
    label:        "Checkout",
    description:  "Checkout page — payment provider placeholder ready for Stripe, Mollie, or PayPal.",
    category:     "shop",
    presetKey:    "checkout_page",
    defaultTitle: "Checkout",
    defaultSlug:  "checkout",
    required:     false,
    previewType:  "landing",
    slots:        ["Checkout form", "Payment placeholder"],
  },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * O(1) lookup map keyed by TemplateCatalogKey.
 */
export const TEMPLATE_CATALOG_MAP: Readonly<Record<TemplateCatalogKey, TemplateCatalogEntry>> =
  Object.fromEntries(
    TEMPLATE_CATALOG.map((e) => [e.key, e]),
  ) as Readonly<Record<TemplateCatalogKey, TemplateCatalogEntry>>;

/**
 * Returns the catalog entry for the given key, or undefined for unknown keys.
 * Safe to call with untrusted input — never throws.
 */
export function getTemplateCatalogEntry(key: string): TemplateCatalogEntry | undefined {
  return (TEMPLATE_CATALOG_MAP as Record<string, TemplateCatalogEntry>)[key];
}

/**
 * Returns all catalog entries in canonical order.
 */
export function getAllTemplateCatalogEntries(): readonly TemplateCatalogEntry[] {
  return TEMPLATE_CATALOG;
}

/**
 * Returns catalog entries grouped by category, in UI display order.
 * Category order: core → news → cases → recruitment → events → utility → shop.
 */
export function getTemplateCatalogByCategory(): Map<TemplateCatalogCategory, TemplateCatalogEntry[]> {
  const order: TemplateCatalogCategory[] = ["core", "news", "cases", "recruitment", "events", "utility", "shop"];
  const map = new Map<TemplateCatalogCategory, TemplateCatalogEntry[]>(
    order.map((cat) => [cat, []]),
  );
  for (const entry of TEMPLATE_CATALOG) {
    map.get(entry.category)!.push(entry);
  }
  return map;
}

/**
 * Resolves the PagePreset key for a catalog entry given the active site type.
 *
 * Uses entry.siteTypePresets[siteType] when available; falls back to
 * entry.presetKey.  This is how the "home" entry serves different preset
 * structures for different site archetypes.
 *
 * @example
 * resolvePresetKey(TEMPLATE_CATALOG_MAP["home"], "recruitment")
 * // → "homepage_recruitment"
 *
 * resolvePresetKey(TEMPLATE_CATALOG_MAP["home"], "corporate")
 * // → "homepage_corporate"
 */
export function resolvePresetKey(entry: TemplateCatalogEntry, siteType: string): string {
  return entry.siteTypePresets?.[siteType as SiteType] ?? entry.presetKey;
}

/**
 * Converts a list of template catalog keys + a site type into provisioning
 * page entries compatible with the page-store and CMS provisioner.
 *
 * Unknown keys are silently skipped so stale stored values never crash
 * the provisioner.
 *
 * @param keys     TemplateCatalogKey[] chosen by the operator.
 * @param siteType The active SiteType, used to resolve siteTypePresets.
 * @returns        Ordered array of { presetKey, title, slug } entries.
 *
 * @example
 * templateKeysToPageEntries(["home", "contact", "news-listing"], "corporate")
 * // → [
 * //   { presetKey: "homepage_corporate", title: "Home",    slug: "" },
 * //   { presetKey: "contact_default",    title: "Contact", slug: "contact" },
 * //   { presetKey: "listing_news",       title: "News",    slug: "news" },
 * // ]
 */
export function templateKeysToPageEntries(
  keys:     readonly string[],
  siteType: string,
): Array<{ presetKey: string; title: string; slug: string }> {
  const results: Array<{ presetKey: string; title: string; slug: string }> = [];
  for (const key of keys) {
    const entry = getTemplateCatalogEntry(key);
    if (!entry) continue;
    results.push({
      presetKey: resolvePresetKey(entry, siteType),
      title:     entry.defaultTitle,
      slug:      entry.defaultSlug,
    });
  }
  return results;
}
