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
import { resolveOwnBlockVariant } from "@/lib/page-owned-variant";
import { withOwnClosingSlot }   from "@/lib/page-owned-closing-slot";
import { TemplateRenderer }         from "@/components/platform/TemplateRenderer";
import { pageNeedsTitleHeading }   from "@/lib/page-title";
import { PageTitleHeader }         from "@/components/site/PageTitleHeader";
import { getSiteLocale } from "@/lib/site-texts/server";
import { PAGE_TEXTS } from "@/lib/site-texts/pages";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { ownCanonical, ownOpenGraph } from "@/lib/seo/page-metadata";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Memoised data fetch ───────────────────────────────────────────────────────

const getPageData = cache(async (slug: string, tenantId: string | null) => {
  const tenant = await getTenantForRender(tenantId ?? "");
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`cases/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    return { title: PAGE_TEXTS[await getSiteLocale()].missing.caseStudy };
  }

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

// ── Page component ────────────────────────────────────────────────────────────

export default async function CaseStudyDetailPage({ params }: PageProps) {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    notFound();
  }

  const pageConfig = mapPageDataToPageConfig(page);

  // The closing block for this visitor. A case ends with a call to action of
  // its own. When the tenant's block `cta_page_case` has a variant for the audience
  // the rules picked (a customer, say, who needs no demo), that variant takes its
  // place. Otherwise the page keeps the block it has.
  const own        = await resolveOwnBlockVariant(`cases/${slug}`, "cta", "cta_page_case");
  const shown      = own ? withOwnClosingSlot(pageConfig, own.slot) : pageConfig;

  // data-page-kind names the page for a brand layer. A case reads like an
  // article: a stack of text sections under one title (see blog/[slug]).
  return (
    <main data-page-kind="case">
      {pageNeedsTitleHeading(pageConfig.contextSlots, pageConfig.contentBlocks) && page.title && (
        <PageTitleHeader title={page.title} />
      )}
      <TemplateRenderer pageConfig={shown} tokenContext={own?.tokenContext ?? undefined} />
    </main>
  );
}
