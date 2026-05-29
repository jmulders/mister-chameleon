/**
 * /demo-controls  —  app/(site)/demo-controls/page.tsx
 *
 * Static override of the CMS-driven [slug] route for the path /demo-controls.
 * Next.js prefers this specific route over [slug]/page.tsx.
 *
 * Layout:
 *   1. Intro section — heading + body copy (hard-coded so the toggle can be
 *      placed precisely between the text and the scenario links grid).
 *   2. DemoControlsToggle — enable / disable the floating ScenarioControlPanel.
 *   3. TemplateRenderer — renders the CMS content blocks (the quickLinks grid).
 *
 * The intro text is intentionally NOT in the CMS so this file owns the order.
 * The seed (marketing-site-pages.ts) only contains the quickLinks block.
 */

export const dynamic = "force-dynamic";

import { cache }       from "react";
import { notFound }    from "next/navigation";
import { draftMode, cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { createCMSProvider, createPreviewCMSProvider } from "@/cms";
import { mapPageDataToPageConfig }   from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer }          from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import { resolveSlugPageConfig }     from "@/lib/cms-page-decision";
import { DemoControlsToggle }        from "@/components/scenario/DemoControlsToggle";
import { Container }                 from "@/components/primitives/Container";

// ── Memoised fetch ────────────────────────────────────────────────────────────

const getPageData = cache(async (preview: boolean, tenantId: string | null, locale: string) => {
  const tenant = await getTenantById(tenantId ?? "");
  const provider = preview
    ? createPreviewCMSProvider(tenant?.cms, tenantId)
    : createCMSProvider(tenant?.cms, tenantId);
  return provider.getPageBySlug("demo-controls", locale);
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const { isEnabled: preview } = await draftMode();
  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const page           = await getPageData(preview, tenantId, locale);

  if (!page) return { title: "Scenario Controls" };
  return {
    title:       page.seoTitle ?? page.title,
    description: page.seoDescription,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DemoControlsPage() {
  const { isEnabled: preview } = await draftMode();
  const { tenantId }   = await getActiveTenant();
  const cookieStore    = await cookies();
  const localeRaw      = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale         = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  const [page, tenant] = await Promise.all([
    getPageData(preview, tenantId, locale),
    getTenantById(tenantId ?? ""),
  ]);

  if (!page) notFound();

  const pageConfig = mapPageDataToPageConfig(page);

  const headerStore  = await headers();
  const cookieHeader = headerStore.get("cookie");
  const request      = new Request(
    headerStore.get("x-forwarded-proto")
      ? `${headerStore.get("x-forwarded-proto")}://${headerStore.get("host")}/demo-controls`
      : `http://${headerStore.get("host") ?? "localhost"}/demo-controls`,
    { headers: headerStore },
  );

  const { pageConfig: resolvedPageConfig, tokenContext } = await resolveSlugPageConfig(
    request,
    cookieHeader,
    "demo-controls",
    pageConfig,
    tenant,
    tenantId ?? "",
  );

  return (
    <main>
      {/*
       * ── Intro section ────────────────────────────────────────────────────────
       *
       * Styled to match the text_lead TextSection variant: generous vertical
       * padding, constrained prose width, large heading, muted body copy.
       * Kept in this file (not CMS) so the DemoControlsToggle can be inserted
       * immediately below the text and above the scenario links grid.
       */}
      <section
        style={{
          padding: "3rem 0 1.5rem",
          background: "var(--bg)",
        }}
      >
        <Container>
          <div style={{ maxWidth: 680 }}>
            <h1
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                marginBottom: "1rem",
              }}
            >
              Take control of the demo.
            </h1>
            <p
              style={{
                fontSize: "1.125rem",
                lineHeight: 1.7,
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              The scenario control panel lets you switch between any of the 20 visitor archetypes
              and watch every section of the page adapt in real time. Use it for sales demos,
              team walkthroughs, or your own exploration.
            </p>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.7,
                color: "var(--text-muted)",
                marginBottom: "1.75rem",
              }}
            >
              Enable the control panel below, then use it to switch between any visitor archetype.
              The page adapts immediately — no reload required.
            </p>

            {/*
             * ── DemoControlsToggle ───────────────────────────────────────────
             *
             * Placed here — after the intro copy, before the scenario links —
             * so the host can enable / disable the floating control panel
             * without scrolling to a separate controls section.
             */}
            <DemoControlsToggle />
          </div>
        </Container>
      </section>

      {/* CMS blocks: the quickLinks scenario grid */}
      <TemplateRenderer pageConfig={resolvedPageConfig} tokenContext={tokenContext ?? undefined} />
    </main>
  );
}
