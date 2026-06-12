/**
 * News article detail page  —  app/news/[slug]/page.tsx
 *
 * Renders a news/insight article page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /news/ai-matching-bias-reduction
 *     → getPageBySlug("news/ai-matching-bias-reduction")
 *     → MockCMSProvider fetches NewsArticleData, runs mapNewsArticleToPageData(),
 *       appends relatedContent block
 *     → mapPageDataToPageConfig()  — infers "detail-page" template
 *     → <TemplateRenderer pageConfig={…} />
 *
 * The mock provider handles the "news/<slug>" prefix convention.
 * Swapping to SanityCMSProvider requires no changes here.
 */

import { cache }       from "react";
import { notFound }    from "next/navigation";
import type { Metadata } from "next";
import { createCMSProvider }        from "@/cms";
import { mapPageDataToPageConfig }  from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }         from "@/components/platform/TemplateRenderer";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Memoised data fetch ───────────────────────────────────────────────────────

const getPageData = cache(async (slug: string) => {
  return createCMSProvider().getPageBySlug(`news/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    return { title: "Article not found" };
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
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function NewsArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    notFound();
  }

  const pageConfig = mapPageDataToPageConfig(page);

  return (
    <main>
      <TemplateRenderer pageConfig={pageConfig} />
    </main>
  );
}
