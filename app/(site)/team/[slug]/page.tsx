/**
 * Team member detail page  —  app/(site)/team/[slug]/page.tsx
 *
 * Renders a team member detail page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /team/team-jasper
 *     → getPageBySlug("team/team-jasper")
 *     → StatamicCMSProvider fetches the team_members entry at slug "team-jasper",
 *       returns sections built from the entry's page_blocks field
 *     → mapPageDataToPageConfig()
 *     → <TemplateRenderer pageConfig={…} />
 */

import { cache }      from "react";
import { notFound }   from "next/navigation";
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
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`team/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    return { title: "Team member not found" };
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

export default async function TeamMemberDetailPage({ params }: PageProps) {
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
