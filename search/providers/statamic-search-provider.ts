/**
 * StatamicSearchProvider
 *
 * A SearchProvider implementation that reads content directly from Statamic
 * CMS files on disk (the same path used by StatamicClient when
 * STATAMIC_CMS_PATH is set).
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   On each search() call the provider scans the configured collections,
 *   parses YAML frontmatter from each .md file, and performs in-memory
 *   full-text scoring against the query terms.
 *
 *   This is intentionally simple: no index, no cache.  For sites with
 *   hundreds of entries the latency is acceptable (<50 ms in practice).
 *   When the corpus grows to thousands of entries, swap in Meilisearch.
 *
 * ─── Which collections are searched ──────────────────────────────────────────
 *
 *   Configured in the CMS via the "Search Settings" global
 *   (content/globals/{locale}/search_settings.yaml → searchable_collections).
 *   Content editors manage this in the Statamic CP under Globals.
 *
 *   When the global is absent or empty, the provider falls back to the
 *   built-in defaults: pages, blog, vacancies.
 *
 * ─── Collection → Next.js route mapping ──────────────────────────────────────
 *
 *   The URL prefix for each collection is derived from its `route` setting in
 *   content/collections/{handle}.yaml — static segments are kept, placeholder
 *   segments ({slug}, {parent_uri}) are dropped:
 *
 *     '{parent_uri}/{slug}'  →  /{slug}            (pages — root)
 *     'blog/{slug}'          →  /blog/{slug}
 *     'cases/{slug}'         →  /cases/{slug}
 *
 *   The slug is derived from the filename (without the .md extension).
 *
 * ─── Scope mapping ────────────────────────────────────────────────────────────
 *
 *   blog      → scope "posts",     result type "post"
 *   vacancies → scope "vacancies", result type "vacancy"
 *   all other → scope "pages",     result type "page"
 *               (extra collections appear under the "Pagina's" filter)
 *
 * ─── Locale ───────────────────────────────────────────────────────────────────
 *
 *   Files are read from the `locale` subdirectory (default "nl").
 *   Pass `locale` to the constructor to search a different site locale.
 */

import * as fs   from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import type {
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchScope,
  SearchHighlight,
} from "@/search";

// ── Collection config ─────────────────────────────────────────────────────────

interface CollectionConfig {
  /** Directory name under content/collections/ */
  dir:         string;
  /** SearchScope that maps to this collection */
  scope:       SearchScope;
  /** SearchResult.type value */
  type:        "page" | "post" | "vacancy";
  /**
   * URL prefix for building the result slug.
   *   pages     → "" (root: /{slug})
   *   blog      → "blog"
   *   vacancies → "vacancies"
   */
  urlPrefix:   string;
  /** Human-readable collection title from the collection YAML (e.g. "Case Studies"). */
  label:       string;
}

/**
 * Built-in defaults — used when the CMS "Search Settings" global is absent
 * or does not list any collections.
 */
const DEFAULT_COLLECTIONS: CollectionConfig[] = [
  { dir: "pages",     scope: "pages",     type: "page",    urlPrefix: "",          label: "Pagina's"  },
  { dir: "blog",      scope: "posts",     type: "post",    urlPrefix: "blog",      label: "Artikelen" },
  { dir: "vacancies", scope: "vacancies", type: "vacancy", urlPrefix: "vacancies", label: "Vacatures" },
];

/**
 * Map a collection handle to its SearchScope + result type.
 * Unknown collections fall under the "pages" scope so they remain
 * visible with the existing three-scope filter UI.
 */
function scopeForHandle(handle: string): Pick<CollectionConfig, "scope" | "type"> {
  if (handle === "blog")      return { scope: "posts",     type: "post"    };
  if (handle === "vacancies") return { scope: "vacancies", type: "vacancy" };
  return { scope: "pages", type: "page" };
}

// ── Frontmatter type ──────────────────────────────────────────────────────────

interface EntryFrontmatter {
  id?:              string;
  title?:           string;
  excerpt?:         string;
  seo_description?: string;
  /** publish = true (default); draft = true means unpublished */
  published?:       boolean;
}

// ── Highlight helper ──────────────────────────────────────────────────────────

function buildHighlight(text: string, terms: string[]): SearchHighlight | null {
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return null;

  // Extract a ~200-char window centred on the first match
  const start   = Math.max(0, bestIdx - 60);
  const end     = Math.min(text.length, bestIdx + 140);
  let snippet   = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");

  // Wrap matched terms in <mark>
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    snippet = snippet.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
  }

  return { field: "excerpt", snippet };
}

// ── Score helper (same algorithm as InMemorySearchProvider) ──────────────────

function scoreEntry(
  title:   string,
  excerpt: string,
  terms:   string[],
): number {
  let score = 0;
  const tLower = title.toLowerCase();
  const eLower = excerpt.toLowerCase();
  for (const term of terms) {
    const t = term.toLowerCase();
    if (tLower.includes(t))   score += 0.6;
    if (eLower.includes(t))   score += 0.3;
  }
  return score;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class StatamicSearchProvider implements SearchProvider {
  private readonly cmsRoot: string;
  private readonly locale:  string;

  constructor(cmsRoot: string, locale = "nl") {
    // Resolve relative paths (e.g. "./mister-chameleon-cms") against cwd,
    // matching the same behaviour as StatamicClient.
    this.cmsRoot = path.resolve(process.cwd(), cmsRoot);
    this.locale  = locale;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const terms = query.query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (terms.length === 0) {
      return { query, results: [], total: 0, hasMore: false };
    }

    const requestedScopes: readonly SearchScope[] =
      query.scopes && query.scopes.length > 0
        ? query.scopes
        : (["pages", "posts", "vacancies"] as SearchScope[]);

    const scored: Array<{ result: SearchResult; score: number }> = [];

    for (const entry of collectStatamicSearchEntries(this.cmsRoot, this.locale)) {
      if (!requestedScopes.includes(entry.scope)) continue;

      const score = scoreEntry(entry.title, entry.excerpt, terms);
      if (score === 0) continue;

      const highlights: SearchHighlight[] = [];
      const excHighlight = buildHighlight(entry.excerpt || entry.title, terms);
      if (excHighlight) highlights.push(excHighlight);

      scored.push({
        score,
        result: {
          id:              entry.id,
          type:            entry.type,
          title:           entry.title,
          slug:            entry.url,
          excerpt:         entry.excerpt || undefined,
          highlights:      highlights.length ? highlights : undefined,
          collection:      entry.collection,
          collectionLabel: entry.collectionLabel,
        },
      });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const total   = scored.length;
    const offset  = query.offset ?? 0;
    const limit   = query.limit  ?? 20;
    const results = scored
      .slice(offset, offset + limit)
      .map((s) => s.result);

    return {
      query,
      results,
      total,
      hasMore: offset + results.length < total,
    };
  }

  async suggest(): Promise<import("@/search").SearchSuggestion[]> {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared corpus walker — used by search() above AND the Meilisearch indexer
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A single searchable entry collected from the Statamic flat files.
 * Shared shape between the FS provider (scores these in-memory) and the
 * Meilisearch indexer (pushes these as IndexedDocuments).
 */
export interface StatamicSearchEntry {
  readonly id:      string;
  readonly type:    "page" | "post" | "vacancy";
  readonly scope:   SearchScope;
  readonly title:   string;
  /** Root-relative URL of the detail page, e.g. "/blog/my-post". */
  readonly url:     string;
  readonly excerpt: string;
  /** Source collection handle, e.g. "case_studies". */
  readonly collection:      string;
  /** Collection title from the collection YAML, e.g. "Case Studies". */
  readonly collectionLabel: string;
}

/**
 * Collect all published, searchable entries from the Statamic content files.
 *
 * Which collections are scanned is controlled by the CMS "Search Settings"
 * global (searchable_collections); falls back to DEFAULT_COLLECTIONS.
 * Unpublished entries (published: false) and the special "home" page are
 * skipped.
 *
 * @param cmsRoot  Statamic root (absolute, or relative to cwd — same contract
 *                 as the StatamicSearchProvider constructor).
 * @param locale   Site locale subdirectory to read (default "nl").
 */
export function collectStatamicSearchEntries(
  cmsRoot: string,
  locale = "nl",
): StatamicSearchEntry[] {
  const root    = path.resolve(process.cwd(), cmsRoot);
  const entries: StatamicSearchEntry[] = [];

  for (const col of resolveCollections(root, locale)) {
    const colDir = path.join(root, "content", "collections", col.dir, locale);

    let files: string[];
    try {
      files = fs.readdirSync(colDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue; // collection directory doesn't exist yet
    }

    for (const file of files) {
      const slug = file.replace(/\.md$/, "");

      // Skip the special "home" page
      if (slug === "home" && col.dir === "pages") continue;

      const url = col.urlPrefix ? `/${col.urlPrefix}/${slug}` : `/${slug}`;

      let fm: EntryFrontmatter;
      try {
        const raw     = fs.readFileSync(path.join(colDir, file), "utf8");
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) continue;
        fm = (parseYaml(fmMatch[1]) as EntryFrontmatter) ?? {};
      } catch {
        continue;
      }

      // Skip unpublished entries (published: false)
      if (fm.published === false) continue;

      entries.push({
        id:              fm.id ?? `${col.dir}/${slug}`,
        type:            col.type,
        scope:           col.scope,
        title:           fm.title?.trim() || slug,
        url,
        excerpt:         (fm.excerpt ?? fm.seo_description ?? "").trim(),
        collection:      col.dir,
        collectionLabel: col.label,
      });
    }
  }

  return entries;
}

// ── CMS-configured searchable collections ────────────────────────────────────

/**
 * Resolve the list of collections to search.
 *
 * Reads the `searchable_collections` field from the CMS "Search Settings"
 * global.  Each handle becomes a CollectionConfig with its URL prefix
 * derived from the collection's `route` setting.  Falls back to
 * DEFAULT_COLLECTIONS when the global is absent, unreadable, or empty —
 * so existing sites keep working without the global.
 */
function resolveCollections(cmsRoot: string, locale: string): CollectionConfig[] {
  const handles = readSearchableHandles(cmsRoot, locale);
  if (!handles) return DEFAULT_COLLECTIONS;

  return handles.map((handle): CollectionConfig => ({
    dir: handle,
    ...readCollectionMeta(cmsRoot, handle),
    ...scopeForHandle(handle),
  }));
}

/**
 * Read `searchable_collections` from the Search Settings global.
 *
 * Statamic multisite stores global values per locale
 * (content/globals/{locale}/search_settings.yaml, values at top level);
 * single-site stores them in the container under a `data:` key
 * (content/globals/search_settings.yaml).  Both locations are checked,
 * locale first.
 *
 * @returns Non-empty list of collection handles, or null → use defaults.
 */
function readSearchableHandles(cmsRoot: string, locale: string): string[] | null {
  const candidates = [
    path.join(cmsRoot, "content", "globals", locale, "search_settings.yaml"),
    path.join(cmsRoot, "content", "globals", "search_settings.yaml"),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const yaml = (parseYaml(fs.readFileSync(file, "utf8")) as Record<string, unknown>) ?? {};
      // Single-site containers nest values under `data:`; multisite locale
      // files store them at the top level.
      const data = (typeof yaml["data"] === "object" && yaml["data"] !== null)
        ? (yaml["data"] as Record<string, unknown>)
        : yaml;

      const list = data["searchable_collections"];
      if (Array.isArray(list)) {
        const handles = list.filter(
          (h): h is string => typeof h === "string" && h.trim() !== "",
        );
        if (handles.length > 0) return handles;
      }
    } catch {
      // Unreadable file — try the next candidate.
    }
  }
  return null;
}

/**
 * Read URL prefix + display label for a collection from
 * content/collections/{handle}.yaml.
 *
 * URL prefix is derived from the `route` setting — static segments are kept,
 * placeholder segments ({slug}, {parent_uri}, …) are dropped:
 *
 *   '{parent_uri}/{slug}' → ""        (root-level pages)
 *   'blog/{slug}'         → "blog"
 *   'cases/{slug}'        → "cases"
 *
 * Label comes from the collection's `title` (e.g. "Case Studies").
 * Falls back to the handle when the collection config is missing.
 */
function readCollectionMeta(
  cmsRoot: string,
  handle: string,
): { urlPrefix: string; label: string } {
  let urlPrefix = handle === "pages" ? "" : handle;
  let label     = handle;

  try {
    const file = path.join(cmsRoot, "content", "collections", `${handle}.yaml`);
    const yaml = (parseYaml(fs.readFileSync(file, "utf8")) as Record<string, unknown>) ?? {};

    const route = typeof yaml["route"] === "string" ? yaml["route"] : "";
    if (route) {
      urlPrefix = route
        .split("/")
        .filter((seg) => seg && !seg.includes("{"))
        .join("/");
    }

    if (typeof yaml["title"] === "string" && yaml["title"].trim()) {
      label = yaml["title"].trim();
    }
  } catch {
    // Missing/unreadable collection config — keep fallbacks.
  }

  return { urlPrefix, label };
}
