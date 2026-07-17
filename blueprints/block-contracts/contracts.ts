/**
 * Block Content Contracts — Canonical Definitions
 *
 * One BlockContentContract per block type.  These are the authoritative
 * specifications for what content each block requires to render correctly.
 *
 * ─── Contract coverage ───────────────────────────────────────────────────────
 *
 *   Context slots (decision-engine rendered):
 *     hero, proof, cta
 *
 *   Content blocks (static, ContentBlockKey):
 *     textSection       richText          contentSection
 *     featureGrid       testimonialSection logoStrip
 *     stats             faqSection        ctaSection
 *     slider            formSection       contactSection
 *     processSteps      relatedContent    filterBar
 *     listing           pricingSection    teamSection
 *     cartSummary       productDetail     productOverview
 *     vacancyMeta       applyPanel        recruiterPanel
 *
 * ─── Naming note ──────────────────────────────────────────────────────────────
 *
 *   Blueprint page templates historically used informal aliases:
 *     "cardGrid"    → resolves to "listing"
 *     "mediaSection"→ resolves to "slider"
 *     "featureList" → resolves to "featureGrid" (checklist variant)
 *     "relatedGrid" → resolves to "relatedContent"
 *     "stepsSection"→ resolves to "processSteps"
 *     "reviewSection"→ resolves to "testimonialSection"
 *
 *   These are documented via `templateAliases` so the alias→canonical
 *   mapping is always derivable.
 */

import type { BlockContentContract } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns error if field is absent / null / empty string. */
function requireField(field: string, label: string) {
  return {
    id:          `required_${field}`,
    description: `${label} is required`,
    validate:    (d: Record<string, unknown>) => {
      const v = d[field];
      if (v === undefined || v === null || v === "") {
        return `"${field}" is required but was ${v === undefined ? "absent" : "empty"}.`;
      }
      return null;
    },
  };
}

/** Returns error if array field has fewer than minItems items. */
function requireMinItems(field: string, minItems: number, label: string) {
  return {
    id:          `min_items_${field}`,
    description: `${label} requires at least ${minItems} item${minItems !== 1 ? "s" : ""}`,
    validate:    (d: Record<string, unknown>) => {
      const v = d[field];
      if (!Array.isArray(v) || v.length < minItems) {
        return `"${field}" must contain at least ${minItems} item${minItems !== 1 ? "s" : ""} (found ${Array.isArray(v) ? v.length : 0}).`;
      }
      return null;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SLOTS
// These blocks are rendered through the decision engine.
// They are NOT ContentBlockKey entries.
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_CONTRACT: BlockContentContract = {
  blockType:       "hero",
  label:           "Hero",
  description:     "Primary above-the-fold section rendered via the decision engine context slot.",
  dataType:        "",
  isContextSlot:   true,
  required: [
    { name: "headline",   type: "string",  description: "Primary heading — the main value proposition or action trigger.", example: "Wij maken marketing die werkt." },
  ],
  optional: [
    { name: "subheadline", type: "string",  description: "Supporting copy under the headline.", example: "Aantoonbaar. Meetbaar. Resultaatgericht." },
    { name: "primaryCta",  type: "cta",     description: "Primary call-to-action button.", example: { label: "Plan een gesprek", href: "/contact" } },
    { name: "secondaryCta",type: "cta",     description: "Secondary action (learn more, scroll down)." },
    { name: "imageUrl",    type: "url",     description: "Hero background or side image." },
    { name: "imageAlt",    type: "string",  description: "Alt text for the hero image." },
  ],
  supportedPageTypes: ["homepage"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireField("headline", "Hero headline"),
  ],
};

export const NOTIFICATION_CONTRACT: BlockContentContract = {
  blockType:       "notification",
  label:           "Notification",
  description:     "Adaptive overlay notification — toast or banner rendered above the page layout via the decision engine context slot.",
  dataType:        "NotificationBlockData",
  isContextSlot:   true,
  required: [
    { name: "message",  type: "string", description: "Main notification message text.", example: "🎉 Bekijk onze nieuwe functie — nu beschikbaar!" },
    { name: "severity", type: "string", description: "Visual severity / colour scheme: info | success | warning | promo.", example: "promo" },
  ],
  optional: [
    { name: "ctaLabel",      type: "string",  description: "CTA button label.", example: "Bekijk aanbieding" },
    { name: "ctaHref",       type: "url",     description: "CTA button href." },
    { name: "position",      type: "string",  description: "Anchor position: top | bottom-right.", example: "top" },
    { name: "dismissible",   type: "boolean", description: "Whether the visitor can dismiss the notification." },
    { name: "autoDismissMs", type: "number",  description: "Auto-dismiss delay in ms (0 = never)." },
  ],
  // "landing" is not a PageTypeKey — the union is homepage | overview | detail |
  // form | process, and "homepage" is the landing page (see its comment in
  // blueprints/site-models/types.ts). The value never matched anything; it was a
  // silent no-op in the middle of a list that reads as if it means something.
  // Not swapped for another key: which pages a notification belongs on is a
  // product call, and this states the two it already effectively had.
  supportedPageTypes: ["homepage", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireField("message",  "Notification message"),
    requireField("severity", "Notification severity"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEXT CONTENT BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "textSection",
  label:            "Text Section",
  description:      "Plain heading + body paragraph. Used as page/section intro and overview headers.",
  dataType:         "TextSectionBlockData",
  templateAliases:  [],
  required: [
    { name: "body", type: "string", description: "Main body text of the section.", example: "Wij zijn een full-service marketingbureau." },
  ],
  optional: [
    { name: "heading",   type: "string", description: "Section heading.", example: "Diensten" },
    { name: "alignment", type: "enum",   description: "Text alignment.", allowedValues: ["left", "center", "right"] },
  ],
  supportedPageTypes: ["homepage", "overview", "detail", "form", "process"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
};

export const RICH_TEXT_CONTRACT: BlockContentContract = {
  blockType:        "richText",
  label:            "Rich Text / Body Copy",
  description:      "Portable Text / markdown body for long-form article or description content.",
  dataType:         "RichTextBlockData",
  required: [
    { name: "body", type: "richText", description: "Full rich-text / Portable Text body content.", example: "..." },
  ],
  optional: [
    { name: "maxWidth", type: "string", description: "CSS max-width constraint for readability.", example: "72ch" },
  ],
  supportedPageTypes: ["detail", "process"],
  supportedModels:    ["service", "product-saas", "careers", "catalog"],
  rules: [
    requireField("body", "Body copy"),
  ],
};

export const CONTENT_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "contentSection",
  label:            "Content Section",
  description:      "Structured editorial section: eyebrow → heading → intro → body → CTAs.",
  dataType:         "ContentSectionBlockData",
  required: [
    { name: "heading", type: "string", description: "Section heading.", example: "Over ons" },
  ],
  optional: [
    { name: "eyebrow",  type: "string",  description: "Small label above the heading." },
    { name: "intro",    type: "string",  description: "Lead paragraph." },
    { name: "body",     type: "richText",description: "Full rich-text body." },
    { name: "ctas",     type: "array",   description: "CTA buttons.", subFields: ["label", "href", "variant"] },
    { name: "maxWidth", type: "string",  description: "CSS max-width." },
    { name: "align",    type: "enum",    description: "Content alignment.", allowedValues: ["left", "center"] },
  ],
  supportedPageTypes: ["detail", "process"],
  supportedModels:    ["service", "product-saas", "careers"],
  rules: [
    requireField("heading", "Section heading"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE / ATTRIBUTE BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_GRID_CONTRACT: BlockContentContract = {
  blockType:        "featureGrid",
  label:            "Feature Grid / Attributes",
  description:      "Grid of feature or attribute cards. Used for services overview, key benefits, and specifications.",
  dataType:         "FeatureGridBlockData",
  templateAliases:  ["featureList", "attributeGrid", "serviceGrid"],
  required: [
    {
      name:        "features",
      type:        "array",
      description: "Array of feature/attribute items.",
      minItems:    1,
      subFields:   ["title", "description", "icon"],
      example:     [{ title: "Strategie", description: "Positionering en merkstrategie op maat." }],
    },
  ],
  optional: [
    { name: "heading",  type: "string",  description: "Section heading." },
    { name: "columns",  type: "number",  description: "Number of grid columns (2–4).", example: 3 },
    { name: "cta",      type: "cta",     description: "Optional CTA below the grid.", subFields: ["label", "href", "variant"] },
  ],
  supportedPageTypes: ["homepage", "overview", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireMinItems("features", 1, "Feature grid"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PROOF BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const TESTIMONIAL_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "testimonialSection",
  label:            "Testimonials",
  description:      "Customer or employee testimonials with quote, author, and optional avatar.",
  dataType:         "TestimonialSectionBlockData",
  templateAliases:  ["reviewSection"],
  required: [
    {
      name:        "testimonials",
      type:        "array",
      description: "Array of testimonial items.",
      minItems:    1,
      subFields:   ["quote", "author", "company", "avatar"],
      example:     [{ quote: "Fantastisch resultaat.", author: "Jan de Vries", company: "Acme BV" }],
    },
  ],
  optional: [
    { name: "heading", type: "string", description: "Section heading.", example: "Wat onze klanten zeggen" },
  ],
  supportedPageTypes: ["homepage", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireMinItems("testimonials", 1, "Testimonials"),
  ],
};

export const LOGO_STRIP_CONTRACT: BlockContentContract = {
  blockType:        "logoStrip",
  label:            "Logo Strip / Trust Signals",
  description:      "Horizontal strip of logos. Used for client logos, partner badges, or certification marks.",
  dataType:         "LogoStripBlockData",
  templateAliases:  ["reassurance", "trustStrip"],
  required: [
    {
      name:        "logos",
      type:        "array",
      description: "Array of logo items.",
      minItems:    1,
      subFields:   ["name", "src", "url"],
      example:     [{ name: "Klant A", src: "/logos/klant-a.svg" }],
    },
  ],
  optional: [
    { name: "heading",           type: "string",  description: "Optional label above the strip.", example: "Vertrouwd door" },
    { name: "animationEnabled",  type: "boolean", description: "Animate logos via marquee scroll.", example: false },
    { name: "speed",             type: "number",  description: "Scroll speed in px/s when animation enabled.", example: 40 },
    { name: "grayscale",         type: "boolean", description: "Render logos in grayscale.", example: true },
    { name: "showLabels",        type: "boolean", description: "Show logo name labels.", example: false },
  ],
  supportedPageTypes: ["homepage", "form", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireMinItems("logos", 1, "Logo strip"),
  ],
};

export const STATS_CONTRACT: BlockContentContract = {
  blockType:        "stats",
  label:            "Stats / Proof Numbers",
  description:      "Key metrics and impact numbers. Used for credibility and social proof.",
  dataType:         "StatsBlockData",
  required: [
    {
      name:        "items",
      type:        "array",
      description: "Array of stat items.",
      minItems:    1,
      subFields:   ["value", "label", "prefix", "suffix"],
      example:     [{ value: "247%", label: "Meer organisch verkeer" }],
    },
  ],
  optional: [
    { name: "heading", type: "string", description: "Section heading.", example: "Onze resultaten" },
  ],
  supportedPageTypes: ["homepage", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog"],
  rules: [
    requireMinItems("items", 1, "Stats"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT / FAQ BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const FAQ_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "faqSection",
  label:            "FAQ",
  description:      "Accordion list of frequently asked questions and answers.",
  dataType:         "FaqSectionBlockData",
  required: [
    {
      name:        "items",
      type:        "array",
      description: "Array of question/answer pairs.",
      minItems:    1,
      subFields:   ["question", "answer"],
      example:     [{ question: "Hoe werkt het?", answer: "Je begint met een intake." }],
    },
  ],
  optional: [
    { name: "heading", type: "string", description: "Section heading.", example: "Veelgestelde vragen" },
  ],
  supportedPageTypes: ["process", "detail", "form"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    requireMinItems("items", 1, "FAQ"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CTA BLOCK
// ─────────────────────────────────────────────────────────────────────────────

export const CTA_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "ctaSection",
  label:            "CTA Section",
  description:      "Full-width call-to-action banner with heading, description, and one or two buttons.",
  dataType:         "CtaSectionBlockData",
  required: [
    { name: "primaryCta", type: "cta", description: "Primary CTA button.", subFields: ["label", "href", "variant"], example: { label: "Plan een gesprek", href: "/contact" } },
  ],
  optional: [
    { name: "title",       type: "string",  description: "CTA heading.", example: "Klaar om te groeien?" },
    { name: "description", type: "string",  description: "Supporting copy." },
    { name: "secondaryCta",type: "cta",     description: "Secondary action." },
    { name: "background",  type: "enum",    description: "Background style.", allowedValues: ["default", "brand", "dark", "muted"] },
    { name: "imageUrl",    type: "url",     description: "Optional background image." },
    { name: "imageAlt",    type: "string",  description: "Background image alt text." },
  ],
  supportedPageTypes: ["homepage", "overview", "detail", "form", "process"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    {
      id:          "cta_has_label",
      description: "Primary CTA must have a label",
      validate:    (d) => {
        const cta = d["primaryCta"] as Record<string, unknown> | undefined;
        if (!cta || !cta["label"]) return '"primaryCta.label" is required.';
        return null;
      },
    },
    {
      id:          "cta_has_href",
      description: "Primary CTA must have a destination href",
      validate:    (d) => {
        const cta = d["primaryCta"] as Record<string, unknown> | undefined;
        if (!cta || !cta["href"]) return '"primaryCta.href" is required.';
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const SLIDER_CONTRACT: BlockContentContract = {
  blockType:        "slider",
  label:            "Gallery / Slider",
  description:      "Multi-image or multi-content slideshow. Used as gallery, hero carousel, and image sequence.",
  dataType:         "SliderBlockData",
  templateAliases:  ["gallery", "mediaSection", "imageGallery"],
  required: [
    {
      name:        "slides",
      type:        "array",
      description: "Array of slide items.",
      minItems:    1,
      subFields:   ["heading", "body", "imageUrl", "imageAlt", "ctaLabel", "ctaHref"],
      example:     [{ imageUrl: "/images/hero.jpg", imageAlt: "Team foto" }],
    },
  ],
  optional: [
    { name: "heading",    type: "string",  description: "Section heading above the slider." },
    { name: "autoPlay",   type: "boolean", description: "Auto-advance slides.", example: false },
    { name: "interval",   type: "number",  description: "Auto-advance interval in ms.", example: 5000 },
  ],
  supportedPageTypes: ["detail", "homepage"],
  supportedModels:    ["service", "careers", "catalog", "commerce"],
  rules: [
    requireMinItems("slides", 1, "Gallery"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const FORM_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "formSection",
  label:            "Form",
  description:      "Dynamic form driven by a form schema. Used for lead capture, applications, and subscriptions.",
  dataType:         "FormBlockData",
  required: [
    { name: "formKey",     type: "string", description: "The form schema key that defines fields and behavior.", example: "contact_default" },
    { name: "submitLabel", type: "string", description: "Submit button label.", example: "Verstuur" },
  ],
  optional: [
    { name: "title",          type: "string", description: "Form heading." },
    { name: "intro",          type: "string", description: "Introductory paragraph above the form." },
    { name: "successMessage", type: "string", description: "Shown after successful submission.", example: "Bedankt! We nemen snel contact op." },
  ],
  supportedPageTypes: ["form"],
  supportedModels:    ["service", "product-saas", "careers", "commerce"],
  rules: [
    requireField("formKey",     "Form key"),
    requireField("submitLabel", "Submit label"),
  ],
};

export const CONTACT_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "contactSection",
  label:            "Contact Info / Map",
  description:      "Contact details block with address, phone, email, hours, and optional map embed.",
  dataType:         "ContactSectionBlockData",
  templateAliases:  ["mapSection", "locationBlock"],
  required: [],
  optional: [
    { name: "heading",     type: "string",  description: "Section heading.", example: "Neem contact op" },
    { name: "description", type: "string",  description: "Supporting intro text." },
    { name: "address",     type: "string",  description: "Street address.", example: "Keizersgracht 123, 1015 CJ Amsterdam" },
    { name: "phone",       type: "string",  description: "Phone number.", example: "+31 20 123 4567" },
    { name: "email",       type: "string",  description: "Email address.", example: "hello@bureau.nl" },
    { name: "hours",       type: "string",  description: "Opening hours text." },
    { name: "mapUrl",      type: "url",     description: "Google Maps embed URL or similar." },
    { name: "ctas",        type: "array",   description: "CTA buttons.", subFields: ["label", "href", "variant"] },
  ],
  supportedPageTypes: ["form", "detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    {
      id:          "contact_has_something",
      description: "Contact section should have at least one of: address, phone, email, mapUrl",
      validate:    (d) => {
        const has = (f: string) => !!d[f] && d[f] !== "";
        if (!has("address") && !has("phone") && !has("email") && !has("mapUrl")) {
          return "contactSection has no contact information — add at least one of: address, phone, email, mapUrl.";
        }
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const PROCESS_STEPS_CONTRACT: BlockContentContract = {
  blockType:        "processSteps",
  label:            "Process Steps",
  description:      "Numbered or sequential step list. Used for how-it-works, onboarding, and application flows.",
  dataType:         "ProcessStepsBlockData",
  templateAliases:  ["stepsSection", "howItWorks"],
  required: [
    {
      name:        "steps",
      type:        "array",
      description: "Array of process steps.",
      minItems:    2,
      subFields:   ["title", "description", "duration"],
      example:     [{ title: "Intake", description: "We bespreken jouw situatie." }, { title: "Aanpak", description: "We stellen een plan op." }],
    },
  ],
  optional: [
    { name: "heading", type: "string", description: "Section heading.", example: "Hoe werkt het?" },
  ],
  supportedPageTypes: ["process"],
  supportedModels:    ["service", "product-saas", "careers"],
  rules: [
    requireMinItems("steps", 2, "Process steps"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTING / GRID BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const LISTING_CONTRACT: BlockContentContract = {
  blockType:        "listing",
  label:            "Listing Grid / Card Grid",
  description:      "Generic content grid for articles, services, cases, jobs, and products.",
  dataType:         "ListingBlockData",
  templateAliases:  ["cardGrid", "listingGrid", "caseGrid", "serviceCards"],
  required: [],
  optional: [
    { name: "heading",       type: "string",  description: "Section heading." },
    { name: "items",         type: "array",   description: "Array of listing items (if static, not from source).", subFields: ["id", "title", "href", "excerpt", "imageUrl", "category"] },
    { name: "maxItems",      type: "number",  description: "Maximum items to display.", example: 6 },
    { name: "viewAllHref",   type: "url",     description: "Link to full listing page." },
    { name: "viewAllLabel",  type: "string",  description: "View all link label.", example: "Bekijk alle cases" },
    { name: "contentSource", type: "enum",    description: "Dynamic content source key.", allowedValues: ["manual", "cms_cases", "cms_vacancies", "cms_articles", "cms_products"] },
  ],
  supportedPageTypes: ["homepage", "overview"],
  supportedModels:    ["service", "product-saas", "careers", "catalog", "commerce"],
  rules: [
    {
      id:          "listing_has_source_or_items",
      description: "Listing block must have either items or a contentSource",
      validate:    (d) => {
        const hasItems = Array.isArray(d["items"]) && (d["items"] as unknown[]).length > 0;
        const hasSource = !!d["contentSource"] && d["contentSource"] !== "";
        if (!hasItems && !hasSource) {
          return 'listing block requires either "items" (static array) or "contentSource" (dynamic).';
        }
        return null;
      },
    },
  ],
};

export const RELATED_CONTENT_CONTRACT: BlockContentContract = {
  blockType:        "relatedContent",
  label:            "Related Items",
  description:      "Grid of 2–4 related items shown at the bottom of detail pages to reduce dead-ends.",
  dataType:         "RelatedContentBlockData",
  templateAliases:  ["relatedGrid", "similarItems", "alsoRead"],
  required: [],
  optional: [
    { name: "heading",       type: "string",  description: "Section heading.", example: "Gerelateerde artikelen" },
    { name: "items",         type: "array",   description: "Array of related items (static).", subFields: ["id", "title", "href", "excerpt", "imageUrl", "category"] },
    { name: "maxItems",      type: "number",  description: "Maximum items shown.", example: 3 },
    { name: "contentSource", type: "enum",    description: "Dynamic content source for auto-populating.", allowedValues: ["manual", "cms_related", "cms_recent"] },
  ],
  supportedPageTypes: ["detail"],
  supportedModels:    ["service", "product-saas", "careers", "catalog"],
  rules: [
    {
      id:          "related_has_source_or_items",
      description: "Related content must have either items or a contentSource",
      validate:    (d) => {
        const hasItems = Array.isArray(d["items"]) && (d["items"] as unknown[]).length > 0;
        const hasSource = !!d["contentSource"];
        if (!hasItems && !hasSource) {
          return '"relatedContent" requires either "items" or "contentSource".';
        }
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTER / SEARCH BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const FILTER_BAR_CONTRACT: BlockContentContract = {
  blockType:        "filterBar",
  label:            "Filter / Search Bar",
  description:      "Category / tag filter with optional free-text search. Used above listing grids.",
  dataType:         "FilterBarBlockData",
  templateAliases:  ["filterSection", "searchBar"],
  required: [],
  optional: [
    { name: "placeholder",       type: "string",  description: "Search input placeholder.", example: "Zoek een vacature..." },
    { name: "categories",        type: "array",   description: "Category filter options.", subFields: ["label", "value", "count"] },
    { name: "tags",              type: "array",   description: "Tag filter options.", subFields: ["label", "value", "count"] },
    { name: "sortOptions",       type: "array",   description: "Sort options.", subFields: ["label", "value"] },
    { name: "showSearch",        type: "boolean", description: "Show text search input.", example: true },
    { name: "showCategoryFilter",type: "boolean", description: "Show category filter.", example: true },
    { name: "showTagFilter",     type: "boolean", description: "Show tag filter.", example: false },
  ],
  supportedPageTypes: ["overview"],
  supportedModels:    ["careers", "catalog", "commerce"],
  rules: [
    {
      id:          "filter_has_something_enabled",
      description: "Filter bar should have at least one enabled control",
      validate:    (d) => {
        const showSearch   = d["showSearch"]   !== false;
        const showCategory = d["showCategoryFilter"] !== false;
        if (!showSearch && !showCategory) {
          return "filterBar has no enabled controls. Enable at least showSearch or showCategoryFilter.";
        }
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING BLOCK
// ─────────────────────────────────────────────────────────────────────────────

export const PRICING_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "pricingSection",
  label:            "Pricing Table",
  description:      "Pricing tiers with features, CTA per tier, and optional highlighted plan.",
  dataType:         "PricingSectionBlockData",
  required: [
    {
      name:        "tiers",
      type:        "array",
      description: "Array of pricing tier objects.",
      minItems:    1,
      subFields:   ["name", "price", "period", "description", "features", "ctaLabel", "ctaHref", "highlighted"],
      example:     [{ name: "Starter", price: "€49", period: "/ maand", ctaLabel: "Probeer gratis", ctaHref: "/signup", features: ["5 gebruikers", "10 projecten"] }],
    },
  ],
  optional: [
    { name: "heading",    type: "string", description: "Section heading.", example: "Eenvoudige, eerlijke prijzen" },
    { name: "subheading", type: "string", description: "Supporting tagline." },
    { name: "footnote",   type: "string", description: "Small print below the table.", example: "Alle prijzen excl. BTW." },
  ],
  supportedPageTypes: ["overview", "form"],
  supportedModels:    ["product-saas", "commerce"],
  rules: [
    requireMinItems("tiers", 1, "Pricing table"),
    {
      id:          "pricing_tier_has_cta",
      description: "Each pricing tier must have a ctaLabel and ctaHref",
      validate:    (d) => {
        const tiers = d["tiers"] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(tiers)) return null; // other rule catches this
        const invalid = tiers.filter((t) => !t["ctaLabel"] || !t["ctaHref"]);
        if (invalid.length > 0) {
          return `${invalid.length} tier(s) are missing ctaLabel or ctaHref.`;
        }
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TEAM BLOCK
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_SECTION_CONTRACT: BlockContentContract = {
  blockType:        "teamSection",
  label:            "Team / People",
  description:      "Grid of team member or employee profiles.",
  dataType:         "TeamSectionBlockData",
  required: [
    {
      name:        "members",
      type:        "array",
      description: "Array of team member profiles.",
      minItems:    1,
      subFields:   ["name", "role", "bio", "imageUrl", "profileHref"],
      example:     [{ name: "Anna Jansen", role: "Senior Strateeg", imageUrl: "/team/anna.jpg" }],
    },
  ],
  optional: [
    { name: "heading", type: "string", description: "Section heading.", example: "Ons team" },
    { name: "intro",   type: "string", description: "Introductory paragraph." },
  ],
  supportedPageTypes: ["homepage", "detail", "process"],
  supportedModels:    ["service", "careers"],
  rules: [
    requireMinItems("members", 1, "Team section"),
    {
      id:          "team_member_has_name",
      description: "Each team member must have a name",
      validate:    (d) => {
        const members = d["members"] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(members)) return null;
        const unnamed = members.filter((m) => !m["name"] || m["name"] === "");
        if (unnamed.length > 0) return `${unnamed.length} team member(s) are missing a name.`;
        return null;
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCE BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const CART_SUMMARY_CONTRACT: BlockContentContract = {
  blockType:        "cartSummary",
  label:            "Summary Sidebar / Cart",
  description:      "Order summary and cart block shown during checkout or order confirmation.",
  dataType:         "CartSummaryBlockData",
  templateAliases:  ["summarySidebar", "orderSummary"],
  required: [
    { name: "checkoutHref",  type: "url",    description: "URL to proceed to checkout.", example: "/afrekenen" },
    { name: "checkoutLabel", type: "string", description: "Checkout button label.", example: "Ga naar afrekenen" },
  ],
  optional: [
    { name: "heading",               type: "string", description: "Section heading.", example: "Jouw bestelling" },
    { name: "emptyMessage",          type: "string", description: "Message when cart is empty.", example: "Je winkelwagen is leeg." },
    { name: "continueShoppingHref",  type: "url",    description: "Back to shop link." },
    { name: "continueShoppingLabel", type: "string", description: "Back to shop label.", example: "Verder winkelen" },
  ],
  supportedPageTypes: ["form"],
  supportedModels:    ["commerce"],
  rules: [
    requireField("checkoutHref",  "Checkout link"),
    requireField("checkoutLabel", "Checkout button label"),
  ],
};

export const PRODUCT_OVERVIEW_CONTRACT: BlockContentContract = {
  blockType:        "productOverview",
  label:            "Product Overview / Catalogue",
  description:      "Grid of product cards with title, image, price, and CTA.",
  dataType:         "ProductOverviewBlockData",
  required: [
    {
      name:        "products",
      type:        "array",
      description: "Array of product card items.",
      minItems:    1,
      subFields:   ["title", "description", "price", "imageUrl", "imageAlt", "cta"],
      example:     [{ title: "Product A", price: "€49,95", imageUrl: "/products/a.jpg", cta: { label: "Bekijk", href: "/producten/a" } }],
    },
  ],
  optional: [
    { name: "heading",    type: "string",  description: "Section heading.", example: "Ons aanbod" },
    { name: "intro",      type: "string",  description: "Introductory paragraph." },
    { name: "showPrices", type: "boolean", description: "Show prices on cards.", example: true },
    { name: "cta",        type: "cta",     description: "View-all CTA below the grid." },
  ],
  supportedPageTypes: ["homepage", "overview"],
  supportedModels:    ["commerce"],
  rules: [
    requireMinItems("products", 1, "Product overview"),
  ],
};

export const PRODUCT_DETAIL_CONTRACT: BlockContentContract = {
  blockType:        "productDetail",
  label:            "Product Detail",
  description:      "Full product detail view: gallery, description, specs, price, and add-to-cart CTA.",
  dataType:         "ProductDetailBlockData",
  required: [
    { name: "title",       type: "string", description: "Product title.", example: "Premium Leren Tas" },
  ],
  optional: [
    { name: "description",      type: "richText",description: "Full product description." },
    { name: "gallery",          type: "array",   description: "Product images.", subFields: ["src", "alt"] },
    { name: "specs",            type: "array",   description: "Product specifications.", subFields: ["label", "value"] },
    { name: "price",            type: "string",  description: "Price string.", example: "€129,95" },
    { name: "badge",            type: "string",  description: "Badge label (e.g. 'Nieuw', 'Sale')." },
    { name: "cta",              type: "cta",     description: "Primary action (add to cart).", example: { label: "Toevoegen aan winkelwagen", href: "#cart" } },
    { name: "secondaryCta",     type: "cta",     description: "Secondary action (wishlist, compare)." },
    { name: "relatedProducts",  type: "array",   description: "Related product items.", subFields: ["title", "description", "price", "imageUrl", "cta"] },
  ],
  supportedPageTypes: ["detail"],
  supportedModels:    ["commerce"],
  rules: [
    requireField("title", "Product title"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CAREERS-SPECIFIC BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const VACANCY_META_CONTRACT: BlockContentContract = {
  blockType:        "vacancyMeta",
  label:            "Vacancy Meta / Job Header",
  description:      "Structured header for a job detail page: title, department, location, contract type, hours.",
  dataType:         "VacancyMetaBlockData",
  required: [],
  optional: [
    { name: "title",          type: "string",  description: "Job title.", example: "Senior Frontend Developer" },
    { name: "department",     type: "string",  description: "Department name.", example: "Engineering" },
    { name: "location",       type: "string",  description: "Office location.", example: "Amsterdam" },
    { name: "remote",         type: "enum",    description: "Remote work policy.", allowedValues: ["none", "partial", "full"] },
    { name: "contractType",   type: "enum",    description: "Contract type.", allowedValues: ["fulltime", "parttime", "freelance", "temporary"] },
    { name: "hoursPerWeek",   type: "string",  description: "Hours per week.", example: "32–40 uur" },
    { name: "salaryRange",    type: "string",  description: "Salary range.", example: "€4.500–€6.000" },
    { name: "startDate",      type: "string",  description: "Start date." },
    { name: "closingDate",    type: "string",  description: "Application closing date." },
    { name: "level",          type: "enum",    description: "Seniority level.", allowedValues: ["junior", "medior", "senior", "lead", "manager"] },
    { name: "breadcrumbs",    type: "array",   description: "Breadcrumb trail.", subFields: ["label", "href"] },
  ],
  supportedPageTypes: ["detail"],
  supportedModels:    ["careers"],
};

export const APPLY_PANEL_CONTRACT: BlockContentContract = {
  blockType:        "applyPanel",
  label:            "Apply Panel",
  description:      "Sticky or inline apply panel with CTA button and optional quick-apply form key.",
  dataType:         "ApplyPanelBlockData",
  required: [
    { name: "primaryCta", type: "cta", description: "Primary apply CTA.", subFields: ["label", "href"], example: { label: "Solliciteer nu", href: "/solliciteren" } },
  ],
  optional: [
    { name: "heading",       type: "string",  description: "Panel heading.", example: "Enthousiast?" },
    { name: "body",          type: "string",  description: "Short motivating copy." },
    { name: "secondaryCta",  type: "cta",     description: "Secondary action (open sollicitatie)." },
    { name: "formKey",       type: "string",  description: "Quick-apply form key for inline form." },
    { name: "closingDate",   type: "string",  description: "Application deadline shown in panel." },
  ],
  supportedPageTypes: ["detail"],
  supportedModels:    ["careers"],
  rules: [
    {
      id:          "apply_panel_has_cta",
      description: "Apply panel must have a primary CTA with label and href",
      validate:    (d) => {
        const cta = d["primaryCta"] as Record<string, unknown> | undefined;
        if (!cta || !cta["label"] || !cta["href"]) {
          return '"applyPanel.primaryCta" must have both "label" and "href".';
        }
        return null;
      },
    },
  ],
};

export const RECRUITER_PANEL_CONTRACT: BlockContentContract = {
  blockType:        "recruiterPanel",
  label:            "Recruiter Contact Panel",
  description:      "Contact card for the responsible recruiter or HR contact.",
  dataType:         "RecruiterPanelBlockData",
  required: [
    { name: "name", type: "string", description: "Recruiter full name.", example: "Sophie van Dijk" },
  ],
  optional: [
    { name: "heading",   type: "string",  description: "Section heading.", example: "Vragen?" },
    { name: "role",      type: "string",  description: "Recruiter job title.", example: "Talent Acquisition" },
    { name: "bio",       type: "string",  description: "Short bio." },
    { name: "avatarUrl", type: "url",     description: "Profile photo URL." },
    { name: "email",     type: "string",  description: "Contact email." },
    { name: "phone",     type: "string",  description: "Contact phone." },
    { name: "ctaLabel",  type: "string",  description: "CTA button label.", example: "Stel een vraag" },
    { name: "ctaHref",   type: "url",     description: "CTA button link." },
  ],
  supportedPageTypes: ["detail"],
  supportedModels:    ["careers"],
  rules: [
    requireField("name", "Recruiter name"),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_BLOCK_CONTRACTS: BlockContentContract[] = [
  // Context slots
  HERO_CONTRACT,
  NOTIFICATION_CONTRACT,
  // Text
  TEXT_SECTION_CONTRACT,
  RICH_TEXT_CONTRACT,
  CONTENT_SECTION_CONTRACT,
  // Features / proof
  FEATURE_GRID_CONTRACT,
  TESTIMONIAL_SECTION_CONTRACT,
  LOGO_STRIP_CONTRACT,
  STATS_CONTRACT,
  // Content
  FAQ_SECTION_CONTRACT,
  CTA_SECTION_CONTRACT,
  // Media
  SLIDER_CONTRACT,
  // Forms
  FORM_SECTION_CONTRACT,
  CONTACT_SECTION_CONTRACT,
  // Process
  PROCESS_STEPS_CONTRACT,
  // Listing
  LISTING_CONTRACT,
  RELATED_CONTENT_CONTRACT,
  FILTER_BAR_CONTRACT,
  // Pricing
  PRICING_SECTION_CONTRACT,
  // Team
  TEAM_SECTION_CONTRACT,
  // Commerce
  CART_SUMMARY_CONTRACT,
  PRODUCT_OVERVIEW_CONTRACT,
  PRODUCT_DETAIL_CONTRACT,
  // Careers
  VACANCY_META_CONTRACT,
  APPLY_PANEL_CONTRACT,
  RECRUITER_PANEL_CONTRACT,
];

/**
 * O(1) lookup: blockType (or templateAlias) → BlockContentContract.
 *
 * Template aliases (e.g. "cardGrid" → "listing") are registered alongside
 * canonical keys so blueprint templates can use either.
 */
export const BLOCK_CONTRACT_REGISTRY = new Map<string, BlockContentContract>(
  ALL_BLOCK_CONTRACTS.flatMap((c) => {
    const entries: [string, BlockContentContract][] = [[c.blockType, c]];
    if (c.templateAliases) {
      for (const alias of c.templateAliases) {
        entries.push([alias, c]);
      }
    }
    return entries;
  }),
);

/** Resolve a contract by blockType or templateAlias. Returns undefined if not found. */
export function getBlockContract(blockType: string): BlockContentContract | undefined {
  return BLOCK_CONTRACT_REGISTRY.get(blockType);
}
