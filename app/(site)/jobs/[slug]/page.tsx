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
import { getActiveTenant, getTenantById } from "@/tenant/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantById(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`jobs/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) return { title: "Job not found" };

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
  };
}

export default async function JobDetailPage({ params }: PageProps) {
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
