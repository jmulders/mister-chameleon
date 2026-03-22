/**
 * Site Settings — Sanity GROQ query and raw response type
 *
 * Defines:
 *   SITE_SETTINGS_QUERY     — fetch the singleton siteSettings document
 *   SanitySiteSettingsRaw   — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: siteSettings ──────────────────────────────────────
 *
 *   siteTitle          string   Site name (used in title fallbacks, aria-labels)
 *   logo               image    Site logo — asset resolved to a CDN URL
 *   mainNavigation     array    References to navigationItem documents (header)
 *   footerNavigation   array    References to navigationItem documents (footer)
 *
 * ─── Navigation resolution ────────────────────────────────────────────────────
 *
 *   mainNavigation and footerNavigation are arrays of Sanity references.
 *   This query dereferences them (->) and uses GROQ's `select()` to resolve
 *   the `href` field at query time:
 *
 *     linkType == "internal"  →  "/" + internalPage->slug.current
 *     linkType == "external"  →  externalUrl
 *     (fallback)              →  "#"   (link is misconfigured; renders safely)
 *
 *   Child items (one-level dropdowns) are resolved with the same pattern.
 *
 * ─── Singleton note ───────────────────────────────────────────────────────────
 *
 *   siteSettings is a singleton document with _type == "siteSettings".
 *   The Studio enforces a single document via the desk structure config.
 *   This query uses [0] to return the object directly (null if not yet created).
 *   No $key parameter is needed — unlike the variant queries.
 *
 * ─── Logo asset resolution ────────────────────────────────────────────────────
 *
 *   Sanity image fields store a reference to an asset document.
 *   `asset->url` dereferences the asset and returns the CDN URL.
 *   The inline `alt` field is projected alongside it.
 *   The outer `logo` object is null when no logo has been uploaded.
 */

// ── Raw response types ─────────────────────────────────────────────────────────

/**
 * A single resolved navigation link as returned by the GROQ projection.
 * `href` is already resolved from either internalPage->slug or externalUrl.
 */
export interface SanityNavItemRaw {
  _id: string;
  label: string;
  href: string;
  children?: Omit<SanityNavItemRaw, "children">[];
}

/**
 * Shape of the data returned by SITE_SETTINGS_QUERY.
 * Field names match the Sanity schema exactly; the mapper translates
 * these to SiteSettingsData.
 */
export interface SanitySiteSettingsRaw {
  siteTitle: string;
  logo: {
    url: string;
    alt: string;
  } | null;
  mainNavigation: SanityNavItemRaw[];
  footerNavigation: SanityNavItemRaw[];
}

// ── Navigation projection fragment ────────────────────────────────────────────
// Shared sub-projection used for both mainNavigation and footerNavigation,
// including one level of children (dropdown items).

const NAV_ITEM_PROJECTION = `
  _id,
  label,
  "href": select(
    linkType == "internal" => "/" + internalPage->slug.current,
    linkType == "external" => externalUrl,
    "#"
  ),
  "children": children[]-> {
    _id,
    label,
    "href": select(
      linkType == "internal" => "/" + internalPage->slug.current,
      linkType == "external" => externalUrl,
      "#"
    )
  }
`;

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch the singleton siteSettings document.
 *
 * Parameters: none
 *
 * Returns: SanitySiteSettingsRaw | null
 *
 * Projection notes:
 *   - `[0]` returns the first (and only) siteSettings document as an object.
 *     Returns null if the document has not been created yet in the Studio.
 *   - `asset->url` resolves the image asset reference to its CDN URL.
 *     The whole `logo` sub-object is null when no logo is uploaded.
 *   - Navigation arrays are dereferenced with `[]->` so each item is the
 *     full navigationItem document rather than a reference stub.
 *   - `select()` resolves the href at query time — no href resolution needed
 *     at render time.
 *
 * @example
 *   const result = await client.fetch<SanitySiteSettingsRaw | null>(
 *     SITE_SETTINGS_QUERY,
 *   );
 */
export const SITE_SETTINGS_QUERY = `
  *[_type == "siteSettings"][0] {
    siteTitle,
    "logo": logo {
      "url": asset->url,
      "alt": alt
    },
    "mainNavigation": mainNavigation[]-> {
      ${NAV_ITEM_PROJECTION}
    },
    "footerNavigation": footerNavigation[]-> {
      ${NAV_ITEM_PROJECTION}
    }
  }
`;
