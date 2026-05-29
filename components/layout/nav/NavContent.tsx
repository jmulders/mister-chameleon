"use client";

/**
 * NavContent — Desktop content-panel navigation (bold-marketing family)
 *
 * Renders top-level items as a horizontal row.  Items with children open a wide
 * two-column panel: a featured "highlight" tile on the left (the first child
 * link rendered large and prominently) and a compact link list on the right.
 *
 * This pattern draws users deeper into the content — it signals a brand that
 * wants to tell a story, not just list pages.  Ideal for bold-marketing's
 * conversion-focused, editorial + campaign character.
 *
 * ─── Visual character ─────────────────────────────────────────────────────────
 *
 *   Left column: featured highlight tile with brand-tinted background.
 *   Right column: remaining child links as a compact list.
 *   emphasis="visual" → strong hover states, brand colour fills.
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
 *   NavContent renders nothing on mobile — the parent NavBar always mounts
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

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavContentProps {
  items:   NavigationItemData[];
  density: "compact" | "comfortable";
}

// ── Content item ──────────────────────────────────────────────────────────────

interface ContentItemProps {
  item:    NavigationItemData;
  density: "compact" | "comfortable";
}

function ContentItem({ item, density }: ContentItemProps) {
  const {
    open,
    setOpen,
    triggerRef,
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handleKeyDown,
  } = useMenuState();

  const linkPy  = density === "compact" ? "py-2" : "py-2.5";
  const childPy = density === "compact" ? "py-2" : "py-2.5";

  const hasChildren = Boolean(item.children?.length);

  // NavContent uses font-semibold (600) as its family default — reflected in the
  // --nav-link-weight fallback.  This preserves bold-marketing's pill-nav aesthetic
  // when no typography override is configured.
  const navLinkStyle: React.CSSProperties = {
    fontSize:      "var(--nav-link-size, 0.875rem)",
    fontWeight:    "var(--nav-link-weight, 600)",
    letterSpacing: "var(--nav-link-tracking, normal)",
  };

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        style={navLinkStyle}
        className={cn(
          "inline-flex items-center rounded-full px-4",
          linkPy,
          "text-[var(--nav-link,var(--header-fg,var(--text)))]",
          "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-link-hover,var(--text-brand))]",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
        )}
      >
        {item.label}
      </Link>
    );
  }

  // Split children: first = featured highlight, rest = link list
  const [featured, ...rest] = item.children!;

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
        {/* Parent page link — navigates; does NOT toggle the panel */}
        <Link
          href={item.href}
          style={navLinkStyle}
          className={cn(
            "inline-flex items-center rounded-l-full px-4",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-link-hover,var(--text-brand))]",
            "transition-colors duration-150",
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
            "inline-flex items-center rounded-r-full pl-0.5 pr-3",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-link-hover,var(--text-brand))]",
            "transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
          )}
        >
          <ChevronDown
            className={cn("transition-transform duration-150", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <>
          {/*
           * Hover bridge — invisible element that covers the mt-1.5 (6 px) gap
           * between the bottom of the trigger button and the top of the content
           * panel.  Height (8 px) intentionally exceeds the gap to provide a
           * small overlap with the panel.  While the cursor is here it is still
           * inside a descendant of the wrapper, so `mouseleave` does not fire.
           */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-full z-40 h-2 w-full"
          />

          {/* Content panel — featured tile + link list */}
          <div
            role="menu"
            className={cn(
              "absolute left-0 top-full z-50 mt-1.5",
              "w-[480px] max-w-[90vw]",
              "rounded-xl border border-[var(--nav-dropdown-border,var(--border))] bg-[var(--nav-dropdown-bg,var(--bg,#ffffff))] shadow-xl",
              "overflow-hidden",
            )}
          >
            <div className="flex">

              {/* ── Left: featured highlight tile ────────────────────────────── */}
              {/*
               * Featured tile uses --nav-dropdown-link-hover-bg as its resting bg
               * so it's tinted but not the same as a regular hovered item.
               * On hover it fills with --primary — the tile inverts to brand colour.
               * No purple hardcoded fallbacks here; all vars are concrete hex from
               * tenantThemeToCSS().
               */}
              <Link
                href={featured.href}
                role="menuitem"
                className={cn(
                  "group flex flex-col justify-end",
                  "w-48 shrink-0 p-5",
                  "bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))]",
                  "hover:bg-[var(--primary)] transition-colors duration-200",
                )}
              >
                {/* Accent bar */}
                <div className="mb-3 h-0.5 w-8 rounded-full bg-[var(--primary)] group-hover:bg-white transition-colors duration-200" />
                <span
                  className={cn(
                    "text-sm font-bold leading-snug",
                    "text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                    "group-hover:text-white transition-colors duration-200",
                  )}
                >
                  {featured.label}
                </span>
                <ArrowRight className="mt-2 opacity-50 group-hover:opacity-100 group-hover:text-white text-[var(--nav-dropdown-link-hover-text,var(--text-brand))] transition-all duration-200" />
              </Link>

              {/* ── Right: remaining links ────────────────────────────────────── */}
              <div className="flex flex-col flex-1 py-2">
                {rest.map((child) => (
                  <Link
                    key={child.id}
                    href={child.href}
                    role="menuitem"
                    style={{ fontSize: "var(--nav-dropdown-item-size, 0.875rem)" }}
                    className={cn(
                      "group flex items-center justify-between px-4",
                      childPy,
                      "font-medium text-[var(--nav-dropdown-text,var(--text-muted))]",
                      "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                      "transition-colors duration-100",
                    )}
                  >
                    {child.label}
                    {/* Arrow: uses nav-dropdown-link-hover-text (not --primary) so it
                        stays on-theme in dark presets; invisible until hover via opacity. */}
                    <ArrowRight className="opacity-0 group-hover:opacity-60 text-[var(--nav-dropdown-link-hover-text,var(--text-brand))] shrink-0 transition-opacity duration-100" />
                  </Link>
                ))}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── NavContent ────────────────────────────────────────────────────────────────

/**
 * Desktop content-panel navigation.
 * Returns null when items is empty.
 * Renders only in the md+ breakpoint — hidden on mobile.
 */
export function NavContent({ items, density }: NavContentProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
      {items.map((item) => (
        <ContentItem key={item.id} item={item} density={density} />
      ))}
    </nav>
  );
}
