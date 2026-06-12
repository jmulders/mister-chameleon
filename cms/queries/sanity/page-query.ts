/**
 * Page — Sanity GROQ query and raw response type
 *
 * Defines:
 *   PAGE_BY_SLUG_QUERY   — fetch a single published page by its slug
 *   SanityPageRaw        — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: page ──────────────────────────────────────────────
 *
 *   title           string   Internal page title
 *   slug            slug     URL slug (slug.current)
 *   seoTitle        string?  Per-page SEO title override
 *   seoDescription  text?    Per-page SEO meta description override
 *   sections        array    Inline section objects (discriminated by _type)
 *   isPublished     boolean  Only published pages are returned
 *
 * ─── Sections ────────────────────────────────────────────────────────────────
 *
 *   All 19 schema-backed section types are projected and typed:
 *
 *     Core:        textSection, featureGrid, testimonialSection, faqSection,
 *                  ctaSection, formSection
 *     Listing:     listing, filterBar, searchResults
 *     Detail:      articleMeta, articleBody, relatedContent,
 *                  vacancyMeta, applyPanel
 *     Search:      search
 *     Marketing:   logoStrip, stats, about, newsList
 *
 *   All fields are projected explicitly — no `...` spread — so the shape is
 *   precise and safe to type as a discriminated union.  GROQ returns null for
 *   fields that don't exist on a given section type; the mapper discards nulls.
 *
 * ─── isPublished guard ────────────────────────────────────────────────────────
 *
 *   `isPublished == true` is included in the filter. Draft or unpublished
 *   pages return null, which the page route translates to a 404.
 *
 * ─── Portable Text note ───────────────────────────────────────────────────────
 *
 *   The `body` field on textSection, about, and articleBody is Portable Text
 *   (array of block nodes), typed as PortableTextBlock[].
 *   On applyPanel `body` is a plain text string.
 *   Rendering is handled by PortableTextRenderer in components/blocks/sections/.
 */

import type { PortableTextBlock } from "../../types";

// ── Shared sub-types ───────────────────────────────────────────────────────────

/** Universal array item for sections that share an `items[]` array.
 *  GROQ projects all possible sub-fields; the mapper uses only the ones
 *  relevant to the parent section's _type. */
export interface SanityUniversalItemRaw {
  _key:         string;
  id?:          string;
  // faqSection
  question?:    string;
  answer?:      string;
  // listing / relatedContent
  title?:       string;
  href?:        string;
  excerpt?:     string;
  date?:        string;
  category?:    string;
  tags?:        string[];
  imageUrl?:    string;
  imageAlt?:    string;
  // newsList
  url?:         string;
  // stats
  label?:       string;
  value?:       string;
  prefix?:      string;
  suffix?:      string;
  description?: string;
}

export interface SanityFilterOptionRaw {
  _key:   string;
  label:  string;
  value:  string;
  count?: number;
}

export interface SanityCtaButtonRaw {
  _key?:    string;
  label?:   string;
  href?:    string;
  variant?: string;
}

export interface SanityTeamMemberRaw {
  _key:         string;
  name?:        string;
  role?:        string;
  bio?:         string;
  imageUrl?:    string;
  profileHref?: string;
}

export interface SanityLogoItemRaw {
  _key:  string;
  name:  string;
  src:   string;
  url?:  string;
}

export interface SanityAuthorRaw {
  name?:      string;
  role?:      string;
  href?:      string;
  avatarUrl?: string;
}

export interface SanityCtaObjectRaw {
  label?: string;
  href?:  string;
}

// ── Core section raw types ─────────────────────────────────────────────────────

export interface SanityTextSectionRaw {
  _type:    "textSection";
  _key:     string;
  variant?: string;
  heading?: string;
  body?:    PortableTextBlock[];
}

export interface SanityFeatureItemRaw {
  title:       string;
  description: string;
  icon?:       string;
}

export interface SanityFeatureGridRaw {
  _type:      "featureGrid";
  _key:       string;
  variant?:   string;
  heading?:   string;
  features?:  SanityFeatureItemRaw[];
  ctaLabel?:  string;
  ctaHref?:   string;
  ctaVariant?: string;
}

export interface SanityTestimonialItemRaw {
  quote:      string;
  author:     string;
  role?:      string;
  company?:   string;
  avatarUrl?: string;
}

export interface SanityTestimonialSectionRaw {
  _type:          "testimonialSection";
  _key:           string;
  variant?:       string;
  heading?:       string;
  testimonials?:  SanityTestimonialItemRaw[];
}

export interface SanityFaqItemRaw {
  question: string;
  /** Plain text string — the Sanity faqSection schema uses type "text", not Portable Text. */
  answer:   string;
}

export interface SanityFaqSectionRaw {
  _type:    "faqSection";
  _key:     string;
  variant?: string;
  heading?: string;
  items?:   SanityFaqItemRaw[];
}

export interface SanityCtaSectionRaw {
  _type:        "ctaSection";
  _key:         string;
  variant?:     string;
  title?:       string;
  description?: string;
  /** Structured CTA button — preferred over the flat legacy fields. */
  cta?: {
    label?: string;
    href?:  string;
  };
  /** @deprecated Use `cta.label`. Present on documents not yet re-saved in Studio. */
  buttonLabel?: string;
  /** @deprecated Use `cta.href`. Present on documents not yet re-saved in Studio. */
  buttonHref?:  string;
}

export interface SanityFormSectionRaw {
  _type:           "formSection";
  _key:            string;
  variant?:        string;
  formKey?:        string;
  title?:          string;
  intro?:          string;
  submitLabel?:    string;
  successMessage?: string;
}

// ── Listing section raw types ──────────────────────────────────────────────────

export interface SanityListingSectionRaw {
  _type:         "listing";
  _key:          string;
  variant?:      string;
  heading?:      string;
  items?:        SanityUniversalItemRaw[];
  maxItems?:     number;
  viewAllHref?:  string;
  viewAllLabel?: string;
}

export interface SanityFilterBarSectionRaw {
  _type:               "filterBar";
  _key:                string;
  variant?:            string;
  placeholder?:        string;
  showSearch?:         boolean;
  showCategoryFilter?: boolean;
  showTagFilter?:      boolean;
  categories?:         SanityFilterOptionRaw[];
  tags?:               SanityFilterOptionRaw[];
  sortOptions?:        SanityFilterOptionRaw[];
}

export interface SanitySearchResultsSectionRaw {
  _type:          "searchResults";
  _key:           string;
  variant?:       string;
  heading?:       string;
  emptyMessage?:  string;
  itemsPerPage?:  number;
  items?:         SanityUniversalItemRaw[];
  enableSearch?:  boolean;
  enableFilter?:  boolean;
}

// ── Detail section raw types ───────────────────────────────────────────────────

export interface SanityArticleMetaSectionRaw {
  _type:           "articleMeta";
  _key:            string;
  variant?:        string;
  title?:          string;
  publishedAt?:    string;
  updatedAt?:      string;
  category?:       string;
  readingTime?:    number;
  summary?:        string;
  tags?:           string[];
  author?:         SanityAuthorRaw;
  coverImageUrl?:  string;
  coverImageAlt?:  string;
}

export interface SanityArticleBodySectionRaw {
  _type:    "articleBody";
  _key:     string;
  variant?: string;
  body?:    PortableTextBlock[];
}

export interface SanityRelatedContentSectionRaw {
  _type:     "relatedContent";
  _key:      string;
  variant?:  string;
  heading?:  string;
  maxItems?: number;
  items?:    SanityUniversalItemRaw[];
}

export interface SanityVacancyMetaSectionRaw {
  _type:          "vacancyMeta";
  _key:           string;
  variant?:       string;
  title?:         string;
  department?:    string;
  location?:      string;
  remote?:        string;
  contractType?:  string;
  hoursPerWeek?:  string;
  salaryRange?:   string;
  startDate?:     string;
  closingDate?:   string;
  level?:         string;
}

export interface SanityApplyPanelSectionRaw {
  _type:         "applyPanel";
  _key:          string;
  variant?:      string;
  heading?:      string;
  /** Plain text string (Sanity type "text") */
  body?:         string;
  closingDate?:  string;
  primaryCta?:   SanityCtaObjectRaw;
  secondaryCta?: SanityCtaObjectRaw;
  formKey?:      string;
}

// ── Search section raw types ───────────────────────────────────────────────────

export interface SanitySearchSectionRaw {
  _type:             "search";
  _key:              string;
  variant?:          string;
  title?:            string;
  placeholder?:      string;
  description?:      string;
  scopes?:           string[];
  showFilters?:      boolean;
  enableInstant?:    boolean;
  maxResults?:       number;
  emptyMessage?:     string;
  noResultsMessage?: string;
}

// ── Marketing section raw types ────────────────────────────────────────────────

export interface SanityLogoStripSectionRaw {
  _type:             "logoStrip";
  _key:              string;
  variant?:          string;
  heading?:          string;
  logos?:            SanityLogoItemRaw[];
  // Display options (all optional — component defaults apply when absent)
  animationEnabled?: boolean;
  speed?:            string;
  grayscale?:        boolean;
  showLabels?:       boolean;
}

export interface SanityStatsSectionRaw {
  _type:    "stats";
  _key:     string;
  variant?: string;
  heading?: string;
  items?:   SanityUniversalItemRaw[];
}

export interface SanityAboutSectionRaw {
  _type:        "about";
  _key:         string;
  variant?:     string;
  heading?:     string;
  body?:        PortableTextBlock[];
  imageUrl?:    string;
  imageAlt?:    string;
  ctas?:        SanityCtaButtonRaw[];
  teamMembers?: SanityTeamMemberRaw[];
}

export interface SanityNewsListSectionRaw {
  _type:     "newsList";
  _key:      string;
  variant?:  string;
  heading?:  string;
  maxItems?: number;
  items?:    SanityUniversalItemRaw[];
}

// ── Text + Media section raw type ─────────────────────────────────────────────

export interface SanityTextMediaCtaRaw {
  _key?:   string;
  label?:  string;
  href?:   string;
}

export interface SanityTextMediaSectionRaw {
  _type:      "textMedia";
  _key:       string;
  variant?:   string;
  eyebrow?:   string;
  heading?:   string;
  body?:      string;
  mediaType?: "image" | "video";
  /** Resolved from coalesce(image.asset->url, mediaUrl) for backward compat. */
  mediaUrl?:  string;
  /** Resolved from coalesce(image.alt, mediaAlt) for backward compat. */
  mediaAlt?:  string;
  videoUrl?:  string;
  caption?:   string;
  ctas?:      SanityTextMediaCtaRaw[];
  /** Background type for the media panel — "color" | "image" | "none" */
  mediaBgType?:     string;
  /** CSS colour value — used when mediaBgType = "color" */
  mediaBgColor?:    string;
  /** Resolved background image URL — used when mediaBgType = "image" */
  mediaBgImageUrl?: string;
}

// ── Team section raw type ──────────────────────────────────────────────────────

export interface SanityTeamMemberPhotoRaw {
  _key:         string;
  name?:        string;
  role?:        string;
  bio?:         string;
  /** Resolved from coalesce(photo.asset->url, imageUrl) for backward compat. */
  imageUrl?:    string;
  profileHref?: string;
  linkedinUrl?: string;
  twitterUrl?:  string;
  githubUrl?:   string;
}

export interface SanityTeamSectionRaw {
  _type:    "teamSection";
  _key:     string;
  variant?: string;
  heading?: string;
  intro?:   string;
  members?: SanityTeamMemberPhotoRaw[];
}

// ── Recruiter panel section raw type ──────────────────────────────────────────

export interface SanityRecruiterPanelSectionRaw {
  _type:      "recruiterPanel";
  _key:       string;
  variant?:   string;
  heading?:   string;
  name?:      string;
  role?:      string;
  bio?:       string;
  /** Resolved from coalesce(avatar.asset->url, avatarUrl) for backward compat. */
  avatarUrl?: string;
  email?:     string;
  phone?:     string;
  ctaLabel?:  string;
  ctaHref?:   string;
}

// ── Commerce / product raw types ──────────────────────────────────────────────

export interface SanityProductCardRaw {
  title:       string;
  description: string;
  price?:      string;
  badge?:      string;
  /** Resolved image URL — the mapper calls urlForImage on this */
  image?:      { asset?: { _ref?: string } };
  ctaLabel?:   string;
  ctaHref?:    string;
  ctaVariant?: string;
}

export interface SanityProductOverviewRaw {
  _type:       "productOverview";
  _key:        string;
  variant?:    string;
  heading?:    string;
  intro?:      string;
  showPrices?: boolean;
  products?:   SanityProductCardRaw[];
  ctaLabel?:   string;
  ctaHref?:    string;
  ctaVariant?: string;
}

export interface SanityGalleryImageRaw {
  image?: { asset?: { _ref?: string } };
  alt?:   string;
}

export interface SanitySpecItemRaw {
  label: string;
  value: string;
}

export interface SanityProductDetailRaw {
  _type:               "productDetail";
  _key:                string;
  variant?:            string;
  title?:              string;
  description?:        string;
  price?:              string;
  badge?:              string;
  gallery?:            SanityGalleryImageRaw[];
  specs?:              SanitySpecItemRaw[];
  ctaLabel?:           string;
  ctaHref?:            string;
  ctaVariant?:         string;
  secondaryCtaLabel?:  string;
  secondaryCtaHref?:   string;
  secondaryCtaVariant?: string;
  relatedProducts?:    SanityProductCardRaw[];
}

// ── Map raw type ──────────────────────────────────────────────────────────────

export interface SanityMapBlockSectionRaw {
  _type:     "mapBlock";
  _key:      string;
  variant?:  string;
  heading?:  string;
  address?:  string;
  city?:     string;
  country?:  string;
  email?:    string;
  phone?:    string;
  embedUrl?: string;
}

export interface SanityCartSummarySectionRaw {
  _type:                 "cartSummary";
  _key:                  string;
  variant?:              string;
  heading?:              string;
  emptyMessage?:         string;
  checkoutHref?:         string;
  continueShoppingHref?: string;
  checkoutLabel?:        string;
  continueShoppingLabel?: string;
  planId?:               string;
}

export interface SanityCheckoutBlockSectionRaw {
  _type:           "checkoutBlock";
  _key:            string;
  variant?:        string;
  heading?:        string;
  intro?:          string;
  paymentProvider?: string;
  returnHref?:     string;
  returnLabel?:    string;
  planId?:         string;
}

// ── Process Steps section raw type ────────────────────────────────────────────

export interface SanityProcessStepRaw {
  _key:         string;
  title?:       string;
  description?: string;
  duration?:    string;
}

export interface SanityProcessStepsSectionRaw {
  _type:    "processSteps";
  _key:     string;
  variant?: string;
  heading?: string;
  steps?:   SanityProcessStepRaw[];
}

// ── Pricing Section raw types ─────────────────────────────────────────────────

export interface SanityPricingFeatureRaw {
  _key:   string;
  label?: string;
}

export interface SanityPricingTierRaw {
  _key:         string;
  name?:        string;
  price?:       string;
  period?:      string;
  description?: string;
  features?:    SanityPricingFeatureRaw[];
  ctaLabel?:    string;
  ctaHref?:     string;
  highlighted?: boolean;
  badge?:       string;
}

export interface SanityPricingSectionRaw {
  _type:       "pricingSection";
  _key:        string;
  variant?:    string;
  heading?:    string;
  subheading?: string;
  tiers?:      SanityPricingTierRaw[];
  footnote?:   string;
}

// ── Discriminated union of all raw section types ───────────────────────────────

export type SanityPageSectionRaw =
  | SanityTextSectionRaw
  | SanityFeatureGridRaw
  | SanityTestimonialSectionRaw
  | SanityFaqSectionRaw
  | SanityCtaSectionRaw
  | SanityFormSectionRaw
  | SanityListingSectionRaw
  | SanityFilterBarSectionRaw
  | SanitySearchResultsSectionRaw
  | SanityArticleMetaSectionRaw
  | SanityArticleBodySectionRaw
  | SanityRelatedContentSectionRaw
  | SanityVacancyMetaSectionRaw
  | SanityApplyPanelSectionRaw
  | SanitySearchSectionRaw
  | SanityLogoStripSectionRaw
  | SanityStatsSectionRaw
  | SanityAboutSectionRaw
  | SanityNewsListSectionRaw
  | SanityTextMediaSectionRaw
  | SanityTeamSectionRaw
  | SanityRecruiterPanelSectionRaw
  | SanityProcessStepsSectionRaw
  | SanityPricingSectionRaw
  | SanityProductOverviewRaw
  | SanityProductDetailRaw
  | SanityCartSummarySectionRaw
  | SanityCheckoutBlockSectionRaw
  | SanityMapBlockSectionRaw;

/**
 * CMS-level advisory config for a single context slot (hero / proof / cta).
 * Mirrors CmsContextSlotConfig in cms/types.ts.
 */
export interface SanityContextSlotConfigRaw {
  fallbackVariantKey?: string;
}

/**
 * Sanity raw shape of the contextConfig object field on page documents.
 * Mirrors CmsPageContextConfig in cms/types.ts.
 */
export interface SanityContextConfigRaw {
  hero?:  SanityContextSlotConfigRaw;
  proof?: SanityContextSlotConfigRaw;
  cta?:   SanityContextSlotConfigRaw;
}

/**
 * Shape of the data returned by PAGE_BY_SLUG_QUERY.
 * Field names match the Sanity schema exactly.
 * The mapper translates this to PageData.
 */
export interface SanityPageRaw {
  _id:             string;
  tenantId?:       string;
  title:           string;
  slug:            string;
  templateKey?:    string;
  seoTitle?:       string;
  seoDescription?: string;
  metaKeywords?:   string[];
  contextConfig?:  SanityContextConfigRaw;
  sections:        SanityPageSectionRaw[];
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single published page by its URL slug with locale fallback.
 *
 * Parameters:
 *   $slug     string        The page slug, e.g. "about-us"
 *   $tenantId string | null Tenant scope. null = all tenants (backward-compat).
 *   $locale   string        ISO 639-1 locale code, e.g. "en" | "nl" | "de".
 *
 * Returns: SanityPageRaw | null
 *
 * Locale fallback strategy:
 *   - Prefers a page document where `locale == $locale`.
 *   - Falls back to the unlocalized document (no `locale` field).
 *   - `order(defined(locale) desc) [0]` selects the locale-specific doc first.
 *
 * Projection notes:
 *   - `isPublished == true` guard excludes drafts and disabled pages.
 *   - Tenant predicate: null = no filter; slug = that tenant + shared docs.
 *   - `[0]` returns the first match as an object; null if nothing matched.
 *   - slug is projected as a plain string ("slug": slug.current).
 *   - All 19 section types are projected with their specific fields.
 *     GROQ silently returns null for fields that don't exist on a given
 *     section type — the mapper ignores these nulls.
 *   - Image asset URLs are dereferenced inline (image.asset->url) so no
 *     additional Sanity client calls are needed at render time.
 *
 * @example
 *   const page = await client.fetch<SanityPageRaw | null>(
 *     PAGE_BY_SLUG_QUERY,
 *     { slug: "about-us", tenantId: "workengine", locale: "nl" },
 *   );
 */
export const PAGE_BY_SLUG_QUERY = `
  *[_type == "page" && slug.current == $slug && isPublished == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
    && (locale == $locale || !defined(locale))
  ] | order(defined(locale) desc) [0] {
    _id,
    tenantId,
    title,
    "slug": slug.current,
    templateKey,
    seoTitle,
    seoDescription,
    metaKeywords,
    contextConfig {
      hero  { fallbackVariantKey },
      proof { fallbackVariantKey },
      cta   { fallbackVariantKey }
    },
    "sections": sections[] {
      _type,
      _key,
      variant,

      // ── textSection / about / articleBody ─────────────────────────────────
      // Shared: heading, body (Portable Text array)
      heading,
      body,

      // ── featureGrid ───────────────────────────────────────────────────────
      features[] {
        title,
        description,
        icon
      },
      ctaLabel,
      ctaHref,
      ctaVariant,

      // ── testimonialSection ────────────────────────────────────────────────
      testimonials[] {
        quote,
        author,
        role,
        company,
        "avatarUrl": coalesce(avatar.asset->url, avatarUrl)
      },

      // ── items[] — shared across multiple section types ────────────────────
      // faqSection:      question, answer
      // listing:         title, href, excerpt, date, category, tags, imageUrl, imageAlt
      // relatedContent:  title, href, excerpt, category, date, imageUrl, imageAlt
      // stats:           label, value, prefix, suffix, description
      // newsList:        title, url, excerpt, date, imageUrl, category
      // searchResults:   (same as listing)
      // GROQ returns null for sub-fields not stored on a given item type.
      items[] {
        _key,
        id,
        question,
        answer,
        title,
        href,
        url,
        excerpt,
        date,
        category,
        tags,
        // coalesce: prefer new Sanity image asset, fall back to legacy string URL
        "imageUrl": coalesce(image.asset->url, imageUrl),
        "imageAlt": coalesce(image.alt, imageAlt),
        label,
        value,
        prefix,
        suffix,
        description
      },

      // ── ctaSection ────────────────────────────────────────────────────────
      title,
      description,
      cta { label, href },
      buttonLabel,
      buttonHref,

      // ── listing ───────────────────────────────────────────────────────────
      maxItems,
      viewAllHref,
      viewAllLabel,

      // ── filterBar ─────────────────────────────────────────────────────────
      placeholder,
      showSearch,
      showCategoryFilter,
      showTagFilter,
      categories[] { _key, label, value, count },
      tags[]       { _key, label, value, count },
      sortOptions[] { _key, label, value, count },

      // ── searchResults ─────────────────────────────────────────────────────
      emptyMessage,
      itemsPerPage,
      enableSearch,
      enableFilter,

      // ── articleMeta ───────────────────────────────────────────────────────
      publishedAt,
      updatedAt,
      category,
      readingTime,
      summary,
      // coalesce: prefer a proper Sanity image asset (uploaded via Studio);
      // fall back to the plain coverImageUrl string stored by the seed helper.
      "coverImageUrl": coalesce(coverImage.asset->url, coverImageUrl),
      "coverImageAlt": coalesce(coverImage.alt, coverImageAlt),
      author {
        name,
        role,
        href,
        "avatarUrl": avatar.asset->url
      },

      // ── applyPanel ────────────────────────────────────────────────────────
      // heading, body already covered above
      closingDate,
      primaryCta   { label, href },
      secondaryCta { label, href },
      formKey,

      // ── search ────────────────────────────────────────────────────────────
      // title, description, placeholder, emptyMessage already covered above
      scopes,
      showFilters,
      enableInstant,
      maxResults,
      noResultsMessage,

      // ── logoStrip ─────────────────────────────────────────────────────────
      // coalesce: prefer new Sanity image asset, fall back to legacy string src
      logos[] { _key, name, "src": coalesce(image.asset->url, src), url },
      animationEnabled,
      speed,
      grayscale,
      showLabels,

      // ── about ─────────────────────────────────────────────────────────────
      // heading, body already covered above
      // coalesce: prefer new Sanity image asset, fall back to legacy string URL
      "imageUrl": coalesce(image.asset->url, imageUrl),
      "imageAlt": coalesce(image.alt, imageAlt),
      // ctas[] shared across about and textMedia — variant included for about; null for textMedia
      ctas[] { _key, label, href, variant },
      teamMembers[] {
        _key,
        name,
        role,
        bio,
        // coalesce: prefer new "photo" Sanity asset, fall back to legacy "imageUrl" string
        "imageUrl": coalesce(photo.asset->url, imageUrl),
        profileHref
      },

      // ── textMedia ─────────────────────────────────────────────────────────
      eyebrow,
      mediaType,
      // coalesce: prefer new Sanity image asset, fall back to legacy mediaUrl string
      "mediaUrl": coalesce(image.asset->url, mediaUrl),
      "mediaAlt": coalesce(image.alt, mediaAlt),
      videoUrl,
      caption,

      // ── teamSection ───────────────────────────────────────────────────────
      intro,
      members[] {
        _key,
        name,
        role,
        bio,
        // coalesce: prefer new "photo" Sanity asset, fall back to legacy "imageUrl" string
        "imageUrl": coalesce(photo.asset->url, imageUrl),
        profileHref,
        linkedinUrl,
        twitterUrl,
        githubUrl
      },

      // ── recruiterPanel ────────────────────────────────────────────────────
      // name, role, bio, heading already covered by shared / teamSection fields above
      email,
      phone,
      ctaLabel,
      ctaHref,
      // coalesce: prefer new "avatar" Sanity asset, fall back to legacy "avatarUrl" string
      "avatarUrl": coalesce(avatar.asset->url, avatarUrl),

      // ── vacancyMeta ───────────────────────────────────────────────────────
      department,
      location,
      remote,
      contractType,
      hoursPerWeek,
      salaryRange,
      startDate,
      level,

      // ── formSection ───────────────────────────────────────────────────────
      // formKey, title already covered above
      intro,
      submitLabel,
      successMessage,

      // ── productOverview ───────────────────────────────────────────────────
      showPrices,
      products[] {
        title,
        description,
        price,
        badge,
        "imageUrl": image.asset->url,
        "imageAlt": image.alt,
        ctaLabel,
        ctaHref,
        ctaVariant
      },

      // ── productDetail ─────────────────────────────────────────────────────
      // title, description, price, badge already covered above
      gallery[] {
        "url": image.asset->url,
        alt
      },
      specs[] {
        label,
        value
      },
      secondaryCtaLabel,
      secondaryCtaHref,
      secondaryCtaVariant,
      relatedProducts[] {
        title,
        description,
        price,
        badge,
        ctaLabel,
        ctaHref,
        ctaVariant
      },

      // ── cartSummary ───────────────────────────────────────────────────────
      // heading already covered above
      emptyMessage,
      checkoutHref,
      continueShoppingHref,
      checkoutLabel,
      continueShoppingLabel,
      planId,

      // ── checkoutBlock ─────────────────────────────────────────────────────
      // heading, intro already covered above
      paymentProvider,
      returnHref,
      returnLabel,
      // planId already covered above

      // ── processSteps ──────────────────────────────────────────────────────
      steps[] {
        _key,
        title,
        description,
        duration
      },

      // ── pricingSection ────────────────────────────────────────────────────
      // heading already covered above
      subheading,
      footnote,
      tiers[] {
        _key,
        name,
        price,
        period,
        description,
        features[] { _key, label },
        ctaLabel,
        ctaHref,
        highlighted,
        badge
      },
    }
  }
`;
