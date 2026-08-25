import "server-only";

/**
 * Contextual gallery-preset block tokens (item 6).
 *
 * When a theme rule / session lock selects a GALLERY preset, `app/layout` injects
 * its complete look into the [data-site] theme layers. But the site-wide block
 * tokens (design.defaultTokens, emitted at the "site-default" block scope by
 * TemplateRenderer) still come from the tenant's LAST-APPLIED preset — which would
 * mask the injected preset on hero/cta/card blocks.
 *
 * This helper resolves the SAME contextual gallery selection and returns the
 * block tokens that preset would derive on apply (blockTokensFromOverrides — the
 * exact derivation buildCompleteLookDesign uses, plus the Aurora hand-tuned
 * example), so TemplateRenderer can use them instead of the stored defaultTokens.
 *
 * It is wrapped in React.cache() so it computes once per request and stays
 * consistent with app/layout even on the first request (no mc_theme cookie race).
 * The context-building here mirrors app/layout's theme decision.
 */

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { buildTimeContext } from "@/context/time";
import { emptyHistory } from "@/context/visitor-history";
import { parseScenarioCookie, applyScenarioToDecisionContext } from "@/lib/scenario/server-scenario";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { resolveThemeDecision } from "@/decision/theme-decision";
import { readThemeSessionSelection } from "@/lib/theme-session";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { getDesignPreset } from "@/tenant/design-presets-gallery";
import { blockTokensFromOverrides } from "@/design-system/theme/preset-to-block-tokens";
import { isThemePresetKey } from "@/design-system/theme/presets";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import type { CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";

/**
 * Returns the site-wide block tokens for the contextually-selected gallery preset,
 * or null when no gallery preset is contextually active (curated / default / no
 * rule / edit mode). Never throws.
 */
export const getContextualGalleryDefaultTokens = cache(async (): Promise<CuratedBlockTokens | null> => {
  try {
    const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);

    // Edit mode: skip the personalisation pipeline (same as app/layout).
    if (process.env.NODE_ENV === "development" && cookieStore.get(DEV_TENANT_COOKIE)?.value) return null;

    const { tenantId } = await getActiveTenant();
    if (!tenantId) return null;
    const settings = await getTenantById(tenantId);

    const ua        = headersList.get("user-agent") ?? "";
    const timezone  = settings?.timezone ?? "UTC";
    const device    = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" as const : "desktop" as const;
    const utmSource   = headersList.get("x-mc-utm-source")   || null;
    const utmMedium   = headersList.get("x-mc-utm-medium")   || null;
    const utmCampaign = headersList.get("x-mc-utm-campaign") || null;
    const utmContent  = headersList.get("x-mc-utm-content")  || null;
    const utmTerm     = headersList.get("x-mc-utm-term")     || null;
    const visitType   = cookieStore.get("mc_seen")?.value === "1" ? "returning" as const : "new" as const;
    const timeCtx     = buildTimeContext(new Date(), timezone);

    const themeCtx: RuleEvaluationContext = {
      source: "direct", device, visitType, rawReferrer: null, referrerDomain: null,
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
      gclid: null, fbclid: null, msclkid: null, ttclid: null,
      userAgent: ua, resolvedAt: Date.now(), ...timeCtx,
      history: emptyHistory(), tenantId,
    };

    const scenarioOverrides = parseScenarioCookie(headersList.get("cookie"));
    const effectiveCtx = scenarioOverrides ? applyScenarioToDecisionContext(themeCtx, scenarioOverrides) : themeCtx;
    const sessionSelection = scenarioOverrides ? null : readThemeSessionSelection(cookieStore);
    const sessionTheme    = sessionSelection?.kind === "curated" ? sessionSelection.themeKey : null;
    const sessionPresetId = sessionSelection?.kind === "gallery" ? sessionSelection.presetId : null;

    const cfg = await loadTenantRulesConfig(tenantId);
    const tenantDefault: ThemePresetKey =
      settings?.design?.theme && isThemePresetKey(settings.design.theme) ? settings.design.theme : "modern-saas";

    const trace = resolveThemeDecision(cfg, effectiveCtx, tenantDefault, sessionTheme, utmCampaign, sessionPresetId);
    if (!trace.resolvedPresetId) return null;

    const card = getDesignPreset(trace.resolvedPresetId);
    if (!card) return null;

    // Aurora uses a hand-tuned example on apply; mirror that for full parity.
    if (card.id === "aurora-purple-gold") {
      const { EXAMPLE_SITE_DESIGN_TOKENS } = await import("@/design-system/theme/block-token-set-examples");
      return EXAMPLE_SITE_DESIGN_TOKENS;
    }
    const derived = blockTokensFromOverrides(card.tokenOverrides);
    return Object.keys(derived).length > 0 ? derived : null;
  } catch {
    return null;
  }
});
