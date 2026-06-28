/**
 * POST /api/scenario/enricher
 *
 * Re-triggers a specific enricher (or all enrichers) and returns its output.
 * Consumed by the Scenario Control Panel "Enricher Actions" section.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     enricherKey: string,    // one of the EnricherKey values ("ip", "ga4", …)
 *     mockMode:    boolean,   // true = return mock data, false = call real API
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   {
 *     enricherKey: string,
 *     output:      Record<string, unknown>,   // Partial<EnrichmentOutput>
 *     durationMs:  number,
 *     mockMode:    boolean,
 *     error?:      string,                    // present when live mode fails
 *   }
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 *   • Only available when NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1" or in
 *     development / preview environments. Returns 403 otherwise.
 *   • Live mode never writes to the visitor behavior database — enricher output
 *     is returned to the client for storage as a scenario override cookie only.
 *   • Mock mode is always safe — no external API calls, no credentials needed.
 *
 * ─── Recompute flow ──────────────────────────────────────────────────────────
 *
 *   1. Client calls POST /api/scenario/enricher with enricherKey + mockMode.
 *   2. Server returns Partial<EnrichmentOutput>.
 *   3. Client stores result as overrides.enrichmentPatch in scenario store.
 *   4. Client calls router.refresh() — RSC picks up the enrichmentPatch via
 *      cookie and merges it into ctx.enrichment in Pass 2.
 *   5. Rule engine, debug, and adaptive blocks see the updated enrichment.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ENRICHER_BY_KEY,
  getAllMockOutput,
} from "@/lib/scenario/enricher-registry";
import { buildCompanyCrmChain }   from "@/enrichment";
import { runStagedPipeline }      from "@/enrichment/staged-pipeline";
import type { EnricherInput }     from "@/enrichment/types";
import { getActiveTenant }        from "@/tenant/get-active-tenant";
import { parseLeadinfoCookie, leadinfoToEnrichment, LEADINFO_COOKIE } from "@/context/leadinfo-context";
import {
  getPlatformEnrichmentSettings,
  getPlatformOpenKvKSettings,
  getPlatformReverseGeocodeSettings,
  getPlatformWeatherSettings,
  getPlatformMaxMindSettings,
} from "@/platform/platform-store";

export const runtime = "nodejs";

// ── Guard: only available in dev/preview/scenario-enabled environments ────────

function isScenarioAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1") return true;
  return false;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isScenarioAllowed()) {
    return NextResponse.json({ error: "Scenario API not available in production." }, { status: 403 });
  }

  let body: { enricherKey?: string; mockMode?: boolean } = {};
  try {
    body = await request.json() as { enricherKey?: string; mockMode?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { enricherKey = "ip", mockMode = true } = body;

  // ── Invalidate session enrichment cache ───────────────────────────────────
  //
  // When the scenario panel re-runs an enricher and then calls router.refresh(),
  // the in-process session enrichment cache would otherwise return a cache hit,
  // skip the full staged pipeline, and bypass billing entirely.
  //
  // Invalidating here guarantees the next page render causes a cache miss,
  // the pipeline runs end-to-end, and trackEnrichmentUsage fires for every
  // configured stage — so credits are correctly deducted for the re-run.
  //
  // In-process only: if the page render lands on a different Vercel replica
  // the invalidation has no effect, but this is acceptable for a dev/staging
  // tool.  The worst case is one extra "free" render before billing resumes.
  const sessionId = request.cookies.get("mc_session_id")?.value;
  if (sessionId) {
    const { invalidateSessionEnrichment } = await import(
      "@/enrichment/session-enrichment-cache"
    );
    invalidateSessionEnrichment(sessionId);
  }
  const startMs = Date.now();

  // ── Special case: "all" enrichers ────────────────────────────────────────
  if (enricherKey === "all") {
    if (mockMode) {
      return NextResponse.json({
        enricherKey: "all",
        output:      getAllMockOutput(),
        durationMs:  Date.now() - startMs,
        mockMode:    true,
      });
    }
    // Live "all" runs each enricher individually and merges — for now, fall
    // through to mock (live mode is opt-in and requires env-specific setup).
    return NextResponse.json({
      enricherKey: "all",
      output:      getAllMockOutput(),
      durationMs:  Date.now() - startMs,
      mockMode:    true,
      note:        "Live mode for 'all enrichers' not yet supported — returning mock.",
    });
  }

  // ── Look up enricher definition ───────────────────────────────────────────
  const definition = ENRICHER_BY_KEY[enricherKey];
  if (!definition) {
    return NextResponse.json(
      { error: `Unknown enricher key: "${enricherKey}".` },
      { status: 400 },
    );
  }

  // ── Mock mode (always safe, no external APIs) ─────────────────────────────
  if (mockMode) {
    // Add a small artificial delay to simulate network latency for realism.
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

    return NextResponse.json({
      enricherKey,
      output:    definition.mockOutput,
      durationMs: Date.now() - startMs,
      mockMode:  true,
    });
  }

  // ── Live mode ─────────────────────────────────────────────────────────────
  // For live mode, we'd import and run the real enricher with real credentials.
  // This requires:
  //   - The tenant's enricher credentials from their settings
  //   - The visitor's IP from the request headers
  //   - API keys from environment variables
  //
  // For safety, live mode falls back to mock when credentials are not configured.
  // This prevents accidental data leaks in demo environments.
  //
  // TODO: implement per-enricher live execution when credentials are available.

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
           ?? request.headers.get("x-real-ip")
           ?? null;

  try {
    const tenantId = await getActiveTenant().then((t) => t.tenantId).catch(() => null);
    const isDev = process.env.NODE_ENV !== "production";

    // ── Leadinfo: read the mc_li cookie (not an API enricher here) ────────────
    if (enricherKey === "leadinfo") {
      const li = parseLeadinfoCookie(request.cookies.get(LEADINFO_COOKIE)?.value ?? null);
      const out = li ? (leadinfoToEnrichment(li) as Record<string, unknown>) : {};
      return NextResponse.json({ enricherKey, output: out, durationMs: Date.now() - startMs, mockMode: false });
    }

    // ── Run the real staged enrichment chain (geo → weather chaining included) ─
    const [enr, okvk, rgeo, weather, mm] = await Promise.all([
      getPlatformEnrichmentSettings(),
      getPlatformOpenKvKSettings(),
      getPlatformReverseGeocodeSettings(),
      getPlatformWeatherSettings(),
      getPlatformMaxMindSettings(),
    ]);
    const enrD     = (enr.ok     ? enr.data     : {}) as Record<string, string | undefined>;
    const okvkD    = (okvk.ok    ? okvk.data    : {}) as Record<string, unknown>;
    const rgeoD    = (rgeo.ok    ? rgeo.data    : {}) as Record<string, unknown>;
    const weatherD = (weather.ok ? weather.data : {}) as Record<string, unknown>;
    const mmD      = (mm.ok      ? mm.data      : {}) as Record<string, string | undefined>;

    const chain = buildCompanyCrmChain({
      ipinfoToken:       enrD.ipinfoToken || undefined,
      maxmindWebService: mmD.accountId && mmD.licenseKey
                           ? { accountId: mmD.accountId, licenseKey: mmD.licenseKey } : undefined,
      enableReverseGeocode:        Boolean(rgeoD.enabled),
      reverseGeocodeLocationIqKey: (rgeoD.locationIqApiKey as string) || undefined,
      enableWeather:               Boolean(weatherD.enabled),
      enableOpenKvK:               true,
      openKvKMode:                 okvkD.mode as "off" | "nl-only" | "always" | undefined,
      openKvKMatchingStrategy:     okvkD.matchingStrategy as "networkOrg" | "companyName" | "networkDomain" | undefined,
      openKvKConfidenceThreshold:  okvkD.confidenceThreshold as number | undefined,
      ovioApiKey:                  enrD.ovioApiKey || undefined,
      kvkApiKey:                   enrD.kvkApiKey  || undefined,
      isDev,
    });

    const input: EnricherInput = {
      ip,
      effectiveIp: ip,
      tenantId,
      sessionId:   sessionId ?? null,
      email:       null,
      utm:         { campaign: null, source: null, medium: null, term: null, content: null },
    };

    const { output } = await runStagedPipeline(chain, input, { timeoutMs: 4500 });

    // Filter to the requested enricher's fields (full output for "all").
    const result = enricherKey === "all"
      ? output
      : Object.fromEntries(
          Object.entries(output).filter(([k]) => definition.outputFields.includes(k)),
        );

    return NextResponse.json({ enricherKey, output: result, durationMs: Date.now() - startMs, mockMode: false });
  } catch (err) {
    // Fail-safe: fall back to mock so the panel never breaks.
    return NextResponse.json({
      enricherKey,
      output:    definition.mockOutput,
      durationMs: Date.now() - startMs,
      mockMode:  false,
      error:     err instanceof Error ? err.message : String(err),
    });
  }
}

// GET is not supported — return a helpful error.
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with { enricherKey, mockMode } body." },
    { status: 405 },
  );
}
