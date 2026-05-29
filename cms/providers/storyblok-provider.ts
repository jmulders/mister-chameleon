/**
 * StoryblokProvider
 *
 * CMSProvider implementation backed by the Storyblok Content Delivery API v2.
 * Replaces MockCMSProvider when STORYBLOK_ACCESS_TOKEN is set and Sanity is
 * not configured.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   StoryblokProvider receives a StoryblokClient at construction time.
 *   This allows callers to inject a test client in unit tests without
 *   environment variable setup. The default constructor creates a live
 *   client via createStoryblokClient().
 *
 *   Content is stored as Storyblok stories, organised in three folders:
 *     hero-variants/{key}   →  heroVariant stories
 *     proof-variants/{key}  →  proofVariant stories
 *     cta-variants/{key}    →  ctaVariant stories
 *
 *   Each public method builds the story slug from the variant key (via the
 *   slug builder functions in cms/queries/storyblok/), then delegates to the
 *   private fetchVariant() helper which handles the full lifecycle.
 *
 * ─── fetchVariant() lifecycle ────────────────────────────────────────────────
 *
 *   1. Build slug from key
 *   2. Fetch story via StoryblokClient.fetchStory() — returns null for 404
 *   3. Check content.is_active — inactive stories are treated as not found
 *   4. Map story content to internal block data type via the Storyblok mapper
 *   5. Wrap in try/catch — errors return null (logged at warn), never throw
 *
 * ─── is_active vs. Storyblok publication state ───────────────────────────────
 *
 *   Storyblok's `version=published` filter (set in StoryblokClient) means
 *   only published stories are returned — draft stories 404 automatically.
 *   The `is_active` content field is a soft-disable within published stories:
 *   it allows editors to deactivate a variant without unpublishing the story.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   All fetches are tagged with STORYBLOK_CACHE_TAG and participate in ISR.
 *   On-demand revalidation: call `revalidateTag("storyblok")` from a webhook
 *   route handler triggered by Storyblok's Story Published webhook.
 *
 * ─── Null semantics ──────────────────────────────────────────────────────────
 *
 *   null is returned (never thrown) in three cases:
 *   1. Story not found (slug not in Storyblok, or story not published)
 *   2. Story found but content.is_active === false
 *   3. Network or parse error (logged as warning)
 *
 *   The experience composer handles null via its fallback strategy.
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   STORYBLOK_ACCESS_TOKEN  required  Content Delivery API token
 *   STORYBLOK_REGION        optional  "eu" | "us" | "ap" | "ca" | "cn" (default: "eu")
 *   STORYBLOK_VERSION       optional  "published" | "draft" (default: "published")
 */

import type { CMSProvider } from "./cms-provider";
import type { HeroBlockData, ProofBlockData, CTABlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData, SiteSettingsData, PageData } from "../types";
import type {
  StoryblokHeroContent,
  StoryblokProofContent,
  StoryblokCTAContent,
  StoryblokFeatureContent,
  StoryblokConversionContent,
  StoryblokNotificationContent,
} from "../queries/storyblok";
import {
  heroVariantSlug,
  proofVariantSlug,
  ctaVariantSlug,
  featureVariantSlug,
  conversionVariantSlug,
  notificationVariantSlug,
  HERO_VARIANTS_FOLDER,
  PROOF_VARIANTS_FOLDER,
  CTA_VARIANTS_FOLDER,
} from "../queries/storyblok";
import {
  mapStoryblokHero,
  mapStoryblokProof,
  mapStoryblokCTA,
  mapStoryblokFeature,
  mapStoryblokConversion,
  mapStoryblokNotification,
  mapStoryblokPage,
} from "../mappers/storyblok";
import type { StoryblokPageContent } from "../mappers/storyblok";
import {
  StoryblokClient,
  createStoryblokClient,
} from "./storyblok-client";
import {
  createStoryblokManagementClient,
  type StoryblokManagementClient,
} from "./storyblok-management-client";
import { logger } from "@/lib/logger";
import type { ProvisionResult, TestConnectionResult } from "./cms-provider";
import type { TenantSettings } from "@/tenant/types";

// ── Credential resolution ─────────────────────────────────────────────────────

interface ResolvedManagementConfig {
  managementToken: string;
  spaceId:         string;
}

/**
 * Resolves the Storyblok Management API credentials needed for provisioning.
 *
 * Priority (highest → lowest):
 *   1. Platform Settings DB (managementToken, spaceId)
 *   2. STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID env vars
 *
 * Returns `{ error }` when credentials are missing from all sources.
 */
async function resolveStoryblokManagementConfig(): Promise<
  ResolvedManagementConfig | { error: string }
> {
  let managementToken: string | undefined;
  let spaceId:         string | undefined;

  try {
    const { getPlatformStoryblokSettings } = await import("@/platform/platform-store");
    const result = await getPlatformStoryblokSettings();
    if (result.ok) {
      managementToken = result.data.managementToken?.trim() || undefined;
      spaceId         = result.data.spaceId?.trim()         || undefined;
    }
  } catch {
    // Non-fatal — fall through to env vars.
  }

  // Env var fallbacks
  if (!managementToken) managementToken = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim() || undefined;
  if (!spaceId)         spaceId         = process.env.STORYBLOK_SPACE_ID?.trim()         || undefined;

  if (!managementToken) {
    return {
      error:
        "No Storyblok Management API token configured. " +
        "Set it in Admin → Platform Settings → CMS → Storyblok (Management API token field), " +
        "or add STORYBLOK_MANAGEMENT_TOKEN to your environment variables.",
    };
  }

  if (!spaceId) {
    return {
      error:
        "No Storyblok Space ID configured. " +
        "Set it in Admin → Platform Settings → CMS → Storyblok (Space ID field), " +
        "or add STORYBLOK_SPACE_ID to your environment variables.",
    };
  }

  return { managementToken, spaceId };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class StoryblokProvider implements CMSProvider {
  private readonly client: StoryblokClient;

  /**
   * @param client  Optional pre-configured StoryblokClient.
   *                Omit in production — a client is created from env vars.
   *                Inject in tests to avoid env var setup.
   */
  constructor(client?: StoryblokClient) {
    this.client = client ?? createStoryblokClient();
  }

  // ── CMSProvider interface ─────────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return this.fetchVariant<StoryblokHeroContent, HeroBlockData>(
      heroVariantSlug(key),
      mapStoryblokHero,
      "hero variant",
    );
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return this.fetchVariant<StoryblokProofContent, ProofBlockData>(
      proofVariantSlug(key),
      mapStoryblokProof,
      "proof variant",
    );
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return this.fetchVariant<StoryblokCTAContent, CTABlockData>(
      ctaVariantSlug(key),
      mapStoryblokCTA,
      "CTA variant",
    );
  }

  async getFeatureVariant(key: string): Promise<FeatureBlockData | null> {
    return this.fetchVariant<StoryblokFeatureContent, FeatureBlockData>(
      featureVariantSlug(key),
      mapStoryblokFeature,
      "feature variant",
    );
  }

  async getConversionVariant(key: string): Promise<ConversionBlockData | null> {
    return this.fetchVariant<StoryblokConversionContent, ConversionBlockData>(
      conversionVariantSlug(key),
      mapStoryblokConversion,
      "conversion variant",
    );
  }

  async getNotificationVariant(key: string): Promise<NotificationBlockData | null> {
    return this.fetchVariant<StoryblokNotificationContent, NotificationBlockData>(
      notificationVariantSlug(key),
      mapStoryblokNotification,
      "notification variant",
    );
  }

  async getAdaptiveBlock(key: string): Promise<import("../types").AdaptiveBlockData | null> {
    // Adaptive blocks are platform-managed (Supabase-backed), not stored in Storyblok.
    // Delegate to the shared adaptive-blocks store.
    const { getAdaptiveBlockByKey } = await import("@/lib/adaptive-blocks/adaptive-blocks-store");
    return getAdaptiveBlockByKey(key, null);
  }

  /**
   * Fetch site settings from a `site-settings` story in Storyblok.
   *
   * Expects the `siteSettings` component with the full field set registered by
   * STORYBLOK_COMPONENT_DEFINITIONS:
   *   siteTitle, logo_url, logo_alt, header_cta_label/href/style,
   *   mainNavigation[], footerColumns[], footerNavigation[],
   *   contact_email, contact_phone, socialLinks[]
   *
   * Returns null when the story doesn't exist yet — the Header then falls back
   * to the DB navigation store (correct behaviour before the space is seeded).
   */
  async getSiteSettings(_locale = "en"): Promise<SiteSettingsData | null> {
    try {
      const story = await this.client.fetchStory("site-settings");
      if (!story) return null;

      const c = story.content as Record<string, unknown>;

      // ── Navigation item helper ───────────────────────────────────────────────
      const mapNavItems = (raw: unknown): import("../types").NavigationItemData[] => {
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
          .map((item) => ({
            id:    String(item._uid ?? item.label ?? ""),
            label: String(item.label ?? ""),
            href:  String(item.href  ?? "#"),
          }));
      };

      // ── Footer columns helper ────────────────────────────────────────────────
      const mapFooterColumns = (raw: unknown): import("../types").FooterColumnData[] => {
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((col): col is Record<string, unknown> => !!col && typeof col === "object")
          .map((col) => ({
            title: col.title ? String(col.title) : undefined,
            links: Array.isArray(col.links)
              ? col.links
                  .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
                  .map((l) => ({
                    label:        String(l.label ?? ""),
                    href:         String(l.href  ?? "#"),
                    openInNewTab: l.openInNewTab === true,
                  }))
              : [],
          }));
      };

      // ── Social links helper ──────────────────────────────────────────────────
      const mapSocialLinks = (raw: unknown): import("../types").SocialLinkData[] => {
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
          .map((s) => ({
            label: String(s.label ?? ""),
            url:   String(s.url   ?? ""),
          }))
          .filter((s) => s.url);
      };

      // ── Logo ─────────────────────────────────────────────────────────────────
      const logoUrl = c.logo_url ? String(c.logo_url) : null;
      const logo    = logoUrl
        ? { url: logoUrl, alt: c.logo_alt ? String(c.logo_alt) : String(c.siteTitle ?? "") }
        : null;

      // ── Header CTA ───────────────────────────────────────────────────────────
      const headerCtaLabel = c.header_cta_label ? String(c.header_cta_label) : null;
      const headerCta = headerCtaLabel
        ? {
            label: headerCtaLabel,
            href:  c.header_cta_href ? String(c.header_cta_href) : "#",
            style: (c.header_cta_style as "primary" | "outline" | "ghost" | undefined) ?? "primary",
          }
        : null;

      return {
        siteTitle:        String(c.siteTitle ?? ""),
        logo,
        headerCta,
        mainNavigation:   mapNavItems(c.mainNavigation),
        footerColumns:    mapFooterColumns(c.footerColumns),
        footerNavigation: mapNavItems(c.footerNavigation),
        contactEmail:     c.contact_email ? String(c.contact_email) : null,
        contactPhone:     c.contact_phone ? String(c.contact_phone) : null,
        socialLinks:      mapSocialLinks(c.socialLinks),
      };
    } catch (err) {
      logger.warn("[StoryblokProvider] getSiteSettings error", { error: String(err) });
      return null;
    }
  }

  // TODO: implement Storyblok page fetch when page stories have been created.
  async getPageBySlug(slug: string, _locale = "en"): Promise<PageData | null> {
    try {
      // Page stories are stored at the root of the space (no folder prefix),
      // so the full slug equals the page slug: "home", "about", "contact", etc.
      const story = await this.client.fetchStory<StoryblokPageContent>(slug);
      if (!story) return null;

      // Only map stories whose component is "page" — avoids accidentally
      // treating a variant story (e.g. "hero_default") as a page.
      if ((story.content as Record<string, unknown>).component !== "page") return null;

      return mapStoryblokPage(story.content, slug);
    } catch (err) {
      logger.warn("[StoryblokProvider] Failed to fetch page", {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    const result: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, null]));

    // Probe all six adaptive slot types in order of specificity.
    // Each variant folder uses a predictable slug prefix (e.g. "hero-variants/"),
    // so an early match short-circuits the remaining calls for that key.
    await Promise.all(
      keys.map(async (key) => {
        const hero = await this.getHeroVariant(key);
        if (hero != null) { result[key] = hero; return; }

        const proof = await this.getProofVariant(key);
        if (proof != null) { result[key] = proof; return; }

        const cta = await this.getCTAVariant(key);
        if (cta != null) { result[key] = cta; return; }

        const feature = await this.getFeatureVariant(key);
        if (feature != null) { result[key] = feature; return; }

        const conversion = await this.getConversionVariant(key);
        if (conversion != null) { result[key] = conversion; return; }

        const notification = await this.getNotificationVariant(key);
        if (notification != null) { result[key] = notification; }
      }),
    );

    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generic fetch-and-map helper shared by all three public methods.
   *
   * Mirrors SanityProvider.fetchVariant() in structure — any developer
   * familiar with the Sanity implementation will recognise this pattern.
   *
   * The extra `is_active` check is Storyblok-specific: Sanity handles this
   * at the GROQ query level (`isActive == true`), but Storyblok has no
   * server-side field filter on the CDN API, so the check happens here.
   *
   * @param slug    Full Storyblok story slug built by a slug builder function
   * @param mapper  Pure function translating TContent → TResult
   * @param label   Human-readable label for log messages
   */

  // ── Entity document stubs ───────────────────────────────────────────────────
  //
  // Full Storyblok implementations go here once Company / NewsArticle / Vacancy
  // content types exist in the Storyblok space.

  async getNewsArticleBySlug(_slug: string): Promise<import("../types").NewsArticleData | null> {
    return null;
  }

  async getNewsArticles(_options?: { limit?: number; tags?: string[]; company?: string }): Promise<import("../types").NewsArticleData[]> {
    return [];
  }

  async getVacancyBySlug(_slug: string): Promise<import("../types").VacancyData | null> {
    return null;
  }

  async getVacancies(_options?: { limit?: number; company?: string }): Promise<import("../types").VacancyData[]> {
    return [];
  }

  async getCompanyBySlug(_slug: string): Promise<import("../types").CompanyData | null> {
    return null;
  }

  async getCompanies(_options?: { limit?: number }): Promise<import("../types").CompanyData[]> {
    return [];
  }

  // ── Collection resolution ─────────────────────────────────────────────────

  /**
   * Resolves collection-driven block items from the Storyblok Content Delivery API.
   *
   * Each CollectionKey maps to a Storyblok folder/content-type:
   *   articles / news → stories in the "articles" folder
   *   vacancies       → stories in the "vacancies" folder
   *   companies       → stories in the "companies" folder
   *   cases           → stories in the "cases" folder
   *
   * Full implementation is deferred until Storyblok content structures are
   * confirmed for the tenant. Returns [] in the interim.
   */
  async resolveCollection(
    _source: import("@/page-config/collection-source").CollectionContentSource,
  ): Promise<import("@/page-config/collection-source").CollectionItem[]> {
    // TODO: Implement full Storyblok collection resolution via Content Delivery API
    return [];
  }

  // ── Provider management ───────────────────────────────────────────────────

  /**
   * Provision starter CMS content for a tenant in Storyblok.
   *
   * Writes the following stories using create-or-replace (safe to re-run):
   *   hero-variants/hero_default       — starter hero variant
   *   proof-variants/proof_default     — starter proof variant
   *   cta-variants/cta_default         — starter CTA variant
   *   home                             — homepage (empty page shell)
   *   about                            — about page (empty page shell)
   *   contact                          — contact page (empty page shell)
   *
   * Credentials are resolved in priority order:
   *   1. Platform Settings DB (managementToken, spaceId)
   *   2. STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID env vars
   *
   * @param tenant   The tenant's stored settings (used for tenant-scoped logging)
   * @param options  dryRun — when true, validates config without writing stories
   */
  async provisionSite(
    tenant:   TenantSettings,
    options?: { dryRun?: boolean },
  ): Promise<ProvisionResult> {
    const dryRun = options?.dryRun ?? false;

    // ── 1. Resolve Management API credentials ────────────────────────────────
    const credsResult = await resolveStoryblokManagementConfig();
    if ("error" in credsResult) {
      return { ok: false, error: credsResult.error };
    }
    const { managementToken, spaceId } = credsResult;

    logger.info("[StoryblokProvider] Starting provisioning", {
      tenantId: tenant.tenantId,
      spaceId,
      dryRun,
    });

    if (dryRun) {
      const planned = [
        heroVariantSlug("hero_default"),
        proofVariantSlug("proof_default"),
        ctaVariantSlug("cta_default"),
        "home",
        "about",
        "contact",
      ];
      logger.info("[StoryblokProvider] Dry-run — would provision", { planned });
      return {
        ok:                  true,
        documentIds:         planned,
        pagesCreated:        3,
        pagesUpdated:        0,
        variantsWritten:     3,
        siteSettingsWritten: false,
        navItemsWritten:     0,
        warnings:            ["Dry-run: no stories were written to Storyblok."],
      };
    }

    // ── 2. Create Management API client ──────────────────────────────────────
    const client = createStoryblokManagementClient(managementToken, spaceId);

    /**
     * Wraps a plain content object in the Storyblok bloks envelope.
     *
     * Storyblok bloks fields are arrays of objects where every item MUST have:
     *   - `component`  — the registered component name (e.g. "ctaLink")
     *   - `_uid`       — a unique ID; Storyblok rejects items without one
     *
     * Passing plain objects `{ label, href }` causes HTTP 422 Unprocessable
     * Content because the Management API validates each item against the schema.
     */
    function sbBlok(component: string, fields: Record<string, unknown>) {
      return {
        component,
        _uid: crypto.randomUUID(),
        ...fields,
      };
    }

    const documentIds: string[] = [];
    const partial:     string[] = [];
    const warnings:    string[] = [];
    let   variantsWritten = 0;
    let   pagesCreated    = 0;
    let   pagesUpdated    = 0;

    try {
      // ── 3. Ensure variant folders exist (sequential — rate limit: 6 req/s) ──
      const heroFolderId  = await client.ensureFolder("Hero Variants",  HERO_VARIANTS_FOLDER);
      const proofFolderId = await client.ensureFolder("Proof Variants", PROOF_VARIANTS_FOLDER);
      const ctaFolderId   = await client.ensureFolder("CTA Variants",   CTA_VARIANTS_FOLDER);

      // ── 4. Upsert variant stories ──────────────────────────────────────────

      // Hero default
      const heroKey  = "hero_default";
      const heroResult = await client.upsertStory({
        name:     "Hero — Default",
        slug:     heroKey,
        fullSlug: heroVariantSlug(heroKey),
        parentId: heroFolderId,
        content:  {
          component: "hero_variant",
          key:       heroKey,
          is_active: true,
          title:     "Welcome",
          subtitle:  "We're glad you're here. Discover what we can do for you.",
          tag:       "",
          ctas:      [sbBlok("ctaLink", { label: "Learn more", href: "/about" })],
        },
      });
      documentIds.push(heroResult.fullSlug);
      partial.push(heroResult.fullSlug);
      variantsWritten++;

      // Proof default
      const proofKey    = "proof_default";
      const proofResult = await client.upsertStory({
        name:     "Proof — Default",
        slug:     proofKey,
        fullSlug: proofVariantSlug(proofKey),
        parentId: proofFolderId,
        content:  {
          component: "proof_variant",
          key:       proofKey,
          is_active: true,
          title:     "Trusted by teams everywhere",
          items:     [
            sbBlok("proofItem", { title: "Quality",  text: "We take pride in every detail of our work." }),
            sbBlok("proofItem", { title: "Speed",    text: "Delivered on time, every time."             }),
            sbBlok("proofItem", { title: "Support",  text: "We're here when you need us most."          }),
          ],
        },
      });
      documentIds.push(proofResult.fullSlug);
      partial.push(proofResult.fullSlug);
      variantsWritten++;

      // CTA default
      const ctaKey    = "cta_default";
      const ctaResult = await client.upsertStory({
        name:     "CTA — Default",
        slug:     ctaKey,
        fullSlug: ctaVariantSlug(ctaKey),
        parentId: ctaFolderId,
        content:  {
          component: "cta_variant",
          key:       ctaKey,
          is_active: true,
          title:     "Ready to get started?",
          text:      "Get in touch with our team today.",
          cta_label: "Contact us",
          cta_href:  "/contact",
        },
      });
      documentIds.push(ctaResult.fullSlug);
      partial.push(ctaResult.fullSlug);
      variantsWritten++;

      // ── 5. Upsert page stories ─────────────────────────────────────────────
      //
      // Dynamic import keeps this module free of a hard compile-time dependency
      // on the page-store (which carries a server-only guard via @/data/db).
      const { savePage } = await import("@/page-store");

      type PageEntry = {
        name:         string;
        slug:         string;
        title:        string;
        templateKey:  "marketing-page" | "detail-page";
        contextSlots: Array<{
          slotId:    "hero" | "proof" | "cta";
          variantKey: string;
          position:   "before-content" | "after-content";
        }>;
      };

      const pageEntries: PageEntry[] = [
        {
          // Storyblok stores the homepage under slug "home"; internally the
          // page-store uses "" (empty string) for the root URL "/".
          name:        "Home",
          slug:        "home",
          title:       "Home",
          templateKey: "marketing-page",
          contextSlots: [
            { slotId: "hero",  variantKey: "hero_default",  position: "before-content" },
            { slotId: "proof", variantKey: "proof_default", position: "before-content" },
            { slotId: "cta",   variantKey: "cta_default",   position: "after-content"  },
          ],
        },
        {
          name:         "About",
          slug:         "about",
          title:        "About",
          templateKey:  "detail-page",
          contextSlots: [],
        },
        {
          name:         "Contact",
          slug:         "contact",
          title:        "Contact",
          templateKey:  "detail-page",
          contextSlots: [],
        },
      ];

      for (const page of pageEntries) {
        const pageResult = await client.upsertStory({
          name:     page.name,
          slug:     page.slug,
          fullSlug: page.slug,
          parentId: 0, // root
          content:  {
            component:    "page",
            title:        page.title,
            slug:         page.slug,
            is_published: true,
            sections:     [],
          },
        });
        documentIds.push(pageResult.fullSlug);
        partial.push(pageResult.fullSlug);
        if (pageResult.action === "created") {
          pagesCreated++;
        } else {
          pagesUpdated++;
        }

        // Seed the internal page-store row that the admin Content tab reads
        // (getPagesByTenant → pages Supabase table).  Using a stable
        // tenant-scoped ID means re-running provisioning updates the row
        // rather than creating duplicates.
        //
        await savePage({
          id:            `storyblok_${tenant.tenantId}_page_${page.slug}`,
          tenantId:      tenant.tenantId,
          slug:          page.slug,
          title:         page.title,
          templateKey:   page.templateKey,
          contextSlots:  page.contextSlots,
          contentBlocks: [],
          seo:           {},
        });
      }

      logger.info("[StoryblokProvider] Provisioning complete", {
        tenantId: tenant.tenantId,
        documentIds,
      });

      return {
        ok:                  true,
        documentIds,
        pagesCreated,
        pagesUpdated,
        variantsWritten,
        siteSettingsWritten: false,
        navItemsWritten:     0,
        warnings,
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[StoryblokProvider] Provisioning failed", {
        tenantId: tenant.tenantId,
        error:    errorMsg,
        partial,
      });
      return {
        ok:      false,
        error:   `Storyblok provisioning failed: ${errorMsg}`,
        partial,
      };
    }
  }

  /** Tests connectivity by fetching a non-existent story slug (expect null, not an error). */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Fetch a guaranteed-absent story — null response confirms connectivity.
      await this.client.fetchStory("__platform_connection_test__");
      return { ok: true, provider: "storyblok", readAccess: true };
    } catch (err) {
      return {
        ok:       false,
        provider: "storyblok",
        error:    err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async fetchVariant<TContent extends { is_active?: boolean }, TResult>(
    slug: string,
    mapper: (content: TContent) => TResult,
    label: string,
  ): Promise<TResult | null> {
    try {
      const story = await this.client.fetchStory<TContent>(slug);

      if (!story) {
        logger.debug(`[StoryblokProvider] ${label} not found.`, { slug });
        return null;
      }

      if (story.content.is_active === false) {
        logger.debug(`[StoryblokProvider] ${label} is inactive.`, { slug });
        return null;
      }

      return mapper(story.content);
    } catch (err) {
      logger.warn(`[StoryblokProvider] Failed to fetch ${label}.`, {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
