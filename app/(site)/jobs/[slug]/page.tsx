/**
 * Job / vacancy detail page  —  app/(site)/jobs/[slug]/page.tsx
 *
 * Renders a vacancy detail page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /jobs/job-senior-fullstack-engineer
 *     → getPageBySlug("jobs/job-senior-fullstack-engineer")
 *     → SanityCMSProvider fetches the page document with that slug,
 *       returns vacancyMeta + articleBody + applyPanel + recruiterPanel sections
 *     → mapPageDataToPageConfig()  — infers "article-page" template
 *     → <TemplateRenderer pageConfig={…} />
 */

import { cache }                        from "react";
import { notFound }                     from "next/navigation";
import type { Metadata }                from "next";
import { createCMSProvider }            from "@/cms";
import { mapPageDataToPageConfig }      from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }             from "@/components/platform/TemplateRenderer";
import { pageNeedsTitleHeading }   from "@/lib/page-title";
import { PageTitleHeader }         from "@/components/site/PageTitleHeader";
import { getSiteLocale } from "@/lib/site-texts/server";
import { PAGE_TEXTS } from "@/lib/site-texts/pages";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { ownCanonical, ownOpenGraph } from "@/lib/seo/page-metadata";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantForRender(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`jobs/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) return { title: PAGE_TEXTS[await getSiteLocale()].missing.job };

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
    robots:      (page.robots?.noindex || page.robots?.nofollow)
                   ? { index: !page.robots.noindex, follow: !page.robots.nofollow }
                   : undefined,
    // Only what the editor filled in. Without it the page keeps the layout's:
    // its own address as canonical, and Open Graph from its title and description.
    ...ownCanonical(page),
    ...ownOpenGraph(page),
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) notFound();

  const pageConfig = mapPageDataToPageConfig(page);

  return (
    <main>
      {pageNeedsTitleHeading(pageConfig.contextSlots, pageConfig.contentBlocks) && page.title && (
        <PageTitleHeader title={page.title} />
      )}
      <TemplateRenderer pageConfig={pageConfig} />
    </main>
  );
}
