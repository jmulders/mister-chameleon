"use client";

/**
 * TriBandNav
 *
 * Client component used in band 3 of the header_triband layout.
 *
 * It listens to the current pathname (usePathname) and derives which section
 * tab is active — then swaps the main-nav items for the nav tree that belongs
 * to that section.  This happens on every SPA navigation without a round-trip
 * to the server.
 *
 * The server (Header.tsx) pre-fetches ALL per-section nav trees and passes
 * them here as `navsByHandle`.  The client just picks the right one.
 *
 * Fallback chain:
 *   1. Tab is active  →  navsByHandle[tab.navHandle]  (if handle is set and tree was found)
 *   2. No custom handle / handle not found  →  defaultNav
 *   3. No active tab  →  defaultNav
 */

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "./NavBar";
import type { NavVariant, NavDensity } from "./NavBar";
import type { NavigationItemData, SectionTabData } from "@/cms/types";

interface TriBandNavProps {
  /** The configured section tabs (same list as rendered in band 1). */
  tabs:          SectionTabData[];
  /**
   * Pre-fetched nav trees keyed by Statamic navigation handle.
   * Tabs without a custom handle (or whose handle was not found) fall back to
   * `defaultNav`.
   */
  navsByHandle:  Record<string, NavigationItemData[]>;
  /** Default nav tree — used when no per-section tree matches. */
  defaultNav:    NavigationItemData[];
  navVariant?:   NavVariant;
  navDensity?:   NavDensity;
  navFamily?:    string | null;
  /** Passed through to NavBar to control desktop / mobile rendering split. */
  mode?:         "all" | "desktop-only" | "mobile-only";
}

/** Determine which section tab is active for the given pathname. */
function findActiveTab(
  tabs: SectionTabData[],
  pathname: string,
): SectionTabData | undefined {
  // Sort by descending href length so more-specific paths win over "/".
  const sorted = [...tabs].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((tab) => {
    if (tab.href === "/") return pathname === "/";
    return pathname.startsWith(tab.href);
  });
}

export function TriBandNav({
  tabs,
  navsByHandle,
  defaultNav,
  navVariant,
  navDensity,
  navFamily,
  mode,
}: TriBandNavProps) {
  const pathname = usePathname();

  const navItems = useMemo<NavigationItemData[]>(() => {
    const activeTab = findActiveTab(tabs, pathname);
    if (!activeTab) return defaultNav;

    const handle = activeTab.navHandle;
    if (handle && navsByHandle[handle] && navsByHandle[handle].length > 0) {
      return navsByHandle[handle];
    }
    return defaultNav;
  }, [tabs, navsByHandle, defaultNav, pathname]);

  return (
    <NavBar
      items={navItems}
      navVariant={navVariant}
      navDensity={navDensity}
      navFamily={navFamily}
      mode={mode}
    />
  );
}
