/**
 * Statamic Content REST API Client
 *
 * A thin wrapper around the Statamic Content REST API that participates in
 * Next.js ISR via native `fetch` — no additional npm package required.
 * This mirrors how @sanity/client works under the hood.
 *
 * ─── Statamic Content REST API ────────────────────────────────────────────
 *
 *   Base URL is user-configured, typically: https://cms.example.com
 *   Authentication is optional via a Bearer token in the Authorization header.
 *   Entries are fetched from collection endpoints with optional key filtering.
 *
 *   GET /api/collections/{collection}/entries?filter[key:is]={key}&limit=1
 *   Authorization: Bearer {apiKey}  (only if apiKey is set)
 *
 * ─── ISR / caching ────────────────────────────────────────────────────────
 *
 *   Next.js App Router intercepts native `fetch` calls and extends them with
 *   ISR options. StatamicClient passes `{ next: { revalidate, tags } }` to
 *   every entry fetch so cache invalidation works on-demand via:
 *     revalidateTag(STATAMIC_CACHE_TAG)
 *
 * ─── File-based fallback ──────────────────────────────────────────────────
 *
 *   When STATAMIC_CMS_PATH is set (local dev), the client falls back to
 *   reading the flat YAML files directly from the filesystem when the HTTP
 *   API returns 404 or an unparseable response. This bypasses PHP routing
 *   issues entirely and is always reliable in a local monorepo setup.
 *
 *   Files are read from:
 *     {cmsFsPath}/content/collections/{collection}/{slug}.md
 *
 * ─── Error handling ───────────────────────────────────────────────────────
 *
 *   404 → returns null (or falls back to file if cmsFsPath is set)
 *   Other non-2xx → throws an Error (caught by StatamicProvider.fetchVariant)
 *   File missing → returns null
 *
 * ─── Environment variables ────────────────────────────────────────────────
 *
 *   STATAMIC_API_URL   required  Base URL of Statamic site (no trailing slash)
 *   STATAMIC_API_KEY   optional  Bearer token for protected APIs
 *   STATAMIC_CMS_PATH  optional  Relative path to the CMS root for file fallback
 *                                e.g. "./mister-chameleon-cms"
 */

import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

// ── ISR / caching constants ───────────────────────────────────────────────

/**
 * ISR revalidation window for Statamic content (seconds).
 *
 * Matches STORYBLOK_REVALIDATE_SECONDS and SANITY_REVALIDATE_SECONDS for
 * a consistent caching policy across CMS providers.
 */
export const STATAMIC_REVALIDATE_SECONDS = 60;

/**
 * Default Next.js cache tag applied to all Statamic fetch calls.
 * Use with `revalidateTag(STATAMIC_CACHE_TAG)` for on-demand ISR invalidation
 * from a Statamic webhook route handler.
 */
export const STATAMIC_CACHE_TAG = "statamic" as const;

// ── Response types ────────────────────────────────────────────────────────

/**
 * A Statamic entry from the REST API collection endpoint.
 *
 * TEntry is the entry-specific shape — defined in the cms/queries/statamic/
 * query files (e.g. StatamicHeroEntry). Entries always have id and slug added
 * by the API.
 *
 * The API returns a list of entries, so we extract the first one when present.
 */
export type StatamicEntry<TEntry> = TEntry & {
  id: string;
  slug: string;
};

/**
 * A single item from a Statamic Navigation tree.
 *
 * Returned by StatamicClient.fetchNavTree() for both the file-based reader
 * (local dev) and the HTTP API (production).
 */
export interface StatamicNavTreeItem {
  id:             string;
  title:          string;
  url:            string;
  /** Page excerpt — shown as description in mega menu feature columns */
  excerpt?:       string;
  /** overview_image filename — used to build the card thumbnail URL */
  imageFile?:     string;
  /** Value of the `header_variant` blueprint field, or null when unset. */
  header_variant: string | null;
  /**
   * When false, the mega menu panel for this item's children will not render
   * the card thumbnail even when child pages have an overview_image.
   * Sourced from the `mega_show_image` field in the Statamic nav tree item data.
   * Absent = treat as true (show images by default).
   */
  showMegaImage?: boolean;
  /**
   * When false, the mega menu panel for this item's children will not render
   * the excerpt/description even when child pages have an excerpt.
   * Sourced from the `mega_show_description` field in the Statamic nav tree item data.
   * Absent = treat as true (show descriptions by default).
   */
  showMegaDescription?: boolean;
  /**
   * Nested child items.  Used for multi-level nav trees such as the
   * footer_main navigation where top-level items are column headings and
   * their children are the column links.
   */
  children?:      StatamicNavTreeItem[];
  /**
   * Promotional CTA block for this item's mega menu, parsed from the
   * `mega_cta_*` blueprint fields (position, heading, text, image, link, label).
   * Absent when no CTA position is set.
   */
  megaCta?: {
    position:   "left" | "right" | "bottom";
    heading:    string;
    text?:      string;
    imageFile?: string;
    url:        string;
    label?:     string;
    newTab?:    boolean;
  };
}

/** Wrapper object returned by the GET /api/collections/{collection}/entries endpoint */
interface StatamicListResponse<TEntry> {
  data: TEntry[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

// ── File-based fallback reader ────────────────────────────────────────────

/**
 * Reads Statamic flat-file entries directly from the filesystem.
 *
 * Statamic stores each entry as an .md file with YAML frontmatter:
 *   content/collections/{collection}/{slug}.md
 *
 * This reader is used as a fallback when the HTTP API is unreachable,
 * which is common in local development when PHP routing is misconfigured.
 *
 * @internal  Used only by StatamicClient when cmsFsPath is set.
 */
class StatamicFileReader {
  constructor(private readonly cmsRoot: string) {
    // Log the resolved path at startup so misconfiguration is immediately visible.
    // Check both the legacy flat path and the Statamic v5 multisite locale path.
    const flatPath   = path.join(cmsRoot, "content", "collections", "pages", "home.md");
    const localePath = path.join(cmsRoot, "content", "collections", "pages", "nl", "home.md");
    const exists = fs.existsSync(flatPath) || fs.existsSync(localePath);
    logger.info("[StatamicFileReader] file reader initialised", {
      cmsRoot,
      homeMdExists: exists,
      flatPath,
      localePath,
    });
  }

  /** Path to the flat-file directory for a given collection */
  private collectionDir(collection: string): string {
    return path.join(this.cmsRoot, "content", "collections", collection);
  }

  /**
   * Enumerate all .md files in a collection directory, including locale
   * subdirectories (e.g. nl/, en-gb/).
   *
   * Statamic v5 multisite stores each site's entries under a locale-handle
   * subdirectory:  content/collections/pages/nl/home.md
   * Single-site / legacy installations use the flat layout:
   *                content/collections/pages/home.md
   *
   * This helper transparently supports both layouts so all file-reader methods
   * work correctly in multisite setups without any extra configuration.
   *
   * Returns an array of { filePath, slug } pairs; slug is the filename without
   * the .md extension.  Locale subdirectory files are de-duplicated by slug —
   * the first locale found wins (consistent with `fetchEntryBySlug`'s search
   * order: flat first, then locale subdirs alphabetically).
   */
  private findCollectionFiles(collection: string): Array<{ filePath: string; slug: string }> {
    const dir = this.collectionDir(collection);
    if (!fs.existsSync(dir)) return [];

    const seen = new Set<string>();
    const results: Array<{ filePath: string; slug: string }> = [];

    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const slug = entry.name.replace(/\.md$/, "");
          if (!seen.has(slug)) {
            seen.add(slug);
            results.push({ filePath: path.join(dir, entry.name), slug });
          }
        } else if (entry.isDirectory()) {
          // Locale subdirectory (e.g. nl/, en-gb/)
          const subDir = path.join(dir, entry.name);
          try {
            for (const subEntry of fs.readdirSync(subDir, { withFileTypes: true })) {
              if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
                const slug = subEntry.name.replace(/\.md$/, "");
                if (!seen.has(slug)) {
                  seen.add(slug);
                  results.push({ filePath: path.join(subDir, subEntry.name), slug });
                }
              }
            }
          } catch {
            // Non-fatal — skip unreadable subdirectory
          }
        }
      }
    } catch {
      return [];
    }

    return results;
  }

  /** Parse YAML frontmatter from an .md file, returning the data object or null */
  private parseFile(
    filePath: string,
    slug: string,
  ): Record<string, unknown> | null {
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const data: Record<string, unknown> = (parseYaml(match[1]) as Record<string, unknown>) ?? {};

    // Always inject slug + id so callers get the same shape as the HTTP API
    return {
      ...data,
      slug,
      id: typeof data["id"] === "string" ? data["id"] : slug,
    };
  }

  /** Fetch a single entry by key (looks for key field in frontmatter) */
  async fetchEntry<TEntry>(
    collection: string,
    key: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    // Use findCollectionFiles so locale subdirectories (e.g. nl/) are included.
    for (const { filePath, slug } of this.findCollectionFiles(collection)) {
      const data = this.parseFile(filePath, slug);
      if (!data) continue;
      // Match on 'key' field, or fall back to slug equality
      if (data["key"] === key || slug === key) {
        return data as StatamicEntry<TEntry>;
      }
    }
    return null;
  }

  /** Fetch a single entry by URL slug (filename without .md) */
  async fetchEntryBySlug<TEntry>(
    collection: string,
    slug: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    // Try the flat path first (single-site / legacy layout).
    const flatPath = path.join(this.collectionDir(collection), `${slug}.md`);
    if (fs.existsSync(flatPath)) {
      const data = this.parseFile(flatPath, slug);
      return data ? (data as StatamicEntry<TEntry>) : null;
    }

    // Fall through to locale subdirectories (Statamic v5 multisite layout).
    // e.g. content/collections/pages/nl/home.md
    const match = this.findCollectionFiles(collection).find((f) => f.slug === slug);
    if (match) {
      const data = this.parseFile(match.filePath, slug);
      return data ? (data as StatamicEntry<TEntry>) : null;
    }

    return null;
  }

  /** Fetch all entries in a collection up to limit */
  async fetchAll<TEntry>(
    collection: string,
    limit = 100,
  ): Promise<StatamicEntry<TEntry>[]> {
    // findCollectionFiles includes both flat and locale-subdir files.
    const files = this.findCollectionFiles(collection).slice(0, limit);
    const results: StatamicEntry<TEntry>[] = [];
    for (const { filePath, slug } of files) {
      const data = this.parseFile(filePath, slug);
      if (data) results.push(data as StatamicEntry<TEntry>);
    }
    return results;
  }

  /**
   * Read a Statamic Navigation tree by its handle.
   *
   * Navigation trees are stored at: content/trees/navigation/{handle}.yaml
   * (Statamic v4+ splits metadata from tree; legacy path content/navigation/{handle}.yaml
   *  is also checked as fallback.)
   * Format:
   *   tree:
   *     - id: <uuid>
   *       entry: <entry-id>        ← references a page by its id field
   *       data:
   *         header_variant: mega   ← custom blueprint fields
   *     - id: <uuid>
   *       url: /contact
   *       title: Contact
   *
   * For entry-based items the page collection is scanned to resolve
   * title and uri from the matching .md frontmatter.
   * For url-based items the url and title are used directly.
   *
   * Returns a flat (top-level only) list of nav items.
   */
  async fetchNavTree(handle: string): Promise<StatamicNavTreeItem[]> {
    // Statamic v4+ stores the actual tree in content/trees/navigation/{handle}.yaml
    // while content/navigation/{handle}.yaml holds only metadata (title, collections).
    //
    // In multisite setups Statamic writes the tree under a locale subdirectory:
    //   content/trees/navigation/{locale}/{handle}.yaml
    // We try paths in this order:
    //   1. content/trees/navigation/{handle}.yaml          (flat, non-multisite)
    //   2. content/trees/navigation/*/{handle}.yaml        (multisite locale subdir)
    //   3. content/navigation/{handle}.yaml                (legacy / metadata file)
    const treesDir   = path.join(this.cmsRoot, "content", "trees", "navigation");
    const treesFile  = path.join(treesDir, `${handle}.yaml`);
    const legacyFile = path.join(this.cmsRoot, "content", "navigation", `${handle}.yaml`);

    let navFile = fs.existsSync(treesFile) ? treesFile : null;

    // Check locale subdirectories when the flat path doesn't exist
    if (!navFile && fs.existsSync(treesDir)) {
      try {
        for (const entry of fs.readdirSync(treesDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(treesDir, entry.name, `${handle}.yaml`);
          if (fs.existsSync(candidate)) { navFile = candidate; break; }
        }
      } catch { /* non-fatal */ }
    }

    if (!navFile) navFile = fs.existsSync(legacyFile) ? legacyFile : null;
    if (!navFile) return [];

    try {
      const raw  = fs.readFileSync(navFile, "utf-8");
      const yaml = (parseYaml(raw) as Record<string, unknown>) ?? {};
      const tree = Array.isArray(yaml["tree"]) ? (yaml["tree"] as Record<string, unknown>[]) : [];
      if (tree.length === 0) return [];

      // ── Build id → { title, uri } map from all pages ─────────────────────
      // The nav tree stores entry IDs (the `id:` field in .md frontmatter,
      // NOT the filename).  We need to resolve them to get title and uri.
      // findCollectionFiles includes both flat and locale-subdir entries so
      // this works correctly in Statamic v5 multisite setups.
      const entryMap = new Map<string, { title: string; uri: string; excerpt?: string; imageFile?: string }>();

      for (const { filePath: filePath2, slug } of this.findCollectionFiles("pages")) {
        try {
          const rawMd   = fs.readFileSync(filePath2, "utf-8");
          const matchMd = rawMd.match(/^---\n([\s\S]*?)\n---/);
          if (!matchMd) continue;
          const fmData  = (parseYaml(matchMd[1]) as Record<string, unknown>) ?? {};
          const id      = typeof fmData["id"]    === "string" ? fmData["id"]    : slug;
          const title   = typeof fmData["title"] === "string" ? fmData["title"] : slug;
          const uri     = typeof fmData["uri"]   === "string"
            ? fmData["uri"]
            : slug === "home" ? "/" : `/${slug}`;
          const excerpt = typeof fmData["excerpt"] === "string" && fmData["excerpt"].trim()
            ? fmData["excerpt"].trim()
            : undefined;
          const imageFile = typeof fmData["overview_image"] === "string" && fmData["overview_image"].trim()
            ? fmData["overview_image"].trim()
            : undefined;
          entryMap.set(id, { title, uri, excerpt, imageFile });
        } catch {
          // Non-fatal — skip unreadable page file
        }
      }

      // ── Map tree items → StatamicNavTreeItem ──────────────────────────────
      // Recursive helper so that nested children are also resolved.
      const mapTreeItem = (item: Record<string, unknown>, i: number): StatamicNavTreeItem | null => {
        const entryId  = typeof item["entry"] === "string" ? item["entry"] : null;
        const page     = entryId ? entryMap.get(entryId) : null;
        // Explicit title in the nav item overrides the page title so Dutch nav
        // labels can differ from the underlying page entry title (e.g. "Prijzen"
        // for the entry whose page title is "Pricing").
        const explicitTitle = typeof item["title"] === "string" ? item["title"] : null;
        const title    = explicitTitle ?? page?.title ?? "";
        const url      = page?.uri  ?? (typeof item["url"]   === "string" ? item["url"]   : "#");
        // header_variant can be stored at the top level of the tree item OR inside
        // the item's `data` sub-object (Statamic v4 multisite stores blueprint field
        // values there).  Check both locations; top-level wins if both are set.
        const itemData = typeof item["data"] === "object" && item["data"] !== null
          ? (item["data"] as Record<string, unknown>)
          : {};
        const hv = (
          typeof item["header_variant"] === "string" ? (item["header_variant"] || null) :
          typeof itemData["header_variant"] === "string" ? (itemData["header_variant"] || null) :
          null
        );

        // mega_show_image / mega_show_description — stored in the nav item's data
        // sub-object.  Only propagated when explicitly set (boolean); absent = default.
        const showMegaImage: boolean | undefined =
          typeof itemData["mega_show_image"] === "boolean"
            ? (itemData["mega_show_image"] as boolean)
            : undefined;
        const showMegaDescription: boolean | undefined =
          typeof itemData["mega_show_description"] === "boolean"
            ? (itemData["mega_show_description"] as boolean)
            : undefined;

        // Mega-menu CTA — built from the mega_cta_* fields when a position plus
        // the required heading + url are present. The image field (assets) is an
        // array of filenames (or a bare string); take the first.
        const megaCta = ((): StatamicNavTreeItem["megaCta"] | undefined => {
          const pos = itemData["mega_cta_position"];
          if (pos !== "left" && pos !== "right" && pos !== "bottom") return undefined;
          const str = (k: string) =>
            typeof itemData[k] === "string" && (itemData[k] as string).trim()
              ? (itemData[k] as string).trim() : undefined;
          const heading = str("mega_cta_heading");
          const url     = str("mega_cta_url");
          if (!heading || !url) return undefined;
          const img  = itemData["mega_cta_image"];
          const file = Array.isArray(img) ? img[0] : img;
          return {
            position: pos,
            heading,
            url,
            ...(str("mega_cta_text")  ? { text:  str("mega_cta_text")  } : {}),
            ...(str("mega_cta_label") ? { label: str("mega_cta_label") } : {}),
            ...(typeof file === "string" && file ? { imageFile: file } : {}),
            ...(itemData["mega_cta_new_tab"] === true ? { newTab: true } : {}),
          };
        })();

        if (!title && url === "#") return null; // skip empty items

        const rawChildren = Array.isArray(item["children"]) ? (item["children"] as Record<string, unknown>[]) : [];
        const children = rawChildren
          .map((c, ci) => mapTreeItem(c, ci))
          .filter((x): x is StatamicNavTreeItem => x !== null);

        return {
          id:             entryId ?? String(i),
          title,
          url,
          header_variant: hv,
          ...(page?.excerpt    ? { excerpt:   page.excerpt   } : {}),
          ...(page?.imageFile  ? { imageFile: page.imageFile } : {}),
          ...(showMegaImage !== undefined       ? { showMegaImage }       : {}),
          ...(showMegaDescription !== undefined ? { showMegaDescription } : {}),
          ...(megaCta ? { megaCta } : {}),
          ...(children.length > 0 ? { children }              : {}),
        };
      };

      return tree
        .map((item, i) => mapTreeItem(item, i))
        .filter((x): x is StatamicNavTreeItem => x !== null);
    } catch {
      return [];
    }
  }

  /**
   * Resolve a Statamic link-field value to a plain URL string.
   *
   * Statamic's `link` fieldtype stores one of three shapes:
   *   - Plain URL / anchor  → returned as-is: "https://...", "/path", "#signup"
   *   - Entry reference     → "entry::uuid" — resolved to the entry's URI by
   *                           scanning the pages collection YAML files
   *   - Asset reference     → "asset::container::path" — not useful as an href;
   *                           returned as-is so callers can decide
   *
   * Returns null when the value is null/undefined/empty.
   */
  async resolveLink(value: string | null | undefined): Promise<string | null> {
    if (!value) return null;

    // Plain URL or anchor — return as-is
    if (!value.startsWith("entry::")) return value;

    // Entry reference — extract UUID and look up in pages collection.
    // findCollectionFiles includes locale subdirectories so this resolves
    // correctly in Statamic v5 multisite setups.
    const entryId = value.replace(/^entry::/, "").trim();
    if (!entryId) return null;

    try {
      for (const { filePath, slug } of this.findCollectionFiles("pages")) {
        const rawMd  = fs.readFileSync(filePath, "utf-8");
        const match  = rawMd.match(/^---\n([\s\S]*?)\n---/);
        if (!match) continue;
        const fmData = (parseYaml(match[1]) as Record<string, unknown>) ?? {};
        if (String(fmData["id"] ?? "") !== entryId) continue;
        // Found the matching entry — return its uri or derive from slug
        if (typeof fmData["uri"] === "string") return fmData["uri"];
        return slug === "home" ? "/" : `/${slug}`;
      }
    } catch {
      // fall through
    }

    return null;
  }

  /**
   * Read the Statamic sites configuration from resources/sites.yaml.
   *
   * Statamic v5+ stores multi-site configuration in resources/sites.yaml,
   * keyed by site handle.  Each entry has name, locale, url, and optional
   * custom attributes.  The file is written by Statamic CP → Settings → Sites
   * when the editor saves the site configuration.
   *
   * Custom attribute "showSite" controls language-switcher visibility:
   *   showSite: 'true'  → include in language switcher
   *   showSite: 'false' → hidden (e.g. a staging locale)
   *
   * Returns an empty array when the file does not exist (single-site / not yet
   * configured).
   */
  async fetchSites(): Promise<import("@/cms/queries/statamic").StatamicSiteEntry[]> {
    const sitesFile = path.join(this.cmsRoot, "resources", "sites.yaml");
    if (!fs.existsSync(sitesFile)) return [];

    try {
      const raw  = fs.readFileSync(sitesFile, "utf-8");
      const yaml = (parseYaml(raw) as Record<string, unknown>) ?? {};
      return Object.entries(yaml).map(([handle, config]) => {
        const c = (config ?? {}) as Record<string, unknown>;
        return {
          handle,
          name:       typeof c["name"]   === "string" ? c["name"]   : handle,
          locale:     typeof c["locale"] === "string" ? c["locale"] : "",
          url:        typeof c["url"]    === "string" ? c["url"]    : "/",
          attributes: (c["attributes"] as Record<string, string> | undefined) ?? undefined,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Fetch all terms for a Statamic taxonomy from flat files.
   *
   * Statamic stores taxonomy terms as individual YAML files:
   *   content/taxonomies/{taxonomy}/{slug}.yaml
   * Each file contains at minimum a `title:` field.
   *
   * Returns an array of { id, slug, title } objects; empty array when the
   * taxonomy directory does not exist or contains no term files.
   *
   * @param taxonomy  The taxonomy handle, e.g. "sector" or "employment_type"
   */
  async fetchTaxonomyTerms(
    taxonomy: string,
  ): Promise<Array<{ id: string; slug: string; title: string }>> {
    const termsDir = path.join(this.cmsRoot, "content", "taxonomies", taxonomy);
    if (!fs.existsSync(termsDir)) return [];

    const results: Array<{ id: string; slug: string; title: string }> = [];

    try {
      for (const entry of fs.readdirSync(termsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
        const slug = entry.name.replace(/\.yaml$/, "");
        try {
          const raw  = fs.readFileSync(path.join(termsDir, entry.name), "utf-8");
          const data = (parseYaml(raw) as Record<string, unknown>) ?? {};
          const title = typeof data["title"] === "string" ? data["title"] : slug;
          const id    = typeof data["id"]    === "string" ? data["id"]    : slug;
          results.push({ id, slug, title });
        } catch {
          // Non-fatal — skip unreadable term file
        }
      }
    } catch {
      return [];
    }

    // Sort alphabetically by title for consistent ordering
    results.sort((a, b) => a.title.localeCompare(b.title));
    return results;
  }

  /**
   * Read a Statamic Global by its handle.
   *
   * Statamic v4+ multisite splits globals into two files:
   *   content/globals/{handle}.yaml          — handle + title only (no field values)
   *   content/globals/{locale}/{handle}.yaml — locale-specific field values (no `data:` wrapper)
   *
   * Older single-site setups store everything in the base file under a `data:` key:
   *   content/globals/{handle}.yaml → { title, data: { field_one, … } }
   *
   * Resolution order:
   *   1. content/globals/{locale}/{handle}.yaml  (locale subdir, fields at top level)
   *   2. content/globals/{handle}.yaml           (base file, reads `data:` key as fallback)
   *
   * Returns the merged field object, or null if nothing is found.
   */
  async fetchGlobal<TData>(handle: string): Promise<TData | null> {
    const globalsDir = path.join(this.cmsRoot, "content", "globals");
    const baseFile   = path.join(globalsDir, `${handle}.yaml`);

    // ── 1. Locale subdirectory (Statamic v4+ multisite) ───────────────────────
    // Fields are stored directly at the top level (no `data:` wrapper).
    let localeData: Record<string, unknown> = {};
    if (fs.existsSync(globalsDir)) {
      try {
        for (const entry of fs.readdirSync(globalsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(globalsDir, entry.name, `${handle}.yaml`);
          if (!fs.existsSync(candidate)) continue;
          const raw  = fs.readFileSync(candidate, "utf-8");
          const yaml = (parseYaml(raw) as Record<string, unknown>) ?? {};
          localeData = yaml;
          break; // use first locale found
        }
      } catch { /* non-fatal */ }
    }
    if (Object.keys(localeData).length > 0) return localeData as TData;

    // ── 2. Base file fallback (single-site or old format) ────────────────────
    if (!fs.existsSync(baseFile)) return null;
    try {
      const raw  = fs.readFileSync(baseFile, "utf-8");
      const yaml = (parseYaml(raw) as Record<string, unknown>) ?? {};
      const data = (yaml["data"] ?? {}) as TData;
      return data;
    } catch {
      return null;
    }
  }
}

// ── Client ────────────────────────────────────────────────────────────────

/**
 * Thin Statamic Content REST API client.
 *
 * Uses native `fetch` so Next.js App Router can attach ISR cache options.
 * The API key is stored at construction time; never appears in logs.
 *
 * When `cmsFsPath` is provided, a file-based fallback is activated: if the
 * HTTP API returns 404 or an unparseable response, the client reads the
 * corresponding YAML flat file directly from the filesystem.
 *
 * @example
 *   // Inject in tests:
 *   const client = new StatamicClient("https://cms.example.com", "api-key");
 *
 *   // Use in production via factory:
 *   const client = createStatamicClient();
 */
export class StatamicClient {
  private readonly fileReader: StatamicFileReader | null;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    cmsFsPath?: string,
  ) {
    this.fileReader = cmsFsPath
      ? new StatamicFileReader(path.resolve(process.cwd(), cmsFsPath))
      : null;
  }

  /**
   * Origin (scheme+host) of this Statamic install — used to absolutise asset
   * URLs (logos) so they load from the tenant's OWN CMS host. The frontend's
   * `/assets/*` proxy rewrite targets a single, build-time `STATAMIC_API_URL`,
   * so on a SECOND tenant (e.g. www.steunles.nl) a root-relative `/assets/…`
   * would resolve against the wrong CMS. Empty string in file-based / no-base
   * mode, where assets are served same-origin and must stay root-relative.
   */
  get assetBaseUrl(): string {
    try {
      return this.baseUrl ? new URL(this.baseUrl).origin : "";
    } catch {
      return "";
    }
  }

  /**
   * Fetch a single entry from a collection by its key.
   *
   * @param collection  The collection handle, e.g. "hero_variants"
   * @param key         The entry's unique key, e.g. "hero_test"
   * @returns           The entry object, or null if not found (404)
   * @throws            Error for non-404 HTTP errors (network failure, auth error, etc.)
   */
  async fetchEntry<TEntry>(
    collection: string,
    key: string,
    filterField: string = "key",
  ): Promise<StatamicEntry<TEntry> | null> {
    const url = `${this.baseUrl}/api/collections/${collection}/entries?filter[${filterField}:is]=${encodeURIComponent(key)}&limit=1`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Local dev fast path: when cmsFsPath is configured, read directly from
    // the flat YAML files without touching HTTP. This sidesteps every possible
    // PHP routing issue (Statamic catch-all, Content API filtering, blueprint
    // augmentation stripping Replicator blocks, etc.).
    if (this.fileReader) {
      return this.fileReader.fetchEntry<TEntry>(collection, key);
    }

    try {
      const response = await fetch(url, {
        headers,
        // Next.js ISR options — same pattern as @sanity/client
        next: {
          revalidate: STATAMIC_REVALIDATE_SECONDS,
          tags: [STATAMIC_CACHE_TAG],
        },
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(
          `Statamic API error fetching "${key}" from "${collection}": ` +
            `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as StatamicListResponse<TEntry>;
      return (data.data[0] as StatamicEntry<TEntry>) ?? null;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Fetch a single entry from a collection by its URL slug.
   *
   * Useful for the `pages` collection where entries don't carry a `key` field
   * but are looked up by their Statamic slug (the YAML filename minus extension).
   *
   * @param collection  The collection handle, e.g. "pages"
   * @param slug        The entry's URL slug, e.g. "about"
   * @returns           The entry object, or null if not found
   * @throws            Error for non-404 HTTP errors
   */
  async fetchEntryBySlug<TEntry>(
    collection: string,
    slug: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    // The slug is a Statamic built-in field — `$e->get('slug')` resolves it.
    const url = `${this.baseUrl}/api/collections/${collection}/entries?filter[slug:is]=${encodeURIComponent(slug)}&limit=1`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Local dev fast path — same reasoning as fetchEntry above.
    if (this.fileReader) {
      return this.fileReader.fetchEntryBySlug<TEntry>(collection, slug);
    }

    try {
      const response = await fetch(url, {
        headers,
        next: {
          revalidate: STATAMIC_REVALIDATE_SECONDS,
          tags: [STATAMIC_CACHE_TAG],
        },
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(
          `Statamic API error fetching slug "${slug}" from "${collection}": ` +
            `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as StatamicListResponse<TEntry>;
      return (data.data[0] as StatamicEntry<TEntry>) ?? null;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Fetch all entries from a collection (up to `limit`).
   *
   * Used by dedicated page routes that render entire Statamic collections
   * (e.g. /features → features collection, /about → team_members collection).
   *
   * @param collection  The collection handle, e.g. "features"
   * @param limit       Maximum number of entries to return (default 100)
   * @returns           Array of entries; empty array on 404 / missing collection
   * @throws            Error for non-404 HTTP errors
   */
  async fetchAll<TEntry>(
    collection: string,
    limit = 100,
  ): Promise<StatamicEntry<TEntry>[]> {
    const url = `${this.baseUrl}/api/collections/${collection}/entries?limit=${limit}`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Local dev fast path — same reasoning as fetchEntry above.
    if (this.fileReader) {
      return this.fileReader.fetchAll<TEntry>(collection, limit);
    }

    try {
      const response = await fetch(url, {
        headers,
        next: {
          revalidate: STATAMIC_REVALIDATE_SECONDS,
          tags: [STATAMIC_CACHE_TAG],
        },
      });

      if (response.status === 404) return [];

      if (!response.ok) {
        throw new Error(
          `Statamic API error fetching all "${collection}" entries: ` +
            `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as StatamicListResponse<TEntry>;
      return data.data as StatamicEntry<TEntry>[];
    } catch (err) {
      throw err;
    }
  }

  /**
   * Fetch a Statamic Global by its handle.
   *
   * Globals hold site-wide configuration data (Layout Settings, SEO defaults,
   * etc.) that is not part of a collection entry.  They are edited in the
   * Statamic CP sidebar under Globals.
   *
   * File path (local dev): content/globals/{handle}.yaml
   *   Format:
   *     title: 'Global Title'
   *     data:
   *       field_one: value
   *
   * HTTP path (production): GET /api/globals/{handle}
   *   Returns: { data: { title, ...<fields> } }
   *   NOTE: Statamic's Content REST API flattens fields directly into data —
   *   there is no nested `data.data` key in the HTTP response.
   *
   * Returns the fields object, or null if the global does not exist.
   *
   * @param handle  The global handle, e.g. "layout_settings"
   */
  async fetchGlobal<TData>(handle: string): Promise<TData | null> {
    // Local dev fast path — read directly from the flat YAML file.
    if (this.fileReader) {
      return this.fileReader.fetchGlobal<TData>(handle);
    }

    // HTTP path (production).
    const url = `${this.baseUrl}/api/globals/${encodeURIComponent(handle)}`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        headers,
        next: {
          revalidate: STATAMIC_REVALIDATE_SECONDS,
          tags:       [STATAMIC_CACHE_TAG],
        },
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(
          `Statamic API error fetching global "${handle}": ` +
            `HTTP ${response.status} ${response.statusText}`,
        );
      }

      // The Globals API returns { data: { title: "...", field1: val, ... } }.
      // We return the entire data object (minus Statamic meta fields that start
      // with "api_url") so the caller gets a flat field map.
      const json = (await response.json()) as { data: Record<string, unknown> };
      const { api_url: _apiUrl, ...fields } = json.data ?? {};
      return fields as TData;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Fetch a Statamic Navigation tree by its handle.
   *
   * File path (local dev): reads content/navigation/{handle}.yaml and resolves
   * entry IDs against the pages collection to obtain titles and URIs.
   *
   * HTTP path (production): GET /api/navs/{handle}/tree
   * The Statamic Content API resolves entry data (title, url, permalink) and
   * includes any custom blueprint fields (e.g. header_variant) in each item.
   *
   * Returns a flat list of top-level nav items.  Children are not included.
   *
   * @param handle  The navigation handle, e.g. "main_nav"
   */
  async fetchNavTree(handle: string): Promise<StatamicNavTreeItem[]> {
    // Recursive mapper shared between HTTP and file-reader paths.
    //
    // The REST API nests entry-based item data under a `page` object:
    //   { page: { id, title, url, header_variant, … }, depth, children: […] }
    // while URL-based items and custom nav fields can live at the top level.
    // We therefore check the top level first and fall back to `page`.
    const mapApiItem = (item: Record<string, unknown>): StatamicNavTreeItem => {
      const page = (typeof item["page"] === "object" && item["page"] !== null)
        ? (item["page"] as Record<string, unknown>)
        : {};
      const field = (key: string): unknown => item[key] ?? page[key];

      const rawChildren = Array.isArray(item["children"])
        ? (item["children"] as Record<string, unknown>[])
        : [];
      const children = rawChildren.map(mapApiItem);
      const rawExcerpt = field("excerpt");
      const apiExcerpt = typeof rawExcerpt === "string" && rawExcerpt.trim()
        ? rawExcerpt.trim()
        : undefined;
      const apiShowMegaImage: boolean | undefined =
        typeof field("mega_show_image") === "boolean" ? (field("mega_show_image") as boolean) : undefined;
      const apiShowMegaDescription: boolean | undefined =
        typeof field("mega_show_description") === "boolean" ? (field("mega_show_description") as boolean) : undefined;

      // Mega-menu CTA — from the mega_cta_* fields. The image (assets) field may
      // come back as a string, an array, or an asset object (url/permalink).
      const apiMegaCta = ((): StatamicNavTreeItem["megaCta"] | undefined => {
        const pos = field("mega_cta_position");
        if (pos !== "left" && pos !== "right" && pos !== "bottom") return undefined;
        const str = (k: string) => {
          const v = field(k);
          return typeof v === "string" && v.trim() ? v.trim() : undefined;
        };
        const heading = str("mega_cta_heading");
        const url     = str("mega_cta_url");
        if (!heading || !url) return undefined;
        const raw   = field("mega_cta_image");
        const first = Array.isArray(raw) ? raw[0] : raw;
        let imageFile: string | undefined;
        if (typeof first === "string" && first) imageFile = first;
        else if (first && typeof first === "object") {
          const o = first as Record<string, unknown>;
          const cand = o["permalink"] ?? o["url"] ?? o["basename"] ?? o["path"];
          if (typeof cand === "string" && cand) imageFile = cand;
        }
        return {
          position: pos,
          heading,
          url,
          ...(str("mega_cta_text")  ? { text:  str("mega_cta_text")  } : {}),
          ...(str("mega_cta_label") ? { label: str("mega_cta_label") } : {}),
          ...(imageFile ? { imageFile } : {}),
          ...(field("mega_cta_new_tab") === true ? { newTab: true } : {}),
        };
      })();

      return {
        id:             String(field("id") ?? field("url") ?? ""),
        title:          String(field("title") ?? ""),
        url:            String(field("url")   ?? "#"),
        header_variant: typeof field("header_variant") === "string"
          ? ((field("header_variant") as string) || null)
          : null,
        ...(apiExcerpt ? { excerpt: apiExcerpt } : {}),
        ...(apiShowMegaImage !== undefined       ? { showMegaImage: apiShowMegaImage }             : {}),
        ...(apiShowMegaDescription !== undefined ? { showMegaDescription: apiShowMegaDescription } : {}),
        ...(apiMegaCta ? { megaCta: apiMegaCta } : {}),
        ...(children.length > 0 ? { children } : {}),
      };
    };

    // ── File reader (primary when STATAMIC_CMS_PATH is set) ──────────────────
    //
    // The file reader reads directly from content/trees/navigation/{handle}.yaml —
    // the exact same file the Statamic CP writes to when you save nav changes.
    // This means CP edits are reflected on the website on the very next request,
    // with no caching lag and no dependency on the PHP server being up.
    //
    // The HTTP API is only used as a fallback in production deployments where
    // STATAMIC_CMS_PATH is not set (no local files available).
    if (this.fileReader) {
      return this.fileReader.fetchNavTree(handle);
    }

    // ── HTTP API fallback (production — no local files) ───────────────────────
    // Used when STATAMIC_CMS_PATH is not set (e.g. Vercel / production build).
    if (this.baseUrl) {
      const url = `${this.baseUrl}/api/navs/${encodeURIComponent(handle)}/tree`;
      const reqHeaders: Record<string, string> = { "Accept": "application/json" };
      if (this.apiKey) reqHeaders["Authorization"] = `Bearer ${this.apiKey}`;

      try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, {
          headers: reqHeaders,
          signal:  controller.signal,
          next: {
            revalidate: STATAMIC_REVALIDATE_SECONDS,
            tags:       [STATAMIC_CACHE_TAG],
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = (await response.json()) as { data: Record<string, unknown>[] };
          return (json.data ?? []).map(mapApiItem);
        }
        if (response.status !== 404) {
          logger.warn(
            `[StatamicClient] nav tree "${handle}": HTTP ${response.status}`,
          );
        }
      } catch {
        // AbortError (3 s timeout) or network error.
      }
    }

    return [];
  }

  /**
   * Resolve a Statamic link-field value to a plain URL string.
   *
   * The `link` fieldtype is returned in TWO shapes depending on the source:
   *   - HTTP Content API → an OBJECT, e.g. { url: "/pricing", permalink, … } for
   *     a resolved link, or { url: null } for an empty/optional link.
   *   - File reader (STATAMIC_CMS_PATH) → a raw STRING ("entry::uuid", "/path",
   *     "#anchor").
   *
   * We normalise both to a string URL (or null). This is critical: an unwrapped
   * object would stringify to "[object Object]" when interpolated into an href
   * (e.g. the header search box → router.push(`${searchHref}?q=…`) → a /[object
   * Object] 404). For the object shape we prefer the root-relative `url` over the
   * absolute `permalink` so links stay same-origin.
   */
  async resolveLink(value: unknown): Promise<string | null> {
    if (!value) return null;

    // HTTP API object shape — unwrap to a string URL (null when the link is empty).
    if (typeof value === "object") {
      const obj = value as { url?: unknown; permalink?: unknown };
      if (typeof obj.url === "string" && obj.url) return obj.url;
      if (typeof obj.permalink === "string" && obj.permalink) return obj.permalink;
      return null;
    }

    if (typeof value !== "string") return null;
    if (!this.fileReader) return value; // HTTP API already resolves entry refs
    return this.fileReader.resolveLink(value);
  }

  /**
   * Fetch the Statamic sites configuration from resources/sites.yaml.
   *
   * Statamic v5+ writes site configuration (name, locale, url, custom
   * attributes) to resources/sites.yaml when the editor saves CP → Sites.
   * The file is keyed by site handle, e.g. "nl" or "en-gb".
   *
   * Custom attribute "showSite" controls language-switcher visibility.
   * The file-reader approach means CP saves are reflected immediately with
   * zero caching lag (same pattern as fetchNavTree).
   *
   * Returns an empty array when no local files are available (production).
   */
  async fetchSites(): Promise<import("@/cms/queries/statamic").StatamicSiteEntry[]> {
    // ── File reader (primary when STATAMIC_CMS_PATH is set) ──────────────────
    if (this.fileReader) {
      return this.fileReader.fetchSites();
    }

    // ── HTTP API fallback: Statamic does not expose a /api/sites endpoint in
    //    the Content REST API, so we return an empty array in production.
    //    The provider falls back to entry.locales when sites are unavailable.
    return [];
  }

  /**
   * Fetch all terms for a Statamic taxonomy.
   *
   * File path (local dev): content/taxonomies/{taxonomy}/{slug}.yaml
   *   Each file has YAML frontmatter with at minimum `title:`.
   *
   * HTTP path (production): GET /api/taxonomies/{taxonomy}/terms
   *   Returns { data: [{ id, slug, title, ... }] }
   *
   * Returns an empty array when the taxonomy does not exist or has no terms.
   *
   * @param taxonomy  The taxonomy handle, e.g. "sector" or "employment_type"
   */
  async fetchTaxonomyTerms(
    taxonomy: string,
  ): Promise<Array<{ id: string; slug: string; title: string }>> {
    // ── File reader (primary when STATAMIC_CMS_PATH is set) ──────────────────
    if (this.fileReader) {
      return this.fileReader.fetchTaxonomyTerms(taxonomy);
    }

    // ── HTTP API (production) ─────────────────────────────────────────────────
    const url = `${this.baseUrl}/api/taxonomies/${encodeURIComponent(taxonomy)}/terms`;
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    try {
      const response = await fetch(url, {
        headers,
        next: {
          revalidate: STATAMIC_REVALIDATE_SECONDS,
          tags:       [STATAMIC_CACHE_TAG],
        },
      });

      if (response.status === 404) return [];

      if (!response.ok) {
        logger.warn(
          `[StatamicClient] fetchTaxonomyTerms "${taxonomy}": HTTP ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as {
        data: Array<{ id: string; slug: string; title: string }>;
      };
      return data.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Read an entry directly from the filesystem, bypassing the HTTP API.
   *
   * Only works when STATAMIC_CMS_PATH is configured (local dev).
   * Used as a last resort when the HTTP API returns a valid response but
   * without the expected field data (e.g. Statamic's built-in Content API
   * strips Replicator blocks whose type handles don't match the blueprint).
   *
   * @param collection  The collection handle, e.g. "pages"
   * @param slug        The entry slug, e.g. "home"
   * @returns           The entry from the flat file, or null if not available
   */
  async readEntryFromFile<TEntry>(
    collection: string,
    slug: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    if (!this.fileReader) return null;
    return this.fileReader.fetchEntryBySlug<TEntry>(collection, slug);
  }

  /**
   * Create or update an entry in a collection (upsert by slug).
   *
   * POSTs to the custom write route added to routes/api.php.
   * If an entry with the same slug already exists it is updated (HTTP 200);
   * otherwise a new entry is created (HTTP 201).
   *
   * @param collection  The collection handle, e.g. "hero_variants"
   * @param slug        URL-safe slug (also used as the YAML filename)
   * @param data        Entry field values to store
   * @returns           The saved entry's id and slug
   * @throws            Error for non-2xx HTTP responses
   */
  async upsertEntry(
    collection: string,
    slug: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; slug: string }> {
    const url = `${this.baseUrl}/api/collections/${collection}/entries`;

    const headers: Record<string, string> = {
      "Accept":       "application/json",
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...data, slug }),
      // Do NOT pass next: { revalidate } here — write requests must not be
      // cached by the Next.js fetch cache.
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Statamic API error writing entry "${slug}" to "${collection}": ` +
          `HTTP ${response.status} ${response.statusText}` +
          (body ? ` — ${body.slice(0, 200)}` : ""),
      );
    }

    const result = (await response.json()) as { data: { id: string; slug: string } };
    return { id: result.data.id, slug: result.data.slug };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Creates a configured StatamicClient from validated environment variables.
 *
 * Reads STATAMIC_API_URL, STATAMIC_API_KEY, and STATAMIC_CMS_PATH from
 * serverEnv.statamic. When STATAMIC_CMS_PATH is set, the client is
 * configured with a file-based fallback for local development.
 *
 * @internal  Exposed for testing (inject a pre-configured StatamicClient
 *            into StatamicProvider rather than calling this in tests).
 */
export function createStatamicClient(): StatamicClient {
  const { apiUrl, apiKey, cmsFsPath } = serverEnv.statamic;
  logger.info("[StatamicClient] createStatamicClient", {
    apiUrl,
    cmsFsPath: cmsFsPath ?? "(not set — file reader disabled)",
  });
  return new StatamicClient(apiUrl, apiKey, cmsFsPath);
}
