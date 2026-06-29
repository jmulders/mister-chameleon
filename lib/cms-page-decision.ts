/**
 * CMS Page Decision Helper
 *
 * Runs a lightweight personalisation pipeline for CMS slug pages.
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 *   Resolves the active visitor's experience plan by running the rule engine,
 *   experiment assignments, and (optionally) AI — then applies the resulting
 *   variant keys to the page's context slots so TemplateRenderer uses
 *   engine-resolved keys instead of CMS fallback keys.
 *
 *   Scenario overrides (from the ScenarioControlPanel dev tool) are applied
 *   via the same two-pass pattern used by the homepage:
 *     Pass 1 — patches VisitorHistory BEFORE buildDecisionContext
 *     Pass 2 — patches RuleEvaluationContext AFTER buildDecisionContext
 *   When no scenario cookie is present both passes are no-ops (zero overhead).
 *
 * ─── What this intentionally SKIPS ───────────────────────────────────────────
 *
 *   The expensive enrichment pipeline from the homepage is NOT run here:
 *     • MaxMind GeoIP        — DB lookup (~5 ms, cold)
 *     • IPinfo Lite          — external API
 *     • Reverse Geocode      — external API
 *     • Weather              — external API
 *     • OpenKvK              — external API
 *     • Leadinfo             — client-side, runs in-browser
 *     • HubSpot CRM          — external API
 *     • GA4 Analytics Hist.  — external API
 *
 *   Why: CMS pages are rendered for every slug, including pages with no or
 *   minimal adaptive slots (blog posts, docs, legal pages).  Running the full
 *   enrichment pipeline on every such page would waste budget and latency.
 *
 *   What IS available without enrichment:
 *     • First-party behavioural history (page views, events, scores)
 *     • Session signals (UTM, referrer, device type, path)
 *     • IP-level classification cached from a prior homepage visit
 *     • Audience segment membership derived from stored history
 *     • Scenario overrides (dev tool)
 *
 *   This is sufficient for rule-based personalisation (e.g. "returning visitor
 *   with high engagement → proof variant focused on social trust").
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   ```ts
 *   // In app/(site)/[slug]/page.tsx:
 *   const pageConfig  = mapPageDataToPageConfig(page);
 *   const resolved    = await resolveSlugPageConfig(
 *     request, cookieHeader, slug, pageConfig, tenant, tenantId
 *   );
 *   return <TemplateRenderer pageConfig={resolved} />;
 *   ```
 *
 * ─── Graceful degradation ─────────────────────────────────────────────────────
 *
 *   Every failure path returns the original `pageConfig` unchanged so the page
 *   renders with CMS fallback keys rather than erroring.
 */

import fs   from "fs";
import path from "path";

import { resolveSession }          from "@/data/session";
import { fetchVisitorHistory }     from "@/context/fetch-visitor-history";
import {
  RulesDecisionProvider,
  ExperimentDecisionProvider,
  DEFAULT_CONFIDENCE_POLICY,
}                                  from "@/decision";
import { loadTenantRulesConfig }   from "@/decision/rules/load-tenant-rules";
import type { StoredRulesConfig }  from "@/decision/rules/stored-rule"; // used by _fileRulesConfig
import { fetchVariantCatalogue }   from "@/decision/rules/fetch-variant-catalogue";
import { buildDecisionContext }    from "@/decision/context/build-decision-context";
import {
  resolveActiveKnownLead,
  injectKnownLeadContext,
  forceKnownLeadSegment,
} from "@/lib/abm/apply-known-lead";
import { recordVisitorProfile, abmLeadToPerson } from "@/lib/lead-base/record-visitor-profile";
import { after }                     from "next/server";
import { getTenantAiRuntimeConfig } from "@/ai/config";
import { createAiProvider }        from "@/ai/providers/create-ai-provider";
import { AiDecisionProvider }      from "@/decision/providers/ai-decision-provider";
import { ShadowAiDecisionProvider } from "@/decision/providers/shadow-ai-decision-provider";
import {
  parseScenarioCookie,
  applyScenarioToHistory,
  applyScenarioToDecisionContext,
}                                  from "@/lib/scenario/server-scenario";
import { evaluateAudienceSegments } from "@/audience-segments/evaluate";
import { applyAudienceSegments }    from "@/decision/decision-context";
import type { DecisionProvider }   from "@/decision/providers/decision-provider";
import type { ExperiencePlan }     from "@/decision/types";
import type { PageConfig, ResolvedContextSlot } from "@/page-config";
import type { TenantSettings }     from "@/tenant/types";
import { logger }                  from "@/lib/logger";
import { buildTokenContextFromInput, type TokenContext } from "@/lib/tokens/parse-tokens";
import { getDemoScenarioPlan, getSegmentDemoPlan } from "@/lib/demo/demo-scenario-plans";

// ── File-based pageBannerKey resolver ─────────────────────────────────────────
//
// Resolves `pageBannerKey` by evaluating the conditions in runtime-rules.json
// against the current decision input.
//
// This is intentionally independent of the DB rule IDs.  DB rules are seeded
// from `generatePresetRulesConfig` which gives them IDs like `preset.google_campaign`.
// The runtime-rules.json file uses different IDs (`homepage.google`, etc.).
// Matching by rule ID therefore never works for preset-based tenants.
//
// Instead we instantiate a fresh RulesDecisionProvider from the file config and
// run getHomepagePlan() against the same input.  Because the file-based provider
// has been built specifically with pageBannerKey values on every rule and on the
// defaultPlan, the returned plan is guaranteed to carry a pageBannerKey.
//
// The file is read once per server process and memoized in `_fileRulesConfig`.

const RUNTIME_RULES_PATH = path.join(
  process.cwd(),
  "decision",
  "rules",
  "runtime-rules.json",
);

let _fileRulesConfig: StoredRulesConfig | null | undefined; // undefined = not yet loaded

function loadFileRulesConfig(): StoredRulesConfig | null {
  if (_fileRulesConfig !== undefined) return _fileRulesConfig;
  try {
    const raw = fs.readFileSync(RUNTIME_RULES_PATH, "utf8");
    _fileRulesConfig = JSON.parse(raw) as StoredRulesConfig;
  } catch {
    _fileRulesConfig = null;
  }
  return _fileRulesConfig;
}

/**
 * Derives the appropriate `pageBannerKey` for the current visitor by evaluating
 * runtime-rules.json conditions against the decision input.
 *
 * Returns undefined only when the file cannot be read or the provider throws —
 * both are silent failures; the hero slot keeps the CMS page-specific fallback.
 */
async function resolvePageBannerKey(
  input: Parameters<RulesDecisionProvider["getHomepagePlan"]>[0],
): Promise<string | undefined> {
  const config = loadFileRulesConfig();
  if (!config) return undefined;
  try {
    const provider = new RulesDecisionProvider(config);
    const plan = await provider.getHomepagePlan(input);
    return plan.pageBannerKey;
  } catch {
    return undefined;
  }
}

// ── Slot → plan key mapping ────────────────────────────────────────────────────

/**
 * Maps an ExperiencePlan to the variant key for a given slot ID.
 * Returns undefined when the plan has no key for that slot
 * (e.g. plan has no featureKey / conversionKey defined).
 */
function planKeyForSlot(plan: ExperiencePlan, slotId: string): string | undefined {
  switch (slotId) {
    case "hero":         return plan.heroKey         ?? undefined;
    case "proof":        return plan.proofKey        ?? undefined;
    case "cta":          return plan.ctaKey          ?? undefined;
    case "notification": return plan.notificationKey ?? undefined;
    case "feature":      return ((plan as unknown) as Record<string, unknown>).featureKey    as string | undefined;
    case "conversion":   return ((plan as unknown) as Record<string, unknown>).conversionKey as string | undefined;
    default:             return undefined;
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Result returned by `resolveSlugPageConfig`.
 *
 * `pageConfig`   — PageConfig with engine-resolved variantKeys on each active
 *                  context slot (or the original CMS fallback config on error).
 * `tokenContext` — Token substitution context built from the request-level signals
 *                  (device, source, UTMs, enrichment).  Null when the fast path is
 *                  taken (no context slots) or when the pipeline errors out.
 *                  Pass to `<TemplateRenderer tokenContext={…} />` so merge tags
 *                  like `{{device}}`, `{{company_short}}`, `{{source}}` resolve
 *                  correctly in variant copy on inner CMS pages.
 */
export interface SlugPageConfigResult {
  pageConfig:   PageConfig;
  tokenContext: TokenContext | null;
}

/**
 * Run the lightweight decision pipeline for a CMS slug page and return a
 * PageConfig with engine-resolved variantKeys on each active context slot,
 * plus a TokenContext for merge-tag substitution in variant copy.
 *
 * When the page has no context slots, or when the pipeline fails, the original
 * `pageConfig` is returned unchanged — the page will render with CMS fallback
 * keys as before, with zero performance impact.
 *
 * @param request       The incoming Next.js Request object (for IP / UA detection)
 * @param cookieHeader  Raw Cookie header string (from `headers().get("cookie")`)
 * @param slug          The page slug, used as a tracing label
 * @param pageConfig    The CMS-assembled PageConfig (output of mapPageDataToPageConfig)
 * @param tenant        Loaded TenantSettings record (may be null for new tenants)
 * @param tenantId      Canonical tenant identifier string
 */
export async function resolveSlugPageConfig(
  request:      Request,
  cookieHeader: string | null,
  slug:         string,
  pageConfig:   PageConfig,
  tenant:       TenantSettings | null,
  tenantId:     string,
): Promise<SlugPageConfigResult> {
  // ── Fast path: skip engine when page has no context slots ──────────────────
  //
  // Most CMS pages (blog posts, docs, legal) have no adaptive slots at all.
  // Skip the entire pipeline rather than burning latency + credits.
  if (pageConfig.contextSlots.length === 0) {
    return { pageConfig, tokenContext: null };
  }

  try {
    // ── Session resolution ────────────────────────────────────────────────────
    const { sessionId } = resolveSession(cookieHeader);

    // ── Scenario overrides ────────────────────────────────────────────────────
    //
    // The ScenarioControlPanel (client-side, dev-only) writes a `mc_scenario`
    // cookie whenever a preset is activated.  We parse it here so the same
    // scenario-driven variant switching that works on the homepage also works
    // on every CMS slug page.
    //
    // Two-pass application (mirrors homepage pattern):
    //   Pass 1 — applyScenarioToHistory patches VisitorHistory fields
    //            (journey stage, intent score, page views, etc.) BEFORE they
    //            enter buildDecisionContext.  The rule engine then evaluates the
    //            patched history as if the visitor actually had those signals.
    //   Pass 2 — applyScenarioToDecisionContext patches the enrichment /
    //            request-level fields (visitType, UTM, company, geo, interests)
    //            that buildDecisionContext assembles from HTTP + enrichment APIs.
    //
    // When no scenario cookie is present, both calls are pure no-ops (zero
    // overhead — no branch taken, no allocation).
    const scenarioOverrides = parseScenarioCookie(cookieHeader);

    // ── Parallel DB fetches ───────────────────────────────────────────────────
    //
    // Load visitor history and rules config concurrently — both are needed for
    // buildDecisionContext and the rules provider respectively.
    const [rawHistory, tenantRulesConfig] = await Promise.all([
      fetchVisitorHistory(sessionId, tenantId),
      (async () => {
        try {
          const catalogue = await fetchVariantCatalogue(tenantId);
          const extraKeys = {
            heroKeys:  catalogue.hero.filter((e) => e.source !== "platform").map((e) => e.key),
            proofKeys: catalogue.proof.filter((e) => e.source !== "platform").map((e) => e.key),
            ctaKeys:   catalogue.cta.filter((e) => e.source !== "platform").map((e) => e.key),
          };
          return await loadTenantRulesConfig(tenantId, extraKeys);
        } catch {
          return null;
        }
      })(),
    ]);

    // Pass 1: patch history with scenario overrides before it enters the context builder.
    const history = scenarioOverrides
      ? applyScenarioToHistory(rawHistory, scenarioOverrides)
      : rawHistory;

    // ── Decision provider stack ───────────────────────────────────────────────
    //
    // Rules → Experiments → (optionally) AI — mirrors the homepage stack but
    // without the enrichment pipeline.
    const experimentsEnabled = tenant?.experiments?.enabled ?? true;
    const baseDecisionProvider = new ExperimentDecisionProvider(
      new RulesDecisionProvider(tenantRulesConfig ?? undefined),
      sessionId,
      experimentsEnabled,
      tenantId,
    );

    // AI layer — same mode resolution as the homepage.
    const aiConfig = getTenantAiRuntimeConfig(tenant);
    const aiPolicy = { ...DEFAULT_CONFIDENCE_POLICY, minConfidence: aiConfig.confidenceThreshold };

    let decisionProvider: DecisionProvider = baseDecisionProvider;

    if (aiConfig.mode === "shadow") {
      try {
        const aiProvider = createAiProvider(aiConfig.shadowProvider);
        decisionProvider = new ShadowAiDecisionProvider(
          baseDecisionProvider,
          aiProvider,
          sessionId,
          aiPolicy,
          tenantId,
        );
      } catch (err) {
        logger.warn("[cms-page-decision] Failed to construct ShadowAiDecisionProvider; using base", {
          slug, tenantId, error: err instanceof Error ? err.message : String(err),
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
          tenantId,
        );
      } catch (err) {
        logger.warn("[cms-page-decision] Failed to construct AiDecisionProvider; using base", {
          slug, tenantId, error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Decision context (no enrichment pipeline) ─────────────────────────────
    //
    // Omitting `stagedEnrichers` skips the entire enrichment stage.
    // The decision context will still contain session signals, device type,
    // UTM params, referrer, and all stored behavioral history.
    const rawInput = await buildDecisionContext({
      request,
      history,
      tenantId,
      templateKey: slug,
      pageType:    "cms_page",
      sessionId,
      timezone:    tenant?.timezone ?? null,
    });

    // Pass 2: patch the enrichment / request-level fields with scenario overrides.
    const postScenarioInput = scenarioOverrides
      ? applyScenarioToDecisionContext(rawInput, scenarioOverrides)
      : rawInput;

    // ── ABM known-lead — phase 1: firmographics BEFORE segment evaluation ─────
    // A lead's personalized URL can target any page (e.g. /pricing), so fold the
    // lead into this page's context too. Inject firmographics first so segments
    // defined on them auto-match. Fail-open: any error → normal personalization.
    const leadCookie = (request.headers.get("cookie") ?? "")
      .split(";").map((c) => c.trim())
      .find((c) => c.startsWith("mc_lead="))
      ?.slice("mc_lead=".length);
    let abmLead: Awaited<ReturnType<typeof resolveActiveKnownLead>> = null;
    try {
      abmLead = await resolveActiveKnownLead(leadCookie ? decodeURIComponent(leadCookie) : undefined);
      if (abmLead) {
        injectKnownLeadContext(
          postScenarioInput as unknown as import("@/decision/decision-context").DecisionContext,
          abmLead,
        );
      }
    } catch {
      // ignore — normal personalization continues
    }

    // ── Audience segment evaluation ───────────────────────────────────────────
    // Same pattern as homepage-pipeline: run after all overrides + known-lead
    // firmographics are applied.
    // Skip DB evaluation when the scenario has explicitly set audienceSegmentIds.
    const input = scenarioOverrides?.audienceSegmentIds !== undefined
      ? postScenarioInput
      : applyAudienceSegments(
          postScenarioInput as unknown as import("@/decision/decision-context").DecisionContext,
          await evaluateAudienceSegments(postScenarioInput, tenantId),
        ) as typeof postScenarioInput;

    // ── ABM known-lead — phase 2: force the explicitly-linked segment ─────────
    // After applyAudienceSegments (which replaces the id set), fold in the lead's
    // explicit segment_hint on top of any auto-matched segments. Fail-open.
    if (abmLead) {
      try {
        forceKnownLeadSegment(
          input as unknown as import("@/decision/decision-context").DecisionContext,
          abmLead,
        );
      } catch {
        // ignore — normal personalization continues
      }
    }

    // ── Lead Base — persist the profile on non-homepage pages too ─────────────
    // Same recorder as the homepage pipeline; runs post-response, fail-open. Keeps
    // the profile fresh (last seen, behaviour, segments) and links named leads on
    // any page with adaptive slots. See docs/lead-base-design.md.
    after(async () => {
      await recordVisitorProfile({
        tenantId,
        visitorKey:   sessionId,
        cookieHeader,
        ctx:          input as unknown as import("@/decision/decision-context").DecisionContext,
        abmLeadId:    abmLead?.id ?? null,
        person:       abmLeadToPerson(abmLead?.profile),
      });
    });

    // ── Get experience plan from decision engine ───────────────────────────────
    //
    // When a _scenarioKey is present (set by ScenarioControlPanel after a demo
    // flow completes, or when a preset is manually activated), bypass the rule
    // engine entirely and return the hardcoded demo plan for that stage.
    //
    // This mirrors the same bypass used in homepage-pipeline.ts and ensures
    // scenario switching produces visible variant changes on inner CMS pages
    // (e.g. /features, /pricing, /about) — not just on the homepage.
    //
    // Without this, inner pages always call the rule engine which returns the
    // default plan when no matching rules are configured, so the page never
    // adapts regardless of the active scenario.
    const demoPlan = getDemoScenarioPlan(scenarioOverrides?._scenarioKey)
      ?? getSegmentDemoPlan(scenarioOverrides?.audienceSegmentIds);
    const effectiveDecisionProvider: DecisionProvider = demoPlan
      ? { getHomepagePlan: async () => demoPlan }
      : decisionProvider;

    if (demoPlan) {
      logger.debug("[cms-page-decision] Demo scenario bypass active", {
        slug,
        tenantId,
        scenarioKey: scenarioOverrides?._scenarioKey,
        segmentIds:  scenarioOverrides?.audienceSegmentIds,
        heroKey:     demoPlan.heroKey,
        ctaKey:      demoPlan.ctaKey,
      });
    }

    const plan: ExperiencePlan = await effectiveDecisionProvider.getHomepagePlan(input);

    // ── Resolve pageBannerKey for the hero slot ────────────────────────────────
    //
    // DB rules (seeded as preset rules with IDs like `preset.google_campaign`)
    // don't carry a `pageBannerKey` because they predate the field.  Even if
    // they did, their IDs differ from the runtime-rules.json IDs so any
    // ID-based enrichment would silently produce nothing.
    //
    // Instead: when the DB-sourced plan has no `pageBannerKey`, we derive one
    // by running the runtime-rules.json conditions against the same input.
    // This is visitor-signal-driven (same UTM, history, interest signals) so
    // the correct adaptive variant is always selected regardless of which rule
    // set is stored in the DB.
    const resolvedBannerKey: string | undefined =
      plan.pageBannerKey ?? await resolvePageBannerKey(input);

    // ── Apply plan variant keys to context slots ───────────────────────────────
    //
    // Replace each slot's CMS fallback variantKey with the engine-resolved key.
    //
    // Guard: only override slots whose CMS contextConfig gave them a non-null
    // fallback key.  A null variantKey means the CMS author intentionally
    // omitted that slot on this page (e.g. a blog post using `landing-page`
    // template that only defines a CTA, not a hero).  Without this guard,
    // the engine would inject a hero onto every page whose plan has a heroKey,
    // even pages where the author deliberately left the hero slot empty.
    const updatedSlots: ResolvedContextSlot[] = pageConfig.contextSlots.map((slot) => {
      if (slot.variantKey === null) return slot;  // CMS opted this slot out — respect it

      // ── Hero slot ─────────────────────────────────────────────────────────────
      //
      // CMS inner pages use compact page-banner hero variants (hero_page_banner_*).
      // These must NOT be replaced by the homepage-scale hero variants that the
      // rule engine's heroKey targets (e.g. hero_direct_brand, hero_background).
      //
      // Resolution order for the hero slot on CMS pages:
      //   1. resolvedBannerKey   — visitor-adaptive compact banner from rule engine
      //   2. slot.variantKey     — page-specific fallback set by the CMS author
      if (slot.slotId === "hero") {
        return resolvedBannerKey ? { ...slot, variantKey: resolvedBannerKey } : slot;
      }

      const engineKey = planKeyForSlot(plan, slot.slotId);
      return engineKey ? { ...slot, variantKey: engineKey } : slot;
    });

    logger.debug("[cms-page-decision] Plan resolved", {
      slug,
      tenantId,
      sessionId,
      scenarioActive: !!scenarioOverrides,
      plan,
      updatedSlotCount: updatedSlots.filter((s, i) =>
        s.variantKey !== pageConfig.contextSlots[i]?.variantKey
      ).length,
    });

    // Build a TokenContext from the decision input so that merge tags like
    // {{device}}, {{company_short}}, {{source}}, {{campaign}} etc. resolve
    // correctly in variant copy rendered by TemplateRenderer on inner pages.
    const tokenContext = buildTokenContextFromInput(input);

    return { pageConfig: { ...pageConfig, contextSlots: updatedSlots }, tokenContext };

  } catch (err) {
    // Always degrade gracefully — return the original CMS fallback config.
    logger.warn("[cms-page-decision] Pipeline failed; using CMS fallback keys", {
      slug,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { pageConfig, tokenContext: null };
  }
}
