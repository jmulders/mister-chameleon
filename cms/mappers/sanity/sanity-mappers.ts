/**
 * Sanity → Internal Type Mappers
 *
 * Pure functions that translate raw Sanity GROQ results into the internal
 * app content types (HeroBlockData, ProofBlockData, CTABlockData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────────
 *
 *   Sanity schema field names (ctaLabel, ctaHref) differ from the internal
 *   app types (cta: { label, href }). This layer is the single place where
 *   that translation lives — neither the provider nor the components know
 *   about the CMS schema's naming conventions.
 *
 *   This also means Sanity schema renames only require a mapper change,
 *   not a cascade through the app.
 *
 * ─── Mapping tables ──────────────────────────────────────────────────────────
 *
 *   SanityHeroRaw         →  HeroBlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   key                  →  (unused — id carries the variant key)
 *   title                →  title
 *   subtitle             →  subtitle
 *   ctaLabel             →  cta.label
 *   ctaHref              →  cta.href
 *   tag                  →  tag
 *
 *   SanityProofRaw        →  ProofBlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   items[].title        →  items[].title
 *   items[].text         →  items[].text
 *
 *   SanityCTARaw          →  CTABlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   text                 →  text
 *   ctaLabel             →  cta.label
 *   ctaHref              →  cta.href
 */

import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  SiteSettingsData,
  NavigationItemData,
  PageData,
  PageSectionData,
  CmsPageContextConfig,
} from "../../types";
import type {
  SanityHeroRaw,
  SanityProofRaw,
  SanityCTARaw,
  SanitySiteSettingsRaw,
  SanityNavItemRaw,
  SanityPageRaw,
  SanityPageSectionRaw,
  SanityContextConfigRaw,
} from "../../queries/sanity";

// ── Hero mapper ───────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity heroVariant document into a HeroBlockData.
 *
 * @param raw  The GROQ projection result from HERO_BY_KEY_QUERY.
 * @returns    A HeroBlockData ready for the experience composer.
 */
export function mapSanityHero(raw: SanityHeroRaw): HeroBlockData {
  return {
    id: raw.key,
    title: raw.title,
    subtitle: raw.subtitle,
    cta: {
      label: raw.ctaLabel,
      href: raw.ctaHref,
    },
    tag: raw.tag,
  };
}

// ── Proof mapper ──────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity proofVariant document into a ProofBlockData.
 *
 * @param raw  The GROQ projection result from PROOF_BY_KEY_QUERY.
 * @returns    A ProofBlockData ready for the experience composer.
 */
export function mapSanityProof(raw: SanityProofRaw): ProofBlockData {
  return {
    id: raw.key,
    title: raw.title,
    items: (raw.items ?? []).map((item) => ({
      title: item.title,
      text: item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity ctaVariant document into a CTABlockData.
 *
 * @param raw  The GROQ projection result from CTA_BY_KEY_QUERY.
 * @returns    A CTABlockData ready for the experience composer.
 */
export function mapSanityCTA(raw: SanityCTARaw): CTABlockData {
  return {
    id: raw.key,
    title: raw.title,
    text: raw.text,
    cta: {
      label: raw.ctaLabel,
      href: raw.ctaHref,
    },
  };
}

// ── Site settings mapper ───────────────────────────────────────────────────────

/**
 * Translate a single resolved Sanity navigation item into a NavigationItemData.
 *
 * The `href` field is already resolved at query time by GROQ's `select()`,
 * so no URL derivation happens here.
 */
function mapNavItem(raw: SanityNavItemRaw): NavigationItemData {
  return {
    id: raw._id,
    label: raw.label,
    href: raw.href,
    ...(raw.children && raw.children.length > 0
      ? {
          children: raw.children.map((child) => ({
            id: child._id,
            label: child.label,
            href: child.href,
          })),
        }
      : {}),
  };
}

/**
 * Translate a raw Sanity siteSettings document into a SiteSettingsData.
 *
 * ─── Mapping table ────────────────────────────────────────────────────────────
 *
 *   SanitySiteSettingsRaw          →  SiteSettingsData
 *   ─────────────────────────────     ──────────────────────────────────────────
 *   siteTitle                     →  siteTitle
 *   logo.url                      →  logo.url
 *   logo.alt                      →  logo.alt
 *   logo (null when not uploaded) →  logo: null
 *   mainNavigation[]._id          →  mainNavigation[].id
 *   mainNavigation[].label        →  mainNavigation[].label
 *   mainNavigation[].href         →  mainNavigation[].href  (pre-resolved)
 *   mainNavigation[].children     →  mainNavigation[].children
 *   footerNavigation (same)       →  footerNavigation (same)
 *
 * @param raw  The GROQ projection result from SITE_SETTINGS_QUERY.
 * @returns    A SiteSettingsData ready for the site shell layout.
 */
export function mapSanitySiteSettings(raw: SanitySiteSettingsRaw): SiteSettingsData {
  return {
    siteTitle: raw.siteTitle,
    logo:
      raw.logo?.url
        ? { url: raw.logo.url, alt: raw.logo.alt ?? "" }
        : null,
    mainNavigation: (raw.mainNavigation ?? []).map(mapNavItem),
    footerNavigation: (raw.footerNavigation ?? []).map(mapNavItem),
  };
}

// ── Page mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a single raw Sanity page section into a PageSectionData.
 *
 * GROQ projects all possible fields onto every section object, filling
 * absent fields with null. The switch narrows the discriminated union and
 * discards nulls, passing only the fields that belong to each section type.
 */
function mapSanitySection(raw: SanityPageSectionRaw): PageSectionData {
  switch (raw._type) {
    case "textSection":
      return {
        _type: "textSection",
        _key: raw._key,
        heading: raw.heading ?? undefined,
        body: raw.body ?? undefined,
      };

    case "featureGrid":
      return {
        _type: "featureGrid",
        _key: raw._key,
        heading: raw.heading ?? undefined,
        features: (raw.features ?? []).map((f) => ({
          title: f.title,
          description: f.description,
          icon: f.icon ?? undefined,
        })),
      };

    case "testimonialSection":
      return {
        _type: "testimonialSection",
        _key: raw._key,
        heading: raw.heading ?? undefined,
        testimonials: (raw.testimonials ?? []).map((t) => ({
          quote: t.quote,
          author: t.author,
          company: t.company ?? undefined,
        })),
      };

    case "faqSection":
      return {
        _type: "faqSection",
        _key: raw._key,
        heading: raw.heading ?? undefined,
        items: (raw.items ?? []).map((item) => ({
          question: item.question,
          answer: item.answer,
        })),
      };

    case "ctaSection":
      return {
        _type: "ctaSection",
        _key: raw._key,
        title: raw.title ?? undefined,
        description: raw.description ?? undefined,
        buttonLabel: raw.buttonLabel ?? undefined,
        buttonHref: raw.buttonHref ?? undefined,
      };
  }
}

// ── Context config mapper ──────────────────────────────────────────────────────

/**
 * Translate a raw Sanity contextConfig object into a CmsPageContextConfig.
 * Returns undefined when the raw value is absent or empty.
 */
function mapContextConfig(raw: SanityContextConfigRaw | null | undefined): CmsPageContextConfig | undefined {
  if (!raw) return undefined;

  // Build the object as a plain (non-readonly) record first so assignments
  // don't violate the readonly constraint on CmsPageContextConfig.
  const result: Record<string, { fallbackVariantKey?: string }> = {};

  if (raw.hero?.fallbackVariantKey) {
    result.hero = { fallbackVariantKey: raw.hero.fallbackVariantKey };
  }
  if (raw.proof?.fallbackVariantKey) {
    result.proof = { fallbackVariantKey: raw.proof.fallbackVariantKey };
  }
  if (raw.cta?.fallbackVariantKey) {
    result.cta = { fallbackVariantKey: raw.cta.fallbackVariantKey };
  }

  // Return undefined when nothing was set to avoid polluting PageData with
  // an empty contextConfig object that signals intent without content.
  return Object.keys(result).length > 0 ? (result as CmsPageContextConfig) : undefined;
}

/**
 * Translate a raw Sanity page document into a PageData.
 *
 * ─── Mapping table ────────────────────────────────────────────────────────────
 *
 *   SanityPageRaw           →  PageData
 *   ──────────────────────     ──────────────────────────────
 *   _id                    →  id
 *   title                  →  title
 *   slug (plain string)    →  slug
 *   templateKey            →  templateKey
 *   seoTitle               →  seoTitle
 *   seoDescription         →  seoDescription
 *   heroVariantKey         →  heroVariantKey  (legacy)
 *   contextConfig          →  contextConfig   (via mapContextConfig)
 *   sections[]             →  sections[]      (via mapSanitySection)
 *
 * @param raw  The GROQ projection result from PAGE_BY_SLUG_QUERY.
 * @returns    A PageData ready for the dynamic page route.
 */
export function mapSanityPage(raw: SanityPageRaw): PageData {
  return {
    id: raw._id,
    title: raw.title,
    slug: raw.slug,
    templateKey: raw.templateKey ?? undefined,
    seoTitle: raw.seoTitle ?? undefined,
    seoDescription: raw.seoDescription ?? undefined,
    heroVariantKey: raw.heroVariantKey ?? undefined,
    contextConfig: mapContextConfig(raw.contextConfig),
    sections: (raw.sections ?? []).map(mapSanitySection),
  };
}
