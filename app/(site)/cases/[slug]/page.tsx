/**
 * Case study detail page  —  app/cases/[slug]/page.tsx
 *
 * Renders a case study detail page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /cases/apex-doubled-revenue
 *     → getPageBySlug("cases/apex-doubled-revenue")
 *     → SanityCMSProvider fetches the page document at slug "cases/apex-doubled-revenue",
 *       returns articleMeta + articleBody + relatedContent sections
 *     → mapPageDataToPageConfig()  — infers "article-page" template
 *     → <TemplateRenderer pageConfig={…} />
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   getActiveTenant() resolves the active tenant from the Host header so the
 *   GROQ query is scoped to this tenant's documents only.  Prevents cross-tenant
 *   page exposure in multi-tenant deployments sharing one Sanity dataset.
 */

import { cache }       from "react";
import { notFound }    from "next/navigation";
import type { Metadata } from "next";
import { createCMSProvider }        from "@/cms";
import { mapPageDataToPageConfig }  from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }         from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Memoised data fetch ───────────────────────────────────────────────────────

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantById(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`cases/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    return { title: "Case study not found" };
  }

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
    // Interest keywords → <meta name="keywords"> for the PageTracker (behavioural).
    keywords:    page.metaKeywords,
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

export default async function CaseStudyDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

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
