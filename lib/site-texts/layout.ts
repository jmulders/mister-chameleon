/**
 * Site texts for the frame around every page: header, navigation and footer.
 *
 * Used by components/layout (Header, NavBar, SectionTabs, the nav variants,
 * the footer variants and the cart icon).
 *
 * `en` is what these components always said. `nl` is the same in Dutch. A text
 * with a variable part is a small function, so the word order can differ per
 * language.
 *
 * What is NOT in here: anything an editor types in the CMS. Nav items, footer
 * columns, CTA labels and the copyright line of the bottom strip come from the
 * CMS and always win. These are only the fixed words and the fallbacks.
 */

import type { SiteTexts } from "./locale";

export type LayoutTexts = {
  // ── Header ─────────────────────────────────────────────────────────────────
  /** aria-label on the logo link. */
  homeLink:           (siteTitle: string) => string;
  /** Placeholder of the search field in the three-band header. */
  searchPlaceholder:  string;
  /** Header button per demo scenario (only while a scenario is active). */
  ctaMyAccount:       string;
  ctaUpgradePlan:     string;
  ctaBookMeeting:     string;
  ctaCompleteRequest: string;

  // ── Utility bar (links, search, cart, language) ────────────────────────────
  utilityNav:     string;
  search:         string;
  cart:           string;
  selectLanguage: string;
  /** aria-label on the cart icon in the header, with the number of items. */
  viewCart:       (count: number) => string;

  // ── Section tabs (three-band header) ───────────────────────────────────────
  siteSections: string;
  quickLinks:   string;

  // ── Main navigation ────────────────────────────────────────────────────────
  mainNav:       string;
  /** aria-label on the chevron next to a nav item with a dropdown. */
  toggleSubmenu: (label: string) => string;
  /** Placeholder in a mega-menu media tile without an image or video. */
  noAsset:       string;

  // ── Mobile menu ────────────────────────────────────────────────────────────
  openMenu:        string;
  closeMenu:       string;
  mobileNav:       string;
  expandSubmenu:   (label: string) => string;
  collapseSubmenu: (label: string) => string;
  /** Link text for a mega-menu media tile without a caption. */
  view:            string;

  // ── Footer ─────────────────────────────────────────────────────────────────
  footerNav:         string;
  legalLinks:        string;
  footerLegalLinks:  string;
  /** aria-label on the partner logo when it has no alt text. */
  partner:           string;
  allRightsReserved: string;
};

export const LAYOUT_TEXTS: SiteTexts<LayoutTexts> = {
  en: {
    homeLink:           (siteTitle) => `${siteTitle} — go to homepage`,
    searchPlaceholder:  "Search the site…",
    ctaMyAccount:       "My account",
    ctaUpgradePlan:     "Upgrade plan",
    ctaBookMeeting:     "Book a meeting",
    ctaCompleteRequest: "Complete request",

    utilityNav:     "Utility navigation",
    search:         "Search",
    cart:           "Shopping cart",
    selectLanguage: "Select language",
    viewCart:       (count) => (count > 0 ? `View cart — ${count} item${count !== 1 ? "s" : ""}` : "View cart"),

    siteSections: "Site sections",
    quickLinks:   "Quick links",

    mainNav:       "Main navigation",
    toggleSubmenu: (label) => `Toggle ${label} submenu`,
    noAsset:       "No asset",

    openMenu:        "Open navigation menu",
    closeMenu:       "Close navigation menu",
    mobileNav:       "Mobile navigation",
    expandSubmenu:   (label) => `Expand ${label} submenu`,
    collapseSubmenu: (label) => `Collapse ${label} submenu`,
    view:            "View",

    footerNav:         "Footer navigation",
    legalLinks:        "Legal links",
    footerLegalLinks:  "Footer legal links",
    partner:           "Partner",
    allRightsReserved: "All rights reserved.",
  },

  nl: {
    homeLink:           (siteTitle) => `${siteTitle}, naar de homepage`,
    searchPlaceholder:  "Zoek op de site…",
    ctaMyAccount:       "Mijn account",
    ctaUpgradePlan:     "Pakket wijzigen",
    ctaBookMeeting:     "Plan een afspraak",
    ctaCompleteRequest: "Aanvraag afronden",

    utilityNav:     "Servicemenu",
    search:         "Zoeken",
    cart:           "Winkelwagen",
    selectLanguage: "Taal kiezen",
    viewCart:       (count) =>
      count > 0
        ? `Winkelwagen bekijken, ${count} ${count === 1 ? "artikel" : "artikelen"}`
        : "Winkelwagen bekijken",

    siteSections: "Onderdelen van de site",
    quickLinks:   "Snelle links",

    mainNav:       "Hoofdmenu",
    toggleSubmenu: (label) => `Submenu van ${label} openen of sluiten`,
    noAsset:       "Geen beeld",

    openMenu:        "Menu openen",
    closeMenu:       "Menu sluiten",
    mobileNav:       "Mobiel menu",
    expandSubmenu:   (label) => `Submenu van ${label} openen`,
    collapseSubmenu: (label) => `Submenu van ${label} sluiten`,
    view:            "Bekijk",

    footerNav:         "Menu in de voettekst",
    legalLinks:        "Juridische links",
    footerLegalLinks:  "Juridische links in de voettekst",
    partner:           "Partner",
    allRightsReserved: "Alle rechten voorbehouden.",
  },
};
