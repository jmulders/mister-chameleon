/**
 * Vacancy detail page  —  app/careers/[slug]/page.tsx
 *
 * Renders a vacancy detail page by its slug.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /careers/senior-frontend-engineer
 *     → getPageBySlug("careers/senior-frontend-engineer")
 *     → MockCMSProvider fetches VacancyData, runs mapVacancyToPageData(),
 *       appends processSteps + recruiterPanel + applyPanel blocks
 *     → mapPageDataToPageConfig()  — infers "detail-page" template
 *     → <TemplateRenderer pageConfig={…} />
 *
 * The mock provider handles the "careers/<slug>" prefix convention.
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
  return createCMSProvider().getPageBySlug(`careers/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageData(slug);

  if (!page) {
    return { title: "Vacancy not found" };
  }

  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function VacancyDetailPage({ params }: PageProps) {
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
