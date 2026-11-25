/**
 * Blog post detail page  —  app/(site)/blog/[slug]/page.tsx
 *
 * Renders a blog post page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /blog/why-97-percent-traffic-leaves
 *     → getPageBySlug("blog/why-97-percent-traffic-leaves")
 *     → SanityCMSProvider fetches the page document with that slug,
 *       returns articleMeta + articleBody + relatedContent sections
 *     → mapPageDataToPageConfig()  — infers "article-page" template
 *     → <TemplateRenderer pageConfig={…} />
 */

import { cache }                        from "react";
import { notFound }                     from "next/navigation";
import type { Metadata }                from "next";
import { createCMSProvider }            from "@/cms";
import { mapPageDataToPageConfig }      from "@/cms/mappers/page-config-mapper";
import { resolveOwnBlockVariant } from "@/lib/page-owned-variant";
import { withOwnClosingSlot }   from "@/lib/page-owned-closing-slot";
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
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`blog/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) return { title: PAGE_TEXTS[await getSiteLocale()].missing.post };

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
    // Interest keywords → <meta name="keywords"> for the PageTracker (behavioural).
    keywords:    page.metaKeywords,
    robots:      (page.robots?.noindex || page.robots?.nofollow)
                   ? { index: !page.robots.noindex, follow: !page.robots.nofollow }
                   : undefined,
    // Only what the editor filled in. Without it the page keeps the layout's:
    // its own address as canonical, and Open Graph from its title and description.
    ...ownCanonical(page),
    ...ownOpenGraph(page),
  };
}

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) notFound();

  const pageConfig = mapPageDataToPageConfig(page);

  // The closing block for this visitor. An article ends with a call to action of
  // its own. When the tenant's block `cta_page_blog` has a variant for the audience
  // the rules picked (a customer, say, who needs no demo), that variant takes its
  // place. Otherwise the page keeps the block it has.
  const own        = await resolveOwnBlockVariant(`blog/${slug}`, "cta", "cta_page_blog");
  const shown      = own ? withOwnClosingSlot(pageConfig, own.slot) : pageConfig;

  // data-page-kind names the page for a brand layer: an article is a stack of
  // text sections, and a house style may want those closer together than the
  // sections of a landing page.
  return (
    <main data-page-kind="article">
      {pageNeedsTitleHeading(pageConfig.contextSlots, pageConfig.contentBlocks) && page.title && (
        <PageTitleHeader title={page.title} />
      )}
      <TemplateRenderer pageConfig={shown} tokenContext={own?.tokenContext ?? undefined} />
    </main>
  );
}
