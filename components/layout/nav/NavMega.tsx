"use client";

/**
 * NavMega — Desktop mega-menu navigation (corporate-clean family)
 *
 * Renders top-level items as a horizontal row.  Items with children open a
 * full-width (site-width) panel with child links arranged in a tidy column grid.
 * This signals organisational depth and structured information architecture —
 * the right choice for corporate-clean's data-rich, structured character.
 *
 * ─── Visual character ─────────────────────────────────────────────────────────
 *
 *   Panel: full container width, 2–4 column grid of child links.
 *   density="compact"      → 8px vertical padding per link row
 *   density="comfortable"  → 12px vertical padding per link row
 *   emphasis="text"        → plain label text, subdued colour
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
 *   NavMega renders nothing on mobile — the parent NavBar always mounts
 *   MobileNav alongside whichever desktop variant is active.
 *
 * ─── Hover reliability fix ────────────────────────────────────────────────────
 *
 *   The panel is `position: absolute`, so it does not extend the wrapper div's
 *   bounding box.  Two complementary fixes keep the menu open while the cursor
 *   travels from trigger to panel:
 *
 *   1. Hover bridge  — an invisible `aria-hidden` div covers the `mt-px` (1 px)
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

export interface NavMegaProps {
  items:   NavigationItemData[];
  density: "compact" | "comfortable";
}

// ── Mega item ─────────────────────────────────────────────────────────────────

interface MegaItemProps {
  item:    NavigationItemData;
  density: "compact" | "comfortable";
}

function MegaItem({ item, density }: MegaItemProps) {
  const {
    open,
    setOpen,
    triggerRef,
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handleKeyDown,
  } = useMenuState();

  const linkPy  = density === "compact" ? "py-2"   : "py-2.5";
  const childPy = density === "compact" ? "py-1.5" : "py-2";

  const hasChildren = Boolean(item.children?.length);

  const navLinkStyle: React.CSSProperties = {
    fontSize:      "var(--nav-link-size, 0.875rem)",
    fontWeight:    "var(--nav-link-weight, 500)",
    letterSpacing: "var(--nav-link-tracking, normal)",
  };

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        style={navLinkStyle}
        className={cn(
          "inline-flex items-center rounded-md px-3",
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
        {/* Parent page link — navigates; does NOT toggle the mega panel */}
        <Link
          href={item.href}
          style={navLinkStyle}
          className={cn(
            "inline-flex items-center rounded-l-md px-3",
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
            "inline-flex items-center rounded-r-md pl-0.5 pr-2",
            linkPy,
            "text-[var(--nav-link,var(--header-fg,var(--text)))]",
            "hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150",
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
           * Hover bridge — invisible element that covers the mt-px (1 px) gap
           * between the bottom of the trigger button and the top of the mega
           * panel.  Height (4 px) intentionally exceeds the gap to provide a
           * small overlap with the panel.  While the cursor is here it is still
           * inside a descendant of the wrapper, so `mouseleave` does not fire.
           */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-full z-40 h-1 w-full"
          />

          {/* Mega panel — full-width column grid */}
          <div
            role="menu"
            // Positioned relative to the sticky header — the panel stretches from
            // left-0 so it aligns with the container start.
            className={cn(
              "absolute left-0 top-full z-50 mt-px",
              "w-[480px] max-w-[90vw]",
              "rounded-lg border border-[var(--nav-dropdown-border,var(--border))] bg-[var(--nav-dropdown-bg,var(--bg,#ffffff))] shadow-lg",
              "p-4",
            )}
          >
            {/* Column grid — adapts column count to child quantity */}
            <div
              className="grid gap-x-6 gap-y-0.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Math.ceil(item.children!.length / 4), 3)}, 1fr)`,
              }}
            >
              {item.children!.map((child) => (
                <Link
                  key={child.id}
                  href={child.href}
                  role="menuitem"
                  style={{ fontSize: "var(--nav-dropdown-item-size, 0.875rem)" }}
                  className={cn(
                    "block rounded-md px-3",
                    childPy,
                    "font-medium text-[var(--nav-dropdown-text,var(--text-muted))]",
                    "hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]",
                    "transition-colors duration-100",
                  )}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── NavMega ───────────────────────────────────────────────────────────────────

/**
 * Desktop mega-menu navigation.
 * Returns null when items is empty.
 * Renders only in the md+ breakpoint — hidden on mobile.
 */
export function NavMega({ items, density }: NavMegaProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
      {items.map((item) => (
        <MegaItem key={item.id} item={item} density={density} />
      ))}
    </nav>
  );
}
