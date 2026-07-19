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
import { resolveSession }            from "@/data/session";
import { fetchVisitorHistory }       from "@/context/fetch-visitor-history";
import { emptyHistory }              from "@/context/visitor-history";
import {
  RulesDecisionProvider,
  ExperimentDecisionProvider,
}                                    from "@/decision";
import { loadTenantRulesConfig }     from "@/decision/rules/load-tenant-rules";
import { buildDecisionContext }      from "@/decision/context/build-decision-context";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/lib/locale";
import type { TenantSettings }       from "@/tenant/types";
import type { HeroBlockData, CTABlockData, ProofBlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData } from "@/cms/types";
import { getDunningState }           from "@/billing/dunning";
import { getTenantDunningSettings }  from "@/billing/dunning";
import { logger }                    from "@/lib/logger";
import { recordJourneyEvent }        from "@/lib/journey/record-event";
import { resolvePageMeta }           from "@/tracking/page-meta-map";
import { sanitizeSelectorMap }       from "@/lib/snippet/decide-response";
import type { SlotMap }              from "@/lib/snippet/decide-response";
import { toBlockSlot }               from "@/lib/snippet/block-slot";

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
  context?: {
    path?:           string;
    referrer?:       string;
    utm_source?:     string;
    utm_medium?:     string;
    utm_campaign?:   string;
    sessionId?:      string;
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

  const tenantId = tenant.tenantId;

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

  if (context._demoMode === "mirror" && typeof context._demoScenario === "string") {
    const bypassPlan = DEMO_SCENARIO_PLANS[context._demoScenario];
    if (bypassPlan) {
      try {
        const cms = createCMSProvider(tenant.cms, tenantId, locale);

        const [heroData, ctaData, proofData, featureData, conversionData, notificationData] = await Promise.all([
          bypassPlan.heroKey         ? cms.getHeroVariant(bypassPlan.heroKey).catch(() => null)               : null,
          bypassPlan.ctaKey          ? cms.getCTAVariant(bypassPlan.ctaKey).catch(() => null)                 : null,
          bypassPlan.proofKey        ? cms.getProofVariant(bypassPlan.proofKey).catch(() => null)             : null,
          bypassPlan.featureKey      ? cms.getFeatureVariant(bypassPlan.featureKey).catch(() => null)         : null,
          bypassPlan.conversionKey   ? cms.getConversionVariant(bypassPlan.conversionKey).catch(() => null)   : null,
          bypassPlan.notificationKey ? cms.getNotificationVariant(bypassPlan.notificationKey).catch(() => null) : null,
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

        if (notificationData) {
          const notif = notificationData as import("@/cms/types").NotificationBlockData;
          if (notif.message)  slots["notification-message"]  = notif.message;
          if (notif.severity) slots["notification-severity"] = notif.severity;
          if (notif.ctaLabel) slots["notification-cta-label"] = notif.ctaLabel;
          if (notif.ctaHref)  slots["notification-cta-href"]  = notif.ctaHref;
          slots["notification-dismissible"] = String(notif.dismissible ?? true);
        }

        logger.debug("[snippet/decide] Demo bypass", {
          tenantId,
          demoScenario: context._demoScenario,
          slotCount:    Object.keys(slots).length,
        });

        return NextResponse.json(
          { slots, _demo: true, _scenario: context._demoScenario },
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

    // Synthesise a cookie header for session resolution
    const sessionCookie = context.sessionId
      ? `mc_sid=${context.sessionId}`
      : "";
    const { sessionId } = resolveSession(sessionCookie || null);

    // ── Record a behavioural page_view (interest-keyword capture) ─────────────
    //
    //   viewed_keywords (the cloud the interest-profile scorer reads) is
    //   otherwise only populated by PageTracker on platform-rendered pages, so
    //   snippet sites (Statamic, etc.) never build interest signals. Here we
    //   record the page's keywords: the snippet-sent CMS <meta name="keywords">
    //   plus the built-in URL→keyword map. Awaited so this page's keywords are
    //   included in the scoring below. Fail-open.
    const pageMeta     = resolvePageMeta(context.path ?? "/");
    const sentKeywords = Array.isArray(context.keywords)
      ? context.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean)
      : [];
    const pageKeywords = Array.from(new Set([...sentKeywords, ...pageMeta.keywords]));
    if (sessionId && pageKeywords.length > 0) {
      await recordJourneyEvent({
        tenantId,
        sessionId,
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

    // Fetch visitor history and rules config in parallel
    const [rawHistory, tenantRulesConfig] = await Promise.all([
      fetchVisitorHistory(sessionId, tenantId).catch(() => emptyHistory()),
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
    });

    const experimentsEnabled = tenant.experiments?.enabled ?? true;
    const decisionProvider   = new ExperimentDecisionProvider(
      new RulesDecisionProvider(tenantRulesConfig ?? undefined),
      sessionId,
      experimentsEnabled,
      tenantId,
    );

    const plan = await decisionProvider.getHomepagePlan(input);

    // ── Fetch variant content from CMS ─────────────────────────────────────────
    const cms = createCMSProvider(tenant.cms, tenantId, locale);

    const [heroData, ctaData, proofData, featureData, conversionData, notificationData] = await Promise.all([
      plan.heroKey         ? cms.getHeroVariant(plan.heroKey).catch(() => null)               : null,
      plan.ctaKey          ? cms.getCTAVariant(plan.ctaKey).catch(() => null)                 : null,
      plan.proofKey        ? cms.getProofVariant(plan.proofKey).catch(() => null)             : null,
      plan.featureKey      ? cms.getFeatureVariant(plan.featureKey).catch(() => null)         : null,
      plan.conversionKey   ? cms.getConversionVariant(plan.conversionKey).catch(() => null)   : null,
      plan.notificationKey ? cms.getNotificationVariant(plan.notificationKey).catch(() => null) : null,
    ]);

    // ── Map variant fields to slot map ─────────────────────────────────────────
    const slots: SlotMap = {};

    if (heroData) {
      const hero = heroData as HeroBlockData;
      if (hero.renderMode === "block" && hero.blockHtml) {
        // Block mode: one styled block into data-mc-block="hero", tokens scoped.
        slots["hero"] = toBlockSlot(hero.blockHtml, hero.tokenRef);
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
        slots["proof"] = toBlockSlot(proof.blockHtml, proof.tokenRef);
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
        slots["cta"] = toBlockSlot(cta.blockHtml, cta.tokenRef);
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
        slots["feature"] = toBlockSlot(feat.blockHtml, feat.tokenRef);
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
      const conv = conversionData as ConversionBlockData;
      if (conv.title) slots["conversion-title"] = conv.title;
      if (conv.text)  slots["conversion-text"]  = conv.text;
      if (conv.ctas?.[0]) {
        if (conv.ctas[0].label) slots["conversion-cta-label"] = conv.ctas[0].label;
        if (conv.ctas[0].href)  slots["conversion-cta-href"]  = conv.ctas[0].href;
      }
      if (conv.urgencyLabel) slots["conversion-urgency-label"] = conv.urgencyLabel;
    }

    if (notificationData) {
      const notif = notificationData as NotificationBlockData;
      if (notif.message)       slots["notification-message"]         = notif.message;
      if (notif.severity)      slots["notification-severity"]        = notif.severity;
      if (notif.ctaLabel)      slots["notification-cta-label"]       = notif.ctaLabel;
      if (notif.ctaHref)       slots["notification-cta-href"]        = notif.ctaHref;
      if (notif.position)      slots["notification-position"]        = notif.position;
      slots["notification-dismissible"]   = String(notif.dismissible ?? true);
      if (notif.autoDismissMs !== undefined) {
        slots["notification-auto-dismiss-ms"] = String(notif.autoDismissMs);
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
