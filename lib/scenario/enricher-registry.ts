/**
 * Enricher Registry  —  lib/scenario/enricher-registry.ts
 *
 * Defines the set of enrichers that can be re-triggered from Scenario Control.
 * Each entry describes the enricher's identity, mock response, and which
 * ScenarioOverride fields it produces.
 *
 * ─── Two modes ────────────────────────────────────────────────────────────────
 *
 *   mock  (default in dev/preview)
 *     Returns a realistic pre-defined response — no external API call, no
 *     credentials needed, safe to use in demos.
 *
 *   live  (opt-in)
 *     Calls the real enricher via /api/scenario/enricher. Requires API keys
 *     configured in the tenant settings. Will not corrupt real user data —
 *     the result is stored as a scenario override, not written to the visitor
 *     behavior database.
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 *   Enricher re-run results are ALWAYS stored as ScenarioOverrides.
 *   They never write to the visitor DB, never reach the tracking API, and
 *   they clear automatically when the scenario is reset or the tab closes.
 */

export type EnricherKey =
  | "ip"
  | "company"
  | "openkvk"
  | "leadinfo"
  | "hubspot"
  | "crm"
  | "ga4"
  | "weather"
  | "ads"
  | "all";

export interface EnricherDefinition {
  key:         EnricherKey;
  label:       string;
  description: string;
  icon:        string;
  /** Which enrichment output fields this enricher touches (for display). */
  outputFields: string[];
  /** Realistic demo mock output. */
  mockOutput:  Record<string, unknown>;
}

// ── Enricher definitions ─────────────────────────────────────────────────────

export const ENRICHER_REGISTRY: EnricherDefinition[] = [
  {
    key:         "ip",
    label:       "IP / Geo Lookup",
    description: "Resolves geo location and ISP from visitor IP via IPinfo.",
    icon:        "🌍",
    outputFields: ["countryCode", "region", "city", "latitude", "longitude",
                   "networkOrg", "ipVersion", "isCloudProvider"],
    mockOutput: {
      countryCode:     "NL",
      region:          "Noord-Holland",
      city:            "Amsterdam",
      latitude:        52.37,
      longitude:       4.89,
      networkOrg:      "Amsterdam Internet Exchange",
      networkDomain:   "ams-ix.net",
      networkAsn:      "AS1200",
      ipVersion:       "ipv4",
      isCloudProvider: false,
    },
  },

  {
    key:         "company",
    label:       "Company / Firmographics",
    description: "Resolves company name, domain, industry from IP via Clearbit / Leadinfo.",
    icon:        "🏢",
    outputFields: ["companyName", "companyDomain", "companyIndustry", "companySize",
                   "companyMatchConfidence", "companyMatchSource"],
    mockOutput: {
      companyName:            "ASML",
      companyDomain:          "asml.com",
      companyIndustry:        "Semiconductor Equipment",
      companySize:            "10000+",
      companyMatchConfidence: 0.92,
      companyMatchSource:     "leadinfo",
    },
  },

  {
    key:         "openkvk",
    label:       "OpenKVK (KVK lookup)",
    description: "Dutch Chamber of Commerce lookup via OpenKVK API.",
    icon:        "🇳🇱",
    outputFields: ["companyName", "companyDomain", "companyIndustry", "companySize"],
    mockOutput: {
      companyName:            "ASML Holding N.V.",
      companyDomain:          "asml.com",
      companyIndustry:        "Semiconductor manufacturing",
      companySize:            "10000+",
      companyMatchConfidence: 0.88,
      companyMatchSource:     "openkvk",
    },
  },

  {
    key:         "leadinfo",
    label:       "Leadinfo (dataLayer)",
    description: "Company firmographics from Leadinfo (read from the mc_li cookie set via the dataLayer).",
    icon:        "🔍",
    outputFields: ["leadinfoMatched", "leadinfoCompanyName", "leadinfoCompanyDomain",
                   "leadinfoCompanyCountry", "leadinfoCocNumber", "leadinfoBranchCode",
                   "leadinfoBranchCodeSic87", "leadinfoSalesVolume", "leadinfoEmployees",
                   "leadinfoEmployeesTotal"],
    mockOutput: {
      leadinfoMatched:         true,
      leadinfoCompanyName:     "Steets B.V.",
      leadinfoCompanyDomain:   "steets.nl",
      leadinfoCompanyCountry:  "NL",
      leadinfoCocNumber:       "32094701",
      leadinfoBranchCode:      "73110",
      leadinfoBranchCodeSic87: "7311",
      leadinfoSalesVolume:     "378106",
      leadinfoEmployees:       "52",
      leadinfoEmployeesTotal:  21,
    },
  },

  {
    key:         "hubspot",
    label:       "HubSpot CRM",
    description: "Matches visitor email / domain against HubSpot contacts and companies.",
    icon:        "🟠",
    outputFields: ["crmMatched", "crmLifecycleStage", "crmDealStage", "crmSegment",
                   "crmCompanyName", "crmCompanyDomain", "crmPlanTier"],
    mockOutput: {
      crmMatched:        true,
      crmLifecycleStage: "sql",
      crmSegment:        "enterprise",
      crmCompanyName:    "ASML",
      crmCompanyDomain:  "asml.com",
      crmDealStage:      "proposal",
      crmPlanTier:       "pro",
      crmContractValue:  25000,
      crmIsCustomer:     false,
    },
  },

  {
    key:         "crm",
    label:       "CRM (generic)",
    description: "Runs the configured CRM enricher (HubSpot, Salesforce, Pipedrive).",
    icon:        "📊",
    outputFields: ["crmMatched", "crmLifecycleStage", "crmDealStage", "crmSegment",
                   "targetAccountMatched", "targetAccountTier"],
    mockOutput: {
      crmMatched:          true,
      crmLifecycleStage:   "mql",
      crmSegment:          "mid-market",
      crmDealStage:        "discovery",
      targetAccountMatched: true,
      targetAccountTier:   "tier-2",
      targetAccountList:   "key-accounts-q2-2026",
    },
  },

  {
    key:         "ga4",
    label:       "GA4 Analytics History",
    description: "Retrieves visitor session history and channel data from GA4.",
    icon:        "📈",
    outputFields: ["gaCurrentCity", "gaCurrentRegion", "gaCurrentCountry",
                   "gaCurrentChannelGroup", "gaSessionCount", "gaLastChannelGroup"],
    mockOutput: {
      gaCurrentCity:         "Amsterdam",
      gaCurrentRegion:       "Noord-Holland",
      gaCurrentCountry:      "Netherlands",
      gaCurrentChannelGroup: "Organic Search",
      gaSessionCount:        4,
      gaLastChannelGroup:    "Direct",
      gaHistorySource:       "ga4",
    },
  },

  {
    key:         "weather",
    label:       "Weather Lookup",
    description: "Fetches current weather conditions for the visitor's location via Open-Meteo.",
    icon:        "🌤",
    outputFields: ["weatherCode", "temperatureNow", "precipitationProbability",
                   "isRaining", "windSpeed", "cloudCover", "weatherSummary"],
    mockOutput: {
      weatherCode:              3,       // partly cloudy
      temperatureNow:           12.4,
      precipitationProbability: 35,
      isRaining:                false,
      windSpeed:                18.0,
      cloudCover:               72,
      weatherSummary:           "Partly cloudy, 12°C, 18 km/h wind",
      weatherSource:            "open-meteo",
    },
  },

  {
    key:         "ads",
    label:       "Ads Attribution",
    description: "Extracts ad campaign / keyword attribution from UTM parameters.",
    icon:        "📢",
    outputFields: ["adCampaign", "adAdGroup", "adKeyword"],
    mockOutput: {
      adCampaign: "brand-search-nl-q2",
      adAdGroup:  "mister-chameleon-brand",
      adKeyword:  "personalisatie platform",
    },
  },
];

/** Map for O(1) lookup by key. */
export const ENRICHER_BY_KEY: Record<string, EnricherDefinition> =
  Object.fromEntries(ENRICHER_REGISTRY.map((e) => [e.key, e]));

/**
 * Returns a merged mock output for "all enrichers".
 * Later entries in ENRICHER_REGISTRY overwrite earlier ones for the same key.
 */
export function getAllMockOutput(): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const def of ENRICHER_REGISTRY) {
    if (def.key === "all") continue;
    Object.assign(merged, def.mockOutput);
  }
  return merged;
}
