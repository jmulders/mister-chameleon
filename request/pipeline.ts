/**
 * Request Pipeline — Canonical Homepage Flow Definition
 *
 * This module documents and enforces the explicit phase ordering of the
 * homepage request pipeline.  It is the single authoritative source for:
 *
 *   • What runs at request-time vs session-time
 *   • What runs on the critical path vs in parallel / non-blocking
 *   • Which cache layers are consulted at each phase
 *   • How slot resolution fits into the flow
 *
 * ─── Phases ───────────────────────────────────────────────────────────────────
 *
 *   Phase 0  Signal extraction          (sync, request-time, no I/O)
 *   Phase 1  Session + tenant           (concurrent DB reads)
 *   Phase 2  Enrichment pipeline        (wave-parallel external APIs, cached)
 *   Phase 3  Decision engine            (rules → experiments → AI, cached)
 *   Phase 4  CMS resolution             (parallel CMS fetches, cached)
 *   Phase 5  Render + analytics         (sync render; fire-and-forget analytics)
 *
 * ─── Phase 0 — Signal extraction ─────────────────────────────────────────────
 *
 *   Input:  incoming Next.js request (headers, cookies, searchParams)
 *   Output: VisitorContext (IP, user-agent, UTM, device, source)
 *
 *   - Reads CDN edge headers: x-forwarded-for, CF-IPCountry, user-agent, referer
 *   - Parses UTM parameters from the URL
 *   - Resolves sessionId from mc_session_id cookie (set by middleware)
 *   - Detects device type (mobile / tablet / desktop) from user-agent
 *   - Zero I/O — all values are derived from the request alone
 *   - Runtime: < 1 ms
 *
 * ─── Phase 1 — Session + tenant  ──────────────────────────────────────────────
 *
 *   Input:  sessionId, hostname
 *   Output: TenantConfig, TenantSettings, VisitorHistory, TenantRulesConfig
 *
 *   Runs as two concurrent waves:
 *
 *   Wave A  (non-blocking, started immediately)
 *     • fetchVisitorHistory(sessionId, tenantId)  → page-view count, source, events
 *
 *   Wave B  (parallel DB reads)
 *     • getActiveTenantWithDevOverride()  → tenant config (registry, fast)
 *     • getTenantById(tenantId)           → tenant settings (DB, package/flags)
 *     • loadTenantRulesConfig(tenantId)   → tenant rules JSON (DB or file)
 *
 *   Cache:  tenant registry is in-process (no DB); TenantSettings is DB-backed
 *           with no in-process cache (reads latest on every request).
 *
 * ─── Phase 2 — Enrichment pipeline ───────────────────────────────────────────
 *
 *   Input:  effectiveIp, visitorId, tenantId, UTM, sessionId
 *   Output: Partial<EnrichmentOutput> (geo, network, company, CRM, seasonal)
 *
 *   Cache check first (session-enrichment-cache):
 *     • Key: sessionId
 *     • TTL: 4 h fresh  + 1 h stale-while-revalidate grace
 *     • Hit:  return cached output immediately; skip pipeline entirely
 *     • Miss: run full wave-parallel pipeline (phases below)
 *
 *   When the pipeline runs, stages execute in wave order:
 *
 *     Sequential: IP Classification    (sync, no I/O, sets ipVersion)
 *
 *     Wave 1 (Promise.all — all read only input signals):
 *       • MaxMind GeoIP       → countryCode, region, city, lat, lng
 *       • IPinfo Lite         → networkAsn, networkOrg, networkDomain
 *       • GA4 History         → gaLastKnownCity, gaSessionCount, gaLastChannelGroup
 *
 *     Sequential: Cloud Detection      (sync, reads wave-1 networkOrg/Asn)
 *                                      → isCloudProvider
 *
 *     Wave 2 (Promise.all — all read wave-1 + cloud detection output):
 *       • Reverse Geocode     → addressCity, addressRegion, addressPostcode, …
 *       • Weather             → weatherCode, temperatureNow, isRaining, …
 *       • OpenKvK NL          → companyName, companyDomain  (NL only)
 *       • Leadinfo            → companyName, companyDomain, companyIndustry, …
 *
 *     Sequential: HubSpot CRM         (reads companyDomain from wave 2)
 *                                      → crmMatched, crmLifecycleStage, …
 *
 *     Sequential: Seasonal Event       (reads countryCode, 24 h provider cache)
 *                                      → seasonalEvent, holidayName
 *
 *   Provider-level caches (ProviderCache, per-instance TTL):
 *     • MaxMind:        in-process MMDB read, sub-millisecond
 *     • IPinfo:         1 h per IP (ProviderCache)
 *     • Reverse Geocode: 6 h per lat/lng
 *     • Weather:        1 h per lat/lng
 *     • OpenKvK:        configurable TTL per org name
 *     • Leadinfo:       1 h per IP (ProviderCache)
 *     • HubSpot domain: 2 h per company domain (module-level ProviderCache)
 *     • Nager.Date:     24 h per country+year
 *
 *   Result stored in session-enrichment-cache for subsequent page views.
 *
 * ─── Phase 3 — Decision engine ────────────────────────────────────────────────
 *
 *   Input:  DecisionInput (enrichment output + visitor context + history)
 *   Output: ExperiencePlan { heroKey, proofKey, ctaKey, reason }
 *
 *   Cache check first (decision-cache):
 *     • Key: (sessionId, contextHash)
 *     • contextHash: fingerprint of decision-relevant fields bucketed to reduce
 *       thrashing on non-meaningful changes (e.g. pageView 3→4 stays in bucket 2)
 *     • TTL: 30 min
 *     • Hit:  return cached plan; skip provider chain entirely
 *     • Miss: run provider chain
 *
 *   Provider chain (wrapping — innermost → outermost):
 *     1. RulesDecisionProvider      — tenant or platform rule evaluation
 *     2. ExperimentDecisionProvider — A/B experiment slot overrides
 *     3. AiDecisionProvider         — (when mode === "live") confidence-gated AI plan
 *     4. ShadowAiDecisionProvider   — (when mode === "shadow") fire-and-forget logging
 *     5. CachingDecisionProvider    — result cache layer (wraps the full chain)
 *
 *   CMS render cache (Next.js ISR, "sanity" tag):
 *     • The `unstable_cache` / fetch cache wrapping CMS provider calls
 *       serves stale CDN renders until `revalidateTag("sanity")` is called
 *       by the /api/revalidate webhook on CMS content change.
 *
 * ─── Phase 4 — CMS resolution ─────────────────────────────────────────────────
 *
 *   Input:  ExperiencePlan keys (heroKey, proofKey, ctaKey)
 *   Output: HomepageExperience { hero, proof, cta }
 *
 *   Run as parallel CMS fetches (Promise.all):
 *     • cmsProvider.getHeroVariant(heroKey)
 *     • cmsProvider.getProofVariant(proofKey)
 *     • cmsProvider.getCTAVariant(ctaKey)
 *
 *   Cache layers (innermost → outermost):
 *     1. In-process CMS cache (cms-cache, 5 min TTL, keyed by tenantId:type:key)
 *        → CachedCMSProvider decorator, no external call on hit
 *     2. Next.js fetch cache / ISR (stale-while-revalidate, "sanity" tag)
 *        → purged by POST /api/revalidate on CMS content change
 *
 *   Fallback cascade on any null variant (all-or-nothing):
 *     Tier 1: CMS fallback keys from page.contextConfig (tenant-specific)
 *     Tier 2: Hardcoded FALLBACK_PLAN (hero_direct_brand / proof_platform / cta_meeting)
 *     Tier 3: STATIC_EMERGENCY_EXPERIENCE (fully in-code, no CMS required)
 *
 * ─── Phase 5 — Render + analytics ─────────────────────────────────────────────
 *
 *   Input:  HomepageExperience, PageConfig, filteredSections, tenant theme
 *   Output: React server component tree (HTML response)
 *
 *   Critical path:
 *     • buildHomepagePageConfig()  → PageConfig + ContextSlotData
 *     • <TemplateRenderer />       → before-content slots → content blocks → after-content slots
 *
 *   Non-blocking (fire-and-forget, after render starts):
 *     • upsertSession()            → ensures sessions row exists (FK safety)
 *     • logServedVariants()        → writes served_variants row for analytics
 *
 *   These are awaited only when analytics is enabled (isFeatureEnabled(tenant, "analytics")).
 *   When analytics is disabled, neither function runs — the render path is unchanged.
 *
 * ─── What runs request-time vs session-time ───────────────────────────────────
 *
 *   Request-time (every render):
 *     - Phase 0 signal extraction (sync)
 *     - Phase 1 DB reads (tenant, history, rules)
 *     - Phase 3 decision engine (with decision-cache check)
 *     - Phase 4 CMS resolution (with in-process cache check)
 *     - Phase 5 render
 *
 *   Session-time (first render of a new session, or cache miss):
 *     - Phase 2 enrichment pipeline (provider-level caches may still save API calls)
 *
 *   After the first render, Phase 2 typically resolves from the session-enrichment-cache
 *   (4 h TTL) — no external API calls on subsequent page views in the same session.
 *
 * ─── What is non-blocking ─────────────────────────────────────────────────────
 *
 *   - fetchVisitorHistory()     started before enrichment/decision, awaited just before context build
 *   - homePagePromise           started before enrichment/decision, awaited after composeExperience
 *   - logServedVariants()       fire-and-forget after render
 *   - Shadow AI plan            runs in parallel via ShadowAiDecisionProvider (never on critical path)
 *
 * ─── Slot resolution ──────────────────────────────────────────────────────────
 *
 *   Slots are resolved by the decision engine (Phase 3) and fulfilled by the CMS
 *   (Phase 4).  The flow for each slot:
 *
 *     1. Decision engine produces a variant key  (e.g. "hero_google_problem")
 *     2. CMS provider fetches the variant block  (cached; may use ISR or in-process)
 *     3. If null:  fallback cascade (Tier 1 → 2 → 3)
 *     4. Assembled into HomepageExperience.hero | .proof | .cta
 *     5. Passed to buildHomepagePageConfig() → ContextSlotData
 *     6. Rendered by TemplateRenderer as a context slot (before/after content)
 *
 *   The slot types are: hero (before), proof (before), cta (after).
 *   Content blocks (CMS sections) are not slot-resolved — they render in CMS order.
 *
 * ─── How debug represents the flow ───────────────────────────────────────────
 *
 *   The dev diagnostics section in page.tsx (gated to non-production) exposes:
 *
 *   ContextDebugPanel:
 *     • Full context snapshot with all registry variables grouped by source
 *     • Shows which fields came from: request-time / session-cache / pipeline stage
 *     • buildFullContextSnapshot() is called with enrichmentTrace from Phase 2
 *
 *   EnrichmentDebugPanel:
 *     • Per-stage trace with durationMs, output fields, cacheSource, wave number
 *     • enrichmentSource: "session-cache" | "pipeline" (shows whether Phase 2 ran)
 *     • GA4 History stage status: not-configured / ran-with-data / skipped / error
 *     • Rules debug info: rulesEnabled, disabledRuleIds from RulesDecisionProvider
 *     • AI decision metadata from AiDecisionProvider.lastDecisionMeta
 *
 *   The `wave` field on StageTrace entries lets the debug overlay group concurrent
 *   stages visually and show which API calls happened in parallel.
 */

// ── Phase types ───────────────────────────────────────────────────────────────

/**
 * Describes the cache behaviour at each pipeline phase.
 *
 * Returned by `describePipeline()` for observability tools and tests that need
 * to verify the full cache stack without rendering a page.
 */
export interface PhaseDescriptor {
  /** Human-readable phase name. */
  name: string;
  /**
   * Whether this phase is on the render critical path.
   * `false` means the phase result is awaited before HTML is emitted.
   * `true`  means the phase is fire-and-forget or runs in a background wave.
   */
  nonBlocking: boolean;
  /**
   * Which cache layer(s) are consulted, innermost → outermost.
   * Empty array means no caching at this phase.
   */
  cacheLayers: CacheLayerDescriptor[];
}

export interface CacheLayerDescriptor {
  /** Layer name, e.g. "session-enrichment-cache", "cms-cache", "decision-cache". */
  name: string;
  /** TTL in milliseconds. Absent for layers with external TTL (e.g. ISR). */
  ttlMs?: number;
  /** Human-readable scope of the cache key. */
  keyScope: string;
}

// ── Canonical phase list ──────────────────────────────────────────────────────

/**
 * Returns the canonical ordered phase descriptors for the homepage pipeline.
 *
 * This is a pure data function — no I/O, no side effects.  Use it in tests
 * and observability tooling to verify the full pipeline structure.
 */
export function describePipeline(): PhaseDescriptor[] {
  return [
    {
      name:        "Phase 0 — Signal extraction",
      nonBlocking: false,
      cacheLayers: [],  // request-time only — no cache
    },
    {
      name:        "Phase 1 — Session + tenant",
      nonBlocking: false,
      cacheLayers: [
        {
          name:     "tenant-registry",
          keyScope: "hostname",
          // In-process module-level map; no TTL (static config)
        },
      ],
    },
    {
      name:        "Phase 2 — Enrichment pipeline",
      nonBlocking: false,
      cacheLayers: [
        {
          name:     "session-enrichment-cache",
          ttlMs:    4 * 60 * 60 * 1_000,   // 4 hours
          keyScope: "sessionId",
        },
        {
          name:     "provider-cache (per enricher)",
          keyScope: "IP address or lat/lng or domain or country+year",
          // TTL is provider-specific: 1 h (IPinfo/Leadinfo), 2 h (HubSpot),
          // 6 h (ReverseGeocode), 24 h (Nager.Date)
        },
      ],
    },
    {
      name:        "Phase 3 — Decision engine",
      nonBlocking: false,
      cacheLayers: [
        {
          name:     "decision-cache",
          ttlMs:    30 * 60 * 1_000,   // 30 minutes
          keyScope: "sessionId + contextHash",
        },
      ],
    },
    {
      name:        "Phase 4 — CMS resolution",
      nonBlocking: false,
      cacheLayers: [
        {
          name:     "cms-cache (in-process)",
          ttlMs:    5 * 60 * 1_000,   // 5 minutes
          keyScope: "tenantId:contentType:variantKey",
        },
        {
          name:     "Next.js ISR / fetch cache",
          keyScope: '"sanity" revalidation tag',
          // No fixed ttlMs — controlled by revalidateTag("sanity") webhook
        },
      ],
    },
    {
      name:        "Phase 5 — Render + analytics",
      nonBlocking: false,
      cacheLayers: [],  // render is always fresh; analytics is fire-and-forget
    },
  ];
}

// ── Runtime flow order (string form, for logs / debug) ────────────────────────

/**
 * Human-readable ordered summary of the homepage request pipeline.
 * Suitable for structured logging, debug overlays, and trace headers.
 */
export const PIPELINE_FLOW: readonly string[] = [
  "0: signal-extraction          [sync, no I/O]",
  "1a: history-fetch             [non-blocking, DB]",
  "1b: tenant-config             [fast, registry]",
  "1c: tenant-settings+rules     [parallel DB]",
  "2: enrichment-pipeline        [wave-parallel, session-cache → provider-caches → live API]",
  "  2.0: ip-classification      [sync, no I/O]",
  "  2.1: wave-1                 [MaxMind + IPinfo + GA4 — Promise.all]",
  "  2.2: cloud-detection        [sync, reads wave-1 output]",
  "  2.3: wave-2                 [ReverseGeocode + Weather + OpenKvK + Leadinfo — Promise.all]",
  "  2.4: hubspot-crm            [sequential, reads wave-2 companyDomain]",
  "  2.5: seasonal-event         [sequential, reads countryCode]",
  "3: decision-engine            [decision-cache → rules → experiments → AI]",
  "4: cms-resolution             [cms-cache → ISR → live CMS, parallel per slot]",
  "5: render                     [sync, React server component]",
  "5a: analytics (non-blocking)  [upsertSession + logServedVariants]",
] as const;
