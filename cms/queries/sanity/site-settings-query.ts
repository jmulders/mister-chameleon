/**
 * Site Settings — Sanity GROQ query and raw response types
 *
 * Defines:
 *   SITE_SETTINGS_QUERY     — fetch the per-tenant siteSettings document
 *   SanitySiteSettingsRaw   — TypeScript shape of the GROQ projection result
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   The query accepts a `$tenantId` parameter and filters to the matching
 *   document:  `*[_type == "siteSettings" && tenantId == $tenantId][0]`
 *
 *   Pass an empty string to fetch the global / shared document (legacy mode).
 *   The provider falls back to a tenantId-less document if the scoped one
 *   is not found (the GROQ [0] returns null which the caller handles).
 *
 * ─── Navigation resolution ────────────────────────────────────────────────────
 *
 *   mainNavigation and footerNavigation are arrays of Sanity references.
 *   This query dereferences them (->) and uses GROQ's `select()` to resolve
 *   the `href` field at query time.  Child and grandchild items are resolved
 *   with the same pattern (two levels deep).
 *
 * ─── Footer columns ───────────────────────────────────────────────────────────
 *
 *   footerColumns are inline objects (no reference dereferencing needed).
 *   Each column's `links` use `select()` to resolve href from either
 *   internalPage->slug.current or externalUrl.
 *
 * ─── Logo asset resolution ────────────────────────────────────────────────────
 *
 *   Sanity image fields store a reference to an asset document.
 *   `asset->url` dereferences the asset and returns the CDN URL.
 *   The inline `alt` field is projected alongside it.
 */

// ── Navigation item raw types ──────────────────────────────────────────────────

// ── Mega menu raw types ───────────────────────────────────────────────────────

/**
 * Raw shape of a single item inside a mega menu column.
 *
 * The _type discriminant identifies whether the item is a link or a media block.
 * Fields that don't apply to a given _type are null in the GROQ projection.
 */
export interface SanityMegaMenuItemRaw {
  _key:            string;
  _type:           "megaMenuLinkItem" | "megaMenuMediaItem";
  // ── Link item fields ────────────────────────────────────────────────────
  label?:          string | null;
  description?:    string | null;
  openInNewTab?:   boolean | null;
  /** Pre-resolved href from linkType + internalPage slug or externalUrl. */
  href?:           string | null;
  // ── Media item fields ───────────────────────────────────────────────────
  mediaType?:      "image" | "gif" | "video" | null;
  assetUrl?:       string | null;
  alt?:            string | null;
  hoverAssetUrl?:  string | null;
  caption?:        string | null;
  linkUrl?:        string | null;
  linkOpenInNewTab?:boolean | null;
  videoUrl?:       string | null;
}

export interface SanityMegaMenuColumnRaw {
  _key:        string;
  title?:      string | null;
  columnType:  "links" | "media";
  items?:      SanityMegaMenuItemRaw[] | null;
}

export interface SanityMegaMenuRaw {
  columns?: SanityMegaMenuColumnRaw[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a deeply resolved navigation item (up to two levels deep). */
export interface SanityNavItemRaw {
  _id:          string;
  label:        string;
  href:         string;
  description?: string | null;
  openInNewTab?: boolean | null;
  /**
   * Explicit mega-menu toggle from the schema field `hasMegaMenu`.
   * When false the mapper skips megaMenu even if columns are present
   * (editor disabled the mega menu without deleting the column data).
   */
  hasMegaMenu?: boolean | null;
  children?:    SanityNavItemChildRaw[];
  /** Rich column-based mega menu. When present and hasMegaMenu is true, takes precedence over children. */
  megaMenu?:    SanityMegaMenuRaw | null;
}

export interface SanityNavItemChildRaw {
  _id:         string;
  label:       string;
  href:        string;
  description?: string | null;
  openInNewTab?:boolean | null;
  children?:   SanityNavItemLeafRaw[];
}

export interface SanityNavItemLeafRaw {
  _id:         string;
  label:       string;
  href:        string;
}

// ── Footer column raw types ────────────────────────────────────────────────────

export interface SanityFooterLinkRaw {
  label:       string;
  href:        string;
  openInNewTab?:boolean | null;
}

export interface SanityFooterColumnRaw {
  title?:  string | null;
  links:   SanityFooterLinkRaw[];
}

// ── Header CTA raw type ───────────────────────────────────────────────────────

export interface SanityHeaderCtaRaw {
  label:        string;
  href:         string;
  style?:       string | null;
  openInNewTab?:boolean | null;
}

// ── Social link raw type ──────────────────────────────────────────────────────

export interface SanitySocialLinkRaw {
  label: string;
  url:   string;
}

// ── Locale entry raw type ─────────────────────────────────────────────────────

export interface SanityLocaleEntryRaw {
  code:  string;
  label: string;
}

// ── Logo raw type ─────────────────────────────────────────────────────────────

export interface SanityLogoRaw {
  url: string;
  alt: string;
}

// ── Full site settings raw type ───────────────────────────────────────────────

/**
 * Shape of the data returned by SITE_SETTINGS_QUERY.
 * Field names match the Sanity schema exactly; the mapper translates
 * these to SiteSettingsData.
 */
export interface SanitySiteSettingsRaw {
  siteTitle:           string;
  logo:                SanityLogoRaw | null;
  logoDark?:           SanityLogoRaw | null;
  logoLight?:          SanityLogoRaw | null;
  headerCta?:          SanityHeaderCtaRaw | null;
  headerUtilityItems?: SanityNavItemRaw[] | null;
  locales?:            SanityLocaleEntryRaw[] | null;
  mainNavigation:      SanityNavItemRaw[];
  footerColumns?:      SanityFooterColumnRaw[] | null;
  footerNavigation:    SanityNavItemRaw[];
  contactEmail?:       string | null;
  contactPhone?:       string | null;
  socialLinks?:        SanitySocialLinkRaw[] | null;
}

// ── GROQ projection fragments ─────────────────────────────────────────────────

/**
 * Resolve a logo image field to { url, alt }.
 *
 * The CDN parameters appended to `url` are Sanity's URL-based image
 * transformations — they apply to all Sanity CDN URLs automatically:
 *
 *   w=160       — scale to 160 px wide (the logo never needs to be wider)
 *   fit=max     — preserve aspect ratio; never upscale
 *   q=85        — JPEG/WebP quality (slightly higher than body images for crisp logo)
 *   auto=format — serve WebP in supporting browsers, fallback to original format
 *
 * This is baked into the GROQ query so the optimized URL is returned by the
 * Sanity API itself — no runtime URL manipulation needed.
 *
 * Typical bandwidth reduction: ~95% for PNG logos, ~80% for JPEG logos.
 */
const LOGO_PROJECTION = `{
  "url": asset->url + "?w=160&fit=max&q=85&auto=format",
  "alt": alt
}`;

/** Resolve href for a navigationItem from linkType + internalPage / externalUrl. */
const HREF_SELECT = `select(
  linkType == "internal" => "/" + internalPage->slug.current,
  linkType == "external" => externalUrl,
  "#"
)`;

/**
 * Mega menu GROQ projection fragment.
 *
 * Projects megaMenu.columns[] with full item resolution.
 *
 * Each column has a `columnType` field ("links" | "media") and two separate
 * arrays in the schema — `linkItems[]` and `mediaItems[]` — which are shown
 * conditionally in Studio based on columnType.  At query time we merge them
 * back into a single `items[]` output using GROQ `select()`, so the frontend
 * receives the same shape regardless of column type.
 *
 * Link items: href is resolved at query time from linkType + internalPage slug
 * or externalUrl — the same pattern used for top-level nav items.
 *
 * Media items: assetUrl and hoverAssetUrl dereference the Sanity image asset
 * references to CDN URLs for direct use in <img> / <video> tags.
 * Field names in the schema are `image` and `hoverImage` (renamed from the
 * legacy `asset` / `hoverAsset` to avoid confusion with the Sanity internal
 * `asset` reference sub-field).
 */
const MEGA_MENU_PROJECTION = `
  "megaMenu": megaMenu {
    "columns": columns[] {
      _key,
      title,
      columnType,
      "items": select(
        columnType == "links" => linkItems[] {
          _key,
          _type,
          label,
          description,
          openInNewTab,
          "href": select(
            linkType == "internal" => "/" + internalPage->slug.current,
            linkType == "external" => externalUrl,
            "#"
          )
        },
        columnType == "media" => mediaItems[] {
          _key,
          _type,
          mediaType,
          // Mega menu images are displayed at ~320 px wide maximum.
          // Appending Sanity CDN params at query time avoids runtime URL manipulation
          // and cuts image payload by ~80–95% vs full-resolution delivery.
          // coalesce() falls back to a raw assetUrl string when no Sanity image
          // asset is stored (e.g. seed data that uses direct external URLs).
          "assetUrl":      coalesce(image.asset->url + "?w=320&fit=max&q=75&auto=format", assetUrl),
          alt,
          "hoverAssetUrl": coalesce(hoverImage.asset->url + "?w=320&fit=max&q=75&auto=format", hoverAssetUrl),
          caption,
          // Resolve linkUrl from the internal/external link type pattern — same
          // approach used for all other navigation links in this query.
          // null when no linkType is set (decorative media item, no click-through).
          "linkUrl": select(
            linkType == "internal" => "/" + internalPage->slug.current,
            linkType == "external" => externalUrl,
            null
          ),
          linkOpenInNewTab,
          videoUrl
        },
        []
      )
    }
  }
`;

/** Full nav item projection — 2 levels deep (for mega menus). */
const NAV_ITEM_PROJECTION = `
  _id,
  label,
  description,
  openInNewTab,
  hasMegaMenu,
  "href": ${HREF_SELECT},
  ${MEGA_MENU_PROJECTION},
  "children": children[]-> {
    _id,
    label,
    description,
    openInNewTab,
    "href": ${HREF_SELECT},
    "children": children[]-> {
      _id,
      label,
      "href": ${HREF_SELECT}
    }
  }
`;

/** Footer link projection — inline object with resolved href.
 *
 * Resolution order:
 *   1. linkType == "internal" → /<internalPage slug>
 *   2. linkType == "external" → externalUrl string
 *   3. href field stored directly on the document (seed-data compatibility)
 *   4. "#" as a safe fallback
 *
 * The coalesce fallback (step 3) is required because the seed file stores
 * links with a direct `href` field rather than the linkType/internalPage
 * schema fields.  This keeps seeded data functional without requiring a
 * schema migration or full reseed in the correct linkType format.
 */
const FOOTER_LINK_PROJECTION = `
  label,
  openInNewTab,
  "href": coalesce(
    select(
      linkType == "internal" => "/" + internalPage->slug.current,
      linkType == "external" => externalUrl
    ),
    href,
    "#"
  )
`;

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch the per-tenant siteSettings document with locale fallback.
 *
 * Parameters:
 *   $tenantId  string  The tenant to load settings for. Pass "" for shared/global.
 *   $locale    string  ISO 639-1 locale code, e.g. "en" | "nl" | "de".
 *
 * Returns: SanitySiteSettingsRaw | null
 *
 * Locale fallback strategy:
 *   - Prefers a document where `locale == $locale` (language-specific settings).
 *   - Falls back to the document where `locale` is not defined (the unlocalized default).
 *   - `order(defined(locale) desc) [0]` picks the locale-specific doc over the
 *     unlocalized one when both exist.
 *
 * If `$tenantId` is empty the filter is effectively `tenantId == ""` which
 * matches documents that have no tenantId (shared / platform-wide settings).
 */
export const SITE_SETTINGS_QUERY = `
  *[
    _type == "siteSettings"
    && tenantId == $tenantId
    && (locale == $locale || !defined(locale))
  ] | order(defined(locale) desc) [0] {
    siteTitle,
    "logo":      logo      ${LOGO_PROJECTION},
    "logoDark":  logoDark  ${LOGO_PROJECTION},
    "logoLight": logoLight ${LOGO_PROJECTION},
    "headerCta": headerCta {
      label,
      href,
      style,
      openInNewTab
    },
    "headerUtilityItems": headerUtilityItems[]-> {
      ${NAV_ITEM_PROJECTION}
    },
    "locales": locales[] {
      code,
      label
    },
    "mainNavigation": mainNavigation[]-> {
      ${NAV_ITEM_PROJECTION}
    },
    "footerColumns": footerColumns[] {
      title,
      "links": links[] {
        ${FOOTER_LINK_PROJECTION}
      }
    },
    "footerNavigation": footerNavigation[]-> {
      ${NAV_ITEM_PROJECTION}
    },
    contactEmail,
    contactPhone,
    "socialLinks": socialLinks[] {
      label,
      url
    }
  }
`;
