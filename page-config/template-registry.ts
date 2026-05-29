/**
 * Template Registry
 *
 * The single source of truth for:
 *   1. Slot contract types  — typed mapping of slot ID → CMS variant document type
 *   2. Template definitions — rich metadata for every provisionable page type
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   TemplateRegistry (this file)
 *       ↓ catalogKey
 *   TemplateCatalogEntry (page-config/template-catalog.ts)
 *       ↓ presetKey
 *   PagePreset (page-config/page-presets.ts)
 *       ↓ templateKey
 *   TemplateDefinition (page-config/templates.ts)
 *
 * ─── Two sets ─────────────────────────────────────────────────────────────────
 *
 *   Core (8)     — pages every site should have; several are pre-selected
 *                  by default and "homepage" is always locked.
 *   Extended (11) — optional additions recommended for specific site types;
 *                   none are pre-selected by default.
 *
 * ─── Slot contracts ───────────────────────────────────────────────────────────
 *
 *   Each slot contract maps a semantic slot name (heroSlot, proofSlot, …) to:
 *     - the runtime slotId used in contextSlots
 *     - the CMS variant document type (heroVariant, proofVariant, …)
 *     - position ("before-content" | "after-content")
 *     - whether it is currently wired (active) or defined but not yet live (reserved)
 *
 *   Active slots  — heroSlot, proofSlot, ctaSlot, featureSlot, conversionSlot
 *                   These correspond to ContextBlockKey values and are AI-selectable.
 *   Reserved slots — trustSlot, faqSlot, relatedSlot
 *                   Defined here for typing completeness.  Full CMS schema, queries,
 *                   and decision-engine integration are not yet implemented.
 *                   See ContextBlockKey comments in tenant/types.ts for the roadmap.
 *
 * ─── Extending ────────────────────────────────────────────────────────────────
 *
 *   Adding a new template:
 *     1. Add the key to TemplateRegistryKey below.
 *     2. Add a TemplateCatalogKey to tenant/types.ts (keep in sync comment).
 *     3. Add a TemplateCatalogEntry in page-config/template-catalog.ts.
 *     4. Add a TemplateRegistryEntry to CORE_TEMPLATE_REGISTRY or EXTENDED_TEMPLATE_REGISTRY.
 *     Done.
 *
 *   Adding a new slot contract:
 *     1. Add the key to SlotContractKey.
 *     2. Add a SlotContract to SLOT_CONTRACT_REGISTRY.
 *     3. Add the full CMS variant document type, queries, and provider methods
 *        (see ContextBlockKey roadmap in tenant/types.ts).
 *     4. Add to ContextBlockKey in tenant/types.ts when the CMS side is ready.
 *     Done.
 */

import type { TemplateKey }        from "./types";
import type { TemplateCatalogKey } from "@/tenant/types";
import type { SiteType }           from "./site-presets";
import type { TemplatePreviewType } from "./template-catalog";

// ── Slot contract types ───────────────────────────────────────────────────────

/**
 * The semantic slot names defined by the template registry.
 *
 * Each key represents a page section that can be typed, CMS-managed, and
 * potentially AI-selected.  Slots map 1:1 to a CMS variant document type.
 */
export type SlotContractKey =
  | "heroSlot"        // → heroVariant        (active)
  | "proofSlot"       // → proofVariant       (active)
  | "ctaSlot"         // → ctaVariant         (active)
  | "featureSlot"     // → featureVariant     (active)
  | "trustSlot"       // → trustVariant       (reserved — schema pending)
  | "conversionSlot"  // → conversionVariant  (active)
  | "faqSlot"         // → faqVariant         (reserved — schema pending)
  | "relatedSlot";    // → feedVariant        (reserved — schema pending)

/**
 * The runtime status of a slot contract.
 *
 * active   — slot is wired in the decision engine, CMS, and renderer.
 * reserved — slot is typed and documented but not yet fully implemented.
 *            Safe to include in template definitions; the renderer skips
 *            reserved slots whose variant key is null.
 */
export type SlotContractStatus = "active" | "reserved";

/**
 * Full definition of a single slot contract.
 */
export interface SlotContract {
  /** Semantic slot name (e.g. "heroSlot"). */
  readonly contractKey:   SlotContractKey;
  /** Runtime slot ID used in contextSlots (matches ContextBlockKey when active). */
  readonly slotId:        string;
  /** CMS variant document _type (e.g. "heroVariant"). */
  readonly variantType:   string;
  /** Position relative to the content blocks array. */
  readonly position:      "before-content" | "after-content";
  /**
   * Whether this slot is currently wired end-to-end.
   * Active slots correspond to a ContextBlockKey value in tenant/types.ts.
   * Reserved slots are defined here for forward-compatibility.
   */
  readonly status:        SlotContractStatus;
  /** Whether the decision engine can autonomously select the variant. */
  readonly aiSelectable:  boolean;
  /** Human-readable label used in the provisioning UI. */
  readonly label:         string;
  /** Short description of what this slot provides. */
  readonly description:   string;
}

// ── Slot contract registry ────────────────────────────────────────────────────

/**
 * The complete slot contract registry.
 *
 * This is the typed mapping between semantic slot names (heroSlot, proofSlot, …)
 * and the CMS variant document types they resolve to.  It is the authoritative
 * source for slot ↔ variant type relationships across templates.
 *
 * Slot typing is enforced at the TypeScript level:
 *   - TemplateRegistryEntry.slots is SlotContractKey[] — only registered
 *     contract keys can be listed on a template.
 *   - Each entry here specifies exactly which variant type is produced.
 *   - The decision engine (ai/variant-meta.ts) gates AI selection to active
 *     slots whose ContextBlockKey appears in the tenant's TenantBlocks.context.
 */
export const SLOT_CONTRACT_REGISTRY: Readonly<Record<SlotContractKey, SlotContract>> = {

  heroSlot: {
    contractKey:  "heroSlot",
    slotId:       "hero",
    variantType:  "heroVariant",
    position:     "before-content",
    status:       "active",
    aiSelectable: true,
    label:        "Hero",
    description:  "Adaptive headline + sub-headline + primary CTA. Always the first section.",
  },

  proofSlot: {
    contractKey:  "proofSlot",
    slotId:       "proof",
    variantType:  "proofVariant",
    position:     "before-content",
    status:       "active",
    aiSelectable: true,
    label:        "Social proof",
    description:  "Trust signals — logo strip, stats row, or testimonial highlight.",
  },

  ctaSlot: {
    contractKey:  "ctaSlot",
    slotId:       "cta",
    variantType:  "ctaVariant",
    position:     "after-content",
    status:       "active",
    aiSelectable: true,
    label:        "CTA",
    description:  "Closing call-to-action. Placed after all content sections.",
  },

  featureSlot: {
    contractKey:  "featureSlot",
    slotId:       "feature",
    variantType:  "featureVariant",
    position:     "before-content",
    status:       "active",
    aiSelectable: false,
    label:        "Feature highlight",
    description:  "Feature grid or benefit list — showcases key product/service attributes.",
  },

  trustSlot: {
    contractKey:  "trustSlot",
    slotId:       "trust",
    variantType:  "trustVariant",
    position:     "before-content",
    status:       "reserved",
    aiSelectable: false,
    label:        "Trust signal",
    description:  "Certifications, awards, or partner badges. (CMS schema pending.)",
  },

  conversionSlot: {
    contractKey:  "conversionSlot",
    slotId:       "conversion",
    variantType:  "conversionVariant",
    position:     "after-content",
    status:       "active",
    aiSelectable: false,
    label:        "Conversion",
    description:  "High-intent conversion section — form, multi-step, or urgency copy.",
  },

  faqSlot: {
    contractKey:  "faqSlot",
    slotId:       "faq",
    variantType:  "faqVariant",
    position:     "after-content",
    status:       "reserved",
    aiSelectable: false,
    label:        "FAQ",
    description:  "Collapsible FAQ accordion. (CMS schema pending.)",
  },

  relatedSlot: {
    contractKey:  "relatedSlot",
    slotId:       "related",
    variantType:  "feedVariant",
    position:     "after-content",
    status:       "reserved",
    aiSelectable: false,
    label:        "Related content",
    description:  "Dynamic feed of related articles, cases, or vacancies. (CMS schema pending.)",
  },

} as const;

// ── Template registry types ───────────────────────────────────────────────────

/**
 * All provisionable template keys in the platform.
 *
 * Convention: underscore_case to distinguish from TemplateCatalogKey (hyphen-case)
 * and TemplateKey (hyphen-case structural keys).
 *
 * Core (8)     — homepage, landing_page, service_page, content_page,
 *                listing_page, detail_page, contact_page, basic_page
 * Extended (11) — sector_page, comparison_page, team_listing, team_detail,
 *                news_listing, news_detail, case_listing, case_detail,
 *                vacancy_listing, vacancy_detail, event_page
 */
export type TemplateRegistryKey =
  // ── Core ──────────────────────────────────────────────────────────────────
  | "homepage"
  | "landing_page"
  | "service_page"
  | "content_page"
  | "listing_page"
  | "detail_page"
  | "contact_page"
  | "basic_page"
  // ── Extended ──────────────────────────────────────────────────────────────
  | "sector_page"
  | "comparison_page"
  | "team_listing"
  | "team_detail"
  | "news_listing"
  | "news_detail"
  | "case_listing"
  | "case_detail"
  | "vacancy_listing"
  | "vacancy_detail"
  | "event_page";

/**
 * Provisioning tier for a template.
 *
 * core     — included in the base set shown to every operator.
 *            Several core templates are pre-selected by default.
 * extended — optional additions surfaced below the core set.
 *            Filtered by recommendedFor so operators only see what's relevant.
 */
export type TemplateRegistryCategory = "core" | "extended";

/**
 * Rich metadata entry for a single provisionable template.
 */
export interface TemplateRegistryEntry {
  /**
   * Unique registry key (underscore_case).
   * Used as the internal identifier within the template registry.
   */
  readonly key: TemplateRegistryKey;

  /** Short display name shown in the provisioning UI card. */
  readonly label: string;

  /** One-sentence description of this page's purpose and content. */
  readonly description: string;

  /** Whether this is a core or extended template. */
  readonly category: TemplateRegistryCategory;

  /**
   * Structural platform template this page type builds on.
   * Maps to a TemplateDefinition in page-config/templates.ts.
   * Determines which context slots the renderer expects.
   */
  readonly structuralTemplate: TemplateKey;

  /**
   * Bridge to the provisioning system.
   * Maps to a TemplateCatalogEntry in page-config/template-catalog.ts,
   * which in turn maps to a PagePreset used by createSiteAction.
   */
  readonly catalogKey: TemplateCatalogKey;

  /**
   * Slot contracts active on this template type.
   * Only SlotContractKey values registered in SLOT_CONTRACT_REGISTRY are valid.
   * Empty array means a content-block-only template (article-page, listing-page, detail-page).
   */
  readonly slots: readonly SlotContractKey[];

  /**
   * Whether this template's content area supports a reorderable content blocks array.
   * true for all templates built on article-page, listing-page, detail-page.
   * true for marketing-page and landing-page (they have both slots AND content blocks).
   */
  readonly supportsSections: boolean;

  /**
   * The site types for which this template is relevant.
   * Used to filter the extended template set in the provisioning UI.
   * An empty array means "relevant for all site types".
   */
  readonly recommendedFor: readonly SiteType[];

  /**
   * Whether this template should be pre-selected during provisioning for the
   * appropriate site types (those in recommendedFor, or all if recommendedFor is empty).
   *
   * Pre-selection combines defaultProvision + recommendedFor:
   *   - defaultProvision=true + recommendedFor=[] → selected for all site types
   *   - defaultProvision=true + recommendedFor=["corporate"] → selected for corporate only
   *   - defaultProvision=false → never pre-selected (operator must opt in)
   */
  readonly defaultProvision: boolean;

  /**
   * When true, the template cannot be deselected in the provisioning UI.
   * Used for the homepage — every site must have one.
   * Implies defaultProvision=true.
   */
  readonly locked: boolean;

  /**
   * Visual schematic type for the TemplatePreview SVG component.
   * Maps to a previewType in components/admin/TemplatePreview.tsx.
   */
  readonly previewType: TemplatePreviewType;

  /**
   * Storybook story ID for this template's preview.
   * Format: "{kind-slug}--{story-slug}"
   * Derived from the previewType since previews are grouped by structural layout.
   *
   * @example "admin-templatepreview--marketing"
   */
  readonly previewStoryId: string;

  /**
   * Default URL slug written to the provisioned page (no leading slash; "" = root).
   * Mirrors TemplateCatalogEntry.defaultSlug for use in the UI without a catalog lookup.
   */
  readonly defaultSlug: string;
}

// ── Core template registry ────────────────────────────────────────────────────

const ALL_SITE_TYPES: readonly SiteType[] = ["corporate", "recruitment", "content"];

/**
 * Core templates — the baseline set every site should have.
 *
 * Pre-selection logic:
 *   locked=true      → always included (homepage)
 *   defaultProvision=true + recommendedFor=[]    → all site types
 *   defaultProvision=true + recommendedFor=[…]  → only the listed site types
 *   defaultProvision=false                        → operator must opt in
 */
export const CORE_TEMPLATE_REGISTRY: readonly TemplateRegistryEntry[] = [

  {
    key:                 "homepage",
    label:               "Home",
    description:         "Main landing page — hero, social proof, content sections, and a closing CTA.",
    category:            "core",
    structuralTemplate:  "marketing-page",
    catalogKey:          "home",
    slots:               ["heroSlot", "proofSlot", "ctaSlot"],
    supportsSections:    true,
    recommendedFor:      ALL_SITE_TYPES,
    defaultProvision:    true,
    locked:              true,   // every site must have a homepage
    previewType:         "marketing",
    previewStoryId:      "admin-templatepreview--marketing",
    defaultSlug:         "",
  },

  {
    key:                 "landing_page",
    label:               "Landing page",
    description:         "Focused conversion page — hero, content sections, and a required closing CTA.",
    category:            "core",
    structuralTemplate:  "landing-page",
    catalogKey:          "landing",
    slots:               ["heroSlot", "ctaSlot"],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "landing",
    previewStoryId:      "admin-templatepreview--landing",
    defaultSlug:         "landing",
  },

  {
    key:                 "service_page",
    label:               "Services",
    description:         "Services overview — hero, feature grid, social proof, and a CTA.",
    category:            "core",
    structuralTemplate:  "marketing-page",
    catalogKey:          "services",
    slots:               ["heroSlot", "proofSlot", "featureSlot", "ctaSlot"],
    supportsSections:    true,
    recommendedFor:      ["corporate"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "marketing",
    previewStoryId:      "admin-templatepreview--marketing",
    defaultSlug:         "services",
  },

  {
    key:                 "content_page",
    label:               "Content page",
    description:         "General purpose editorial page — rich-text content blocks only, no adaptive slots.",
    category:            "core",
    structuralTemplate:  "article-page",
    catalogKey:          "content-page",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "article",
    previewStoryId:      "admin-templatepreview--article",
    defaultSlug:         "content",
  },

  {
    key:                 "listing_page",
    label:               "Listing page",
    description:         "Generic listing — intro header and a card grid of items (articles, products, resources).",
    category:            "core",
    structuralTemplate:  "listing-page",
    catalogKey:          "listing-generic",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ALL_SITE_TYPES,
    defaultProvision:    false,
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "listing",
  },

  {
    key:                 "detail_page",
    label:               "Detail page",
    description:         "Generic entity detail — meta header, body content, and optional related items.",
    category:            "core",
    structuralTemplate:  "detail-page",
    catalogKey:          "detail-generic",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ALL_SITE_TYPES,
    defaultProvision:    false,
    locked:              false,
    previewType:         "detail",
    previewStoryId:      "admin-templatepreview--detail",
    defaultSlug:         "detail",
  },

  {
    key:                 "contact_page",
    label:               "Contact",
    description:         "Contact page — hero, intro content, conversion form, and a CTA.",
    category:            "core",
    structuralTemplate:  "landing-page",
    catalogKey:          "contact",
    slots:               ["heroSlot", "conversionSlot"],
    supportsSections:    true,
    recommendedFor:      ALL_SITE_TYPES,
    defaultProvision:    true,
    locked:              false,
    previewType:         "landing",
    previewStoryId:      "admin-templatepreview--landing",
    defaultSlug:         "contact",
  },

  {
    key:                 "basic_page",
    label:               "Basic page",
    description:         "Minimal page — no adaptive slots, content blocks only. For simple static content.",
    category:            "core",
    structuralTemplate:  "article-page",
    catalogKey:          "basic-page",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ALL_SITE_TYPES,
    defaultProvision:    false,
    locked:              false,
    previewType:         "article",
    previewStoryId:      "admin-templatepreview--article",
    defaultSlug:         "page",
  },

] as const;

// ── Extended template registry ────────────────────────────────────────────────

/**
 * Extended templates — optional additions recommended for specific site types.
 *
 * None are pre-selected by default.  Operators add them manually during
 * provisioning.  The UI filters this set by the active site type using
 * recommendedFor so irrelevant templates are hidden.
 */
export const EXTENDED_TEMPLATE_REGISTRY: readonly TemplateRegistryEntry[] = [

  {
    key:                 "sector_page",
    label:               "Sector page",
    description:         "Industry or sector-specific landing — hero, feature highlights, trust signals, and a CTA.",
    category:            "extended",
    structuralTemplate:  "marketing-page",
    catalogKey:          "sector-page",
    slots:               ["heroSlot", "featureSlot", "trustSlot", "ctaSlot"],
    supportsSections:    true,
    recommendedFor:      ["corporate"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "marketing",
    previewStoryId:      "admin-templatepreview--marketing",
    defaultSlug:         "sector",
  },

  {
    key:                 "comparison_page",
    label:               "Comparison page",
    description:         "Product or plan comparison — hero, side-by-side comparison blocks, and a conversion section.",
    category:            "extended",
    structuralTemplate:  "landing-page",
    catalogKey:          "comparison-page",
    slots:               ["heroSlot", "conversionSlot"],
    supportsSections:    true,
    recommendedFor:      ["corporate"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "landing",
    previewStoryId:      "admin-templatepreview--landing",
    defaultSlug:         "compare",
  },

  {
    key:                 "team_listing",
    label:               "Team listing",
    description:         "Team overview — intro header and a grid of team member cards.",
    category:            "extended",
    structuralTemplate:  "listing-page",
    catalogKey:          "team",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "recruitment"],
    defaultProvision:    true,   // default for corporate + recruitment
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "team",
  },

  {
    key:                 "team_detail",
    label:               "Team member detail",
    description:         "Individual team member — photo, bio, credentials, and related content.",
    category:            "extended",
    structuralTemplate:  "detail-page",
    catalogKey:          "team-detail",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "recruitment"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "detail",
    previewStoryId:      "admin-templatepreview--detail",
    defaultSlug:         "team/member",
  },

  {
    key:                 "news_listing",
    label:               "News listing",
    description:         "News or blog archive — intro heading and a card grid of articles.",
    category:            "extended",
    structuralTemplate:  "listing-page",
    catalogKey:          "news-listing",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "news",
  },

  {
    key:                 "news_detail",
    label:               "Article detail",
    description:         "Individual article — meta header, rich-text body, and related articles.",
    category:            "extended",
    structuralTemplate:  "article-page",
    catalogKey:          "news-detail",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "article",
    previewStoryId:      "admin-templatepreview--article",
    defaultSlug:         "news/article",
  },

  {
    key:                 "case_listing",
    label:               "Case studies listing",
    description:         "Client case studies archive — intro heading and a card grid of cases.",
    category:            "extended",
    structuralTemplate:  "listing-page",
    catalogKey:          "cases-listing",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "cases",
  },

  {
    key:                 "case_detail",
    label:               "Case study detail",
    description:         "Single case study — meta header, challenge/solution body, results, and related cases.",
    category:            "extended",
    structuralTemplate:  "detail-page",
    catalogKey:          "case-detail",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "detail",
    previewStoryId:      "admin-templatepreview--detail",
    defaultSlug:         "cases/case",
  },

  {
    key:                 "vacancy_listing",
    label:               "Vacancies listing",
    description:         "Job board — filter bar and a card grid of open vacancies.",
    category:            "extended",
    structuralTemplate:  "listing-page",
    catalogKey:          "vacancies-listing",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["recruitment"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "jobs",
  },

  {
    key:                 "vacancy_detail",
    label:               "Vacancy detail",
    description:         "Single vacancy — job meta header, description, apply panel, and related vacancies.",
    category:            "extended",
    structuralTemplate:  "detail-page",
    catalogKey:          "vacancy-detail",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["recruitment"],
    defaultProvision:    true,
    locked:              false,
    previewType:         "detail",
    previewStoryId:      "admin-templatepreview--detail",
    defaultSlug:         "jobs/vacancy",
  },

  {
    key:                 "event_listing",
    label:               "Events listing",
    description:         "Upcoming events archive — intro heading and a card grid of events.",
    category:            "extended",
    structuralTemplate:  "listing-page",
    catalogKey:          "event-listing",
    slots:               [],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "listing",
    previewStoryId:      "admin-templatepreview--listing",
    defaultSlug:         "events",
  },

  {
    key:                 "event_detail",
    label:               "Event detail",
    description:         "Single event page — hero, event details, and a registration CTA.",
    category:            "extended",
    structuralTemplate:  "marketing-page",
    catalogKey:          "event-detail",
    slots:               ["heroSlot", "conversionSlot"],
    supportsSections:    true,
    recommendedFor:      ["corporate", "content"],
    defaultProvision:    false,
    locked:              false,
    previewType:         "marketing",
    previewStoryId:      "admin-templatepreview--marketing",
    defaultSlug:         "events/event",
  },

] as const;

// ── Combined registry ─────────────────────────────────────────────────────────

/**
 * Full ordered template registry: core entries first, then extended.
 * Use this for complete iteration (e.g. building the provisioning UI).
 */
export const FULL_TEMPLATE_REGISTRY: readonly TemplateRegistryEntry[] = [
  ...CORE_TEMPLATE_REGISTRY,
  ...EXTENDED_TEMPLATE_REGISTRY,
] as const;

/**
 * O(1) lookup map keyed by TemplateRegistryKey.
 */
export const TEMPLATE_REGISTRY_MAP: Readonly<Record<TemplateRegistryKey, TemplateRegistryEntry>> =
  Object.fromEntries(
    FULL_TEMPLATE_REGISTRY.map((e) => [e.key, e]),
  ) as Readonly<Record<TemplateRegistryKey, TemplateRegistryEntry>>;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns the registry entry for the given TemplateRegistryKey.
 * Returns undefined for unknown keys — safe with untrusted input.
 */
export function getTemplateRegistryEntry(
  key: TemplateRegistryKey,
): TemplateRegistryEntry | undefined {
  return TEMPLATE_REGISTRY_MAP[key];
}

/**
 * Returns all registry entries with the given category, in canonical order.
 */
export function getRegistryByCategory(
  category: TemplateRegistryCategory,
): TemplateRegistryEntry[] {
  return FULL_TEMPLATE_REGISTRY.filter((e) => e.category === category);
}

/**
 * Finds a registry entry by its TemplateCatalogKey bridge value.
 * Useful when the provisioning result returns a catalogKey and you need
 * to look up the richer registry metadata.
 */
export function getRegistryEntryByCatalogKey(
  catalogKey: TemplateCatalogKey,
): TemplateRegistryEntry | undefined {
  return FULL_TEMPLATE_REGISTRY.find((e) => e.catalogKey === catalogKey);
}

/**
 * Returns the TemplateCatalogKey values that should be pre-selected during
 * provisioning for the given site type.
 *
 * Selection criteria:
 *   1. Locked entries (homepage) are always included.
 *   2. Entries with defaultProvision=true AND recommendedFor includes the
 *      given siteType (or recommendedFor is empty = all types) are included.
 *
 * The returned keys are passed directly to createSiteAction as selectedTemplates.
 */
export function getDefaultSelectedTemplates(
  siteType: SiteType,
): TemplateCatalogKey[] {
  return FULL_TEMPLATE_REGISTRY
    .filter((entry) => {
      if (entry.locked) return true;
      if (!entry.defaultProvision) return false;
      const rf = entry.recommendedFor;
      return rf.length === 0 || (rf as readonly string[]).includes(siteType);
    })
    .map((entry) => entry.catalogKey);
}

/**
 * Returns the slot contract for the given key.
 * Returns undefined for unknown keys.
 */
export function getSlotContract(
  key: SlotContractKey,
): SlotContract {
  return SLOT_CONTRACT_REGISTRY[key];
}

/**
 * Returns only the active slot contracts (those currently wired end-to-end).
 */
export function getActiveSlotContracts(): SlotContract[] {
  return Object.values(SLOT_CONTRACT_REGISTRY).filter(
    (s) => s.status === "active",
  );
}
