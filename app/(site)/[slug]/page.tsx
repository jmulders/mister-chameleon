/**
 * Dynamic CMS page route  —  app/[slug]/page.tsx
 *
 * Renders any published CMS page by its URL slug. The slug comes from the
 * CMS `page` document's `slug` field.
 *
 * ─── Behaviour ───────────────────────────────────────────────────────────────
 *
 *   /about-us  → fetches the page with slug "about-us" and renders it
 *   /missing   → slug not in CMS (or isPublished == false) → 404
 *
 * ─── Tenant scoping ──────────────────────────────────────────────────────────
 *
 *   getActiveTenant() resolves the active tenant from the Host header so the
 *   GROQ query is scoped to this tenant's documents only.  Prevents cross-tenant
 *   page exposure in multi-tenant deployments sharing one Sanity dataset.
 *
 * ─── Data flow ───────────────────────────────────────────────────────────────
 *
 *   1. Next.js passes { params: { slug } } to the page component.
 *   2. getPageData() (memoised with React.cache) fetches via getPageBySlug().
 *   3. notFound() is called for null results — renders app/not-found.tsx.
 *   4. CMS PageData is mapped to a platform-internal PageConfig via
 *      mapPageDataToPageConfig().  Context slots are derived from
 *      pageData.contextConfig (the base keys before the engine runs).
 *   5. resolveSlugPageConfig() runs the lightweight decision pipeline:
 *        • No enrichment (MaxMind / IPinfo / GA4 / Leadinfo / HubSpot skipped)
 *        • Session signals + behavioural history + rules + experiments + AI
 *        • Replaces each slot's variantKey with the engine-resolved key
 *        • Returns the original config unchanged on any error (graceful fallback)
 *   6. TemplateRenderer handles all rendering: before-content context slots,
 *      CMS-ordered content blocks, and after-content context slots.
 *      On this path no contextData is passed — TemplateRenderer fetches slot
 *      content itself in parallel using each slot's (engine-resolved) variantKey.
 *   7. generateMetadata() re-uses the same memoised fetch — zero extra calls.
 *
 * ─── Runtime path ─────────────────────────────────────────────────────────────
 *
 *   CmsPage (this file)
 *     ├── mapPageDataToPageConfig()     CMS → PageConfig (slot structure)
 *     ├── resolveSlugPageConfig()       decision engine → updated variantKeys
 *     └── <TemplateRenderer pageConfig={…} />
 *           ├── fetchContextDataFromSlots()   parallel CMS fetches per slot
 *           ├── ContextSlotRenderer × n       hero / proof / cta
 *           └── ContentBlockRenderer × n      CMS content blocks
 *
 * ─── Fast path ────────────────────────────────────────────────────────────────
 *
 *   Pages without context slots (blog posts, docs, legal pages) bypass the
 *   decision pipeline entirely — resolveSlugPageConfig returns immediately.
 *
 * ─── ISR ─────────────────────────────────────────────────────────────────────
 *
 *   Page data is cached by the provider.  For Sanity, revalidating the "sanity"
 *   tag from the webhook route invalidates all Sanity-backed pages.
 *   The decision pipeline always runs at request time (personalisation requires
 *   per-visitor context) so the page must be rendered dynamically.
 */

export const dynamic = "force-dynamic";

import { cache }     from "react";
import { notFound }  from "next/navigation";
import { draftMode, cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { createCMSProvider, createPreviewCMSProvider, createDraftStatamicProvider } from "@/cms";
import { mapPageDataToPageConfig }   from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }          from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import { resolveSlugPageConfig }     from "@/lib/cms-page-decision";
import type { SlugPageConfigResult } from "@/lib/cms-page-decision";
import { resolvePageConfigItems }    from "@/cms/collection-resolver";
import { getDraft }                  from "@/lib/statamic-draft-store";
import type { StatamicDraftEntry }   from "@/lib/statamic-draft-store";
import type { PageData } from "@/cms/types";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic";
import fs                            from "fs";
import nodePath                      from "path";
import { parse as parseYaml }        from "yaml";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Dev-only direct filesystem reader ────────────────────────────────────────

/**
 * Read a Statamic page entry directly from disk, bypassing ALL CMS provider
 * abstractions (StatamicProvider, StatamicClient, CachedCMSProvider, …).
 *
 * Used as a last-resort fallback in development when the normal CMS provider
 * chain returns null — e.g. because the tenant DB selects MockCMSProvider or
 * the Statamic HTTP API is unreachable.  Reads the raw YAML frontmatter from
 * the flat file and constructs a minimal PageData so the CP Live Preview
 * always renders something instead of a 404.
 *
 * Synchronous on purpose: fs.existsSync / readFileSync are fast for small
 * files, and adding async here would require restructuring the callers.
 *
 * Returns null if STATAMIC_CMS_PATH is not set, the file does not exist, or
 * parsing fails.  Never throws.
 */
function readStatamicPageFromDisk(slug: string): PageData | null {
  try {
    const cmsFsPath = process.env.STATAMIC_CMS_PATH;
    if (!cmsFsPath) return null;

    const absRoot  = nodePath.resolve(process.cwd(), cmsFsPath);
    const filePath = nodePath.join(absRoot, "content", "collections", "pages", `${slug}.md`);

    console.info(`[CmsPage] readStatamicPageFromDisk slug="${slug}" path="${filePath}"`);

    if (!fs.existsSync(filePath)) {
      console.warn(`[CmsPage] readStatamicPageFromDisk: file not found at "${filePath}"`);
      return null;
    }

    const raw   = fs.readFileSync(filePath, "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      console.warn(`[CmsPage] readStatamicPageFromDisk: no YAML frontmatter in "${filePath}"`);
      return null;
    }

    const data      = parseYaml(match[1]) as Record<string, unknown>;
    const pageBlocks = Array.isArray(data.page_blocks)
      ? (data.page_blocks as Array<Record<string, unknown>>)
      : [];

    // mapStatamicPageBlocksToSections() emits ContextSlotSectionData entries for
    // context_slot blocks (handling is_active, enabled, and SELECT normalisation
    // internally) and maps all other blocks to their respective section types.
    const sections = mapStatamicPageBlocksToSections(pageBlocks);
    const hasSlots = sections.some((s) => s._type === "contextSlot");

    return {
      id:             slug,
      title:          typeof data.title          === "string" ? data.title          : slug,
      slug,
      seoDescription: typeof data.seo_description === "string" ? data.seo_description : undefined,
      sections,
      templateKey:    hasSlots ? "marketing-page" : "article-page",
    };
  } catch (err) {
    console.error(`[CmsPage] readStatamicPageFromDisk error for slug="${slug}":`, err);
    return null;
  }
}

// ── Draft page builder ────────────────────────────────────────────────────────

/**
 * Construct a minimal PageData from a Statamic Live Preview draft entry.
 *
 * Called when `_mc_draft=TOKEN` is present in the URL (development only).
 * Instead of fetching from Statamic (which may 404 on newly-created or
 * unpublished entries), we use the blocks already serialised by the Antlers
 * template so the CP Live Preview shows the correct page.
 *
 * The `page_blocks` array is serialised as a unified array containing both
 * `context_slot` blocks and free content blocks in authored order.
 * `mapStatamicPageBlocksToSections()` converts the array into a `sections[]`
 * where context_slot entries become `ContextSlotSectionData` objects.
 * `mapPageDataToPageConfig()` (called by the page component) then detects those
 * and builds the `pageItems` array in the correct authored order — which means
 * reordering context slots in the Replicator is immediately reflected in the
 * Live Preview with no extra code here.
 */
function buildDraftPageData(
  draftEntry: StatamicDraftEntry,
  slug:       string,
): { pageData: PageData } {
  const rawBlocks = (draftEntry.blocks ?? []) as Array<Record<string, unknown>>;
  const sections  = mapStatamicPageBlocksToSections(rawBlocks);
  const hasSlots  = sections.some((s) => s._type === "contextSlot");

  const pageData: PageData = {
    id:             slug,
    title:          draftEntry.title ?? slug,
    slug,
    seoDescription: draftEntry.seoDescription,
    sections,
    templateKey:    hasSlots ? "marketing-page" : "article-page",
  };

  return { pageData };
}

// ── Memoised data fetch ───────────────────────────────────────────────────────

/**
 * Fetch page data once per request, shared between the page component and
 * generateMetadata. React.cache deduplicates parallel calls within the same
 * render pass — the CMS is queried exactly once per slug+preview+locale combination
 * per request.
 *
 * `preview` and `locale` are threaded as cache keys so that draft-mode renders
 * and different language variants are never accidentally deduped against each other.
 */
const getPageData = cache(async (slug: string, preview: boolean, tenantId: string | null, locale: string) => {
  const tenant = await getTenantById(tenantId ?? "");
  const provider = preview
    ? createPreviewCMSProvider(tenant?.cms, tenantId)
    : createCMSProvider(tenant?.cms, tenantId);
  return provider.getPageBySlug(slug, locale);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug }       = await params;
  const sp             = await searchParams;
  const { isEnabled: preview } = await draftMode();

  // Statamic Live Preview draft: return metadata from the shared draft store.
  // Works in production too — the draft store is Supabase-backed and only
  // queried when an _mc_draft token is actually present in the URL.
  {
    const token = typeof sp._mc_draft === "string" ? sp._mc_draft : null;
    if (token) {
      const draft = await getDraft(token);
      if (draft) return { title: draft.title ?? slug, description: draft.seoDescription };
    }
  }

  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  let page             = await getPageData(slug, preview, tenantId, locale);

  // Dev-only fallback: read directly from disk when CMS chain returns null.
  if (!page && process.env.NODE_ENV === "development") {
    page = readStatamicPageFromDisk(slug);
  }

  if (!page) {
    return { title: "Page not found" };
  }

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
    robots:      (page.robots?.noindex || page.robots?.nofollow)
                   ? { index: !page.robots.noindex, follow: !page.robots.nofollow }
                   : undefined,
    alternates:  page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined,
    openGraph:   (page.ogTitle ?? page.ogDescription ?? page.ogImage)
                   ? {
                       title:       page.ogTitle       ?? page.seoTitle       ?? page.title,
                       description: page.ogDescription ?? page.seoDescription,
                       images:      page.ogImage ? [page.ogImage] : undefined,
                     }
                   : undefined,
    // CMS-authored keywords are injected as <meta name="keywords"> so that
    // PageTracker can read them at runtime and merge them with the static
    // page-meta-map keywords for interest-profile scoring.
    ...(page.metaKeywords?.length ? { keywords: page.metaKeywords } : {}),
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function CmsPage({ params, searchParams }: PageProps) {
  const { slug }       = await params;
  const sp             = await searchParams;
  const { isEnabled: preview } = await draftMode();
  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  // Statamic Live Preview draft mode (development only):
  //   The Antlers template POSTs the current unsaved entry data to
  //   /api/statamic-draft and appends the returned token to the iframe URL.
  //   We read the token here and use the draft data instead of fetching from
  //   Statamic — this ensures newly-created or unpublished entries always
  //   render correctly in the CP Live Preview without requiring a Save first.
  const mcDraftToken = typeof sp._mc_draft === "string" ? sp._mc_draft : null;
  const draftEntry = mcDraftToken ? await getDraft(mcDraftToken) : null;

  // Fetch page + tenant settings in parallel — both are needed before rendering.
  //
  // When a draft token is present we use createDraftStatamicProvider so that
  // resolveFaqBlocks() is called before the page-block mapper runs — this ensures
  // FAQ collection sources (by_category / select_items) are correctly resolved in
  // the CP Live Preview.  If the page does not exist on disk yet (new / unpublished
  // entry) getPageBySlug returns null and we fall back to the simple builder.
  let [page, tenant] = await Promise.all([
    draftEntry !== null
      ? (async () => {
          const draftProvider = createDraftStatamicProvider(draftEntry.blocks ?? []);
          const draftPage     = await draftProvider.getPageBySlug(slug, locale);
          return draftPage ?? buildDraftPageData(draftEntry, slug).pageData;
        })()
      : getPageData(slug, preview, tenantId, locale),
    getTenantById(tenantId ?? ""),
  ]);

  // ── Dev-only Statamic filesystem fallback ─────────────────────────────────
  //
  // When the normal CMS provider chain returns null — typically because the
  // tenant_settings DB row selects a different provider (mock, sanity, etc.),
  // or because the Statamic HTTP API is unreachable — we fall back to reading
  // the flat YAML file directly from disk.
  //
  // readStatamicPageFromDisk() bypasses ALL provider abstractions (StatamicProvider,
  // StatamicClient, CachedCMSProvider) to eliminate silent failure points. It
  // reads the raw YAML frontmatter from STATAMIC_CMS_PATH, constructs PageData,
  // and logs each step so the Next.js terminal shows exactly what happened.
  //
  // The condition intentionally does NOT check draftEntry === null so it also
  // covers the edge case where the draft token has expired between the Antlers
  // POST and the Next.js render.
  //
  // Only active in development so production behaviour is unaffected.
  if (!page && process.env.NODE_ENV === "development") {
    console.warn(`[CmsPage] CMS returned null for slug="${slug}" — falling back to direct disk read.`);
    page = readStatamicPageFromDisk(slug);
    if (page) {
      console.info(`[CmsPage] Direct disk fallback succeeded for slug="${slug}".`);
    } else {
      console.error(`[CmsPage] Direct disk fallback failed for slug="${slug}". Check STATAMIC_CMS_PATH and that the file exists.`);
    }
  }

  if (!page) {
    notFound();
  }

  // Map CMS PageData → platform PageConfig.
  // mapPageDataToPageConfig detects ContextSlotSectionData entries in sections[]
  // and builds pageItems in the authored order automatically — no second argument
  // needed for the draft path.
  const pageConfig = mapPageDataToPageConfig(page);

  // ── Decision engine (lightweight, no enrichment) ───────────────────────────
  //
  // Runs the rule engine + experiments + AI on the visitor's session and
  // behavioural history, then updates each context slot's variantKey to the
  // engine-resolved value.
  //
  // Pages without context slots bypass this immediately (sub-millisecond).
  // All errors are caught internally — the original pageConfig is returned on
  // failure so the page renders with CMS fallback keys.
  const headerStore   = await headers();
  const cookieHeader  = headerStore.get("cookie");
  const request       = new Request(
    headerStore.get("x-forwarded-proto")
      ? `${headerStore.get("x-forwarded-proto")}://${headerStore.get("host")}/${slug}`
      : `http://${headerStore.get("host") ?? "localhost"}/${slug}`,
    { headers: headerStore },
  );

  // ── Skip decision engine for Statamic CP Live Preview ─────────────────────
  //
  // When rendering a draft (`_mc_draft` token present), the request comes from
  // the Statamic CP editor using THEIR browser session — which may carry a
  // scenario cookie, return-visitor signals, or any other personalisation
  // trigger that has nothing to do with the page being edited.
  //
  // Running the engine here would override the CMS-authored `variant_key` with
  // whatever the engine resolves for the editor's session, making it impossible
  // to preview the variant they actually configured.
  //
  // In draft mode we therefore return the CMS fallback config unchanged so the
  // editor always sees exactly the slot content they set up.
  const { pageConfig: resolvedPageConfig, tokenContext } = draftEntry !== null
    ? { pageConfig, tokenContext: null } satisfies SlugPageConfigResult
    : await resolveSlugPageConfig(
        request,
        cookieHeader,
        slug,
        pageConfig,
        tenant,
        tenantId ?? "",
      ) satisfies SlugPageConfigResult;

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // TemplateRenderer fetches slot content from the CMS in parallel using each
  // active slot's (engine-resolved) variantKey — the standard no-engine path,
  // now driving personalised keys rather than CMS fallback keys.
  //
  // tokenContext carries request-level signals (device, source, UTMs,
  // enrichment) so merge tags like {{device}} resolve in variant copy.

  // ── Draft CMS provider ────────────────────────────────────────────────────
  //
  // When rendering a Live Preview draft, pass a draft-aware Statamic provider
  // so that context-slot content fetching (getHeroVariant, getProofVariant, …)
  // is served from the merged draft+home.md block catalog rather than relying
  // on the Statamic HTTP API being available or the CachedCMSProvider being
  // pre-warmed.  This eliminates a potential "no hero content" failure when the
  // toggle-ON refresh lands before the API responds.
  const draftCmsProvider =
    draftEntry !== null
      ? createDraftStatamicProvider(draftEntry.blocks)
      : undefined;

  // ── Resolve collection-driven content blocks ──────────────────────────────
  //
  // ListingBlock / NewsListBlock / RelatedContentBlock instances whose
  // contentSource.source === "collection" arrive from the mapper with
  // items: [].  resolvePageConfigItems calls the CMS provider for each such
  // block and returns a new PageConfig with those arrays populated, so
  // TemplateRenderer receives fully-hydrated blocks ready to render.
  //
  // Reuse the draft provider when one exists — it covers the case where the
  // listing page itself is being previewed in the Statamic CP.
  const collectionProvider = draftCmsProvider ?? createCMSProvider(tenant?.cms, tenantId);
  const finalPageConfig    = await resolvePageConfigItems(collectionProvider, resolvedPageConfig);

  return (
    <main>
      <TemplateRenderer
        pageConfig={finalPageConfig}
        tokenContext={tokenContext ?? undefined}
        cmsProvider={draftCmsProvider}
      />
    </main>
  );
}
