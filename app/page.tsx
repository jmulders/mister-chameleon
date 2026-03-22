/**
 * Homepage  —  app/page.tsx
 *
 * ─── Data pipeline (unchanged from prior implementation) ─────────────────────
 *
 *   1. Detect visitor context (headers, cookies, UTM params)
 *   2. Resolve session ID (for experiment bucketing + history fetch)
 *   3. Load tenant settings (package, blocks, AI mode, theme)
 *   4. Build decision provider stack: rules → experiments → AI (mode-driven)
 *   5. Run composeHomepageExperience() + cmsProvider.getPageBySlug() in parallel
 *   6. Gate served-variant logging behind analytics feature flag
 *   7. Apply tenant block gating (enabledContextBlocks, filterSectionsByTenant)
 *   8. Resolve tenant theme → inject CSS variables
 *
 * ─── Rendering (refactored toward slot-based platform architecture) ───────────
 *
 *   The previous inline block rendering has been replaced by:
 *
 *     buildHomepagePageConfig()   →  { pageConfig, contextData }
 *     <TemplateRenderer />        →  renders slots in template order
 *
 *   PageConfig carries:
 *     - templateKey: "homepage"
 *     - contextSlots: [hero, proof] (before) + [cta] (after)
 *     - contentBlocks: mapped from CMS sections (reorderable array)
 *
 *   TemplateRenderer renders:
 *     - before-content context slots → HeroBlock, ProofBlock
 *     - content blocks               → ContentBlockRenderer
 *     - after-content context slots  → CTABlock
 *
 * ─── What hasn't changed ──────────────────────────────────────────────────────
 *
 *   - Decision engine (rules → experiments → AI)
 *   - Tenant block gating
 *   - Analytics / served-variant logging
 *   - Tenant theme injection
 *   - Dev diagnostics section
 *   - Visual output (hero + proof before content, cta after)
 *
 * ─── Migration boundaries (marked in code) ───────────────────────────────────
 *
 *   [page-config] buildHomepagePageConfig — assembles PageConfig + ContextSlotData
 *   [platform]    TemplateRenderer        — renders slots + content blocks
 */

import { headers } from "next/headers";
import { fetchVisitorHistory } from "@/context/fetch-visitor-history";
import { RulesDecisionProvider, ExperimentDecisionProvider } from "@/decision";
import type { DecisionProvider } from "@/decision/providers/decision-provider";
import { buildDecisionContext } from "@/decision/context/build-decision-context";
import { createCMSProvider } from "@/cms";
import { composeHomepageExperience } from "@/experience";
import type { CmsFallbackKeys }      from "@/experience";
import { resolveSession } from "@/data/session";
import { PageTracker } from "@/components/tracking/PageTracker";
import { logServedVariants } from "@/experience/log-served-variants";
// ── AI layer — server-side only ───────────────────────────────────────────────
// The active AI mode is resolved from the tenant's admin-UI settings (DB) with
// env vars as a fallback.  The mode governs what runs on each request:
//
//   disabled → base provider only.  No AI call, no DB write.
//   shadow   → AI runs in parallel; rules plan always served; both plans logged.
//   live     → AI runs on the critical path; served when confidence ≥ threshold.
import { getTenantAiRuntimeConfig } from "@/ai/config";
import { createAiProvider } from "@/ai/providers/create-ai-provider";
import { AiDecisionProvider } from "@/decision/providers/ai-decision-provider";
import type { AiDecisionMeta } from "@/decision/providers/ai-decision-provider";
import { ShadowAiDecisionProvider } from "@/decision/providers/shadow-ai-decision-provider";
import { DEFAULT_CONFIDENCE_POLICY } from "@/decision/ai-confidence-policy";
import { logger } from "@/lib/logger";
import {
  getTenantById,
  getActiveTenantWithDevOverride,
  resolveThemeForTenant,
  resolvedThemeToCSS,
  getEnabledContextBlocks,
  filterSectionsByTenant,
  isFeatureEnabled,
  getTenantFeatures,
} from "@/tenant/server";
// ── [page-config] Slot-based architecture imports ─────────────────────────────
import { buildHomepagePageConfig } from "@/page-config/assemblers/homepage";
import { TemplateRenderer }        from "@/components/platform/TemplateRenderer";

// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const h = await headers();

  const cookieHeader = h.get("cookie");

  const url = new URL("http://localhost:3000");

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }

  const request = new Request(url.toString(), {
    headers: new Headers({
      "user-agent": h.get("user-agent") ?? "",
      referer: h.get("referer") ?? "",
      cookie: cookieHeader ?? "",
    }),
  });

  // Resolve the session ID so the experiment layer can deterministically
  // bucket this visitor, and so history can be fetched for this session.
  // Middleware has already written mc_session_id by the time this component renders.
  const { sessionId } = resolveSession(cookieHeader);

  // ── Tenant resolution ────────────────────────────────────────────────────────
  // Resolves the active tenant with development overrides applied in priority
  // order: ?tenant= query param → mc_dev_tenant cookie → Host header.
  //
  // This is a fast registry lookup (no DB).  We resolve it first so the
  // tenantId is available for scoping the concurrent DB fetches below.
  const { tenantConfig, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "homepage");

  // Kick off both DB-heavy calls concurrently:
  //   • getTenantById  — loads the DB-backed TenantSettings record (AI mode,
  //                      provider, confidence threshold, package, etc.)
  //   • fetchVisitorHistory — derives first-party behavioural signals for the
  //                           session, scoped to the active tenant.
  //
  // Both never throw — getTenantById returns null when the record is absent;
  // fetchVisitorHistory returns emptyHistory() on any DB error.
  const historyPromise = fetchVisitorHistory(sessionId, tenantConfig.tenantId);

  const tenant = await getTenantById(tenantConfig.tenantId);

  // ── Decision provider ───────────────────────────────────────────────────────
  //
  // Base stack: ExperimentDecisionProvider wraps RulesDecisionProvider.
  // This runs the rules engine then checks active A/B experiments, potentially
  // overriding one or more slots for enrolled sessions.
  //
  // This base stack ALWAYS determines the rendered output — nothing below
  // changes what the visitor sees.
  const baseDecisionProvider = new ExperimentDecisionProvider(
    new RulesDecisionProvider(),
    sessionId,
  );

  // ── AI layer: route to the correct provider for the active mode ─────────────
  //
  // AI mode, provider, and confidence threshold are resolved from the tenant's
  // admin-UI settings (TenantSettings) with env vars as a fallback.
  // The base provider (rules + experiments) is ALWAYS the structural fallback —
  // nothing changes what the visitor sees unless mode is "live" AND the AI plan
  // passes the confidence policy.
  //
  //   disabled → decisionProvider stays as baseDecisionProvider.
  //              No AI call.  No ai_decision_logs row.
  //
  //   shadow   → ShadowAiDecisionProvider wraps base.
  //              AI runs in parallel; base plan always rendered.
  //              Both plans written to ai_decision_logs (fire-and-forget).
  //
  //   live     → AiDecisionProvider wraps base (shadowOnly = false).
  //              AI runs on the critical path.
  //              When confidence ≥ threshold → AI plan served.
  //              When confidence < threshold, invalid output, or AI error
  //              → base plan served.  Plan + verdict written to ai_decision_logs.
  //
  // Construction failures are caught defensively (constructors do no I/O so
  // this branch is effectively unreachable in normal operation).
  const aiConfig = getTenantAiRuntimeConfig(tenant);

  // Build the confidence policy from the tenant-resolved threshold.
  // minContextRichness and validateVariantKeys stay at platform defaults —
  // only the confidence cut-off is tenant-configurable.
  const aiPolicy = {
    ...DEFAULT_CONFIDENCE_POLICY,
    minConfidence: aiConfig.confidenceThreshold,
  };

  let decisionProvider: DecisionProvider = baseDecisionProvider;

  if (aiConfig.mode === "shadow") {
    try {
      const aiProvider = createAiProvider(aiConfig.shadowProvider);
      decisionProvider = new ShadowAiDecisionProvider(
        baseDecisionProvider,
        aiProvider,
        sessionId,
        aiPolicy,
        tenantConfig.tenantId,   // written to ai_decision_logs.tenant_id
      );
      logger.debug("[homepage] Shadow AI active", {
        sessionId,
        provider:   aiConfig.shadowProvider?.name,
        tenantId:   tenantConfig.tenantId,
        threshold:  aiConfig.confidenceThreshold,
      });
    } catch (err) {
      logger.warn("[homepage] Failed to construct ShadowAiDecisionProvider; using base provider", {
        sessionId,
        tenantId: tenantConfig.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (aiConfig.mode === "live") {
    try {
      const aiProvider = createAiProvider(aiConfig.liveProvider);
      decisionProvider = new AiDecisionProvider(
        baseDecisionProvider,
        aiProvider,
        sessionId,
        aiPolicy,
        /* shadowOnly */ false,
        tenantConfig.tenantId,   // written to ai_decision_logs.tenant_id
      );
      logger.debug("[homepage] Live AI active", {
        sessionId,
        provider:  aiConfig.liveProvider?.name,
        tenantId:  tenantConfig.tenantId,
        threshold: aiConfig.confidenceThreshold,
      });
    } catch (err) {
      logger.warn("[homepage] Failed to construct live AiDecisionProvider; using base provider", {
        sessionId,
        tenantId: tenantConfig.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // mode === "disabled": baseDecisionProvider used as-is — no log needed.

  // Tenant CMS preference and tenantId are passed through so the provider can
  // scope all GROQ queries to this tenant's content plus shared documents.
  // Falls back to env-based priority when the tenant record is absent.
  const cmsProvider = createCMSProvider(tenant?.cms, tenantConfig.tenantId);

  // Kick off the home-page document fetch immediately after the CMS provider is
  // created — it runs in parallel with the history await and decision context
  // build below, minimising total latency.
  //
  // We need this document BEFORE composeHomepageExperience so we can extract
  // cmsFallbackKeys from contextConfig and pass them as the intermediate
  // fallback tier.  This prevents a homepage crash when the decision engine
  // picks generic variant keys (e.g. "hero_google_problem") that don't exist
  // in the tenant's CMS — the page's own contextConfig declares tenant-specific
  // fallback keys (e.g. "hero_workengine_default") to use instead.
  const homePagePromise = cmsProvider.getPageBySlug("home");

  // Await history (kicked off above) then build the complete decision context.
  // buildDecisionContext merges traffic signals, device detection, history, and
  // page-level metadata into a single RuleEvaluationContext (satisfies DecisionInput).
  const history = await historyPromise;
  const input = buildDecisionContext({
    request,
    history,
    tenantId:    tenantConfig.tenantId,
    templateKey: "homepage",
    pageType:    "homepage",
  });

  // Await the home-page document (started early above alongside history fetch).
  // Extract CMS-defined fallback variant keys from the page's contextConfig so
  // the experience composer can use them as the first fallback tier when the
  // decision engine's primary plan cannot be resolved from the CMS.
  //
  // Example: the WorkEngine homepage declares
  //   contextConfig.hero.fallbackVariantKey = "hero_workengine_default"
  // so if "hero_google_problem" is not in Sanity, "hero_workengine_default" is
  // tried before the hardcoded FALLBACK_PLAN.
  const homePage = await homePagePromise;

  const cmsFallbackKeys: CmsFallbackKeys | undefined = homePage?.contextConfig
    ? {
        heroKey:  homePage.contextConfig.hero?.fallbackVariantKey,
        proofKey: homePage.contextConfig.proof?.fallbackVariantKey,
        ctaKey:   homePage.contextConfig.cta?.fallbackVariantKey,
      }
    : undefined;

  // Run the decision-engine experience compose.
  //
  // When shadow mode is active, composeHomepageExperience calls
  // ShadowAiDecisionProvider.getHomepagePlan() which:
  //   1. Runs the base provider (rules + experiments) → resolves the live plan
  //   2. Runs the AI provider in parallel             → produces the shadow plan
  //   3. Always returns the live plan to the renderer
  //   4. Fire-and-forgets the ai_decision_logs write
  const composed = await composeHomepageExperience(
    input,
    decisionProvider,
    cmsProvider,
    cmsFallbackKeys,
  );

  const { experience } = composed;

  // ── AI decision metadata (dev diagnostics only) ──────────────────────────
  // Extract last-decision metadata from the AI provider if one was constructed.
  // Safe: instanceof returns false for disabled mode (baseDecisionProvider).
  const aiMeta: AiDecisionMeta | null =
    decisionProvider instanceof AiDecisionProvider
      ? decisionProvider.lastDecisionMeta
      : null;

  // ── Tenant feature flags ──────────────────────────────────────────────────
  // Resolved once; individual flags used below to gate analytics and surface
  // feature state in diagnostics.  Defaults keep all previously-always-on
  // behaviour intact when no tenant record is present.
  const tenantFeatures = getTenantFeatures(tenant);

  // Gate served-variant logging behind the analytics feature flag.
  // Default is true so existing environments (no tenant store) are unaffected.
  if (isFeatureEnabled(tenant, "analytics")) {
    await logServedVariants(sessionId, experience, tenantConfig.tenantId);
  }

  // CMS sections to render below the adaptive blocks.
  // Falls back to an empty array when the "home" page document doesn't exist
  // in Sanity yet — the adaptive blocks always render regardless.
  const homeSections = homePage?.sections ?? [];

  // ── Tenant block gating ──────────────────────────────────────────────────
  // Resolved via helpers in tenant/runtime-helpers.ts — no inline ad-hoc logic.
  // Both functions fall back to safe defaults when tenant is null.
  const enabledContextBlocks = getEnabledContextBlocks(tenant);
  const filteredSections      = filterSectionsByTenant(homeSections, tenant);

  // ── Tenant theme ─────────────────────────────────────────────────────────
  const resolvedTheme = resolveThemeForTenant(tenant);
  const themeCSS      = resolvedThemeToCSS(resolvedTheme);

  // ── [page-config] Assemble PageConfig + ContextSlotData ─────────────────
  //
  // buildHomepagePageConfig converts:
  //   experience (decision + CMS)  →  contextSlots (with variantKeys)
  //   filteredSections (CMS)       →  contentBlocks (platform-internal)
  //   enabledContextBlocks         →  slot active/inactive flags
  //
  // The result is passed to TemplateRenderer which renders the page using
  // the slot-based platform architecture.  All visual output is identical
  // to the previous inline rendering.
  // Pass the CMS-sourced page metadata (title, SEO) to the assembler so the
  // PageConfig carries real values from Sanity rather than hardcoded strings.
  // All fields are optional — the assembler falls back to safe defaults when
  // the home-page document doesn't yet exist in the CMS.
  const { pageConfig, contextData } = buildHomepagePageConfig(
    experience,
    filteredSections,
    enabledContextBlocks,
    homePage
      ? { title: homePage.title, seoTitle: homePage.seoTitle, seoDescription: homePage.seoDescription }
      : undefined,
  );

  return (
    <main>
      {/* Inject tenant CSS variable overrides when the tenant has custom theme settings */}
      {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}

      {/*
       * Tenant context for client components.
       *
       * trackEvent() (and all client-side trackers) read this element to
       * include tenant_id in every POST /api/events call — scoping page_view
       * and cta_click events to the correct tenant in the database.
       *
       * The tenant ID is a non-secret slug — safe to expose client-side.
       */}
      <script
        id="__mc_tenant__"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ tenantId: tenantConfig.tenantId }),
        }}
      />

      <PageTracker pathname="/" />

      {/* ── [platform] Slot-based renderer ──────────────────────────────── */}
      {/*                                                                    */}
      {/* Renders: before-content slots (hero, proof) → content blocks       */}
      {/*        → after-content slots (cta)                                 */}
      {/*                                                                    */}
      {/* Previously this was three inline block renders + a sections map.   */}
      {/* The visual output is identical — the architecture is now enforced. */}
      <TemplateRenderer pageConfig={pageConfig} contextData={contextData} />

      {/* ── Dev diagnostics (remove before go-live) ─────────────────────── */}
      <section style={{ padding: "2rem 4rem", fontFamily: "Arial, sans-serif" }}>
        {/*
         * ── Tenant + CMS context ──────────────────────────────────────────
         *
         * Active tenant is resolved from the Host header via TENANT_REGISTRY:
         *   localhost / localhost:3000          → mister-chameleon
         *   workengine.localhost:3000           → workengine
         *   (any unregistered hostname)         → mister-chameleon (fallback)
         *
         * Tenant settings (DB): JSON-store record for this tenant.
         *   "not found" is normal on a fresh environment — all features fall
         *   back to safe defaults; the homepage still renders correctly.
         *
         * CMS provider (config): declared in the TenantConfig for this tenant.
         *   When Sanity is declared but SANITY_PROJECT_ID is absent in the
         *   environment, createCMSProvider() silently falls back to mock.
         */}
        {devTenantOverride !== null && (
          <p style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            color: "#92400e",
            fontWeight: "bold",
            marginBottom: "0.75rem",
            padding: "0.4rem 0.75rem",
          }}>
            ⚠ DEV OVERRIDE — tenant forced to &quot;{devTenantOverride}&quot; via{" "}
            {devOverrideSource === "cookie"
              ? <>mc_dev_tenant cookie. Visit <a href={`/admin/tenants/${devTenantOverride}`} style={{ color: "#b45309" }}>/admin/tenants/{devTenantOverride}</a> to change or clear.</>
              : <>?tenant= query param. Remove this param to restore resolution.</>
            }
          </p>
        )}
        <p><strong>Host header:</strong> {h.get("host") ?? "(none)"}</p>
        <p>
          <strong>Active tenant:</strong> {tenantConfig.tenantId} ({tenantConfig.name})
          {devTenantOverride !== null
            ? <span style={{ color: "#b45309" }}> · overridden via {devOverrideSource === "cookie" ? "cookie" : "?tenant="}</span>
            : <span style={{ color: "#6b7280" }}> · resolved from Host header</span>}
        </p>
        <p><strong>Tenant settings (DB):</strong> {tenant?.tenantId ?? "not found — defaults active"}</p>
        <p>
          <strong>CMS provider (config):</strong> {tenantConfig.cmsProvider}
          {tenantConfig.cmsProvider === "sanity" && !process.env.SANITY_PROJECT_ID
            ? " ⚠ no SANITY_PROJECT_ID → mock fallback"
            : ""}
        </p>
        <p><strong>CMS page title:</strong> {homePage?.title ?? "(no CMS page document)"}</p>
        <p><strong>CMS SEO title:</strong> {homePage?.seoTitle ?? "(inherited from title)"}</p>
        <p>
          <strong>CMS fallback keys:</strong>{" "}
          {cmsFallbackKeys
            ? <>
                hero={cmsFallbackKeys.heroKey ?? "(none)"}{" "}
                proof={cmsFallbackKeys.proofKey ?? "(none)"}{" "}
                cta={cmsFallbackKeys.ctaKey ?? "(none)"}
              </>
            : "(no contextConfig — CMS page absent or has no slot config)"
          }
        </p>
        <hr style={{ margin: "0.5rem 0", border: "none", borderTop: "1px solid #eee" }} />
        <p><strong>Source:</strong> {input.source}</p>
        <p><strong>Visit type:</strong> {input.visitType}</p>
        <p><strong>Page views (prior):</strong> {history.pageViewCount}</p>
        <p><strong>Has clicked CTA:</strong> {String(history.hasClickedCta)}</p>
        <p><strong>History from DB:</strong> {String(history.fromDatabase)}</p>
        <p><strong>Hero key:</strong> {experience.plan.heroKey}</p>
        <p><strong>Proof key:</strong> {experience.plan.proofKey}</p>
        <p><strong>CTA key:</strong> {experience.plan.ctaKey}</p>
        <p><strong>Reason:</strong> {experience.plan.reason}</p>
        <p><strong>AI mode:</strong> {aiConfig.mode}</p>
        <p><strong>AI provider:</strong> {aiConfig.liveProvider?.name ?? aiConfig.shadowProvider?.name ?? "none"}</p>
        <p><strong>AI used:</strong> {aiMeta ? String(aiMeta.aiUsed) : "n/a"}</p>
        <p><strong>AI confidence:</strong> {aiMeta?.aiConfidence !== undefined ? aiMeta.aiConfidence.toFixed(3) : "n/a"}</p>
        <p><strong>Fallback reason:</strong> {aiMeta ? (aiMeta.fallbackReason ?? "none") : "n/a"}</p>
        <p><strong>Theme key:</strong> {resolvedTheme.key}</p>
        <p><strong>Theme overrides:</strong> {Object.keys(resolvedTheme.vars).length}</p>
        <p><strong>Enabled blocks:</strong> {[...enabledContextBlocks].join(", ") || "none"}</p>
        <p><strong>Features:</strong> experiments={String(tenantFeatures.experiments)} / ai={String(tenantFeatures.ai)} / analytics={String(tenantFeatures.analytics)}</p>
        {/* [page-config] template info */}
        <p><strong>Template:</strong> {pageConfig.templateKey}</p>
        <p><strong>Context slots:</strong> {pageConfig.contextSlots.map((s) => `${s.slotId}(${s.variantKey ?? "off"})`).join(", ")}</p>
        <p><strong>Content blocks:</strong> {pageConfig.contentBlocks.length}</p>
      </section>
    </main>
  );
}
