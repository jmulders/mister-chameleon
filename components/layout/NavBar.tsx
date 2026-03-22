"use client";

/**
 * NavBar
 *
 * Client component that renders the site's primary navigation bar.
 * Receives pre-resolved NavigationItemData from the server (via Header),
 * so it has no CMS dependency — it only owns interactivity.
 *
 * ─── Desktop ──────────────────────────────────────────────────────────────────
 *
 *   Top-level items are rendered as a horizontal row.
 *   Items with children show a chevron and reveal a dropdown panel on hover.
 *   The dropdown stays open while the cursor is over the trigger or the panel.
 *   Keyboard users can open/close with Enter/Space and dismiss with Escape.
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *
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
 *   items  NavigationItemData[]  Resolved nav items from CMS site settings.
 */

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { NavigationItemData } from "@/cms/types";

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavBarProps {
  items: NavigationItemData[];
}

// ── Desktop dropdown item ─────────────────────────────────────────────────────

interface DesktopDropdownProps {
  item: NavigationItemData;
}

function DesktopDropdownItem({ item }: DesktopDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        ref={triggerRef}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-2",
          "text-sm font-medium text-neutral-600",
          "hover:bg-neutral-100 hover:text-neutral-900",
          "transition-colors duration-150 focus-visible:outline-2",
          "focus-visible:outline-brand-500 focus-visible:outline-offset-2",
        )}
      >
        {item.label}
        <ChevronDown
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 top-full z-50 mt-1",
            "min-w-48 rounded-lg border border-neutral-200",
            "bg-white py-1 shadow-lg",
          )}
        >
          {item.children!.map((child) => (
            <a
              key={child.id}
              href={child.href}
              role="menuitem"
              className={cn(
                "block px-4 py-2",
                "text-sm text-neutral-700",
                "hover:bg-neutral-50 hover:text-neutral-900",
                "transition-colors duration-100",
              )}
            >
              {child.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Desktop nav ───────────────────────────────────────────────────────────────

function DesktopNav({ items }: { items: NavigationItemData[] }) {
  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const hasChildren = item.children && item.children.length > 0;

        if (hasChildren) {
          return <DesktopDropdownItem key={item.id} item={item} />;
        }

        return (
          <a
            key={item.id}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2",
              "text-sm font-medium text-neutral-600",
              "hover:bg-neutral-100 hover:text-neutral-900",
              "transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
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
          "rounded-md p-2 text-neutral-600",
          "hover:bg-neutral-100 hover:text-neutral-900",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2",
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
            "absolute inset-x-0 top-16 z-40",
            "border-b border-neutral-200 bg-white shadow-lg",
          )}
        >
          <div className="px-4 py-3 space-y-1">
            {items.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItem === item.id;

              return (
                <div key={item.id}>
                  {hasChildren ? (
                    <>
                      {/* Expandable parent */}
                      <button
                        aria-expanded={isExpanded}
                        onClick={() => toggleItem(item.id)}
                        className={cn(
                          "flex w-full items-center justify-between",
                          "rounded-md px-3 py-2",
                          "text-sm font-medium text-neutral-700",
                          "hover:bg-neutral-100",
                          "transition-colors duration-150",
                        )}
                      >
                        {item.label}
                        <ChevronDown
                          className={cn(
                            "transition-transform duration-150",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>

                      {/* Children */}
                      {isExpanded && (
                        <div className="mt-1 ml-4 space-y-1 border-l border-neutral-200 pl-3">
                          {item.children!.map((child) => (
                            <a
                              key={child.id}
                              href={child.href}
                              onClick={() => setMenuOpen(false)}
                              className={cn(
                                "block rounded-md px-3 py-1.5",
                                "text-sm text-neutral-600",
                                "hover:bg-neutral-50 hover:text-neutral-900",
                                "transition-colors duration-100",
                              )}
                            >
                              {child.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <a
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "block rounded-md px-3 py-2",
                        "text-sm font-medium text-neutral-700",
                        "hover:bg-neutral-100 hover:text-neutral-900",
                        "transition-colors duration-150",
                      )}
                    >
                      {item.label}
                    </a>
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
 * Primary navigation bar. Renders desktop + mobile layouts.
 * Returns null (no DOM output) when items is empty.
 */
export function NavBar({ items }: NavBarProps) {
  if (items.length === 0) return null;

  return (
    <>
      <DesktopNav items={items} />
      <MobileNav items={items} />
    </>
  );
}
