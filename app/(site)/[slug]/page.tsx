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
import { createCMSProvider, createPreviewCMSProvider } from "@/cms";
import { mapPageDataToPageConfig }   from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }          from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import { resolveSlugPageConfig }     from "@/lib/cms-page-decision";
import type { SlugPageConfigResult } from "@/lib/cms-page-decision";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }       = await params;
  const { isEnabled: preview } = await draftMode();
  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const page           = await getPageData(slug, preview, tenantId, locale);

  if (!page) {
    return { title: "Page not found" };
  }

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
    // CMS-authored keywords are injected as <meta name="keywords"> so that
    // PageTracker can read them at runtime and merge them with the static
    // page-meta-map keywords for interest-profile scoring.
    ...(page.metaKeywords?.length ? { keywords: page.metaKeywords } : {}),
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function CmsPage({ params }: PageProps) {
  const { slug }       = await params;
  const { isEnabled: preview } = await draftMode();
  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  // Fetch page + tenant settings in parallel — both are needed before rendering.
  const [page, tenant] = await Promise.all([
    getPageData(slug, preview, tenantId, locale),
    getTenantById(tenantId ?? ""),
  ]);

  if (!page) {
    notFound();
  }

  // Map CMS PageData → platform PageConfig.
  // This sets each slot's variantKey to the CMS-authored fallbackVariantKey.
  // The decision engine below will replace these with personalised keys.
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

  const { pageConfig: resolvedPageConfig, tokenContext } = await resolveSlugPageConfig(
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

  return (
    <main>
      <TemplateRenderer
        pageConfig={resolvedPageConfig}
        tokenContext={tokenContext ?? undefined}
      />
    </main>
  );
}
