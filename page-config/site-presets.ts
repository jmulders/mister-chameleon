/**
 * Site Preset Registry
 *
 * Maps a site type (corporate | recruitment | content | shop | saas) to an
 * ordered set of page preset keys from PAGE_PRESETS.  Each site type produces a
 * complete starter site structure when applied by createSiteAction.
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   Site presets are grouping / ordering lenses over the page preset registry.
 *   They do NOT define new page templates or block types — they only specify
 *   which page presets to instantiate, in which order, with which slugs and
 *   titles.
 *
 *   Each SitePageEntry maps one preset key (from page-presets.ts) to the
 *   concrete title and slug that the page will have after instantiation.
 *   The slug must be unique within a tenant — the action layer checks for
 *   existing pages before writing (idempotency).
 *
 * ─── Model separation ────────────────────────────────────────────────────────
 *
 *   SiteType  — structural archetype (what kind of site is this?)
 *               corporate | recruitment | content | shop | saas
 *
 *   ThemePresetKey — visual identity (how does it look?)
 *                    dark-ai | clean-corporate | structured-saas | zinc | …
 *
 *   blueprintKey   — starter bundle (which pages/content scaffold to use?)
 *                    dark_ai_saas | clean_corporate_saas | structured_saas | …
 *
 *   When siteType === "saas", the admin wizard shows a "Quick starters" panel
 *   (see SAAS_STARTERS) where the operator picks a pre-bundled { siteTypeKey,
 *   themeKey, blueprintKey } tuple.  The three concerns stay cleanly separated
 *   inside that tuple.
 *
 * ─── Mapping ─────────────────────────────────────────────────────────────────
 *
 *   corporate   → Homepage (hero + feature grid + testimonials + CTA),
 *                 About page, Contact page, News listing, Article detail
 *
 *   recruitment → Homepage (hero + propositions + process + recruiter + CTA),
 *                 Vacancy listing, Vacancy detail, Contact page
 *
 *   content     → Homepage (hero + feature grid), News listing, Article detail,
 *                 About page, Contact page
 *
 *   saas        → Generic SaaS homepage, Platform, Pricing, Company, Contact
 *                 (operators typically pick a Quick Starter bundle instead)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 * @example
 * import { getSitePreset, SiteType } from "@/page-config";
 * const preset = getSitePreset("corporate");
 * preset.pages.forEach(entry => console.log(entry.slug, entry.presetKey));
 */

import type { TemplateCatalogKey } from "@/tenant/types";
import type { ThemePresetKey }     from "@/design-system/theme/presets";

// ── Site type ─────────────────────────────────────────────────────────────────

/**
 * The six canonical site archetypes.
 *
 * corporate   — Standard B2B / marketing site.
 * recruitment — Recruitment / talent-acquisition platform site.
 * content     — Content / media / news-focused site.
 * shop        — E-commerce / product shop site.
 * saas        — SaaS / software product site.
 * startup     — Startup / growth product site (modelled after the Sanity startup
 *               template: hero, logos, features, metrics, how-it-works, testimonials,
 *               pricing, team, FAQ).  Pairs well with the "structured-saas" or
 *               "dark-ai" theme preset.
 *
 * Note: Themes (dark-ai, clean-corporate, structured-saas …) and blueprints
 * (dark_ai_saas, careers_platform …) are separate concerns — see
 * design-system/theme/presets.ts and blueprints/blueprint-registry.ts.
 * Use-case-driven starter bundles that combine all three are defined in
 * page-config/starters.ts and presented in the admin setup wizard.
 */
export type SiteType =
  | "corporate"
  | "recruitment"
  | "content"
  | "shop"
  | "saas"
  | "startup";

// ── Sub-types ─────────────────────────────────────────────────────────────────

/**
 * A single page entry within a site preset.
 *
 * presetKey  — Key of the PagePreset (from PAGE_PRESETS) to instantiate.
 * title      — Human-readable page title written to the created EditablePage.
 * slug       — URL slug (no leading slash).  Must be unique per tenant.
 *              Used as the idempotency key: the action skips pages whose slug
 *              already exists for this tenant.
 */
export interface SitePageEntry {
  readonly presetKey: string;
  readonly title:     string;
  readonly slug:      string;
}

/**
 * A site preset definition.
 *
 * type                 — The SiteType identifier.
 * label                — Short human-readable name for the site type selector.
 * description          — One-sentence description shown below the label in the UI.
 * pages                — Ordered list of pages that will be created.
 *                        Listed in the order they appear in the site (homepage first,
 *                        utility pages, then listing / detail pages).
 *                        Used for legacy provisioning when selectedTemplates is absent.
 * recommendedTemplates — Ordered list of TemplateCatalogKey values pre-selected in the
 *                        template selector UI when this site type is chosen.
 *                        Operators may add or remove entries before confirming.
 *                        This becomes the selectedTemplates value stored on TenantSettings
 *                        and used as the authoritative provisioning input.
 * recommendedThemePreset — When set, createSiteAction applies this theme preset during
 *                          initialization.  Overrides the "zinc" default.
 */
export interface SitePreset {
  readonly type:                 SiteType;
  readonly label:                string;
  readonly description:          string;
  readonly pages:                readonly SitePageEntry[];
  readonly recommendedTemplates: readonly TemplateCatalogKey[];
  readonly recommendedThemePreset?: ThemePresetKey;
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * The ordered site preset registry.
 *
 * Presented in this order in the admin site type selector:
 *   Corporate → Recruitment → Content → Shop → SaaS
 */
export const SITE_PRESETS: readonly SitePreset[] = [

  // ── Corporate ─────────────────────────────────────────────────────────────

  {
    type:        "corporate",
    label:       "Corporate site",
    description: "Full B2B marketing site — homepage, about, contact, news listing, search, and article detail pages.",
    pages: [
      { presetKey: "homepage_corporate", title: "Home",            slug: ""             },
      { presetKey: "about_default",      title: "About Us",        slug: "about"        },
      { presetKey: "contact_default",    title: "Contact",         slug: "contact"      },
      { presetKey: "listing_news",       title: "News",            slug: "news"         },
      { presetKey: "detail_article",     title: "Article Detail",  slug: "news/article" },
      { presetKey: "search_default",     title: "Search",          slug: "search"       },
    ],
    recommendedTemplates: [
      "home", "about", "contact", "news-listing", "news-detail",
      "event-listing", "event-detail",
    ],
  },

  // ── Recruitment ───────────────────────────────────────────────────────────

  {
    type:        "recruitment",
    label:       "Recruitment site",
    description: "Talent-acquisition platform — homepage, vacancy listing, vacancy detail, search, and contact pages.",
    pages: [
      { presetKey: "homepage_recruitment", title: "Home",             slug: ""                },
      { presetKey: "contact_default",      title: "Contact",          slug: "contact"         },
      { presetKey: "listing_vacancies",    title: "Jobs",             slug: "jobs"            },
      { presetKey: "detail_vacancy",       title: "Vacancy Detail",   slug: "jobs/vacancy"    },
      { presetKey: "search_default",       title: "Search",           slug: "search"          },
    ],
    recommendedTemplates: [
      "home", "contact", "vacancies-listing", "vacancy-detail",
    ],
  },

  // ── Content ───────────────────────────────────────────────────────────────

  {
    type:        "content",
    label:       "Content site",
    description: "Content / media site — homepage, news listing, article detail, about, search, and contact pages.",
    pages: [
      { presetKey: "homepage_corporate", title: "Home",            slug: ""             },
      { presetKey: "listing_news",       title: "News",            slug: "news"         },
      { presetKey: "detail_article",     title: "Article Detail",  slug: "news/article" },
      { presetKey: "about_default",      title: "About Us",        slug: "about"        },
      { presetKey: "contact_default",    title: "Contact",         slug: "contact"      },
      { presetKey: "search_default",     title: "Search",          slug: "search"       },
    ],
    recommendedTemplates: [
      "home", "news-listing", "news-detail", "about", "contact",
      "event-listing", "event-detail",
    ],
  },

  // ── Shop ──────────────────────────────────────────────────────────────────

  {
    type:        "shop",
    label:       "Shop site",
    description: "E-commerce shop — shop homepage, product listing, product detail, cart, checkout, and contact pages.",
    pages: [
      { presetKey: "homepage_shop",        title: "Home",            slug: ""                  },
      { presetKey: "product_listing_page", title: "Products",        slug: "products"          },
      { presetKey: "product_detail_page",  title: "Product Detail",  slug: "products/product"  },
      { presetKey: "cart_page",            title: "Cart",            slug: "cart"              },
      { presetKey: "checkout_page",        title: "Checkout",        slug: "checkout"          },
      { presetKey: "contact_default",      title: "Contact",         slug: "contact"           },
    ],
    recommendedTemplates: [
      "shop-home", "products-listing", "product-detail", "cart", "checkout", "contact",
    ],
  },

  // ── SaaS ─────────────────────────────────────────────────────────────────
  //
  // Generic SaaS archetype.  In the wizard, operators are nudged toward one of
  // the three SAAS_STARTERS quick-start bundles (which also set themeKey and
  // blueprintKey).  This base preset is used when no starter is chosen, or as
  // the page-structure fallback for the saas site type.

  {
    type:        "saas",
    label:       "SaaS site",
    description: "Software / platform site — homepage, platform overview, pricing, company page, and contact.",
    pages: [
      { presetKey: "homepage_corporate", title: "Home",     slug: ""         },
      { presetKey: "services_default",   title: "Platform", slug: "platform" },
      { presetKey: "landing_default",    title: "Pricing",  slug: "pricing"  },
      { presetKey: "about_default",      title: "Company",  slug: "company"  },
      { presetKey: "contact_default",    title: "Contact",  slug: "contact"  },
    ],
    recommendedTemplates: [
      "home", "services", "landing", "about", "contact",
    ],
  },

  // ── Startup ───────────────────────────────────────────────────────────────
  //
  // Modelled after the Sanity startup template (startup-pro.demo.nextjstemplates.com).
  // Full startup marketing site: feature-rich homepage with logos, metrics,
  // how-it-works, pricing, and team; plus dedicated features, pricing, blog,
  // team, about, and contact pages.
  //
  // Recommended theme: "structured-saas" or "dark-ai".

  {
    type:        "startup",
    label:       "Startup site",
    description: "Growth-stage startup site — feature-rich homepage, features, pricing, blog, team, about, and contact pages.",
    recommendedThemePreset: "structured-saas",
    pages: [
      { presetKey: "homepage_startup",  title: "Home",     slug: ""          },
      { presetKey: "features_startup",  title: "Features", slug: "features"  },
      { presetKey: "pricing_startup",   title: "Pricing",  slug: "pricing"   },
      { presetKey: "blog_startup",      title: "Blog",     slug: "blog"      },
      { presetKey: "detail_article",    title: "Post",     slug: "blog/post" },
      { presetKey: "team_startup",      title: "Team",     slug: "team"      },
      { presetKey: "about_startup",     title: "Company",  slug: "company"   },
      { presetKey: "contact_startup",   title: "Contact",  slug: "contact"   },
    ],
    recommendedTemplates: [
      "home", "services", "landing", "news-listing", "news-detail", "about", "contact",
    ],
  },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * Keyed by SiteType for O(1) look-up.
 */
export const SITE_PRESET_MAP: Readonly<Partial<Record<SiteType, SitePreset>>> =
  Object.fromEntries(SITE_PRESETS.map((s) => [s.type, s])) as Readonly<Partial<Record<SiteType, SitePreset>>>;

/**
 * Returns the SitePreset for the given type, or undefined for unknown types.
 *
 * Safe to call with untrusted input — never throws.
 *
 * @example
 * getSitePreset("corporate")?.pages.length  // 6
 * getSitePreset("saas")?.pages.length       // 5
 * getSitePreset("unknown")                  // undefined
 */
export function getSitePreset(type: string): SitePreset | undefined {
  return SITE_PRESET_MAP[type as SiteType];
}

/**
 * Returns all registered site presets in canonical order.
 */
export function getAllSitePresets(): readonly SitePreset[] {
  return SITE_PRESETS;
}

/**
 * Type guard — returns true when the string is a valid SiteType.
 */
export function isSiteType(value: string): value is SiteType {
  return (
    value === "corporate"   ||
    value === "recruitment" ||
    value === "content"     ||
    value === "shop"        ||
    value === "saas"        ||
    value === "startup"
  );
}
