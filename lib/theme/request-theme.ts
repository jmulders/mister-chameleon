/**
 * Per-request theme decision — computed ONCE and shared.
 *
 * The root layout (app/layout.tsx) paints the chrome from the RESOLVED theme
 * decision, and the site layout (app/(site)/layout.tsx) needs the SAME resolved
 * theme so the header/footer LOGO follows the painted chrome (light vs dark).
 * Running the decision twice would risk divergence and double-fire the session
 * cookie write, so it lives here behind React `cache()` — the body runs exactly
 * once per request regardless of how many callers ask for it.
 *
 * The logic is moved verbatim from app/layout.tsx; both layouts now consume this.
 */

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { buildTimeContext } from "@/context/time";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { resolveThemeDecision, type ThemeDecisionTrace } from "@/decision/theme-decision";
import { readThemeSessionSelection, writeThemeSessionSelection } from "@/lib/theme-session";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { emptyHistory } from "@/context/visitor-history";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { isThemePresetKey, type ThemePresetKey } from "@/design-system/theme/presets";
import { parseScenarioCookie, applyScenarioToDecisionContext } from "@/lib/scenario/server-scenario";
import { createCMSProvider } from "@/cms/providers/create-cms-provider";

export interface RequestThemeDecision {
  /** Contextual curated theme key (rule / scenario override), else null. */
  contextualThemeKey: ThemePresetKey | null;
  /** Contextual gallery preset id (rule / session lock), else null. */
  contextualPresetId: string | null;
  /** Full decision trace (debug), or null when the pipeline was skipped/failed. */
  trace: ThemeDecisionTrace | null;
}

/**
 * Resolve the per-request theme decision. Memoised with React `cache()` so both
 * the root layout and the site layout get the identical result (and the session
 * cookie write fires at most once).
 */
export const getRequestThemeDecision = cache(async (): Promise<RequestThemeDecision> => {
  const tenantConfig = await getActiveTenant();
  const [tenantSettings, cmsSettings] = await Promise.all([
    getTenantById(tenantConfig.tenantId),
    createCMSProvider(undefined, tenantConfig.tenantId).getSiteSettings().catch(() => null),
  ]);

  let contextualThemeKey: ThemePresetKey | null = null;
  let contextualPresetId: string | null = null;
  let trace: ThemeDecisionTrace | null = null;

  try {
    const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);

    // ── Edit-mode guard (development only) ────────────────────────────────────
    // When mc_dev_tenant is set the admin is previewing — skip personalisation so
    // the editor always sees the clean default, and no session cookie is written.
    if (process.env.NODE_ENV === "development" && cookieStore.get(DEV_TENANT_COOKIE)?.value) {
      const _devPathname = headersList.get("x-pathname") ?? "(unknown)";
      console.debug("[mc:theme] edit-mode — skipping personalisation pipeline", `route=${_devPathname}`);
      // contextualThemeKey stays null → caller falls back to the DB/CMS default.
    } else {
      const ua       = headersList.get("user-agent") ?? "";
      const timezone = tenantSettings?.timezone ?? "UTC";

      const timeCtx     = buildTimeContext(new Date(), timezone);
      const device      = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" as const : "desktop" as const;
      const utmSource   = headersList.get("x-mc-utm-source")   || null;
      const utmMedium   = headersList.get("x-mc-utm-medium")   || null;
      const utmCampaign = headersList.get("x-mc-utm-campaign") || null;
      const utmContent  = headersList.get("x-mc-utm-content")  || null;
      const utmTerm     = headersList.get("x-mc-utm-term")     || null;
      const visitType   = cookieStore.get("mc_seen")?.value === "1" ? "returning" as const : "new" as const;

      const themeCtx: RuleEvaluationContext = {
        source:         "direct",
        device,
        visitType,
        rawReferrer:    null,
        referrerDomain: null,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        gclid:          null,
        fbclid:         null,
        msclkid:        null,
        ttclid:         null,
        userAgent:      ua,
        resolvedAt:     Date.now(),
        ...timeCtx,
        history:  emptyHistory(),
        tenantId: tenantConfig.tenantId,
      };

      const rawCookieHeader   = headersList.get("cookie");
      const scenarioOverrides = parseScenarioCookie(rawCookieHeader);
      const effectiveThemeCtx = scenarioOverrides
        ? applyScenarioToDecisionContext(themeCtx, scenarioOverrides)
        : themeCtx;

      const sessionSelection = scenarioOverrides ? null : readThemeSessionSelection(cookieStore);
      const sessionTheme     = sessionSelection?.kind === "curated" ? sessionSelection.themeKey : null;
      const sessionPresetId  = sessionSelection?.kind === "gallery" ? sessionSelection.presetId : null;

      const storedConfig    = await loadTenantRulesConfig(tenantConfig.tenantId);
      const cmsThemePreset  = cmsSettings?.themePreset;
      const defaultThemeKey = (
        tenantSettings?.design?.theme ??
        (cmsThemePreset && isThemePresetKey(cmsThemePreset) ? cmsThemePreset : null) ??
        "modern-saas"
      ) as ThemePresetKey;

      const themeTrace = resolveThemeDecision(storedConfig, effectiveThemeCtx, defaultThemeKey, sessionTheme, utmCampaign, sessionPresetId);
      trace = themeTrace;

      if (!themeTrace.sessionLocked && !scenarioOverrides) {
        // Freshly evaluated (no scenario) — lock the selection for this session.
        try {
          writeThemeSessionSelection(
            cookieStore as Parameters<typeof writeThemeSessionSelection>[0],
            themeTrace.resolvedPresetId
              ? { kind: "gallery", presetId: themeTrace.resolvedPresetId }
              : { kind: "curated", themeKey: themeTrace.resolvedTheme },
          );
        } catch {
          // Non-critical: if writing the cookie fails, next request re-evaluates.
        }
      }

      // Only promote when the engine picked a non-default theme that is NOT from
      // a (possibly stale) session lock — see the long note in app/layout history.
      if (!themeTrace.sessionLocked && themeTrace.resolvedTheme !== defaultThemeKey) {
        contextualThemeKey = themeTrace.resolvedTheme;
      }
      // A gallery preset is purely contextual — apply it whenever resolved.
      if (themeTrace.resolvedPresetId) {
        contextualPresetId = themeTrace.resolvedPresetId;
      }
      // Scenario presets may declare a themeKey directly (demo/dev only).
      if (scenarioOverrides?.themeKey && isThemePresetKey(scenarioOverrides.themeKey)) {
        contextualThemeKey = scenarioOverrides.themeKey;
      }

      if (process.env.NODE_ENV === "development") {
        const pathname = headersList.get("x-pathname") ?? "(unknown)";
        console.debug(
          "[mc:theme]",
          `route=${pathname}`,
          `default=${themeTrace.tenantDefault}`,
          `rule=${themeTrace.matchedRuleId ?? "none"}(priority=${themeTrace.matchedPriority ?? "-"})`,
          `resolved=${themeTrace.resolvedTheme}`,
          `locked=${themeTrace.sessionLocked}(${themeTrace.lockSource})`,
          ...(utmSource   ? [`utm_source=${utmSource}`]   : []),
          ...(utmCampaign ? [`utm_campaign=${utmCampaign}`] : []),
        );
      }
    }
  } catch {
    // Non-critical: if theme decision fails, fall back to design.theme.
  }

  return { contextualThemeKey, contextualPresetId, trace };
});
