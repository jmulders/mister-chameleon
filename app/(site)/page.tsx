/**
 * Homepage  —  app/(site)/page.tsx
 *
 * Thin rendering layer.  All pipeline logic lives in:
 *   lib/pipeline/homepage-pipeline.ts → runHomepagePipeline()
 *
 * This component is responsible for:
 *   1. Calling the shared pipeline
 *   2. Running analytics + billing side-effects (not in the pipeline — they
 *      must only fire on real page views, not on /demo debug renders)
 *   3. Rendering the slot-based TemplateRenderer output
 *   4. Rendering additional homepage sections (features overview, testimonials)
 *      fetched directly from the Statamic CMS when configured.
 *
 * The debug section has moved to app/(site)/demo/page.tsx and is gated by
 * the tenant's admin toggle (tenant.debug.showDebugOverlay).
 */

import { isFeatureEnabled }                from "@/tenant/server";
import { upsertSession, sessionInputFromContext } from "@/data/repositories";
import { logServedVariants }               from "@/experience/log-served-variants";
import { recordPersonalizedSession }       from "@/billing/plan-enforcement";
import { TemplateRenderer }                from "@/components/platform/TemplateRenderer";
import { logger }                          from "@/lib/logger";
import { runHomepagePipeline }             from "@/lib/pipeline/homepage-pipeline";
import { buildTokenContextFromInput }      from "@/lib/tokens/parse-tokens";
import { cache, Suspense }                 from "react";
import { cookies, headers }                from "next/headers";
import { after }                           from "next/server";
import { homeTitle, requestOrigin, websiteJsonLd } from "@/lib/seo/site-identity";
import type { Metadata }                   from "next";
import { getActiveTenant, getTenantById }  from "@/tenant/server";
import { createCMSProvider }               from "@/cms";
import { LOCALE_COOKIE, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/locale";

// ── Rendering mode ────────────────────────────────────────────────────────────
//
// force-dynamic: the homepage personalises per request (visitor context, A/B
// experiments) AND must honour the ?_mc_draft=TOKEN Live Preview query param.
// Without this, Vercel may serve a CDN-cached HTML for "/" that ignores the
// query string, so Live Preview drafts (and per-visitor variants) never render.
export const dynamic = "force-dynamic";

// ── Metadata ──────────────────────────────────────────────────────────────────
//
// The homepage <title> comes from the CMS "home" page's SEO title (settable per
// page), falling back to the page title, then the tenant's display name. This
// overrides the root-layout default so the tab no longer shows the active theme
// name. Wrapped in React.cache so a repeated call within the same render is free.

const getHomePageForMeta = cache(
  async (tenantId: string | null, locale: string) => {
    const tenant = await getTenantById(tenantId ?? "");
    return createCMSProvider(tenant?.cms, tenantId, locale).getPageBySlug("home", locale);
  },
);

export async function generateMetadata(): Promise<Metadata> {
  const tenant      = await getActiveTenant();
  const cookieStore = await cookies();
  const localeRaw   = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale      = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  const home = await getHomePageForMeta(tenant.tenantId, locale).catch(() => null);

  return {
    title: homeTitle(home?.seoTitle, tenant.name),
    ...(home?.seoDescription ? { description: home.seoDescription } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  // WebSite structured data: what Google uses for the site name in results.
  const [tenant, origin] = await Promise.all([
    getActiveTenant(),
    headers().then(requestOrigin),
  ]);
  const siteName = tenant.name || tenant.theme.meta.name;

  // Stream the personalised body so the tenant shell (nav / header / footer from
  // the layout) flushes to the browser immediately while the pipeline + CMS
  // sections resolve and stream in. The page stays dynamic; only the
  // paint order changes. (Improves FCP — the hero stays the LCP and still waits
  // on the pipeline, as the variant is chosen per visitor.)
  return (
    <>
      {origin && siteName && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: websiteJsonLd(siteName, origin) }}
        />
      )}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeBody params={params} />
      </Suspense>
    </>
  );
}

/**
 * Placeholder shown while <HomeBody> streams — reserves space for the hero.
 *
 * Sized to ~one viewport (min-h-screen) rather than 60vh because the hero that
 * replaces it is typically full-height: a too-short placeholder lets the footer
 * / below-fold content paint high, then get pushed down when the real hero
 * streams in — a large Cumulative Layout Shift. Reserving a viewport-height box
 * keeps that content below the fold so the swap shifts nothing visible.
 */
function HomeSkeleton() {
  return <div className="min-h-screen" aria-hidden="true" />;
}

async function HomeBody({ params }: { params: Record<string, string | string[] | undefined> }) {
  const result = await runHomepagePipeline({ params });

  const {
    sessionId,
    tenantConfig,
    tenant,
    tenantFeatures: _tenantFeatures,
    input,
    experience,
    gatedPlan,
    appliedExperiment,
    pageConfig,
    contextData,
  } = result;

  // ── Side effects, after the response ─────────────────────────────────────
  //
  // Two writes that the visitor does not need to wait for. They used to be
  // awaited before the page body rendered (two database round trips on every
  // homepage view), and the session count was a bare promise that a frozen
  // serverless instance could drop. after() runs them once the response is
  // out and keeps the instance alive until they finish.
  //
  // Analytics: upsertSession makes sure the FK target (sessions.id) exists
  // before logServedVariants inserts its row; ON CONFLICT DO NOTHING makes it
  // safe on every page load. Skipped without consent: there is no persistent
  // session then, and the throwaway id was refused by the uuid column on every
  // such pageview, with an error in the log each time.
  //
  // Billing: idempotent per (tenant, month, session). Only counted when we
  // actually served a personalised page. Over the cap the visitor gets the
  // default experience, so billing them a "personalised session" would charge
  // for something they did not receive, and would inflate the very counter
  // that decides the cap. sessionCap comes from the pipeline, which already
  // computed it to make that decision.
  const logAnalytics = isFeatureEnabled(tenant, "analytics") && result.analyticsAllowed;
  const countSession = !result.sessionCap.overLimit;
  const sessionInput = sessionInputFromContext(input, input.pathname ?? "/");

  after(async () => {
    if (logAnalytics) {
      const sessionUpsert = await upsertSession({ id: sessionId, ...sessionInput });
      if (!sessionUpsert.ok) {
        logger.warn("[homepage] Session upsert failed — skipping served_variants write", {
          sessionId,
          tenantId: tenantConfig.tenantId,
          error: sessionUpsert.error,
        });
      } else {
        await logServedVariants(sessionId, experience, tenantConfig.tenantId);
      }
    }
    if (countSession) {
      await recordPersonalizedSession(tenantConfig.tenantId, result.webSessionId, result.sessionCap)
        .catch(() => null);
    }
  });

  // ── Token context ─────────────────────────────────────────────────────────
  //
  // Build a TokenContext from the pipeline input so that {{placeholders}} in
  // CMS copy (hero title, subtitle, tag; proof title; CTA title, text) are
  // replaced with real visitor data before rendering.  Enrichment fields
  // (companyName, city, …) come from reverse-IP / CRM; visitor context fields
  // (source, device, visitType, …) come from the request context.
  const tokenContext = buildTokenContextFromInput(input);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main
      data-debug-hero={experience.plan.heroKey}
      data-debug-exp={String(gatedPlan.heroKey)}
      data-debug-tenant={tenantConfig.tenantId}
      data-debug-exp-applied={appliedExperiment ? appliedExperiment.experimentId : "none"}
      data-debug-exp-bucket={appliedExperiment ? String(appliedExperiment.bucket) : "none"}
    >
      {/* Slot-based renderer: hero + proof → content blocks → CTA */}
      <TemplateRenderer pageConfig={pageConfig} contextData={contextData} tokenContext={tokenContext} />
    </main>
  );
}
