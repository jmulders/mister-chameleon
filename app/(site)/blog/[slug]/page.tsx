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
import { TemplateRenderer }             from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantById(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`blog/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) return { title: "Post not found" };

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

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) notFound();

  return (
    <main>
      <TemplateRenderer pageConfig={mapPageDataToPageConfig(page)} />
    </main>
  );
}
