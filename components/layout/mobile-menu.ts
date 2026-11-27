/**
 * What the menu on a phone shows besides the main navigation.
 *
 * A wide header has more than its main navigation: a band of section tabs and
 * quick links, a search bar and a call to action. On a phone only the logo and
 * the menu button fit. Until 22 Nov 2026 the menu held the main navigation and
 * nothing else, so on a phone the other pages, the search and the call to
 * action could not be reached from the header at all.
 *
 * Kept free of React so the rule for the links can be tested.
 */

import type { HeaderCtaData } from "@/cms/types";

export interface MobileMenuLink {
  label:         string;
  href:          string;
  openInNewTab?: boolean;
}

export interface MobileMenuExtras {
  /** Where the search form sends its query. Left out: no search in the menu. */
  searchHref?:        string;
  searchPlaceholder?: string;
  /** The links of the bands a phone does not show. */
  links?:             MobileMenuLink[];
  /** The header's call to action. */
  cta?:               HeaderCtaData | null;
  /**
   * The switch that turns Scenario Control on and off for this browser. Only
   * on a site whose tenant has Scenario Control.
   */
  scenarioSwitch?:    boolean;
}

type LinkLike = { label?: string | null; href?: string | null; openInNewTab?: boolean };

/**
 * The links of the top band for the menu on a phone: the section tabs first,
 * then the quick links, in the order the editor gave them.
 *
 * A link without a label or an address is left out. So is a link the menu
 * already shows: one that occurs twice in the band, or one that is also in the
 * main navigation.
 */
export function mobileMenuLinks(
  sectionTabs: readonly LinkLike[] | null | undefined,
  quickLinks:  readonly LinkLike[] | null | undefined,
  mainNavigation: readonly LinkLike[] = [],
): MobileMenuLink[] {
  const key  = (href: string) => href.trim().replace(/\/+$/, "") || "/";
  const seen = new Set(mainNavigation.map((item) => (typeof item.href === "string" ? key(item.href) : "")).filter(Boolean));
  const links: MobileMenuLink[] = [];
  for (const item of [...(sectionTabs ?? []), ...(quickLinks ?? [])]) {
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const href  = typeof item.href  === "string" ? item.href.trim()  : "";
    if (!label || !href || seen.has(key(href))) continue;
    seen.add(key(href));
    links.push({ label, href, ...(item.openInNewTab ? { openInNewTab: true } : {}) });
  }
  return links;
}

/** True when there is anything to show besides the main navigation. */
export function hasMobileMenuExtras(extras: MobileMenuExtras | null | undefined): boolean {
  return Boolean(extras && (extras.searchHref || extras.cta || extras.scenarioSwitch || (extras.links && extras.links.length > 0)));
}
