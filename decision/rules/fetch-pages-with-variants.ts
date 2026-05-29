/**
 * fetchPagesWithVariants
 *
 * Returns the per-page context-slot variant assignments for all published pages
 * belonging to a tenant.  Used by the Variant Assignments admin page to build
 * the "which page uses which variant key" overview.
 *
 * ─── Provider strategy ───────────────────────────────────────────────────────
 *
 *   1. Sanity (primary, if SANITY_PROJECT_ID is configured)
 *      Queries the Sanity dataset directly for fresh data.  The projection
 *      fetches only the fields needed for the overview — no full page render.
 *
 *   2. Platform DB fallback (Storyblok, Statamic, or Sanity query failure)
 *      Reads from the platform's own `pages` table via getPagesByTenant().
 *      The DB reflects what was synced at provision time and may lag behind
 *      CMS edits made directly in the CMS without a subsequent sync.
 *
 * ─── Returned fields ─────────────────────────────────────────────────────────
 *
 *   id     — stable document / row identifier
 *   slug   — URL slug (without leading slash)
 *   title  — human-readable page title
 *   hero   — fallbackVariantKey for the hero context slot, or null
 *   proof  — fallbackVariantKey for the proof context slot, or null
 *   cta    — fallbackVariantKey for the CTA context slot, or null
 *   source — "sanity" or "db", indicating where the data was read from
 */

import "server-only";

import { createSanityClient, SANITY_CACHE_TAG } from "@/cms/providers/sanity-client";
import { serverEnv }        from "@/lib/env";
import { logger }           from "@/lib/logger";
import { getPagesByTenant } from "@/page-store";

// ── Public type ───────────────────────────────────────────────────────────────

export interface PageVariantInfo {
  id:     string;
  slug:   string;
  title:  string;
  hero:   string | null;
  proof:  string | null;
  cta:    string | null;
  /** Whether the data came from the CMS directly ("sanity") or the platform DB ("db"). */
  source: "sanity" | "db";
}

// ── Sanity query ──────────────────────────────────────────────────────────────

/**
 * Lightweight projection — fetches only the fields needed for the variant
 * assignments overview.  No sections, no SEO, no metadata.
 */
/**
 * Only canonical (non-locale-variant) documents are included.
 * Locale variants (NL, DE, …) share the same slug and contextConfig as the
 * default document — including them would produce duplicate slug rows in the
 * overview.  `!defined(locale)` excludes any document that carries an explicit
 * locale field (the pattern used for translated page variants in this dataset).
 */
const ALL_PAGES_VARIANTS_QUERY = `
*[
  _type == "page"
  && isPublished == true
  && tenantId == $tenantId
  && !defined(locale)
] | order(slug.current asc) {
  _id,
  title,
  "slug": slug.current,
  contextConfig {
    hero  { fallbackVariantKey },
    proof { fallbackVariantKey },
    cta   { fallbackVariantKey }
  }
}
`;

interface SanityPageVariantRow {
  _id:   string;
  title: string;
  slug:  string;
  contextConfig?: {
    hero?:  { fallbackVariantKey?: string | null };
    proof?: { fallbackVariantKey?: string | null };
    cta?:   { fallbackVariantKey?: string | null };
  } | null;
}

// ── fetchPagesWithVariants ────────────────────────────────────────────────────

/**
 * Fetch all published pages for the given tenant and return their
 * context-slot variant key assignments.
 *
 * @param tenantId  Active tenant slug (e.g. "mister-chameleon").
 */
export async function fetchPagesWithVariants(
  tenantId: string,
): Promise<PageVariantInfo[]> {
  // ── Path 1: Sanity ──────────────────────────────────────────────────────────
  if (serverEnv.sanity.projectId) {
    try {
      const client = createSanityClient();
      const rows   = await client.fetch<SanityPageVariantRow[]>(
        ALL_PAGES_VARIANTS_QUERY,
        { tenantId },
        {
          next: {
            revalidate: 60,
            tags:       [SANITY_CACHE_TAG],
          },
        },
      );
      // Deduplicate by slug — safety net in case the dataset has locale variants
      // that slipped through the !defined(locale) filter (e.g. locale: null).
      const seen = new Set<string>();
      return rows
        .filter((row) => {
          const slug = row.slug ?? "";
          if (seen.has(slug)) return false;
          seen.add(slug);
          return true;
        })
        .map((row): PageVariantInfo => ({
          id:    row._id,
          slug:  row.slug ?? "",
          title: row.title ?? row.slug ?? row._id,
          hero:  row.contextConfig?.hero?.fallbackVariantKey  ?? null,
          proof: row.contextConfig?.proof?.fallbackVariantKey ?? null,
          cta:   row.contextConfig?.cta?.fallbackVariantKey   ?? null,
          source: "sanity",
        }));
    } catch (err) {
      logger.warn(
        "[fetchPagesWithVariants] Sanity query failed; falling back to platform DB.",
        { error: String(err) },
      );
    }
  }

  // ── Path 2: Platform DB (Storyblok, Statamic, or Sanity fallback) ───────────
  const allPages = await getPagesByTenant(tenantId);
  // Deduplicate by slug — locale variants in the DB share slugs.
  const dbSeen = new Set<string>();
  const pages  = allPages.filter((p) => {
    if (dbSeen.has(p.slug)) return false;
    dbSeen.add(p.slug);
    return true;
  });
  return pages.map((page): PageVariantInfo => ({
    id:    page.id,
    slug:  page.slug,
    title: page.title,
    hero:  page.contextSlots.find((s) => s.slotId === "hero")?.variantKey  ?? null,
    proof: page.contextSlots.find((s) => s.slotId === "proof")?.variantKey ?? null,
    cta:   page.contextSlots.find((s) => s.slotId === "cta")?.variantKey   ?? null,
    source: "db",
  }));
}
