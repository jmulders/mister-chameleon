/**
 * Fire-on-enrichment: deliver the ENRICHED rule webhook the moment a company is
 * identified, so every identified visitor gets exactly ONE company-carrying
 * webhook — even fast visitors whose client-side Leadinfo (mc_li) resolves ~15s
 * after the page render.
 *
 * Why here: `ip_company_cache` is empty across tenants, so the server-side
 * enrichment path yields nothing in practice — the client-side mc_li path is the
 * only one that works. That path culminates in POST /api/enrichment/leadinfo, so
 * this is where the enriched decision is triggered.
 *
 * How it coordinates with fire-once-per-session (see RulesDecisionProvider):
 *   • A page render for a "company webhook" (a fireOncePerSession rule whose
 *     payload selects a firmographic field) DEFERS when the company is not
 *     resolved yet but enrichment consent is granted — it neither sends nor
 *     latches the marker.
 *   • This enrichment pass injects the just-identified company and fires ONLY
 *     those company webhooks, latching the fire-once marker. Net: one enriched
 *     webhook per session.
 *
 * Session alignment: dedup lines up only when the page decision and this
 * enrichment POST share the same session id. On platform-hosted pages both use
 * the `mc_session_id` cookie, so they align. On the snippet path the page
 * decision keys on a client-minted id sent in the decide body, which this route
 * does not see — there the marker may not align (documented limitation).
 *
 * Personalisation is untouched: the provider runs in enrichment-pass mode, which
 * records no rule-fire stats and persists only the fire-once marker (never the
 * sticky context-writes), so decision/variant state stays byte-for-byte identical.
 */

import { buildDecisionContext } from "@/decision/context/build-decision-context";
import { RulesDecisionProvider } from "@/decision/providers/rules-decision-provider";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { fetchVisitorHistory } from "@/context/fetch-visitor-history";
import { getTenantById } from "@/tenant/server";
import { readConsentFromCookieHeader, computeEffectiveConsent } from "@/lib/consent/server-consent";
import { serializeLeadinfoData, LEADINFO_COOKIE, type LeadinfoData } from "@/context/leadinfo-context";

export interface FireEnrichmentWebhookParams {
  tenantId:     string;
  /** The visitor session id (mc_session_id). Required — dedup keys on it. */
  sessionId:    string | null;
  /** The matched company from the POST body (NOT the response cookie). */
  data:         LeadinfoData;
  /** The incoming request's Cookie header — carries mc_consent (+ any mc_cc/mc_tz). */
  cookieHeader: string | null;
  /** The page the visitor is on (Referer) — supplies utm/source/path. */
  pageUrl:      string | null;
  /** The visitor's user-agent, so the synthetic decision is not seen as a bot. */
  userAgent:    string | null;
  /** x-forwarded-for from the incoming request, for consistent IP-derived signals. */
  forwardedFor: string | null;
}

/** Replace any existing mc_li in a cookie header with a fresh one carrying `value`. */
function withFreshLeadinfoCookie(cookieHeader: string | null, value: string): string {
  const fresh = `${LEADINFO_COOKIE}=${encodeURIComponent(value)}`;
  if (!cookieHeader) return fresh;
  const kept = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith(`${LEADINFO_COOKIE}=`));
  // Prepend the fresh mc_li so the (first-match) cookie reader picks it up.
  return [fresh, ...kept].join("; ");
}

/**
 * Run an enrichment-triggered decision that fires the deferred company webhook(s)
 * with the just-identified company. Fire-and-forget: never throws, returns early
 * on any missing precondition. Intended to be scheduled via `after()` so it never
 * delays the POST response.
 */
export async function fireEnrichmentWebhook(params: FireEnrichmentWebhookParams): Promise<void> {
  const { tenantId, sessionId, data, cookieHeader, pageUrl, userAgent, forwardedFor } = params;

  try {
    // Only identified companies trigger the enriched fire; without a session we
    // cannot dedup, so we skip rather than risk a double fire.
    if (!data.matched || !sessionId) return;

    const tenant = await getTenantById(tenantId);
    if (!tenant) return;

    // Respect consent: the enriched company webhook needs enrichment consent.
    // Without it, behaviour is unchanged (the page render already fired, sans
    // company). Apply the tenant privacy ceiling, same as the page pipelines.
    const consent = computeEffectiveConsent(
      readConsentFromCookieHeader(cookieHeader),
      tenant.privacy,
    );
    if (consent.enrichment !== true) return;

    const rulesConfig = await loadTenantRulesConfig(tenantId).catch(() => null);
    if (!rulesConfig) return; // no rules → nothing to fire

    const history = await fetchVisitorHistory(sessionId, tenantId).catch(() => null);
    if (!history) return;

    // Inject the just-identified company via a synthetic mc_li cookie — the same
    // unconditional merge buildDecisionContext applies to a real mc_li cookie.
    const injectedCookie = withFreshLeadinfoCookie(cookieHeader, serializeLeadinfoData(data));

    // Reconstruct the page request from the Referer so utm/source/path are derived
    // exactly as on the page render. Fall back to the tenant's primary domain.
    let url: string;
    try {
      const u = new URL(pageUrl ?? "");
      url = u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
    } catch { url = ""; }
    if (!url) url = `https://${tenant.primaryDomain ?? "localhost"}/`;

    const headers = new Headers();
    if (userAgent)    headers.set("user-agent", userAgent);
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
    const request = new Request(url, { headers });

    const templateKey = (() => {
      try { return new URL(url).pathname || "/"; } catch { return "/"; }
    })();

    const ctx = await buildDecisionContext({
      request,
      cookieHeader: injectedCookie,
      history,
      tenantId,
      templateKey,
      pageType: "cms_page",
      sessionId,
      timezone: tenant.timezone ?? null,
      // No stagedEnrichers → the legacy branch runs; the mc_li merge still
      // populates the leadinfo* fields we injected.
    });

    const provider = new RulesDecisionProvider(
      rulesConfig,
      false,        // forceDefaultPlan — must be false so rules evaluate
      tenantId,     // required to fire webhooks
      sessionId,    // fire-once dedup key
      consent,      // enrichment:true → company fields survive the payload gate
      true,         // enrichmentPass → fire ONLY deferred company webhooks
    );

    // Side-effect: fires the deferred company webhook(s) with the company. The
    // returned plan is discarded — no variants are rendered here.
    await provider.getHomepagePlan(ctx);
  } catch {
    // Fire-and-forget: enrichment webhook delivery is best-effort.
  }
}
