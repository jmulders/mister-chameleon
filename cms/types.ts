/**
 * CMS Content Types
 *
 * These types define the raw data shapes returned by the CMS provider.
 * They are the canonical representation of content as it exists in the CMS
 * (currently mocked; later backed by Sanity documents).
 *
 * Naming conventions:
 *  - Field names mirror the Sanity schema field names we will define later,
 *    making the Sanity provider a near-zero-mapping implementation.
 *  - Block-level types use the suffix *BlockData to distinguish them from
 *    React component prop types (*BlockProps), which use presentation-layer
 *    field names (e.g. "headline", "eyebrow") that may differ from CMS names.
 *
 * Mapping:
 *   CMSProvider returns *BlockData
 *       ↓  mapHeroBlockData() / mapProofBlockData() / mapCTABlockData()
 *   Block components receive *BlockProps
 *
 * The mapper layer in /src/cms/mappers/ bridges the two shapes so that
 * CMS field names and component prop names can evolve independently.
 */

// ── Shared primitives ─────────────────────────────────────────────────────────

/**
 * A call-to-action button or link.
 * Used as a nested field in hero, CTA, and navigation content types.
 */
export interface CTAData {
  /** Button / link label text */
  label: string;
  /** Destination URL — may be relative ("/pricing") or absolute */
  href: string;
}

// ── Hero block ────────────────────────────────────────────────────────────────

/**
 * Content data for a HeroBlock variant.
 *
 * CMS field  →  HeroBlockProps prop
 * ──────────    ──────────────────────
 * tag        →  eyebrow  (small badge above headline)
 * title      →  headline
 * subtitle   →  subheadline
 * cta        →  primaryCta
 */
export interface HeroBlockData {
  /** Unique identifier — matches the HeroVariantKey used by the decision engine */
  id: string;
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /** Primary call-to-action button */
  cta: CTAData;
  /** Optional eyebrow label rendered above the headline as a badge */
  tag?: string;
}

// ── Proof block ───────────────────────────────────────────────────────────────

/**
 * A single proof point — stat, testimonial quote, or capability statement.
 * Used as items within a ProofBlockData.
 */
export interface ProofItem {
  /** Short bold label, e.g. "3.2× more leads" or "Edge-native" */
  title: string;
  /** One-to-two sentence supporting copy */
  text: string;
}

/**
 * Content data for a ProofBlock variant.
 *
 * CMS field  →  ProofBlockProps prop
 * ──────────    ──────────────────────
 * title      →  label  (section heading / eyebrow)
 * items      →  stats  (rendered as metric cards)
 */
export interface ProofBlockData {
  /** Unique identifier — matches the ProofVariantKey */
  id: string;
  /** Section heading displayed above the proof items */
  title: string;
  /** Ordered array of proof points (typically 3) */
  items: ProofItem[];
}

// ── CTA block ─────────────────────────────────────────────────────────────────

/**
 * Content data for a CTABlock variant.
 *
 * CMS field  →  CTABlockProps prop
 * ──────────    ──────────────────────
 * title      →  headline
 * text       →  subheadline
 * cta        →  primaryCta
 */
export interface CTABlockData {
  /** Unique identifier — matches the CTAVariantKey */
  id: string;
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  text: string;
  /** Primary call-to-action */
  cta: CTAData;
}

// ── Union for generic handling ────────────────────────────────────────────────

/** Any CMS block data type — useful for type-narrowing utilities */
export type AnyBlockData = HeroBlockData | ProofBlockData | CTABlockData;

// ── Site settings ─────────────────────────────────────────────────────────────

/**
 * A resolved navigation link, ready for the rendering layer.
 *
 * References are resolved at query time (GROQ dereference) so that callers
 * receive a plain `href` string rather than a Sanity reference object.
 * Internal pages produce a root-relative path (e.g. "/about-us");
 * external URLs are returned as-is.
 */
export interface NavigationItemData {
  /** Sanity document _id for stable keying in lists */
  id: string;
  /** Display label for the link */
  label: string;
  /** Resolved destination — "/" + slug for internal pages, full URL for external */
  href: string;
  /** Optional one level of nested child links (dropdown items) */
  children?: Omit<NavigationItemData, "children">[];
}

/**
 * Site logo — asset URL resolved at query time from the Sanity image asset.
 */
export interface SiteLogoData {
  /** CDN URL of the logo image */
  url: string;
  /** Alt text for accessibility */
  alt: string;
}

/**
 * Data returned by CMSProvider.getSiteSettings().
 *
 * Contains the fields needed for the site shell (header / footer):
 *   siteTitle        — used in <title> tag fallbacks and aria-labels
 *   logo             — resolved asset URL + alt text; null when not set
 *   mainNavigation   — ordered header nav links (with optional dropdowns)
 *   footerNavigation — ordered footer nav links (with optional dropdowns)
 */
export interface SiteSettingsData {
  siteTitle: string;
  logo: SiteLogoData | null;
  mainNavigation: NavigationItemData[];
  footerNavigation: NavigationItemData[];
}

// ── Portable Text ─────────────────────────────────────────────────────────────

/**
 * A single span inside a Portable Text block.
 * `marks` references decorator keys (e.g. "strong", "em") or annotation _keys.
 */
export interface PortableTextSpan {
  _type: "span";
  _key?: string;
  text: string;
  marks?: string[];
}

/**
 * An annotation mark definition (e.g. a link) referenced by span marks.
 */
export interface PortableTextMarkDef {
  _key: string;
  _type: string;
  [key: string]: unknown;
}

/**
 * A single Portable Text block node.
 * Covers paragraph, headings, and blockquote styles produced by the
 * textSection body field.
 */
export interface PortableTextBlock {
  _type: "block";
  _key?: string;
  style?: "normal" | "h2" | "h3" | "h4" | "blockquote";
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
}

// ── Page section base ─────────────────────────────────────────────────────────

/**
 * Fields common to every CMS page section (content block).
 *
 * `_key` is a CMS-assigned stable identifier for this block instance —
 * used as the platform-internal ContentBlock.id and as a React key prop.
 *
 * `variant` is an optional visual variation key authored in the CMS.
 * It maps directly to ContentBlock.variant in the platform layer, allowing
 * CMS authors to choose a block's visual appearance without changing its
 * content structure.
 *
 * Must be one of the values in BlockDefinition.allowedVariants for this block
 * type; unknown values are normalised to "default" by resolveBlockVariant().
 */
export interface PageSectionBase {
  /** CMS-assigned stable key — used as React key and ContentBlock.id */
  _key: string;
  /**
   * Optional visual variant key for this block.
   * Authored in the CMS; forwarded verbatim to ContentBlock.variant.
   * The block component normalises unknown values to "default".
   */
  variant?: string;
}

// ── Page section data types ───────────────────────────────────────────────────

export interface TextSectionData extends PageSectionBase {
  _type: "textSection";
  heading?: string;
  /** Portable Text body — render with PortableTextRenderer */
  body?: PortableTextBlock[];
}

export interface FeatureItemData {
  title: string;
  description: string;
  icon?: string;
}

export interface FeatureGridData extends PageSectionBase {
  _type: "featureGrid";
  heading?: string;
  features?: FeatureItemData[];
}

export interface TestimonialItemData {
  quote: string;
  author: string;
  company?: string;
}

export interface TestimonialSectionData extends PageSectionBase {
  _type: "testimonialSection";
  heading?: string;
  testimonials?: TestimonialItemData[];
}

export interface FaqItemData {
  question: string;
  answer: string;
}

export interface FaqSectionData extends PageSectionBase {
  _type: "faqSection";
  heading?: string;
  items?: FaqItemData[];
}

export interface CtaSectionData extends PageSectionBase {
  _type: "ctaSection";
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

/**
 * CMS data for a form section block.
 *
 * The CMS places a form on a page by setting `formKey` to one of the
 * registered platform FormKey values ("contact" | "application" | …).
 * All other fields are optional copy/content overrides — the CMS must NOT
 * carry field definitions, validation rules, or submission routing here.
 *
 * Submit behaviour is entirely resolved from the platform-side FormDefinition
 * retrieved by getFormDefinition(formKey) at render time.
 */
export interface FormSectionData extends PageSectionBase {
  _type: "formSection";
  /**
   * Identifies the platform-side FormDefinition to render.
   * Must match a registered FormKey string; unknown keys render nothing.
   */
  formKey: string;
  /** Optional title override — rendered above the form fields */
  title?: string;
  /** Optional intro copy — rendered below the title, above the fields */
  intro?: string;
  /** Optional submit button label override */
  submitLabel?: string;
  /** Optional success message override shown after submission */
  successMessage?: string;
}

// ── Listing ───────────────────────────────────────────────────────────────────

/** A single item within a CMS listing or search-results section */
export interface CmsListingItem {
  /** CMS portable identifier (_key from Sanity, or any stable id) */
  _key:      string;
  /** Stable platform id; falls back to _key when absent */
  id?:       string;
  title:     string;
  href:      string;
  excerpt?:  string;
  date?:     string;
  imageUrl?: string;
  imageAlt?: string;
  category?: string;
  tags?:     string[];
  meta?:     { label: string; value: string }[];
}

export interface ListingSectionData extends PageSectionBase {
  _type:         "listing";
  heading?:      string;
  items?:        CmsListingItem[];
  maxItems?:     number;
  viewAllHref?:  string;
  viewAllLabel?: string;
}

/** A single option in a CMS filter control */
export interface CmsFilterOption {
  _key:   string;
  label:  string;
  value:  string;
  count?: number;
}

export interface FilterBarSectionData extends PageSectionBase {
  _type:                "filterBar";
  placeholder?:         string;
  categories?:          CmsFilterOption[];
  tags?:                CmsFilterOption[];
  sortOptions?:         CmsFilterOption[];
  showSearch?:          boolean;
  showCategoryFilter?:  boolean;
  showTagFilter?:       boolean;
}

export interface SearchResultsSectionData extends PageSectionBase {
  _type:          "searchResults";
  heading?:       string;
  emptyMessage?:  string;
  itemsPerPage?:  number;
  items?:         CmsListingItem[];
  enableSearch?:  boolean;
  enableFilter?:  boolean;
}

// ── Article / detail ──────────────────────────────────────────────────────────

export interface ArticleMetaData extends PageSectionBase {
  _type:           "articleMeta";
  title?:          string;
  publishedAt?:    string;
  updatedAt?:      string;
  author?: {
    name:       string;
    role?:      string;
    avatarUrl?: string;
    href?:      string;
  };
  category?:       string;
  tags?:           string[];
  readingTime?:    number;
  coverImageUrl?:  string;
  coverImageAlt?:  string;
  summary?:        string;
}

export interface ArticleBodyData extends PageSectionBase {
  _type:       "articleBody";
  body:        PortableTextBlock[];
  footnotes?:  string[];
}

/** A single related content teaser within a CMS relatedContent section */
export interface CmsRelatedItem {
  _key:      string;
  id?:       string;
  title:     string;
  href:      string;
  excerpt?:  string;
  imageUrl?: string;
  imageAlt?: string;
  category?: string;
  date?:     string;
}

export interface RelatedContentData extends PageSectionBase {
  _type:      "relatedContent";
  heading?:   string;
  items:      CmsRelatedItem[];
  maxItems?:  number;
}

// ── Vacancy ───────────────────────────────────────────────────────────────────

export interface VacancyMetaData extends PageSectionBase {
  _type:          "vacancyMeta";
  title?:         string;
  department?:    string;
  location?:      string;
  remote?:        "on-site" | "hybrid" | "remote";
  contractType?:  "full-time" | "part-time" | "contract" | "internship" | "freelance";
  hoursPerWeek?:  string;
  salaryRange?:   string;
  startDate?:     string;
  closingDate?:   string;
  level?:         string;
}

export interface ApplyPanelData extends PageSectionBase {
  _type:          "applyPanel";
  heading?:       string;
  body?:          string;
  primaryCta?:    { label: string; href: string };
  secondaryCta?:  { label: string; href: string };
  formKey?:       string;
  closingDate?:   string;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * CMS data for a search block.
 *
 * The CMS places this block on any page; all search behaviour (provider
 * selection, result fetching) is platform-driven via /api/search.
 * The CMS carries only configuration/copy — never a provider reference.
 */
export interface SearchSectionData extends PageSectionBase {
  _type:              "search";
  title?:             string;
  placeholder?:       string;
  description?:       string;
  /** SearchScope[] — "pages" | "posts" | "vacancies" */
  scopes?:            string[];
  showFilters?:       boolean;
  enableInstant?:     boolean;
  maxResults?:        number;
  emptyMessage?:      string;
  noResultsMessage?:  string;
}

// ── LogoStrip ─────────────────────────────────────────────────────────────────

/** A single logo entry in a logo-strip section */
export interface CmsLogoItem {
  _key:   string;
  name:   string;
  /** URL of the logo image */
  src:    string;
  /** Optional link target for the logo */
  url?:   string;
}

export interface LogoStripSectionData extends PageSectionBase {
  _type:    "logoStrip";
  /** Optional label above the logo row, e.g. "Trusted by" */
  heading?: string;
  logos?:   CmsLogoItem[];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** A single stat/metric entry in a stats section */
export interface CmsStatItem {
  _key:         string;
  label:        string;
  value:        string;
  /** Optional prefix before the value, e.g. "€" or "~" */
  prefix?:      string;
  /** Optional suffix after the value, e.g. "%" or "+" */
  suffix?:      string;
  /** Optional short description below label */
  description?: string;
}

export interface StatsSectionData extends PageSectionBase {
  _type:    "stats";
  heading?: string;
  items?:   CmsStatItem[];
}

// ── About / split-media ───────────────────────────────────────────────────────

/** A single team member entry within an about section */
export interface CmsTeamMember {
  _key:      string;
  name:      string;
  role:      string;
  bio?:      string;
  imageUrl?: string;
}

export interface AboutSectionData extends PageSectionBase {
  _type:        "about";
  heading?:     string;
  body?:        PortableTextBlock[];
  imageUrl?:    string;
  imageAlt?:    string;
  teamMembers?: CmsTeamMember[];
}

// ── NewsList ──────────────────────────────────────────────────────────────────

/** A single news/blog item entry in a newsList section */
export interface CmsNewsItem {
  _key:      string;
  title:     string;
  /** Absolute or root-relative URL to the article detail page */
  url:       string;
  excerpt?:  string;
  /** ISO 8601 date string */
  date?:     string;
  imageUrl?: string;
  category?: string;
}

export interface NewsListSectionData extends PageSectionBase {
  _type:     "newsList";
  heading?:  string;
  items?:    CmsNewsItem[];
  maxItems?: number;
}

// ── Careers / W6 ─────────────────────────────────────────────────────────────

/**
 * A single step authored in the CMS for a processSteps page section.
 * Mirrors ProcessStepData (document-level) but lives at section scope.
 */
export interface CmsProcessStep {
  /** Sanity array item key for stable React keying */
  _key:          string;
  /** Short step title */
  title:         string;
  /** One-sentence description of this step */
  description?:  string;
  /** Optional duration/timeframe display string, e.g. "1–2 weeks" */
  duration?:     string;
}

export interface ProcessStepsSectionData extends PageSectionBase {
  _type:    "processSteps";
  heading?: string;
  steps?:   CmsProcessStep[];
}

export interface RecruiterPanelSectionData extends PageSectionBase {
  _type:      "recruiterPanel";
  heading?:   string;
  /** Recruiter full name */
  name:       string;
  role?:      string;
  bio?:       string;
  avatarUrl?: string;
  email?:     string;
  phone?:     string;
  /** Optional CTA label, e.g. "Book a call" */
  ctaLabel?:  string;
  /** Optional CTA href */
  ctaHref?:   string;
}

// ── Discriminated union ───────────────────────────────────────────────────────

/** Discriminated union of all supported page section types */
export type PageSectionData =
  | TextSectionData
  | FeatureGridData
  | TestimonialSectionData
  | FaqSectionData
  | CtaSectionData
  | FormSectionData
  // social proof / media
  | LogoStripSectionData
  | StatsSectionData
  // content
  | AboutSectionData
  | NewsListSectionData
  // listing / detail
  | ListingSectionData
  | FilterBarSectionData
  | SearchResultsSectionData
  | ArticleMetaData
  | ArticleBodyData
  | RelatedContentData
  | VacancyMetaData
  | ApplyPanelData
  // search
  | SearchSectionData
  // careers / W6
  | ProcessStepsSectionData
  | RecruiterPanelSectionData;

// ── Company (standalone document) ────────────────────────────────────────────

/**
 * A branch / office location belonging to a Company.
 */
export interface BranchData {
  /** Sanity array item key for stable React keying */
  _key:      string;
  /** Display name of this branch/office */
  name:      string;
  /** City name */
  city?:     string;
  /** Street address */
  address?:  string;
  /** Contact phone number for this branch */
  phone?:    string;
}

/**
 * A single key/value statistic for a Company
 * (e.g. { label: "Founded", value: "2010" }).
 */
export interface StatData {
  /** Sanity array item key for stable React keying */
  _key:   string;
  /** Short descriptive label */
  label:  string;
  /** The metric value (string to allow "500+" or "€12 M") */
  value:  string;
}

/**
 * A resolved image asset (URL + alt text).
 * Used in Company.logo, Company.images, NewsArticle.coverImage, etc.
 */
export interface CmsImageData {
  /** CDN URL of the image */
  url: string;
  /** Alt text for accessibility */
  alt: string;
}

/**
 * Minimal reference projection for Company — used inside NewsArticleData and
 * VacancyData where only display-level company info is needed.
 */
export interface CompanyRef {
  /** Sanity document _id */
  id:    string;
  /** Company display name */
  name:  string;
  /** URL slug — used to build links to the company page */
  slug:  string;
}

/**
 * Data returned by CMSProvider.getCompany() / getCompanies().
 *
 * A Company is a standalone CMS document — it is NOT a page section.
 * Page sections that display company data (e.g. an about block) receive
 * a CompanyData (or CompanyRef) via a mapper, never raw page-section fields.
 */
export interface CompanyData {
  /** Sanity document _id */
  id:            string;
  /** Company display name */
  name:          string;
  /** URL slug — e.g. "acme-corp" (no leading slash) */
  slug:          string;
  /** Logotype — resolved CDN URL + alt text */
  logo?:         CmsImageData;
  /** Short introductory paragraph shown in listings and overviews */
  description?:  string;
  /**
   * List of service/product area names, e.g. ["Staffing", "RPO", "Consulting"].
   * Ordered by importance; first item may be featured in cards.
   */
  services?:     string[];
  /** Branch / office locations */
  branches?:     BranchData[];
  /** Key metrics shown in a stats strip (e.g. founded year, headcount, revenue) */
  stats?:        StatData[];
  /** Gallery images — company office, team, etc. */
  images?:       CmsImageData[];
  /** Only published documents are returned by default queries */
  isPublished:   boolean;
}

// ── NewsArticle (standalone document) ────────────────────────────────────────

/**
 * Data returned by CMSProvider.getNewsArticle() / getNewsArticles().
 *
 * A NewsArticle is a standalone CMS document — it is NOT a page section.
 * The article detail page renders it via ArticleMetaData + ArticleBodyData
 * page-section blocks populated by a mapper.
 */
export interface NewsArticleData {
  /** Sanity document _id */
  id:               string;
  /** Article headline */
  title:            string;
  /** URL slug — e.g. "acme-acquires-rival" (no leading slash) */
  slug:             string;
  /** ISO 8601 publication date string */
  publishedAt?:     string;
  /** Hero / cover image */
  coverImage?:      CmsImageData;
  /** Portable Text article body */
  body?:            PortableTextBlock[];
  /**
   * Optional link to the Company this article is about.
   * Resolved projection — only id / name / slug are included.
   */
  relatedCompany?:  CompanyRef;
  /**
   * Editorial taxonomy tags (e.g. ["acquisition", "funding"]).
   * Used for filtering in listing sections.
   */
  tags?:            string[];
  /** Short teaser text used in listing cards; falls back to first body paragraph */
  excerpt?:         string;
  /** Only published documents are returned by default queries */
  isPublished:      boolean;
}

// ── Vacancy (standalone document) ─────────────────────────────────────────────

/**
 * A step in the application / hiring process (e.g. "Interview", "Assessment").
 */
export interface ProcessStepData {
  /** Sanity array item key for stable React keying */
  _key:          string;
  /** Short step title */
  title:         string;
  /** One-sentence description of what happens in this step */
  description?:  string;
}

/**
 * Contact details for the recruiter handling a vacancy.
 */
export interface RecruiterData {
  /** Full name */
  name:       string;
  /** Job title / role */
  role?:      string;
  /** Email address for applications and queries */
  email?:     string;
  /** Direct phone number */
  phone?:     string;
  /** Profile photo */
  avatar?:    CmsImageData;
}

/**
 * Data returned by CMSProvider.getVacancy() / getVacancies().
 *
 * A Vacancy is a standalone CMS document — it is NOT a page section.
 * The vacancy detail page renders VacancyMetaData + ApplyPanelData page-section
 * blocks, populated by a mapper from this VacancyData shape.
 *
 * This type carries the full structured data.  VacancyMetaData (above) carries
 * only the fields needed by the VacancyMeta page-section component.
 */
export interface VacancyData {
  /** Sanity document _id */
  id:             string;
  /** Job title */
  title:          string;
  /** URL slug — e.g. "senior-frontend-engineer" */
  slug:           string;
  /**
   * The hiring company.
   * Resolved projection — only id / name / slug are included.
   */
  company?:       CompanyRef;
  /** City, region, or country string (e.g. "Amsterdam", "Remote — EU") */
  location?:      string;
  /** Remote work arrangement */
  remote?:        "on-site" | "hybrid" | "remote";
  /** Employment type */
  contractType?:  "full-time" | "part-time" | "contract" | "internship" | "freelance";
  /** Department or team name */
  department?:    string;
  /** Hours per week as a display string (e.g. "32–40 uur") */
  hoursPerWeek?:  string;
  /** Salary range as a display string (e.g. "€4 000 – €5 500 / maand") */
  salaryRange?:   string;
  /** Desired or latest start date as ISO 8601 string */
  startDate?:     string;
  /** Application closing date as ISO 8601 string */
  closingDate?:   string;
  /**
   * Rich-text job description / role summary.
   * Rendered with PortableTextRenderer on the vacancy detail page.
   */
  description?:   PortableTextBlock[];
  /**
   * List of required / preferred skills and qualifications.
   * Plain strings rather than Portable Text — kept simple for easy scanning.
   */
  requirements?:  string[];
  /** Ordered list of application / hiring process steps */
  processSteps?:  ProcessStepData[];
  /** Recruiter responsible for this vacancy */
  recruiter?:     RecruiterData;
  /** Only published documents are returned by default queries */
  isPublished:    boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * CMS-level configuration for a single context slot.
 *
 * The CMS may declare which variant keys are valid for a slot and/or provide
 * a fallback variant key to use when the decision engine returns null.
 *
 * IMPORTANT: This is advisory metadata only.  The decision engine always
 * owns the final variant selection.  The CMS must NOT dictate which variant
 * is shown to a specific visitor.
 */
export interface CmsContextSlotConfig {
  /**
   * Variant keys the CMS author considers valid for this slot.
   * The decision engine may serve any subset (or ignore this list entirely).
   * Useful for CMS-side validation: warn when the engine selects an unknown key.
   */
  readonly allowedVariantKeys?: readonly string[];
  /**
   * Fallback variant key to use if the decision engine returns null for this
   * slot and the slot is required.  Applied by the assembler — never by the
   * decision engine itself.
   *
   * Also used directly by static CMS pages (app/[slug]/page.tsx) where no
   * decision engine is involved — the fallback becomes the active variant key.
   */
  readonly fallbackVariantKey?: string;
}

/**
 * CMS-level context configuration keyed by context slot ID.
 *
 * Maps each named context slot (hero, proof, cta) to its advisory config.
 * Slots absent from this map carry no CMS-level constraints.
 */
export interface CmsPageContextConfig {
  readonly hero?:  CmsContextSlotConfig;
  readonly proof?: CmsContextSlotConfig;
  readonly cta?:   CmsContextSlotConfig;
}

/**
 * Data returned by CMSProvider.getPageBySlug().
 *
 * Sections carry a `_type` discriminator so the rendering layer can switch
 * on type and render the appropriate section component.
 */
export interface PageData {
  /** Sanity _id */
  id: string;
  /** Internal page title (used in <title> fallback) */
  title: string;
  /** URL slug — e.g. "about-us" (no leading slash) */
  slug: string;
  /** Per-page SEO title override */
  seoTitle?: string;
  /** Per-page SEO meta description override */
  seoDescription?: string;
  /**
   * @deprecated Use contextConfig.hero.fallbackVariantKey instead.
   *
   * Legacy field for a single hero variant key to render above sections.
   * Retained for backward compatibility with existing CMS documents.
   * The mapper bridges this to contextConfig.hero.fallbackVariantKey when
   * contextConfig.hero is absent.
   */
  heroVariantKey?: string;
  /** Ordered array of page section blocks */
  sections: PageSectionData[];
  /**
   * Template key that identifies the slot layout for this page.
   *
   * Must be one of the keys in the platform TEMPLATE_REGISTRY:
   *   "marketing-page"  — Hero + Proof + CTA context slots
   *   "landing-page"    — Hero + CTA context slots (no proof)
   *   "article-page"    — No context slots; pure content
   *
   * When absent the mapper infers the template from contextConfig:
   *   any hero/proof/cta config present → "marketing-page"
   *   no context config                 → "article-page"
   */
  templateKey?: string;
  /**
   * Advisory context-slot configuration authored in the CMS.
   *
   * Declares allowedVariantKeys and fallbackVariantKey per slot (hero/proof/cta).
   * On CMS-driven static pages (app/[slug]/page.tsx), fallbackVariantKey is used
   * directly as the active variant key — no decision engine is involved.
   * On adaptive pages (homepage), the decision engine overrides these hints.
   *
   * The CMS must NOT use this field to dictate which variant a specific visitor
   * sees — that is always the decision engine's responsibility.
   */
  contextConfig?: CmsPageContextConfig;
}
