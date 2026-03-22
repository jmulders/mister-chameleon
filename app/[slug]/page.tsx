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
 * ─── Data flow ───────────────────────────────────────────────────────────────
 *
 *   1. Next.js passes { params: { slug } } to the page component.
 *   2. getPageData() (memoised with React.cache) fetches via getPageBySlug().
 *   3. notFound() is called for null results — renders app/not-found.tsx.
 *   4. CMS PageData is mapped to a platform-internal PageConfig via
 *      mapPageDataToPageConfig().  Context slots are derived from
 *      pageData.contextConfig (the "no-engine" path — no decision engine runs
 *      on static CMS pages; the CMS fallbackVariantKey becomes the active key).
 *   5. TemplateRenderer handles all rendering: before-content context slots,
 *      CMS-ordered content blocks, and after-content context slots.
 *      On this path no contextData is passed — TemplateRenderer fetches slot
 *      content itself in parallel using each slot's variantKey.
 *   6. generateMetadata() re-uses the same memoised fetch — zero extra calls.
 *
 * ─── Runtime path ─────────────────────────────────────────────────────────────
 *
 *   CmsPage (this file)
 *     └── mapPageDataToPageConfig()   CMS → PageConfig (no-engine path)
 *     └── <TemplateRenderer pageConfig={…} />
 *           ├── fetchContextDataFromSlots()   parallel CMS fetches per slot
 *           ├── ContextSlotRenderer × n       hero / proof / cta
 *           └── ContentBlockRenderer × n      CMS content blocks
 *
 * ─── ISR ─────────────────────────────────────────────────────────────────────
 *
 *   Page data is cached by the provider.  For Sanity, revalidating the "sanity"
 *   tag from the webhook route invalidates all Sanity-backed pages.
 */

import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createCMSProvider } from "@/cms";
import { mapPageDataToPageConfig } from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Memoised data fetch ───────────────────────────────────────────────────────

/**
 * Fetch page data once per request, shared between the page component and
 * generateMetadata. React.cache deduplicates parallel calls within the same
 * render pass — the CMS is queried exactly once per slug per request.
 */
const getPageData = cache(async (slug: string) => {
  return createCMSProvider().getPageBySlug(slug);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    return { title: "Page not found" };
  }

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription,
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function CmsPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    notFound();
  }

  // Map CMS PageData → platform PageConfig.
  // No decision engine is involved here — context slots are resolved from
  // pageData.contextConfig.*.fallbackVariantKey (the "no-engine" path).
  // This ensures the runtime consumes the platform-internal PageConfig shape
  // rather than raw CMS data directly.
  const pageConfig = mapPageDataToPageConfig(page);

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // TemplateRenderer handles all slot rendering and content block rendering.
  // No contextData is passed — TemplateRenderer self-fetches slot content in
  // parallel using each active slot's variantKey (no-engine path).

  return (
    <main>
      <TemplateRenderer pageConfig={pageConfig} />
    </main>
  );
}
