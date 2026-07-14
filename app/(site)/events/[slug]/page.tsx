/**
 * Event detail page  —  app/(site)/events/[slug]/page.tsx
 *
 * Renders a single event by slug.
 *
 * ─── Why this route exists ────────────────────────────────────────────────────
 *
 *   The `events` collection was added to the platform (CollectionKey, the
 *   Statamic provisioner, and collectionPathMap) and the provider already emits
 *   `href: /events/{slug}` for every entry — but no route rendered them, so every
 *   events listing linked straight to a 404.  This closes that gap.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   /events/webinar-personalisatie
 *     → getPageBySlug("events/webinar-personalisatie")
 *     → StatamicProvider maps the "events/" prefix to the `events` collection
 *       (collectionPathMap) and returns the entry's sections
 *     → mapPageDataToPageConfig()  — infers the article-page template
 *     → <TemplateRenderer pageConfig={…} />
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   getActiveTenant() resolves the tenant from the Host header so the query is
 *   scoped to that tenant's content only.  This mirrors cases/[slug] exactly —
 *   note that the legacy careers/[slug] route omits this and is a tenant
 *   isolation bug; do not copy that one.
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
  return createCMSProvider(tenant?.cms, tenantId).getPageBySlug(`events/${slug}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug }     = await params;
  const { tenantId } = await getActiveTenant();
  const page         = await getPageData(slug, tenantId);

  if (!page) {
    return { title: "Event not found" };
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

export default async function EventDetailPage({ params }: PageProps) {
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
