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

// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

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
    </main>
  );
}
