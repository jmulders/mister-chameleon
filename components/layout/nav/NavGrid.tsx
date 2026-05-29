"use client";

/**
 * NavGrid — Desktop grid navigation (portfolio-showcase family)
 *
 * Renders top-level items as a horizontal row.  Items with children open a
 * square-tile grid panel — each child link is a large clickable tile with the
 * label prominently displayed.  Mirrors the portfolio family's image-first,
 * media-led visual character.
 *
 * ─── Visual character ─────────────────────────────────────────────────────────
 *
 *   Panel: fixed-width tile grid, square tiles with brand accent on hover.
 *   emphasis="visual"  → full-tile highlight on hover with brand colour bleed
 *   density adapts tile padding.
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
 *   NavGrid renders nothing on mobile — the parent NavBar always mounts
 *   MobileNav alongside whichever desktop variant is active.
 *
 * ─── Hover reliability fix ────────────────────────────────────────────────────
 *
 *   The panel is `position: absolute`, so it does not extend the wrapper div's
 *   bounding box.  Two complementary fixes keep the menu open while the cursor
 *   travels from trigger to panel:
 *
 *   1. Hover bridge  — an invisible `aria-hidden` div covers the `mt-1.5` (6 px)
 *      gap so the cursor remains inside a descendant of the wrapper; `mouseleave`
 *      never fires while traversing the gap.
 *
 *   2. Close delay   — `useMenuState` delays the `setOpen(false)` by 150 ms so
 *      that even if the cursor briefly exits all descendants, it has time to
 *      re-enter before the menu actually closes.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavigationItemData } from "@/cms/types";
import { useMenuState } from "./useMenuState";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavGridProps {
  items:   NavigationItemData[];
  density: "compact" | "comfortable";
}

// ── Grid item ─────────────────────────────────────────────────────────────────

interface GridItemProps {
  item:    NavigationItemData;
  density: "compact" | "comfortable";
}

function GridItem({ item, density }: GridItemProps) {
  const {
    open,
    setOpen,
    triggerRef,
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handleKeyDown,
  } = useMenuState();

  const linkPy = density === "compact" ? "py-2" : "py-2.5";

  const hasChildren = Boolean(item.children?.length);

  // NavGrid uses tracking-wide (0.05em) as its family default for letter-spacing.
  const navLinkStyle: React.CSSProperties = {
    fontSize:      "var(--nav-link-size, 0.875rem)",
    fontWeight:    "var(--nav-link-weight, 500)",
    letterSpacing: "var(--nav-link-tracking, 0.05em)",
  };

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        style={navLinkStyle}
        className={cn(
          "inline-flex items-center rounded-sm px-3",
          linkPy,
          "text-[var(--nav-link,var(--header-fg,var(--text)))]",
          "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {/*
       * Split trigger: label navigates to the parent page; chevron-only button
       * toggles the submenu.  Both sit in a shared inline-flex row so they look
       * like one item but provide two distinct interaction targets.
       */}
      <div className="inline-flex items-stretch">
        {/* Parent page link — navigates; does NOT toggle the grid panel */}
        <Link
          href={item.href}
          style={navLinkStyle}
          className={cn(
            "inline-flex items-center rounded-l-sm px-3",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
          )}
        >
          {item.label}
        </Link>

        {/* Chevron-only submenu toggle — does NOT navigate */}
        <button
          ref={triggerRef}
          aria-label={`Toggle ${item.label} submenu`}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center rounded-r-sm pl-0.5 pr-2",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
          )}
        >
          <ChevronDown
            className={cn("transition-transform duration-150 opacity-50", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <>
          {/*
           * Hover bridge — invisible element that covers the mt-1.5 (6 px) gap
           * between the bottom of the trigger button and the top of the grid
           * panel.  Height (8 px) intentionally exceeds the gap to provide a
           * small overlap with the panel.  While the cursor is here it is still
           * inside a descendant of the wrapper, so `mouseleave` does not fire.
           */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-full z-40 h-2 w-full"
          />

          {/* Grid panel — square tiles */}
          <div
            role="menu"
            className={cn(
              "absolute left-0 top-full z-50 mt-1.5",
              "w-80",
              "rounded-sm border border-[var(--nav-dropdown-border,var(--border))] bg-[var(--nav-dropdown-bg,var(--bg,#ffffff))] shadow-xl",
              "p-3",
            )}
          >
            <div className="grid grid-cols-2 gap-2">
              {item.children!.map((child) => (
                <Link
                  key={child.id}
                  href={child.href}
                  role="menuitem"
                  className={cn(
                    "group flex flex-col justify-end",
                    "aspect-square rounded-sm p-3",
                    "bg-[var(--nav-dropdown-bg,var(--bg,#ffffff))] border border-[var(--nav-dropdown-border,var(--border))]",
                    "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))]",
                    "hover:border-[var(--primary)]",
                    "transition-all duration-150",
                  )}
                >
                  {/* Decorative accent line — themed via --primary, no purple fallback */}
                  <div
                    className="mb-auto h-0.5 w-5 rounded-full bg-[var(--primary)] opacity-40 group-hover:opacity-100 transition-opacity duration-150"
                  />
                  <span className="text-sm font-semibold text-[var(--nav-dropdown-text,var(--text-muted))] group-hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))] leading-tight">
                    {child.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── NavGrid ───────────────────────────────────────────────────────────────────

/**
 * Desktop grid-tile navigation.
 * Returns null when items is empty.
 * Renders only in the md+ breakpoint — hidden on mobile.
 */
export function NavGrid({ items, density }: NavGridProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
      {items.map((item) => (
        <GridItem key={item.id} item={item} density={density} />
      ))}
    </nav>
  );
}
