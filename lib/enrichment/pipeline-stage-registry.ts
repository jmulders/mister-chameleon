/**
 * Enrichment Pipeline Stage Registry
 *
 * Canonical list of all user-configurable enrichment stages.  Used by:
 *
 *   • The admin pipeline configurator UI (to render the stage list, labels,
 *     descriptions, and dependency warnings).
 *   • `buildCompanyCrmChain` (to apply `stageConfig` ordering + enabled flags
 *     to the assembled chain).
 *   • DB seeding (to backfill the default pipeline config for new tenants).
 *
 * ─── Always-on stages ─────────────────────────────────────────────────────────
 *
 *   IP Classification and Cloud Detection are always-on internal stages:
 *   they have no `stageKey`, are never shown in the admin UI, and cannot be
 *   disabled.  They are not listed here.
 *
 * ─── Wave grouping ────────────────────────────────────────────────────────────
 *
 *   Stages within the same wave run in parallel.  The wave assignment is fixed
 *   by dependency constraints and cannot be changed by the admin.  The admin
 *   can only reorder stages within their wave group and enable/disable them.
 *
 *   Wave 1 (parallel)   MaxMind, IPinfo, GA4
 *   Wave 2 (parallel)   Reverse Geocode, Weather, OpenKvK, Leadinfo
 *   Sequential          HubSpot CRM, Seasonal Event
 *
 * ─── Default positions ────────────────────────────────────────────────────────
 *
 *   `defaultPosition` reflects the hardcoded order in `buildCompanyCrmChain`.
 *   When no DB config exists for a tenant, the pipeline runs in default order.
 *   Positions are 1-indexed within each wave group.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineWave = 1 | 2 | "sequential";

export interface PipelineStageDefinition {
  /** Machine-readable key — stored in DB, used as stageKey on StagedEnricher. */
  key:              string;
  /** Human-readable label shown in admin UI. */
  label:            string;
  /** Short description shown in admin UI. */
  description:      string;
  /**
   * Execution group.
   *   1           — Wave 1 parallel group (runs first, in parallel)
   *   2           — Wave 2 parallel group (runs after wave 1, in parallel)
   *   "sequential"— Runs sequentially after all wave groups complete
   */
  wave:             PipelineWave;
  /**
   * Default position within the wave group (1-indexed).
   * Determines ordering when no DB config exists for a tenant.
   */
  defaultPosition:  number;
  /**
   * Whether this stage requires external credentials to operate.
   * Stages with `requiresCredentials: true` are automatically skipped when
   * the relevant API key / DB path is not configured — regardless of the
   * enabled flag.
   */
  requiresCredentials: boolean;
  /**
   * Whether this stage is enabled by default for new tenants.
   * Stages that require credentials start as disabled (false) because the
   * credentials may not be configured.
   */
  defaultEnabled:   boolean;
  /**
   * Emoji icon shown in the admin UI list.
   */
  icon:             string;
  /**
   * Short description of what data the stage adds to the enrichment output.
   */
  outputSummary:    string;
  /**
   * Stage keys that must run before this stage for correct output.
   * Used by the UI to display dependency warnings when reordering.
   */
  dependsOn:        string[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const PIPELINE_STAGE_REGISTRY: PipelineStageDefinition[] = [
  // ── Wave 1 ──────────────────────────────────────────────────────────────────
  {
    key:                  "maxmind",
    label:                "MaxMind GeoIP",
    description:          "Resolves visitor IP to country, region, city, and coordinates using the local MaxMind GeoLite2 database.",
    wave:                 1,
    defaultPosition:      1,
    requiresCredentials:  true,
    defaultEnabled:       true,
    icon:                 "🌍",
    outputSummary:        "countryCode, region, city, latitude, longitude",
    dependsOn:            [],
  },
  {
    key:                  "ipinfo",
    label:                "IPinfo Lite",
    description:          "Enriches IP with ASN, network organisation, and ISP domain. Also provides geo fallback when MaxMind is not configured.",
    wave:                 1,
    defaultPosition:      2,
    requiresCredentials:  true,
    defaultEnabled:       true,
    icon:                 "🔍",
    outputSummary:        "networkAsn, networkOrg, networkDomain (+ geo fallback)",
    dependsOn:            [],
  },
  {
    key:                  "ga4",
    label:                "GA4 History",
    description:          "Queries Google Analytics 4 for prior session signals for this visitor: last-known city, session count, acquisition channel.",
    wave:                 1,
    defaultPosition:      3,
    requiresCredentials:  true,
    defaultEnabled:       false,
    icon:                 "📊",
    outputSummary:        "gaLastKnownCity, gaSessionCount, gaLastChannelGroup",
    dependsOn:            [],
  },

  // ── Wave 2 ──────────────────────────────────────────────────────────────────
  {
    key:                  "reverse-geo",
    label:                "Reverse Geocode",
    description:          "Converts lat/lng coordinates into structured address fields (country, region, postcode). Provider chain: LocationIQ → BigDataCloud → Nominatim.",
    wave:                 2,
    defaultPosition:      1,
    requiresCredentials:  false,
    defaultEnabled:       false,
    icon:                 "📍",
    outputSummary:        "addressCountry, addressRegion, addressCity, addressPostcode",
    dependsOn:            ["maxmind", "ipinfo"],
  },
  {
    key:                  "weather",
    label:                "Weather",
    description:          "Fetches current weather conditions at the visitor's coordinates using the free Open-Meteo API. No API key required.",
    wave:                 2,
    defaultPosition:      2,
    requiresCredentials:  false,
    defaultEnabled:       false,
    icon:                 "🌤",
    outputSummary:        "weatherCode, temperatureNow, isRaining, windSpeed",
    dependsOn:            ["maxmind", "ipinfo"],
  },
  {
    key:                  "openkvk",
    label:                "OpenKvK (NL)",
    description:          "Looks up Dutch company information from the KvK registry using the visitor's network organisation name. Only runs for NL visitors.",
    wave:                 2,
    defaultPosition:      3,
    requiresCredentials:  false,
    defaultEnabled:       true,
    icon:                 "🏢",
    outputSummary:        "companyName, companyDomain (NL visitors only)",
    dependsOn:            ["maxmind", "ipinfo"],
  },
  {
    key:                  "leadinfo",
    label:                "Leadinfo",
    description:          "Reverse-IP company identification via the Leadinfo API. Identifies the company behind the visitor's IP address. Requires a Leadinfo API key.",
    wave:                 2,
    defaultPosition:      4,
    requiresCredentials:  true,
    defaultEnabled:       false,
    icon:                 "🏭",
    outputSummary:        "companyName, companyDomain, companyIndustry, companySize",
    dependsOn:            [],
  },

  // ── Sequential ───────────────────────────────────────────────────────────────
  {
    key:                  "hubspot",
    label:                "HubSpot CRM",
    description:          "Matches the visitor's company domain or email against HubSpot contacts and companies. Returns lifecycle stage, deal info, and CRM IDs.",
    wave:                 "sequential",
    defaultPosition:      1,
    requiresCredentials:  true,
    defaultEnabled:       false,
    icon:                 "🟠",
    outputSummary:        "crmMatched, crmLifecycleStage, crmIsCustomer, crmCompanyId",
    dependsOn:            ["leadinfo", "openkvk"],
  },
  {
    key:                  "seasonal",
    label:                "Seasonal Events",
    description:          "Detects public holidays and business events (quarter-end, budget season, summer) for the visitor's country using the Nager.Date API.",
    wave:                 "sequential",
    defaultPosition:      2,
    requiresCredentials:  false,
    defaultEnabled:       true,
    icon:                 "📅",
    outputSummary:        "seasonalEvent, holidayName, seasonalSource",
    dependsOn:            ["maxmind", "ipinfo"],
  },
  {
    key:                  "cbs-location",
    label:                "Location (CBS buurt)",
    description:          "Adds NL neighbourhood statistics (density-derived urbanity, income band, business share) from CBS 'Kerncijfers wijken en buurten' open data, resolving the visitor's buurt from lat/lng via PDOK. NL visitors only.",
    wave:                 "sequential",
    defaultPosition:      3,
    requiresCredentials:  false,
    defaultEnabled:       false,
    icon:                 "🗺",
    outputSummary:        "locationAreaCode, locationUrbanityClass, locationIncomeBand, locationBusinessShare",
    dependsOn:            ["maxmind", "ipinfo"],
  },
];

/** Map for O(1) lookup by key. */
export const PIPELINE_STAGE_BY_KEY = new Map(
  PIPELINE_STAGE_REGISTRY.map((s) => [s.key, s]),
);

/**
 * Default pipeline config — used when no DB entry exists for a tenant.
 * Returns stages in default order with default enabled flags.
 */
export function getDefaultPipelineConfig(): Array<{
  stageKey: string;
  position: number;
  enabled:  boolean;
}> {
  return PIPELINE_STAGE_REGISTRY.map((s) => ({
    stageKey: s.key,
    position: s.defaultPosition,
    enabled:  s.defaultEnabled,
  }));
}
