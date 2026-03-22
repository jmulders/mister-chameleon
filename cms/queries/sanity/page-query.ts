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
 *   heroVariantKey  string?  Key of a heroVariant document
 *   sections        array    Inline section objects (discriminated by _type)
 *   isPublished     boolean  Only published pages are returned
 *
 * ─── Sections ────────────────────────────────────────────────────────────────
 *
 *   Sections are stored as inline objects (not references) inside the page
 *   document. Each section carries a `_type` discriminator matching the
 *   registered object type name:
 *
 *     textSection        heading, body (Portable Text)
 *     featureGrid        heading, features[] { title, description, icon }
 *     testimonialSection heading, testimonials[] { quote, author, company }
 *     faqSection         heading, items[] { question, answer }
 *     ctaSection         title, description, buttonLabel, buttonHref
 *
 *   All fields are projected explicitly — no `...` spread — so the shape is
 *   precise and safe to type as a discriminated union.
 *
 * ─── isPublished guard ────────────────────────────────────────────────────────
 *
 *   `isPublished == true` is included in the filter. Draft or unpublished
 *   pages return null, which the page route translates to a 404.
 *
 * ─── Portable Text note ───────────────────────────────────────────────────────
 *
 *   The `body` field on textSection is Portable Text (array of block nodes).
 *   It is typed as PortableTextBlock[] in PageData / SanityPageRaw.
 *   Rendering is handled by PortableTextRenderer in components/blocks/sections/.
 *   Install @portabletext/react for a more complete renderer if needed.
 */

import type { PortableTextBlock } from "../../types";

// ── Raw response types ─────────────────────────────────────────────────────────

export interface SanityTextSectionRaw {
  _type: "textSection";
  _key: string;
  heading?: string;
  body?: PortableTextBlock[];
}

export interface SanityFeatureItemRaw {
  title: string;
  description: string;
  icon?: string;
}

export interface SanityFeatureGridRaw {
  _type: "featureGrid";
  _key: string;
  heading?: string;
  features?: SanityFeatureItemRaw[];
}

export interface SanityTestimonialItemRaw {
  quote: string;
  author: string;
  company?: string;
}

export interface SanityTestimonialSectionRaw {
  _type: "testimonialSection";
  _key: string;
  heading?: string;
  testimonials?: SanityTestimonialItemRaw[];
}

export interface SanityFaqItemRaw {
  question: string;
  answer: string;
}

export interface SanityFaqSectionRaw {
  _type: "faqSection";
  _key: string;
  heading?: string;
  items?: SanityFaqItemRaw[];
}

export interface SanityCtaSectionRaw {
  _type: "ctaSection";
  _key: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

export type SanityPageSectionRaw =
  | SanityTextSectionRaw
  | SanityFeatureGridRaw
  | SanityTestimonialSectionRaw
  | SanityFaqSectionRaw
  | SanityCtaSectionRaw;

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
  heroVariantKey?: string;
  contextConfig?:  SanityContextConfigRaw;
  sections:        SanityPageSectionRaw[];
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single published page by its URL slug.
 *
 * Parameters:
 *   $slug     string        The page slug, e.g. "about-us"
 *   $tenantId string | null Tenant scope. null = all tenants (backward-compat).
 *
 * Returns: SanityPageRaw | null
 *
 * Projection notes:
 *   - `isPublished == true` guard excludes drafts and disabled pages.
 *   - Tenant predicate: null = no filter; slug = that tenant + shared docs.
 *   - `[0]` returns the first match as an object; null if nothing matched.
 *   - slug is projected as a plain string ("slug": slug.current).
 *   - All five section types are projected with their specific fields.
 *     GROQ silently returns null for fields that don't exist on a given
 *     section type — the mapper ignores these nulls.
 *
 * @example
 *   const page = await client.fetch<SanityPageRaw | null>(
 *     PAGE_BY_SLUG_QUERY,
 *     { slug: "about-us", tenantId: "workengine" },
 *   );
 */
export const PAGE_BY_SLUG_QUERY = `
  *[_type == "page" && slug.current == $slug && isPublished == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
  ][0] {
    _id,
    tenantId,
    title,
    "slug": slug.current,
    templateKey,
    seoTitle,
    seoDescription,
    heroVariantKey,
    contextConfig {
      hero { fallbackVariantKey },
      proof { fallbackVariantKey },
      cta { fallbackVariantKey }
    },
    "sections": sections[] {
      _type,
      _key,

      // textSection
      heading,
      body,

      // featureGrid
      features[] {
        title,
        description,
        icon
      },

      // testimonialSection
      testimonials[] {
        quote,
        author,
        company
      },

      // faqSection
      items[] {
        question,
        answer
      },

      // ctaSection
      title,
      description,
      buttonLabel,
      buttonHref
    }
  }
`;
