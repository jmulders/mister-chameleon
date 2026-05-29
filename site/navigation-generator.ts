/**
 * site/navigation-generator.ts
 *
 * Derives a flat list of top-level navigation items from a blueprint's pages.
 *
 * ─── Generation rules ─────────────────────────────────────────────────────────
 *
 *   - The homepage ("/") is always excluded from the nav bar (it is the logo
 *     destination, not a labelled link).
 *   - Pages are ordered by their position in the blueprint.pages array.
 *   - Each page's slug is turned into a root-relative href ("/pricing").
 *   - The label defaults to the page title; callers may override it.
 *   - A two-level dropdown structure is supported by passing children —
 *     but by default, blueprint pages produce flat top-level items only.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { generateNavItems } from "@/site/navigation-generator";
 *
 *   const items = generateNavItems(blueprint.pages);
 *   // → [{ label: "Pricing", href: "/pricing", order: 0 }, ...]
 */

import type { BlueprintPage } from "@/blueprints/blueprint-types";

// ── Output type ───────────────────────────────────────────────────────────────

export interface GeneratedNavItem {
  label:    string;
  href:     string;
  order:    number;
  children: GeneratedNavItem[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a flat list of top-level navigation items from blueprint pages.
 *
 * The homepage slug ("/") is excluded.  Items are ordered by their position
 * in the blueprint.pages array, starting at order=0.
 */
export function generateNavItems(pages: BlueprintPage[]): GeneratedNavItem[] {
  const items: GeneratedNavItem[] = [];
  let order = 0;

  for (const page of pages) {
    // Skip the homepage — it is the logo link, not a labelled nav entry.
    if (page.slug === "/" || page.slug === "") continue;

    const href = page.slug.startsWith("/") ? page.slug : `/${page.slug}`;

    items.push({
      label:    page.title,
      href,
      order:    order++,
      children: [],
    });
  }

  return items;
}
