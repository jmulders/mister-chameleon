/**
 * Statamic site-settings entry type
 *
 * Maps to content/collections/site_settings/site-settings.md in the
 * Statamic CMS. Used by StatamicProvider.getSiteSettings().
 */

/** @deprecated site_settings is now a Global, not a collection. */
export const SITE_SETTINGS_COLLECTION = "site_settings" as const;
/** @deprecated site_settings is now a Global. Use fetchGlobal("site_settings") instead. */
export const SITE_SETTINGS_KEY        = "site_settings"  as const;

export interface StatamicNavItem {
  label: string;
  href:  string;
  open_in_new_tab?: boolean;
}

export interface StatamicFooterColumn {
  title: string;
  links: StatamicNavItem[];
}

export interface StatamicSocialLink {
  label: string;
  url:   string;
}

/** A single locale entry in the language switcher */
export interface StatamicLocaleEntry {
  code:  string;   // e.g. "nl" | "en" | "de"
  label: string;   // e.g. "Nederlands" | "English" | "Deutsch"
}

/**
 * A site entry from resources/sites.yaml (Statamic v5+).
 *
 * Statamic stores multi-site configuration in resources/sites.yaml, keyed by
 * handle.  Each entry has a name, locale (PHP locale string), url, and an
 * optional attributes map for custom key/value pairs set in CP → Configure Sites.
 *
 * The `showSite` custom attribute controls whether the site appears in the
 * language switcher.  Editors set it in CP → Settings → Sites → Custom Attributes.
 */
export interface StatamicSiteEntry {
  /** The site handle, e.g. "nl" or "en-gb".  Doubles as the locale code. */
  handle:      string;
  /** Human-readable site name, e.g. "Nederlands" or "English". */
  name:        string;
  /** PHP locale string, e.g. "nl_NL" or "en_GB". */
  locale:      string;
  /** Base URL for this site, e.g. "/" or "/en-gb". */
  url:         string;
  /**
   * Custom attributes set in CP → Settings → Sites → Custom Attributes.
   * All values are stored as strings by Statamic.
   * Key "showSite" = "true"  → include in language switcher.
   * Key "showSite" = "false" → hide from language switcher.
   */
  attributes?: Record<string, string>;
}

/** A single link row in the footer_bottom_links grid */
export interface StatamicFooterBottomLink {
  label:             string;
  href:              string;
  open_in_new_tab?:  boolean;
}

export interface StatamicSiteSettingsEntry {
  key:                 string;
  site_title?:         string;
  logo_url?:           string;
  logo_alt?:           string;
  // ── Header utility bar / top bar ──────────────────────────────────────────
  header_cta_label?:   string;
  header_cta_href?:    string;
  header_cta_style?:   "primary" | "secondary" | "outline" | "ghost";
  /** Show search icon in the top bar */
  top_bar_show_search?:             boolean;
  /** Destination URL for the search icon (default: /search) */
  top_bar_search_href?:             string;
  /** Show shopping cart icon in the top bar */
  top_bar_show_cart?:               boolean;
  /** Destination URL for the cart icon (default: /cart) */
  top_bar_cart_href?:               string;
  /** Show language/locale selector in the top bar */
  top_bar_show_language_switcher?:  boolean;
  /** Extra utility nav items in the top bar (legacy field) */
  utility_links?:                   StatamicNavItem[];
  // ── Contact ────────────────────────────────────────────────────────────────
  contact_email?:      string;
  contact_phone?:      string;
  // ── Navigation ────────────────────────────────────────────────────────────
  main_navigation?:    StatamicNavItem[];
  footer_navigation?:  StatamicNavItem[];
  footer_columns?:     StatamicFooterColumn[];
  social_links?:       StatamicSocialLink[];
  /** Ordered list of supported locales for the language switcher */
  locales?:            StatamicLocaleEntry[];
  // ── Footer bottom strip ───────────────────────────────────────────────────
  footer_bottom_enabled?:          boolean;
  footer_bottom_copyright?:        string;
  footer_bottom_show_social?:      boolean;
  footer_bottom_links?:            StatamicFooterBottomLink[];
  footer_bottom_partner_logo?:     string;
  footer_bottom_partner_logo_alt?: string;
  footer_bottom_partner_href?:     string;
  // ── Layout ────────────────────────────────────────────────────────────────
  /**
   * CMS-level header layout variant.  Acts as a fallback: the platform admin
   * value takes precedence when set.
   */
  header_variant?:     "minimal" | "flyout" | "mega" | "transparent";
  /** CMS-level footer layout variant fallback. */
  footer_variant?:     "minimal" | "corporate" | "branding";
  /** CMS-level footer density fallback. */
  footer_density?:     "compact" | "comfortable" | "spacious";
  // ── Theme ─────────────────────────────────────────────────────────────────
  /**
   * Base theme preset key for this site.
   * Maps to a ThemePresetKey in the platform design system.
   * Example: "dark-ai", "corporate-blue", "modern-saas".
   */
  theme_preset?:       string;
}
