/**
 * /demo  —  Decision Engine Debug Page
 *
 * Shows the full debug overlay for the active tenant's homepage decision
 * pipeline.  Runs exactly the same pipeline as the homepage (same enrichment,
 * same rules engine, same AI layer) so the output accurately reflects what
 * visitors see.
 *
 * ── Visibility gate ───────────────────────────────────────────────────────────
 *
 *   Controlled by the tenant admin toggle:
 *     Admin → Tenants → [tenant] → Debug → "Show debug overlay"
 *
 *   When the flag is off, visitors see a plain "Debug disabled" message.
 *   This allows each tenant to independently control access — useful for
 *   sales demos, technical walkthroughs, and internal QA.
 *
 * ── What's shown ─────────────────────────────────────────────────────────────
 *
 *   • Summary info (tenant, CMS, decision plan, AI, theme, cache)
 *   • ContextDebugPanel   — all context variables resolved from the request
 *   • JourneyDebugMount   — behavioral scoring, journey state, recent events
 *   • EnrichmentDebugPanel — IP enrichment, stage timeline, Leadinfo, GA4
 *   • BillingDebugPanel   — per-request billing intent from stage trace
 *
 * ── Side effects ─────────────────────────────────────────────────────────────
 *
 *   None.  /demo deliberately does NOT run logServedVariants, upsertSession,
 *   or recordPersonalizedSession — those analytics/billing side effects belong
 *   to real page views on the homepage, not debug renders.
 */

import { runHomepagePipeline }        from "@/lib/pipeline/homepage-pipeline";
import { ContextDebugPanel }          from "@/components/blocks/ContextDebugPanel";
import { JourneyDebugMount }          from "@/components/blocks/JourneyDebugMount";
import { EnrichmentDebugPanel }       from "@/components/blocks/EnrichmentDebugPanel";
import { BillingDebugPanel }          from "@/components/blocks/BillingDebugPanel";
import { buildBillingDebugFromTrace } from "@/billing/request-debug";

// ─────────────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DemoDebugPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const r      = await runHomepagePipeline({ params });

  const {
    tenantConfig,
    devTenantOverride,
    devOverrideSource,
    tenant,
    tenantFeatures,
    debugOverlayEnabled,
    debugLevel,

    sessionId,
    hostHeader,
    isDev,

    history,
    realHistory,
    effectiveHistory,
    scenarioOverrides,
    input,

    experience,
    composed,
    adaptiveGating,
    anySlotGated,
    gatingSummary,

    aiConfig,
    aiMeta,
    aiPromptPayload,

    homePage,
    cmsFallbackKeys,
    enabledContextBlocks,

    capturedDebugInfo,
    contextSnapshot,
    journeyDebugEvents,
    leadinfoDebugInfo,
    ga4HistoryDebugInfo,
    billingClient,

    resolvedTheme,
    themeOverrideCount,
    activeThemeKey,

    cmsCacheStats,
    decisionPlanMeta,
    pageConfig,

    CMS_CACHE_ENABLED,
    CMS_CACHE_TTL_MS,
    DECISION_CACHE_ENABLED,
    DECISION_CACHE_TTL_MS,
    SESSION_TTL_MS,
    SESSION_STALE_GRACE_MS,
    SANITY_REVALIDATE_SECONDS,
    resolveContextBlockVariant,
  } = r;

  // ── Gate ──────────────────────────────────────────────────────────────────
  if (!debugOverlayEnabled) {
    return (
      <main style={{ padding: "4rem 2rem", fontFamily: "system-ui, sans-serif", color: "#6b7280" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
          Debug overlay disabled
        </h1>
        <p>
          Enable it at{" "}
          <a
            href={`/admin/tenants/${tenantConfig.tenantId}/debug`}
            style={{ color: "#4f46e5" }}
          >
            Admin → Tenants → {tenantConfig.tenantId} → Debug
          </a>
        </p>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main>
      <section style={{ padding: "2rem 4rem", fontFamily: "Arial, sans-serif" }}>

        {/* Page heading */}
        <h1 style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "2px solid #e5e7eb",
        }}>
          🦎 Decision Engine: Live Debug
          <span style={{ fontWeight: 400, fontSize: "0.875rem", color: "#6b7280", marginLeft: "0.75rem" }}>
            {tenantConfig.tenantId} · session {sessionId.slice(0, 8)}…
          </span>
        </h1>

        {/* Dev tenant override banner */}
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
            ⚠ DEV OVERRIDE: tenant forced to &quot;{devTenantOverride}&quot; via{" "}
            {devOverrideSource === "cookie"
              ? <>mc_dev_tenant cookie. Visit <a href={`/admin/tenants/${devTenantOverride}`} style={{ color: "#b45309" }}>/admin/tenants/{devTenantOverride}</a> to change or clear.</>
              : <>?tenant= query param. Remove this param to restore resolution.</>}
          </p>
        )}

        {/* ── Summary info ──────────────────────────────────────────────── */}
        <p><strong>Host header:</strong> {hostHeader ?? "(none)"}</p>
        <p>
          <strong>Active tenant:</strong> {tenantConfig.tenantId} ({tenantConfig.name})
          {devTenantOverride !== null
            ? <span style={{ color: "#b45309" }}> · overridden via {devOverrideSource === "cookie" ? "cookie" : "?tenant="}</span>
            : <span style={{ color: "#6b7280" }}> · resolved from Host header</span>}
        </p>
        <p><strong>Tenant settings (DB):</strong> {tenant?.tenantId ?? "not found: defaults active"}</p>
        <p>
          <strong>CMS provider (config):</strong> {tenantConfig.cmsProvider}
          {tenantConfig.cmsProvider === "sanity" && !process.env.SANITY_PROJECT_ID
            ? " ⚠ no SANITY_PROJECT_ID → mock fallback"
            : ""}
        </p>

        {/* CMS connection details */}
        {tenantConfig.cmsProvider === "sanity" && (
          <>
            <p>
              <strong>CMS projectId:</strong>{" "}
              {tenant?.cms?.projectId
                ? <span style={{ color: "#1d4ed8" }}>{tenant.cms.projectId} <em style={{ color: "#6b7280", fontStyle: "normal" }}>(tenant override)</em></span>
                : <span>{process.env.SANITY_PROJECT_ID ?? <span style={{ color: "#b91c1c" }}>⚠ missing</span>} <em style={{ color: "#6b7280", fontStyle: "normal" }}>(platform env)</em></span>}
            </p>
            <p>
              <strong>CMS dataset:</strong>{" "}
              {tenant?.cms?.dataset
                ? <span style={{ color: "#1d4ed8" }}>{tenant.cms.dataset} <em style={{ color: "#6b7280", fontStyle: "normal" }}>(tenant override)</em></span>
                : <span>{process.env.SANITY_DATASET ?? <span style={{ color: "#b91c1c" }}>⚠ missing</span>} <em style={{ color: "#6b7280", fontStyle: "normal" }}>(platform env)</em></span>}
            </p>
            <p>
              <strong>CMS authenticated:</strong>{" "}
              {(process.env.SANITY_READ_TOKEN ?? process.env.SANITY_API_TOKEN ?? process.env.SANITY_API_WRITE_TOKEN)
                ? <span style={{ color: "#15803d" }}>✓ token present (live API)</span>
                : <span style={{ color: "#b91c1c" }}>⚠ no token: CDN only (private datasets will return null)</span>}
            </p>
            {tenant?.cms?.studioUrl && (
              <p>
                <strong>CMS studio:</strong>{" "}
                <a href={tenant.cms.studioUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5" }}>
                  {tenant.cms.studioUrl}
                </a>
              </p>
            )}
          </>
        )}

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
            : "(no contextConfig: CMS page absent or has no slot config)"}
        </p>

        <hr style={{ margin: "0.5rem 0", border: "none", borderTop: "1px solid #eee" }} />

        <p><strong>Source:</strong> {input.source}</p>
        <p><strong>Visit type:</strong> {input.visitType}</p>
        <p><strong>Page views (prior):</strong> {history.pageViewCount}</p>
        <p><strong>Has clicked CTA:</strong> {String(history.hasClickedCta)}</p>
        <p><strong>History from DB:</strong> {String(history.fromDatabase)}</p>
        <p><strong>Hero key:</strong> {experience.plan.heroKey}</p>
        <p>
          <strong>Hero layout (CMS):</strong>{" "}
          {experience.hero.layoutVariant
            ? <span style={{ color: "#1d4ed8" }}>{experience.hero.layoutVariant}</span>
            : <span style={{ color: "#b91c1c" }}>⚠ not set: will use hero_default fallback</span>}
        </p>
        <p>
          <strong>Hero layout (resolved):</strong>{" "}
          {(() => {
            const raw      = experience.hero.layoutVariant;
            const resolved = resolveContextBlockVariant("hero", raw);
            const fell     = !raw || raw !== resolved;
            return fell
              ? <span style={{ color: "#b45309" }}>{resolved} <em style={{ color: "#6b7280", fontStyle: "normal" }}>(fallback from {raw ?? "undefined"})</em></span>
              : <span style={{ color: "#15803d" }}>{resolved}</span>;
          })()}
        </p>
        <p><strong>Proof key:</strong> {experience.plan.proofKey}</p>
        <p><strong>CTA key:</strong> {experience.plan.ctaKey}</p>
        <p><strong>Reason:</strong> {experience.plan.reason}</p>
        <p><strong>AI mode:</strong> {aiConfig.mode}</p>
        <p><strong>AI provider:</strong> {aiConfig.liveProvider?.name ?? aiConfig.shadowProvider?.name ?? "none"}</p>
        <p><strong>AI used:</strong> {aiMeta ? String(aiMeta.aiUsed) : "n/a"}</p>
        <p><strong>AI confidence:</strong> {aiMeta?.aiConfidence !== undefined ? aiMeta.aiConfidence.toFixed(3) : "n/a"}</p>
        <p><strong>Fallback reason:</strong> {aiMeta ? (aiMeta.fallbackReason ?? "none") : "n/a"}</p>
        <p><strong>AI signal count:</strong> {aiPromptPayload ? aiPromptPayload.signalCount : "n/a"}</p>

        {aiPromptPayload && (
          <details style={{ marginTop: "0.25rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>
              AI prompt sent to model ({aiPromptPayload.userPrompt.length} chars)
            </summary>
            <pre style={{
              marginTop: "0.5rem",
              padding: "0.5rem",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "4px",
              fontSize: "0.65rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "400px",
              overflowY: "auto",
            }}>
              {aiPromptPayload.userPrompt}
            </pre>
          </details>
        )}

        <p>
          <strong>Theme key:</strong>{" "}
          {String(resolvedTheme.key)}
          {activeThemeKey && activeThemeKey !== (tenant?.design?.theme ?? "modern-saas") && (
            <span style={{ color: "#6366f1", marginLeft: "0.5rem" }}>
              (contextual override via mc_theme cookie)
            </span>
          )}
        </p>
        <p><strong>Theme overrides:</strong> {themeOverrideCount}</p>
        <p><strong>Enabled blocks:</strong> {[...enabledContextBlocks].join(", ") || "none"}</p>
        <p><strong>Features:</strong> experiments={String(tenantFeatures.experiments)} / ai={String(tenantFeatures.ai)} / analytics={String(tenantFeatures.analytics)}</p>
        <p><strong>Template:</strong> {pageConfig.templateKey}</p>
        <p><strong>Context slots:</strong> {pageConfig.contextSlots.map((s) => `${s.slotId}(${s.variantKey ?? "off"}${s.layoutVariant ? `/${s.layoutVariant}` : ""})`).join(", ")}</p>
        <p><strong>Content blocks:</strong> {pageConfig.contentBlocks.length}</p>

        {/* ── Cache layers ───────────────────────────────────────────────── */}
        <hr style={{ margin: "0.5rem 0", border: "none", borderTop: "1px solid #eee" }} />
        <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Cache layers</p>

        <p>
          <strong>CMS in-process cache:</strong>{" "}
          {CMS_CACHE_ENABLED
            ? <span style={{ color: "#15803d" }}>
                active: TTL {CMS_CACHE_TTL_MS / 1_000}s
                {" · "}{cmsCacheStats.fresh} fresh, {cmsCacheStats.stale} stale entries
              </span>
            : <span style={{ color: "#b45309" }}>
                bypassed (dev): every CMS fetch is live
                {process.env.CMS_FORCE_CACHE === "true" && " [CMS_FORCE_CACHE=true]"}
              </span>}
        </p>

        <p>
          <strong>ISR / Next.js fetch cache:</strong>{" "}
          {isDev
            ? <span style={{ color: "#b45309" }}>
                bypassed (dev): Sanity fetches use{" "}
                <code style={{ background: "#f1f5f9", padding: "0 3px", borderRadius: "2px" }}>cache: &quot;no-store&quot;</code>
              </span>
            : <span style={{ color: "#15803d" }}>
                active: revalidate every {SANITY_REVALIDATE_SECONDS}s
                {" ("}tag: <code style={{ background: "#f1f5f9", padding: "0 3px", borderRadius: "2px" }}>sanity</code>{")"}
              </span>}
        </p>

        <p>
          <strong>Decision cache:</strong>{" "}
          {DECISION_CACHE_ENABLED
            ? <span style={{ color: "#15803d" }}>
                active: TTL {DECISION_CACHE_TTL_MS / 1_000}s
                {decisionPlanMeta.exists
                  ? <> · session plan age {Math.round((decisionPlanMeta.ageMs ?? 0) / 1_000)}s (cache hit)</>
                  : <> · session plan not cached (cache miss, freshly evaluated)</>}
              </span>
            : <span style={{ color: "#b45309" }}>
                bypassed (dev): rules re-evaluated on every request
                {process.env.DECISION_FORCE_CACHE === "true" && " [DECISION_FORCE_CACHE=true]"}
              </span>}
        </p>

        <p>
          <strong>Session enrichment cache:</strong>{" "}
          {capturedDebugInfo?.enrichmentSource === "session-cache"
            ? <span style={{ color: "#15803d" }}>
                hit: enrichment served from cache (TTL {SESSION_TTL_MS / 1_000}s
                {", grace "}
                {SESSION_STALE_GRACE_MS / 1_000}s)
              </span>
            : <span style={{ color: "#b45309" }}>
                miss: enrichment pipeline ran
                {" (TTL "}
                {SESSION_TTL_MS / 1_000}s
                {capturedDebugInfo?.enrichmentSource
                  ? `, reason: ${capturedDebugInfo.enrichmentSource}`
                  : ""}
                {")"}
              </span>}
        </p>

        <p style={{ color: "#6b7280", fontSize: "11px", marginTop: "0.5rem" }}>
          Debug level: <strong>{debugLevel}</strong>: change at{" "}
          <a href={`/admin/tenants/${tenantConfig.tenantId}/debug`} style={{ color: "#4f46e5" }}>
            /admin/tenants/{tenantConfig.tenantId}/debug
          </a>
        </p>

        {/* ── Context variable tables ────────────────────────────────────── */}
        {debugLevel === "full" && contextSnapshot && (
          <>
            <hr style={{ margin: "1rem 0", border: "none", borderTop: "2px solid #d1d5db" }} />
            <ContextDebugPanel
              snapshot={contextSnapshot}
              scenarioOverrides={scenarioOverrides ?? undefined}
            />
          </>
        )}

        {/* ── Journey behavioral debug ───────────────────────────────────── */}
        {debugLevel === "full" && (
          <>
            <hr style={{ margin: "1rem 0", border: "none", borderTop: "2px solid #d1d5db" }} />
            <JourneyDebugMount
              journey={effectiveHistory.journey ?? null}
              realJourney={scenarioOverrides ? (realHistory.journey ?? null) : undefined}
              scenarioActive={!!scenarioOverrides}
              scenarioLabel={null}
              recentEvents={journeyDebugEvents}
              matchedRule={composed.trace.matchedRule ?? null}
              experiencePlan={{
                heroKey:  experience.plan.heroKey,
                proofKey: experience.plan.proofKey,
                ctaKey:   experience.plan.ctaKey,
                themeKey: experience.plan.themeKey ?? null,
              }}
              adaptiveGating={adaptiveGating}
              gatingSummary={anySlotGated ? gatingSummary : undefined}
            />
          </>
        )}

        {/* ── Enrichment pipeline / IP / Leadinfo detail ─────────────────── */}
        {debugLevel === "full" && capturedDebugInfo && (
          <>
            <hr style={{ margin: "1rem 0", border: "none", borderTop: "2px solid #d1d5db" }} />
            <EnrichmentDebugPanel
              info={capturedDebugInfo}
              ga4History={ga4HistoryDebugInfo}
              leadinfoDebug={leadinfoDebugInfo}
            />
          </>
        )}

        {/* ── Billing / usage debug ──────────────────────────────────────── */}
        {debugLevel === "full" && capturedDebugInfo?.stageTrace && (() => {
          const billingDebug = buildBillingDebugFromTrace(
            capturedDebugInfo.stageTrace ?? [],
            {
              billingMode: billingClient ? "live" : "disabled",
              demoMode:    false,
              tenantId:    tenantConfig.tenantId,
              sessionId:   sessionId ?? undefined,
            },
          );
          return (
            <>
              <hr style={{ margin: "1rem 0", border: "none", borderTop: "2px solid #d1d5db" }} />
              <BillingDebugPanel debug={billingDebug} />
            </>
          );
        })()}

      </section>
    </main>
  );
}
