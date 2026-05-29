/**
 * Page Preset Registry
 *
 * Presets are reusable starter page compositions — predefined, ordered sets of
 * content blocks and context slot defaults built on top of the existing platform
 * template + block system.  They accelerate new tenant onboarding by providing
 * sensible page structures that operators can immediately edit in the page builder.
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   Presets are NOT new page templates.  They are recipes.
 *
 *   Each preset maps to an existing TemplateKey and references only existing,
 *   registered ContentBlock types.  Applying a preset produces an EditablePage
 *   (via applyPreset() in the server action layer) that flows through the
 *   normal template → renderer pipeline unchanged.
 *
 *   The CMS data fields (data: {}) are left empty — operators fill them in
 *   through the standard page block editor after the page is created.
 *
 * ─── Module boundary ─────────────────────────────────────────────────────────
 *
 *   This file is intentionally free of @/page-store imports to avoid a
 *   circular dependency (page-store/types imports from @/page-config).
 *
 *   The EditablePage instantiation logic lives in the server action:
 *   app/admin/tenants/[tenantId]/pages/new/actions.ts
 *
 * ─── Block safety ────────────────────────────────────────────────────────────
 *
 *   At application time (createPageFromPresetAction) all preset blocks are
 *   filtered against REGISTERED_CONTENT_BLOCK_TYPES.  Only live blocks are
 *   included in the created page.  Callers may additionally pass a tenant
 *   allow-list to enforce package entitlements.
 *
 * ─── Adding a new preset ─────────────────────────────────────────────────────
 *
 *   1. Add a PagePreset entry to PAGE_PRESETS below.
 *   2. Use only TemplateKey values from templates.ts.
 *   3. Use only ContentBlockKey values that are in REGISTERED_CONTENT_BLOCK_TYPES.
 *   4. Variant strings must be registered in block-variant-register.ts or omitted.
 *   5. Export the key constant for use in tests and documentation.
 */

import type { TemplateKey, ContextSlotId, ContextSlotPosition } from "./types";

// ── Internal sub-types ────────────────────────────────────────────────────────

/**
 * A context slot seed entry in a preset.
 *
 * variantKey = null means "no explicit fallback variant — the decision engine
 * picks at request time."  The admin can set an explicit fallback afterward via
 * the context slot editor.  Using null avoids hard-coding slot vocabulary keys
 * into presets.
 */
interface PresetContextSlot {
  readonly slotId:     ContextSlotId;
  readonly variantKey: string | null;
  readonly position:   ContextSlotPosition;
}

/**
 * A content block seed entry in a preset.
 *
 * blockType is typed as string here (not ContentBlockKey) to keep this
 * page-config module free of @/tenant/types imports.  The action layer casts
 * to ContentBlockKey after filtering against REGISTERED_CONTENT_BLOCK_TYPES.
 *
 * variant should reference a canonical key from block-variant-register.ts.
 * Omit to let the renderer use its own default.
 */
interface PresetBlock {
  readonly blockType: string;
  readonly variant?:  string;
}

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * A single page preset definition.
 *
 * key          — Unique identifier.  Used in action payloads and URL params.
 * label        — Short human-readable name shown in the admin preset picker.
 * description  — One-sentence description of the page use case.
 * templateKey  — Platform template this preset builds on.
 * contextSlots — Ordered context slot seed entries for templates that have them.
 * blocks       — Ordered content block seed entries.
 */
export interface PagePreset {
  readonly key:          string;
  readonly label:        string;
  readonly description:  string;
  readonly templateKey:  TemplateKey;
  readonly contextSlots: readonly PresetContextSlot[];
  readonly blocks:       readonly PresetBlock[];
}

// ── Preset registry ───────────────────────────────────────────────────────────

/**
 * The ordered platform preset registry.
 *
 * Grouped by purpose: Homepage → Pages → Listing → Detail.
 * All 8 required preset keys are covered.
 */
export const PAGE_PRESETS: readonly PagePreset[] = [

  // ── Homepage ──────────────────────────────────────────────────────────────

  {
    key:         "homepage_corporate",
    label:       "Corporate homepage",
    description: "Full marketing homepage — hero, features, logo strip, stats, split media section, testimonials, recent news, and a CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero",  variantKey: null, position: "before-content" },
      { slotId: "proof", variantKey: null, position: "before-content" },
      { slotId: "cta",   variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "featureGrid",        variant: "feature_grid_3up"      },
      { blockType: "logoStrip",          variant: "default"               },
      { blockType: "about",              variant: "media_right"            },
      { blockType: "stats",              variant: "default"               },
      { blockType: "testimonialSection", variant: "testimonial_grid"       },
      { blockType: "newsList",           variant: "default"               },
      { blockType: "ctaSection",         variant: "cta_card"               },
    ],
  },

  {
    key:         "homepage_recruitment",
    label:       "Recruitment homepage",
    description: "Recruitment-focused homepage — hero, logo strip, propositions, logo strip, stats, testimonials, process steps, recruiter panel, and a CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero",  variantKey: null, position: "before-content" },
      { slotId: "proof", variantKey: null, position: "before-content" },
      { slotId: "cta",   variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "textSection",        variant: "text_single"            },
      { blockType: "featureGrid",        variant: "feature_grid_checklist"  },
      { blockType: "logoStrip",          variant: "default"               },
      { blockType: "stats",              variant: "default"               },
      // processSteps and recruiterPanel are live in the page builder but lack
      // Sanity schema objects — they are filtered out during CMS provisioning.
      // The schema-backed blocks above ensure the provisioned page is still full.
      { blockType: "processSteps"                                          },
      { blockType: "recruiterPanel"                                        },
      { blockType: "testimonialSection", variant: "testimonial_highlight"  },
      { blockType: "ctaSection",         variant: "cta_split"              },
    ],
  },

  // ── Utility pages ─────────────────────────────────────────────────────────

  {
    key:         "about_default",
    label:       "About page",
    description: "Company about page — hero, lead text, alternating split media sections, key stats, testimonial highlight, and a CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "textSection",        variant: "text_lead"            },
      { blockType: "about",              variant: "media_right"          },
      { blockType: "about",              variant: "media_left"           },
      { blockType: "stats",              variant: "compact"              },
      { blockType: "testimonialSection", variant: "testimonial_highlight" },
      { blockType: "ctaSection",         variant: "cta_card"             },
    ],
  },

  {
    key:         "contact_default",
    label:       "Contact page",
    description: "Contact page — hero, split media intro section, and a contact form.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
    ],
    blocks: [
      { blockType: "about",       variant: "media_right" },
      { blockType: "formSection", variant: "form_split"  },
    ],
  },

  // ── Listing pages ─────────────────────────────────────────────────────────

  {
    key:         "listing_news",
    label:       "News listing",
    description: "News archive — intro heading followed by a card grid of articles.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection", variant: "text_single"   },
      { blockType: "listing",     variant: "listing_cards"  },
    ],
  },

  {
    key:         "listing_vacancies",
    label:       "Vacancy listing",
    description: "Job board — intro heading, filter bar for searching roles, and a card grid of open vacancies.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection", variant: "text_single"   },
      { blockType: "filterBar"                             },
      { blockType: "listing",     variant: "listing_cards"  },
    ],
  },

  // ── Detail pages ──────────────────────────────────────────────────────────

  {
    key:         "detail_article",
    label:       "Article detail",
    description: "Blog or news detail page — article meta header, body content, and related articles.",
    templateKey: "article-page",
    contextSlots: [],
    blocks: [
      { blockType: "articleMeta"    },
      { blockType: "articleBody"    },
      { blockType: "relatedContent" },
    ],
  },

  {
    key:         "detail_vacancy",
    label:       "Vacancy detail",
    description: "Single vacancy page — vacancy meta header, apply panel, and related vacancies.",
    templateKey: "detail-page",
    contextSlots: [],
    blocks: [
      { blockType: "vacancyMeta"    },
      { blockType: "applyPanel"     },
      { blockType: "relatedContent" },
    ],
  },

  // ── Additional catalog pages ───────────────────────────────────────────────
  //
  // These presets back the expanded TemplateCatalogEntry definitions in
  // template-catalog.ts.  They use only existing registered block types so
  // the provisioning filter in createSiteAction degrades gracefully on lower
  // package tiers.

  {
    key:         "services_default",
    label:       "Services page",
    description: "Services overview page — hero, feature grid, and a CTA.",
    templateKey: "landing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "featureGrid", variant: "feature_grid_3up" },
      { blockType: "textSection", variant: "text_lead"         },
    ],
  },

  {
    key:         "listing_cases",
    label:       "Case studies listing",
    description: "Client case studies archive — intro heading and a card grid of cases.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection", variant: "text_single"  },
      { blockType: "listing",     variant: "listing_cards" },
    ],
  },

  {
    key:         "detail_case",
    label:       "Case study detail",
    description: "Single case study page — article meta header, body content, and related cases.",
    templateKey: "article-page",
    contextSlots: [],
    blocks: [
      { blockType: "articleMeta"    },
      { blockType: "articleBody"    },
      { blockType: "relatedContent" },
    ],
  },

  // ── Events ───────────────────────────────────────────────────────────────

  {
    key:         "listing_events",
    label:       "Events listing",
    description: "Upcoming events archive — intro heading followed by a card grid of events.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection", variant: "text_single"  },
      { blockType: "listing",     variant: "listing_cards" },
    ],
  },

  {
    key:         "detail_event",
    label:       "Event detail",
    description: "Single event page — hero context slot, event details body, and a registration CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero",       variantKey: null, position: "before-content" },
      { slotId: "cta",        variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "textSection", variant: "text_single"  },
      { blockType: "featureGrid", variant: "feature_grid_2up" },
      { blockType: "ctaSection",  variant: "cta_card"         },
    ],
  },

  {
    key:         "landing_default",
    label:       "Landing page",
    description: "Focused conversion page — hero, feature grid, and a closing CTA.",
    templateKey: "landing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "featureGrid", variant: "feature_grid_3up" },
      { blockType: "ctaSection",  variant: "cta_card"          },
    ],
  },

  {
    key:         "team_default",
    label:       "Team page",
    description: "Team overview page — hero, lead text intro, and feature grid.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "textSection", variant: "text_lead"         },
      { blockType: "featureGrid", variant: "feature_grid_3up"  },
    ],
  },

  {
    key:         "faq_default",
    label:       "FAQ page",
    description: "Frequently asked questions page — hero and accordion FAQ section.",
    templateKey: "landing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "faqSection", variant: "faq_accordion" },
    ],
  },

  {
    key:         "search_default",
    label:       "Search page",
    description: "Full-text search page — search input and dynamic results grid.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "search",        variant: "full"    },
      { blockType: "searchResults", variant: "default" },
    ],
  },

  // ── Shop pages ────────────────────────────────────────────────────────────

  {
    key:         "homepage_shop",
    label:       "Shop homepage",
    description: "E-commerce homepage — hero, product overview grid, feature grid, testimonials, and a CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      { blockType: "productOverview",    variant: "product_grid"          },
      { blockType: "featureGrid",        variant: "feature_grid_3up"      },
      { blockType: "testimonialSection", variant: "testimonial_grid"      },
      { blockType: "ctaSection",         variant: "cta_card"              },
    ],
  },

  {
    key:         "product_listing_page",
    label:       "Product listing",
    description: "Product catalogue page — intro heading, product overview grid, and a closing CTA.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection",     variant: "text_single"  },
      { blockType: "productOverview", variant: "product_grid" },
      { blockType: "ctaSection",      variant: "cta_card"     },
    ],
  },

  {
    key:         "product_detail_page",
    label:       "Product detail",
    description: "Single product page — product detail block with gallery, specs, add-to-cart CTA, and related products.",
    templateKey: "detail-page",
    contextSlots: [],
    blocks: [
      { blockType: "productDetail", variant: "product_detail_default" },
    ],
  },

  {
    key:         "cart_page",
    label:       "Cart",
    description: "Shopping cart page — cart summary with proceed-to-checkout and continue-shopping actions.",
    templateKey: "marketing-page",
    contextSlots: [],
    blocks: [
      { blockType: "cartSummary", variant: "cart_default" },
    ],
  },

  {
    key:         "checkout_page",
    label:       "Checkout",
    description: "Checkout page — payment provider placeholder ready for Stripe, Mollie, or PayPal integration.",
    templateKey: "marketing-page",
    contextSlots: [],
    blocks: [
      { blockType: "checkoutBlock", variant: "checkout_default" },
    ],
  },

  // ── Startup / SaaS pages ──────────────────────────────────────────────────
  //
  // Modelled after the Sanity startup template (startup-pro.demo.nextjstemplates.com).
  // All blocks are existing registered types — no new block types required.
  // The full site structure is wired in site-presets.ts under the "startup" site type.

  {
    key:         "homepage_startup",
    label:       "Startup homepage",
    description: "Full startup / SaaS homepage — hero, trusted-by logos, feature grid, key metrics, how-it-works steps, testimonials, pricing preview, team spotlight, FAQ, and a closing CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero",  variantKey: null, position: "before-content" },
      { slotId: "proof", variantKey: null, position: "before-content" },
      { slotId: "cta",   variantKey: null, position: "after-content"  },
    ],
    blocks: [
      // "Trusted by" company logo bar — social proof above the fold
      { blockType: "logoStrip",          variant: "default"               },
      // Core feature grid — 3 or 4 column icon + title + body cards
      { blockType: "featureGrid",        variant: "feature_grid_3up"      },
      // Key product metrics (users, uptime, integrations, etc.)
      { blockType: "stats",              variant: "default"               },
      // Step-by-step "how it works" visual walkthrough
      { blockType: "processSteps"                                          },
      // Social proof — customer testimonials in a card grid
      { blockType: "testimonialSection", variant: "testimonial_grid"       },
      // Pricing tiers preview (teaser — links to full pricing page)
      { blockType: "pricingSection"                                        },
      // Team member spotlight (3–4 key people)
      { blockType: "teamSection"                                           },
      // FAQ accordion — top 4–6 questions
      { blockType: "faqSection",         variant: "faq_accordion"          },
    ],
  },

  {
    key:         "features_startup",
    label:       "Features page",
    description: "Dedicated product features page — hero, alternating text + media split sections, feature grid, and a closing CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      // Lead intro copy — one-sentence value proposition
      { blockType: "textSection",  variant: "text_lead"             },
      // Feature detail: text left, screenshot right
      { blockType: "about",        variant: "media_right"           },
      // Feature detail: screenshot left, text right
      { blockType: "about",        variant: "media_left"            },
      // Feature detail: text left, screenshot right
      { blockType: "about",        variant: "media_right"           },
      // Overview card grid — all features at a glance
      { blockType: "featureGrid",  variant: "feature_grid_3up"      },
      // Social proof bar
      { blockType: "logoStrip",    variant: "default"               },
    ],
  },

  {
    key:         "pricing_startup",
    label:       "Pricing page",
    description: "Full pricing page — hero, pricing tier cards, feature comparison table, FAQ accordion, and a CTA.",
    templateKey: "landing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      // Pricing tier cards (Starter / Growth / Pro)
      { blockType: "pricingSection"                                  },
      // Logo strip — "Join X companies already using …"
      { blockType: "logoStrip",    variant: "default"               },
      // Testimonial to overcome pricing hesitation
      { blockType: "testimonialSection", variant: "testimonial_highlight" },
      // Pricing FAQ — billing questions, refunds, upgrades
      { blockType: "faqSection",   variant: "faq_accordion"          },
    ],
  },

  {
    key:         "blog_startup",
    label:       "Blog / news listing",
    description: "Blog landing page — intro heading, featured article spotlight, and a card grid of recent posts.",
    templateKey: "listing-page",
    contextSlots: [],
    blocks: [
      { blockType: "textSection", variant: "text_single"  },
      { blockType: "listing",     variant: "listing_cards" },
    ],
  },

  {
    key:         "team_startup",
    label:       "Team page",
    description: "Company team page — hero, lead text about culture, full team grid, stats, and a join-us CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      // Culture / mission intro paragraph
      { blockType: "textSection",  variant: "text_lead"         },
      // Full team grid
      { blockType: "teamSection"                                 },
      // Company stats — headcount, years, offices
      { blockType: "stats",        variant: "compact"           },
      // Employee testimonial / culture quote
      { blockType: "testimonialSection", variant: "testimonial_highlight" },
    ],
  },

  {
    key:         "about_startup",
    label:       "Company / About page",
    description: "Startup about page — hero, mission statement, alternating story sections, key metrics, team spotlight, and a CTA.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
      { slotId: "cta",  variantKey: null, position: "after-content"  },
    ],
    blocks: [
      // Mission / founding story text
      { blockType: "textSection",  variant: "text_lead"         },
      // Story section: text left, image right
      { blockType: "about",        variant: "media_right"       },
      // Story section: image left, text right
      { blockType: "about",        variant: "media_left"        },
      // Company metrics — founded, team size, countries
      { blockType: "stats",        variant: "default"           },
      // Team spotlight (3–4 people)
      { blockType: "teamSection"                                 },
      // Press logos / "As seen in"
      { blockType: "logoStrip",    variant: "default"           },
    ],
  },

  {
    key:         "contact_startup",
    label:       "Contact / Get started",
    description: "Startup contact page — hero, split layout with company details and contact form.",
    templateKey: "marketing-page",
    contextSlots: [
      { slotId: "hero", variantKey: null, position: "before-content" },
    ],
    blocks: [
      // Company info + map split
      { blockType: "about",        variant: "media_right"  },
      // Contact form
      { blockType: "formSection",  variant: "form_split"   },
    ],
  },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * The preset registry keyed by preset key for O(1) look-up.
 *
 * @example
 * PAGE_PRESET_MAP["homepage_corporate"]?.label  // "Corporate homepage"
 */
export const PAGE_PRESET_MAP: Readonly<Record<string, PagePreset>> =
  Object.fromEntries(PAGE_PRESETS.map((p) => [p.key, p]));

/**
 * Returns the PagePreset for the given key, or undefined for unknown keys.
 *
 * Safe to call with untrusted input — never throws.
 *
 * @example
 * getPreset("homepage_corporate")?.templateKey  // "marketing-page"
 * getPreset("unknown")                          // undefined
 */
export function getPreset(key: string): PagePreset | undefined {
  return PAGE_PRESET_MAP[key];
}

/**
 * Returns all registered presets in the canonical registry order.
 *
 * @example
 * getAllPresets().map(p => p.key);
 * // → ["homepage_corporate", "homepage_recruitment", "about_default", ...]
 */
export function getAllPresets(): readonly PagePreset[] {
  return PAGE_PRESETS;
}
