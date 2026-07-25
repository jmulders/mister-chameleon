/**
 * Staged Company + CRM Enrichment Chain
 *
 * Assembles the complete sequential enrichment pipeline for company
 * identification and CRM matching.  Returns an ordered array of
 * `StagedEnricher` stages that is consumed by `runStagedPipeline`.
 *
 * ─── Stage ordering ───────────────────────────────────────────────────────────
 *
 *   Stage 0  IP Classification  (always — zero-latency, no I/O)
 *            → ipVersion ("ipv4" | "ipv6")
 *            Reads input.ip (raw request IP) and classifies address family.
 *
 *   Stage 1  MaxMind GeoIP   (wave 1, when DB configured)
 *            → countryCode, region, city, latitude, longitude
 *
 *   Stage 2  IPinfo Lite     (wave 1, when token configured)
 *            → networkAsn, networkOrg, networkDomain
 *            → countryCode / region / city as geo fallback
 *            → latitude / longitude from loc field (fallback when MaxMind absent)
 *            Always runs — adds network data that MaxMind does not have.
 *
 *   Stage 2b GA4 Analytics History (wave 1, when GA4 configured)
 *            → gaLastKnownCity, gaLastKnownRegion, gaLastKnownCountry,
 *              gaSessionCount, gaLastChannelGroup, gaHistorySource
 *            Reads ONLY input.visitorId — no dependency on IP/geo stages.
 *            Must remain consecutive with MaxMind and IPinfo in the array so
 *            groupStages() places all three in the same parallel wave group.
 *
 *   Stage 3  Cloud Detection  (always — zero-latency, no I/O)
 *            → isCloudProvider (boolean)
 *            Runs after IPinfo so networkOrg/networkAsn are available.
 *            Flags IPs belonging to cloud/CDN/datacenter providers.
 *            When true, OpenKvK and Leadinfo are skipped automatically.
 *
 *   Stage 4  Reverse Geocode (when enabled; requires latitude + longitude)
 *            → addressCountry, addressRegion, addressCity, addressMunicipality,
 *              addressPostcode, addressFormatted, addressSource
 *            Provider chain: LocationIQ → BigDataCloud → Nominatim.
 *            Skipped when lat/lng is unavailable from prior geo stages.
 *
 *   Stage 5  Weather         (when enabled; requires latitude + longitude)
 *            → weatherCode, temperatureNow, precipitationProbability, isRaining,
 *              windSpeed, cloudCover, weatherSummary, weatherSource
 *            Uses free Open-Meteo API — no API key required.
 *            Skipped when lat/lng is unavailable from prior geo stages.
 *
 *   Stage 6  OpenKvK NL      (no key needed; gated on countryCode === "NL")
 *            → companyName (from bedrijfsnaam), companyDomain (from website)
 *            Skipped for non-NL visitors and cloud/datacenter IPs.
 *
 *   Stage 6  Leadinfo        (when apiKey configured AND tenant enables it)
 *            → companyName, companyDomain, companyIndustry, companySize
 *            Upgrades missing company fields; skipped when not configured.
 *
 *   Stage 7  HubSpot CRM     (when accessToken configured AND tenant enables it)
 *            → crmMatched, crmCompanyId, crmLifecycleStage, crmIsCustomer, …
 *            Uses best available companyDomain from stages 5/6.
 *            Skipped when no domain is available in accumulated output.
 *
 *   Stage 8  Seasonal Event  (always, gated on countryCode resolved)
 *            → seasonalEvent, holidayName, seasonalSource
 *            Uses Nager.Date public holiday API + date-math business events.
 *            Results cached 24 h per countryCode+year.
 *            Skipped when countryCode is not available from prior geo stages.
 *
 * ─── Tenant flags ─────────────────────────────────────────────────────────────
 *
 *   Options.enableLeadinfo   — tenant flag: useLeadinfo === true
 *   Options.enableHubSpot    — tenant flag: useCrmEnrichment === true
 *   Options.enableOpenKvK    — tenant flag: useOpenKvK === true (default: true)
 *
 * ─── Dev mode ─────────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true, each provider substitutes local IPs with a public
 *   fallback and emits verbose `console.debug` output.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const stages = buildCompanyCrmChain({ ... });
 *   const { output, trace } = await runStagedPipeline(stages, input);
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput } from "../types";
import { createIpClassificationEnricher, createCloudDetectionEnricher } from "../ip-utils";
import { createGa4HistoryEnricher }              from "./ga4-history";
import { createMaxMindGeoEnricher }            from "./geo";
import { createMaxMindWebServiceStagedEnricher } from "./maxmind-webservice";
import { createIpInfoStagedEnricher }          from "./ipinfo";
import { createReverseGeocodeStagedEnricher }  from "./reverse-geocode";
import type { ReverseGeocodeOptions }          from "./reverse-geocode";
import { createWeatherStagedEnricher }         from "./weather";
import { createOpenKvKStagedEnricher }         from "./openkvk";
import type { OpenKvKMode, OpenKvKMatchingStrategy } from "./openkvk";
import { createKvkZoekenStagedEnricher }      from "./kvk-zoeken";
import { createLeadinfoStagedEnricher }        from "./leadinfo";
import { ipCompanyCache }                       from "../ip-company-store";
import { HubSpotCrmProvider }                  from "./hubspot-crm";
import {
  createSeasonalEventStagedEnricher,
  NagerDateHolidayProvider,
} from "./seasonal-event";
import type { HolidayProvider }               from "./seasonal-event";
import { ProviderCache }                       from "../provider-cache";

// ── Module-level HubSpot domain match cache ───────────────────────────────────
//
// Keyed by lowercase domain string.
// TTL: 2 hours — HubSpot company records are stable within a business session.
// This avoids re-querying HubSpot for every new visitor session from the same
// corporate domain (e.g. multiple employees from the same company).
const hubspotDomainCache = new ProviderCache<Partial<EnrichmentOutput>>(2 * 60 * 60 * 1_000);

// ── Options ───────────────────────────────────────────────────────────────────

export interface CompanyCrmChainOptions {
  // ── Stage 1: MaxMind ──────────────────────────────────────────────────────
  /**
   * Path to the MaxMind GeoLite2 MMDB file.
   * When absent, the MaxMind stage is omitted from the chain.
   */
  maxmindDbPath?: string;

  /**
   * MaxMind GeoLite2 web-service credentials (account ID + license key). When
   * present, a hosted geo lookup runs — no local .mmdb needed, so it works on
   * serverless / Vercel. Omitted when absent.
   */
  maxmindWebService?: { accountId: string; licenseKey: string };

  // ── Stage 2: IPinfo Lite ──────────────────────────────────────────────────
  /**
   * IPinfo API token.
   * When absent, the IPinfo stage is omitted.
   */
  ipinfoToken?: string;

  // ── Stage 3: Reverse Geocode ─────────────────────────────────────────────
  /**
   * Whether to include the Reverse Geocode stage.
   * No tenant flag required — platform-level on/off toggle.
   * Default: false.
   * When true, the stage resolves lat/lng → address fields using a provider
   * chain: LocationIQ → BigDataCloud → Nominatim.
   */
  enableReverseGeocode?: boolean;
  /**
   * LocationIQ API key for the primary reverse-geocode provider.
   * When absent, the chain starts at BigDataCloud.
   * Obtain a free key at locationiq.com.
   */
  reverseGeocodeLocationIqKey?: string;
  /**
   * Cache TTL for reverse-geocode results, in milliseconds.
   * Default: 21 600 000 ms (6 hours).
   */
  reverseGeocodeCacheTtlMs?: number;

  // ── Stage 4: Weather ─────────────────────────────────────────────────────
  /**
   * Whether to include the Weather stage.
   * No API key required — uses the free Open-Meteo API.
   * Default: false.
   * Resolves lat/lng → current weather conditions.
   */
  enableWeather?: boolean;
  /**
   * Cache TTL for weather results, in milliseconds.
   * Default: 3 600 000 ms (60 minutes).
   */
  weatherCacheTtlMs?: number;

  // ── KvK Zoeken (official kvk.nl API) ─────────────────────────────────────
  /**
   * Official KvK (Kamer van Koophandel) Zoeken API key.
   * When present, the KvK Zoeken stage is inserted BEFORE OpenKvK in the chain.
   * When absent, the stage is omitted.
   * Obtain at https://developers.kvk.nl. Zoeken queries are free (€0/query).
   */
  kvkApiKey?: string;

  // ── Stage 5: OpenKvK ─────────────────────────────────────────────────────
  /**
   * Whether to include the OpenKvK stage.
   * No API key required — public API.
   * Default: true.
   * When false, the stage is omitted entirely (equivalent to mode "off").
   */
  enableOpenKvK?: boolean;
  /**
   * Operating mode for the OpenKvK stage.
   *   "off"     — disabled (overrides enableOpenKvK)
   *   "nl-only" — only run for NL visitors (default)
   *   "always"  — run regardless of country code
   */
  openKvKMode?: OpenKvKMode;
  /**
   * Minimum confidence threshold for OpenKvK match results (0–1).
   * Default: 0.5
   */
  openKvKConfidenceThreshold?: number;
  /**
   * Which upstream field to prefer as the OpenKvK search query.
   * Default: "networkOrg"
   */
  openKvKMatchingStrategy?: OpenKvKMatchingStrategy;
  /**
   * overheid.io API key (header: ovio-api-key) for the OpenKvK endpoint.
   * Required — requests without a key return HTTP 401.
   */
  ovioApiKey?: string;

  // ── Stage 4: Leadinfo ─────────────────────────────────────────────────────
  /**
   * Leadinfo API key.
   * When absent or when `enableLeadinfo` is false, the stage is omitted.
   */
  leadinfoApiKey?: string;
  /**
   * Tenant flag: whether this tenant has Leadinfo enabled.
   * Default: false.
   */
  enableLeadinfo?: boolean;

  // ── Stage 5: HubSpot CRM ─────────────────────────────────────────────────
  /**
   * HubSpot Private App access token.
   * When absent or when `enableHubSpot` is false, the CRM stage is omitted.
   */
  hubspotAccessToken?: string;
  /**
   * Tenant flag: whether this tenant has CRM enrichment enabled.
   * Default: false.
   */
  enableHubSpot?: boolean;
  /**
   * Override HubSpot API base URL (tests).
   */
  hubspotApiBase?: string;

  // ── Stage 6: Seasonal Event ──────────────────────────────────────────────
  /**
   * Whether to include the country-aware seasonal event stage.
   * Uses Nager.Date public holiday API + a business-event date-math layer.
   * Default: true.
   */
  enableSeasonalEvents?: boolean;
  /**
   * Custom holiday provider for the seasonal event stage.
   * Defaults to `NagerDateHolidayProvider` (Nager.Date public API).
   * Override in tests to avoid real HTTP calls.
   */
  seasonalEventsProvider?: HolidayProvider;
  /**
   * Cache TTL in milliseconds for the Nager.Date holiday provider.
   * Default: 86 400 000 ms (24 hours).
   * Only applied when `seasonalEventsProvider` is not explicitly set
   * (i.e. when the default NagerDateHolidayProvider is used).
   */
  holidayCacheTtlMs?: number;
  /**
   * Comma-separated list of ISO 3166-1 alpha-2 country codes eligible for
   * holiday detection (e.g. "NL,DE,BE,GB").
   * When absent or empty, all countries supported by Nager.Date are eligible.
   */
  holidayAllowedCountries?: string;

  // ── GA4 Analytics History ─────────────────────────────────────────────────
  /**
   * Whether to include the GA4 History stage.
   * Default: false.
   * When true, `ga4PropertyId` and `ga4ServiceAccount` must also be provided.
   */
  enableGa4History?: boolean;
  /**
   * Google Analytics 4 property ID (numeric string, e.g. "123456789").
   * Required when `enableGa4History` is true.
   */
  ga4PropertyId?: string;
  /**
   * Parsed service account JSON object for GA4 authentication.
   * Must contain at minimum `client_email` and `private_key`.
   * Required when `enableGa4History` is true.
   */
  ga4ServiceAccount?: { client_email: string; private_key: string; token_uri?: string };
  /**
   * Name of the User-scoped custom dimension in GA4 that holds the visitor ID.
   * Default: "visitor_id"
   */
  ga4VisitorIdDimension?: string;
  /**
   * How far back (in days) to query GA4 sessions for a visitor.
   * Default: 90
   */
  ga4LookbackDays?: number;
  /**
   * Cache TTL for GA4 results in milliseconds.
   * Default: 1 800 000 ms (30 minutes).
   */
  ga4CacheTtlMs?: number;

  // ── Shared ────────────────────────────────────────────────────────────────
  /**
   * Enable verbose debug logging and local-IP substitution.
   * Default: false.
   */
  isDev?: boolean;

  // ── Admin pipeline config ─────────────────────────────────────────────────
  /**
   * Optional per-tenant stage configuration loaded from `tenant_pipeline_stages`.
   *
   * When provided, two transforms are applied after all stages are assembled:
   *   1. Stages whose `enabled` is false are removed from the chain.
   *   2. Stages within the same wave are sorted by `position` (ascending).
   *
   * Always-on internal stages (IP Classification, Cloud Detection) are never
   * filtered — they have no `stageKey` and are invisible to this config.
   *
   * When absent, the hardcoded default order is used.
   */
  stageConfig?: Array<{
    stageKey: string;
    position: number;
    enabled:  boolean;
  }>;
}

// ── buildCompanyCrmChain ──────────────────────────────────────────────────────

/**
 * Assemble the full sequential enrichment chain based on available credentials
 * and tenant feature flags.
 *
 * Stages are only included when their required credentials are present and the
 * relevant tenant flag is enabled.  The resulting array may have 0–5 entries.
 *
 * @example
 * const stages = buildCompanyCrmChain({
 *   maxmindDbPath:     process.env.MAXMIND_DB_PATH,
 *   ipinfoToken:       "abc123",
 *   enableOpenKvK:     true,
 *   leadinfoApiKey:    "ld_...",
 *   enableLeadinfo:    tenant.enrichment?.useLeadinfo ?? false,
 *   hubspotAccessToken: crmSettings.accessToken,
 *   enableHubSpot:     tenant.crm?.useCrmEnrichment ?? false,
 *   isDev:             process.env.NODE_ENV === "development",
 * });
 */
export function buildCompanyCrmChain(
  options: CompanyCrmChainOptions,
): StagedEnricher[] {
  const {
    maxmindDbPath,
    maxmindWebService,
    ipinfoToken,
    enableReverseGeocode       = false,
    reverseGeocodeLocationIqKey,
    reverseGeocodeCacheTtlMs,
    enableWeather              = false,
    weatherCacheTtlMs,
    kvkApiKey,
    enableOpenKvK              = true,
    openKvKMode,
    openKvKConfidenceThreshold,
    openKvKMatchingStrategy,
    ovioApiKey,
    leadinfoApiKey,
    enableLeadinfo             = false,
    hubspotAccessToken,
    enableHubSpot              = false,
    hubspotApiBase,
    enableGa4History           = false,
    ga4PropertyId,
    ga4ServiceAccount,
    ga4VisitorIdDimension,
    ga4LookbackDays,
    ga4CacheTtlMs,
    enableSeasonalEvents       = true,
    seasonalEventsProvider,
    holidayCacheTtlMs,
    holidayAllowedCountries,
    isDev                      = false,
  } = options;

  const stages: StagedEnricher[] = [];

  // ── Stage 0: IP Classification ────────────────────────────────────────────
  // Zero-latency — classifies the raw request IP as IPv4 or IPv6.
  // Runs first so ipVersion is available to all downstream stages and rules.
  stages.push(createIpClassificationEnricher());

  // ── Stage 1: MaxMind GeoIP  (wave 1) ─────────────────────────────────────
  //
  // Only needs input.effectiveIp — no dependency on any other stage.
  // Runs in parallel with IPinfo Lite and GA4 History.
  if (maxmindDbPath) {
    // Wrap the existing LabeledEnricher into a StagedEnricher
    const geoLabeled = createMaxMindGeoEnricher({ dbPath: maxmindDbPath, isDev });
    stages.push({
      label:    geoLabeled.label ?? "MaxMind GeoIP",
      stageKey: "maxmind",
      wave:     1,
      enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>) => {
        return geoLabeled.enricher(input);
      },
    });
  }

  // ── Stage 1b: MaxMind GeoLite2 web service  (wave 1) ─────────────────────
  //
  // Hosted geo lookup using the platform license — no local .mmdb required, so
  // this is the geo source that actually runs on serverless / Vercel. Only needs
  // input.effectiveIp. Merge preserves any value a prior stage already set.
  if (maxmindWebService?.accountId && maxmindWebService?.licenseKey) {
    stages.push({
      ...createMaxMindWebServiceStagedEnricher({
        accountId:  maxmindWebService.accountId,
        licenseKey: maxmindWebService.licenseKey,
        isDev,
      }),
      stageKey: "maxmind",
      wave:     1,
    });
  }

  // ── Stage 2: IPinfo Lite  (wave 1) ───────────────────────────────────────
  //
  // Only needs input.effectiveIp — no dependency on any other stage.
  // Runs in parallel with MaxMind and GA4 History.
  if (ipinfoToken) {
    stages.push({
      ...createIpInfoStagedEnricher({ token: ipinfoToken, isDev }),
      stageKey: "ipinfo",
      wave:     1,
    });
  }

  // ── GA4 Analytics History  (wave 1) ──────────────────────────────────────
  //
  // Queries GA4 Data API for historical visitor signals (last-known city,
  // region, country, session count, channel group).
  //
  // Wave 1 placement: GA4 History reads ONLY `input.visitorId` — it has
  // NO dependency on accumulated output from MaxMind, IPinfo, or any other
  // stage.  It writes only `ga*`-prefixed fields which no other stage reads.
  // Running in parallel with MaxMind and IPinfo saves ~200–800 ms per request.
  //
  // IMPORTANT: this block must remain immediately adjacent to the MaxMind and
  // IPinfo pushes above.  `groupStages()` groups only CONSECUTIVE same-wave
  // stages into a parallel wave group — any non-wave stage between them would
  // break the grouping and cause GA4 to run sequentially instead of in parallel.
  //
  // Gate (in the enricher): skipped when input.visitorId is null/empty.
  // Never overwrites live geo fields — writes only ga*-prefixed fields.
  if (enableGa4History && ga4PropertyId && ga4ServiceAccount) {
    stages.push({
      ...createGa4HistoryEnricher({
        propertyId:         ga4PropertyId,
        serviceAccount:     ga4ServiceAccount,
        isDev,
        ...(ga4VisitorIdDimension !== undefined ? { visitorIdDimension: ga4VisitorIdDimension } : {}),
        ...(ga4LookbackDays       !== undefined ? { lookbackDays:       ga4LookbackDays       } : {}),
        ...(ga4CacheTtlMs         !== undefined ? { cacheTtlMs:         ga4CacheTtlMs         } : {}),
      }),
      stageKey: "ga4",
      wave:     1,
    });
  }

  // ── Stage 3: Cloud Detection ──────────────────────────────────────────────
  // Zero-latency — reads networkOrg/networkAsn from accumulated output and
  // sets isCloudProvider.  Runs unconditionally so the flag is always present
  // (even when IPinfo was not configured, it will write isCloudProvider: false).
  stages.push(createCloudDetectionEnricher({ isDev }));

  // ── Stage 4: Reverse Geocode  (wave 2) ───────────────────────────────────
  //
  // Resolves lat/lng coordinates (populated by Stage 1/2) into human-readable
  // address fields.  Provider chain: LocationIQ → BigDataCloud → Nominatim.
  // Gate (in the enricher): skipped when latitude/longitude are not available.
  //
  // Depends on: accumulated.latitude / longitude (wave 1 output)
  // No dependency on OpenKvK, Weather, or Leadinfo — safe for wave 2.
  if (enableReverseGeocode) {
    const rgOptions: ReverseGeocodeOptions = { isDev };
    if (reverseGeocodeLocationIqKey) {
      rgOptions.locationIqApiKey = reverseGeocodeLocationIqKey;
    }
    if (reverseGeocodeCacheTtlMs !== undefined) {
      rgOptions.cacheTtlMs = reverseGeocodeCacheTtlMs;
    }
    stages.push({
      ...createReverseGeocodeStagedEnricher(rgOptions),
      stageKey: "reverse-geo",
      wave:     2,
    });
  }

  // ── Stage 5: Weather  (wave 2) ────────────────────────────────────────────
  //
  // Fetches current weather from Open-Meteo (free, no key) using lat/lng
  // populated by Stage 1/2.  Gate: skipped when coordinates unavailable.
  //
  // Depends on: accumulated.latitude / longitude (wave 1 output)
  // No dependency on ReverseGeocode, OpenKvK, or Leadinfo — safe for wave 2.
  if (enableWeather) {
    stages.push({
      ...createWeatherStagedEnricher({
        isDev,
        ...(weatherCacheTtlMs !== undefined ? { cacheTtlMs: weatherCacheTtlMs } : {}),
      }),
      stageKey: "weather",
      wave:     2,
    });
  }

  // ── KvK Zoeken (official kvk.nl API)  (wave 2) ───────────────────────────
  //
  // Runs BEFORE OpenKvK so that if both are configured, KvK Zoeken (the
  // official registry) takes precedence.  OpenKvK still runs afterwards and
  // will fill in fields that KvK Zoeken did not populate.
  //
  // Gated on: kvkApiKey present + not a cloud IP + at least one company signal.
  if (kvkApiKey) {
    stages.push({
      ...createKvkZoekenStagedEnricher({ apiKey: kvkApiKey, isDev }),
      stageKey: "kvk-zoeken",
      wave:     2,
    });
  }

  // ── Stage 6: OpenKvK NL  (wave 2) ────────────────────────────────────────
  //
  // Effective mode: if enableOpenKvK is false, hard-override to "off".
  // Otherwise use the explicit openKvKMode or fall back to "nl-only".
  //
  // Depends on: accumulated.countryCode + accumulated.isCloudProvider (both
  // resolved by wave 1 + Cloud Detection sequential stage — safe for wave 2).
  const effectiveOpenKvKMode: OpenKvKMode =
    !enableOpenKvK ? "off" : (openKvKMode ?? "nl-only");

  if (effectiveOpenKvKMode !== "off") {
    const okvkStage = createOpenKvKStagedEnricher({
      isDev,
      mode:                effectiveOpenKvKMode,
      ...(ovioApiKey                 !== undefined ? { apiKey:              ovioApiKey                } : {}),
      ...(openKvKConfidenceThreshold !== undefined ? { confidenceThreshold: openKvKConfidenceThreshold } : {}),
      ...(openKvKMatchingStrategy    !== undefined ? { matchingStrategy:    openKvKMatchingStrategy    } : {}),
    });
    const okvkOrigShouldRun = okvkStage.shouldRun;
    stages.push({
      ...okvkStage,
      stageKey: "openkvk",
      wave:     2,
      // Skip the (separate) KvK API call when the company is already known —
      // e.g. seeded from a recognised visitor's stored firmographics. Otherwise
      // respect the provider's own gating (NL-only, not a cloud IP, …).
      shouldRun: (input, accumulated) =>
        !accumulated.companyName &&
        (okvkOrigShouldRun ? okvkOrigShouldRun(input, accumulated) : true),
    });
  }

  // ── Stage 7: Leadinfo  (wave 2) ───────────────────────────────────────────
  //
  // Reverse-IP company identification.  Gated on isCloudProvider === false
  // (cloud IPs would return the cloud provider's record, not the visitor's).
  //
  // Depends on: accumulated.isCloudProvider (Cloud Detection, sequential)
  // No dependency on OpenKvK or ReverseGeocode — safe for wave 2.
  if (enableLeadinfo && leadinfoApiKey) {
    stages.push({
      // Share the platform-wide IP→company cache so a paid Leadinfo call is
      // skipped for IPs already resolved by any tenant (ads or CMS).
      ...createLeadinfoStagedEnricher({ apiKey: leadinfoApiKey, isDev, persistentCache: ipCompanyCache }),
      stageKey: "leadinfo",
      wave:     2,
    });
  }

  // ── Stage 5: HubSpot CRM ─────────────────────────────────────────────────
  if (enableHubSpot && hubspotAccessToken) {
    const hubspot = new HubSpotCrmProvider({
      accessToken: hubspotAccessToken,
      ...(hubspotApiBase ? { apiBase: hubspotApiBase } : {}),
    });

    stages.push({
      label:    "HubSpot CRM",
      stageKey: "hubspot",

      // Only run when a domain is available from prior stages
      shouldRun: (_input: EnricherInput, accumulated: Partial<EnrichmentOutput>): boolean => {
        return !!(accumulated.companyDomain || accumulated.networkDomain);
      },

      enricher: async (input: EnricherInput, accumulated: Partial<EnrichmentOutput>) => {
        // Prefer companyDomain (from IP-to-company providers) over networkDomain (ISP)
        const domain = accumulated.companyDomain || accumulated.networkDomain;

        if (!domain) return { crmMatched: false };

        if (isDev) {
          console.debug("[hubspot-crm-stage] matching domain", domain);
        }

        // If visitor email is known, prefer email-based match — do NOT cache
        // email-based lookups since contact data may change frequently.
        if (input.email) {
          const result = await hubspot.match(input);
          if (isDev) {
            console.debug("[hubspot-crm-stage] email match result", {
              crmMatched:   result.crmMatched  ?? null,
              crmCompanyId: result.crmCompanyId ?? null,
            });
          }
          return result;
        }

        // ── Domain match with cache ──────────────────────────────────────────
        const domainKey   = domain.toLowerCase();
        const cachedMatch = hubspotDomainCache.get(domainKey);

        if (cachedMatch.hit) {
          if (isDev) {
            console.debug("[hubspot-crm-stage] domain cache hit", { domain });
          }
          return cachedMatch.value;
        }

        const result = await hubspot.matchByDomain(domain);

        if (isDev) {
          console.debug("[hubspot-crm-stage] domain match result", {
            crmMatched:   result.crmMatched  ?? null,
            crmCompanyId: result.crmCompanyId ?? null,
          });
        }

        hubspotDomainCache.set(domainKey, result);
        return result;
      },
    });
  }

  // ── Stage 6: Seasonal Event ───────────────────────────────────────────────
  //
  // Country-aware holiday detection + business-event layer.
  // Runs after all geo/company/CRM stages so countryCode is fully resolved.
  // Gate: skipped when accumulated.countryCode is absent or not in the
  // configured countriesFilter.
  if (enableSeasonalEvents) {
    // Only construct the NagerDateHolidayProvider with custom TTL when no
    // explicit provider override is supplied.
    const provider =
      seasonalEventsProvider ??
      new NagerDateHolidayProvider(
        holidayCacheTtlMs !== undefined ? { cacheTtlMs: holidayCacheTtlMs } : {},
      );

    stages.push({
      ...createSeasonalEventStagedEnricher({
        provider,
        isDev,
        ...(holidayAllowedCountries !== undefined
          ? { allowedCountries: holidayAllowedCountries }
          : {}),
      }),
      stageKey: "seasonal",
    });
  }

  // ── Apply stage config (ordering + activation) ────────────────────────────
  //
  // When `stageConfig` is provided by the caller (loaded from the admin DB
  // via `tenant_pipeline_stages`), two transforms are applied:
  //
  //   1. Disabled stages — any stage whose stageKey is explicitly disabled in
  //      the config is removed from the chain.  Always-on stages (those with
  //      no stageKey: IP Classification, Cloud Detection) are never removed.
  //
  //   2. Ordering within wave — stages that share the same wave and have a
  //      stageKey are sorted by their configured `position`.  Stages without
  //      a stageKey (always-on) keep their original relative position.
  //      Cross-wave ordering is intentionally NOT changed — the wave
  //      assignment is fixed by dependency constraints (wave 2 must follow
  //      wave 1; sequential must follow all waves) and must not be reordered.
  //
  // When `stageConfig` is absent, the hardcoded order above is used as-is.

  if (options.stageConfig && options.stageConfig.length > 0) {
    const cfgMap = new Map(
      options.stageConfig.map((c) => [c.stageKey, c]),
    );

    // Step 1: filter out disabled stages (preserve always-on stages)
    const filtered = stages.filter((s) => {
      if (!s.stageKey) return true; // always-on — never disabled
      const cfg = cfgMap.get(s.stageKey);
      if (!cfg) return true; // not in config — include by default
      return cfg.enabled;
    });

    // Step 2: sort within each wave group by configured position.
    // We use a stable sort: entries without a position keep their original
    // relative order (stable sort preserves insertion order for equal keys).
    filtered.sort((a, b) => {
      // Only reorder when both stages have a stageKey and the same wave
      if (!a.stageKey || !b.stageKey)              return 0;
      if ((a.wave ?? "none") !== (b.wave ?? "none")) return 0;

      const posA = cfgMap.get(a.stageKey)?.position ?? 999;
      const posB = cfgMap.get(b.stageKey)?.position ?? 999;
      return posA - posB;
    });

    return filtered;
  }

  return stages;
}
