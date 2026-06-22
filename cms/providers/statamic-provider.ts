/**
 * StatamicProvider
 *
 * CMSProvider implementation backed by the Statamic Content REST API.
 * Replaces MockCMSProvider when STATAMIC_API_URL is set and neither
 * Sanity nor Storyblok is configured.
 *
 * ─── Architecture ──────────────────────────────────────────────────────────
 *
 *   StatamicProvider receives a StatamicClient at construction time.
 *   This allows callers to inject a test client in unit tests without
 *   environment variable setup. The default constructor creates a live
 *   client via createStatamicClient().
 *
 *   Content is stored as Statamic collection entries:
 *     hero_variants   collection  →  heroVariant entries
 *     proof_variants  collection  →  proofVariant entries
 *     cta_variants    collection  →  ctaVariant entries
 *
 *   Each public method fetches the entry from its collection by key,
 *   then delegates to the private fetchVariant() helper which handles
 *   the full lifecycle.
 *
 * ─── fetchVariant() lifecycle ──────────────────────────────────────────────
 *
 *   1. Fetch entry from collection via StatamicClient.fetchEntry()
 *      — returns null for 404
 *   2. Check entry.is_active — inactive entries are treated as not found
 *   3. Map entry to internal block data type via the Statamic mapper
 *   4. Wrap in try/catch — errors return null (logged at warn), never throw
 *
 * ─── is_active vs. Statamic publication state ──────────────────────────────
 *
 *   Statamic's REST API returns published entries only (status filtering is
 *   typically set at the collection level). The `is_active` field is a
 *   soft-disable within published entries: it allows editors to deactivate
 *   an entry without hiding it from the collection.
 *
 * ─── Caching ───────────────────────────────────────────────────────────────
 *
 *   All fetches are tagged with STATAMIC_CACHE_TAG and participate in ISR.
 *   On-demand revalidation: call `revalidateTag("statamic")` from a webhook
 *   route handler triggered by Statamic's saved/published entry webhooks.
 *
 * ─── Null semantics ────────────────────────────────────────────────────────
 *
 *   null is returned (never thrown) in three cases:
 *   1. Entry not found (key not in Statamic, or entry not published)
 *   2. Entry found but is_active === false
 *   3. Network or parse error (logged as warning)
 *
 *   The experience composer handles null via its fallback strategy.
 *
 * ─── Environment variables ────────────────────────────────────────────────
 *
 *   STATAMIC_API_URL   required  Base URL of Statamic site
 *   STATAMIC_API_KEY   optional  Bearer token for protected APIs
 */

import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import type { CMSProvider } from "./cms-provider";
import { getPreset }                     from "@/page-config";
import { buildPageStructuredEntry }      from "@/cms/seed/statamic-block-starter";
import type { HeroBlockData, ProofBlockData, CTABlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData, SiteSettingsData, PageData, AdaptiveBlockData } from "../types";
import type {
  StatamicHeroEntry,
  StatamicProofEntry,
  StatamicCTAEntry,
} from "../queries/statamic";
import {
  PAGES_COLLECTION,
} from "../queries/statamic";
import type {
  StatamicNavItem,
  StatamicLocaleEntry,
  StatamicPageEntry,
  StatamicPageReplicatorBlock,
  StatamicHeroReplicatorSet,
  StatamicProofReplicatorSet,
  StatamicCTAReplicatorSet,
  StatamicFeatureReplicatorSet,
  StatamicConversionReplicatorSet,
} from "../queries/statamic";
import {
  mapStatamicHero,
  mapStatamicProof,
  mapStatamicCTA,
  mapStatamicFeature,
  mapStatamicConversion,
  mapStatamicPageBlocksToSections,
} from "../mappers/statamic";
import { isContextSlotBlockType } from "../mappers/statamic/context-slot-block";
import { StatamicClient, createStatamicClient } from "./statamic-client";
import { logger } from "@/lib/logger";
import type { ProvisionResult, TestConnectionResult } from "./cms-provider";
import type { TenantSettings } from "@/tenant/types";

// ── Direct file reader (bypasses StatamicClient for local dev reliability) ────
//
// When STATAMIC_CMS_PATH is set, reads home.md directly from disk without
// going through the StatamicClient/StatamicFileReader chain. This is a last-
// resort fallback that runs directly inside getHomePageContent() when the HTTP
// API returns an entry without Replicator blocks.

/**
 * Flatten the typed variant arrays from a page entry into a single
 * StatamicPageReplicatorBlock[].
 *
 * Supports both architectures:
 *
 * CURRENT (context slot v2):
 *   `page_blocks` contains only content blocks (text_section, feature_grid, etc.).
 *   Context slots are now dedicated group fields (context_hero, etc.) — not here.
 *
 * LEGACY v1 (page_blocks Replicator with context_slot items):
 *   `page_blocks` may contain context_slot items mixed with content blocks.
 *   context_slot items are filtered out so variant getters work correctly.
 *
 * LEGACY v0 (typed top-level arrays):
 *   `hero_variants`, `proof_variants`, etc. arrays are flattened in order.
 *
 * Order: page_blocks first, then legacy typed arrays.
 * Deduplication is not performed — callers use find() which stops at first match.
 */
function flattenPageVariants(data: Record<string, unknown>): StatamicPageReplicatorBlock[] {
  // Current + legacy: read from page_blocks, always filter out context_slot items
  // (they have no variant content and should not be in the variant catalog).
  const fromPageBlocks = Array.isArray(data["page_blocks"])
    ? ((data["page_blocks"] as Array<{ type: string } & Record<string, unknown>>)
        .filter((b) => !isContextSlotBlockType(b.type)) as unknown as StatamicPageReplicatorBlock[])
    : [];

  // Legacy typed arrays (kept for backward compat)
  const fromTypedArrays: StatamicPageReplicatorBlock[] = [
    ...(Array.isArray(data["hero_variants"])       ? (data["hero_variants"]       as StatamicPageReplicatorBlock[]) : []),
    ...(Array.isArray(data["proof_variants"])      ? (data["proof_variants"]      as StatamicPageReplicatorBlock[]) : []),
    ...(Array.isArray(data["cta_variants"])        ? (data["cta_variants"]        as StatamicPageReplicatorBlock[]) : []),
    ...(Array.isArray(data["feature_variants"])    ? (data["feature_variants"]    as StatamicPageReplicatorBlock[]) : []),
    ...(Array.isArray(data["conversion_variants"]) ? (data["conversion_variants"] as StatamicPageReplicatorBlock[]) : []),
    ...(Array.isArray(data["content"])             ? (data["content"]             as StatamicPageReplicatorBlock[]) : []),
  ];

  return [...fromPageBlocks, ...fromTypedArrays];
}

/**
 * Read the home page Replicator blocks directly from the flat YAML file.
 * Returns [] if STATAMIC_CMS_PATH is not set, file doesn't exist, or YAML fails.
 *
 * Supports both the new architecture (typed top-level arrays: hero_variants,
 * proof_variants, …) and the legacy format (single mixed `content` array).
 */
function readHomeBlocksFromDisk(): StatamicPageReplicatorBlock[] {
  try {
    const cmsFsPath = process.env.STATAMIC_CMS_PATH;
    if (!cmsFsPath) return [];

    const absRoot = path.resolve(process.cwd(), cmsFsPath);

    // Statamic v5 multisite stores entries under a locale subdirectory.
    // Try the locale path first (e.g. nl/home.md), then fall back to the
    // legacy flat path (home.md) for single-site or older installations.
    const localePath = path.join(absRoot, "content", "collections", "pages", "nl", "home.md");
    const flatPath   = path.join(absRoot, "content", "collections", "pages", "home.md");
    const filePath   = fs.existsSync(localePath) ? localePath : flatPath;

    logger.info("[StatamicProvider] readHomeBlocksFromDisk", { filePath });

    if (!fs.existsSync(filePath)) {
      logger.warn("[StatamicProvider] readHomeBlocksFromDisk: home.md not found", {
        localePath,
        flatPath,
      });
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      logger.warn("[StatamicProvider] readHomeBlocksFromDisk: no YAML frontmatter found");
      return [];
    }

    const data = parseYaml(match[1]) as Record<string, unknown>;
    const blocks = flattenPageVariants(data);
    logger.info("[StatamicProvider] readHomeBlocksFromDisk: loaded blocks", { count: blocks.length });
    return blocks;
  } catch (err) {
    logger.warn("[StatamicProvider] readHomeBlocksFromDisk: error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Provider ───────────────────────────────────────────────────────────────

export class StatamicProvider implements CMSProvider {
  private readonly client: StatamicClient;

  /**
   * In-memory cache of the home page Replicator blocks.
   *
   * Populated on first call to getHomePageContent() and reused within the
   * same provider instance (i.e. the same request/render). Avoids redundant
   * Statamic API calls when getHeroVariant, getProofVariant, and getCTAVariant
   * are all called during the same homepage rendering pass.
   *
   * `undefined`  → not yet fetched
   * `null`        → fetch attempted but page not found / error
   * `Block[]`     → fetched successfully (may be empty array)
   */
  private _homePageContent: StatamicPageReplicatorBlock[] | null | undefined =
    undefined;

  /**
   * Raw page_blocks from the live preview draft payload (Statamic CP).
   *
   * Set only in draft mode (when `draftBlocks` are passed to the constructor).
   * Used by getPageBySlug("home") to build the page sections array from the
   * live CP ordering — overriding the stale on-disk page_blocks — so that
   * block reordering is reflected immediately in the Live Preview iframe.
   *
   * Distinct from `_homePageContent` which merges draft + disk blocks for the
   * purpose of variant lookups (hero/proof/cta content); that merged set is
   * NOT suitable for page structure because it interleaves draft page_blocks
   * with disk variant catalog blocks (hero_variant, proof_variant, etc.).
   */
  private _draftPageBlocks: StatamicPageReplicatorBlock[] | undefined =
    undefined;

  /**
   * @param client      Optional pre-configured StatamicClient.
   *                    Omit in production — a client is created from env vars.
   *                    Inject in tests to avoid env var setup.
   * @param draftBlocks When provided (Statamic Live Preview draft mode), these
   *                    blocks pre-populate the _homePageContent cache so that all
   *                    variant getters return draft data instead of reading from
   *                    disk.  This enables real-time preview before saving.
   *
   *                    When draftBlocks come from a non-homepage page (e.g.
   *                    contact.md), they typically contain only context_slot
   *                    anchors — no variant content.  To ensure variant getters
   *                    resolve correctly, we append the disk home.md variant
   *                    catalog (hero_variants, proof_variants, etc.) so that
   *                    fallbackVariantKey resolution always succeeds without a DB
   *                    round-trip.
   */
  /**
   * The tenant this provider serves.  Required for adaptive_blocks lookups so
   * the tenant-specific customization (admin → Tenant → Blocks, stored in the
   * platform DB) is returned rather than the platform-wide default row.
   * Undefined/null falls back to the platform-wide row.
   */
  private readonly tenantId: string | null;

  constructor(client?: StatamicClient, draftBlocks?: unknown[], tenantId?: string | null) {
    this.client = client ?? createStatamicClient();
    this.tenantId = tenantId ?? null;
    if (draftBlocks !== undefined) {
      // Store raw draft blocks for getPageBySlug so the live CP ordering is
      // used for page structure, not the stale on-disk page_blocks.
      this._draftPageBlocks = draftBlocks as StatamicPageReplicatorBlock[];

      // Merge draft blocks with the home.md variant catalog so variant lookups
      // succeed even when the draft page only carries context_slot anchors.
      const diskBlocks: StatamicPageReplicatorBlock[] =
        process.env.STATAMIC_CMS_PATH ? readHomeBlocksFromDisk() : [];
      this._homePageContent = [
        ...(draftBlocks as StatamicPageReplicatorBlock[]),
        ...diskBlocks,
      ];
    }
  }

  // ── CMSProvider interface ──────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    // Platform-DB customization wins.  When an ACTIVE adaptive_blocks entry
    // exists for this key + tenant (edited in admin → Tenant → Blocks), it
    // overrides the Statamic home.md variant catalog.  Previously the home.md
    // `hero_variant` shadowed the DB, so saved customizations never showed on
    // the live site.  Keys without a DB row (hero_features, hero_pricing, …)
    // return null here and fall through to the replicator catalog below.
    const adaptive = this.adaptiveToHero(await this.getAdaptiveBlock(key));
    if (adaptive) return adaptive;

    // Fallback: search Replicator blocks on the home page (Statamic home.md).
    const content = await this.getHomePageContent();
    const block = content.find(
      (b): b is StatamicHeroReplicatorSet =>
        b.type === "hero_variant" && (b as StatamicHeroReplicatorSet).key === key,
    );
    if (block !== undefined) {
      if (block.is_active === false || block.enabled === false) {
        logger.debug("[StatamicProvider] hero variant inactive (replicator)", { key });
        return null;
      }
      return mapStatamicHero({
        ...block,
        id:        block.key,
        slug:      block.key,
        title:     block.title    ?? block.key,
        subtitle:  block.subtitle ?? "",
        is_active: true,
      } as StatamicHeroEntry);
    }

    logger.debug(`[StatamicProvider] hero variant not found in DB or Replicator: ${key}`);
    return null;
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    // Platform-DB customization wins (see getHeroVariant for rationale).
    const adaptive = this.adaptiveToProof(await this.getAdaptiveBlock(key));
    if (adaptive) return adaptive;

    const content = await this.getHomePageContent();
    const block = content.find(
      (b): b is StatamicProofReplicatorSet =>
        b.type === "proof_variant" && (b as StatamicProofReplicatorSet).key === key,
    );
    if (block !== undefined) {
      if (block.is_active === false || block.enabled === false) {
        logger.debug("[StatamicProvider] proof variant inactive (replicator)", { key });
        return null;
      }
      return mapStatamicProof({
        ...block,
        id:        block.key,
        slug:      block.key,
        title:     block.title ?? "",
        is_active: true,
      } as StatamicProofEntry);
    }

    logger.debug(`[StatamicProvider] proof variant not found in DB or Replicator: ${key}`);
    return null;
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    // Platform-DB customization wins (see getHeroVariant for rationale).
    const adaptive = this.adaptiveToCTA(await this.getAdaptiveBlock(key));
    if (adaptive) return adaptive;

    const content = await this.getHomePageContent();
    const block = content.find(
      (b): b is StatamicCTAReplicatorSet =>
        b.type === "cta_variant" && (b as StatamicCTAReplicatorSet).key === key,
    );
    if (block !== undefined) {
      if (block.is_active === false || block.enabled === false) {
        logger.debug("[StatamicProvider] cta variant inactive (replicator)", { key });
        return null;
      }
      return mapStatamicCTA({
        ...block,
        id:        block.key,
        slug:      block.key,
        title:     block.title     ?? "",
        text:      block.text      ?? "",
        cta_label: block.cta_label ?? "",
        cta_href:  block.cta_href  ?? "#",
        is_active: true,
      } as StatamicCTAEntry);
    }

    logger.debug(`[StatamicProvider] CTA variant not found in DB or Replicator: ${key}`);
    return null;
  }

  async getFeatureVariant(key: string): Promise<FeatureBlockData | null> {
    // Platform-DB customization wins (see getHeroVariant for rationale).
    const adaptive = this.adaptiveToFeature(await this.getAdaptiveBlock(key));
    if (adaptive) return adaptive;

    const content = await this.getHomePageContent();
    const block = content.find(
      (b): b is StatamicFeatureReplicatorSet =>
        b.type === "feature_variant" && (b as StatamicFeatureReplicatorSet).key === key,
    );
    if (block !== undefined) {
      if (block.is_active === false || block.enabled === false) return null;
      return mapStatamicFeature({ ...block, is_active: true });
    }
    return null;
  }

  async getConversionVariant(key: string): Promise<ConversionBlockData | null> {
    // Platform-DB customization wins (see getHeroVariant for rationale).
    const adaptive = this.adaptiveToConversion(await this.getAdaptiveBlock(key));
    if (adaptive) return adaptive;

    const content = await this.getHomePageContent();
    const block = content.find(
      (b): b is StatamicConversionReplicatorSet =>
        b.type === "conversion_variant" && (b as StatamicConversionReplicatorSet).key === key,
    );
    if (block !== undefined) {
      if (block.is_active === false || block.enabled === false) return null;
      return mapStatamicConversion({ ...block, is_active: true });
    }
    return null;
  }

  // ── Adaptive-to-typed-block adapters ─────────────────────────────────────────
  //
  // Map AdaptiveBlockData (from the adaptive_blocks catalog) to the typed
  // block data interfaces expected by the experience composer.  Used as a
  // fallback when variant content is not found in the page Replicator — which
  // is always the case in the new page_blocks architecture where page entries
  // store only context_slot anchors, not variant content.

  private adaptiveToHero(data: AdaptiveBlockData | null): HeroBlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    return {
      id:           data.key,
      layoutVariant: c.layoutVariant,
      title:        c.title,
      subtitle:     c.subtitle,
      ctas:         c.ctas ?? [],
      tag:          c.tag,
      media:        c.media,
      contentAlign: c.contentAlign,
    };
  }

  private adaptiveToProof(data: AdaptiveBlockData | null): ProofBlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    return {
      id:    data.key,
      title: c.title,
      items: (c.items ?? []).map((item) => ({
        title: item.title ?? "",
        text:  item.text ?? item.body ?? "",
      })),
    };
  }

  private adaptiveToCTA(data: AdaptiveBlockData | null): CTABlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    const primaryCta = c.ctas?.[0];
    return {
      id:           data.key,
      layoutVariant: c.layoutVariant,
      title:        c.title,
      text:         c.subtitle,
      cta:          { label: primaryCta?.label ?? "", href: primaryCta?.href ?? "#" },
    };
  }

  private adaptiveToFeature(data: AdaptiveBlockData | null): FeatureBlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    return {
      id:           data.key,
      layoutVariant: c.layoutVariant,
      title:        c.title,
      subtitle:     c.subtitle,
      items:        (c.items ?? []).map((item) => ({
        title: item.title ?? "",
        body:  item.body ?? item.text ?? "",
        icon:  undefined,
      })),
    };
  }

  private adaptiveToConversion(data: AdaptiveBlockData | null): ConversionBlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    return {
      id:           data.key,
      layoutVariant: c.layoutVariant,
      title:        c.title,
      text:         c.subtitle,
      ctas:         c.ctas ?? [],
    };
  }

  private adaptiveToNotification(data: AdaptiveBlockData | null): NotificationBlockData | null {
    if (!data || !data.isActive) return null;
    const c = data.defaultVariant;
    // `title` is the notification message — required field.
    if (!c.title) return null;

    // Derive severity from the layoutVariant key:
    //   "notification_warning" → "warning"
    //   "notification_success" → "success"
    //   "notification_promo"   → "promo"
    //   anything else          → "info"  (safe default)
    const lv = c.layoutVariant ?? "";
    const severity: NotificationBlockData["severity"] =
      lv.includes("warning") ? "warning" :
      lv.includes("success") ? "success" :
      lv.includes("promo")   ? "promo"   : "info";

    const primaryCta = c.ctas?.[0];
    return {
      id:          data.key,
      message:     c.title,
      severity,
      ctaLabel:    primaryCta?.label ?? undefined,
      ctaHref:     primaryCta?.href  ?? undefined,
      position:    "top",
      dismissible: true,
    };
  }

  async getNotificationVariant(key: string): Promise<NotificationBlockData | null> {
    // Look up the notification content from the adaptive_blocks catalog — the
    // same system used by hero / proof / cta / feature / conversion slots.
    //
    // Editors create a notification entry in the adaptive_blocks collection:
    //   title         → the notification message text (required)
    //   layoutVariant → "notification_info" | "notification_warning" |
    //                   "notification_success" | "notification_promo"
    //   ctas[0]       → optional CTA button (label + href)
    //
    // Returns null when the key is not found or the entry is not active.
    logger.debug(`[StatamicProvider] getNotificationVariant: ${key}`);
    return this.adaptiveToNotification(await this.getAdaptiveBlock(key));
  }

  async getAdaptiveBlock(key: string): Promise<import("../types").AdaptiveBlockData | null> {
    // Adaptive block customizations live exclusively in the platform DB.
    // (The per-tenant Statamic `adaptive_blocks` collection was intentionally
    // removed — customizations are edited via admin → Tenant → Blocks.)  We go
    // straight to the DB, scoped to THIS tenant, so the tenant-specific row is
    // returned (falling back to the platform-wide row when none exists).
    //
    // Reading DB-first also avoids firing extra requests at the Statamic
    // instance on every slot lookup — important because that instance can be
    // slow to cold-start, and those requests would add latency / flakiness.
    const { getAdaptiveBlockByKey } = await import("@/lib/adaptive-blocks/adaptive-blocks-store");
    return getAdaptiveBlockByKey(key, this.tenantId);
  }

  async getSiteSettings(_locale = "en"): Promise<SiteSettingsData | null> {
    try {
      // site_settings is now a Global (Globals → Site Settings in the CP).
      // The collection-based entry has been removed; the global is the single source
      // of truth.  Return null when the global file does not exist yet (fresh install
      // before first provisioning run).

      // ── Navigation helpers ───────────────────────────────────────────────
      const mapNavItems = (
        raw: StatamicNavItem[] | undefined,
      ): import("../types").NavigationItemData[] => {
        if (!Array.isArray(raw)) return [];
        return raw.map((item, i) => {
          // header_variant may be a plain string or a Statamic select object { value, label }
          const hvRaw = (item as unknown as Record<string, unknown>).header_variant;
          const headerVariant: string | null = (
            typeof hvRaw === "string"    ? (hvRaw || null) :
            typeof hvRaw === "object" && hvRaw !== null
              ? (String((hvRaw as Record<string, unknown>).value ?? "") || null)
              : null
          );
          return {
            id:           String(item.label ?? i),
            label:        String(item.label ?? ""),
            href:         String(item.href  ?? "#"),
            openInNewTab: item.open_in_new_tab === true,
            headerVariant,
          };
        });
      };

      const mapLocales = (
        raw: StatamicLocaleEntry[] | undefined,
      ): import("../types").LocaleEntry[] => {
        if (!Array.isArray(raw)) return [];
        return raw.map((l) => ({ code: String(l.code), label: String(l.label) }));
      };

      /**
       * Derive locale entries from resources/sites.yaml.
       *
       * Each Statamic site becomes a LocaleEntry:
       *   - code:           derived from the PHP locale (nl_NL → "nl", en_GB → "en")
       *   - label:          the site name (e.g. "Nederlands", "English")
       *   - showInSwitcher: true unless attributes.showSite === "false"
       *
       * Falls back to mapLocales(entry.locales) when sites.yaml is absent or
       * returns fewer than 2 entries (single-site setup).
       */
      const mapSiteLocales = async (): Promise<import("../types").LocaleEntry[]> => {
        try {
          const sites = await this.client.fetchSites();
          if (sites.length < 2) return mapLocales(siteGlobal?.locales);
          return sites.map((s) => {
            // Derive a short locale code from the PHP locale string:
            //   "nl_NL" → "nl",  "en_GB" → "en",  "de_DE" → "de"
            // Fall back to the site handle when no locale is set.
            const phpLocale = s.locale ?? "";
            const code = phpLocale
              ? phpLocale.split(/[_-]/)[0].toLowerCase()
              : s.handle;
            return {
              code,
              label:          s.name,
              showInSwitcher: s.attributes?.showSite !== "false",
            };
          });
        } catch {
          return mapLocales(siteGlobal?.locales);
        }
      };

      // ── Shared asset resolver ────────────────────────────────────────────────
      //
      // The logo / logo_dark / maker_logo fields use the Statamic `assets` field
      // type, which stores either a plain string path (legacy) or an array of asset
      // values.  The HTTP API augments each asset to a full object with a `url` key.
      // The file-based reader returns the raw YAML array (strings or objects).
      // resolveStatamicAsset() handles all three shapes uniformly.
      type StatamicAssetValue =
        | Array<{ url?: string; permalink?: string } | string>
        | string
        | null
        | undefined;

      /**
       * Resolve a Statamic `assets` field to a URL string.
       *
       * Handles three storage shapes:
       *   1. Plain string  → returned as-is (legacy text field / direct URL)
       *   2. string[]      → first element returned (file-reader YAML array)
       *   3. {url?,permalink?}[] → first element's `url` or `permalink`
       *                            (HTTP API augmented asset object)
       */
      const resolveStatamicAsset = (field: StatamicAssetValue): string | null => {
        if (!field) return null;
        const first = Array.isArray(field) ? field[0] : field;
        if (!first) return null;
        let raw: string | null = null;
        if (typeof first === "string") raw = first || null;
        // Prefer `permalink` — the HTTP API returns it as the ABSOLUTE asset URL
        // on this tenant's own CMS host (e.g. https://cms.steunles.nl/assets/…),
        // whereas `url` is root-relative (/assets/…) and would resolve against
        // the frontend origin, which only proxies /assets to a single build-time
        // host → 404 on a second tenant. Fall back to url (+ absolutise below).
        else raw = first.permalink ?? first.url ?? null;
        if (!raw) return null;
        // Bare filename (no leading / and no protocol) → prefix with /assets/ so
        // the Next.js asset proxy route serves it correctly.
        if (!raw.startsWith("/") && !raw.startsWith("http")) raw = `/assets/${raw}`;
        // Absolutise root-relative asset paths against THIS tenant's own Statamic
        // host. The frontend's `/assets/*` proxy rewrite points at a single
        // build-time host (STATAMIC_API_URL), so on a second tenant a bare
        // `/assets/…` would 404 (it lives on the tenant's own cms.* host, e.g.
        // cms.steunles.nl, not on the frontend origin). Logos render via a plain
        // <img>, so a cross-origin absolute URL needs no next/image remotePattern.
        if (raw.startsWith("/") && this.client.assetBaseUrl) {
          raw = `${this.client.assetBaseUrl}${raw}`;
        }
        return raw;
      };

      // ── Site Settings Global ─────────────────────────────────────────────────
      // Single source of truth: Globals → Site Settings in the Statamic CP.
      // Previously a collection entry; migrated to a global for simpler editorial UX.
      type SocialMediaRow = {
        // File reader: raw string. REST API: augmented { value, label, key } object.
        platform?: string | { value?: string; label?: string; key?: string };
        url?:      string;
        enabled?:  boolean;
      };
      type SiteSettingsGlobal = {
        // Identity
        site_name?:     string;
        site_tagline?:  string;
        // Logo (assets upload)
        logo?:          StatamicAssetValue;
        logo_alt?:      string;
        logo_dark?:     StatamicAssetValue;
        logo_dark_alt?: string;
        // Legacy logo text fields — backward compat
        logo_url?:      string;
        logo_dark_url?: string;
        // Address
        address_street?:  string;
        address_city?:    string;
        address_zip?:     string;
        address_country?: string;
        // Contact
        contact_email?: string;
        contact_phone?: string;
        // Social media grid (platform + url + enabled)
        social_media?: SocialMediaRow[];
        // Top bar
        top_bar_show_search?:            boolean;
        top_bar_search_href?:            string;
        top_bar_show_cart?:              boolean;
        top_bar_cart_href?:              string;
        top_bar_show_language_switcher?: boolean;
        top_bar_cta_enabled?:            boolean;
        top_bar_cta_label?:              string;
        top_bar_cta_href?:               string;
        top_bar_cta_open_in_new_tab?:    boolean;
        // Header CTA
        primary_cta_label?: string;
        primary_cta_href?:  string;
        primary_cta_style?: "primary" | "secondary" | "outline" | "ghost";
        // Language switcher locales (override / single-site fallback)
        locales?: StatamicLocaleEntry[];
        // Footer bottom
        footer_bottom_enabled?:    boolean;
        footer_bottom_copyright?:  string;
        footer_bottom_show_social?: boolean;
        // Maker logo (footer bottom right)
        maker_logo?:      StatamicAssetValue;
        maker_logo_alt?:  string;
        maker_logo_href?: string;
        // Theme
        theme_preset?: string;
      };

      // Fetch the global — this is now the primary (and only) site settings source.
      // Return null when the global file does not exist yet.
      const siteGlobal = await this.client.fetchGlobal<SiteSettingsGlobal>("site_settings");
      if (!siteGlobal) return null;

      // ── Link field resolver ───────────────────────────────────────────────────
      //
      // Statamic's `link` fieldtype stores either a plain URL/anchor or an
      // "entry::uuid" reference (resolved via file reader).  Resolve all link
      // fields in parallel upfront so the rest of the mapping stays synchronous.
      const [
        resolvedSearchHref,
        resolvedCartHref,
        resolvedTopBarCtaHref,
        resolvedHeaderCtaHref,
        resolvedMakerLogoHref,
      ] = await Promise.all([
        this.client.resolveLink(siteGlobal.top_bar_search_href),
        this.client.resolveLink(siteGlobal.top_bar_cart_href),
        this.client.resolveLink(siteGlobal.top_bar_cta_href),
        this.client.resolveLink(siteGlobal.primary_cta_href),
        this.client.resolveLink(siteGlobal.maker_logo_href),
      ]);

      // ── Logo ─────────────────────────────────────────────────────────────────
      // Priority: assets upload field → legacy text field → null
      const logoUrl = resolveStatamicAsset(siteGlobal.logo)
        ?? siteGlobal.logo_url
        ?? null;
      const logoAlt     = siteGlobal.logo_alt ?? siteGlobal.site_name ?? "Logo";
      const logoDarkUrl = resolveStatamicAsset(siteGlobal.logo_dark)
        ?? siteGlobal.logo_dark_url
        ?? null;
      const logoDarkAlt = siteGlobal.logo_dark_alt ?? logoAlt;
      const logo     = logoUrl     ? { url: logoUrl,     alt: logoAlt     } : null;
      const logoDark = logoDarkUrl ? { url: logoDarkUrl, alt: logoDarkAlt } : null;

      // ── Header CTA ───────────────────────────────────────────────────────────
      const headerCtaLabel = siteGlobal.primary_cta_label ?? null;
      const headerCta = headerCtaLabel
        ? {
            label: headerCtaLabel,
            href:  resolvedHeaderCtaHref ?? "#",
            style: siteGlobal.primary_cta_style ?? "primary",
          }
        : null;

      // ── Address ──────────────────────────────────────────────────────────────
      const addressStreet  = siteGlobal.address_street  ?? null;
      const addressCity    = siteGlobal.address_city    ?? null;
      const addressZip     = siteGlobal.address_zip     ?? null;
      const addressCountry = siteGlobal.address_country ?? null;
      const address = (addressStreet || addressCity || addressZip || addressCountry)
        ? {
            street:  addressStreet  ?? undefined,
            city:    addressCity    ?? undefined,
            zipCode: addressZip     ?? undefined,
            country: addressCountry ?? undefined,
            phone:   siteGlobal.contact_phone ?? undefined,
            email:   siteGlobal.contact_email ?? undefined,
          }
        : null;

      // ── Social media ─────────────────────────────────────────────────────────
      // New: read from `social_media` grid in the global (platform + url + enabled).
      // Legacy: fall back to `social_links` array in the collection entry.
      //
      // The REST API augments select fields to { value, label } objects, while
      // the file reader returns the raw string — unwrap both shapes.
      const selectValue = (v: unknown): string | undefined => {
        if (typeof v === "string") return v || undefined;
        if (typeof v === "object" && v !== null) {
          const val = (v as Record<string, unknown>)["value"];
          if (typeof val === "string" && val) return val;
        }
        return undefined;
      };

      const mapSocialGrid = (raw: SocialMediaRow[]): import("../types").SocialLinkData[] =>
        raw
          .filter((r) => !!r.url && r.enabled !== false)
          .map((r) => {
            const platform = selectValue(r.platform);
            return {
              label:    platform ?? r.url ?? "",
              url:      r.url ?? "",
              platform: platform ?? undefined,
              enabled:  true,
            };
          });

      const socialLinks = siteGlobal.social_media && siteGlobal.social_media.length > 0
        ? mapSocialGrid(siteGlobal.social_media)
        : [];

      // ── Top bar (header utility strip) ───────────────────────────────────────
      // Global fields take priority over collection entry fields.
      // The top bar is fully absent (null) only when every item is disabled AND
      // no nav items are in the top_bar navigation tree.
      const tbShowSearch = siteGlobal.top_bar_show_search === true;
      const tbSearchHref = resolvedSearchHref;
      const tbShowCart   = siteGlobal.top_bar_show_cart   === true;
      const tbCartHref   = resolvedCartHref;
      const tbShowLang   = siteGlobal.top_bar_show_language_switcher !== false;

      // Top-bar standalone CTA (separate from the main header CTA)
      const tbCtaEnabled = siteGlobal.top_bar_cta_enabled === true;
      const tbCta = tbCtaEnabled && siteGlobal.top_bar_cta_label
        ? {
            label:        siteGlobal.top_bar_cta_label,
            href:         resolvedTopBarCtaHref ?? "#",
            openInNewTab: siteGlobal.top_bar_cta_open_in_new_tab === true,
          }
        : null;

      // Top-bar navigation tree (links in the top bar, e.g. "Support", "Login")
      //
      // The top bar is shown ONLY when the `top_bar` navigation tree has at least
      // one item.  An empty (or absent) tree means no top bar — simple opt-in via
      // Statamic CP → Navigation → Top Bar.
      let topBarLinks: import("../types").NavigationItemData[] = [];
      try {
        const topBarTree = await this.client.fetchNavTree("top_bar");
        if (topBarTree.length > 0) {
          topBarLinks = topBarTree.map((item) => ({
            id:           item.id,
            label:        item.title,
            href:         item.url,
            openInNewTab: false,
            headerVariant: item.header_variant ?? null,
          }));
        }
      } catch {
        // Non-fatal — top_bar nav tree may not exist yet.
      }

      const topBar = topBarLinks.length > 0
        ? {
            showSearch:           tbShowSearch,
            searchHref:           tbSearchHref ?? undefined,
            showCart:             tbShowCart,
            cartHref:             tbCartHref ?? undefined,
            showLanguageSwitcher: tbShowLang,
            links:                topBarLinks,
            cta:                  tbCta,
          }
        : null;

      // ── Footer bottom strip ──────────────────────────────────────────────────
      // Always build footer bottom when at least one field is set.
      // Reads footer_bottom nav tree for legal/utility links.
      let footerBottomLinks: import("../types").NavigationItemData[] = [];
      try {
        const fbTree = await this.client.fetchNavTree("footer_bottom");
        if (fbTree.length > 0) {
          footerBottomLinks = fbTree.map((item) => ({
            id:           item.id,
            label:        item.title,
            href:         item.url,
            openInNewTab: false,
            headerVariant: null,
          }));
        }
      } catch {
        // Non-fatal — footer_bottom nav may not exist yet.
      }

      // footer_bottom_links now come exclusively from the footer_bottom nav tree.
      // No legacy collection-entry fallback.

      const makerLogoUrl = resolveStatamicAsset(siteGlobal.maker_logo) ?? null;
      const makerLogoAlt = siteGlobal.maker_logo_alt ?? undefined;
      const makerLogoHref = resolvedMakerLogoHref ?? undefined;

      const footerBottomCopyright = siteGlobal.footer_bottom_copyright ?? undefined;
      const footerBottomShowSocial = siteGlobal.footer_bottom_show_social !== false;

      // Build footer bottom when explicitly enabled or when there's something to show.
      const footerBottomEnabled = siteGlobal.footer_bottom_enabled !== false
        && (siteGlobal.footer_bottom_enabled === true
          || footerBottomLinks.length > 0
          || !!footerBottomCopyright
          || !!makerLogoUrl);
      const footerBottom = footerBottomEnabled
        ? {
            copyright:      footerBottomCopyright,
            showSocial:     footerBottomShowSocial,
            links:          footerBottomLinks,
            partnerLogoUrl: makerLogoUrl  ?? undefined,
            partnerLogoAlt: makerLogoAlt,
            partnerHref:    makerLogoHref,
          }
        : null;

      // ── Layout fallbacks ─────────────────────────────────────────────────
      // Layout variants are managed exclusively via Globals → Layout Settings.
      // The site_settings collection entry is gone; no per-entry fallback needed.
      const validHeaderVariants  = ["minimal", "flyout", "mega", "transparent", "triband"] as const;
      const validFooterVariants  = ["minimal", "corporate", "branding"]         as const;
      const validFooterDensities = ["compact", "comfortable", "spacious"]       as const;

      type HV = typeof validHeaderVariants[number];
      type FV = typeof validFooterVariants[number];
      type FD = typeof validFooterDensities[number];

      // These will be overridden below by the layout_settings global.
      // Kept as null until that global is read.
      const headerVariant: HV | null = null;
      const footerVariant: FV | null = null;
      const footerDensity: FD | null = null;

      // ── Layout Settings global (CMS → site_settings fallback) ───────────
      //
      // The layout_settings Global is edited in the Statamic CP under
      // Globals → Layout Settings.  Its values override those from the
      // site_settings collection entry, which in turn override the platform
      // admin Design page (i.e. CMS → platform admin → theme family default).
      //
      // We read it best-effort: if the global doesn't exist (fresh install or
      // file-reader path before the file is populated) we fall through to the
      // site_settings values already read above.
      type LayoutSettingsGlobal = {
        // Select fields arrive as objects ({ value, label, key }) over the HTTP
        // API and as plain strings via the file reader — typed loosely + read
        // through `selectValue()` below.
        header_variant?:    unknown;
        footer_variant?:    unknown;
        footer_density?:    unknown;
        nav_link_size?:     string;
        nav_link_weight?:   string;
        nav_link_tracking?: string;
        dropdown_item_size?: string;
        footer_nav_size?:   string;
        /** Inline section-tabs grid (replaces the legacy section_tabs nav tree).
         *  Over the HTTP API `href` is a link object and `nav_handle` a select
         *  object, so they're typed loosely and normalised at read time. */
        section_tabs?: Array<{ label?: string; href?: unknown; nav_handle?: unknown }>;
      };

      let layoutGlobal: LayoutSettingsGlobal | null = null;
      try {
        layoutGlobal = await this.client.fetchGlobal<LayoutSettingsGlobal>("layout_settings");
      } catch {
        // Non-fatal — layout_settings may not be configured yet on this site.
      }

      // Read layout variant from layout_settings global (sole source now that the
      // site_settings collection entry is gone). Statamic `select` fields come
      // back as `{ value, label, key }` over the HTTP API but as a plain string
      // via the file reader — `selectValue()` (declared above) normalises both.
      const effectiveHeaderVariant: HV | null = (() => {
        const v = selectValue(layoutGlobal?.header_variant);
        return v && validHeaderVariants.includes(v as HV) ? (v as HV) : headerVariant;
      })();
      const effectiveFooterVariant: FV | null = (() => {
        const v = selectValue(layoutGlobal?.footer_variant);
        return v && validFooterVariants.includes(v as FV) ? (v as FV) : footerVariant;
      })();
      const effectiveFooterDensity: FD | null = (() => {
        const v = selectValue(layoutGlobal?.footer_density);
        return v && validFooterDensities.includes(v as FD) ? (v as FD) : footerDensity;
      })();

      // ── Section tabs (header_triband top band) ───────────────────────────────
      //
      // Primary source: the inline `section_tabs` grid stored in layout_settings
      // global — edited right inside CP → Globals → Layout Settings, visible only
      // when the triband header variant is selected (condition on the field).
      //
      // Fallback: legacy `section_tabs` navigation tree (backward-compat for sites
      // provisioned before the inline grid was introduced).
      let sectionTabs: import("../types").SectionTabData[] | null = null;
      const inlineTabRows = layoutGlobal?.section_tabs;
      if (Array.isArray(inlineTabRows) && inlineTabRows.length > 0) {
        // Over the HTTP API `href` arrives as a link object ({ url, … }) and
        // `nav_handle` as a select object ({ value, … }); normalise both to
        // plain strings, otherwise tabs render "[object Object]" links and their
        // per-section nav fails to resolve (or the tab is dropped entirely).
        const tabHref = (h: unknown): string | undefined =>
          typeof h === "string" ? h
          : (h && typeof h === "object")
            ? ((h as { url?: string; permalink?: string }).url ?? (h as { permalink?: string }).permalink)
            : undefined;
        const tabHandle = (h: unknown): string | undefined =>
          typeof h === "string" ? h
          : (h && typeof h === "object" && typeof (h as { value?: string }).value === "string")
            ? (h as { value?: string }).value
            : undefined;
        const resolvedTabs = (await Promise.all(
          inlineTabRows.map(async (row) => {
            const label = typeof row.label === "string" ? row.label : "";
            const href  = tabHref(row.href);
            if (!label || !href) return null;
            const navHandle = tabHandle(row.nav_handle);
            return {
              label,
              href:         (await this.client.resolveLink(href)) ?? href,
              openInNewTab: false,
              // nav_handle absent means "use the default main_nav".
              ...(navHandle ? { navHandle } : {}),
            };
          }),
        )).filter((t): t is import("../types").SectionTabData => t !== null);
        if (resolvedTabs.length > 0) sectionTabs = resolvedTabs;
      } else {
        // Legacy fallback: section_tabs navigation tree (no per-section nav support).
        try {
          const sectionTabsTree = await this.client.fetchNavTree("section_tabs");
          if (sectionTabsTree.length > 0) {
            sectionTabs = sectionTabsTree.map((item) => ({
              label:        item.title,
              href:         item.url,
              openInNewTab: false,
            }));
          }
        } catch {
          // Non-fatal — section_tabs nav tree may not exist yet.
        }
      }

      // ── Per-section navigation trees ─────────────────────────────────────────
      //
      // When section tabs reference custom nav handles (e.g. "jobs_nav"),
      // fetch those trees now so they can be passed to the TriBandNav client
      // component, which will switch between them instantly on URL change.
      // The default "main_nav" is already in mainNavigation — skip it here.
      let sectionTabNavs: import("../types").SiteSettingsData["sectionTabNavs"] = null;
      if (sectionTabs && sectionTabs.length > 0) {
        const uniqueHandles = [
          ...new Set(
            sectionTabs
              .map((t) => t.navHandle)
              .filter((h): h is string => !!h && h !== "main_nav"),
          ),
        ];
        if (uniqueHandles.length > 0) {
          // Helper: map a raw nav tree item to NavigationItemData.
          const mapNavItemSimple = (item: import("./statamic-client").StatamicNavTreeItem): import("../types").NavigationItemData => ({
            id:            item.id,
            label:         item.title,
            href:          item.url,
            openInNewTab:  false,
            headerVariant: item.header_variant ?? null,
            ...(item.children && item.children.length > 0
              ? { children: item.children.map(mapNavItemSimple) }
              : {}),
          });
          type NavEntry = [string, import("../types").NavigationItemData[]];
          const results: NavEntry[] = await Promise.all(
            uniqueHandles.map(async (handle): Promise<NavEntry> => {
              try {
                const tree = await this.client.fetchNavTree(handle);
                return [handle, tree.map(mapNavItemSimple)];
              } catch {
                return [handle, []];
              }
            }),
          );
          const map: Record<string, import("../types").NavigationItemData[]> = {};
          for (const [handle, items] of results) {
            if (items.length > 0) map[handle] = items;
          }
          if (Object.keys(map).length > 0) sectionTabNavs = map;
        }
      }

      // ── Main navigation — Statamic Navigation tree (main_nav) ───────────────
      //
      // Managed via CP → Navigation → Main Nav.  The site_settings collection
      // entry (and its main_navigation grid) has been removed.
      let mainNavigation: import("../types").NavigationItemData[] = [];
      try {
        const navTree = await this.client.fetchNavTree("main_nav");
        if (navTree.length > 0) {
          // Recursive mapper so nested children (sub-pages, mega-menu items)
          // are preserved in the NavigationItemData tree.  Without this, all
          // nav components (NavFlyout, NavMega, NavMegaRich) render a flat row
          // of plain links with no dropdown panels.
          type NavItemData = {
            id: string; label: string; href: string;
            openInNewTab: boolean; headerVariant: string | null;
            description?: string;
            imageUrl?: string;
            megaShowImage?: boolean;
            megaShowDescription?: boolean;
            children?: NavItemData[];
          };
          // Assets are served at {cmsBaseUrl}/assets/{filename} in Statamic.
          const cmsBaseUrl = (process.env.STATAMIC_API_URL ?? "").replace(/\/$/, "");
          const mapNavItem = (item: import("./statamic-client").StatamicNavTreeItem): NavItemData => ({
            id:            item.id,
            label:         item.title,
            href:          item.url,
            openInNewTab:  false,
            headerVariant: item.header_variant ?? null,
            ...(item.excerpt    ? { description: item.excerpt }                                    : {}),
            ...(item.imageFile  ? { imageUrl: `${cmsBaseUrl}/assets/${item.imageFile}` }           : {}),
            ...(item.showMegaImage !== undefined       ? { megaShowImage: item.showMegaImage }             : {}),
            ...(item.showMegaDescription !== undefined ? { megaShowDescription: item.showMegaDescription } : {}),
            ...(item.children && item.children.length > 0
              ? { children: item.children.map(mapNavItem) }
              : {}),
          });
          mainNavigation = navTree.map(mapNavItem);
        }
      } catch {
        // Non-fatal — nav tree may not be populated yet; grid fallback is used.
      }

      // ── Footer columns ────────────────────────────────────────────────────────
      //
      // Single source of truth: the `footer` global (Globals → Footer in the CP).
      // Structure: columns[].{ heading, links[].{ label, href, open_in_new_tab } }
      //
      // The `href` field in each link is now `type: link`, so it may contain an
      // "entry::uuid" reference.  Resolve all link fields in parallel before mapping.
      // The `href` link field arrives as a STRING for plain URLs/anchors, but as
      // an OBJECT ({ url, permalink, … }) for entry references over the HTTP API.
      // Normalise to a plain string before resolving/rendering — otherwise the
      // object stringifies to "[object Object]" in the rendered footer link.
      type FooterLink = { label?: string; href?: unknown; open_in_new_tab?: boolean };
      type FooterGlobal = {
        columns?: Array<{ heading?: string; links?: FooterLink[] }>;
      };
      const rawHref = (l: FooterLink): string | undefined => {
        const h = l.href;
        if (typeof h === "string") return h;
        if (h && typeof h === "object") {
          const o = h as { url?: string; permalink?: string };
          return o.url ?? o.permalink ?? undefined;
        }
        return undefined;
      };
      let footerColumns: import("../types").FooterColumnData[] = [];
      try {
        const footerGlobal = await this.client.fetchGlobal<FooterGlobal>("footer");
        if (footerGlobal?.columns && footerGlobal.columns.length > 0) {
          // Collect all normalised href values and resolve in one parallel batch.
          // resolveLink handles "entry::uuid" strings in file mode; over HTTP the
          // API already resolved the ref into the object's `url`, so it's a no-op.
          const allLinks = footerGlobal.columns.flatMap((col) => col.links ?? []);
          const resolvedHrefs = await Promise.all(
            allLinks.map((l) => this.client.resolveLink(rawHref(l))),
          );
          let idx = 0;
          footerColumns = footerGlobal.columns.map((col) => ({
            title: col.heading ?? undefined,
            links: (col.links ?? []).map((l) => ({
              label:        String(l.label ?? ""),
              href:         resolvedHrefs[idx++] ?? rawHref(l) ?? "#",
              openInNewTab: l.open_in_new_tab === true,
            })),
          }));
        }
      } catch {
        // Non-fatal — footer global may not exist yet.
      }

      // ── Footer navigation ────────────────────────────────────────────────────
      // Secondary flat nav list (separate from footer columns).
      // Reads from the footer_nav navigation tree when present; otherwise empty.
      let footerNavigation: import("../types").NavigationItemData[] = [];
      try {
        const footerNavTree = await this.client.fetchNavTree("footer_nav");
        if (footerNavTree.length > 0) {
          footerNavigation = footerNavTree.map((item) => ({
            id:           item.id,
            label:        item.title,
            href:         item.url,
            openInNewTab: false,
            headerVariant: item.header_variant ?? null,
          }));
        }
      } catch {
        // Non-fatal — footer_nav tree may not exist.
      }

      return {
        siteTitle:        siteGlobal.site_name ?? "Mister Chameleon",
        logo,
        logoDark:         logoDark ?? undefined,
        headerCta,
        mainNavigation,
        footerColumns,
        footerNavigation,
        contactEmail:     siteGlobal.contact_email ?? null,
        contactPhone:     siteGlobal.contact_phone ?? null,
        address:          address ?? undefined,
        socialLinks,
        locales:          await mapSiteLocales(),
        themePreset:      siteGlobal.theme_preset ?? null,
        topBar,
        sectionTabs,
        sectionTabNavs,
        footerBottom,
        headerVariant:  effectiveHeaderVariant,
        footerVariant:  effectiveFooterVariant,
        footerDensity:  effectiveFooterDensity,
        // Nav typography — from layout_settings Global only (no site_settings fallback)
        navLinkSize:        layoutGlobal?.nav_link_size      || null,
        navLinkWeight:      layoutGlobal?.nav_link_weight    || null,
        navLinkTracking:    layoutGlobal?.nav_link_tracking  || null,
        dropdownItemSize:   layoutGlobal?.dropdown_item_size || null,
        footerNavSize:      layoutGlobal?.footer_nav_size    || null,
      };
    } catch (err) {
      logger.warn("[StatamicProvider] getSiteSettings error", { error: String(err) });
      return null;
    }
  }

  async getPageBySlug(slug: string, _locale = "en"): Promise<PageData | null> {
    try {
      // ── Collection entry shortcut ─────────────────────────────────────────
      //
      // Slugs like "vacancies/senior-frontend-developer", "blog/my-post",
      // "team/jasper", or "cases/acme-corp" bypass the pages collection and
      // fetch directly from the corresponding Statamic collection.  This lets
      // collection-detail routes (app/vacancies/[slug]/page.tsx etc.) use the
      // same CMSProvider.getPageBySlug() call as page routes.
      //
      // The collection's YAML page_blocks array is mapped to sections using
      // the same mapper pipeline as pages, so TemplateRenderer sees identical
      // PageData regardless of the source collection.
      const collectionPathMap: Record<string, string> = {
        "vacancies/":    "vacancies",
        "blog/":         "blog",
        "team/":         "team_members",
        "cases/":        "case_studies",
      };
      for (const [prefix, collHandle] of Object.entries(collectionPathMap)) {
        if (slug.startsWith(prefix)) {
          const entrySlug = slug.slice(prefix.length);
          return this.fetchCollectionEntryAsPageData(collHandle, entrySlug, slug);
        }
      }

      // In Live Preview draft mode the injected `_draftPageBlocks` carry the
      // current (unsaved) content, so the page can be rendered entirely from
      // them. The live entry fetch is then only a best-effort source of
      // metadata (title, template, seo) — it must NOT abort rendering when it
      // fails (e.g. the default API client has no reachable base URL in this
      // context). Outside draft mode, a missing entry is a genuine 404.
      const isDraftMode = this._draftPageBlocks !== undefined;

      const fetchedEntry = await this.client
        .fetchEntryBySlug<StatamicPageEntry>(PAGES_COLLECTION, slug)
        .catch(() => null);

      if (!fetchedEntry && !isDraftMode) return null;

      const entry: StatamicPageEntry =
        fetchedEntry ?? ({ id: slug, title: slug } as StatamicPageEntry);

      // Normalise optional meta_keywords: accept both comma-separated string
      // and YAML array.
      const rawKw = entry.meta_keywords;
      const metaKeywords: string[] | undefined = rawKw
        ? Array.isArray(rawKw)
          ? rawKw
          : String(rawKw).split(",").map((k) => k.trim()).filter(Boolean)
        : undefined;

      // ── Map page_blocks to sections (unified model) ───────────────────────
      // context_slot blocks become ContextSlotSectionData entries in sections[].
      // Content blocks become their respective PageSectionData types.
      // Both are interleaved in authored order so position is preserved.
      //
      // In Live Preview draft mode, _draftPageBlocks carries the current
      // (unsaved) CP state.  We use it for ALL pages (not just home) so that
      // changes to any page are reflected in the preview iframe without saving.
      // For the homepage, _draftPageBlocks is the draft page_blocks merged with
      // the variant catalog; for other pages it is just the draft page_blocks.
      let pageBlocks = this._draftPageBlocks !== undefined
        ? (this._draftPageBlocks as unknown as Array<Record<string, unknown>>)
        : (Array.isArray(entry.page_blocks) ? entry.page_blocks : []);

      // ── Enrich related_content entries ────────────────────────────────────
      // In the file-reader path (local dev), the `entries` field of a
      // related_content block is stored as an array of raw strings (slugs /
      // UUIDs).  The mapper expects full Entry objects with id, title, url,
      // overview_image, and excerpt.  We build a lookup map from all pages and
      // replace each string entry with a fully-resolved object before mapping.
      // Enrichment is needed when manual `entries` lack `overview_image`. That's
      // true both for the file-reader path (entries are bare slug/UUID strings)
      // AND the HTTP API (entries are entry-reference objects { id, title, url }
      // that omit the image fields). In both cases we look up the full page and
      // inject overview_image / hover so the cards show their thumbnail.
      const isRelated = (b: Record<string, unknown>) =>
        b["type"] === "related_content" &&
        b["source_mode"] !== "automatic" &&
        Array.isArray(b["entries"]);
      const slugFromUrl = (u: unknown): string | undefined =>
        typeof u === "string" && u ? (u.replace(/^\//, "").split("/").pop() || undefined) : undefined;

      const needsEnrichment = (pageBlocks as Array<Record<string, unknown>>).some(
        (b) =>
          isRelated(b) &&
          (b["entries"] as unknown[]).some(
            (e) =>
              typeof e === "string" ||
              (!!e && typeof e === "object" && (e as Record<string, unknown>)["overview_image"] == null),
          ),
      );

      if (needsEnrichment) {
        try {
          const allPages = await this.client.fetchAll<Record<string, unknown>>(PAGES_COLLECTION);
          const bySlug = new Map<string, Record<string, unknown>>();
          const byId   = new Map<string, Record<string, unknown>>();
          for (const page of allPages) {
            if (typeof page["slug"] === "string") bySlug.set(page["slug"], page);
            if (typeof page["id"]   === "string") byId.set(page["id"],   page);
          }

          pageBlocks = (pageBlocks as Array<Record<string, unknown>>).map((b) => {
            if (!isRelated(b)) return b;

            const enrichedEntries = (b["entries"] as unknown[]).map((e) => {
              // ── File-reader path: entry is a bare slug / UUID string ──────────
              if (typeof e === "string") {
                const page = bySlug.get(e) ?? byId.get(e);
                if (!page) return e;
                const pageSlug = typeof page["slug"] === "string" ? page["slug"] : "";
                return {
                  id:                   page["id"] ?? pageSlug,
                  slug:                 pageSlug,
                  title:                page["title"] ?? pageSlug,
                  url:                  pageSlug === "home" ? "/" : `/${pageSlug}`,
                  overview_image:       page["overview_image"] ?? null,
                  overview_image_hover: page["overview_image_hover"] ?? null,
                  excerpt:              page["excerpt"] ?? null,
                };
              }
              // ── HTTP API path: entry is a reference object; if it already has
              //    an overview_image keep it, otherwise look up the full page and
              //    inject the image fields (without losing the ref's own data). ──
              if (e && typeof e === "object") {
                const obj = e as Record<string, unknown>;
                if (obj["overview_image"] != null) return e;
                const id   = typeof obj["id"] === "string" ? obj["id"] : undefined;
                const slug = slugFromUrl(obj["url"]) ?? slugFromUrl(obj["permalink"]);
                const page = (id ? byId.get(id) : undefined) ?? (slug ? bySlug.get(slug) : undefined);
                if (!page) return e;
                return {
                  ...obj,
                  overview_image:       page["overview_image"] ?? null,
                  overview_image_hover: page["overview_image_hover"] ?? null,
                  excerpt:              obj["excerpt"] ?? page["excerpt"] ?? null,
                };
              }
              return e;
            });
            return { ...b, entries: enrichedEntries };
          });
        } catch (enrichErr) {
          logger.warn("[StatamicProvider] getPageBySlug: failed to enrich related_content entries", {
            slug,
            error: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
          });
        }
      }

      const resolvedPageBlocks = await this.resolveFaqBlocks(
        pageBlocks as Array<Record<string, unknown>>,
      );
      const sections = mapStatamicPageBlocksToSections(resolvedPageBlocks);

      // Infer template key:
      //   home template → "marketing-page"
      //   any context_slot blocks present → "marketing-page"
      //   otherwise → "article-page"
      const hasContextSlots = sections.some((s) => s._type === "contextSlot");
      // entry.template is a raw string via the file reader, but the REST API
      // augments it to { value, label, key } — unwrap both shapes.
      const templateValue = typeof entry.template === "string"
        ? entry.template
        : (entry.template as { value?: string } | null | undefined)?.value;
      const templateKey =
        templateValue === "home" || hasContextSlots
          ? "marketing-page"
          : "article-page";

      return {
        id:             entry.id,
        title:          entry.title ?? slug,
        slug,
        seoDescription: entry.seo_description ?? undefined,
        metaKeywords,
        sections,
        templateKey,
        // contextConfig intentionally omitted — Statamic uses embedded
        // ContextSlotSectionData entries in sections[] instead.
      };
    } catch (err) {
      logger.warn("[StatamicProvider] getPageBySlug error", {
        slug,
        error: String(err),
      });
      return null;
    }
  }

  async getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    const result: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, null]));
    await Promise.all(
      keys.map(async (key) => {
        const hero = await this.getHeroVariant(key);
        if (hero != null) { result[key] = hero; return; }
        const proof = await this.getProofVariant(key);
        if (proof != null) { result[key] = proof; return; }
        const cta = await this.getCTAVariant(key);
        if (cta != null) { result[key] = cta; }
      }),
    );
    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Generic fetch-and-map helper shared by all three public methods.
   *
   * Mirrors StoryblokProvider.fetchVariant() in structure — any developer
   * familiar with the Storyblok implementation will recognise this pattern.
   *
   * The `is_active` check at the provider level mirrors Storyblok's approach:
   * Statamic's API can't filter on content fields server-side (unlike Sanity's
   * GROQ), so we check in code instead.
   *
   * @param collection  The Statamic collection handle, e.g. "hero_variants"
   * @param key         The entry's unique key, e.g. "hero_test"
   * @param mapper      Pure function translating entry content → TResult
   * @param label       Human-readable label for log messages
   */

  // ── Blog (news article) entity methods ───────────────────────────────────────
  //
  // Backed by the "blog" Statamic collection (route: blog/{slug}).
  // The collection handle is "blog"; overview_image is an assets upload field.

  async getNewsArticleBySlug(slug: string): Promise<import("../types").NewsArticleData | null> {
    try {
      type BlogEntry = {
        title?: string;
        date?: string;
        excerpt?: string;
        overview_image?: Array<{ url?: string; permalink?: string } | string> | string;
        tags?: unknown[];
      };
      const entry = await this.client.fetchEntryBySlug<BlogEntry>("blog", slug);
      if (!entry) return null;
      const imageUrl = this.resolveAssetUrl(entry.overview_image);
      return {
        id:          entry.id,
        title:       entry.title ?? entry.slug,
        slug:        entry.slug,
        publishedAt: entry.date ? String(entry.date) : undefined,
        coverImage:  imageUrl ? { url: imageUrl, alt: entry.title ?? "" } : undefined,
        excerpt:     entry.excerpt ?? undefined,
        tags:        Array.isArray(entry.tags)
                       ? entry.tags.filter((t): t is string => typeof t === "string")
                       : undefined,
        isPublished: true,
      };
    } catch {
      return null;
    }
  }

  async getNewsArticles(
    options?: { limit?: number; tags?: string[]; company?: string },
  ): Promise<import("../types").NewsArticleData[]> {
    try {
      type BlogEntry = {
        title?: string;
        date?: string;
        excerpt?: string;
        overview_image?: Array<{ url?: string; permalink?: string } | string> | string;
        tags?: unknown[];
      };
      const entries = await this.client.fetchAll<BlogEntry>("blog", options?.limit ?? 100);
      const articles = entries.map((entry): import("../types").NewsArticleData => {
        const imageUrl = this.resolveAssetUrl(entry.overview_image);
        return {
          id:          entry.id,
          title:       entry.title ?? entry.slug,
          slug:        entry.slug,
          publishedAt: entry.date ? String(entry.date) : undefined,
          coverImage:  imageUrl ? { url: imageUrl, alt: entry.title ?? "" } : undefined,
          excerpt:     entry.excerpt ?? undefined,
          tags:        Array.isArray(entry.tags)
                         ? entry.tags.filter((t): t is string => typeof t === "string")
                         : undefined,
          isPublished: true,
        };
      });
      // Client-side tag filter (Statamic REST can't filter on array fields server-side)
      if (options?.tags?.length) {
        const tagSet = new Set(options.tags);
        return articles.filter((a) => a.tags?.some((t) => tagSet.has(t)));
      }
      return articles;
    } catch {
      return [];
    }
  }

  // ── FAQ collection resolver ───────────────────────────────────────────────────
  //
  // Pre-resolves faq_section blocks that use `source_mode: by_category` or
  // `source_mode: select_items` by fetching the faq_items Statamic collection
  // and injecting `items` into each block before it reaches the synchronous
  // page-block mapper.  Blocks with `source_mode: manual` (or no source_mode)
  // are returned unchanged.

  private async resolveFaqBlocks(
    rawBlocks: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    const hasFaqCollectionBlock = rawBlocks.some(
      (b) =>
        b["type"] === "faq_section" &&
        b["source_mode"] !== "manual" &&
        b["source_mode"] != null,
    );
    if (!hasFaqCollectionBlock) return rawBlocks;

    type FaqEntry = {
      id: string;
      slug?: string;
      question?: string;
      answer?: string;
      category?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    let allFaqItems: FaqEntry[] | null = null;
    const getFaqItems = async (): Promise<FaqEntry[]> => {
      if (allFaqItems === null) {
        try {
          allFaqItems = await this.client.fetchAll<FaqEntry>("faq_items");
        } catch {
          allFaqItems = [];
        }
      }
      return allFaqItems;
    };

    return Promise.all(
      rawBlocks.map(async (block): Promise<Record<string, unknown>> => {
        if (block["type"] !== "faq_section") return block;
        const mode = block["source_mode"];
        if (!mode || mode === "manual") return block;

        if (mode === "by_category") {
          const category =
            typeof block["faq_category"] === "string" ? block["faq_category"] : null;
          const all = await getFaqItems();
          const filtered = all
            .filter(
              (e) => e.is_active !== false && (!category || e.category === category),
            )
            .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
            .map((e) => ({ question: e.question ?? "", answer: e.answer ?? "" }));
          return { ...block, items: filtered };
        }

        if (mode === "select_items") {
          const rawSelected = Array.isArray(block["faq_selected_items"])
            ? (block["faq_selected_items"] as unknown[])
            : [];
          if (rawSelected.length === 0) return block;

          const resolvedItems: Array<{ question: string; answer: string }> = [];
          const pendingIds: string[] = [];

          for (const item of rawSelected) {
            if (typeof item === "object" && item !== null) {
              // Statamic API augmented entry — question/answer are top-level fields
              const obj = item as Record<string, unknown>;
              resolvedItems.push({
                question: typeof obj["question"] === "string" ? obj["question"] : "",
                answer:   typeof obj["answer"]   === "string" ? obj["answer"]   : "",
              });
            } else if (typeof item === "string") {
              pendingIds.push(item);
            }
          }

          // File-based mode: entries field returns UUIDs / slugs — look up in collection
          if (pendingIds.length > 0) {
            const all = await getFaqItems();
            const byId   = new Map(all.map((e) => [e.id, e]));
            const bySlug = new Map(all.map((e) => [e.slug ?? "", e]));
            for (const ref of pendingIds) {
              const entry = byId.get(ref) ?? bySlug.get(ref);
              if (entry) {
                resolvedItems.push({
                  question: entry.question ?? "",
                  answer:   entry.answer   ?? "",
                });
              }
            }
          }

          return { ...block, items: resolvedItems };
        }

        return block;
      }),
    );
  }

  // ── Collection entry → PageData helper ───────────────────────────────────────
  //
  // Fetches a single entry from any Statamic collection and maps it to PageData
  // using the same page_blocks → sections pipeline as getPageBySlug().
  // Used by the collection entry shortcut at the top of getPageBySlug().

  private async fetchCollectionEntryAsPageData(
    collectionHandle: string,
    entrySlug: string,
    fullPath: string,
  ): Promise<PageData | null> {
    try {
      type CollEntry = {
        title?:            string;
        // SEO fields (from mrc_seo_fields fieldset)
        seo_title?:        string;
        seo_description?:  string;
        robots_noindex?:   boolean;
        robots_nofollow?:  boolean;
        canonical_url?:    string;
        og_title?:         string;
        og_description?:   string;
        og_image?:         unknown;
        // content fields
        excerpt?:          string;
        page_blocks?:      unknown;
        // team_members fields
        full_name?:        string;
        role?:             string;
        bio?:              string;
        linkedin_url?:     string;
        overview_image?:   unknown;
      };
      const entry = await this.client.fetchEntryBySlug<CollEntry>(
        collectionHandle,
        entrySlug,
      );
      if (!entry) return null;

      let rawBlocks = Array.isArray(entry.page_blocks)
        ? (entry.page_blocks as Array<Record<string, unknown>>)
        : [];

      // ── Fallback layout for team_members ──────────────────────────────────
      // When no page_blocks are authored, synthesise a basic profile layout
      // from the entry's direct fields so the detail page is never blank.
      if (collectionHandle === "team_members" && rawBlocks.length === 0) {
        const name    = entry.full_name ?? entry.title ?? entrySlug;
        const role    = entry.role;
        const bio     = entry.bio;
        const imgUrl  = this.resolveAssetUrl(
          entry.overview_image as Array<{ url?: string; permalink?: string } | string> | string | undefined,
        ) ?? undefined;

        // Hero-style header: name + role as heading, image as cover.
        rawBlocks = [];

        if (imgUrl || name) {
          rawBlocks.push({
            type:    "text_section",
            variant: "text_split",
            heading: role ? `${name} — ${role}` : name,
            body:    bio ?? "",
          });
        }

        // LinkedIn CTA if available.
        const li = entry.linkedin_url;
        if (typeof li === "string" && li) {
          rawBlocks.push({
            type:        "cta_section",
            heading:     "Connect op LinkedIn",
            cta_label:   "LinkedIn profiel",
            cta_href:    li,
            cta_variant: "primary",
          });
        }
      }

      const resolvedBlocks = await this.resolveFaqBlocks(rawBlocks);
      const sections = mapStatamicPageBlocksToSections(resolvedBlocks);

      const hasRobots = entry.robots_noindex || entry.robots_nofollow;
      return {
        id:             entry.id ?? entrySlug,
        title:          entry.title ?? entrySlug,
        slug:           fullPath,
        seoTitle:       typeof entry.seo_title       === "string" ? entry.seo_title       : undefined,
        seoDescription: typeof entry.seo_description === "string" ? entry.seo_description : undefined,
        robots:         hasRobots
                          ? { noindex: entry.robots_noindex === true, nofollow: entry.robots_nofollow === true }
                          : undefined,
        canonicalUrl:   typeof entry.canonical_url   === "string" ? entry.canonical_url   : undefined,
        ogTitle:        typeof entry.og_title        === "string" ? entry.og_title        : undefined,
        ogDescription:  typeof entry.og_description  === "string" ? entry.og_description  : undefined,
        ogImage:        this.resolveAssetUrl(
                          entry.og_image as Array<{ url?: string; permalink?: string } | string> | string | undefined,
                        ) ?? undefined,
        sections,
        templateKey:    "article-page",
      };
    } catch {
      return null;
    }
  }

  // ── Vacancy entity methods ────────────────────────────────────────────────────
  //
  // Backed by the "vacancies" Statamic collection (route: vacancies/{slug}).
  // The collection handle is "vacancies".

  async getVacancyBySlug(slug: string): Promise<import("../types").VacancyData | null> {
    try {
      type VacancyEntry = {
        title?: string;
        date?: string;
        closing_date?: string;
        location?: string;
        contract_type?: string;
        excerpt?: string;
        overview_image?: Array<{ url?: string; permalink?: string } | string> | string;
      };
      const entry = await this.client.fetchEntryBySlug<VacancyEntry>("vacancies", slug);
      if (!entry) return null;
      return {
        id:           entry.id,
        title:        entry.title ?? entry.slug,
        slug:         entry.slug,
        location:     entry.location    ?? undefined,
        contractType: this.mapContractType(entry.contract_type),
        closingDate:  entry.closing_date ? String(entry.closing_date) : undefined,
        isPublished:  true,
      };
    } catch {
      return null;
    }
  }

  async getVacancies(
    options?: { limit?: number; company?: string },
  ): Promise<import("../types").VacancyData[]> {
    try {
      type VacancyEntry = {
        title?: string;
        date?: string;
        closing_date?: string;
        location?: string;
        contract_type?: string;
        excerpt?: string;
        overview_image?: Array<{ url?: string; permalink?: string } | string> | string;
      };
      const entries = await this.client.fetchAll<VacancyEntry>("vacancies", options?.limit ?? 100);
      return entries.map((entry): import("../types").VacancyData => ({
        id:           entry.id,
        title:        entry.title ?? entry.slug,
        slug:         entry.slug,
        location:     entry.location    ?? undefined,
        contractType: this.mapContractType(entry.contract_type),
        closingDate:  entry.closing_date ? String(entry.closing_date) : undefined,
        isPublished:  true,
      }));
    } catch {
      return [];
    }
  }

  async getCompanyBySlug(_slug: string): Promise<import("../types").CompanyData | null> {
    return null;
  }

  async getCompanies(_options?: { limit?: number }): Promise<import("../types").CompanyData[]> {
    return [];
  }

  // ── Collection resolution ─────────────────────────────────────────────────

  /**
   * Resolves collection-driven block items via the Statamic REST API.
   *
   * Each CollectionKey maps to a Statamic collection endpoint:
   *   articles / news → /api/collections/articles/entries
   *   vacancies       → /api/collections/vacancies/entries
   *   companies       → /api/collections/companies/entries
   *   cases           → /api/collections/cases/entries
   *
   * Full implementation is deferred until Statamic collection endpoints are
   * configured for the tenant. Returns [] in the interim so blocks degrade
   * gracefully to empty rather than erroring.
   */
  async resolveCollection(
    source: import("@/page-config/collection-source").CollectionContentSource,
  ): Promise<import("@/page-config/collection-source").CollectionItem[]> {
    type CollectionItem = import("@/page-config/collection-source").CollectionItem;
    const { collection, mode, limit, sortDir = "desc", selectedIds } = source;

    // For "specific" mode we need all entries so we can filter by selectedId;
    // for "recent" mode we pass a capped limit directly to fetchAll.
    const fetchLimit = mode === "specific" ? 500 : (limit ?? 10);
    let items: CollectionItem[] = [];

    if (collection === "articles" || collection === "news") {
      try {
        type BlogListingEntry = {
          title?:                string;
          date?:                 string;
          show_date?:            boolean;
          excerpt?:              string;
          overview_image?:       Array<{ url?: string; permalink?: string } | string> | string;
          overview_image_hover?: Array<{ url?: string; permalink?: string } | string> | string;
          tags?:                 unknown[];
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allBlogEntries = await this.client.fetchAll<BlogListingEntry>("blog", fetchLimit);
        // Filter out posts whose publication date is in the future.
        const entries = allBlogEntries.filter((entry) => {
          if (!entry.date) return true; // no date → always visible
          const dateStr = String(entry.date).split(" ")[0];
          const pubDate = new Date(dateStr ?? "");
          return isNaN(pubDate.getTime()) || pubDate <= today;
        });
        items = entries.map((entry): CollectionItem => ({
          id:            entry.id,
          title:         entry.title ?? entry.slug,
          href:          `/blog/${entry.slug}`,
          excerpt:       typeof entry.excerpt === "string" ? entry.excerpt : undefined,
          date:          typeof entry.date    === "string" ? entry.date.split(" ")[0] : undefined,
          showDate:      entry.show_date !== false,
          imageUrl:      this.resolveAssetUrl(entry.overview_image)       ?? undefined,
          hoverImageUrl: this.resolveAssetUrl(entry.overview_image_hover) ?? undefined,
          tags:          Array.isArray(entry.tags)
                           ? entry.tags.filter((t): t is string => typeof t === "string")
                           : undefined,
        }));
      } catch {
        return [];
      }
    } else if (collection === "vacancies") {
      try {
        type VacancyListingEntry = {
          title?:                string;
          date?:                 string;
          closing_date?:         string;
          show_date?:            boolean;
          location?:             string;
          contract_type?:        string;
          excerpt?:              string;
          overview_image?:       Array<{ url?: string; permalink?: string } | string> | string;
          overview_image_hover?: Array<{ url?: string; permalink?: string } | string> | string;
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const entries = await this.client.fetchAll<VacancyListingEntry>("vacancies", fetchLimit);
        // Filter out vacancies whose closing_date is in the past.
        const activeEntries = entries.filter((entry) => {
          if (!entry.closing_date) return true; // no closing date → always active
          const closingStr = String(entry.closing_date).split(" ")[0];
          const closing = new Date(closingStr);
          return isNaN(closing.getTime()) || closing >= today;
        });
        items = activeEntries.map((entry): CollectionItem => ({
          id:           entry.id,
          title:        entry.title         ?? entry.slug,
          href:         `/vacancies/${entry.slug}`,
          excerpt:      typeof entry.excerpt       === "string" ? entry.excerpt       : undefined,
          // closing_date is used only for expiry filtering above — never displayed on the card.
          // Only the optional date field (e.g. publication date) is shown, and only when show_date
          // is explicitly set to true (default: false — vacancies don't show dates by default).
          date:         typeof entry.date === "string" ? entry.date.split(" ")[0] : undefined,
          showDate:     entry.show_date === true,
          imageUrl:     this.resolveAssetUrl(entry.overview_image)       ?? undefined,
          hoverImageUrl:this.resolveAssetUrl(entry.overview_image_hover) ?? undefined,
          category:     typeof entry.location === "string" ? entry.location : undefined,
        }));
      } catch {
        return [];
      }
    } else if (collection === "cases") {
      try {
        type CaseEntry = {
          title?:                string;
          date?:                 string;
          show_date?:            boolean;
          client_name?:          string;
          excerpt?:              string;
          overview_image?:       Array<{ url?: string; permalink?: string } | string> | string;
          overview_image_hover?: Array<{ url?: string; permalink?: string } | string> | string;
        };
        const entries = await this.client.fetchAll<CaseEntry>("case_studies", fetchLimit);
        items = entries.map((entry): CollectionItem => ({
          id:             entry.id,
          title:          entry.title    ?? entry.slug,
          href:            `/cases/${entry.slug}`,
          excerpt:         typeof entry.excerpt === "string"  ? entry.excerpt  : undefined,
          date:            typeof entry.date    === "string"  ? entry.date     : undefined,
          showDate:        entry.show_date !== false,
          imageUrl:        this.resolveAssetUrl(entry.overview_image)       ?? undefined,
          hoverImageUrl:   this.resolveAssetUrl(entry.overview_image_hover) ?? undefined,
          category:        typeof entry.client_name === "string" ? entry.client_name : undefined,
        }));
      } catch {
        return [];
      }
    } else if (collection === "team_members") {
      try {
        type TeamEntry = {
          title?:                string;
          full_name?:            string;
          role?:                 string;
          bio?:                  string;
          sort_order?:           number;
          overview_image?:       Array<{ url?: string; permalink?: string } | string> | string;
          overview_image_hover?: Array<{ url?: string; permalink?: string } | string> | string;
        };
        const entries = await this.client.fetchAll<TeamEntry>("team_members", fetchLimit);
        items = entries.map((entry): CollectionItem => ({
          id:            entry.id,
          title:         entry.full_name ?? entry.title ?? entry.slug,
          href:          `/team/${entry.slug}`,
          excerpt:       typeof entry.bio  === "string" ? entry.bio  : undefined,
          category:      typeof entry.role === "string" ? entry.role : undefined,
          showDate:      false, // team members never show a date on their card
          imageUrl:      this.resolveAssetUrl(entry.overview_image)       ?? undefined,
          hoverImageUrl: this.resolveAssetUrl(entry.overview_image_hover) ?? undefined,
        }));
        // honour sort_order ascending for team members (default for this collection)
        if (source.sortDir !== "desc") {
          items = [...items].sort((a, b) => {
            const oa = (entries.find((e) => e.id === a.id) as TeamEntry)?.sort_order ?? 999;
            const ob = (entries.find((e) => e.id === b.id) as TeamEntry)?.sort_order ?? 999;
            return oa - ob;
          });
        }
      } catch {
        return [];
      }
    } else {
      // Unknown collection key — degrade gracefully rather than throwing
      return [];
    }

    if (mode === "specific") {
      if (!selectedIds?.length) return [];
      const idSet = new Set(selectedIds);
      // Filter to selected IDs only — the caller (collection-resolver) re-sorts
      // to match selectedIds order via sortBySelectedIds()
      return items.filter((item) => idSet.has(item.id));
    }

    // recent mode — apply sort direction and limit
    if (sortDir === "asc") items = [...items].reverse();
    if (limit)             items = items.slice(0, limit);
    return items;
  }

  // ── Listing filters ───────────────────────────────────────────────────────

  /**
   * Fetch available filter groups for a collection listing page.
   *
   * Maps each collection to its relevant taxonomies, fetches the published
   * terms for each via StatamicClient.fetchTaxonomyTerms(), and returns
   * them as FilterGroup[].
   *
   * Returns [] for unknown/unsupported collections so FilterBar degrades
   * gracefully to no filter dropdowns.
   */
  async getListingFilters(
    collection: import("@/page-config/collection-source").CollectionKey,
  ): Promise<import("@/page-config/collection-source").ListingFilters> {
    type FilterGroup = import("@/page-config/collection-source").FilterGroup;

    // Taxonomy handles + labels per collection
    const taxonomyMap: Record<string, Array<{ handle: string; label: string }>> = {
      articles: [
        { handle: "sector",       label: "Sector" },
        { handle: "theme",        label: "Theme" },
        { handle: "article_type", label: "Article type" },
        { handle: "solution",     label: "Solution" },
      ],
      news: [
        { handle: "sector",       label: "Sector" },
        { handle: "theme",        label: "Theme" },
        { handle: "article_type", label: "Article type" },
        { handle: "solution",     label: "Solution" },
      ],
      vacancies: [
        { handle: "sector",           label: "Sector" },
        { handle: "employment_type",  label: "Employment type" },
        { handle: "education_level",  label: "Education level" },
        { handle: "location",         label: "Location" },
      ],
      cases: [
        { handle: "sector",   label: "Sector" },
        { handle: "theme",    label: "Theme" },
        { handle: "solution", label: "Solution" },
      ],
    };

    const taxonomies = taxonomyMap[collection];
    if (!taxonomies) return [];

    const groups: FilterGroup[] = [];

    await Promise.all(
      taxonomies.map(async ({ handle, label }) => {
        const terms = await this.client.fetchTaxonomyTerms(handle);
        if (terms.length === 0) return;
        groups.push({
          handle,
          label,
          options: terms.map((t) => ({ value: t.slug, label: t.title })),
        });
      }),
    );

    // Preserve the declared taxonomy order (Promise.all may return out-of-order)
    const orderMap = new Map(taxonomies.map(({ handle }, i) => [handle, i]));
    groups.sort((a, b) => (orderMap.get(a.handle) ?? 0) - (orderMap.get(b.handle) ?? 0));

    return groups;
  }

  // ── Provider management ───────────────────────────────────────────────────

  /**
   * Seeds a new Statamic site with starter content.
   *
   * ─── Architecture ──────────────────────────────────────────────────────────
   *
   *   CMS owns everything that IS the site:
   *     • site_settings  — navigation, CTA button, theme preset, footer, contacts
   *     • pages          — each page's Replicator block array (hero, content, CTA)
   *
   *   Platform owns only the adaptive/personalisation layer:
   *     • adaptive block variants (what to show per visitor segment)
   *     • decision rules (which variant to pick per visitor)
   *     • experiments, analytics, billing
   *
   *   Content blocks in the Replicator include "context slots" (hero, proof, cta)
   *   that carry a `key` field.  At render time, the platform decision engine
   *   reads that key, looks up the matching hero/proof/cta block data in the
   *   Replicator, and returns it.  No separate variant collections needed.
   *
   * ─── What this seeds ──────────────────────────────────────────────────────
   *
   *   1. Pages — each page's Replicator content (context slots + content blocks)
   *              via buildPageStructuredEntry() and upsertEntry().
   *   2. Filesystem globals — site_settings, footer, layout_settings, nav trees
   *              are written directly to content/ via cmsFsPath (idempotent: only
   *              written when the file does not yet exist).
   *
   * Note: site_settings is now a Global, not a collection entry.  CTA, contact
   * email, and top-bar defaults are file-seeded under content/globals/{locale}/
   * only on first provisioning.  Re-running is safe — existing files are skipped.
   */
  async provisionSite(
    _tenant:  TenantSettings,
    options?: {
      dryRun?:              boolean;
      siteType?:            string;
      pages?:               ReadonlyArray<{ presetKey: string; title: string; slug: string }>;
      includeDefaultBlocks?: boolean;
      starterContentMode?:  import("./cms-provider").StarterContentMode;
      includeShowcasePage?: boolean;
      modules?:             readonly string[];
    },
  ): Promise<ProvisionResult> {
    const documentIds: string[] = [];
    const warnings:    string[] = [];

    // ── 1. Seed home page with context slot anchors ──────────────────────────
    //
    // New architecture: the home page stores only context_slot anchors in the
    // unified page_blocks Replicator.  Variant content (hero text, proof stats,
    // CTAs, etc.) lives in the adaptive_blocks catalog (DB or Statamic
    // adaptive_blocks collection) and is looked up at render time.
    //
    // This block is kept intentionally slim — no inline variant content.
    // Seed the adaptive_blocks via the platform admin instead.
    try {
      const saved = await this.client.upsertEntry(PAGES_COLLECTION, "home", {
        title:           "Home",
        blueprint:       "pages",
        template:        "home",
        seo_description: "Mister Chameleon personaliseert je B2B-website voor elke bezoeker — zonder code, live in één middag.",
        // Context slots are embedded as context_slot blocks in page_blocks[]
        // in their authored position (unified model — no dedicated group fields).
        // Variant content lives in the adaptive_blocks catalog (DB).
        page_blocks: [
          { id: "seed-hero",       type: "context_slot", slot_type: "hero",       variant_key: "hero_default",       is_active: true, enabled: true },
          { id: "seed-proof",      type: "context_slot", slot_type: "proof",      variant_key: "proof_default",      is_active: true, enabled: true },
          { id: "seed-cta",        type: "context_slot", slot_type: "cta",        variant_key: "cta_default",        is_active: true, enabled: true },
          { id: "seed-feature",    type: "context_slot", slot_type: "feature",    variant_key: "feature_default",    is_active: true, enabled: true },
          { id: "seed-conversion", type: "context_slot", slot_type: "conversion", variant_key: "conversion_default", is_active: true, enabled: true },
        ],
      });
      documentIds.push(saved.id ?? saved.slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to seed home page variants: ${msg}`);
      logger.warn("[StatamicProvider] provisionSite: home page variants upsert failed", { error: msg });
    }

    // ── Page creation ─────────────────────────────────────────────────────────
    //
    // When a pages array is supplied (from createSiteAction), create or update
    // the corresponding Statamic page entries.  Each page gets a minimal set of
    // fields; the homepage uses slug "home" in Statamic even though its URL slug
    // is an empty string.
    //
    // Only runs when options?.pages is provided (direct provisionSiteAction calls
    // don't pass pages and continue to get pagesCreated: 0 as before).

    let pagesCreated = 0;
    let pagesUpdated = 0;

    if (options?.pages && options.pages.length > 0) {
      for (const page of options.pages) {
        // Statamic stores the homepage as slug "home"; URL slug is "".
        const pageSlug = page.slug === "" ? "home" : page.slug;
        const isHome   = page.slug === "";

        // Build the structured page entry (typed variant arrays + adaptive_slots)
        // when the caller requested blocks and a presetKey was supplied.
        const preset      = getPreset(page.presetKey);
        const contentMode = options?.starterContentMode ?? "fill";
        const structured  =
          options?.includeDefaultBlocks !== false && preset
            ? buildPageStructuredEntry(preset, contentMode)
            : null;

        const pageData: Record<string, unknown> = {
          title:           page.title,
          blueprint:       "pages",
          template:        isHome ? "home" : "default",
          seo_description: "",
          // Spread the structured entry fields so each typed array and
          // adaptive_slots land as top-level keys in the YAML entry — matching
          // the new blueprint tab layout instead of a single flat `content` array.
          ...(structured ?? {}),
        };

        try {
          const saved = await this.client.upsertEntry(PAGES_COLLECTION, pageSlug, pageData);
          documentIds.push(saved.id ?? saved.slug);
          // Statamic's upsertEntry returns 200 for updates, 201 for creates —
          // we treat all as "created" since we can't distinguish on slug-only.
          pagesCreated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`Failed to upsert page "${pageSlug}": ${msg}`);
          logger.warn("[StatamicProvider] provisionSite: page upsert failed", {
            slug:  pageSlug,
            error: msg,
          });
        }
      }

      // Re-tally actual pages vs variants now that we know the counts.
      pagesUpdated = 0; // upsertEntry is idempotent; all count as created
    }

    // ── 4. Sync Statamic files (best-effort, requires STATAMIC_CMS_PATH) ────────
    //
    // When STATAMIC_CMS_PATH is configured this step performs four idempotent
    // file-system writes so that a freshly cloned Statamic site is usable without
    // manual CP setup:
    //
    //   a) pages.yaml blueprint — regenerated from tenant block settings so the CP
    //      only shows allowed variant tabs and content block sets.  Always overwritten.
    //
    //   b) Navigation registration + tree files — created only if absent:
    //        content/navigation/{nav}.yaml                    (nav definition)
    //        content/trees/navigation/{locale}/{nav}.yaml     (empty tree)
    //      Navigations seeded: main_nav, footer_bottom, top_bar.
    //
    //   c) Footer + layout_settings + search_settings globals (locale data) —
    //      created only if absent:
    //        content/globals/{locale}/footer.yaml             (columns: [])
    //        content/globals/{locale}/layout_settings.yaml    (empty)
    //        content/globals/{locale}/search_settings.yaml    (default collections)
    //
    //   d) Global registration files + site_settings locale data — created only if
    //      absent:
    //        content/globals/site_settings.yaml               (title only)
    //        content/globals/footer.yaml                      (title only)
    //        content/globals/layout_settings.yaml             (title only)
    //        content/globals/search_settings.yaml             (title only)
    //        content/globals/{locale}/site_settings.yaml      (default fields)
    //
    // All failures are non-fatal — a warning is added but provisioning succeeds.
    const cmsFsPath = process.env.STATAMIC_CMS_PATH?.trim();
    if (cmsFsPath) {
      const { promises: fsp, existsSync } = await import("fs") as typeof import("fs");
      const nodePath = await import("path") as typeof import("path");
      const absRoot  = nodePath.resolve(process.cwd(), cmsFsPath);

      // Detect primary locale once — shared across all sub-steps.
      // Prefer the tree navigation directory (most reliable); fall back to the
      // globals directory; default to 'nl' when neither exists yet.
      let locale = "nl";
      try {
        const treeNavRoot  = nodePath.join(absRoot, "content", "trees", "navigation");
        const globalsRoot2 = nodePath.join(absRoot, "content", "globals");
        if (existsSync(treeNavRoot)) {
          const dirs = (await fsp.readdir(treeNavRoot, { withFileTypes: true }))
            .filter((e) => e.isDirectory()).map((e) => e.name);
          if (dirs.length > 0) locale = dirs[0];
        } else if (existsSync(globalsRoot2)) {
          const dirs = (await fsp.readdir(globalsRoot2, { withFileTypes: true }))
            .filter((e) => e.isDirectory()).map((e) => e.name);
          if (dirs.length > 0) locale = dirs[0];
        }
      } catch { /* keep default 'nl' */ }

      // ── a) pages.yaml blueprint ────────────────────────────────────────────
      try {
        const { generatePagesBlueprintYaml } = await import(
          "@/cms/schemas/statamic/blueprint-generator"
        ) as typeof import("@/cms/schemas/statamic/blueprint-generator");

        const contextBlocks = _tenant.blocks?.context ?? [];
        const contentBlocks = _tenant.blocks?.content ?? [];

        const yamlContent  = generatePagesBlueprintYaml(contextBlocks, contentBlocks);
        const blueprintDir = nodePath.join(absRoot, "resources", "blueprints", "collections", "pages");
        const blueprintPath = nodePath.join(blueprintDir, "pages.yaml");

        if (!existsSync(blueprintDir)) {
          await fsp.mkdir(blueprintDir, { recursive: true });
        }
        await fsp.writeFile(blueprintPath, yamlContent, "utf8");

        logger.info("[StatamicProvider] Blueprint synced", {
          path: blueprintPath, contextBlocks: contextBlocks.length, contentBlocks: contentBlocks.length,
        });
      } catch (blueprintErr) {
        const msg = blueprintErr instanceof Error ? blueprintErr.message : String(blueprintErr);
        warnings.push(`Blueprint sync skipped: ${msg}`);
        logger.warn("[StatamicProvider] Blueprint sync failed (non-fatal)", { error: msg });
      }

      // ── a′) resources/sites.yaml — multi-lingual site definitions ──────────
      //
      // Generated from tenant.languages when configured (always overwritten so
      // language enablement changes take effect on re-provisioning).
      // When no languages are configured the existing sites.yaml (if any) is
      // left untouched — the Statamic default single-site config remains valid.
      const allLangCodes: string[] = _tenant.languages && _tenant.languages.length > 0
        ? _tenant.languages.map((l) => l.code)
        : [locale];

      if (_tenant.languages && _tenant.languages.length > 0) {
        try {
          const { generateSitesYaml } = await import(
            "@/cms/schemas/statamic/blueprint-generator"
          ) as typeof import("@/cms/schemas/statamic/blueprint-generator");

          const sitesYaml  = generateSitesYaml(_tenant.languages);
          const sitesPath  = nodePath.join(absRoot, "resources", "sites.yaml");
          const resourcesDir = nodePath.join(absRoot, "resources");
          if (!existsSync(resourcesDir)) {
            await fsp.mkdir(resourcesDir, { recursive: true });
          }
          await fsp.writeFile(sitesPath, sitesYaml, "utf8");
          logger.info(`[StatamicProvider] Synced sites.yaml (${_tenant.languages.length} site${_tenant.languages.length !== 1 ? "s" : ""})`);
        } catch (sitesErr) {
          const msg = sitesErr instanceof Error ? sitesErr.message : String(sitesErr);
          warnings.push(`sites.yaml generation skipped: ${msg}`);
          logger.warn("[StatamicProvider] sites.yaml generation failed (non-fatal)", { error: msg });
        }
      }

      // ── b) Navigation registration + empty trees ───────────────────────────
      try {
        const navDefs: Array<{ handle: string; title: string }> = [
          { handle: "main_nav",      title: "Main Navigation" },
          { handle: "footer_bottom", title: "Footer Bottom"   },
          { handle: "footer_nav",    title: "Footer Nav"      },
          { handle: "top_bar",       title: "Top Bar"         },
          // NOTE: section_tabs is no longer a Statamic navigation — tabs are
          // configured via the inline grid in Globals → Layout Settings.
        ];

        const navContentDir = nodePath.join(absRoot, "content", "navigation");
        await fsp.mkdir(navContentDir, { recursive: true });

        // Build sites: list for nav registration files — one line per language code.
        const navSitesLines = allLangCodes.map((c) => `  - ${c}`).join("\n");

        for (const nav of navDefs) {
          // Navigation registration file (describes the nav + which sites it belongs to)
          const regPath = nodePath.join(navContentDir, `${nav.handle}.yaml`);
          if (!existsSync(regPath)) {
            await fsp.writeFile(
              regPath,
              `title: '${nav.title}'\nsites:\n${navSitesLines}\ncollections:\n  - pages\n`,
              "utf8",
            );
            logger.info(`[StatamicProvider] Seeded nav registration: ${nav.handle}`);
          }
        }

        // Navigation tree files — one per nav per language locale.
        // Created only when absent so editors can add items without data loss.
        for (const langCode of allLangCodes) {
          const treeLocaleDir = nodePath.join(absRoot, "content", "trees", "navigation", langCode);
          await fsp.mkdir(treeLocaleDir, { recursive: true });
          for (const nav of navDefs) {
            const treePath = nodePath.join(treeLocaleDir, `${nav.handle}.yaml`);
            if (!existsSync(treePath)) {
              await fsp.writeFile(treePath, "tree: []\n", "utf8");
              logger.info(`[StatamicProvider] Seeded nav tree: ${nav.handle} (${langCode})`);
            }
          }
        }
      } catch (navErr) {
        const msg = navErr instanceof Error ? navErr.message : String(navErr);
        warnings.push(`Navigation seeding skipped: ${msg}`);
        logger.warn("[StatamicProvider] Navigation seeding failed (non-fatal)", { error: msg });
      }

      // ── c) Footer + layout_settings locale data ────────────────────────────
      //
      // Seeded for every configured language so that Statamic can serve
      // each site's globals.  Created only when absent.
      try {
        for (const langCode of allLangCodes) {
          const globalsLocaleDir = nodePath.join(absRoot, "content", "globals", langCode);
          await fsp.mkdir(globalsLocaleDir, { recursive: true });

          const footerPath = nodePath.join(globalsLocaleDir, "footer.yaml");
          if (!existsSync(footerPath)) {
            await fsp.writeFile(footerPath, "columns: []\n", "utf8");
            logger.info(`[StatamicProvider] Seeded footer global (${langCode})`);
          }

          const layoutPath = nodePath.join(globalsLocaleDir, "layout_settings.yaml");
          if (!existsSync(layoutPath)) {
            await fsp.writeFile(layoutPath, "{}\n", "utf8");
            logger.info(`[StatamicProvider] Seeded layout_settings global (${langCode})`);
          }

          // Search Settings — controls which collections the site search scans
          // (read by StatamicSearchProvider and the Meilisearch indexer).
          // Defaults mirror the provider's built-in DEFAULT_COLLECTIONS.
          const searchSettingsPath = nodePath.join(globalsLocaleDir, "search_settings.yaml");
          if (!existsSync(searchSettingsPath)) {
            await fsp.writeFile(
              searchSettingsPath,
              "searchable_collections:\n  - pages\n  - blog\n  - vacancies\n",
              "utf8",
            );
            logger.info(`[StatamicProvider] Seeded search_settings global (${langCode})`);
          }
        }
      } catch (localeErr) {
        const msg = localeErr instanceof Error ? localeErr.message : String(localeErr);
        warnings.push(`Locale globals seeding skipped: ${msg}`);
        logger.warn("[StatamicProvider] Locale globals seeding failed (non-fatal)", { error: msg });
      }

      // ── d) Global registration files + site_settings locale data ──────────
      //
      // Global registration files tell Statamic what globals exist so they
      // appear in CP → Globals.  The locale data file for site_settings carries
      // the default CTA, top-bar toggles, etc. that the provider reads at runtime.
      try {
        const globalsRoot = nodePath.join(absRoot, "content", "globals");
        await fsp.mkdir(globalsRoot, { recursive: true });

        // Root-level registration files (title only — no locale-specific data)
        const globalRegs: Array<{ handle: string; title: string }> = [
          { handle: "site_settings",   title: "Site Settings"   },
          { handle: "footer",          title: "Footer"          },
          { handle: "layout_settings", title: "Layout Settings" },
          { handle: "search_settings", title: "Search Settings" },
        ];
        for (const g of globalRegs) {
          const regPath = nodePath.join(globalsRoot, `${g.handle}.yaml`);
          if (!existsSync(regPath)) {
            await fsp.writeFile(regPath, `title: '${g.title}'\n`, "utf8");
            logger.info(`[StatamicProvider] Seeded global registration: ${g.handle}`);
          }
        }

        // site_settings locale data — identity, CTA, and top-bar defaults.
        // Only written when the file does not yet exist so manual CP edits are
        // never overwritten on subsequent provisionSite() calls.
        //
        // NOTE: theme_preset is intentionally NOT seeded here.  The active theme
        // is managed exclusively via the platform DB (admin Design page) and
        // writing it here would overwrite any DB-set theme on re-provisioning.
        //
        // The language switcher is auto-enabled when more than one language is
        // configured and at least one is enabled; otherwise it defaults to false.
        const enabledLangCount = _tenant.languages
          ? _tenant.languages.filter((l) => l.enabled).length
          : 1;
        const showLanguageSwitcher = enabledLangCount > 1;

        // Seed site_settings for each configured language.
        for (const langCode of allLangCodes) {
          const localeDir        = nodePath.join(globalsRoot, langCode);
          const siteSettingsPath = nodePath.join(localeDir, "site_settings.yaml");
          if (!existsSync(siteSettingsPath)) {
            await fsp.mkdir(localeDir, { recursive: true });
            // Escape single quotes in the tenant name for YAML single-quoted syntax.
            const siteName = (_tenant.name ?? "My Site").replace(/'/g, "''");
            const siteSettingsYaml = [
              `site_name: '${siteName}'`,
              `primary_cta_label: Contact`,
              `primary_cta_href: /contact`,
              `primary_cta_style: primary`,
              `top_bar_show_search: false`,
              `top_bar_show_cart: false`,
              `top_bar_show_language_switcher: ${showLanguageSwitcher}`,
              `top_bar_cta_enabled: false`,
              `footer_bottom_enabled: true`,
              `footer_bottom_show_social: false`,
              "",
            ].join("\n");
            await fsp.writeFile(siteSettingsPath, siteSettingsYaml, "utf8");
            logger.info(`[StatamicProvider] Seeded site_settings global (${langCode})`);
          }
        }
      } catch (globalErr) {
        const msg = globalErr instanceof Error ? globalErr.message : String(globalErr);
        warnings.push(`Global registration seeding skipped: ${msg}`);
        logger.warn("[StatamicProvider] Global registration seeding failed (non-fatal)", { error: msg });
      }

      // ── e) Platform fieldsets (mrc_*) ─────────────────────────────────────
      //
      // Copies every mrc_*.yaml from the platform repo's fieldsets directory
      // to the tenant's resources/fieldsets/.  These files are always
      // overwritten — they are platform-managed and never edited by tenants.
      try {
        const platformFieldsetsDir = nodePath.resolve(
          process.cwd(),
          "mister-chameleon-cms",
          "mister-chameleon-cms",
          "resources",
          "fieldsets",
        );
        const tenantFieldsetsDir = nodePath.join(absRoot, "resources", "fieldsets");

        if (existsSync(platformFieldsetsDir)) {
          const allFiles = await fsp.readdir(platformFieldsetsDir);
          const mrcFiles = allFiles.filter((f) => f.startsWith("mrc_") && f.endsWith(".yaml"));

          if (mrcFiles.length > 0) {
            await fsp.mkdir(tenantFieldsetsDir, { recursive: true });
            for (const filename of mrcFiles) {
              const src = nodePath.join(platformFieldsetsDir, filename);
              const dst = nodePath.join(tenantFieldsetsDir, filename);
              await fsp.copyFile(src, dst);
            }
            logger.info(`[StatamicProvider] Synced ${mrcFiles.length} platform fieldsets (mrc_*)`);
          }
        } else {
          warnings.push(
            "Platform fieldsets directory not found — mrc_* fieldsets were not synced. " +
            "Expected: mister-chameleon-cms/mister-chameleon-cms/resources/fieldsets/",
          );
        }
      } catch (fieldsetErr) {
        const msg = fieldsetErr instanceof Error ? fieldsetErr.message : String(fieldsetErr);
        warnings.push(`Platform fieldset sync skipped: ${msg}`);
        logger.warn("[StatamicProvider] Platform fieldset sync failed (non-fatal)", { error: msg });
      }

      // ── f) Collection config + blueprints ──────────────────────────────────
      //
      // Seeds the collection YAML definition, entry directory, and blueprint
      // for blog, vacancies, case_studies, and team_members.
      //
      // All writes are idempotent — they only happen when the target file/dir
      // does not yet exist, so manual CP edits and re-provisioning do not
      // overwrite one another.
      //
      // Blueprint structure follows the 3-tab layout (Meta / Card / Content)
      // used across all tenant collections. Taxonomies are NOT pre-configured
      // here — tenants link taxonomies to collections via CP → Collections →
      // [collection] → edit → Taxonomies, which writes the collection YAML.
      try {
        const collectionsRoot = nodePath.join(absRoot, "content", "collections");
        await fsp.mkdir(collectionsRoot, { recursive: true });

        // ── Collection YAML definitions ──────────────────────────────────────
        // dated:true enables the Statamic content calendar for the collection.
        // date_behavior controls whether past/future entries are publicly visible.
        // team_members are not dated (no publication schedule).
        //
        // sites: includes all configured language codes so every collection is
        // immediately available for translation in every configured language.
        const collectionSitesLines = allLangCodes.map((c) => `  - ${c}`).join("\n");

        const collectionYamls: Array<{ handle: string; yaml: string }> = [
          {
            handle: "blog",
            yaml: [
              "title: Artikelen",
              "sites:",
              collectionSitesLines,
              "route: 'blog/{slug}'",
              "propagate: true",
              "dated: true",
              "date_behavior:",
              "  past: public",
              "  future: private",
              "",
            ].join("\n"),
          },
          {
            handle: "vacancies",
            yaml: [
              "title: Vacatures",
              "sites:",
              collectionSitesLines,
              "route: 'vacancies/{slug}'",
              "propagate: true",
              "dated: true",
              "date_behavior:",
              "  past: public",
              "  future: public",
              "",
            ].join("\n"),
          },
          {
            handle: "case_studies",
            yaml: [
              "title: Cases",
              "sites:",
              collectionSitesLines,
              "route: 'cases/{slug}'",
              "propagate: true",
              "dated: true",
              "date_behavior:",
              "  past: public",
              "  future: private",
              "",
            ].join("\n"),
          },
          {
            handle: "team_members",
            yaml: [
              "title: Team",
              "sites:",
              collectionSitesLines,
              "template: false",
              "route: false",
              "",
            ].join("\n"),
          },
        ];

        for (const col of collectionYamls) {
          const collYamlPath = nodePath.join(collectionsRoot, `${col.handle}.yaml`);
          if (!existsSync(collYamlPath)) {
            await fsp.writeFile(collYamlPath, col.yaml, "utf8");
            logger.info(`[StatamicProvider] Seeded collection config: ${col.handle}`);
          }
          // Entry directory (must exist for Statamic to serve entries)
          const entryDir = nodePath.join(collectionsRoot, col.handle);
          if (!existsSync(entryDir)) {
            await fsp.mkdir(entryDir, { recursive: true });
            logger.info(`[StatamicProvider] Created entry dir: collections/${col.handle}`);
          }
        }

        // ── Blueprint YAML for each collection ───────────────────────────────
        // Seeded only if absent (idempotent).
        // Path: resources/blueprints/collections/{handle}/{handle}.yaml
        //
        // All blueprints use the 3-tab layout:
        //   Meta    — title, dates, and admin fields
        //   Card    — overview_image, detail_image, excerpt (for listing/search cards)
        //   Content — page_blocks replicator for detail page
        //
        // Shared replicator block sets (text_section, rich_text, image_block,
        // quote_block, cta_section, form_section) are imported from fieldset
        // partials defined in the platform fieldsets directory.

        const cardTab = [
          "  card:",
          "    display: Card",
          "    sections:",
          "      - fields:",
          "          - import: mrc_card_fields",
        ];

        const replicatorSets = (label: string) => [
          `              display: ${label}`,
          "              collapse: true",
          "              button_label: Add block",
          "              sets:",
          "                text_and_media:",
          "                  display: Text & Media",
          "                  sets:",
          "                    text_section:",
          "                      display: Text section",
          "                      fields:",
          "                        - import: mrc_text_section",
          "                    rich_text:",
          "                      display: Rich text",
          "                      fields:",
          "                        - import: mrc_rich_text",
          "                    image:",
          "                      display: Text + Image",
          "                      fields:",
          "                        - import: mrc_image_block",
          "                    quote:",
          "                      display: Quote",
          "                      fields:",
          "                        - import: mrc_quote_block",
          "                conversion_and_forms:",
          "                  display: Conversion",
          "                  sets:",
          "                    cta_section:",
          "                      display: CTA section",
          "                      fields:",
          "                        - import: mrc_cta_section",
          "                    form_section:",
          "                      display: Form section",
          "                      fields:",
          "                        - import: mrc_form_section",
        ];

        const blogBlueprintLines = [
          "title: Blog Article",
          "tabs:",
          "  meta:",
          "    display: Meta",
          "    sections:",
          "      - fields:",
          "          - handle: title",
          "            field:",
          "              type: text",
          "              display: Title",
          "              validate: required",
          "          - handle: date",
          "            field:",
          "              type: date",
          "              display: Publication date",
          "              instructions: Date this article will be published. Also used on the content calendar.",
          "              time_enabled: true",
          "              time_seconds_enabled: false",
          "          - handle: seo_description",
          "            field:",
          "              type: textarea",
          "              display: SEO description",
          "              instructions: Meta description shown in search results (max 160 chars).",
          ...cardTab,
          "  content:",
          "    display: Content",
          "    sections:",
          "      - fields:",
          "          - handle: page_blocks",
          "            field:",
          "              type: replicator",
          ...replicatorSets("Content blocks"),
          "",
        ];

        const vacanciesBlueprintLines = [
          "title: Vacancy",
          "tabs:",
          "  meta:",
          "    display: Meta",
          "    sections:",
          "      - fields:",
          "          - handle: title",
          "            field:",
          "              type: text",
          "              display: Job title",
          "              validate: required",
          "          - handle: date",
          "            field:",
          "              type: date",
          "              display: Publication date",
          "              instructions: Date this vacancy will be published. Also used on the content calendar.",
          "              time_enabled: true",
          "              time_seconds_enabled: false",
          "          - handle: closing_date",
          "            field:",
          "              type: date",
          "              display: Closing date",
          "              instructions: Application deadline.",
          ...cardTab,
          "  content:",
          "    display: Content",
          "    sections:",
          "      - fields:",
          "          - handle: page_blocks",
          "            field:",
          "              type: replicator",
          ...replicatorSets("Content blocks"),
          "",
        ];

        const caseStudiesBlueprintLines = [
          "title: Case Study",
          "tabs:",
          "  meta:",
          "    display: Meta",
          "    sections:",
          "      - fields:",
          "          - handle: title",
          "            field:",
          "              type: text",
          "              display: Title",
          "              validate: required",
          "          - handle: is_active",
          "            field:",
          "              type: toggle",
          "              display: Active",
          "              default: true",
          "          - handle: date",
          "            field:",
          "              type: date",
          "              display: Published date",
          "              instructions: Publication date — also used on the content calendar.",
          "          - handle: client_name",
          "            field:",
          "              type: text",
          "              display: Client name",
          "              validate: required",
          "          - handle: client_logo",
          "            field:",
          "              type: assets",
          "              display: Client logo",
          "              max_files: 1",
          "              instructions: Company logo shown in case study header and related content blocks.",
          "          - handle: seo_description",
          "            field:",
          "              type: textarea",
          "              display: SEO description",
          "              instructions: Meta description shown in search results (max 160 chars).",
          ...cardTab,
          "  content:",
          "    display: Content",
          "    sections:",
          "      - display: Case Details",
          "        fields:",
          "          - handle: challenge",
          "            field:",
          "              type: textarea",
          "              display: Challenge",
          "              instructions: Describe the client's challenge or problem.",
          "          - handle: solution_description",
          "            field:",
          "              type: textarea",
          "              display: Solution description",
          "              instructions: Describe the solution or approach taken.",
          "          - handle: results",
          "            field:",
          "              type: replicator",
          "              display: Results",
          "              button_label: Add result",
          "              sets:",
          "                result:",
          "                  display: Result",
          "                  fields:",
          "                    - handle: metric",
          "                      field:",
          "                        type: text",
          "                        display: Metric",
          "                    - handle: value",
          "                      field:",
          "                        type: text",
          "                        display: Value",
          "                    - handle: description",
          "                      field:",
          "                        type: text",
          "                        display: Description",
          "          - handle: quote",
          "            field:",
          "              type: textarea",
          "              display: Pull quote",
          "          - handle: quote_author",
          "            field:",
          "              type: text",
          "              display: Quote author",
          "          - handle: quote_title",
          "            field:",
          "              type: text",
          "              display: Quote author title",
          "      - display: Page Blocks",
          "        fields:",
          "          - handle: page_blocks",
          "            field:",
          "              type: replicator",
          ...replicatorSets("Content blocks"),
          "",
        ];

        const teamMembersBlueprintLines = [
          "title: Team Member",
          "tabs:",
          "  meta:",
          "    display: Meta",
          "    sections:",
          "      - fields:",
          "          - handle: title",
          "            field:",
          "              type: text",
          "              display: Title",
          "              validate: required",
          "          - handle: is_active",
          "            field:",
          "              type: toggle",
          "              display: Active",
          "              default: true",
          "          - handle: full_name",
          "            field:",
          "              type: text",
          "              display: Full name",
          "              validate: required",
          "          - handle: role",
          "            field:",
          "              type: text",
          "              display: Role",
          "              validate: required",
          "          - handle: bio",
          "            field:",
          "              type: textarea",
          "              display: Bio",
          "              instructions: Short biography shown on listing and detail pages.",
          "          - handle: linkedin_url",
          "            field:",
          "              type: text",
          "              display: LinkedIn URL",
          "          - handle: sort_order",
          "            field:",
          "              type: integer",
          "              display: Sort order",
          "              instructions: Lower numbers appear first in listings.",
          ...cardTab,
          "  content:",
          "    display: Content",
          "    sections:",
          "      - fields:",
          "          - handle: page_blocks",
          "            field:",
          "              type: replicator",
          "              instructions: Extended content blocks for the team member detail page.",
          ...replicatorSets("Content blocks"),
          "",
        ];

        const blueprints: Array<{ handle: string; filename: string; lines: string[] }> = [
          { handle: "blog",         filename: "blog.yaml",         lines: blogBlueprintLines         },
          { handle: "vacancies",    filename: "vacancies.yaml",    lines: vacanciesBlueprintLines    },
          { handle: "case_studies", filename: "case_study.yaml",   lines: caseStudiesBlueprintLines  },
          { handle: "team_members", filename: "team_member.yaml",  lines: teamMembersBlueprintLines  },
        ];
        for (const bp of blueprints) {
          const bpDir  = nodePath.join(absRoot, "resources", "blueprints", "collections", bp.handle);
          const bpPath = nodePath.join(bpDir, bp.filename);
          if (!existsSync(bpDir)) await fsp.mkdir(bpDir, { recursive: true });
          if (!existsSync(bpPath)) {
            await fsp.writeFile(bpPath, bp.lines.join("\n"), "utf8");
            logger.info(`[StatamicProvider] Seeded blueprint: ${bp.handle}/${bp.filename}`);
          }
        }
      } catch (collectionErr) {
        const msg = collectionErr instanceof Error ? collectionErr.message : String(collectionErr);
        warnings.push(`Collection seeding skipped: ${msg}`);
        logger.warn("[StatamicProvider] Collection seeding failed (non-fatal)", { error: msg });
      }

      // ── g) Globals blueprints (always overwrite) ───────────────────────────
      //
      // The 3 globals blueprints (site_settings, footer, layout_settings) are
      // platform-managed. Overwritten on every init, same policy as mrc_* fieldsets.
      try {
        const platformGlobalsBpDir = nodePath.resolve(
          process.cwd(),
          "mister-chameleon-cms",
          "mister-chameleon-cms",
          "resources",
          "blueprints",
          "globals",
        );
        const tenantGlobalsBpDir = nodePath.join(absRoot, "resources", "blueprints", "globals");

        if (existsSync(platformGlobalsBpDir)) {
          const allFiles = await fsp.readdir(platformGlobalsBpDir);
          const yamlFiles = allFiles.filter((f) => f.endsWith(".yaml"));
          if (yamlFiles.length > 0) {
            await fsp.mkdir(tenantGlobalsBpDir, { recursive: true });
            for (const filename of yamlFiles) {
              await fsp.copyFile(
                nodePath.join(platformGlobalsBpDir, filename),
                nodePath.join(tenantGlobalsBpDir, filename),
              );
            }
            logger.info(`[StatamicProvider] Synced ${yamlFiles.length} globals blueprints`);
          }
        } else {
          warnings.push("Platform globals blueprints directory not found — globals blueprints were not synced.");
        }
      } catch (globalsBpErr) {
        const msg = globalsBpErr instanceof Error ? globalsBpErr.message : String(globalsBpErr);
        warnings.push(`Globals blueprints sync skipped: ${msg}`);
        logger.warn("[StatamicProvider] Globals blueprints sync failed (non-fatal)", { error: msg });
      }

      // ── h) Taxonomy definitions (if absent) ───────────────────────────────
      //
      // Seeds content/taxonomies/*.yaml from the platform inner repo.
      // Written only when absent — tenants may add their own terms and the
      // taxonomy YAML records those alongside the definition.
      try {
        const platformTaxonomyDir = nodePath.resolve(
          process.cwd(),
          "mister-chameleon-cms",
          "mister-chameleon-cms",
          "content",
          "taxonomies",
        );
        const tenantTaxonomyDir = nodePath.join(absRoot, "content", "taxonomies");

        if (existsSync(platformTaxonomyDir)) {
          const allFiles = await fsp.readdir(platformTaxonomyDir);
          const yamlFiles = allFiles.filter((f) => f.endsWith(".yaml"));
          if (yamlFiles.length > 0) {
            await fsp.mkdir(tenantTaxonomyDir, { recursive: true });
            let seededCount = 0;
            for (const filename of yamlFiles) {
              const dst = nodePath.join(tenantTaxonomyDir, filename);
              if (!existsSync(dst)) {
                await fsp.copyFile(nodePath.join(platformTaxonomyDir, filename), dst);
                seededCount++;
              }
            }
            if (seededCount > 0) {
              logger.info(`[StatamicProvider] Seeded ${seededCount} taxonomy definitions`);
            }
          }
        }
      } catch (taxonomyErr) {
        const msg = taxonomyErr instanceof Error ? taxonomyErr.message : String(taxonomyErr);
        warnings.push(`Taxonomy definitions seeding skipped: ${msg}`);
        logger.warn("[StatamicProvider] Taxonomy definitions seeding failed (non-fatal)", { error: msg });
      }

      // ── i) Taxonomy blueprints (always overwrite) ──────────────────────────
      //
      // Platform-managed blueprint YAML for each taxonomy. Always overwritten
      // so the field definitions stay in sync with the codebase.
      try {
        const platformTaxBpDir = nodePath.resolve(
          process.cwd(),
          "mister-chameleon-cms",
          "mister-chameleon-cms",
          "resources",
          "blueprints",
          "taxonomies",
        );
        const tenantTaxBpDir = nodePath.join(absRoot, "resources", "blueprints", "taxonomies");

        if (existsSync(platformTaxBpDir)) {
          const allFiles = await fsp.readdir(platformTaxBpDir);
          const yamlFiles = allFiles.filter((f) => f.endsWith(".yaml"));
          if (yamlFiles.length > 0) {
            await fsp.mkdir(tenantTaxBpDir, { recursive: true });
            for (const filename of yamlFiles) {
              await fsp.copyFile(
                nodePath.join(platformTaxBpDir, filename),
                nodePath.join(tenantTaxBpDir, filename),
              );
            }
            logger.info(`[StatamicProvider] Synced ${yamlFiles.length} taxonomy blueprints`);
          }
        }
      } catch (taxBpErr) {
        const msg = taxBpErr instanceof Error ? taxBpErr.message : String(taxBpErr);
        warnings.push(`Taxonomy blueprints sync skipped: ${msg}`);
        logger.warn("[StatamicProvider] Taxonomy blueprints sync failed (non-fatal)", { error: msg });
      }

      // ── j) Home page flat-file seed (if absent) ────────────────────────────
      //
      // On a fresh Statamic install the home.md flat file does not yet exist.
      // The upsertEntry() call above writes only the page_blocks replicator.
      // This step copies the platform inner repo's home.md — which carries the
      // full typed variant catalog (hero_variants, proof_variants, etc.) — to
      // the tenant's pages collection so that live preview and personalization
      // work immediately after provisioning.
      //
      // Skipped when the file already exists so that existing variant content
      // is never overwritten on re-provisioning.
      try {
        const platformHomePath = nodePath.resolve(
          process.cwd(),
          "mister-chameleon-cms",
          "mister-chameleon-cms",
          "content",
          "collections",
          "pages",
          locale,
          "home.md",
        );
        const tenantPagesLocaleDir = nodePath.join(
          absRoot, "content", "collections", "pages", locale,
        );
        const tenantHomePath = nodePath.join(tenantPagesLocaleDir, "home.md");

        if (existsSync(platformHomePath) && !existsSync(tenantHomePath)) {
          await fsp.mkdir(tenantPagesLocaleDir, { recursive: true });
          await fsp.copyFile(platformHomePath, tenantHomePath);
          logger.info(`[StatamicProvider] Seeded home.md from platform template (${locale})`);
        }
      } catch (homeErr) {
        const msg = homeErr instanceof Error ? homeErr.message : String(homeErr);
        warnings.push(`Home page flat-file seed skipped: ${msg}`);
        logger.warn("[StatamicProvider] Home page flat-file seed failed (non-fatal)", { error: msg });
      }
    }

    return {
      ok:                  true,
      documentIds,
      pagesCreated,
      pagesUpdated,
      variantsWritten:     0,           // No legacy variant collections — blocks live in Replicator
      siteSettingsWritten: documentIds.length > 0,
      navItemsWritten:     0,           // Nav items are managed via CP navigation trees
      warnings,
    };
  }

  /** Tests connectivity by attempting a low-cost API read. */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Fetching a non-existent entry returns null (not a throw) on 404 —
      // a thrown error signals a real connectivity or auth failure.
      await this.client.fetchEntry("__connection_test__", "__platform_test__");
      return { ok: true, provider: "statamic", readAccess: true };
    } catch (err) {
      return {
        ok:       false,
        provider: "statamic",
        error:    err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Replicator helper ──────────────────────────────────────────────────

  /**
   * Fetches the home page Replicator blocks and caches them for the
   * lifetime of this provider instance.
   *
   * All variant lookups (getHeroVariant, getProofVariant, getCTAVariant) call
   * this once per request — the home page is fetched exactly once and the
   * content array is searched in-memory for each subsequent lookup.
   *
   * Returns [] if the home page has no `content` field, is not found,
   * or if the Statamic server is offline.
   */
  private async getHomePageContent(): Promise<StatamicPageReplicatorBlock[]> {
    // Return cached result if available (null = tried and found nothing)
    if (this._homePageContent !== undefined) {
      return this._homePageContent ?? [];
    }

    // Fast path: when STATAMIC_CMS_PATH is set, read flat files directly.
    // This completely bypasses the PHP HTTP API (which strips Replicator blocks
    // due to blueprint type-handle mismatches) and the StatamicClient chain.
    if (process.env.STATAMIC_CMS_PATH) {
      const blocks = readHomeBlocksFromDisk();
      if (blocks.length > 0) {
        this._homePageContent = blocks;
        return this._homePageContent;
      }
    }

    // HTTP path (production / when STATAMIC_CMS_PATH is not set).
    try {
      const page = await this.client.fetchEntryBySlug<StatamicPageEntry>(
        PAGES_COLLECTION,
        "home",
      );
      // Support both the new typed-arrays architecture and the legacy single
      // `content` Replicator format.
      this._homePageContent = page ? flattenPageVariants(page as unknown as Record<string, unknown>) : [];
    } catch (err) {
      logger.debug("[StatamicProvider] getHomePageContent: failed to fetch home page", {
        error: err instanceof Error ? err.message : String(err),
      });
      this._homePageContent = [];
    }

    // Last-resort file fallback: HTTP returned an entry but without Replicator
    // blocks. Try the StatamicClient's file reader if available.
    if (this._homePageContent.length === 0) {
      try {
        const filePage = await this.client.readEntryFromFile<StatamicPageEntry>(
          PAGES_COLLECTION,
          "home",
        );
        const fileContent = filePage ? flattenPageVariants(filePage as unknown as Record<string, unknown>) : [];
        if (fileContent.length > 0) {
          logger.debug(
            "[StatamicProvider] getHomePageContent: HTTP returned empty content, " +
              "using file fallback with " + String(fileContent.length) + " blocks",
          );
          this._homePageContent = fileContent;
        }
      } catch {
        // File fallback not available — proceed with empty content
      }
    }

    return this._homePageContent;
  }

  /**
   * Resolve a Statamic `assets` field value to a URL string or null.
   *
   * Handles three storage shapes:
   *   1. string                  → returned as-is (plain path or full URL)
   *   2. string[]                → first element (file-reader YAML array)
   *   3. {url?,permalink?}[]     → first element's url / permalink
   *                                 (HTTP API augmented asset object)
   *
   * Bare filenames (no leading / or http) are prefixed with /assets/ so the
   * Next.js asset proxy route can serve them correctly.
   */
  private resolveAssetUrl(
    field: Array<{ url?: string; permalink?: string } | string> | string | null | undefined,
  ): string | null {
    if (!field) return null;
    const first = Array.isArray(field) ? field[0] : field;
    if (!first) return null;
    let raw: string | null = null;
    if (typeof first === "string") {
      raw = first || null;
    } else {
      const obj = first as { url?: string; permalink?: string };
      raw = obj.url ?? obj.permalink ?? null;
    }
    if (!raw) return null;
    if (!raw.startsWith("/") && !raw.startsWith("http")) raw = `/assets/${raw}`;
    return raw;
  }

  /**
   * Map a raw Statamic contract_type select value to the VacancyData union.
   * Statamic stores: fulltime | parttime | freelance | internship.
   * VacancyData expects: full-time | part-time | freelance | internship.
   */
  private mapContractType(
    raw: string | undefined,
  ): import("../types").VacancyData["contractType"] {
    if (!raw) return undefined;
    const map: Record<string, import("../types").VacancyData["contractType"]> = {
      fulltime:   "full-time",
      parttime:   "part-time",
      freelance:  "freelance",
      internship: "internship",
    };
    return map[raw] ?? undefined;
  }

  private async fetchVariant<TEntry extends { is_active?: boolean }, TResult>(
    collection: string,
    key: string,
    mapper: (entry: TEntry & { id: string; slug: string }) => TResult,
    label: string,
  ): Promise<TResult | null> {
    try {
      const entry = await this.client.fetchEntry<TEntry>(collection, key);

      if (!entry) {
        logger.debug(`[StatamicProvider] ${label} not found.`, { collection, key });
        return null;
      }

      if (entry.is_active === false) {
        logger.debug(`[StatamicProvider] ${label} is inactive.`, { collection, key });
        return null;
      }

      return mapper(entry as TEntry & { id: string; slug: string });
    } catch (err) {
      logger.warn(`[StatamicProvider] Failed to fetch ${label}.`, {
        collection,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
