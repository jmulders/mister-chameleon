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

import Link                                from "next/link";
import { isFeatureEnabled }                from "@/tenant/server";
import { upsertSession, sessionInputFromContext } from "@/data/repositories";
import { logServedVariants }               from "@/experience/log-served-variants";
import { recordPersonalizedSession }       from "@/billing/plan-enforcement";
import { TemplateRenderer }                from "@/components/platform/TemplateRenderer";
import { logger }                          from "@/lib/logger";
import { runHomepagePipeline }             from "@/lib/pipeline/homepage-pipeline";
import { buildTokenContextFromInput }      from "@/lib/tokens/parse-tokens";
import { serverEnv }                       from "@/lib/env";
import { StatamicClient }                  from "@/cms/providers/statamic-client";

// ── Rendering mode ────────────────────────────────────────────────────────────
//
// force-dynamic: the homepage personalises per request (visitor context, A/B
// experiments) AND must honour the ?_mc_draft=TOKEN Live Preview query param.
// Without this, Vercel may serve a CDN-cached HTML for "/" that ignores the
// query string, so Live Preview drafts (and per-visitor variants) never render.
export const dynamic = "force-dynamic";

// ── Statamic content types for homepage sections ──────────────────────────────

interface StatamicFeatureEntry {
  id: string; slug: string; title: string;
  icon?: string; headline?: string; body?: string; badge?: string;
  is_active?: boolean;
}

interface StatamicTestimonial {
  id: string; slug: string; title: string;
  quote?: string; author_name?: string; author_title?: string;
  author_company?: string; rating?: number; is_active?: boolean;
}

const ICON_MAP: Record<string, string> = {
  code: "⌨️", shield: "🛡️", users: "👥", refresh: "🔄",
  flask: "🧪", chart: "📊", plug: "🔌", building: "🏢", default: "🦎",
};
const featureIcon = (handle?: string) => ICON_MAP[handle ?? ""] ?? ICON_MAP.default;

// ── Homepage extra sections ───────────────────────────────────────────────────

async function fetchHomepageSections(): Promise<{
  features: StatamicFeatureEntry[];
  testimonials: StatamicTestimonial[];
}> {
  const { isConfigured, apiUrl, apiKey } = serverEnv.statamic;
  if (!isConfigured) return { features: [], testimonials: [] };

  try {
    const client = new StatamicClient(apiUrl, apiKey);
    const [rawFeatures, rawTestimonials] = await Promise.all([
      client.fetchAll<StatamicFeatureEntry>("features", 8),
      client.fetchAll<StatamicTestimonial>("testimonials", 6),
    ]);
    return {
      features:     rawFeatures.filter((f) => f.is_active !== false),
      testimonials: rawTestimonials.filter((t) => t.is_active !== false),
    };
  } catch {
    return { features: [], testimonials: [] };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HomepageFeaturesSection({ features }: { features: StatamicFeatureEntry[] }) {
  if (features.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-12 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Everything you need, nothing you don&apos;t
        </h2>
        <p className="mt-3 max-w-2xl mx-auto text-base text-neutral-500">
          Server-side personalisation without cookies, consent banners, or engineering sprints.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
        {features.slice(0, 6).map((f) => (
          <div key={f.id} className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-100 text-xl">
              {featureIcon(f.icon)}
            </div>
            <div>
              {f.badge && (
                <span className="mb-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  {f.badge}
                </span>
              )}
              <h3 className="font-semibold text-neutral-900 text-sm">{f.headline ?? f.title}</h3>
              {f.body && <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 line-clamp-2">{f.body}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/features"
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 hover:underline"
        >
          See all features →
        </Link>
      </div>
    </section>
  );
}

function HomepageTestimonialsSection({ testimonials }: { testimonials: StatamicTestimonial[] }) {
  if (testimonials.length === 0) return null;
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            Trusted by B2B marketing teams
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((t) => (
            <figure key={t.id} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5">
              <blockquote className="flex-1 text-sm leading-relaxed text-neutral-700 italic">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                  {(t.author_name ?? "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{t.author_name}</p>
                  {(t.author_title || t.author_company) && (
                    <p className="text-xs text-neutral-500">
                      {[t.author_title, t.author_company].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 hover:underline"
          >
            Read customer stories →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  // Run the personalisation pipeline and the Statamic section fetch in parallel
  // so the total page latency is max(pipeline, CMS) rather than their sum.
  const [result, { features, testimonials }] = await Promise.all([
    runHomepagePipeline({ params }),
    fetchHomepageSections(),
  ]);

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

  // ── Analytics side-effect ────────────────────────────────────────────────
  //
  // Gate served-variant logging behind the analytics feature flag.
  // upsertSession ensures the FK (sessions.id) exists before logServedVariants
  // inserts the served_variants row.  ON CONFLICT DO NOTHING = safe to call
  // on every page load without double-counting.
  if (isFeatureEnabled(tenant, "analytics")) {
    const sessionUpsert = await upsertSession({
      id: sessionId,
      ...sessionInputFromContext(input, input.pathname ?? "/"),
    });

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

  // ── Billing side-effect ──────────────────────────────────────────────────
  //
  // Non-blocking; idempotent per (tenant, month, session) triple.
  recordPersonalizedSession(tenantConfig.tenantId, sessionId).catch(() => null);

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

      {/* Additional homepage sections — rendered from Statamic collections */}
      <HomepageFeaturesSection features={features} />
      <HomepageTestimonialsSection testimonials={testimonials} />
    </main>
  );
}
