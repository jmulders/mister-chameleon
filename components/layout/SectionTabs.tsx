"use client";

/**
 * SectionTabs
 *
 * Renders the slim top band of the header_triband layout.
 *
 * Left side:  tab links to major site sections (e.g. "Website", "Werken bij")
 * Right side: quick links / utility links (e.g. "Support", "Login")
 *
 * Active tab is detected by matching each tab's href against the current
 * pathname (usePathname).  A tab is "active" when the pathname starts with
 * the tab href (or equals "/" for the root tab).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SectionTabData } from "@/cms/types";
import type { NavigationItemData } from "@/cms/types";

interface SectionTabsProps {
  tabs:        SectionTabData[];
  quickLinks?: NavigationItemData[];
}

export function SectionTabs({ tabs, quickLinks = [] }: SectionTabsProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div
      className="flex items-center justify-between text-sm"
      style={{ minHeight: "2rem" }}
    >
      {/* ── Section tabs — left ─────────────────────────────────────── */}
      <nav aria-label="Site sections" className="flex items-center">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              target={tab.openInNewTab ? "_blank" : undefined}
              rel={tab.openInNewTab ? "noopener noreferrer" : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3 py-1.5 font-medium transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm",
                active
                  ? [
                      "text-[var(--primary,var(--text-brand))]",
                      // Active underline tab indicator
                      "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
                      "after:rounded-full after:bg-[var(--primary)]",
                    ]
                  : [
                      "text-[var(--nav-link,var(--header-fg,var(--text)))]",
                      "hover:text-[var(--nav-link-hover,var(--text-brand))]",
                    ],
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Quick links — right ─────────────────────────────────────── */}
      {quickLinks.length > 0 && (
        <nav aria-label="Quick links" className="flex items-center gap-0.5">
          {quickLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              target={link.openInNewTab ? "_blank" : undefined}
              rel={link.openInNewTab ? "noopener noreferrer" : undefined}
              className={cn(
                "rounded px-2.5 py-1 transition-colors duration-150",
                "text-[var(--nav-link,var(--header-fg,var(--text)))] hover:text-[var(--nav-link-hover,var(--text-brand))]",
                // Preset-driven subtle hover pill. --nav-dropdown-link-hover-bg is
                // pinned dark by the base theme (Layer A), so use --primary-subtle
                // directly, which follows the preset primary (light tint on light
                // presets, dark tint on dark presets).
                "hover:bg-[var(--primary-subtle)]",
                "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
