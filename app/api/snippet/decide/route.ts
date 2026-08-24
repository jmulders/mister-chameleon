/**
 * POST /api/snippet/decide
 *
 * Lightweight personalisation decision endpoint for the JavaScript snippet
 * integration.  Called by the browser-side snippet to determine which variant
 * content to show.
 *
 * ─── Request ─────────────────────────────────────────────────────────────────
 *
 *   POST /api/snippet/decide
 *   Content-Type: application/json
 *
 *   {
 *     "siteKey": "sk_live_abc123",
 *     "context": {
 *       "path":       "/pricing",
 *       "referrer":   "https://google.com/...",
 *       "utm_source": "google",
 *       "utm_medium": "cpc",
 *       "sessionId":  "mc_sid_value",
 *       "locale":     "nl"
 *     }
 *   }
 *
 * ─── Response ────────────────────────────────────────────────────────────────
 *
 *   HTTP 200 — variant content map
 *
 *   {
 *     "slots": {
 *       "hero-title":      "Your website, personalised.",
 *       "hero-subtitle":   "The right message for every visitor.",
 *       "hero-cta-label":  "Start free trial",
 *       "hero-cta-href":   "/signup",
 *       "hero-tag":        "Adaptive websites without the complexity",
 *       "proof-title":     "Trusted by 200+ growth teams",
 *       "cta-title":       "Ready to personalise?",
 *       "cta-text":        "Join thousands of teams growing faster.",
 *       "cta-cta-label":   "Book a demo",
 *       "cta-cta-href":    "/book-demo"
 *     },
 *     "selectors": {                     // optional, from tenant config
 *       "hero-title": ".hero h1"         // target host markup without data-mc-slot
 *     }
 *   }
 *
 *   A slot value is normally a string (content mode). It may also be a block
 *   object { mode:"block", html, tokens } once a variant opts into block render
 *   mode — see lib/snippet/decide-response.ts and docs/design/snippet-render-modes.md.
 *
 *   HTTP 400 — missing or malformed siteKey / context
 *   HTTP 403 — siteKey not found or snippet disabled for this tenant
 *   HTTP 500 — internal error (response includes no-personalisation content)
 *
 * ─── CORS ────────────────────────────────────────────────────────────────────
 *
 *   Access-Control-Allow-Origin: * — snippet must be usable from any domain.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   The siteKey is a public identifier.  This endpoint returns only CMS content
 *   that would already be visible to any visitor — no secrets are exposed.
 *
 * ─── Decision strategy ───────────────────────────────────────────────────────
 *
 *   Uses the same rules-only lightweight pipeline as resolveSlugPageConfig but
 *   without the full slug page machinery:
 *
 *   1. Resolve tenant by siteKey
 *   2. Fetch visitor history by sessionId (if provided)
 *   3. Build decision context from supplied visitor signals
 *   4. Run RulesDecisionProvider → ExperimentDecisionProvider
 *   5. Fetch winning variant content from CMS (hero / cta only — the most
 *      common use case for third-party sites)
 *   6. Map variant fields → flat slot map keyed by data-mc-slot conventions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { getTenantBySiteKey }        from "@/tenant/server";
import { createCMSProvider }         from "@/cms";
import { platformFirstVariants }     from "@/cms/providers/platform-first-variants";
import { getDemoContextSet, getDemoNotifSet } from "@/components/scenario/demo-context-sets";
import { resolveSession }            from "@/data/session";
import { fetchVisitorHistory }       from "@/context/fetch-visitor-history";
import { emptyHistory }              from "@/context/visitor-history";
import {
  RulesDecisionProvider,
  ExperimentDecisionProvider,
}                                    from "@/decision";
import { loadTenantRulesConfig }     from "@/decision/rules/load-tenant-rules";
import { buildDecisionContext }      from "@/decision/context/build-decision-context";
import { sanitizeCustomAttributes }  from "@/decision/context/custom-attributes";
import { ttlToMs }                   from "@/lib/notifications/frequency-cap";
import { isBotUserAgent }            from "@/decision/context/detect-bot";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/lib/locale";
import type { TenantSettings }       from "@/tenant/types";
import type { HeroBlockData, CTABlockData, ProofBlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData } from "@/cms/types";
import { getDunningState }           from "@/billing/dunning";
import { getTenantDunningSettings }  from "@/billing/dunning";
import { logger }                    from "@/lib/logger";
import { recordJourneyEvent }        from "@/lib/journey/record-event";
import { resolvePageMeta }           from "@/tracking/page-meta-map";
import { sanitizeSelectorMap }       from "@/lib/snippet/decide-response";
import type { SlotMap, BlockSlot }   from "@/lib/snippet/decide-response";
import { isSnippetOriginAllowed }    from "@/lib/snippet/origin-allowlist";
import { withBookDemoFallback }      from "@/lib/snippet/book-demo-fallback";
import { toBlockSlot, resolveBlockFx } from "@/lib/snippet/block-slot";
import type { BlockEffectRef }        from "@/design-system/effects/effect-ref";
import { listDesignEffectSets }      from "@/lib/design-effect-sets/effect-sets-store";
import { normaliseVisitorId }        from "@/lib/snippet/visitor-id";
import { serveAds, hostFromOrigin }   from "@/lib/ads/serve-ads";
import { fetchAdAudience, tenantHasFirmographicAd, tenantHasRuleAd, resolveAdCompany, isPublisherApproved, isWalletServable } from "@/lib/ads/serve";
import type { AdAudience }            from "@/lib/ads/targeting";
import { HeadersGeoProvider }         from "@/enrichment/providers/geo";
import { writeAdGa4Event, resolveAdGa4History } from "@/lib/ads/ga4";
import { renderBlockHtml, renderForm, renderCtaNewsletter, notificationMediaHtml } from "@/lib/snippet/render-block-html";
import { substituteBlockCopy, effectiveCopyVariables } from "@/lib/blocks/substitute-context-tokens";
import { resolveContextualForm, loadFormVariant } from "@/forms/context/load";
import { resolvePresentedFields }     from "@/forms/context/variant";
import { getFormDefinition }          from "@/forms";
import { isFormKey }                  from "@/forms/registry";
import { resolveThemeForTenant, resolvedThemeToCSS } from "@/tenant/resolve-theme";
import { computeEffectiveConsent, consentFromSnippet, type SnippetConsentInput } from "@/lib/consent/server-consent";

/**
 * Parse a `--var: value;` CSS declaration block into a record, for forwarding
 * the tenant's fully-resolved theme (preset + admin token-editor overrides) to
 * a block slot's scoped tokens.
 */
function cssDeclarationsToRecord(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const k = m[1].trim();
    const v = m[2].trim();
    if (k && v) out[k] = v;
  }
  return out;
}

// ── CORS helpers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Request / Response types ──────────────────────────────────────────────────

interface DecideRequest {
  siteKey: string;
  /**
   * Block-slot keys present on the page as `data-mc-block="<key>"` containers.
   * The snippet reports these so the route renders each requested variant to a
   * whole self-contained block, instead of the per-element content slots.
   */
  blocks?: string[];
  /**
   * Visitor consent for profiling, as resolved client-side by the snippet from
   * the host CMP (publisher signal -> IAB TCF -> Google Consent Mode -> GPC/DNT).
   *
   *   - object  -> the three categories {analytics, personalization, enrichment}.
   *   - boolean -> legacy payload: true = full, false = deny.
   *   - null    -> host sent no signal; the tenant consentSource decides the
   *                default (deny for "auto", grant for "always").
   *   - absent  -> pre-consent snippet; treated as granted (those hosts gate
   *                loading on their own banner).
   *
   * Each category gates a family of processing: analytics -> GA4/event writes;
   * personalization -> behavioural history + journey; enrichment -> firmographic /
   * Leadinfo / company lookup. The tenant privacy ceiling is applied on top. See
   * docs/design/host-cmp-consent.md.
   */
  consent?: SnippetConsentInput;
  context?: {
    path?:           string;
    referrer?:       string;
    utm_source?:     string;
    utm_medium?:     string;
    utm_campaign?:   string;
    sessionId?:      string;
    /**
     * Stable first-party visitor id minted and persisted by the snippet
     * (localStorage `mc_vid`, cookie fallback). Sent on every pageview so the
     * platform can key behavioural history to one visitor instead of treating
     * each pageview as a brand-new session. Normally equal to sessionId.
     */
    visitorId?:      string;
    locale?:         string;
    /**
     * Interest keywords for this page — sent by the snippet from the page's
     * <meta name="keywords"> tag. Merged with the URL→keyword map and recorded
     * as a behavioural page_view so interest-profile scoring works on snippet
     * (e.g. Statamic) sites, not just platform-rendered pages.
     */
    keywords?:       string[];
    /** Stable per-pageview id for idempotent journey-event recording. */
    eventId?:        string;
    /**
     * Mirror-demo scenario override.
     * When present alongside _demoMode === "mirror" the rule engine is bypassed.
     *
     * If _demoId is also supplied, the per-demo AI-generated scenario_slots are
     * loaded from demo_instances and returned directly (no CMS lookup needed).
     * Otherwise the legacy DEMO_SCENARIO_PLANS CMS fallback is used.
     */
    _demoScenario?: string;
    _demoMode?:     string;
    /**
     * Mirror demo instance ID.
     * When present with _demoMode=mirror, the decide endpoint loads the
     * AI-generated scenario_slots for this specific demo from the DB and
     * returns slots[_demoScenario].  This replaces the generic DEMO_SCENARIO_PLANS
     * lookup so every prospect sees their own site's personalised content.
     */
    _demoId?:       string;
    /**
     * Live-demo notification toggle (second axis alongside _demoScenario). Maps
     * to a DEMO_NOTIF_SETS entry (e.g. "open" / "closed") whose notification
     * variant is layered onto the mirror-demo slots. When the tenant has a notif
     * set and this is absent, the first entry is used so the demo always shows one.
     */
    _demoNotif?:    string;
    /**
     * Per-request domain attributes for the current page (e.g. a trailer model's
     * { massa, categorie, occasion }), read by an AttributeCondition. Untrusted /
     * spoofable: sanitised and filtered to the tenant declaration server-side
     * before it reaches rule evaluation.
     */
    customAttributes?: Record<string, unknown>;
  };
}

// ── Demo scenario bypass plans ────────────────────────────────────────────────
//
// Maps the 6 Mister Chameleon blueprint scenarios to their canonical plans.
// Used when the Scenario Control Panel sends _demoScenario in the context.
// This lets the panel drive any tenant's decide response for demo purposes.

const DEMO_SCENARIO_PLANS: Record<string, {
  heroKey: string; proofKey: string; ctaKey: string;
  featureKey?: string; conversionKey?: string; notificationKey?: string;
}> = {
  awareness:    { heroKey: "hero_default",            proofKey: "proof_vision",     ctaKey: "cta_default",    featureKey: "feature_highlights",  conversionKey: "conversion_contact"                          },
  consideration:{ heroKey: "hero_consideration",      proofKey: "proof_cases",      ctaKey: "cta_demo",       featureKey: "feature_grid_primary", conversionKey: "conversion_signup"                           },
  high_intent:  { heroKey: "hero_intent_direct",      proofKey: "proof_stats",      ctaKey: "cta_meeting",    featureKey: "feature_comparison",   conversionKey: "conversion_demo",   notificationKey: "notification_urgency"   },
  form_dropout: { heroKey: "hero_consideration",      proofKey: "proof_reassurance",ctaKey: "cta_demo",       featureKey: "feature_comparison",   conversionKey: "conversion_demo",   notificationKey: "notification_returning" },
  customer:     { heroKey: "hero_customer_onboarding",proofKey: "proof_default",    ctaKey: "cta_onboarding", featureKey: "feature_highlights",   conversionKey: "conversion_contact"                          },
  expansion:    { heroKey: "hero_customer_onboarding",proofKey: "proof_stats",      ctaKey: "cta_expansion",  featureKey: "feature_grid_primary", conversionKey: "conversion_demo"                             },

  // Cluistra sales-demo contexts — mirror lib/demo/demo-scenario-plans.ts and the
  // per-tenant switcher in components/scenario/demo-context-sets.ts. Let the live
  // snippet (?mc_demo) switch a cluistra site between its four contexts.
  cluistra_service:     { heroKey: "hero_service",        proofKey: "proof_service",     ctaKey: "cta_service", featureKey: "feature_service" },
  cluistra_ondernemer:  { heroKey: "hero_intent_direct",  proofKey: "proof_stats",       ctaKey: "cta_meeting", featureKey: "feature_comparison" },
  cluistra_particulier: { heroKey: "hero_consideration",  proofKey: "proof_reassurance", ctaKey: "cta_demo",    featureKey: "feature_highlights" },
  cluistra_default:     { heroKey: "hero_direct_brand",   proofKey: "proof_cases",       ctaKey: "cta_guide",   featureKey: "feature_grid_primary" },
};

// SlotMap (string | block value) is the shared wire contract — see
// lib/snippet/decide-response.ts. Assigning plain strings below stays valid.

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Editor bypass ──────────────────────────────────────────────────────────
  //
  // When a platform admin is browsing the site (e.g. from the Statamic CP
  // live preview or by opening the live URL while logged into the admin panel),
  // skip the decision engine entirely and return empty slots.
  //
  // The `mc_editor` httpOnly cookie is set on successful admin login and cleared
  // on logout (app/admin/login/actions.ts).  Since the admin panel and the
  // public site share the same domain, this cookie is present on same-domain
  // requests — including snippet calls from the live preview iframe.
  //
  // This prevents credits from being consumed for preview page loads where
  // no real personalisation decision is needed.
  if (request.cookies.get("mc_editor")?.value === "1") {
    return NextResponse.json(
      { slots: {}, _editorMode: true },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { siteKey, context = {} } = body as DecideRequest;

  if (!siteKey || typeof siteKey !== "string") {
    return NextResponse.json(
      { error: "siteKey is required." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // ── Resolve tenant by site key ─────────────────────────────────────────────
  //
  // getTenantBySiteKey uses a direct Supabase JSONB filter query (O(1) row
  // lookup) instead of loading all tenants and filtering in application code.
  // This is important because this endpoint is called on every visitor pageview.
  let tenant: TenantSettings | null = null;
  try {
    tenant = await getTenantBySiteKey(siteKey);
  } catch (err) {
    logger.error("[snippet/decide] Failed to resolve tenant by siteKey", { error: String(err) });
    return NextResponse.json(
      { error: "Internal error." },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if (!tenant) {
    return NextResponse.json(
      { error: "Unknown site key." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  if (!tenant.snippet?.enabled) {
    return NextResponse.json(
      { error: "Snippet integration is not enabled for this site." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  // ── Origin allowlist ────────────────────────────────────────────────────────
  //
  //   The site key is a PUBLIC identifier, so on its own it does not prove the
  //   request came from the tenant's own site. When the operator has configured
  //   `allowedSnippetOrigins`, reject any request whose Origin (or Referer) host
  //   is not on the list — this stops a leaked key from being replayed on other
  //   sites to run up the tenant's usage. Opt-in: an empty list means no check,
  //   so tenants that never configured it keep working.
  if (!isSnippetOriginAllowed(
        request.headers.get("origin"),
        request.headers.get("referer"),
        tenant.snippet?.allowedSnippetOrigins,
      )) {
    logger.warn("[snippet/decide] Origin not allowed for site key", {
      tenantId: tenant.tenantId,
      origin:   request.headers.get("origin") ?? null,
    });
    return NextResponse.json(
      { error: "This origin is not allowed for this site key." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const tenantId = tenant.tenantId;

  // Consent: turn the snippet payload into effective per-category consent, applying
  // the tenant's no-signal default (snippet.consentSource: "auto" -> deny,
  // "always" -> grant) and then the tenant privacy ceiling. Each category gates a
  // distinct family of processing below; ads and variants still serve geo-only
  // when a category is denied.
  const consent = computeEffectiveConsent(
    consentFromSnippet((body as DecideRequest).consent, tenant.snippet?.consentSource),
    tenant.privacy,
  );
  const consentAnalytics       = consent.analytics;
  const consentPersonalization = consent.personalization;
  const consentEnrichment      = consent.enrichment;

  // ── Advertiser tenants: serve ads instead of CMS variants ──────────────────
  //
  //   When the resolved tenant is an ad account, its siteKey is embedded by
  //   PUBLISHER sites and the requested blocks are filled with ads (not the
  //   tenant's own CMS content). This path has its own gates — approved
  //   publisher + wallet balance, inside serveAds — and bills via metered
  //   impressions/clicks, so it deliberately returns BEFORE the subscription /
  //   dunning gate below. Normal tenants (tenantRole !== "advertiser") are
  //   completely unaffected. Behavioural targeting uses the visitor's audience
  //   profile (built below); profiling is billed per unique visitor/day.
  if (tenant.tenantRole === "advertiser") {
    const rawAdBlocks = (body as DecideRequest).blocks;
    const adBlockKeys = Array.isArray(rawAdBlocks)
      ? rawAdBlocks.filter((b): b is string => typeof b === "string")
      : [];
    let adTokens: Record<string, string> = {};
    try {
      adTokens = cssDeclarationsToRecord(resolvedThemeToCSS(resolveThemeForTenant(tenant, null)));
    } catch { /* ads fall back to their own styling */ }

    const adSessionId  = normaliseVisitorId(context.sessionId) ?? normaliseVisitorId(context.visitorId);
    const adOriginHost = hostFromOrigin(request.headers.get("origin") ?? request.headers.get("referer"));

    // Capture the ad-audience journey: a page_view keyed to the ADVERTISER tenant
    // so advertisers can see the journeys of the sessions their ads reached
    // (page sequence + interest keywords). Behavioural capture only — no wallet
    // cost. Runs in parallel with serving so it adds no latency to the ad
    // response; publisher domain is stored in metadata. Targeting still off (MVP).
    const adPageMeta = resolvePageMeta(context.path ?? "/");
    const adKeywords = Array.from(new Set([
      ...(Array.isArray(context.keywords)
        ? context.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean)
        : []),
      ...adPageMeta.keywords,
    ]));

    // Build the behavioural audience (prior interest/journey) and record this
    // pageview in parallel — neither blocks the other. The audience reflects
    // history up to (not including) this view; this view feeds the next one.
    // Behavioural profiling requires consent — without it, ads still serve but
    // geo-only (no history read, no journey write).
    let behav: Awaited<ReturnType<typeof fetchAdAudience>> = null;
    if (consentPersonalization) {
      const [b] = await Promise.all([
        fetchAdAudience(tenantId, adSessionId),
        adSessionId
          ? recordJourneyEvent({
              tenantId,
              sessionId:    adSessionId,
              visitorId:    adSessionId,
              eventType:    "page_view",
              pagePath:     context.path ?? "/",
              pageCategory: adPageMeta.category ?? undefined,
              pageKeywords: adKeywords,
              source:       context.utm_source   ?? undefined,
              medium:       context.utm_medium   ?? undefined,
              campaign:     context.utm_campaign ?? undefined,
              metadata:     { via: "ad", publisher_domain: adOriginHost ?? null },
              eventId:      typeof context.eventId === "string" ? context.eventId : undefined,
            }).catch(() => false)
          : Promise.resolve(false),
      ]);
      behav = b;
    }

    // Attach free geo (Vercel request headers) so geo targeting works even for
    // visitors without a behavioural profile.
    const adGeo = await new HeadersGeoProvider(request.headers).lookup(null);

    // Firmographic company (IP→company) — opt-in and gated: only when the tenant
    // runs a firmographic-targeted ad, from an approved publisher, with wallet
    // balance. resolveAdCompany caches per visitor/day and is a no-op (null, no
    // cost) unless a Leadinfo key is configured. Skips the whole path otherwise.
    let adCompany: Awaited<ReturnType<typeof resolveAdCompany>> = null;
    if (consentEnrichment && adSessionId && adOriginHost && await tenantHasFirmographicAd(tenantId)) {
      if (await isPublisherApproved(tenantId, adOriginHost) && await isWalletServable(tenantId)) {
        const adIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? request.headers.get("x-real-ip") ?? null;
        adCompany = await resolveAdCompany(tenantId, adSessionId, adIp, adOriginHost);
      }
    }

    const audience: AdAudience = {
      keywords:    behav?.keywords ?? [],
      funnelStage: behav?.funnelStage ?? "awareness",
      pageviews:   behav?.pageviews ?? 0,
      returning:   behav?.returning ?? false,
      hasProfile:  !!behav,
      country:     adGeo.countryCode ?? null,
      region:      adGeo.region ?? null,
      company:     adCompany,
    };

    // Record this ad-audience session into the tenant's own GA4 (Measurement
    // Protocol), keyed by our visitor_id, so returning visitors can be enriched
    // from GA4 later. No-op unless GA4 server tracking is configured. Fire-and-forget.
    if (consentAnalytics && adSessionId) void writeAdGa4Event(tenant.ga4, adSessionId, { page: context.path ?? null, publisher: adOriginHost });

    // Advanced rule targeting: build a COST-SAFE decision context — no
    // stagedEnrichers, so buildDecisionContext uses stub providers and makes no
    // paid enrichment calls; header geo is free and the company we already
    // resolved is seeded. Only built when the tenant runs a rule-targeted ad.
    let adRuleCtx: Awaited<ReturnType<typeof buildDecisionContext>> | null = null;
    if (adSessionId && await tenantHasRuleAd(tenantId)) {
      try {
        const ruleUrl = new URL(`https://${adOriginHost ?? "publisher"}${context.path ?? "/"}`);
        if (context.utm_source)   ruleUrl.searchParams.set("utm_source",   context.utm_source);
        if (context.utm_medium)   ruleUrl.searchParams.set("utm_medium",   context.utm_medium);
        if (context.utm_campaign) ruleUrl.searchParams.set("utm_campaign", context.utm_campaign);
        const ruleRequest = new Request(ruleUrl.toString(), {
          headers: {
            "referer":                    context.referrer ?? "",
            "user-agent":                 request.headers.get("user-agent") ?? "",
            "x-forwarded-for":            request.headers.get("x-forwarded-for") ?? "",
            "x-vercel-ip-country":        request.headers.get("x-vercel-ip-country") ?? "",
            "x-vercel-ip-country-region": request.headers.get("x-vercel-ip-country-region") ?? "",
            "x-vercel-ip-city":           request.headers.get("x-vercel-ip-city") ?? "",
          },
        });
        // GA4 history (read from the tenant's own GA4) — no-op unless configured.
        // Seeded so advanced rules can target ga4.* fields. Cost-free (GA4 Data API).
        const [ruleHistory, adGa4History] = await Promise.all([
          fetchVisitorHistory(adSessionId, tenantId).catch(() => emptyHistory()),
          resolveAdGa4History(tenant.ga4, adSessionId),
        ]);
        adRuleCtx = await buildDecisionContext({
          request:     ruleRequest,
          history:     ruleHistory,
          tenantId,
          templateKey: context.path ?? "/",
          pageType:    null,
          sessionId:   adSessionId,
          timezone:    tenant.timezone ?? null,
          seedEnrichment: {
            ...adGa4History,
            countryCode:     audience.country ?? undefined,
            region:          audience.region ?? undefined,
            companyName:     audience.company?.name ?? undefined,
            companyIndustry: audience.company?.industry ?? undefined,
            companySize:     audience.company?.size ?? undefined,
          },
        });
      } catch { adRuleCtx = null; }
    }

    const adSlots: SlotMap = adBlockKeys.length > 0
      ? await serveAds({
          tenantId,
          blockKeys:    adBlockKeys,
          originHost:   adOriginHost,
          platformBase: new URL(request.url).origin,
          sessionId:    adSessionId,
          audience,
          ruleCtx:      adRuleCtx,
          tokens:       adTokens,
          // Advertiser-level "inherit host style" default (per-creative flag can
          // override in serveAds). Mirrors the snippet's inherit mode.
          inherit:      tenant.design?.inheritHostStyle === true,
        })
      : {};
    return NextResponse.json({ slots: adSlots, _ad: true }, { status: 200, headers: CORS_HEADERS });
  }

  // Selector map from tenant config (trusted). Included in the content-serving
  // response so slots work on host markup without a data-mc-slot attribute.
  const selectorMap = sanitizeSelectorMap(tenant.snippet?.selectorMap);

  // ── Subscription payment gate ──────────────────────────────────────────────
  //
  //   past_due  (in quarantine)  → return empty slot map (default content shown)
  //   unpaid    (blocked)        → return 404 (no content served at all)
  //
  //   Checking subscription state adds one fast DB read per request.  The result
  //   is intentionally NOT cached at the request level so that clearing dunning
  //   (e.g. via webhook) takes effect on the very next snippet call.
  try {
    const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (supabaseUrl && supabaseSrvc) {
      const sbClient = createClient(supabaseUrl, supabaseSrvc, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: sub } = await sbClient
        .from("subscriptions")
        .select("status, payment_due_since")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (sub) {
        // Fetch per-tenant quarantine_days (use default 8 on error).
        let quarantineDays = 8;
        try {
          const ds = await getTenantDunningSettings(sbClient, tenantId);
          quarantineDays = ds.quarantine_days;
        } catch { /* use default */ }

        const dunning = getDunningState(
          sub.status as string,
          sub.payment_due_since as string | null,
          quarantineDays,
        );

        if (dunning.isBlocked) {
          logger.info("[snippet/decide] Service blocked — subscription unpaid", { tenantId });
          return NextResponse.json(
            { error: "Service suspended due to non-payment." },
            { status: 404, headers: CORS_HEADERS },
          );
        }

        if (dunning.isQuarantined) {
          // In quarantine: return empty slots so the site shows its default content.
          logger.info("[snippet/decide] Quarantined — returning empty slots", {
            tenantId,
            daysRemaining: dunning.daysRemaining,
          });
          return NextResponse.json(
            { slots: {}, _quarantined: true },
            { status: 200, headers: CORS_HEADERS },
          );
        }
      }
    }
  } catch (gateErr) {
    // A gate error must NEVER block service — log and continue normally.
    logger.error("[snippet/decide] Payment gate check failed — continuing", {
      tenantId, error: String(gateErr),
    });
  }

  // ── Locale resolution ──────────────────────────────────────────────────────
  const localeRaw = typeof context.locale === "string" ? context.locale : "";
  const locale    = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  // ── Mirror-demo fast path: per-demo AI-generated slots ────────────────────
  //
  //   When the Scenario Control Panel passes _demoMode=mirror + _demoId + _demoScenario,
  //   load the AI-generated scenario_slots for this specific demo from the DB and
  //   return them directly — no CMS lookup, no rule engine.
  //
  //   This is the primary path for mirror demos created after migration 128.
  //   Falls through to the DEMO_SCENARIO_PLANS CMS fallback for legacy demos.

  if (
    context._demoMode  === "mirror" &&
    typeof context._demoId       === "string" && context._demoId &&
    typeof context._demoScenario === "string" && context._demoScenario
  ) {
    try {
      const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
      const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

      if (supabaseUrl && supabaseSrvc) {
        const sbClient = createClient(supabaseUrl, supabaseSrvc, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: demoRow } = await sbClient
          .from("demo_instances")
          .select("scenario_slots, expires_at")
          .eq("id", context._demoId)
          .maybeSingle();

        if (demoRow && demoRow.scenario_slots) {
          // Validate expiry
          if (demoRow.expires_at && new Date(demoRow.expires_at) < new Date()) {
            return NextResponse.json(
              { error: "Demo has expired." },
              { status: 410, headers: CORS_HEADERS },
            );
          }

          const scenarioSlots = demoRow.scenario_slots as Record<string, Record<string, string>>;
          const slots: SlotMap = scenarioSlots[context._demoScenario] ?? {};

          logger.debug("[snippet/decide] Mirror demo fast path", {
            tenantId,
            demoId:       context._demoId,
            demoScenario: context._demoScenario,
            slotCount:    Object.keys(slots).length,
          });

          return NextResponse.json(
            { slots, _demo: true, _scenario: context._demoScenario },
            { status: 200, headers: CORS_HEADERS },
          );
        }
        // No scenario_slots in DB → fall through to DEMO_SCENARIO_PLANS legacy path
      }
    } catch (err) {
      logger.warn("[snippet/decide] Mirror demo fast path failed — falling through", {
        tenantId,
        demoId: context._demoId,
        error:  err instanceof Error ? err.message : String(err),
      });
      // Fall through to DEMO_SCENARIO_PLANS below
    }
  }

  // ── Mirror-demo scenario bypass ────────────────────────────────────────────
  //
  //   When the Scenario Control Panel sends _demoScenario + _demoMode=mirror,
  //   skip the full rule engine and use the hardcoded blueprint plan directly.
  //   This ensures instant, reliable scenario switching in sales demos.

  if (context._demoMode === "mirror") {
    // Tenants with a per-tenant demo context set (e.g. cluistra) drive a live
    // switcher from the snippet: when no (or an unknown) scenario is supplied,
    // fall back to the set's default so the first paint is a valid context, and
    // return the context list so the snippet can render the switcher.
    const demoContexts = getDemoContextSet(tenantId);
    let demoScenario = typeof context._demoScenario === "string" ? context._demoScenario : null;
    if ((!demoScenario || !DEMO_SCENARIO_PLANS[demoScenario]) && demoContexts && demoContexts.length > 0) {
      demoScenario = (demoContexts.find((c) => c.key.endsWith("_default")) ?? demoContexts[demoContexts.length - 1]).key;
    }
    const demoContextList = demoContexts
      ? demoContexts.map((c) => ({ key: c.key, label: c.label, sub: c.sub, icon: c.icon }))
      : undefined;

    // Optional second axis: a time-driven notification the prospect can toggle.
    // Defaults to the first entry so the demo always shows one.
    const demoNotifs = getDemoNotifSet(tenantId);
    const demoNotif = demoNotifs && demoNotifs.length > 0
      ? (demoNotifs.find((n) => n.key === context._demoNotif) ?? demoNotifs[0])
      : null;
    const demoNotifList = demoNotifs
      ? demoNotifs.map((n) => ({ key: n.key, label: n.label, sub: n.sub }))
      : undefined;

    const bypassPlan = demoScenario ? DEMO_SCENARIO_PLANS[demoScenario] : undefined;
    if (bypassPlan) {
      try {
        const cms = createCMSProvider(tenant.cms, tenantId, locale);
        // Snippet variants come from the platform store first (see platformFirstVariants).
        const variants = platformFirstVariants(tenantId, cms);

        const [heroData, ctaData, proofData, featureData, conversionData, notificationData] = await Promise.all([
          bypassPlan.heroKey         ? variants.getHeroVariant(bypassPlan.heroKey)               : null,
          bypassPlan.ctaKey          ? variants.getCTAVariant(bypassPlan.ctaKey)                 : null,
          bypassPlan.proofKey        ? variants.getProofVariant(bypassPlan.proofKey)             : null,
          bypassPlan.featureKey      ? variants.getFeatureVariant(bypassPlan.featureKey)         : null,
          bypassPlan.conversionKey   ? variants.getConversionVariant(bypassPlan.conversionKey)   : null,
          bypassPlan.notificationKey ? variants.getNotificationVariant(bypassPlan.notificationKey) : null,
        ]);

        const slots: SlotMap = {};

        if (heroData) {
          const hero = heroData as import("@/cms/types").HeroBlockData;
          if (hero.title)    slots["hero-title"]    = hero.title;
          if (hero.subtitle) slots["hero-subtitle"]  = hero.subtitle;
          if (hero.tag)      slots["hero-tag"]       = hero.tag;
          if (hero.ctas?.[0]) {
            if (hero.ctas[0].label) slots["hero-cta-label"] = hero.ctas[0].label;
            if (hero.ctas[0].href)  slots["hero-cta-href"]  = hero.ctas[0].href;
          }
          if (hero.ctas?.[1]) {
            if (hero.ctas[1].label) slots["hero-cta2-label"] = hero.ctas[1].label;
            if (hero.ctas[1].href)  slots["hero-cta2-href"]  = hero.ctas[1].href;
          }
        }

        if (proofData) {
          const proof = proofData as import("@/cms/types").ProofBlockData;
          if (proof.title) slots["proof-title"] = proof.title;
          proof.items?.forEach((item, i) => {
            if (item.title) slots[`proof-item-${i}-title`] = item.title;
            if (item.text)  slots[`proof-item-${i}-text`]  = item.text;
          });
        }

        if (ctaData) {
          const cta = ctaData as import("@/cms/types").CTABlockData;
          if (cta.title) slots["cta-title"] = cta.title;
          if (cta.text)  slots["cta-text"]  = cta.text;
          if (cta.cta?.label) slots["cta-cta-label"] = cta.cta.label;
          if (cta.cta?.href)  slots["cta-cta-href"]  = cta.cta.href;
        }

        if (featureData) {
          const feat = featureData as import("@/cms/types").FeatureBlockData;
          if (feat.title)    slots["feature-title"]    = feat.title;
          if (feat.subtitle) slots["feature-subtitle"] = feat.subtitle;
          feat.items?.forEach((item, i) => {
            if (item.title) slots[`feature-item-${i}-title`] = item.title;
            if (item.body)  slots[`feature-item-${i}-body`]  = item.body;
          });
        }

        if (conversionData) {
          const conv = conversionData as import("@/cms/types").ConversionBlockData;
          if (conv.title) slots["conversion-title"] = conv.title;
          if (conv.text)  slots["conversion-text"]  = conv.text;
          if (conv.ctas?.[0]) {
            if (conv.ctas[0].label) slots["conversion-cta-label"] = conv.ctas[0].label;
            if (conv.ctas[0].href)  slots["conversion-cta-href"]  = conv.ctas[0].href;
          }
          if (conv.urgencyLabel) slots["conversion-urgency-label"] = conv.urgencyLabel;
        }

        // The demo notification (time axis) is layered on top of the context and
        // wins over any notification the plan itself carried.
        const notifResult = demoNotif
          ? await variants.getNotificationVariant(demoNotif.notificationKey)
          : notificationData;

        if (notifResult) {
          const notif = notifResult as import("@/cms/types").NotificationBlockData;
          if (notif.message)  slots["notification-message"]  = notif.message;
          if (notif.severity) slots["notification-severity"] = notif.severity;
          if (notif.ctaLabel) slots["notification-cta-label"] = notif.ctaLabel;
          if (notif.ctaHref)  slots["notification-cta-href"]  = notif.ctaHref;
          slots["notification-dismissible"] = String(notif.dismissible ?? true);
          const demoNotifMedia = notificationMediaHtml(notif.media);
          if (demoNotifMedia) {
            slots["notification-media-html"] = demoNotifMedia;
            slots["notification-media-side"] = notif.mediaSide === "right" ? "right" : "left";
          }
        }

        logger.debug("[snippet/decide] Demo bypass", {
          tenantId,
          demoScenario,
          demoNotif:    demoNotif?.key,
          slotCount:    Object.keys(slots).length,
        });

        return NextResponse.json(
          {
            slots,
            _demo: true,
            _scenario: demoScenario,
            _demoContexts: demoContextList,
            _demoNotifs: demoNotifList,
            _demoNotif: demoNotif?.key,
          },
          { status: 200, headers: CORS_HEADERS },
        );
      } catch (err) {
        logger.warn("[snippet/decide] Demo bypass failed — falling through to normal pipeline", {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to normal pipeline
      }
    }
  }

  // ── Run lightweight decision pipeline ─────────────────────────────────────
  try {
    // Build a minimal Request object for buildDecisionContext
    const syntheticRequest = new Request(
      `https://${tenant.primaryDomain ?? "unknown"}${context.path ?? "/"}`,
      {
        headers: {
          "referer":    context.referrer  ?? "",
          "user-agent": request.headers.get("user-agent") ?? "",
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        },
      },
    );

    // Inject UTM params into the URL search params if present
    const syntheticUrl = new URL(syntheticRequest.url);
    if (context.utm_source)   syntheticUrl.searchParams.set("utm_source",   context.utm_source);
    if (context.utm_medium)   syntheticUrl.searchParams.set("utm_medium",   context.utm_medium);
    if (context.utm_campaign) syntheticUrl.searchParams.set("utm_campaign", context.utm_campaign);

    const decisionRequest = new Request(syntheticUrl.toString(), {
      headers: syntheticRequest.headers,
    });

    // ── Resolve the visitor/session key ───────────────────────────────────────
    //
    //   The snippet mints a stable first-party id (localStorage `mc_vid`) and
    //   sends it as sessionId (and visitorId) on every pageview. We use that id
    //   DIRECTLY as the session key so behavioural history accumulates across the
    //   whole visit. Previously this synthesised an `mc_sid=` cookie and handed it
    //   to resolveSession(), which reads `mc_session_id` — a key mismatch that
    //   silently discarded the id and minted a fresh random UUID on every single
    //   request, so nothing ever accumulated and only the default variant showed.
    //   Fall back to a server-minted id only when the client sends none/invalid.
    const stableId = normaliseVisitorId(context.sessionId)
      ?? normaliseVisitorId(context.visitorId);
    const sessionId = stableId ?? resolveSession(null).sessionId;

    // ── Record a behavioural page_view (interest-keyword capture) ─────────────
    //
    //   viewed_keywords (the cloud the interest-profile scorer reads) is
    //   otherwise only populated by PageTracker on platform-rendered pages, so
    //   snippet sites (Statamic, etc.) never build interest signals. Here we
    //   record the page's keywords: the snippet-sent CMS <meta name="keywords">
    //   plus the built-in URL→keyword map. Awaited so this page's keywords are
    //   included in the scoring below. Fail-open.
    //
    //   Recorded on EVERY pageview, not only when keywords exist: the visit
    //   count, recency and journey sequence that drive returning-visitor and
    //   journey-stage rules need a row for each page the visitor sees — including
    //   keyword-less pages. Keywords are attached when present. visitor_id carries
    //   the stable localStorage id so events link across sessions too.
    const pageMeta     = resolvePageMeta(context.path ?? "/");
    const sentKeywords = Array.isArray(context.keywords)
      ? context.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean)
      : [];
    const pageKeywords = Array.from(new Set([...sentKeywords, ...pageMeta.keywords]));
    // Behavioural capture requires consent. Without it we still resolve a variant,
    // but on geo/UTM-only signals (no journey write, no history read below).
    if (consentPersonalization && sessionId) {
      await recordJourneyEvent({
        tenantId,
        sessionId,
        visitorId:    stableId ?? undefined,
        eventType:    "page_view",
        pagePath:     context.path ?? "/",
        pageCategory: pageMeta.category ?? undefined,
        pageKeywords,
        source:       context.utm_source   ?? undefined,
        medium:       context.utm_medium   ?? undefined,
        campaign:     context.utm_campaign ?? undefined,
        eventId:      typeof context.eventId === "string" ? context.eventId : undefined,
      }).catch(() => false);
    }

    // Fetch visitor history and rules config in parallel. Without consent, skip
    // history entirely so the decision runs on geo/UTM-only signals.
    const [rawHistory, tenantRulesConfig] = await Promise.all([
      consentPersonalization
        ? fetchVisitorHistory(sessionId, tenantId).catch(() => emptyHistory())
        : Promise.resolve(emptyHistory()),
      loadTenantRulesConfig(tenantId).catch(() => null),
    ]);

    const history = rawHistory;

    const input = await buildDecisionContext({
      request:     decisionRequest,
      history,
      tenantId,
      templateKey: context.path ?? "/",
      pageType:    "cms_page",
      sessionId,
      timezone:    tenant.timezone ?? null,
      // Untrusted page-supplied attributes → sanitised and filtered to the
      // tenant's declared attributes before they can affect any rule.
      customAttributes: sanitizeCustomAttributes(context.customAttributes, tenant.customAttributes),
    });

    const experimentsEnabled = tenant.experiments?.enabled ?? true;
    const decisionProvider   = new ExperimentDecisionProvider(
      // Pass tenantId so each matched rule is recorded (fire-and-forget) — this
      // feeds the rule-fire statistics on the admin Rules page for snippet-only
      // tenants too, not just the platform-hosted path.
      // Serving exclusion: clear UA bots get the default experience (no
      // personalization). Measurement exclusion (UA OR cloud) is handled via
      // ctx.isBot in the engine / profile recorder.
      new RulesDecisionProvider(
        tenantRulesConfig ?? undefined,
        isBotUserAgent(request.headers.get("user-agent")),
        tenantId,
        sessionId,
      ),
      sessionId,
      experimentsEnabled,
      tenantId,
    );

    const plan = await decisionProvider.getHomepagePlan(input);

    // ── Fetch variant content ──────────────────────────────────────────────────
    // Adaptive variants for the snippet come from the platform store first, then
    // fall back to the tenant's own CMS (see platformFirstVariants).
    const cms      = createCMSProvider(tenant.cms, tenantId, locale);
    const variants = platformFirstVariants(tenantId, cms);

    const [heroData, ctaData, proofData, featureData, conversionData, notificationData] = await Promise.all([
      plan.heroKey         ? variants.getHeroVariant(plan.heroKey)               : null,
      plan.ctaKey          ? variants.getCTAVariant(plan.ctaKey)                 : null,
      plan.proofKey        ? variants.getProofVariant(plan.proofKey)             : null,
      plan.featureKey      ? variants.getFeatureVariant(plan.featureKey)         : null,
      plan.conversionKey   ? variants.getConversionVariant(plan.conversionKey)   : null,
      plan.notificationKey ? variants.getNotificationVariant(plan.notificationKey) : null,
    ]);

    // ── Map variant fields to slot map ─────────────────────────────────────────
    const slots: SlotMap = {};

    // ── Whole-block rendering (data-mc-block) ──────────────────────────────────
    //
    // The snippet reports which block containers exist on the page (body.blocks).
    // For each, render the chosen variant to self-contained HTML on the fly and
    // return it as a block slot — no authored blockHtml needed. The tenant's
    // active theme is forwarded as scoped CSS vars so the injected block matches
    // their look; if theme resolution fails the block still renders on its own
    // hex fallbacks.
    const rawBlocks = (body as DecideRequest).blocks;
    const requestedBlocks = new Set(
      Array.isArray(rawBlocks) ? rawBlocks.filter((b): b is string => typeof b === "string") : [],
    );
    // "Inherit host style" tenants: render blocks so the host page's own colours
    // win instead of the tenant palette (see render-block-html.ts).
    const inheritHost = tenant?.design?.inheritHostStyle === true;

    // Declarative block effects for the snippet block-mode slots. Resolution tiers
    // (instance ref -> block-type default -> tenant default) mirror the platform
    // renderer. Effect sets are only needed to resolve a named-set instance ref;
    // loaded once, non-fatal (blocks fall back to type/tenant default on failure).
    const snippetBlockTypeEffects = tenant?.design?.blockTypeEffects;
    const snippetDefaultEffects   = tenant?.design?.defaultEffects;
    let snippetEffectSets: Awaited<ReturnType<typeof listDesignEffectSets>> | undefined;
    if (requestedBlocks.size > 0) {
      try { snippetEffectSets = await listDesignEffectSets(tenantId); } catch { snippetEffectSets = undefined; }
    }

    let blockThemeTokens: Record<string, string> = {};
    if (requestedBlocks.size > 0) {
      try {
        // The FULLY resolved tenant theme — base preset PLUS the admin token-editor
        // overrides (colours, radius, fonts) from the Design tab. This is the same
        // resolution the tenant's own site uses, so the injected block matches
        // whatever the operator configured to look like their brand.
        const resolved = resolveThemeForTenant(tenant, null);
        blockThemeTokens = cssDeclarationsToRecord(resolvedThemeToCSS(resolved));
      } catch { /* fall back to the block HTML's own defaults */ }
    }
    const copyVars = effectiveCopyVariables(tenant?.copyVariables, tenant?.customAttributes);
    const emitBlockInto = (map: SlotMap, key: string, data: unknown): boolean => {
      if (!requestedBlocks.has(key)) return false;
      // Substitute {context variables} in the block copy against this visitor's
      // decision context before rendering (same behaviour as the platform path).
      const html = renderBlockHtml(key, substituteBlockCopy(data, input, copyVars), { inherit: inheritHost });
      if (!html) return false;
      const slot: BlockSlot = Object.keys(blockThemeTokens).length > 0
        ? { mode: "block", html, tokens: blockThemeTokens }
        : { mode: "block", html };
      // Declarative effects for the whole-block path — the same four-tier chain
      // the block-mode slots use (instance ref → block-type default → tenant
      // default, `disabled` kills). The block data carries its own effectRef; the
      // type default is keyed by the slot type. `fx` is applied by the snippet on
      // the injected container and animated by the shared versioned runtime; it
      // does not touch the reveal/timing mechanism (REVEAL_MS/CALL_MS).
      const effectRef = (data as { effectRef?: BlockEffectRef } | null)?.effectRef ?? null;
      const fx = resolveBlockFx(
        effectRef,
        snippetEffectSets,
        snippetBlockTypeEffects?.[key as keyof typeof snippetBlockTypeEffects],
        snippetDefaultEffects,
      );
      if (fx) slot.fx = fx;
      map[key] = slot;
      return true;
    };

    // Contextual signals shared by the cta_newsletter form and the form blocks
    // below, so a resolved form gets the same segment/Turnstile treatment.
    const formSignals = {
      path:    context.path,
      query: {
        ...(context.utm_source   ? { utm_source:   context.utm_source }   : {}),
        ...(context.utm_medium   ? { utm_medium:   context.utm_medium }   : {}),
        ...(context.utm_campaign ? { utm_campaign: context.utm_campaign } : {}),
      },
      country: request.headers.get("x-vercel-ip-country") || null,
    };

    if (heroData) {
      const hero = heroData as HeroBlockData;
      if (hero.renderMode === "block" && hero.blockHtml) {
        // Block mode: one styled block into data-mc-block="hero", tokens scoped.
        slots["hero"] = toBlockSlot(hero.blockHtml, hero.tokenRef, hero.effectRef, snippetEffectSets, snippetBlockTypeEffects?.hero, snippetDefaultEffects);
      } else if (emitBlockInto(slots, "hero", hero)) {
        // rendered as a whole block on demand
      } else {
        // Content mode (default): individual text/href slots.
        if (hero.title)    slots["hero-title"]    = hero.title;
        if (hero.subtitle) slots["hero-subtitle"]  = hero.subtitle;
        if (hero.tag)      slots["hero-tag"]       = hero.tag;
        // First CTA
        if (hero.ctas?.[0]) {
          if (hero.ctas[0].label) slots["hero-cta-label"] = hero.ctas[0].label;
          if (hero.ctas[0].href)  slots["hero-cta-href"]  = hero.ctas[0].href;
        }
        // Second CTA
        if (hero.ctas?.[1]) {
          if (hero.ctas[1].label) slots["hero-cta2-label"] = hero.ctas[1].label;
          if (hero.ctas[1].href)  slots["hero-cta2-href"]  = hero.ctas[1].href;
        }
      }
    }

    if (proofData) {
      const proof = proofData as ProofBlockData;
      if (proof.renderMode === "block" && proof.blockHtml) {
        slots["proof"] = toBlockSlot(proof.blockHtml, proof.tokenRef, proof.effectRef, snippetEffectSets, snippetBlockTypeEffects?.proof, snippetDefaultEffects);
      } else if (emitBlockInto(slots, "proof", proof)) {
        // rendered as a whole block on demand
      } else {
        if (proof.title) slots["proof-title"] = proof.title;
        proof.items?.forEach((item, i) => {
          if (item.title) slots[`proof-item-${i}-title`] = item.title;
          if (item.text)  slots[`proof-item-${i}-text`]  = item.text;
        });
      }
    }

    if (ctaData) {
      const cta = ctaData as CTABlockData;
      if (cta.renderMode === "block" && cta.blockHtml) {
        slots["cta"] = toBlockSlot(cta.blockHtml, cta.tokenRef, cta.effectRef, snippetEffectSets, snippetBlockTypeEffects?.cta, snippetDefaultEffects);
      } else if (cta.layoutVariant === "cta_newsletter") {
        // Newsletter CTA: resolve the chosen tenant form here (snippet-resolve-in-
        // decide) and render an inline signup wired like a form block. Without a
        // valid formKey it degrades to heading-only.
        let resolvedForm: import("@/forms/context/types").ResolvedForm | null = null;
        if (cta.formKey && isFormKey(cta.formKey)) {
          try { resolvedForm = await resolveContextualForm(tenantId, cta.formKey, formSignals); }
          catch { resolvedForm = null; }
        }
        const html = renderCtaNewsletter(cta, resolvedForm, { inherit: inheritHost });
        slots["cta"] = Object.keys(blockThemeTokens).length > 0
          ? { mode: "block", html, tokens: blockThemeTokens }
          : { mode: "block", html };
      } else if (emitBlockInto(slots, "cta", cta)) {
        // rendered as a whole block on demand
      } else {
        if (cta.title) slots["cta-title"] = cta.title;
        if (cta.text)  slots["cta-text"]  = cta.text;
        if (cta.cta?.label) slots["cta-cta-label"] = cta.cta.label;
        if (cta.cta?.href)  slots["cta-cta-href"]  = cta.cta.href;
      }
    }

    if (featureData) {
      const feat = featureData as FeatureBlockData;
      if (feat.renderMode === "block" && feat.blockHtml) {
        slots["feature"] = toBlockSlot(feat.blockHtml, feat.tokenRef, feat.effectRef, snippetEffectSets, snippetBlockTypeEffects?.feature, snippetDefaultEffects);
      } else if (emitBlockInto(slots, "feature", feat)) {
        // rendered as a whole block on demand
      } else {
        if (feat.title)    slots["feature-title"]    = feat.title;
        if (feat.subtitle) slots["feature-subtitle"] = feat.subtitle;
        feat.items?.forEach((item, i) => {
          if (item.title) slots[`feature-item-${i}-title`] = item.title;
          if (item.body)  slots[`feature-item-${i}-body`]  = item.body;
        });
      }
    }

    if (conversionData) {
      // book-demo has no snippet booking widget; inject a localized button to the
      // hosted /book-demo page when the author supplied no CTA (author CTA wins).
      const conv = withBookDemoFallback(
        conversionData as ConversionBlockData,
        locale,
        new URL(request.url).origin,
      );
      if (conv.renderMode === "block" && conv.blockHtml) {
        slots["conversion"] = toBlockSlot(conv.blockHtml, conv.tokenRef, conv.effectRef, snippetEffectSets, snippetBlockTypeEffects?.conversion, snippetDefaultEffects);
      } else if (emitBlockInto(slots, "conversion", conv)) {
        // rendered as a whole block on demand
      } else {
        if (conv.title) slots["conversion-title"] = conv.title;
        if (conv.text)  slots["conversion-text"]  = conv.text;
        if (conv.ctas?.[0]) {
          if (conv.ctas[0].label) slots["conversion-cta-label"] = conv.ctas[0].label;
          if (conv.ctas[0].href)  slots["conversion-cta-href"]  = conv.ctas[0].href;
        }
        if (conv.urgencyLabel) slots["conversion-urgency-label"] = conv.urgencyLabel;
      }
    }

    if (notificationData) {
      const notif = notificationData as NotificationBlockData;
      if (notif.renderMode === "block" && notif.blockHtml) {
        slots["notification"] = toBlockSlot(notif.blockHtml, notif.tokenRef, notif.effectRef, snippetEffectSets, snippetBlockTypeEffects?.notification, snippetDefaultEffects);
      } else if (emitBlockInto(slots, "notification", notif)) {
        // rendered as a whole block on demand
      } else {
        if (notif.message)       slots["notification-message"]         = notif.message;
        if (notif.severity)      slots["notification-severity"]        = notif.severity;
        if (notif.ctaLabel)      slots["notification-cta-label"]       = notif.ctaLabel;
        if (notif.ctaHref)       slots["notification-cta-href"]        = notif.ctaHref;
        if (notif.position)      slots["notification-position"]        = notif.position;
        slots["notification-dismissible"]   = String(notif.dismissible ?? true);
        if (notif.autoDismissMs !== undefined) {
          slots["notification-auto-dismiss-ms"] = String(notif.autoDismissMs);
        }
        // Frequency-capping inputs for the snippet (same key scheme as the
        // platform NotificationBlock). ttl is pre-resolved to ms server-side.
        if (notif.id)         slots["notification-id"]        = notif.id;
        if (notif.frequency)  slots["notification-frequency"] = notif.frequency;
        if (notif.campaignId) slots["notification-campaign"]  = notif.campaignId;
        const notifTtlMs = ttlToMs(notif.ttl, notif.ttlUnit);
        if (notifTtlMs > 0)   slots["notification-ttl-ms"]    = String(notifTtlMs);
        // Media (image / video facade) for the client-toast path, mirroring the
        // block-HTML renderNotification. The snippet injects this into the
        // [data-mc-notification] host, positioned by notification-media-side.
        const notifMediaHtml = notificationMediaHtml(notif.media);
        if (notifMediaHtml) {
          slots["notification-media-html"] = notifMediaHtml;
          slots["notification-media-side"] = notif.mediaSide === "right" ? "right" : "left";
        }
      }
    }

    // ── Form blocks (data-mc-block="form:<key>") ───────────────────────────────
    // Render a working, contextual <form> per requested form block. The snippet
    // wires the cross-origin submit; here we only produce the styled markup with
    // the tenant's theme tokens and the segment-resolved copy/fields.
    const formBlockKeys = [...requestedBlocks].filter((k) => k.startsWith("form:"));
    if (formBlockKeys.length > 0) {
      for (const blockKey of formBlockKeys) {
        const formKey = blockKey.slice("form:".length).trim();
        if (!isFormKey(formKey)) continue;
        try {
          // Base: phase-1 contextual resolution (Turnstile + override layout +
          // base/segment fields).
          const baseForm = await resolveContextualForm(tenantId, formKey, formSignals);
          if (!baseForm) continue;

          // If a rule targeted a form variant for this type, merge it on top of
          // the base — variant copy/layout/fields win; Turnstile and the
          // fallback layout come from the base. When no rule targeted a variant
          // (the common case), the base is served unchanged.
          let resolved = baseForm;
          const variantKey = tenantId ? plan.formVariants?.[formKey] : undefined;
          if (tenantId && variantKey) {
            const variant = await loadFormVariant(tenantId, formKey, variantKey);
            if (variant) {
              const def = getFormDefinition(formKey);
              resolved = {
                ...baseForm,
                title:          variant.title          ?? baseForm.title,
                intro:          variant.intro          ?? baseForm.intro,
                submitLabel:    variant.submitLabel    ?? baseForm.submitLabel,
                successMessage: variant.successMessage ?? baseForm.successMessage,
                redirectPath:   variant.redirectPath   ?? baseForm.redirectPath,
                ...(variant.layout ? { layout: variant.layout } : {}),
                fields: (def && variant.fields?.length)
                  ? resolvePresentedFields(def.fields, variant.fields)
                  : baseForm.fields,
                segment: variantKey,
              };
            }
          }

          const html = renderForm(resolved, formKey, { inherit: inheritHost });
          slots[blockKey] = Object.keys(blockThemeTokens).length > 0
            ? { mode: "block", html, tokens: blockThemeTokens }
            : { mode: "block", html };
        } catch { /* skip this form block on error */ }
      }
    }

    logger.debug("[snippet/decide] Resolved", {
      tenantId,
      sessionId,
      heroKey:          plan.heroKey,
      ctaKey:           plan.ctaKey,
      proofKey:         plan.proofKey,
      featureKey:       plan.featureKey,
      conversionKey:    plan.conversionKey,
      notificationKey:  plan.notificationKey,
      slotCount: Object.keys(slots).length,
    });

    return NextResponse.json(
      { slots, ...(selectorMap ? { selectors: selectorMap } : {}) },
      { status: 200, headers: CORS_HEADERS },
    );

  } catch (err) {
    logger.error("[snippet/decide] Decision pipeline failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return empty slots — snippet will display original CMS content
    return NextResponse.json(
      { slots: {} },
      { status: 200, headers: CORS_HEADERS },
    );
  }
}
