/**
 * demo/image-provider.ts
 *
 * Curated image selection for prospect demos.
 * Server only.
 *
 * Strategy:
 *   1. If UNSPLASH_ACCESS_KEY is set → query the Unsplash API for relevant images.
 *   2. Otherwise → use curated Unsplash photo IDs that are stable and beautiful.
 *
 * All Unsplash images are served via the CDN: https://images.unsplash.com/
 * Attribution is displayed in the demo footer per Unsplash guidelines.
 */

import type { SiteCategory, DemoImages } from "./types";

// ── Curated fallback photo IDs ─────────────────────────────────────────────────
//
// These are hand-picked Unsplash photos that work well for each industry/section.
// They load without an API key via: https://images.unsplash.com/{photo-id}?...

const CURATED: Record<SiteCategory, { hero: string; services: string; cases: string }> = {
  b2b_saas: {
    hero:     "photo-1522071820081-009f0129c71c",   // team collaborating at laptops
    services: "photo-1551288049-bebda4e38f71",      // tech dashboard / analytics
    cases:    "photo-1552664730-d307ca884978",      // successful team meeting
  },
  agency: {
    hero:     "photo-1561070791-2526d30994b5",      // creative design studio
    services: "photo-1542744094-3a31f272c490",      // presentation / strategy
    cases:    "photo-1558655146-9f40138edfeb",      // portfolio / brand work
  },
  ecommerce: {
    hero:     "photo-1607082349566-187342175e2f",   // product lifestyle flatlay
    services: "photo-1441986300917-64674bd600d8",   // shopping / retail
    cases:    "photo-1556742049-0cfed4f6a45d",      // happy customer experience
  },
  recruitment: {
    hero:     "photo-1507679799987-c73779587ccf",   // confident professional
    services: "photo-1573497019940-1c28c88b4f3e",   // interview / hiring
    cases:    "photo-1521737604082-b6b32d5e7996",   // successful team
  },
  general: {
    hero:     "photo-1497366216548-37526070297c",   // modern office
    services: "photo-1486312338219-ce68d2c6f44d",   // professional work
    cases:    "photo-1573167243872-43c6433b9d40",   // handshake / partnership
  },
};

const UNSPLASH_CDN = "https://images.unsplash.com";

function curatedUrl(photoId: string, width: number, height: number): string {
  return `${UNSPLASH_CDN}/${photoId}?w=${width}&h=${height}&q=80&auto=format&fit=crop`;
}

// ── Unsplash API search (optional) ────────────────────────────────────────────

const SEARCH_QUERIES: Record<SiteCategory, { hero: string; services: string; cases: string }> = {
  b2b_saas:    { hero: "software team modern office",       services: "technology dashboard",       cases: "business success team" },
  agency:      { hero: "creative design studio agency",     services: "branding creative work",     cases: "portfolio presentation" },
  ecommerce:   { hero: "product photography lifestyle",     services: "shopping retail store",      cases: "happy customer review" },
  recruitment: { hero: "professional career business",      services: "job interview hiring",       cases: "successful team hired" },
  general:     { hero: "professional business team office", services: "collaboration meeting work", cases: "business partnership" },
};

async function searchUnsplash(query: string, width: number, height: number): Promise<string | null> {
  const key = process.env["UNSPLASH_ACCESS_KEY"];
  if (!key) return null;

  try {
    const resp = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" },
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { urls?: { regular?: string } };
    const url  = data?.urls?.regular;
    if (!url) return null;
    return `${url}&w=${width}&h=${height}&fit=crop`;
  } catch {
    return null;
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Select curated images for a demo based on site category.
 * Tries the Unsplash API first; falls back to curated photo IDs.
 */
export async function getDemoImages(category: SiteCategory): Promise<DemoImages> {
  const c       = CURATED[category] ?? CURATED.general;
  const queries = SEARCH_QUERIES[category] ?? SEARCH_QUERIES.general;

  // Try Unsplash API for the hero (most impactful)
  const heroFromApi = await searchUnsplash(queries.hero, 1400, 800);

  return {
    hero:     heroFromApi ?? curatedUrl(c.hero,     1400, 800),
    services: curatedUrl(c.services, 800,  500),
    cases:    curatedUrl(c.cases,    800,  500),
  };
}

/** Return just the hero image URL (lightweight, no services/cases needed). */
export function getHeroImageUrl(category: SiteCategory): string {
  const c = CURATED[category] ?? CURATED.general;
  return curatedUrl(c.hero, 1400, 800);
}
