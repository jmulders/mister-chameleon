"use client";

/**
 * NavBar
 *
 * Client component that renders the site's primary navigation bar.
 * Receives pre-resolved NavigationItemData from the server (via Header),
 * so it has no CMS dependency — it only owns interactivity.
 *
 * ─── Desktop dispatch ─────────────────────────────────────────────────────────
 *
 *   navVariant controls which desktop dropdown pattern is used:
 *     "flyout"  → NavFlyout  (editorial-classic, premium-luxury)
 *     "mega"    → NavMega    (corporate-clean)
 *     "grid"    → NavGrid    (portfolio-showcase)
 *     "content" → NavContent (bold-marketing)
 *   Defaults to "flyout" when not specified.
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
 *   MobileNav is always rendered — it is independent of navVariant.
 *   A hamburger button toggles a full-width stacked menu below the header bar.
 *   Top-level items with children can be expanded individually with a chevron
 *   toggle. The mobile menu closes automatically when a link is followed.
 *
 * ─── Fallback ─────────────────────────────────────────────────────────────────
 *
 *   When `items` is empty (no navigation configured in the CMS, or getSiteSettings()
 *   returned null) the component renders nothing. The parent Header still renders
 *   the site logo/name, so the page is never left with a broken shell.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   items       NavigationItemData[]                  Resolved nav items.
 *   navVariant  "flyout"|"mega"|"grid"|"content"      Desktop dropdown pattern.
 *   navDensity  "compact"|"comfortable"               Link padding density.
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavigationItemData, HeaderCtaData, LocaleEntry } from "@/cms/types";
import { NavFlyout }    from "./nav/NavFlyout";
import { NavMegaRich }  from "./nav/NavMegaRich";
import type { MegaMenuStyle } from "./nav/NavMegaRich";
import { NavGrid }     from "./nav/NavGrid";
import { NavContent }  from "./nav/NavContent";

// ── Icons ─────────────────────────────────────────────────────────────────────
// Inline SVGs keep the bundle lean — no icon library dependency.

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("size-4", className)}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavVariant = "flyout" | "mega" | "grid" | "content";
export type NavDensity = "compact" | "comfortable";

interface NavBarProps {
  items:          NavigationItemData[];
  /** Desktop dropdown pattern driven by the active theme family. */
  navVariant?:    NavVariant;
  /** Link padding density driven by the active theme family. */
  navDensity?:    NavDensity;
  /**
   * Active theme family key — used to select the per-theme mega menu style.
   * Passed from Header which resolves it from the tenant's featuredFamilyKey.
   *
   * Mapping:
   *   "dark-ai"         → NavMegaRich megaStyle="dark-ai"
   *   "clean-corporate" → NavMegaRich megaStyle="clean-corporate"
   *   "structured-saas" → NavMegaRich megaStyle="structured-saas"
   *   anything else     → NavMegaRich megaStyle="default" (clean-corporate look)
   */
  navFamily?:     string | null;
  /**
   * Render mode — used by multi-band layouts (header_triband) to split
   * desktop and mobile nav into separate DOM positions.
   *
   *   "all"          — render both desktop nav + mobile hamburger (default)
   *   "desktop-only" — render only the desktop nav component; omit MobileNav
   *   "mobile-only"  — render only the MobileNav hamburger; omit desktop nav
   */
  mode?:          "all" | "desktop-only" | "mobile-only";
}

// ── Locale flag map ────────────────────────────────────────────────────────────
// Maps ISO 639-1 language codes to Unicode flag emoji.
// Add more entries as additional locales are configured.

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  nl: "🇳🇱",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pt: "🇵🇹",
  pl: "🇵🇱",
};

// ── UtilityBar — desktop utility row ──────────────────────────────────────────

/**
 * Thin bar rendered above the main nav row.
 * Shows: utility links (Login, Search, Status) + language-switcher dropdown + CTA button.
 * "Search" utility items render as a magnifying-glass icon to save space.
 * Hidden on mobile — the mobile menu renders these items inline.
 *
 * Exported so that Header.tsx can render it into HeaderShell's `utilityBar` slot,
 * which places it in the collapsible top row (above the logo + nav row).
 */
export function UtilityBar({
  utilityItems = [],
  headerCta    = null,
  locales      = [],
  currentLocale: currentLocaleCode,
}: {
  utilityItems?:  NavigationItemData[];
  headerCta?:     HeaderCtaData | null;
  locales?:       LocaleEntry[];
  /** ISO 639-1 code of the active locale (from cookie). Defaults to locales[0]. */
  currentLocale?: string;
}) {
  const [localeOpen, setLocaleOpen] = useState(false);
  const localeRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when the user clicks outside of it.
  useEffect(() => {
    if (!localeOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (localeRef.current && !localeRef.current.contains(e.target as Node)) {
        setLocaleOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setLocaleOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown",   handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown",   handleEscape);
    };
  }, [localeOpen]);

  const hasUtility = utilityItems.length > 0;
  const hasCta     = !!headerCta;
  const hasLocales = locales.length > 1;   // switcher only makes sense with 2+ locales

  if (!hasUtility && !hasCta && !hasLocales) return null;

  // Active locale: use cookie value if provided and found in the list; else first in list.
  const foundLocale   = currentLocaleCode ? locales.find((l) => l.code === currentLocaleCode) : undefined;
  const currentLocale = (foundLocale ?? locales[0]) as LocaleEntry;

  return (
    <div className="hidden md:flex items-center gap-1">

      {/* Utility links */}
      {hasUtility && (
        <nav aria-label="Utility navigation" className="flex items-center gap-0.5">
          {utilityItems.map((item, i) => {
            const isSearch = item.label.toLowerCase() === "search";
            const isCart   = item.label.toLowerCase() === "cart";
            const isIcon   = isSearch || isCart;
            return (
              <Link
                // Fallback to href+index — some CMS API responses omit item ids.
                key={item.id || `${item.href}-${i}`}
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
                rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                aria-label={isSearch ? "Search" : isCart ? "Shopping cart" : undefined}
                title={isSearch ? "Search" : isCart ? "Shopping cart" : undefined}
                className={cn(
                  "rounded-md py-1.5 text-sm transition-colors duration-150",
                  isIcon ? "px-2" : "px-3",
                  "text-[var(--nav-link,var(--header-fg,var(--text-muted)))]",
                  "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))]",
                  "hover:text-[var(--nav-link-hover,var(--text-brand))]",
                  "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
                )}
                style={{ fontWeight: "var(--nav-link-weight, 500)" } as React.CSSProperties}
              >
                {isSearch ? <SearchIcon /> : isCart ? <CartIcon /> : item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Separator */}
      {hasUtility && (hasCta || hasLocales) && (
        <span
          aria-hidden="true"
          className="mx-1 h-4 w-px opacity-20"
          style={{ backgroundColor: "var(--header-fg, var(--text))" }}
        />
      )}

      {/* Language switcher — compact dropdown */}
      {hasLocales && (
        <div ref={localeRef} className="relative">
          <button
            type="button"
            onClick={() => setLocaleOpen((v) => !v)}
            aria-expanded={localeOpen}
            aria-haspopup="listbox"
            aria-label="Select language"
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150",
              "text-[var(--nav-link,var(--header-fg,var(--text-muted)))]",
              "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))]",
              "hover:text-[var(--nav-link-hover,var(--text-brand))]",
              "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {LOCALE_FLAGS[currentLocale.code] ?? "🌐"}
            </span>
            <span className="uppercase tracking-wide">{currentLocale.code}</span>
            <ChevronDown className={cn("size-3 transition-transform duration-150", localeOpen && "rotate-180")} />
          </button>

          {localeOpen && (
            <div
              role="listbox"
              aria-label="Select language"
              className={cn(
                "absolute right-0 top-full mt-1 z-[200] min-w-[8rem] rounded-md py-1 shadow-xl",
                "border border-[var(--nav-dropdown-border,var(--border))]",
              )}
              style={{
                // Inline style guarantees a solid background even when the
                // utility-bar ancestor would otherwise make it translucent.
                // Opacity is non-overridable from children — always resolve here.
                backgroundColor: "var(--nav-dropdown-bg, #ffffff)",
                color:           "var(--nav-dropdown-text, #374151)",
              }}
            >
              {locales.map((locale) => (
                <a
                  key={locale.code}
                  href={`?lang=${locale.code}`}
                  role="option"
                  aria-selected={locale.code === currentLocale.code}
                  onClick={() => setLocaleOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-100",
                    "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))]",
                    "hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {LOCALE_FLAGS[locale.code] ?? "🌐"}
                  </span>
                  <span>{locale.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA button */}
      {hasCta && (
        <Link
          href={headerCta!.href}
          target={headerCta!.openInNewTab ? "_blank" : undefined}
          rel={headerCta!.openInNewTab ? "noopener noreferrer" : undefined}
          className={cn(
            "ml-2 inline-flex items-center justify-center rounded-md px-4 py-1.5",
            "text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
          )}
          style={{ backgroundColor: "var(--btn-bg, var(--primary))" }}
        >
          {headerCta!.label}
        </Link>
      )}
    </div>
  );
}

// ── Mobile nav helpers ────────────────────────────────────────────────────────

/**
 * Flatten megaMenu columns into a simple link list for mobile rendering.
 * Returns NavigationItemData-compatible child items derived from mega menu columns.
 */
function flattenMegaMenuForMobile(item: NavigationItemData): NavigationItemData[] {
  if (!item.megaMenu?.columns?.length) return item.children ?? [];

  const flattened: NavigationItemData[] = [];
  for (const col of item.megaMenu.columns) {
    for (const mItem of col.items) {
      if (mItem.type === "megaMenuLinkItem" && mItem.label) {
        flattened.push({
          id:           mItem._key,
          label:        mItem.label,
          href:         mItem.href,
          description:  mItem.description ?? undefined,
          openInNewTab: mItem.openInNewTab,
        });
      }
      // Media items without linkUrl are skipped on mobile (no meaningful href)
      if (mItem.type === "megaMenuMediaItem" && mItem.linkUrl) {
        flattened.push({
          id:           mItem._key,
          label:        mItem.caption ?? "View",
          href:         mItem.linkUrl,
          openInNewTab: mItem.linkOpenInNewTab,
        });
      }
    }
  }
  return flattened;
}

// ── Mobile nav ────────────────────────────────────────────────────────────────

function MobileNav({ items }: { items: NavigationItemData[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setExpandedItem((prev) => (prev === id ? null : id));
  };

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="mobile-nav-menu"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "rounded-md p-2 text-[var(--nav-link,var(--header-fg,var(--text)))]",
          "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-link-hover,var(--text-brand))]",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
        )}
      >
        {menuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className={cn(
            // top-full positions the panel flush against the bottom of the
            // sticky <header> element regardless of its current height.
            // Previously hardcoded top-16 broke when HeaderShell changed the
            // header's height via scroll-aware padding transitions.
            "absolute inset-x-0 top-full z-40",
            "border-b border-[var(--nav-dropdown-border,var(--border))] bg-[var(--nav-dropdown-bg,var(--bg,#ffffff))] shadow-lg",
          )}
        >
          <div className="px-4 py-3 space-y-1">
            {items.map((item) => {
              const mobileChildren = flattenMegaMenuForMobile(item);
              const hasChildren = mobileChildren.length > 0;
              const isExpanded = expandedItem === item.id;

              // Mobile nav uses the same nav-link-size/weight vars as desktop.
              // --nav-link-weight fallback: 500 (medium) — consistent with flyout/mega/grid.
              const mobileLinkStyle = {
                fontSize:   "var(--nav-link-size, 0.875rem)",
                fontWeight: "var(--nav-link-weight, 500)",
              } as React.CSSProperties;
              const mobileChildStyle = {
                fontSize: "var(--nav-dropdown-item-size, 0.875rem)",
              } as React.CSSProperties;

              return (
                <div key={item.id}>
                  {hasChildren ? (
                    <>
                      {/*
                       * Split trigger row: label link navigates to the parent page;
                       * chevron-only button expands/collapses the children list.
                       * A hairline divider separates the two tap targets.
                       */}
                      <div className="flex w-full items-stretch rounded-md overflow-hidden">
                        {/* Parent page link */}
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          style={mobileLinkStyle}
                          className={cn(
                            "flex-1 px-3 py-2",
                            "text-[var(--nav-dropdown-text,var(--text-muted))]",
                            "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                            "transition-colors duration-150",
                          )}
                        >
                          {item.label}
                        </Link>

                        {/* Expand/collapse chevron */}
                        <button
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label} submenu`}
                          aria-expanded={isExpanded}
                          onClick={() => toggleItem(item.id)}
                          className={cn(
                            "flex items-center px-3 py-2 shrink-0",
                            "border-l border-[var(--nav-dropdown-border,var(--border))]",
                            "text-[var(--nav-dropdown-text,var(--text-muted))]",
                            "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                            "transition-colors duration-150",
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "transition-transform duration-150",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      </div>

                      {/* Children */}
                      {isExpanded && (
                        <div className="mt-1 ml-4 space-y-1 border-l border-[var(--nav-dropdown-border,var(--border))] pl-3">
                          {mobileChildren.map((child) => (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={() => setMenuOpen(false)}
                              target={child.openInNewTab ? "_blank" : undefined}
                              rel={child.openInNewTab ? "noopener noreferrer" : undefined}
                              style={mobileChildStyle}
                              className={cn(
                                "block rounded-md px-3 py-1.5",
                                "text-[var(--nav-dropdown-text,var(--text-muted))]",
                                "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                                "transition-colors duration-100",
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      style={mobileLinkStyle}
                      className={cn(
                        "block rounded-md px-3 py-2",
                        "text-[var(--nav-dropdown-text,var(--text-muted))]",
                        "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                        "transition-colors duration-150",
                      )}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NavBar ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the mega menu style from the active theme family key.
 *
 * This mapping is the single source of truth for which family key produces
 * which NavMegaRich visual variant.
 */
function resolveMegaStyle(navFamily: string | null | undefined): MegaMenuStyle {
  switch (navFamily) {
    case "dark-ai":         return "dark-ai";
    case "clean-corporate": return "clean-corporate";
    case "structured-saas": return "structured-saas";
    default:                return "default";
  }
}

/**
 * Primary navigation bar. Renders desktop + mobile layouts.
 * Returns null (no DOM output) when items is empty.
 *
 * The desktop component is chosen from navVariant:
 *   "flyout"  → NavFlyout    (vertical list; editorial/luxury)
 *   "mega"    → NavMegaRich  (rich column mega menu; corporate / AI / SaaS)
 *   "grid"    → NavGrid      (tile grid; portfolio)
 *   "content" → NavContent   (featured + list; marketing)
 */
export function NavBar({
  items,
  navVariant   = "flyout",
  navDensity   = "comfortable",
  navFamily    = null,
  mode         = "all",
}: NavBarProps) {
  // The per-page header-variant override was removed — that authoring field no
  // longer exists. Mega menus are content-driven (see below) and the header
  // style is configured site-wide, so there is nothing to override per item.
  if (items.length === 0) return null;
  let effectiveVariant: NavVariant = navVariant;
  const effectiveDensity: NavDensity = navDensity;

  // ── Decouple mega menus from the header variant ─────────────────────────────
  // Mega menus are CONTENT-DRIVEN: whenever a nav item has dropdown content
  // (rich columns, a CTA, or child links) the rich mega nav (NavMegaRich) renders
  // — regardless of the chosen header variant. The variant then only controls the
  // look (density / background / structure), NOT whether mega menus appear.
  // Without this, picking e.g. "minimal" silently hid mega menus configured per
  // nav item (the flyout pattern has no mega panel). grid/content stay opt-in.
  const hasDropdownContent = items.some(
    (it) =>
      Boolean(it.megaMenu?.columns?.length) ||
      Boolean(it.megaCta) ||
      Boolean(it.children?.length),
  );
  if (hasDropdownContent && effectiveVariant === "flyout") {
    effectiveVariant = "mega";
  }

  const megaStyle = resolveMegaStyle(navFamily);

  // ── Desktop nav — dispatch to the family-appropriate pattern ────────────────
  let DesktopNavComponent: React.ReactNode;
  switch (effectiveVariant) {
    case "mega":
      // Always use NavMegaRich — it handles both schema-driven column menus
      // (megaMenu.columns) and legacy children-based menus via its built-in
      // LegacyChildrenPanel which renders a richer Brons-style feature layout.
      DesktopNavComponent = <NavMegaRich items={items} density={effectiveDensity} megaStyle={megaStyle} />;
      break;
    case "grid":
      DesktopNavComponent = <NavGrid    items={items} density={effectiveDensity} />;
      break;
    case "content":
      DesktopNavComponent = <NavContent items={items} density={effectiveDensity} />;
      break;
    case "flyout":
    default:
      DesktopNavComponent = <NavFlyout  items={items} density={effectiveDensity} />;
      break;
  }

  if (mode === "desktop-only") return <>{DesktopNavComponent}</>;
  if (mode === "mobile-only")  return <MobileNav items={items} />;

  return (
    <>
      {DesktopNavComponent}
      <MobileNav items={items} />
    </>
  );
}
