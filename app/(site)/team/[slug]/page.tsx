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
import { pageNeedsTitleHeading }   from "@/lib/page-title";
import { PageTitleHeader }         from "@/components/site/PageTitleHeader";
import { getSiteLocale } from "@/lib/site-texts/server";
import { PAGE_TEXTS } from "@/lib/site-texts/pages";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { ownCanonical, ownOpenGraph } from "@/lib/seo/page-metadata";
import { personJsonLd } from "@/lib/seo/structured-data";
import { getSiteFacts } from "@/lib/seo/site-facts";
import { JsonLd } from "@/components/site/JsonLd";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Memoised data fetch ───────────────────────────────────────────────────────

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantForRender(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`team/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    return { title: PAGE_TEXTS[await getSiteLocale()].missing.teamMember };
  }

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

// ── Page component ────────────────────────────────────────────────────────────

export default async function TeamMemberDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    notFound();
  }

  const pageConfig = mapPageDataToPageConfig(page);
  const { origin, siteName } = await getSiteFacts();

  return (
    <main>
      {origin && page.person && (
        <JsonLd
          json={personJsonLd({
            name:   page.person.name,
            role:   page.person.role,
            path:   `/team/${slug}`,
            sameAs: page.person.profileUrl,
            siteName,
          }, origin)}
        />
      )}
      {pageNeedsTitleHeading(pageConfig.contextSlots, pageConfig.contentBlocks) && page.title && (
        <PageTitleHeader title={page.title} />
      )}
      <TemplateRenderer pageConfig={pageConfig} />
    </main>
  );
}
