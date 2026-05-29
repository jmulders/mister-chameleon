/**
 * Model Compatibility Map (Part 3)
 *
 * Maps each SiteModelKey to the canonical block types it uses, ensuring that
 * overlapping concepts (job detail = service detail = product detail = one
 * shared detail page type) are NEVER duplicated.
 *
 * ─── Reuse philosophy ────────────────────────────────────────────────────────
 *
 *   Structural blocks are shared across models.  Only copy notes differ.
 *
 *   Example:
 *     Service    /over-ons  → processSteps + teamSection
 *     Careers    /cultuur   → processSteps + teamSection   ← same blocks
 *     Product    /about     → processSteps + teamSection   ← same blocks
 *
 *   The blocks are identical; the `noteOverrides` in SiteModelPage supply
 *   the industry-specific guidance for CMS authors.
 *
 * ─── Block presence vocabulary ───────────────────────────────────────────────
 *
 *   "core"       → Block is always present in this model's pages
 *   "common"     → Block appears in most page types for this model
 *   "optional"   → Block available but not always appropriate
 *   "not-used"   → Block is not semantically appropriate for this model
 */

import type { SiteModelKey } from "../site-models/types";

export type ModelBlockPresence = "core" | "common" | "optional" | "not-used";

export interface ModelBlockEntry {
  blockType:  string;
  presence:   ModelBlockPresence;
  /**
   * Page slugs within the model where this block typically appears.
   * Empty = appears wherever appropriate.
   */
  typicalPages?: string[];
  notes?:     string;
}

export interface ModelCompatibilityEntry {
  model:      SiteModelKey;
  label:      string;
  blocks:     ModelBlockEntry[];
}

// ── Service model ─────────────────────────────────────────────────────────────

export const SERVICE_MODEL_BLOCKS: ModelCompatibilityEntry = {
  model:  "service",
  label:  "Service Site",
  blocks: [
    // ── Structural ────────────────────────────────────────────────────────────
    { blockType: "hero",               presence: "core",     typicalPages: ["/"],              notes: "Context slot — decision engine adapts hero per visitor segment." },
    { blockType: "textSection",        presence: "core",     notes: "Page headers on all non-homepage pages." },
    { blockType: "featureGrid",        presence: "core",     typicalPages: ["/", "/diensten"],  notes: "Services overview — the core value delivery block." },
    { blockType: "ctaSection",         presence: "core",     notes: "Every page ends with a conversion CTA." },
    // ── Proof ─────────────────────────────────────────────────────────────────
    { blockType: "logoStrip",          presence: "core",     typicalPages: ["/"],              notes: "Client logos are primary trust signals for service sites." },
    { blockType: "stats",              presence: "common",   typicalPages: ["/", "/over-ons"],  notes: "Impact numbers (clients served, projects completed)." },
    { blockType: "testimonialSection", presence: "common",   typicalPages: ["/", "/diensten"],  notes: "Client testimonials validate the offering." },
    // ── Content ───────────────────────────────────────────────────────────────
    { blockType: "listing",            presence: "common",   typicalPages: ["/cases"],         notes: "Case study grid — results drive service site conversions." },
    { blockType: "processSteps",       presence: "common",   typicalPages: ["/over-ons"],      notes: "How-we-work section on the about/over-ons page." },
    { blockType: "teamSection",        presence: "common",   typicalPages: ["/over-ons"],      notes: "Team profiles build personal trust." },
    { blockType: "faqSection",         presence: "optional", typicalPages: ["/over-ons", "/diensten"], notes: "Common questions about process, pricing, timelines." },
    { blockType: "richText",           presence: "optional", typicalPages: ["/cases"],         notes: "Long-form case study body content." },
    // ── Conversion ────────────────────────────────────────────────────────────
    { blockType: "contactSection",     presence: "core",     typicalPages: ["/contact"],       notes: "Address, phone, email, and map on the contact page." },
    { blockType: "formSection",        presence: "core",     typicalPages: ["/contact"],       notes: "Lead capture form." },
    // ── Not used ──────────────────────────────────────────────────────────────
    { blockType: "pricingSection",     presence: "not-used", notes: "Service sites use custom service descriptions, not tier tables." },
    { blockType: "filterBar",          presence: "not-used", notes: "Service catalogues are small enough to not need filtering." },
    { blockType: "cartSummary",        presence: "not-used", notes: "No e-commerce on service sites." },
    { blockType: "productOverview",    presence: "not-used" },
    { blockType: "productDetail",      presence: "not-used" },
    { blockType: "vacancyMeta",        presence: "not-used" },
    { blockType: "applyPanel",         presence: "not-used" },
    { blockType: "recruiterPanel",     presence: "not-used" },
  ],
};

// ── Product / SaaS model ──────────────────────────────────────────────────────

export const PRODUCT_SAAS_MODEL_BLOCKS: ModelCompatibilityEntry = {
  model:  "product-saas",
  label:  "Product / SaaS",
  blocks: [
    { blockType: "hero",               presence: "core",     typicalPages: ["/"],              notes: "Context slot — trial vs demo CTA adapts per segment." },
    { blockType: "textSection",        presence: "core" },
    { blockType: "featureGrid",        presence: "core",     typicalPages: ["/", "/features"],  notes: "Feature catalogue — central value communication." },
    { blockType: "ctaSection",         presence: "core" },
    { blockType: "pricingSection",     presence: "core",     typicalPages: ["/pricing"],        notes: "Pricing page is the #1 purchase-intent signal for SaaS." },
    // ── Proof ─────────────────────────────────────────────────────────────────
    { blockType: "logoStrip",          presence: "core",     typicalPages: ["/"],              notes: "Customer logos are essential trust signals." },
    { blockType: "stats",              presence: "common",   notes: "Product metrics (users, uptime, integrations)." },
    { blockType: "testimonialSection", presence: "common",   typicalPages: ["/", "/pricing"],  notes: "Customer success quotes near pricing to reduce hesitation." },
    // ── Content ───────────────────────────────────────────────────────────────
    { blockType: "richText",           presence: "optional", typicalPages: ["/about"],         notes: "Company story or product philosophy." },
    { blockType: "processSteps",       presence: "common",   typicalPages: ["/about", "/features"], notes: "Onboarding steps or product how-it-works flow." },
    { blockType: "teamSection",        presence: "optional", typicalPages: ["/about"],         notes: "Founding team for trust-building, especially with enterprise buyers." },
    { blockType: "faqSection",         presence: "core",     typicalPages: ["/pricing"],       notes: "Pricing FAQ is essential — it resolves the most common objections." },
    { blockType: "listing",            presence: "optional", typicalPages: ["/"],              notes: "Featured case studies or integration showcases on homepage." },
    // ── Conversion ────────────────────────────────────────────────────────────
    { blockType: "formSection",        presence: "core",     typicalPages: ["/contact"],       notes: "Demo request or sales contact form." },
    { blockType: "contactSection",     presence: "optional", typicalPages: ["/contact"],       notes: "Office address for enterprise buyers who want to see a physical presence." },
    // ── Not used ──────────────────────────────────────────────────────────────
    { blockType: "filterBar",          presence: "not-used" },
    { blockType: "cartSummary",        presence: "not-used", notes: "SaaS uses checkout links, not cart UI." },
    { blockType: "productOverview",    presence: "not-used", notes: "Use featureGrid for feature catalogue." },
    { blockType: "productDetail",      presence: "not-used" },
    { blockType: "vacancyMeta",        presence: "not-used" },
    { blockType: "applyPanel",         presence: "not-used" },
    { blockType: "recruiterPanel",     presence: "not-used" },
  ],
};

// ── Careers model ─────────────────────────────────────────────────────────────

export const CAREERS_MODEL_BLOCKS: ModelCompatibilityEntry = {
  model:  "careers",
  label:  "Careers / Werken-bij",
  blocks: [
    { blockType: "hero",               presence: "core",     typicalPages: ["/"],                    notes: "Context slot — adapts from brand intro (new) to direct apply (high intent)." },
    { blockType: "textSection",        presence: "core",     notes: "Page headers including vacancy list header." },
    { blockType: "ctaSection",         presence: "core" },
    // ── Job listing ──────────────────────────────────────────────────────────
    { blockType: "listing",            presence: "core",     typicalPages: ["/vacatures"],            notes: "Job card grid — core content of the vacancy overview page. (templateAlias: cardGrid)" },
    { blockType: "filterBar",          presence: "core",     typicalPages: ["/vacatures"],            notes: "Filter by department, location, contract type." },
    // ── Job detail ───────────────────────────────────────────────────────────
    { blockType: "vacancyMeta",        presence: "core",     typicalPages: ["/vacatures/[slug]"],     notes: "Structured job header: title, department, location, contract." },
    { blockType: "richText",           presence: "core",     typicalPages: ["/vacatures/[slug]"],     notes: "Full job description / requirements body." },
    { blockType: "featureGrid",        presence: "common",   typicalPages: ["/vacatures/[slug]"],     notes: "What we offer: salary, remote, benefits. (templateAlias: featureList)" },
    { blockType: "applyPanel",         presence: "core",     typicalPages: ["/vacatures/[slug]"],     notes: "Sticky apply CTA with optional quick-apply." },
    { blockType: "recruiterPanel",     presence: "common",   typicalPages: ["/vacatures/[slug]"],     notes: "Recruiter contact card — humanises the application process." },
    { blockType: "relatedContent",     presence: "common",   typicalPages: ["/vacatures/[slug]"],     notes: "Similar vacancies to prevent dead-end exits. (templateAlias: relatedGrid)" },
    // ── Application forms ─────────────────────────────────────────────────────
    { blockType: "formSection",        presence: "core",     typicalPages: ["/solliciteren", "/open-sollicitatie"], notes: "Application form (direct and open application)." },
    // ── Proof / culture ───────────────────────────────────────────────────────
    { blockType: "teamSection",        presence: "core",     typicalPages: ["/", "/cultuur"],         notes: "Team spotlights — candidate social proof." },
    { blockType: "stats",              presence: "common",   typicalPages: ["/", "/cultuur"],         notes: "Employer-brand numbers: staff NPS, growth rate, open roles." },
    { blockType: "testimonialSection", presence: "common",   typicalPages: ["/"],                    notes: "Employee testimonials / work-experience quotes." },
    { blockType: "logoStrip",          presence: "common",   typicalPages: ["/"],                    notes: "Awards, certifications, or 'Best Employer' marks." },
    // ── Process ───────────────────────────────────────────────────────────────
    { blockType: "processSteps",       presence: "core",     typicalPages: ["/cultuur"],              notes: "Application process steps — crucial for conversion. (templateAlias: stepsSection)" },
    { blockType: "faqSection",         presence: "core",     typicalPages: ["/cultuur"],              notes: "FAQ: working hours, remote policy, onboarding, etc." },
    // ── Not used ──────────────────────────────────────────────────────────────
    { blockType: "pricingSection",     presence: "not-used" },
    { blockType: "cartSummary",        presence: "not-used" },
    { blockType: "productOverview",    presence: "not-used" },
    { blockType: "productDetail",      presence: "not-used" },
  ],
};

// ── Catalog model ─────────────────────────────────────────────────────────────

export const CATALOG_MODEL_BLOCKS: ModelCompatibilityEntry = {
  model:  "catalog",
  label:  "Catalog / Directory",
  blocks: [
    { blockType: "hero",               presence: "core",     typicalPages: ["/"],              notes: "Context slot — adapts from category discovery (new) to saved/compared (return)." },
    { blockType: "textSection",        presence: "core" },
    { blockType: "ctaSection",         presence: "core" },
    // ── Browse ────────────────────────────────────────────────────────────────
    { blockType: "listing",            presence: "core",     typicalPages: ["/aanbod", "/"],   notes: "Item card grid — the primary browse surface. (templateAlias: cardGrid)" },
    { blockType: "filterBar",          presence: "core",     typicalPages: ["/aanbod"],        notes: "Essential for large catalogues — filters by category, price, location, availability." },
    // ── Item detail ───────────────────────────────────────────────────────────
    { blockType: "richText",           presence: "core",     typicalPages: ["/aanbod/[slug]"], notes: "Full item description." },
    { blockType: "slider",             presence: "core",     typicalPages: ["/aanbod/[slug]"], notes: "Item photo gallery — critical for catalog items. (templateAlias: mediaSection)" },
    { blockType: "featureGrid",        presence: "core",     typicalPages: ["/aanbod/[slug]"], notes: "Item specifications in scannable form. (templateAlias: featureList)" },
    { blockType: "relatedContent",     presence: "core",     typicalPages: ["/aanbod/[slug]"], notes: "Similar items — reduces bounce. (templateAlias: relatedGrid)" },
    // ── Proof ─────────────────────────────────────────────────────────────────
    { blockType: "stats",              presence: "common",   typicalPages: ["/"],              notes: "Catalogue scale stats: number of listings, categories, active users." },
    { blockType: "testimonialSection", presence: "optional", typicalPages: ["/"],              notes: "User/buyer reviews or testimonials." },
    { blockType: "logoStrip",          presence: "optional", typicalPages: ["/"],              notes: "Partner logos or trust badges." },
    // ── Conversion ────────────────────────────────────────────────────────────
    { blockType: "formSection",        presence: "core",     typicalPages: ["/contact"],       notes: "Enquiry form — for listing submission or item enquiry." },
    { blockType: "contactSection",     presence: "optional", typicalPages: ["/contact"],       notes: "Contact details for the catalogue operator." },
    // ── Not used ──────────────────────────────────────────────────────────────
    { blockType: "pricingSection",     presence: "not-used", notes: "Individual items have prices, not tier tables." },
    { blockType: "cartSummary",        presence: "not-used" },
    { blockType: "productOverview",    presence: "not-used", notes: "Use listing block instead." },
    { blockType: "productDetail",      presence: "not-used", notes: "Use the generic detail page type blocks." },
    { blockType: "vacancyMeta",        presence: "not-used" },
    { blockType: "applyPanel",         presence: "not-used" },
    { blockType: "recruiterPanel",     presence: "not-used" },
  ],
};

// ── Commerce model ────────────────────────────────────────────────────────────

export const COMMERCE_MODEL_BLOCKS: ModelCompatibilityEntry = {
  model:  "commerce",
  label:  "Commerce / Shop",
  blocks: [
    { blockType: "hero",               presence: "core",     typicalPages: ["/"],                      notes: "Context slot — new visitor welcome vs returning browser personalisation." },
    { blockType: "textSection",        presence: "core" },
    { blockType: "ctaSection",         presence: "core" },
    // ── Product pages ─────────────────────────────────────────────────────────
    { blockType: "productOverview",    presence: "core",     typicalPages: ["/producten", "/"],         notes: "Product card grid — dedicated commerce block with price display." },
    { blockType: "productDetail",      presence: "core",     typicalPages: ["/producten/[slug]"],        notes: "Full product detail: gallery, specs, add-to-cart." },
    { blockType: "filterBar",          presence: "core",     typicalPages: ["/producten"],               notes: "Filter by category, price, size, colour, availability." },
    // ── Checkout flow ─────────────────────────────────────────────────────────
    { blockType: "cartSummary",        presence: "core",     typicalPages: ["/afrekenen"],               notes: "Order summary during checkout." },
    { blockType: "formSection",        presence: "core",     typicalPages: ["/afrekenen"],               notes: "Checkout form: address, delivery, payment." },
    // ── Proof ─────────────────────────────────────────────────────────────────
    { blockType: "logoStrip",          presence: "core",     typicalPages: ["/", "/producten"],          notes: "Payment method logos and trust badges — essential for e-commerce trust." },
    { blockType: "stats",              presence: "common",   typicalPages: ["/"],                       notes: "Shop trust stats: happy customers, delivery time, return rate." },
    { blockType: "testimonialSection", presence: "core",     typicalPages: ["/", "/producten/[slug]"],   notes: "Product reviews are primary purchase-decision content." },
    // ── Content ───────────────────────────────────────────────────────────────
    { blockType: "richText",           presence: "optional", typicalPages: ["/producten/[slug]"],        notes: "Long-form product story, sustainability info, how-to-use." },
    { blockType: "processSteps",       presence: "common",   typicalPages: ["/over-ons"],                notes: "Order → dispatch → delivery steps. (templateAlias: stepsSection)" },
    { blockType: "faqSection",         presence: "common",   typicalPages: ["/over-ons"],                notes: "FAQ: returns, delivery, sizing, payment." },
    { blockType: "listing",            presence: "optional", typicalPages: ["/"],                       notes: "Featured / sale products section on homepage." },
    // ── Not used ──────────────────────────────────────────────────────────────
    { blockType: "pricingSection",     presence: "not-used", notes: "Products have individual prices; use productDetail.price." },
    { blockType: "vacancyMeta",        presence: "not-used" },
    { blockType: "applyPanel",         presence: "not-used" },
    { blockType: "recruiterPanel",     presence: "not-used" },
  ],
};

// ── Master compatibility map ──────────────────────────────────────────────────

export const MODEL_COMPATIBILITY: Record<SiteModelKey, ModelCompatibilityEntry> = {
  "service":      SERVICE_MODEL_BLOCKS,
  "product-saas": PRODUCT_SAAS_MODEL_BLOCKS,
  "careers":      CAREERS_MODEL_BLOCKS,
  "catalog":      CATALOG_MODEL_BLOCKS,
  "commerce":     COMMERCE_MODEL_BLOCKS,
};

/** Return the compatibility entry for a model. */
export function getModelCompatibility(model: SiteModelKey): ModelCompatibilityEntry {
  return MODEL_COMPATIBILITY[model];
}

/**
 * Return blocks for a model filtered by presence.
 * Pass undefined to get all blocks.
 */
export function getModelBlocks(
  model: SiteModelKey,
  presence?: ModelBlockPresence,
): ModelBlockEntry[] {
  const entry = MODEL_COMPATIBILITY[model];
  if (!entry) return [];
  return presence
    ? entry.blocks.filter((b) => b.presence === presence)
    : entry.blocks;
}

/**
 * Return all models that use a given block type (with any presence except "not-used").
 */
export function getModelsForBlock(blockType: string): SiteModelKey[] {
  return (Object.entries(MODEL_COMPATIBILITY) as [SiteModelKey, ModelCompatibilityEntry][])
    .filter(([, entry]) =>
      entry.blocks.some((b) => b.blockType === blockType && b.presence !== "not-used"),
    )
    .map(([key]) => key);
}

// ── Block reuse summary (cross-model) ────────────────────────────────────────

/**
 * Blocks that are shared (present and non-not-used) across ALL five models.
 * These are the truly universal structural blocks.
 */
export const UNIVERSAL_BLOCKS: string[] = (() => {
  const allModels = Object.keys(MODEL_COMPATIBILITY) as SiteModelKey[];
  const allBlockTypes = new Set(
    allModels.flatMap((m) =>
      MODEL_COMPATIBILITY[m].blocks
        .filter((b) => b.presence !== "not-used")
        .map((b) => b.blockType),
    ),
  );
  return Array.from(allBlockTypes).filter((bt) =>
    allModels.every((m) =>
      MODEL_COMPATIBILITY[m].blocks.some(
        (b) => b.blockType === bt && b.presence !== "not-used",
      ),
    ),
  );
})();
