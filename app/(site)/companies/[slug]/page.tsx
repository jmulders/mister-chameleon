/**
 * Company detail page  —  app/companies/[slug]/page.tsx
 *
 * Renders a company profile page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /companies/acme-corp
 *     → getPageBySlug("companies/acme-corp")
 *     → MockCMSProvider fetches CompanyData, runs mapCompanyToPageData(),
 *       appends stats + relatedContent blocks
 *     → mapPageDataToPageConfig()  — infers "detail-page" template
 *     → <TemplateRenderer pageConfig={…} />
 *
 * The mock provider handles the "companies/<slug>" prefix convention.
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
  return createCMSProvider().getPageBySlug(`companies/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    return { title: "Company not found" };
  }

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function CompanyDetailPage({ params }: PageProps) {
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
