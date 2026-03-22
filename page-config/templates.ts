/**
 * Page Templates
 *
 * Named TemplateDefinition constants for the platform's supported page types.
 *
 * ─── What a template IS ───────────────────────────────────────────────────────
 *
 *   A template is a structural slot specification.
 *   It declares which context slots a page has and where they are rendered
 *   relative to the content blocks array.
 *
 * ─── What a template is NOT ───────────────────────────────────────────────────
 *
 *   A template is NOT:
 *     - A layout variant  → use a ContentBlock variant instead
 *     - A page component  → the renderer is in app/[slug]/page.tsx
 *     - A CMS schema      → the CMS schema is in cms/schemas/
 *     - An entitlement    → block entitlements live in TenantBlocks
 *
 * ─── When to add a new template ──────────────────────────────────────────────
 *
 *   ONLY when the set of context slots genuinely differs from every existing
 *   template.  Visual variation, content variation, and layout variation are
 *   never valid reasons to add a new template.
 *
 * ─── Available templates ─────────────────────────────────────────────────────
 *
 *   marketing-page  — Hero + Proof (before) + CTA (after) + reorderable content
 *   landing-page    — Hero (before) + CTA (after) + reorderable content
 *                     For focused conversion pages (no proof block)
 *   article-page    — No context slots; pure reorderable content
 *                     For blog posts, documentation, editorial content
 *
 * ─── Extending ───────────────────────────────────────────────────────────────
 *
 *   1. Add the new key to the TemplateKey union in types.ts.
 *   2. Define the TemplateDefinition constant here.
 *   3. Register it in TEMPLATE_REGISTRY below.
 *   Done — no other platform files need to change.
 */

import type { TemplateDefinition, TemplateKey } from "./types";

// ── Marketing page template ───────────────────────────────────────────────────

/**
 * The standard adaptive marketing / homepage.
 *
 * Slot structure:
 *   1. hero  (before-content, required)               — headline + CTA; always rendered
 *   2. proof (before-content, optional)               — social proof; rendered when a
 *                                                        variant key is available
 *   3. [content blocks array]
 *   4. cta   (after-content, optional, allowMultiple) — closing call-to-action; rendered
 *                                                        when a variant key is available
 *
 * The proof and cta slots are optional: a tenant whose entitlements exclude
 * the "proof" or "cta" context blocks will receive variantKey === null and
 * those slots will be skipped by the renderer.
 */
export const MARKETING_PAGE_TEMPLATE: TemplateDefinition = {
  key:         "marketing-page",
  displayName: "Marketing page",
  contextSlots: [
    { slotId: "hero",  position: "before-content", required: true,  allowMultiple: false },
    { slotId: "proof", position: "before-content", required: false, allowMultiple: false },
    { slotId: "cta",   position: "after-content",  required: false, allowMultiple: true  },
  ],
} as const;

// ── Landing page template ─────────────────────────────────────────────────────

/**
 * A focused conversion page.
 *
 * Slot structure:
 *   1. hero  (before-content, required)  — headline + CTA
 *   2. [content blocks array]
 *   3. cta   (after-content, required)   — closing CTA; required to anchor
 *                                          the conversion goal of the page
 *
 * Proof is intentionally absent — landing pages are built for a single
 * focused message and conversion action, not broad trust-building.
 * Use the marketing-page template if social proof is needed.
 */
export const LANDING_PAGE_TEMPLATE: TemplateDefinition = {
  key:         "landing-page",
  displayName: "Landing page",
  contextSlots: [
    { slotId: "hero", position: "before-content", required: true,  allowMultiple: false },
    { slotId: "cta",  position: "after-content",  required: true,  allowMultiple: false },
  ],
} as const;

// ── Article page template ─────────────────────────────────────────────────────

/**
 * Editorial / long-form content page.
 *
 * Slot structure:
 *   1. [content blocks array only — no context slots]
 *
 * Articles are fully CMS-driven. There are no adaptive context slots because
 * editorial content (blog posts, documentation, guides) is not personalised
 * at the section level in the current platform design.
 *
 * If a closing CTA is needed on an article, add a CtaSectionBlock to the
 * page's content blocks array in the CMS — it does not require an adaptive
 * context slot.
 */
export const ARTICLE_PAGE_TEMPLATE: TemplateDefinition = {
  key:         "article-page",
  displayName: "Article",
  contextSlots: [],
} as const;

// ── Listing page template ─────────────────────────────────────────────────────

/**
 * A page that aggregates and presents a collection of entity records.
 *
 * Slot structure:
 *   1. [content blocks array only — no context slots]
 *
 * Listing pages are composed from listing, filterBar, and search content
 * blocks.  They carry no adaptive context slots because the collection
 * presentation is data-driven and not personalised at the section level.
 *
 * Use this template for:
 *   - News / article overview pages
 *   - Vacancy listing pages
 *   - Company directory pages
 *
 * Visual variation (grid vs. list layout) is expressed through the `variant`
 * field on the listing ContentBlock — never through a new template.
 */
export const LISTING_PAGE_TEMPLATE: TemplateDefinition = {
  key:         "listing-page",
  displayName: "Listing page",
  contextSlots: [],
} as const;

// ── Detail page template ──────────────────────────────────────────────────────

/**
 * A page that presents a single entity document in full detail.
 *
 * Slot structure:
 *   1. [content blocks array only — no context slots]
 *
 * Detail pages are assembled from entity documents (NewsArticle, Vacancy,
 * Company) by the entity-page mappers in cms/mappers/entity-page-assemblers.ts.
 * The mapper converts the entity's structured fields into an ordered sequence
 * of content blocks (e.g. articleMeta → articleBody → relatedContent for a
 * news article) and sets templateKey: "detail-page" on the resulting PageData.
 *
 * This template carries no adaptive context slots because entity detail pages
 * present authoritative structured data and are not personalised at the section
 * level.  If a persuasive CTA is needed, add a CtaSectionBlock to the entity's
 * assembled sections via the mapper.
 */
export const DETAIL_PAGE_TEMPLATE: TemplateDefinition = {
  key:         "detail-page",
  displayName: "Detail page",
  contextSlots: [],
} as const;

// ── Template registry ─────────────────────────────────────────────────────────

/**
 * All registered templates, keyed by TemplateKey.
 *
 * The registry is the single source of truth for template lookup at runtime.
 * The TypeScript type ensures every TemplateKey has a registered definition —
 * if you add a key to the TemplateKey union but forget to register it here,
 * the compiler will error.
 */
export const TEMPLATE_REGISTRY: Readonly<Record<TemplateKey, TemplateDefinition>> = {
  "marketing-page": MARKETING_PAGE_TEMPLATE,
  "landing-page":   LANDING_PAGE_TEMPLATE,
  "article-page":   ARTICLE_PAGE_TEMPLATE,
  "listing-page":   LISTING_PAGE_TEMPLATE,
  "detail-page":    DETAIL_PAGE_TEMPLATE,
} as const;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Look up a template definition by key.
 *
 * The primary named helper for template lookup.  Returns `undefined` for
 * unknown keys — safe to call with untrusted input (e.g. a key stored in the
 * CMS) without throwing.
 *
 * @example
 * const template = getTemplateDefinition("marketing-page");
 * // template.contextSlots.length === 3
 *
 * const missing = getTemplateDefinition("unknown" as TemplateKey);
 * // undefined
 */
export function getTemplateDefinition(key: string): TemplateDefinition | undefined {
  return (TEMPLATE_REGISTRY as Record<string, TemplateDefinition>)[key];
}

/**
 * Return all registered template definitions in canonical order:
 * marketing-page → landing-page → article-page.
 *
 * Useful for building template-picker UIs and exhaustive iteration in tests.
 *
 * @example
 * const templates = getAllTemplateDefinitions();
 * // templates.map(t => t.key) → ["marketing-page", "landing-page", "article-page"]
 */
export function getAllTemplateDefinitions(): TemplateDefinition[] {
  return [
    MARKETING_PAGE_TEMPLATE,
    LANDING_PAGE_TEMPLATE,
    ARTICLE_PAGE_TEMPLATE,
    LISTING_PAGE_TEMPLATE,
    DETAIL_PAGE_TEMPLATE,
  ];
}

/**
 * @deprecated Use getTemplateDefinition() instead.
 *
 * Look up a template definition by key.
 * Retained for incremental migration of existing callers.
 */
export function getTemplate(key: string): TemplateDefinition | undefined {
  return getTemplateDefinition(key);
}

/**
 * Assert that a string is a known TemplateKey.
 * Useful in CMS mappers when the template key comes from CMS data.
 *
 * @example
 * const key = page.templateKey ?? "article-page";
 * if (isTemplateKey(key)) {
 *   const template = TEMPLATE_REGISTRY[key]; // fully typed
 * }
 */
export function isTemplateKey(key: string): key is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, key);
}
