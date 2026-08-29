/**
 * Decision Context Builder
 *
 * Centralises the construction of a fully-populated decision context so that
 * every call site — page routes, API handlers, edge middleware — produces an
 * identical, complete input to the rules engine and AI providers.
 *
 * ─── Why this module exists ──────────────────────────────────────────────────
 *
 *   Previously, page.tsx built the decision input inline through three
 *   independent steps:
 *
 *     const context = detectVisitorContext(request);
 *     const history = await fetchVisitorHistory(sessionId);
 *     const input   = buildDecisionInput(context, history);
 *
 *   This worked for a single page but would be duplicated verbatim in every
 *   future route or handler that needs decision context.  It also gave no
 *   single place to verify completeness, add logging, or attach page-level
 *   metadata (pathname, tenantId, templateKey, pageType).
 *
 *   `buildDecisionContext` is that single place.
 *
 * ─── What it returns ─────────────────────────────────────────────────────────
 *
 *   A `RuleEvaluationContext`, which extends `DecisionInput` with optional
 *   page-level fields.  Because `RuleEvaluationContext` satisfies `DecisionInput`,
 *   it can be passed to every decision provider unchanged.  The rules engine
 *   additionally reads the optional page-level fields when present.
 *
 * ─── Client vs server ────────────────────────────────────────────────────────
 *
 *   This module is server-side only.  It reads from the Web API `Request`
 *   object (headers, URL) and from the pre-fetched `VisitorHistory`.
 *
 *   Fields that are only available client-side (e.g. localStorage-based
 *   pageViewCount fallback) are populated from `history` here; if `history`
 *   came from `emptyHistory()` (DB miss / first visit), those fields are
 *   safe zero-values.  Client-side enhancement can be layered on top via
 *   the `PageTracker` component without touching this module.
 *
 * ─── Helpers ─────────────────────────────────────────────────────────────────
 *
 *   The helpers below are thin, pure, independently testable functions.
 *   Most delegate to existing context-layer utilities (detectVisitorContext,
 *   parseReferrer, detectDevice) so there is no logic duplication.
 */

import { detectVisitorContext } from "@/context";
import { parseReferrer, detectDevice } from "@/context/helpers";
import { emptyHistory } from "@/context/visitor-history";
import type { VisitorHistory } from "@/context/visitor-history";
import type { TrafficSource, DeviceType } from "@/context/types";
import { buildTimeContext } from "@/context/time";
import type { SeasonalEvent } from "@/context/time";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { computeDerivedContext } from "@/context/derived-context";
import { listActiveInterestProfiles } from "@/interest-profiles/repository";
import { scoreInterests, buildInterestContextVars } from "@/interest-profiles/scoring";
import {
  parseUA,
  parseClientContextCookie,
  CLIENT_CONTEXT_COOKIE,
  TIMEZONE_COOKIE,
} from "@/context/client-context";
import type { ClientContext } from "@/context/client-context";
import {
  parseLeadinfoCookie,
  leadinfoToEnrichment,
  LEADINFO_COOKIE,
} from "@/context/leadinfo-context";
import { FORM_LOCATION_COOKIE, parseFormLocationCookie } from "@/context/form-location-context";
import { logger } from "@/lib/logger";
import { extractIpFromRequest } from "@/lib/request-ip";
import { runEnrichmentPipeline, buildEnricherInput } from "@/enrichment/pipeline";
import { runStagedPipeline }  from "@/enrichment/staged-pipeline";
import {
  getSessionEnrichment,
  setSessionEnrichment,
} from "@/enrichment/session-enrichment-cache";
import {
  isDemoMode,
  runDemoBilling,
  logDemoModeActive,
  logDemoBillingResult,
  logCacheHitBillingSkipped,
  logPipelineBillingFired,
} from "@/billing/demo-billing";
import type { LabeledEnricher, StagedEnricher, StagedPipelineResult, EnrichmentOutput, EnrichmentTrace } from "@/enrichment/types";
import {
  createHeadersGeoEnricher,
  createIpApiGeoEnricher,
  createMaxMindGeoEnricher,
  isLocalIp,
} from "@/enrichment/providers/geo";
import { createCrmEnricher, StubCrmProvider } from "@/enrichment/providers/crm";
import type { CrmProvider } from "@/enrichment/providers/crm";
import { createCompanyEnricher, StubCompanyProvider } from "@/enrichment/providers/company";
import type { CompanyProvider } from "@/enrichment/providers/company";
import { normalizeCrmProfile, mergeCrmWithBehavior } from "@/lib/crm";
import { detectIsBot } from "./detect-bot";

// ── Params ─────────────────────────────────────────────────────────────────────

/**
 * Parameters accepted by `buildDecisionContext`.
 *
 * Only `request` is required; everything else enhances the context when
 * available.  Optional history and page-level fields degrade gracefully
 * to safe defaults so the decision engine never receives an incomplete input.
 */
export interface BuildDecisionContextParams {
  /**
   * The incoming HTTP request.
   * Used to extract headers (User-Agent, Referer), cookies (mc_seen),
   * and URL query parameters (UTM, pathname).
   *
   * Accepts any standard Web API `Request` — from a Next.js Route Handler,
   * Middleware, or a unit test.
   */
  request: Request;

  /**
   * Explicit Cookie header value for the cookie-derived signals (mc_li company
   * enrichment, mc_cc client context, mc_tz timezone).
   *
   * `Cookie` is a forbidden header name, so it is silently stripped when a
   * synthetic `new Request(..., { headers: { cookie } })` is built in the server
   * runtime (undici). Call sites that construct a synthetic Request (the RSC
   * homepage pipeline, cms-page-decision) must pass the real header here.
   * Falls back to `request.headers.get("cookie")` when omitted, so callers that
   * pass the genuine incoming Request (e.g. the snippet decide route) are unaffected.
   */
  cookieHeader?: string | null;

  /**
   * Pre-fetched visitor history for this session.
   *
   * Call `fetchVisitorHistory(sessionId)` before `buildDecisionContext` and
   * pass the resolved value here.  Defaults to `emptyHistory()` — safe zero
   * values for all behavior fields — when omitted or on DB error.
   *
   * History fields surfaced in the context:
   *   pageViewCount   — prior page loads in this session
   *   ctaClickCount   — CTA clicks in this session
   *   hasClickedCta   — derived boolean
   *   lastHeroKey     — most recently served hero variant
   *   lastCtaKey      — most recently served CTA variant
   *   firstSeenAt     — first event timestamp for this session
   *   fromDatabase    — whether the data came from DB (vs safe defaults)
   */
  history?: VisitorHistory;

  /**
   * Active tenant identifier.
   * Written into context so tenant-aware rules can match on `tenantId`.
   */
  tenantId?: string | null;

  /**
   * Page template key, e.g. `"homepage"` or `"standard-landing"`.
   * Used by rules that target specific page templates.
   */
  templateKey?: string | null;

  /**
   * Semantic page type, e.g. `"homepage"`, `"landing"`, `"article"`.
   * Used by rules that target broad page categories.
   */
  pageType?: string | null;

  /**
   * Visitor's email address for CRM identity resolution.
   *
   * Pass this when the email is known from a prior form submission in the
   * session (e.g. retrieved from the `sessions` table or a first-party
   * identity store).  Defaults to `null` — the CRM enricher gracefully
   * returns `crmMatched: false` when no email is available.
   */
  email?: string | null;

  /**
   * CRM provider implementation for contact matching.
   *
   * Defaults to `StubCrmProvider` (always returns `crmMatched: false`).
   * Swap in a `MockCrmProvider` for integration tests, or a real
   * HubSpot / Salesforce adapter in production.
   *
   * @example
   * // Dev testing with fixture data:
   * import { MockCrmProvider } from "@/enrichment/providers/crm";
   * const crmProvider = new MockCrmProvider({
   *   "alice@acme.com": { crmLifecycleStage: "mql", crmSegment: "enterprise" },
   * });
   * const input = await buildDecisionContext({ request, crmProvider });
   */
  crmProvider?: CrmProvider;

  /**
   * Company identification provider for reverse-IP firmographic lookup.
   *
   * Defaults to `StubCompanyProvider` (returns no match, all fields null).
   * Pass a `MockCompanyProvider` for dev fixtures, or a real Clearbit /
   * 6sense adapter in production.
   *
   * @example
   * import { MockCompanyProvider } from "@/enrichment/providers/company";
   * const companyProvider = new MockCompanyProvider({
   *   "*": { companyName: "Acme Corp", companyIndustry: "Software", companySize: "51-200" },
   * });
   * const input = await buildDecisionContext({ request, companyProvider });
   */
  companyProvider?: CompanyProvider;

  /**
   * Pre-built sequential IP → Company → HubSpot enricher.
   *
   * When provided, this replaces the separate `companyProvider` +
   * `crmProvider` pair in the enrichment pipeline.  Use this when you need
   * the HubSpot domain search to run immediately after the reverse-IP lookup
   * (Stage 2 depends on Stage 1's resolved domain, so they cannot run in
   * parallel).
   *
   * Construct with `createIpCompanyHubSpotEnricher` from `@/enrichment`:
   *
   * @example
   * import { ClearbitCompanyProvider, createIpCompanyHubSpotEnricher } from "@/enrichment";
   *
   * const ipCompanyCrmEnricher = createIpCompanyHubSpotEnricher({
   *   companyProvider:    new ClearbitCompanyProvider({ secretKey: env.CLEARBIT_SECRET_KEY }),
   *   hubspotAccessToken: env.HUBSPOT_ACCESS_TOKEN,
   *   isDev:              process.env.NODE_ENV === "development",
   * });
   * const ctx = await buildDecisionContext({ request, ipCompanyCrmEnricher });
   *
   * When absent, `companyProvider` and `crmProvider` are used individually.
   */
  ipCompanyCrmEnricher?: LabeledEnricher;

  /**
   * Sequential staged enrichment chain.
   *
   * When provided, the staged pipeline replaces the parallel
   * `ipCompanyCrmEnricher` / `companyProvider` + `crmProvider` approach.
   * Each stage in the array receives the accumulated output of all prior
   * stages, enabling context-aware branching (e.g. OpenKvK only for NL).
   *
   * Construct with `buildCompanyCrmChain` from
   * `@/enrichment/providers/staged-company-crm-chain`.
   *
   * When both `stagedEnrichers` and `ipCompanyCrmEnricher` are provided,
   * `stagedEnrichers` takes precedence.
   *
   * When absent, the function falls back to the individual
   * `companyProvider` + `crmProvider` approach for backward compatibility.
   */
  stagedEnrichers?: StagedEnricher[];

  /**
   * Pre-known enrichment fields to seed the staged pipeline with (as
   * `initialAccumulated`). Used to reuse a recognised visitor's stable
   * firmographics (company name / domain / industry / size) so the
   * company-identification stages can skip via their `shouldRun` gate. Volatile
   * stages (geo, weather) still run. Merged on top of the CDN-header geo pre-pass.
   */
  seedEnrichment?: Partial<EnrichmentOutput>;

  /**
   * When true, on a session-enrichment cache MISS the current render uses only
   * the FAST partial enrichment (`{ ...headerGeoResult, ...seedEnrichment }`)
   * and the full staged pipeline is run in the BACKGROUND to warm the session
   * cache for the next request — keeping the slow enrichment off the critical
   * render path (improves hero LCP).
   *
   * Only takes effect when a real `sessionId` is present.  Default false: the
   * blocking pipeline runs inline exactly as before.  Opted into by the
   * homepage pipeline only; the cms-page pipeline keeps the blocking behaviour.
   */
  deferSlowEnrichmentOnMiss?: boolean;

  /**
   * Optional scheduler for fire-and-forget background work (the stale-refresh
   * and deferred-enrichment cache-warm + billing runs). Request-scoped callers
   * (the homepage pipeline) pass `after` from next/server so the background
   * pipeline run reliably completes after the response flushes on serverless.
   * Defaults to a bare microtask for non-request callers (tests, cms-page).
   */
  scheduleBackgroundWork?: (fn: () => void | Promise<void>) => void;

  /**
   * IANA timezone string for the active tenant, e.g. "Europe/Amsterdam".
   *
   * Used to derive time-based context variables (currentHour, dayOfWeek,
   * isWeekend, month, dateKey, timeOfDay, seasonalEvent) in the tenant's
   * local time rather than raw UTC.
   *
   * Obtain from `TenantSettings.timezone`.  Defaults to "UTC" when absent
   * or null.  An invalid timezone string silently falls back to UTC.
   */
  timezone?: string | null;

  /**
   * Session ID from the `mc_session_id` cookie.
   *
   * When provided, `buildDecisionContext` checks the in-process session
   * enrichment cache before running the staged pipeline.  On a cache hit
   * (same IP, same tenant, TTL not expired) the full pipeline is skipped
   * and the cached enrichment output is returned immediately, saving up
   * to 4–6 external API calls per page view.
   *
   * On a cache miss the pipeline runs normally and the result is stored
   * for subsequent page views in the same session.
   *
   * When absent, the session cache is bypassed and the pipeline always runs.
   */
  sessionId?: string | null;

  /**
   * Optional Supabase service-role client for enrichment usage tracking.
   *
   * When provided, `buildDecisionContext` automatically tracks usage events
   * and deducts credits for every billable live enrichment API call that the
   * staged pipeline makes.  Provider-cache hits and skipped stages are never
   * billed.  Session-cache hits (whole pipeline skipped) are also never billed.
   *
   * Tracking is always fire-and-forget — it never blocks the response.
   * Omit or pass null to disable billing tracking (e.g. in dev/preview or
   * when billing tables are not yet migrated).
   */
  billingClient?: import("@supabase/supabase-js").SupabaseClient | null;

  // ── IP Override (PARTS 3–5) ─────────────────────────────────────────────────

  /**
   * Operator-provided IP address to use instead of the real visitor IP.
   *
   * Only honoured when `ipOverrideEnabled` is true AND the environment
   * allows it (NODE_ENV === "development" OR ENABLE_DEBUG_IP_OVERRIDE === "true").
   * Never active in production without an explicit opt-in env var.
   *
   * Pass this from a debug session cookie / query param set by the operator
   * in the dashboard debug panel.
   */
  ipOverride?: string | null;

  /**
   * Whether the IP override is toggled on by the operator.
   *
   * Defaults to false.  Combined with the environment safety gate:
   * `(isDev || ENABLE_DEBUG_IP_OVERRIDE === "true") && ipOverrideEnabled && ipOverride`.
   */
  ipOverrideEnabled?: boolean;

  /**
   * Debug info callback — called with enrichment provenance and IP details
   * before `buildDecisionContext` returns.
   *
   * Use this to capture debug state in the calling page without changing
   * the return type of `buildDecisionContext`.
   *
   * @example
   * let debugInfo: EnrichmentDebugInfo | null = null;
   * const input = await buildDecisionContext({
   *   request,
   *   onDebugInfo: (info) => { debugInfo = info; },
   * });
   */
  onDebugInfo?: (info: EnrichmentDebugInfo) => void;

  /**
   * Per-request domain attributes supplied by the page (snippet payload or
   * platform page props), set on `ctx.customAttributes` for AttributeConditions.
   * Callers must sanitise and filter this against the tenant declaration first
   * (see sanitizeCustomAttributes); this builder stores it verbatim.
   */
  customAttributes?: Record<string, string | number | boolean> | null;
}

// ── EnrichmentDebugInfo ────────────────────────────────────────────────────────

/**
 * Debug metadata emitted by `buildDecisionContext` via the `onDebugInfo`
 * callback.  Used by the diagnostics panel to show enrichment provenance,
 * IP details, and session-cache status.
 */
export interface EnrichmentDebugInfo {
  /** The real visitor IP extracted from request headers. */
  realIp:          string | null;
  /**
   * The IP actually used for geo/network lookups.
   * Equals `realIp` unless an IP override is active.
   */
  effectiveIp:     string | null;
  /** True when an operator-provided IP override is currently in effect. */
  ipOverrideActive: boolean;

  // ── Location source resolution ────────────────────────────────────────────
  /**
   * Normalized current city — GA4 city preferred, IP geo city as fallback.
   * Null when neither source produced a value.
   */
  currentCity:           string | null;
  /** Normalized current region — GA4 preferred, IP geo as fallback. */
  currentRegion:         string | null;
  /**
   * Normalized current country — GA4 human-readable name preferred,
   * ISO 2-letter code from IP geo as fallback.
   */
  currentCountry:        string | null;
  /** Which source populated the current* fields: "ga4" | "ip_geo" | null. */
  currentLocationSource: "ga4" | "ip_geo" | null;
  /**
   * Whether IP-based geo resolved coordinates (latitude + longitude).
   * True even when GA4 was used as the current location source — IP geo
   * always runs independently for coordinates, network, and company signals.
   */
  ipGeoHasCoordinates:   boolean;

  /**
   * How the enrichment output was produced:
   *   "session-cache"   — cached result from a prior page view
   *   "pipeline-fresh"  — staged pipeline ran end-to-end
   *   "headers-only"    — only CDN header geo was available (no pipeline)
   */
  enrichmentSource: "session-cache" | "pipeline-fresh" | "headers-only";
  /** Why the session cache was not used (null on cache hit or no sessionId). */
  sessionCacheMissReason: string | null;
  /** Field-level provenance — which stage produced each enrichment field. */
  enrichmentTrace: EnrichmentTrace;
  /** Per-stage timing and output from the staged pipeline (empty on cache hit). */
  stageTrace: import("@/enrichment/types").StageTrace[];

  // ── Time context provenance ────────────────────────────────────────────────

  /**
   * Which source provided the timezone used to compute time-based context
   * variables (currentHour, timeOfDay, dayOfWeek, isWeekend, dateKey, month).
   *
   *   "client"       — visitor's own IANA timezone, from the mc_tz or mc_cc
   *                    cookie.  Most accurate; available after the first page load.
   *   "tenant"       — organisation-wide timezone from TenantSettings.timezone.
   *                    Approximate for multi-region audiences.
   *   "utc-fallback" — UTC; used only when neither client nor tenant timezone is
   *                    available (very first request from a brand-new visitor).
   */
  timeZoneSource: "client" | "tenant" | "utc-fallback";

  /**
   * True when the timezone is NOT from the visitor's own browser.
   *
   * When true, time-based rules (currentHour, timeOfDay, isWeekend) may
   * produce incorrect results — the offset between the effective timezone
   * and the visitor's actual local time causes wrong bucket assignments.
   */
  timeZoneApproximate: boolean;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Build a fully-populated `RuleEvaluationContext` (a superset of `DecisionInput`)
 * ready to pass to any decision provider.
 *
 * Calling this function is the only supported way to construct decision context
 * in the application.  Never build `DecisionInput` or `RuleEvaluationContext`
 * inline.
 *
 * Guarantees:
 *   - All required fields are always present (never undefined/null unexpectedly)
 *   - Never throws — all I/O-free, all fallbacks applied internally
 *   - Safe to call on every request (pure transformation, no side effects)
 *   - Emits a `logger.debug` entry for tracing (suppressed in production)
 *
 * @example
 * // In a Next.js App Router page:
 * const history = await fetchVisitorHistory(sessionId);   // kick off early
 * const input   = buildDecisionContext({
 *   request,
 *   history,
 *   tenantId:    tenantConfig.tenantId,
 *   templateKey: "homepage",
 *   pageType:    "homepage",
 * });
 * const plan = await decisionProvider.getHomepagePlan(input);
 */
export async function buildDecisionContext(
  params: BuildDecisionContextParams,
): Promise<RuleEvaluationContext> {
  const {
    request,
    cookieHeader: cookieHeaderParam = null,
    history     = emptyHistory(),
    tenantId    = null,
    templateKey = null,
    pageType    = null,
    email               = null,
    crmProvider         = new StubCrmProvider(),
    companyProvider     = new StubCompanyProvider(),
    ipCompanyCrmEnricher,
    stagedEnrichers,
    seedEnrichment,
    customAttributes = null,
    deferSlowEnrichmentOnMiss = false,
    scheduleBackgroundWork,
    timezone            = null,
    sessionId           = null,
    ipOverride          = null,
    ipOverrideEnabled   = false,
    billingClient       = null,
    onDebugInfo,
  } = params;

  // ── A. Traffic / acquisition + B. Device / session ─────────────────────────
  //
  // detectVisitorContext handles:
  //   source, device, visitType, utmSource, utmMedium, utmCampaign,
  //   utmContent, utmTerm, referrerDomain, rawReferrer, userAgent
  //
  // Extracted once from the request; we reuse rather than duplicate.
  const visitorContext = detectVisitorContext(request);

  // ── F. Client / device context ───────────────────────────────────────────────
  //
  // Server-derived fields (deviceType, osName, osVersion, browserName,
  // browserVersion, engineName) are parsed from the User-Agent on every request.
  //
  // Client-derived fields (isTouchDevice, viewportWidth, viewportHeight,
  // pixelRatio, preferredColorScheme, preferredLanguage, timeZone) are read
  // from the mc_cc cookie, set by ClientContextCollector on the first page load.
  // They are null on the very first request and populated on all subsequent ones.
  //
  // The merged object is attached to the context as `clientContext` so that
  // rule resolvers and AI context extraction can access all 13 fields uniformly.
  const uaParsed  = parseUA(visitorContext.userAgent);
  // Prefer the explicit cookieHeader param — `Cookie` is a forbidden header and is
  // stripped from a synthetic Request, so request.headers.get("cookie") is empty on
  // the RSC pipeline paths. Fall back to the request header for genuine-Request callers.
  const cookieHeader = cookieHeaderParam ?? request.headers.get("cookie");
  const cookieVal = cookieHeader
    ? parseCookieField(cookieHeader, CLIENT_CONTEXT_COOKIE)
    : null;
  const clientSignals = parseClientContextCookie(cookieVal);
  const clientContext: ClientContext = { ...uaParsed, ...clientSignals };

  // ── E. Time context ─────────────────────────────────────────────────────────
  //
  // Timezone resolution — three tiers, first non-null wins:
  //
  //   1. Visitor's own timezone (most accurate)
  //        mc_tz  — non-httpOnly cookie set synchronously by ClientContextCollector
  //                 on the first page load.  Available from the second server
  //                 render onward (immediately after first hydration).
  //        mc_cc  — httpOnly cookie.tz set after the async POST to
  //                 /api/client-context; a fallback for mc_tz in the rare case
  //                 where document.cookie is blocked.
  //
  //   2. Tenant IANA timezone (TenantSettings.timezone)
  //        Organisation-wide approximation — accurate for single-region tenants,
  //        wrong for global audiences.  Marked as "tenant" source.
  //
  //   3. "UTC" (absolute last resort)
  //        Only reached on the very first server render for a brand-new visitor
  //        before any client signal has been stored.  Marked as "utc-fallback"
  //        so the diagnostic panel can surface it.
  //
  // mc_tz is URL-encoded in the browser (encodeURIComponent).  parseCookieField
  // returns the raw encoded value; decodeURIComponent recovers the IANA string.

  const rawMcTz      = cookieHeader ? parseCookieField(cookieHeader, TIMEZONE_COOKIE) : null;
  const mcTz         = rawMcTz
    ? (decodeURIComponent(rawMcTz).trim().slice(0, 64) || null)
    : null;
  const userTimezone = mcTz ?? clientSignals.timeZone ?? null;

  const effectiveTimezone   = userTimezone ?? timezone ?? "UTC";
  const timeZoneSource: "client" | "tenant" | "utc-fallback" =
    userTimezone ? "client"       :
    timezone     ? "tenant"       :
    "utc-fallback";
  // Approximate when not from the visitor's own browser.  Rules that depend on
  // currentHour / timeOfDay / isWeekend may fire on a slightly wrong bucket
  // (the offset between UTC or tenant time and the visitor's actual local time).
  const timeZoneApproximate = timeZoneSource !== "client";

  const timeCtx = buildTimeContext(new Date(), effectiveTimezone);

  // Pathname — extracted separately (not part of VisitorContext today).
  const pathname = getPathnameFromRequest(request);

  // ── Rule-context overlay (regels die context schrijven, §4/§6) ──────────────
  //
  // Sticky context written by earlier rules, loaded from the persisted journey
  // state. Laid over the derived context so FlagConditions and field overrides
  // read it (via resolveFieldValue). Null when the visitor has none yet.
  const ruleContext = history.journey?.ruleContext ?? null;

  // entryPath — the session's landing page. Read the sticky value persisted on
  // the first view (rule_context.__entryPath); on the first view none exists yet
  // so it falls back to the current pathname. The engine persists __entryPath
  // after the response (see the 2-phase evaluation).
  const persistedEntryPath = ruleContext?.__entryPath;
  const entryPath =
    (typeof persistedEntryPath === "string" ? persistedEntryPath : null) ??
    pathname ??
    null;

  // ── C. Behavior / history (from VisitorHistory) ─────────────────────────────
  //
  // pageViewCount, ctaClickCount, hasClickedCta, lastHeroKey, lastCtaKey,
  // firstSeenAt, fromDatabase — all carried in `history`.
  //
  // On the server there is no localStorage; `emptyHistory()` provides safe
  // zero-values for first-visit / DB-miss scenarios.  When the DB responds
  // successfully, `history.fromDatabase === true` and all counts are real.
  // Client-side enhancement (PageTracker) can update counts asynchronously.
  const pageViewCount  = getPageViewCount(history);
  const ctaClickCount  = getCtaClickCount(history);
  const hasClickedCta  = getHasClickedCta(history);

  // ── D. Enrichment pipeline (geo + CRM) ───────────────────────────────────────
  //
  // All enrichers run concurrently via Promise.allSettled.
  // runEnrichmentPipeline ALWAYS resolves — failures and timeouts produce {}
  // for that enricher, so rendering is never blocked.
  //
  // Geo     — reads Vercel/Cloudflare CDN headers; zero I/O, < 1 ms in practice.
  //
  // Company — reverse-IP firmographic lookup.  Defaults to StubCompanyProvider
  //           (no match) when no real provider is connected.  Pass a
  //           MockCompanyProvider for dev fixtures (including a "*" wildcard)
  //           or a live Clearbit / 6sense adapter in production.
  //           All providers pass through normalizeCompanyOutput, which ensures
  //           companyMatchConfidence is 0 (not null) when a match exists but
  //           the provider omitted a score.
  //
  // CRM     — matches the visitor to a CRM contact via email (when present).
  //           Defaults to StubCrmProvider (crmMatched: false) when no real CRM
  //           is connected.  Pass MockCrmProvider for dev fixtures or a live
  //           HubSpot / Salesforce adapter in production.
  //
  // All enrichers run concurrently. runEnrichmentPipeline ALWAYS resolves —
  // failures and timeouts produce {} for that enricher; rendering is never blocked.
  const ip = extractIpFromRequest(request);

  const isDev = process.env.NODE_ENV === "development";

  // ── IP Override safety gate (PART 5) ────────────────────────────────────────
  //
  // The override is only honoured in development or when the
  // ENABLE_DEBUG_IP_OVERRIDE env var is explicitly set to "true".
  // This prevents operators from accidentally exposing override controls in
  // production deployments that don't need them.
  const overrideAllowed =
    isDev || process.env.ENABLE_DEBUG_IP_OVERRIDE === "true";

  const ipOverrideActive =
    overrideAllowed && ipOverrideEnabled && Boolean(ipOverride);

  const effectiveIp = ipOverrideActive ? (ipOverride as string) : ip;

  if (isDev) {
    logger.debug("[decision-context] resolved IP", {
      realIp:          ip,
      effectiveIp,
      ipOverrideActive,
      isLocal:         isLocalIp(ip),
      devFallbackIp: isLocalIp(ip)
        ? (process.env.DEV_GEO_FALLBACK_IP?.trim() || "8.8.8.8")
        : null,
    });
  }

  // First-party form-provided location (mc_loc cookie) — takes precedence over
  // IP-derived lat/lng in the CBS location enricher. Consumed only under
  // enrichment consent (the staged enrichers only run when consent is granted).
  const formLocation = cookieHeader
    ? parseFormLocationCookie(parseCookieField(cookieHeader, FORM_LOCATION_COOKIE))
    : null;

  const enricherInput = buildEnricherInput({
    ip,
    tenantId,
    sessionId: null,
    email,
    // Forward the stable session UUID as the GA4 visitor ID.
    // The same UUID is sent by Ga4TrackingProvider as `user_properties.{visitorIdParamName}`
    // on every client-side gtag event, so the GA4 Data API can filter sessions
    // by `customUser:{visitorIdParamName}` == sessionId.
    visitorId: sessionId,
    formLocation,
  });

  // Attach effectiveIp so IP-based enrichers can use the override when active.
  enricherInput.effectiveIp = effectiveIp;

  // ── Geo enricher selection ─────────────────────────────────────────────────
  //
  // Step 0: CDN header geo enricher (always runs, zero-cost, zero I/O).
  //   Reads x-vercel-ip-country / cf-ipcountry headers injected by the CDN.
  //   Results are used as the `initialAccumulated` seed for the staged pipeline.
  //
  // Step 1 onward: staged pipeline (sequential, context-aware).
  //   When `stagedEnrichers` is provided, the pipeline handles MaxMind, IPinfo,
  //   OpenKvK, Leadinfo, and HubSpot CRM in strict order, with each stage
  //   receiving the accumulated output of all prior stages.
  //
  // Legacy fallback (no stagedEnrichers):
  //   Falls back to the parallel `runEnrichmentPipeline` using the individual
  //   `ipCompanyCrmEnricher` / `companyProvider` + `crmProvider` adapters for
  //   backward compatibility.  A dev-only ip-api.com enricher fills geo when
  //   MaxMind is not configured.
  const hasMaxMindDb = Boolean(process.env.MAXMIND_DB_PATH?.trim());

  // ── Step 0: CDN header geo (always; zero-cost) ─────────────────────────
  const headersEnricher = createHeadersGeoEnricher(request.headers);
  const headerGeoResult = await headersEnricher.enricher(enricherInput);

  let enrichment:     Partial<EnrichmentOutput>;
  let stageTrace:     import("@/enrichment/types").StageTrace[] = [];
  let enrichmentTrace: EnrichmentTrace = {};

  // ── Session enrichment cache check ────────────────────────────────────────
  //
  // Enrichment data (geo, network, company, CRM, seasonal) is stable for the
  // duration of a visitor session.  When a sessionId is provided, attempt to
  // reuse the cached result from a prior page view in this session.
  //
  // Cache miss reasons are recorded for debug logging:
  //   "no-entry"       — first page view in this session (or process restart)
  //   "ttl-expired"    — 4-hour TTL elapsed
  //   "ip-changed"     — visitor switched networks / toggled VPN
  //   "tenant-changed" — serving a different tenant than when cached
  let enrichmentSource: "session-cache" | "pipeline-fresh" | "headers-only" = "pipeline-fresh";
  let sessionCacheMissReason: string | null = null;

  // Scheduler for fire-and-forget background work (cache-warm + billing). When a
  // request-scoped caller passes `after` (homepage pipeline), the work reliably
  // completes after the response flushes on serverless; otherwise fall back to a
  // bare microtask (matches the original behaviour for tests / cms-page).
  const runInBackground: (fn: () => void | Promise<void>) => void =
    scheduleBackgroundWork ?? ((fn) => { void Promise.resolve().then(fn); });

  if (sessionId && stagedEnrichers && stagedEnrichers.length > 0) {
    const cacheResult = getSessionEnrichment(sessionId, ip, tenantId);

    if (cacheResult.hit) {
      // ── Session cache hit — short-circuit: skip the pipeline entirely ────────
      //
      // When the entry is stale (TTL expired but within grace window), serve
      // it immediately for this render and fire a background pipeline run to
      // refresh the cache.  This avoids blocking on a full enrichment pipeline
      // just because the TTL expired while the visitor is actively browsing.
      const cachedEnrichment = cacheResult.enrichment;
      const isStale          = cacheResult.stale === true;

      if (isDev) {
        logger.debug("[decision-context] session enrichment cache hit", {
          sessionId, ip, tenantId, stale: isStale,
        });
      }

      if (isStale && sessionId) {
        // Fire-and-forget background refresh.  Errors are intentionally absorbed —
        // this is best-effort; the stale data has already been returned for this render.
        //
        // Billing is fired here so that the stale-refresh pipeline run also writes
        // usage_events and debits the wallet.  Without this, billing was silently
        // skipped for all page loads after the first TTL expiry within a session.
        const _billingClientForRefresh = billingClient;
        const _tenantIdForRefresh      = tenantId;
        const _sessionIdForRefresh     = sessionId;
        runInBackground(async () => {
          try {
            const freshResult = await runStagedPipeline(
              stagedEnrichers,
              enricherInput,
              {
                timeoutMs:          4_000,
                initialAccumulated: { ...headerGeoResult, ...seedEnrichment },
              },
            );
            setSessionEnrichment(sessionId, freshResult.output, ip, tenantId, { retry: freshResult.incomplete === true });
            if (isDev) {
              logger.debug("[decision-context] stale session cache refreshed in background", {
                sessionId,
              });
            }
            // Fire billing for the background-refresh pipeline run.
            if (_billingClientForRefresh && _tenantIdForRefresh && freshResult.trace.length > 0) {
              const { trackEnrichmentUsage } = await import("@/billing/enrichment-tracker");
              await trackEnrichmentUsage(_billingClientForRefresh, freshResult.trace, {
                tenantId:  _tenantIdForRefresh,
                sessionId: _sessionIdForRefresh,
              });
            }
          } catch (err) {
            // Absorb — never let a background refresh crash the process.
            console.error(
              `[decision-billing] stale refresh error` +
              ` | tenant=${_tenantIdForRefresh ?? "?"}` +
              ` | ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        });
      }

      const cachedSeasonalEvent =
        typeof cachedEnrichment.seasonalEvent === "string" && cachedEnrichment.seasonalEvent
          ? (cachedEnrichment.seasonalEvent as SeasonalEvent)
          : null;

      const finalSeasonalEventCached: SeasonalEvent =
        cachedSeasonalEvent ?? timeCtx.seasonalEvent;

      logger.debug("[decision-context] [session-cache]", {
        enrichmentSource:  "session-cache",
        countryCode:       cachedEnrichment.countryCode ?? null,
        companyName:       cachedEnrichment.companyName ?? null,
        seasonalEvent:     finalSeasonalEventCached,
        seasonalSource:    cachedEnrichment.seasonalSource ?? null,
        holidayName:       cachedEnrichment.holidayName    ?? null,
      });

      // Build a "hit" trace for every resolved field in the cached enrichment.
      const cachedTrace: EnrichmentTrace = {};
      for (const key of Object.keys(cachedEnrichment) as (keyof import("@/enrichment/types").EnrichmentOutput)[]) {
        const val = (cachedEnrichment as Record<string, unknown>)[key];
        if (val !== null && val !== undefined) {
          (cachedTrace as Record<string, import("@/enrichment/types").EnrichmentFieldTrace>)[key] = {
            provider:   "session-cache",
            source:     "session enrichment cache",
            cacheStatus: "hit",
            inputsUsed: [],
          };
        }
      }

      onDebugInfo?.({
        realIp:                ip,
        effectiveIp,
        ipOverrideActive,
        // Location source — read from the cached enrichment (current* fields
        // were normalized and stored when the cache entry was first created).
        currentCity:           cachedEnrichment.currentCity           ?? null,
        currentRegion:         cachedEnrichment.currentRegion         ?? null,
        currentCountry:        cachedEnrichment.currentCountry        ?? null,
        currentLocationSource: (cachedEnrichment.currentLocationSource as "ga4" | "ip_geo" | null) ?? null,
        ipGeoHasCoordinates:   (cachedEnrichment.latitude != null && cachedEnrichment.longitude != null),
        enrichmentSource:       "session-cache",
        sessionCacheMissReason: null,
        enrichmentTrace:        cachedTrace,
        stageTrace:             [],
        timeZoneSource,
        timeZoneApproximate,
      });

      // Build base cached context, then compute derived signals from it.
      const cachedBaseCtx: RuleEvaluationContext = {
        ...visitorContext,
        history: {
          ...history,
          pageViewCount,
          ctaClickCount,
          hasClickedCta,
        },
        pathname,
        tenantId,
        templateKey,
        pageType,
        enrichment: cachedEnrichment,
        ...timeCtx,
        seasonalEvent: finalSeasonalEventCached,
        clientContext,
        // CRM → behavior merged lifecycle (customer mode drives personalization).
        crmMergedState: history.journey
          ? mergeCrmWithBehavior(normalizeCrmProfile(cachedEnrichment), history.journey)
          : null,
        // Rule-context overlay + read fields (regels die context schrijven).
        ruleContext,
        entryPath,
        isBot: detectIsBot(visitorContext.userAgent, cachedEnrichment.isCloudProvider),
      };

      let cachedDerived: ReturnType<typeof computeDerivedContext>;
      try {
        cachedDerived = computeDerivedContext(cachedBaseCtx);
      } catch {
        cachedDerived = {} as ReturnType<typeof computeDerivedContext>;
      }

      // ── Demo mode: simulate billing on every request (including cache hits) ──
      //
      // In real mode the session cache intentionally skips billing — the
      // enrichment was already charged on the first request in this session.
      // This is correct behaviour.  Demo mode overrides it so developers can
      // watch credits decrease in the dashboard on every reload.
      if (isDemoMode()) {
        logDemoModeActive(tenantId, sessionId, "cache-hit");
        if (billingClient && tenantId) {
          void runDemoBilling(billingClient, tenantId, sessionId).then(
            (r) => logDemoBillingResult(r),
          ).catch(() => {/* billing failures must never crash the render */});
        }
      } else {
        // Real mode: log that billing was intentionally skipped for this reload.
        logCacheHitBillingSkipped(tenantId, sessionId);
      }

      return { ...cachedBaseCtx, derived: cachedDerived };
    }

    // Cache miss — record reason for the debug log further down
    sessionCacheMissReason = cacheResult.reason;
    if (isDev) {
      logger.debug("[decision-context] session enrichment cache miss", {
        sessionId,
        reason: cacheResult.reason,
        ip,
        tenantId,
      });
    }
  }

  if (stagedEnrichers && stagedEnrichers.length > 0) {
    // ── Wallet guard (pre-pipeline) ───────────────────────────────────────
    //
    // Check whether the tenant's wallet permits billable enrichment calls.
    // If blocked, billable stages are filtered out before the pipeline runs
    // so no external API calls are made for an empty/frozen wallet.
    //
    // The guard FAILS OPEN: if the wallet table is missing or the read fails
    // for any reason, all enrichers run as normal — billing errors must never
    // degrade the visitor experience.

    let walletGuard: import("@/billing/enrichment-guard").WalletGuardResult = {
      blocked:      false,
      balanceCents: Infinity,
    };
    let enrichersForPipeline = stagedEnrichers;

    if (billingClient && tenantId) {
      try {
        const { checkWalletForEnrichment, BILLABLE_STAGE_LABELS, recordWalletBlock } =
          await import("@/billing/enrichment-guard");

        walletGuard = await checkWalletForEnrichment(billingClient, tenantId);

        if (walletGuard.blocked) {
          // Remove billable stages — non-billable stages (header geo, MaxMind
          // local DB, cloud detection…) still run and enrich the context.
          //
          // Fallback mode controls WHICH billable stages are removed:
          //
          //   smart_lite — recognition-category stages are KEPT (geo, company).
          //                Only adaptation + brainpower stages are blocked.
          //                Visitors still get geo-personalisation but no intent/CRM.
          //
          //   default    — ALL billable stages are removed (static content only).
          //
          //   full_adaptive — guard never returns blocked=true in this mode
          //                   (monthly cap check skips it), so this branch is
          //                   unreachable for full_adaptive tenants.
          const { SMART_LITE_BLOCKED_STAGE_LABELS } =
            await import("@/billing/enrichment-guard");

          const fallback     = walletGuard.fallbackMode ?? "default";
          const blockedLabels: string[] = [];

          enrichersForPipeline = stagedEnrichers.filter((e) => {
            // Non-billable stages always run.
            if (!BILLABLE_STAGE_LABELS.has(e.label)) return true;

            // smart_lite: recognition stays; adaptation + brainpower are blocked.
            if (fallback === "smart_lite" && !SMART_LITE_BLOCKED_STAGE_LABELS.has(e.label)) {
              return true;
            }

            // default (or any other mode): block all billable stages.
            blockedLabels.push(e.label);
            return false;
          });

          logger.warn("[decision-context] wallet guard blocked billable enrichers", {
            tenantId,
            blockReason:  walletGuard.blockReason,
            balanceCents: walletGuard.balanceCents,
            fallbackMode: fallback,
            blockedStages: blockedLabels,
          });

          // Record the block in enrichment_usage so admins can see it.
          void recordWalletBlock(
            billingClient,
            tenantId,
            walletGuard.blockReason ?? "insufficient_balance",
            blockedLabels,
            sessionId ?? undefined,
          );
        }
      } catch (err) {
        // Guard failure → fail open.
        logger.error("[decision-context] wallet guard error — failing open", {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Deferred slow-enrichment (opt-in: homepage critical-path LCP) ─────
    //
    // When `deferSlowEnrichmentOnMiss` is enabled AND we have a real session,
    // a cache MISS must NOT block the render on the full staged pipeline.
    // Instead the current render uses the FAST partial enrichment that is
    // already computed (CDN header geo + any seeded firmographics), and the
    // full pipeline runs in the BACKGROUND to warm the session cache for the
    // next request.  This keeps the slow pipeline off the hero's render path.
    //
    // The background block mirrors the stale-refresh pattern above verbatim:
    // run the same enrichers list the blocking path would use
    // (`enrichersForPipeline`, post wallet-guard), write the session cache,
    // fire billing, and absorb all errors.  We use a bare Promise (matching
    // the existing stale-refresh) rather than `after()` so this stays
    // consistent with the sibling background path and safe for any caller.
    const useDeferredEnrichment = deferSlowEnrichmentOnMiss && Boolean(sessionId);

    if (useDeferredEnrichment && sessionId) {
      // Render now with the FAST partial — same shape the blocking path seeds with.
      // The full staged pipeline did NOT run for this render (it runs in the
      // background below), so this render's enrichment is headers + seed only.
      enrichment       = normalizeCurrentLocation({ ...headerGeoResult, ...seedEnrichment });
      enrichmentSource = "headers-only";

      if (isDev) {
        logger.debug("[decision-context] deferring slow enrichment to background on cache miss", {
          sessionId, ip, tenantId, reason: sessionCacheMissReason,
        });
      }

      // Fire-and-forget background pipeline run to warm the session cache.
      // Errors are intentionally absorbed — the partial enrichment has already
      // been returned for this render.
      const _enrichersForBackground = enrichersForPipeline;
      const _billingClientForDefer  = billingClient;
      const _tenantIdForDefer       = tenantId;
      const _sessionIdForDefer      = sessionId;
      runInBackground(async () => {
        try {
          const freshResult = await runStagedPipeline(
            _enrichersForBackground,
            enricherInput,
            {
              timeoutMs:          4_000,
              initialAccumulated: { ...headerGeoResult, ...seedEnrichment },
            },
          );
          setSessionEnrichment(sessionId, freshResult.output, ip, tenantId);
          if (isDev) {
            logger.debug("[decision-context] deferred session cache warmed in background", {
              sessionId,
            });
          }
          // Fire billing for the background pipeline run.
          if (_billingClientForDefer && _tenantIdForDefer && freshResult.trace.length > 0) {
            const { trackEnrichmentUsage } = await import("@/billing/enrichment-tracker");
            await trackEnrichmentUsage(_billingClientForDefer, freshResult.trace, {
              tenantId:  _tenantIdForDefer,
              sessionId: _sessionIdForDefer,
            });
          }
        } catch (err) {
          // Absorb — never let a background warm crash the process.
          console.error(
            `[decision-billing] deferred enrichment warm error` +
            ` | tenant=${_tenantIdForDefer ?? "?"}` +
            ` | ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
    } else {
      // ── Staged sequential pipeline ────────────────────────────────────────
      //
      // CDN header result seeds the initial accumulation so that stage 1
      // (MaxMind) and subsequent stages can read e.g. `countryCode` already
      // resolved from Vercel/CF headers without needing to re-fetch it.
      const result: StagedPipelineResult = await runStagedPipeline(
        enrichersForPipeline,
        enricherInput,
        {
          timeoutMs:          4_000,
          initialAccumulated: { ...headerGeoResult, ...seedEnrichment },
          logger: ({ label, timedOut, error }) => {
            logger.warn("[decision-context] staged enricher issue", { label, timedOut, error });
          },
        },
      );

      enrichment       = { ...headerGeoResult, ...result.output };
      stageTrace       = result.trace;
      enrichmentTrace  = result.enrichmentTrace;

      // Mark pipeline-fetched fields as "miss" (pipeline ran fresh this request).
      // Fields attributed to "geo:headers" keep "n/a" — CDN headers have no cache.
      for (const key of Object.keys(enrichmentTrace)) {
        const ft = (enrichmentTrace as Record<string, import("@/enrichment/types").EnrichmentFieldTrace>)[key];
        if (ft && ft.provider !== "geo:headers") {
          ft.cacheStatus = "miss";
        }
      }
      enrichmentSource = "pipeline-fresh";

      // ── Normalize current* location fields ───────────────────────────────
      //
      // GA4 current location is the preferred human-readable source.
      // IP geo still ran for lat/lng and technical signals — normalizeCurrentLocation
      // never suppresses it; it only picks the best display source.
      enrichment = normalizeCurrentLocation(enrichment);

      // ── Demo mode: pipeline ran fresh — log it ───────────────────────────────
      if (isDemoMode()) {
        logDemoModeActive(tenantId, sessionId, "pipeline");
      }

      // ── Enrichment billing tracking ───────────────────────────────────────────
      //
      // Fire-and-forget: records usage events and deducts credits for every
      // billable live API call in the pipeline trace.  Cache hits (cacheSource
      // === "provider-cache") and skipped stages are never billed.
      //
      // Errors are swallowed inside trackEnrichmentUsage — billing failures
      // must never break the visitor-facing page response.
      if (billingClient && tenantId) {
        const stageTraceForBilling = result.trace;
        const billingTenantId      = tenantId;
        const billingSessionId     = sessionId;
        const bc                   = billingClient;

        // Count stage categories for the debug log:
        //   billableCount     — non-skipped stages that made a live API call (will debit if success)
        //   providerCacheHits — non-skipped stages served from provider's in-process cache (cost=0)
        //   skippedCount      — stages the pipeline explicitly skipped (not attempted at all)
        const billableCount     = stageTraceForBilling.filter(
          (s) => !s.skipped && s.cacheSource !== "provider-cache",
        ).length;
        const providerCacheHits = stageTraceForBilling.filter(
          (s) => !s.skipped && s.cacheSource === "provider-cache",
        ).length;
        const skippedCount      = stageTraceForBilling.filter((s) => s.skipped).length;

        logPipelineBillingFired({
          tenantId:         billingTenantId,
          sessionId:        billingSessionId,
          billableCount,
          skippedCount,
          walletGuarded:    false,
          providerCacheHits,
        });

        // Use void to make the fire-and-forget intent explicit.
        // IMPORTANT: catch {} was here before — it swallowed ALL errors including
        // schema mismatches and RPC failures.  Now we log them so they're visible.
        console.log("[decision-billing] firing trackEnrichmentUsage", {
          tenantId:    billingTenantId,
          sessionId:   billingSessionId,
          stageCount:  stageTraceForBilling.length,
          billable:    billableCount,
          cacheHits:   providerCacheHits,
          skipped:     skippedCount,
        });
        void (async () => {
          try {
            const { trackEnrichmentUsage } = await import("@/billing/enrichment-tracker");
            await trackEnrichmentUsage(bc, stageTraceForBilling, {
              tenantId:  billingTenantId,
              sessionId: billingSessionId,
            });
          } catch (err) {
            // Never crash the render — but always log so billing failures are visible.
            console.error(
              `[decision-billing] trackEnrichmentUsage THREW` +
              ` | tenant=${billingTenantId ?? "?"}` +
              ` | session=${billingSessionId ?? "none"}` +
              ` | ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        })();

        // ── First-party company-DB hit billing ─────────────────────────────────
        //
        // A first-party hit is served from the shared pool instead of a paid
        // Leadinfo call. It is billed separately and more cheaply here — it is
        // deliberately NOT mapped to an event type in the pipeline trace, so the
        // generic tracker above ignores it (no double billing). Detected via the
        // "firstparty" source stamped by the first-party stage.
        if (result.output?.companyMatchSource === "firstparty") {
          const firstPartyCompany = result.output.companyName;
          void (async () => {
            try {
              const { billFirstPartyCompanyHit } = await import("@/billing/firstparty-company-billing");
              await billFirstPartyCompanyHit(bc, {
                tenantId: billingTenantId,
                ...(billingSessionId ? { sessionId: billingSessionId } : {}),
                ...(firstPartyCompany ? { company: firstPartyCompany } : {}),
                simulated: isDemoMode(),
              });
            } catch (err) {
              console.error(
                `[decision-billing] first-party billing THREW` +
                ` | tenant=${billingTenantId ?? "?"}` +
                ` | ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
        }

        // ── First-party location lookup billing ────────────────────────────────
        //
        // A resolved buurt is served from our own cbs_area_stats store, so it is
        // billed here (cache_hit=true + a small credit), NOT via the generic
        // tracker (the "CBS Location" stage is mapped to null). Detected via the
        // locationAreaCode the stage stamps on a successful resolution.
        if (result.output?.locationAreaCode) {
          const areaCode = result.output.locationAreaCode;
          void (async () => {
            try {
              const { billLocationLookup } = await import("@/billing/location-billing");
              await billLocationLookup(bc, {
                tenantId: billingTenantId,
                ...(billingSessionId ? { sessionId: billingSessionId } : {}),
                areaCode,
                simulated: isDemoMode(),
              });
            } catch (err) {
              console.error(
                `[decision-billing] location billing THREW` +
                ` | tenant=${billingTenantId ?? "?"}` +
                ` | ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
        }
      } else if (!billingClient) {
        // billingClient was not provided — billing is disabled for this route.
        // Expected: admin pages, API handlers, and preview routes opt out.
        // Unexpected: if this appears for a visitor-facing page, the route is
        // missing its billing client.  Check that the page creates and passes
        // a service-role Supabase client as `billingClient`.
        console.warn(
          `[decision-billing] ⚠ No billingClient provided` +
          ` | tenant=${tenantId ?? "unknown"}` +
          ` | session=${sessionId ?? "none"}` +
          ` | billing: DISABLED` +
          ` | enrichment ran but NO wallet debit / usage_events will be written.` +
          ` | If this is a visitor page, pass billingClient to buildDecisionContext.`,
        );
      }

      // ── Write to session cache ────────────────────────────────────────────
      // Store the fresh pipeline result so subsequent page views in this
      // session can reuse it without re-running the full pipeline.
      // The normalized current* fields are included so cache-hit paths receive
      // them directly without needing to re-derive.
      if (sessionId) {
        setSessionEnrichment(sessionId, enrichment, ip, tenantId, { retry: result.incomplete === true });
      }
    }
  } else {
    // ── Legacy parallel pipeline (backward compat) ────────────────────────
    const geoEnrichers = [
      // CDN headers already ran above — add MaxMind or ip-api as secondary
      hasMaxMindDb
        ? createMaxMindGeoEnricher({ isDev })
        : isDev
          ? createIpApiGeoEnricher({ isDev })
          : null,
    ].filter(Boolean) as LabeledEnricher[];

    // Company + CRM enricher selection
    const companyCrmEnrichers: LabeledEnricher[] =
      ipCompanyCrmEnricher
        ? [ipCompanyCrmEnricher]
        : [createCompanyEnricher(companyProvider), createCrmEnricher(crmProvider)];

    const { output: legacyOutput } = await runEnrichmentPipeline(
      [...geoEnrichers, ...companyCrmEnrichers],
      enricherInput,
      { timeoutMs: 2_000 },
    );

    enrichment = normalizeCurrentLocation({ ...headerGeoResult, ...legacyOutput });
  }

  // ── Leadinfo client-side enrichment merge ────────────────────────────────────
  //
  // The LeadinfoProvider client component calls the Leadinfo Identify API from
  // the visitor's browser (using the real client IP) and persists the normalised
  // result in the mc_li httpOnly cookie via POST /api/enrichment/leadinfo.
  //
  // We merge the mc_li data AFTER the staged pipeline so that Leadinfo's
  // company signals — identified from the true client IP rather than a CDN or
  // proxy address — take precedence over server-side IP-based lookups.
  //
  // Only leadinfo* fields are written here.  Generic company fields
  // (companyName, companyDomain, etc.) produced by the pipeline are preserved
  // unchanged so that OpenKvK and HubSpot CRM data are not accidentally
  // overwritten.  Downstream rules can compare leadinfoCompanyName with
  // companyName to detect source discrepancies.
  const liCookieVal = cookieHeader
    ? parseCookieField(cookieHeader, LEADINFO_COOKIE)
    : null;

  const leadinfoData       = parseLeadinfoCookie(liCookieVal);
  const leadinfoEnrichment = leadinfoToEnrichment(leadinfoData);

  if (Object.keys(leadinfoEnrichment).length > 0) {
    enrichment = { ...enrichment, ...leadinfoEnrichment };
    logger.debug("[decision-context] Leadinfo cookie merged", {
      matched:         leadinfoData?.matched,
      companyName:     leadinfoData?.companyName,
      companyDomain:   leadinfoData?.companyDomain,
      companyCountry:  leadinfoData?.companyCountry,
    });
  }

  // ── Seasonal event: enrichment override ──────────────────────────────────────
  //
  // `buildTimeContext` computes `seasonalEvent` from pure date math with no
  // country awareness.  The seasonal enrichment stage may produce a more
  // accurate, country-specific value — e.g. Easter on a different date for
  // Orthodox countries, or a public holiday we don't hard-code.
  //
  // When the enrichment pipeline resolved a non-null `seasonalEvent`, use it
  // as the final value; otherwise keep the static value from buildTimeContext.
  const enrichmentSeasonalEvent =
    typeof enrichment.seasonalEvent === "string" && enrichment.seasonalEvent
      ? (enrichment.seasonalEvent as SeasonalEvent)
      : null;

  const finalSeasonalEvent: SeasonalEvent =
    enrichmentSeasonalEvent ?? timeCtx.seasonalEvent;

  // ── Assemble ─────────────────────────────────────────────────────────────────

  // ── Assemble base context ────────────────────────────────────────────────────
  //
  // Build the context without derived signals first — computeDerivedContext
  // needs a fully-assembled context (enrichment + time + history) as input.
  const baseCtx: RuleEvaluationContext = {
    ...visitorContext,
    history: {
      ...history,
      // Expose derived helpers so call sites don't need to re-derive them.
      pageViewCount,
      ctaClickCount,
      hasClickedCta,
    },
    // Page-level context (optional in RuleEvaluationContext)
    pathname,
    tenantId,
    templateKey,
    pageType,
    // Enrichment (geo fields populated; other domains default to null)
    enrichment,
    // Time context — seasonalEvent is overridden when enrichment resolved one
    ...timeCtx,
    seasonalEvent: finalSeasonalEvent,
    // Client / device context (UA-parsed + browser-collected from mc_cc cookie)
    clientContext,
    // Rule-context overlay + read fields (regels die context schrijven).
    ruleContext,
    // Per-request domain attributes (read by an AttributeCondition). Sanitised
    // and filtered against the tenant declaration by the caller.
    customAttributes,
    entryPath,
    isBot: detectIsBot(visitorContext.userAgent, enrichment.isCloudProvider),
  };

  // ── Derived context ───────────────────────────────────────────────────────────
  //
  // Computed from all other context layers in a single pure pass.
  // No I/O — fails silently (returns {}) on any unexpected error.
  let derived: ReturnType<typeof computeDerivedContext>;
  try {
    derived = computeDerivedContext(baseCtx);
  } catch {
    derived = {} as ReturnType<typeof computeDerivedContext>;
  }

  // ── Interest profile scoring ──────────────────────────────────────────────────
  //
  // Loads active interest profiles from the DB and scores the current visitor
  // against them using a keyword cloud built from available server-side signals.
  //
  // Server-side keyword cloud sources (in priority order):
  //   1. utmTerm         — the raw search query the visitor typed (highest signal).
  //   2. viewedKeywords  — page metaKeywords accumulated by PageTracker across all
  //                        page_view events in this session, stored in
  //                        visitor_behavior_state.viewed_keywords and surfaced via
  //                        history.journey.viewedKeywords.  Each deduplicated keyword
  //                        contributes count=1 (lower than UTM which is pure intent).
  //
  // Non-blocking — DB failure or empty profile list degrades to null scores.
  let interestScores: import("@/interest-profiles/types").InterestScore[] | null = null;
  let interestContext: import("@/interest-profiles/types").InterestContextVars | null = null;

  try {
    const profilesResult = await listActiveInterestProfiles(tenantId);
    const profiles = profilesResult.ok ? profilesResult.data : [];

    if (profiles.length > 0) {
      // Build a keyword cloud from all available server-side signals.
      // Keywords are lowercased to match the case-insensitive matching contract.
      const cloud: Record<string, number> = {};

      // Source 1: UTM search term (highest intent — visitor typed this query).
      if (visitorContext.utmTerm) {
        // Split UTM term into individual words so multi-word queries match more tags.
        const terms = visitorContext.utmTerm.toLowerCase().trim().split(/\s+/);
        for (const term of terms) {
          if (term) cloud[term] = (cloud[term] ?? 0) + 2;
        }
        // Also add the full term as a keyword to support exact phrase matching.
        const fullTerm = visitorContext.utmTerm.toLowerCase().trim();
        if (fullTerm) cloud[fullTerm] = (cloud[fullTerm] ?? 0) + 2;
      }

      // Source 2: Page keywords accumulated from all visited pages this session.
      // Stored in visitor_behavior_state.viewed_keywords (deduplicated Set across
      // all page_view events) and surfaced via history.journey.viewedKeywords.
      // Each keyword contributes count=1 — page-browse intent is lower than UTM.
      const viewedKeywords = history.journey?.viewedKeywords ?? [];
      for (const kw of viewedKeywords) {
        const normalized = kw.toLowerCase().trim();
        if (normalized) cloud[normalized] = (cloud[normalized] ?? 0) + 1;
      }

      if (Object.keys(cloud).length > 0) {
        const scored = scoreInterests(cloud, profiles);
        if (scored.some((s) => s.rawScore > 0)) {
          interestScores   = scored;
          interestContext  = buildInterestContextVars(scored);
        }
      }
    }
  } catch (err) {
    // Non-fatal — interest scoring failure never blocks the decision pipeline.
    logger.debug("[build-decision-context] interest scoring error", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const ctx: RuleEvaluationContext = {
    ...baseCtx,
    derived,
    interestScores:  interestScores ?? null,
    interestContext: interestContext ?? null,
    // CRM → behavior merged lifecycle (customer mode drives personalization).
    crmMergedState: history.journey
      ? mergeCrmWithBehavior(normalizeCrmProfile(enrichment), history.journey)
      : null,
  };

  // ── Logging ──────────────────────────────────────────────────────────────────

  logger.debug("[decision-context]", {
    // ── Execution policy summary ───────────────────────────────────────────
    // Shows how each group of variables was resolved for observability.
    _policies: {
      // request: recomputed on every request (no I/O)
      request:  ["source", "device", "visitType", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "referrerDomain", "pathname", "tenantId", "pageType", "templateKey"],
      // session: computed once per session, cached in-process
      session:  ["countryCode", "region", "city", "networkAsn", "networkOrg", "networkDomain", "companyName", "companyDomain", "companyIndustry", "companySize", "crmMatched", "crmLifecycleStage", "crmCompanyId", "seasonalEvent"],
      // cached:  external API results cached at the provider level (TTL varies)
      cached:   { leadinfo: "1h/ip", openkvk: "6h/query", hubspot: "2h/domain", "nager-date": "24h/country-year" },
      // derived (time): computed from other values; no I/O
      derived_time:    ["isWeekend", "dayOfWeek", "currentHour", "timeOfDay", "month", "dateKey", "hasClickedCta", "pageViewCount", "ctaClickCount"],
      // derived (context layer): computed by computeDerivedContext after pipeline
      derived_context: ["daySegment", "isWorkHours", "isHoliday", "season", "isBadWeather", "temperatureBucket", "companyType", "industryGroup", "channelGroup", "campaignType", "isRetargetedUser", "engagementScore", "pagesVisited", "funnelStage", "visitDepth", "contentInterestCategory", "isResearching", "isReadyToConvert", "primaryInterest"],
    },
    // ── Enrichment source / cache ──────────────────────────────────────────
    enrichmentSource,
    ...(sessionCacheMissReason ? { sessionCacheMissReason } : {}),
    // ── Traffic / acquisition (request policy) ─────────────────────────────
    source:         ctx.source,
    utmSource:      ctx.utmSource,
    utmMedium:      ctx.utmMedium,
    utmCampaign:    ctx.utmCampaign,
    referrerDomain: ctx.referrerDomain,
    // ── Device / session (request policy) ─────────────────────────────────
    device:         ctx.device,
    visitType:      ctx.visitType,
    pathname,
    // ── Behavior / history (session policy — DB-backed) ────────────────────
    pageViewCount,
    ctaClickCount,
    hasClickedCta,
    historyFromDb:  history.fromDatabase,
    // ── Geo enrichment — IP-based (session policy) ────────────────────────
    countryCode:    enrichment.countryCode ?? null,
    region:         enrichment.region      ?? null,
    city:           enrichment.city        ?? null,
    latitude:       enrichment.latitude    ?? null,
    longitude:      enrichment.longitude   ?? null,
    // ── Normalized current location (GA4 preferred; IP geo fallback) ──────
    currentCity:           enrichment.currentCity           ?? null,
    currentRegion:         enrichment.currentRegion         ?? null,
    currentCountry:        enrichment.currentCountry        ?? null,
    currentLocationSource: enrichment.currentLocationSource ?? null,
    // IP geo still ran for coordinates regardless of GA4 location source
    ipGeoRanForCoords: (enrichment.latitude != null || enrichment.longitude != null),
    // ── Network enrichment — IPinfo (session policy) ──────────────────────
    networkAsn:    enrichment.networkAsn    ?? null,
    networkOrg:    enrichment.networkOrg    ?? null,
    networkDomain: enrichment.networkDomain ?? null,
    // ── Company enrichment (session policy) ───────────────────────────────
    companyName:            enrichment.companyName            ?? null,
    companyDomain:          enrichment.companyDomain          ?? null,
    companyMatchConfidence: enrichment.companyMatchConfidence ?? null,
    companyMatchSource:     enrichment.companyMatchSource     ?? null,
    // ── CRM enrichment (session policy) ───────────────────────────────────
    crmMatched:        enrichment.crmMatched        ?? null,
    crmLifecycleStage: enrichment.crmLifecycleStage ?? null,
    crmSegment:        enrichment.crmSegment        ?? null,
    // ── Staged pipeline trace (dev only; session policy) ──────────────────
    ...(isDev && stageTrace.length > 0 ? { stageTrace } : {}),
    // ── Page context (request policy) ─────────────────────────────────────
    tenantId,
    templateKey,
    pageType,
    // ── Time context (derived policy) ─────────────────────────────────────
    currentHour:   timeCtx.currentHour,
    dayOfWeek:     timeCtx.dayOfWeek,
    isWeekend:     timeCtx.isWeekend,
    month:         timeCtx.month,
    dateKey:       timeCtx.dateKey,
    timeOfDay:     timeCtx.timeOfDay,
    // ── Seasonal event (session policy + enrichment override) ─────────────
    seasonalEvent:            finalSeasonalEvent,
    seasonalEventSource:      enrichmentSeasonalEvent
      ? (enrichment.seasonalSource ?? "enrichment")
      : "time-context",
    seasonalEventOverridden:  enrichmentSeasonalEvent !== null,
    holidayName:              enrichment.holidayName   ?? null,
  });

  // ── Emit debug info (PARTS 1–5, 11–12) ──────────────────────────────────────
  //
  // Called before returning so the page can capture enrichment provenance,
  // IP details, session-cache state, and location source resolution without
  // changing the return type.
  onDebugInfo?.({
    realIp:                ip,
    effectiveIp,
    ipOverrideActive,
    // Location source resolution — clearly shows which source populated current*
    currentCity:           enrichment.currentCity           ?? null,
    currentRegion:         enrichment.currentRegion         ?? null,
    currentCountry:        enrichment.currentCountry        ?? null,
    currentLocationSource: (enrichment.currentLocationSource as "ga4" | "ip_geo" | null) ?? null,
    // IP geo ran independently for coordinates (Part 12: always true when lat/lng resolved)
    ipGeoHasCoordinates:   (enrichment.latitude != null && enrichment.longitude != null),
    enrichmentSource,
    sessionCacheMissReason,
    enrichmentTrace,
    stageTrace,
    // Time context provenance
    timeZoneSource,
    timeZoneApproximate,
  });

  return ctx;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
//
// Small, pure, independently testable helpers.
// Each is exported so callers can use them in isolation (e.g. unit tests).

/**
 * Extract UTM query parameters from a URL string or URL object.
 *
 * Returns all five standard UTM dimensions; each is `null` when absent.
 *
 * @example
 * getUtmParams("https://example.com?utm_source=google&utm_medium=cpc")
 * // → { utmSource: "google", utmMedium: "cpc", utmCampaign: null, ... }
 */
export function getUtmParams(url: string | URL): {
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  utmContent:  string | null;
  utmTerm:     string | null;
} {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return {
      utmSource:   parsed.searchParams.get("utm_source"),
      utmMedium:   parsed.searchParams.get("utm_medium"),
      utmCampaign: parsed.searchParams.get("utm_campaign"),
      utmContent:  parsed.searchParams.get("utm_content"),
      utmTerm:     parsed.searchParams.get("utm_term"),
    };
  } catch {
    return {
      utmSource: null, utmMedium: null, utmCampaign: null,
      utmContent: null, utmTerm: null,
    };
  }
}

/**
 * Classify a User-Agent string as `"mobile"` or `"desktop"`.
 *
 * Thin re-export of the existing `detectDevice` helper so consumers of this
 * module don't need to reach into `@/context/helpers` directly.
 *
 * Defaults to `"desktop"` when the User-Agent is absent or unrecognised.
 */
export { detectDevice } from "@/context/helpers";

/**
 * Resolve the primary traffic source from UTM and referrer signals.
 *
 * Precedence:
 *   1. `utmSource`  — explicit, marketer-controlled, highest trust
 *   2. `referrer`   — browser-provided Referer header value
 *   3. `"direct"`   — no referrer, no UTM (typed URL / bookmark)
 *   4. `"unknown"`  — referrer present but domain unrecognised
 *
 * This is a pure subset of the logic in `detectVisitorContext`.
 * When working from a full `Request`, prefer `detectVisitorContext` directly.
 */
export function detectSource(
  utmSource: string | null,
  referrer:  string | null,
): TrafficSource {
  if (utmSource) {
    const normalised = utmSource.toLowerCase().trim();
    const SOURCE_MAP: Record<string, TrafficSource> = {
      linkedin: "linkedin", "linkedin.com": "linkedin",
      google:   "google",   "google.com":   "google",
      "google-ads": "google", googleads: "google", adwords: "google",
    };
    return SOURCE_MAP[normalised] ?? "unknown";
  }

  if (referrer) {
    const parsed = parseReferrer(referrer);
    if (parsed?.inferredSource) return parsed.inferredSource;
    return "unknown";
  }

  return "direct";
}

/**
 * Extract the referrer domain from a `Headers` object.
 *
 * Returns the lowercased hostname without `www.`, e.g. `"linkedin.com"`.
 * Returns `null` when the Referer header is absent or the URL is malformed.
 */
export function getReferrerDomain(headers: Headers): string | null {
  const raw = headers.get("referer") ?? headers.get("referrer") ?? null;
  return parseReferrer(raw)?.domain ?? null;
}

/**
 * Detect the visit type (new vs returning) from request cookies.
 *
 * Reads the `mc_seen` cookie set by the client-side PageTracker.
 * Returns `"returning"` when the cookie is present with value `"1"`,
 * `"new"` otherwise.
 *
 * Server-side only — on the server, "new" is the safe default for the
 * current in-flight request even if the cookie will be written later.
 */
export function getVisitType(cookieHeader: string | null): "new" | "returning" {
  if (!cookieHeader) return "new";
  // Lightweight inline parse — avoids importing readCookies for a single check
  for (const pair of cookieHeader.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    if (pair.slice(0, eqIdx).trim() === "mc_seen") {
      return pair.slice(eqIdx + 1).trim() === "1" ? "returning" : "new";
    }
  }
  return "new";
}

/**
 * Derive the page-view count from the visitor's first-party history.
 *
 * On the server this comes from the `events` table (rows with type
 * `page_view` for this session).  On the client, the `PageTracker`
 * component maintains a live count in localStorage and syncs it
 * asynchronously — this function is the server-side read path.
 *
 * Returns `0` for brand-new sessions or when DB is unavailable.
 */
export function getPageViewCount(history: VisitorHistory): number {
  return history.pageViewCount;
}

/**
 * Derive the CTA-click count from the visitor's first-party history.
 *
 * Reflects the number of `cta_click` events recorded for this session.
 * Returns `0` for brand-new sessions or when DB is unavailable.
 */
export function getCtaClickCount(history: VisitorHistory): number {
  return history.ctaClickCount;
}

/**
 * Derive the `hasClickedCta` boolean from the visitor's first-party history.
 *
 * True when at least one `cta_click` event has been recorded for this
 * session.  Consistent with `VisitorHistory.hasClickedCta` — exposed here
 * for symmetry with the other helpers.
 */
export function getHasClickedCta(history: VisitorHistory): boolean {
  return history.hasClickedCta;
}

// ── Location normalization ─────────────────────────────────────────────────────

/**
 * Compute normalized `current*` location fields from a completed enrichment
 * output.
 *
 * GA4 history is the preferred source for human-readable current location
 * (city, region, country name) because GA4 derives it from Google's own
 * location signals, which are often more accurate than IP geo city-level
 * approximations.
 *
 * IP-based geo (MaxMind / CDN headers) is NEVER suppressed by this function —
 * it still runs for latitude / longitude, networkAsn, networkOrg,
 * networkDomain, and all company enrichment that depends on those signals.
 * Only the `current*` display fields reflect GA4 preference.
 *
 * Called immediately after enrichment is assembled — before storing in the
 * session cache — so the normalized fields are persisted and available on
 * subsequent session-cache hits without re-computation.
 */
export function normalizeCurrentLocation(
  enrichment: Partial<EnrichmentOutput>,
): Partial<EnrichmentOutput> {
  const ga4City    = enrichment.gaCurrentCity    ?? null;
  const ga4Region  = enrichment.gaCurrentRegion  ?? null;
  const ga4Country = enrichment.gaCurrentCountry ?? null;

  const hasGa4 = ga4City !== null || ga4Region !== null || ga4Country !== null;

  if (hasGa4) {
    return {
      ...enrichment,
      currentCity:           ga4City,
      currentRegion:         ga4Region,
      currentCountry:        ga4Country,
      currentLocationSource: "ga4",
    };
  }

  const ipCity    = enrichment.city        ?? null;
  const ipRegion  = enrichment.region      ?? null;
  const ipCountry = enrichment.countryCode ?? null;   // ISO 2-letter code when from IP

  const hasIp = ipCity !== null || ipRegion !== null || ipCountry !== null;

  return {
    ...enrichment,
    currentCity:           ipCity,
    currentRegion:         ipRegion,
    currentCountry:        ipCountry,
    currentLocationSource: hasIp ? "ip_geo" : null,
  };
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Extract the URL pathname from a `Request` object.
 *
 * Returns `null` when the URL is malformed (safe default; pathname rules
 * simply won't match rather than crashing).
 */
function getPathnameFromRequest(request: Request): string | null {
  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}

/**
 * Fast inline cookie field extractor — avoids importing readCookies() for a
 * single key lookup, keeping the critical-path hot code as lean as possible.
 *
 * @param cookieHeader - Raw Cookie header string from the request.
 * @param name         - Cookie name to look up.
 * @returns The cookie value string, or null when absent.
 */
function parseCookieField(cookieHeader: string, name: string): string | null {
  for (const pair of cookieHeader.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    if (pair.slice(0, eqIdx).trim() === name) {
      return pair.slice(eqIdx + 1).trim() || null;
    }
  }
  return null;
}

// extractIpFromRequest moved to @/lib/request-ip so the ip_company_cache write
// side (the client-Leadinfo cache warm) resolves the exact same raw IP as this
// read side — otherwise the ip_hash key would not match. See the import at top.
