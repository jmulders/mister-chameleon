/**
 * Enrichment Layer — Core Types
 *
 * Zero project imports. This file is the foundation of the enrichment layer;
 * every other enrichment file imports from here, so it must remain free of
 * circular-dependency risk.
 *
 * ─── Architecture overview ───────────────────────────────────────────────────
 *
 *   EnrichmentOutput   — flat interface of all possible enrichment fields
 *   EnricherInput      — what every enricher receives (request signals, tenant)
 *   Enricher           — the generic enricher contract
 *   PipelineOptions    — per-pipeline knobs (timeoutMs, logger)
 *   EnrichmentPipelineResult — what runEnrichmentPipeline() returns
 *
 * ─── Enrichment domains ──────────────────────────────────────────────────────
 *
 *   Geo                — country, region, city (from IP or CDN headers)
 *   Network            — ASN, org name, network domain (from IPinfo Lite)
 *   Company            — firmographic reverse-IP lookup (Clearbit, Leadinfo, …)
 *   Ads attribution    — ad campaign / ad group / keyword from UTM or platform API
 *   CRM match          — lifecycle stage, segment, account owner from CRM
 *   Account list match — target account tier + list membership (ABM)
 *
 * ─── Fail-safe design ────────────────────────────────────────────────────────
 *
 *   Each enricher runs inside a Promise.race() with a per-enricher timeout.
 *   Failures and timeouts produce `{}` (empty partial) — never an exception.
 *   The pipeline result always resolves; it never rejects.
 */

// ── EnrichmentOutput ──────────────────────────────────────────────────────────

/**
 * Flat union of every field any enricher may produce.
 * All fields are optional — only resolved fields are present in the output.
 *
 * Stored on DecisionContext as `enrichment: Partial<EnrichmentOutput>`.
 * Field resolvers access individual keys via `ctx.enrichment?.field ?? null`.
 */
export interface EnrichmentOutput {
  // ── Geo (from IP / CDN edge headers) ───────────────────────────────────────
  /** ISO 3166-1 alpha-2 country code, e.g. "NL", "US", "DE". */
  countryCode:   string | null;
  /** State / province / region name, e.g. "Noord-Holland". */
  region:        string | null;
  /** City name, e.g. "Amsterdam". */
  city:          string | null;

  // ── Network / ISP (from IPinfo Lite) ───────────────────────────────────────
  /**
   * Autonomous System Number string, e.g. "AS15169".
   * Null when the IP's ASN is unknown or the provider was not run.
   */
  networkAsn:    string | null;
  /**
   * Human-readable organization name from the ASN record, e.g. "Google LLC".
   * Parsed from IPinfo's `org` field (format: "AS15169 Google LLC").
   */
  networkOrg:    string | null;
  /**
   * Domain associated with the network organization, e.g. "google.com".
   * Derived from IPinfo's `hostname` or inferred from the org name.
   */
  networkDomain: string | null;

  // ── Company identification (reverse-IP firmographics) ───────────────────────
  /** Company display name, e.g. "Acme Corp". */
  companyName:   string | null;
  /** Primary domain, e.g. "acme.com". */
  companyDomain: string | null;
  /** Industry vertical, e.g. "Software", "Financial Services". */
  companyIndustry: string | null;
  /**
   * Employee size bucket.
   * e.g. "1-10", "11-50", "51-200", "201-1000", "1001-5000", "5001+".
   */
  companySize:   string | null;
  /**
   * Confidence score for the company match, 0–1.
   * Null if no match attempted or provider does not supply a score.
   */
  companyMatchConfidence: number | null;
  /**
   * Which provider or signal produced the company match.
   * e.g. "clearbit", "6sense", "ip2company", "reverse-dns".
   */
  companyMatchSource: string | null;

  // ── Ads attribution (UTM / platform API) ───────────────────────────────────
  /** Ad platform campaign name or ID, e.g. "spring-2025-brand". */
  adCampaign:  string | null;
  /** Ad group / ad set name, e.g. "brand-exact-match". */
  adAdGroup:   string | null;
  /** Search keyword that triggered the ad, e.g. "crm software". */
  adKeyword:   string | null;

  // ── CRM match ──────────────────────────────────────────────────────────────
  /** Whether a CRM contact or company record was matched for this visitor. */
  crmMatched:       boolean | null;
  /**
   * HubSpot / Salesforce lifecycle stage, e.g.
   * "subscriber", "lead", "mql", "sql", "opportunity", "customer".
   */
  crmLifecycleStage: string | null;
  /** Marketing segment label from the CRM, e.g. "enterprise-prospect". */
  crmSegment:        string | null;
  /** Name of the account owner / SDR from the CRM. */
  crmAccountOwner:   string | null;

  // ── CRM — company match (HubSpot company-by-domain) ────────────────────────
  /** HubSpot Company object ID, e.g. "12345678". */
  crmCompanyId:     string | null;
  /** Company name from CRM, e.g. "Acme Corp". */
  crmCompanyName:   string | null;
  /** Primary domain from CRM, e.g. "acme.com". */
  crmCompanyDomain: string | null;
  /** Industry from CRM, e.g. "SOFTWARE", "FINANCIAL_SERVICES". */
  crmIndustry:      string | null;
  /** True when the CRM lifecycle stage is "customer". */
  crmIsCustomer:    boolean | null;

  // ── CRM — extended contact / deal fields ──────────────────────────────────
  /** CRM contact ID (HubSpot contact ID, Salesforce contact/lead ID). */
  crmContactId:       string | null;
  /** CRM account / company ID (HubSpot companyId, Salesforce accountId). */
  crmAccountId:       string | null;
  /** Current deal or opportunity stage, e.g. "Proposal", "Negotiation". */
  crmDealStage:       string | null;
  /** Subscription plan tier, e.g. "basic", "pro", "enterprise". */
  crmPlanTier:        string | null;
  /** Annual contract value in platform currency. */
  crmContractValue:   number | null;
  /** ISO-8601 date when the contact became a customer. */
  crmCustomerSince:   string | null;
  /** ISO-8601 timestamp of the most recent CRM activity for this contact. */
  crmLastActivityAt:  string | null;

  // ── Account list match (ABM) ───────────────────────────────────────────────
  /** Whether this visitor's company is on a target account list. */
  targetAccountMatched: boolean | null;
  /**
   * Account tier label, e.g. "tier-1", "tier-2", "tier-3".
   * Null when not on any list.
   */
  targetAccountTier:    string | null;
  /**
   * Name of the account list that was matched,
   * e.g. "Q2-2025-ICP" or "named-accounts-emea".
   */
  targetAccountList:    string | null;

  // ── IP classification ──────────────────────────────────────────────────────
  /**
   * IP address family of the visitor's request IP.
   *   "ipv4"  — standard dotted-decimal address (e.g. "8.8.8.8")
   *   "ipv6"  — any address containing a colon, including compressed forms
   *             (e.g. "2001:4860:7:21f::ff") and IPv4-mapped ("::ffff:x.x.x.x")
   * Null when the request IP is absent or cannot be classified.
   */
  ipVersion: "ipv4" | "ipv6" | null;

  /**
   * True when the visitor's network signals (ASN or org name) match a known
   * cloud hosting provider, CDN, or datacenter.
   *
   * When true, company-identification stages (OpenKvK, Leadinfo) should be
   * skipped — they would return the cloud provider's company record rather than
   * the actual visitor's employer.
   *
   * Null when IPinfo has not run or no network signals are available.
   */
  isCloudProvider: boolean | null;

  // ── Geo coordinates (from IP-based geo lookup) ─────────────────────────────
  /**
   * Approximate latitude resolved from the visitor's IP address.
   * City-level precision only (≈ 10–50 km radius).  Null when no geo provider
   * returned coordinate data.
   */
  latitude:  number | null;
  /**
   * Approximate longitude resolved from the visitor's IP address.
   * City-level precision only (≈ 10–50 km radius).  Null when no geo provider
   * returned coordinate data.
   */
  longitude: number | null;

  // ── Reverse geocode (human-readable address from lat/lng) ───────────────────
  /**
   * ISO 3166-1 alpha-2 country code from the reverse-geocode lookup.
   * May differ from `countryCode` (which is IP-derived) when the lat/lng
   * provider returns a more precise location.
   */
  addressCountry:      string | null;
  /** State, province, or region name, e.g. "Noord-Holland". */
  addressRegion:       string | null;
  /** City name from reverse-geocode, e.g. "Amsterdam". */
  addressCity:         string | null;
  /**
   * Municipality or district name.  May differ from `addressCity` in areas
   * where the city is part of a larger municipality.
   */
  addressMunicipality: string | null;
  /** Postal / ZIP code, e.g. "1012". */
  addressPostcode:     string | null;
  /**
   * Full human-readable formatted address, e.g.
   * "Nieuwezijds Voorburgwal, Amsterdam, Noord-Holland, Netherlands".
   * Useful as a display label or as supplementary input to downstream scoring.
   */
  addressFormatted:    string | null;
  /**
   * Which reverse-geocode provider produced the address fields.
   * Values: "locationiq" | "bigdatacloud" | "nominatim".
   * Null when the enricher was not run or all providers failed.
   */
  addressSource:       string | null;

  // ── First-party location (CBS StatLine buurt statistics) ────────────────────
  /** CBS buurtcode the location stats were resolved for, e.g. "BU03630000". */
  locationAreaCode:       string | null;
  /**
   * CBS urbanity class (MateVanStedelijkheid) for the buurt: 1 (zeer sterk
   * stedelijk) .. 5 (niet stedelijk). Falls back to a density-derived band when
   * CBS suppresses the official class.
   */
  locationUrbanityClass:  number | null;
  /** Coarse average-income band for the buurt, e.g. "low" | "mid" | "high". */
  locationIncomeBand:     string | null;
  /** Share of business establishments per inhabitant in the buurt (0..1). */
  locationBusinessShare:  number | null;
  /**
   * Confidence in the resolved location. "high" when the buurt came from a
   * precise, coherent signal (form postcode, or IP coordinates whose reverse-
   * geocoded city agrees with the resolved city). "low" when it was resolved via
   * a coarse fallback — a city/place centroid, the GA4 city, or (crucially) when
   * the IP city and IP coordinates disagreed and we fell back to the city. Rules
   * and downstream consumers should treat "low" cautiously.
   */
  locationConfidence:     "high" | "low" | null;
  /**
   * True when the IP-geo city (e.g. IPinfo "Veenendaal") and the reverse-geocoded
   * city of the IP coordinates (e.g. MaxMind coords → "Rotterdam") disagreed —
   * MaxMind and IPinfo are independent providers and their per-field precedence
   * can leave city and coordinates pointing at different places. On a mismatch the
   * CBS stage resolves the buurt via the (more reliable) city, not the coordinates.
   */
  locationCityCoordMismatch: boolean | null;

  // ── Geo provenance (which provider set which field) ─────────────────────────
  // Persisted on the output (not just the transient stage trace) so the /demo
  // debug shows it even on a session-cache hit. Explicit per-field precedence:
  // IPinfo city/region > MaxMind (its NL city is usually better); coordinates take
  // IPinfo's `loc` when present, else MaxMind's coarser GeoLite2 coordinates.
  /** Provider that set the winning `city` — "ipinfo" | "maxmind" | "geo:headers". */
  geoCitySource:   string | null;
  /** Provider that set the winning `latitude`/`longitude` — "ipinfo" | "maxmind". */
  geoCoordsSource: string | null;

  // ── Weather (from Open-Meteo) ───────────────────────────────────────────────
  /**
   * WMO Weather interpretation code for the visitor's current location.
   * Standard codes: 0 = clear sky, 1–3 = partly cloudy, 45/48 = fog,
   * 51–67 = drizzle/rain, 71–77 = snow, 80–82 = showers, 95/96/99 = thunder.
   * Null when weather enrichment is disabled or coordinates unavailable.
   */
  weatherCode:                number | null;
  /**
   * Current air temperature at 2 m height, in degrees Celsius.
   * Rounded to one decimal place.
   */
  temperatureNow:             number | null;
  /**
   * Hourly precipitation probability (0–100 %).
   * Derived from Open-Meteo `precipitation_probability` field.
   */
  precipitationProbability:   number | null;
  /**
   * True when `weatherCode` indicates active precipitation
   * (drizzle, rain, freezing rain, snow, showers, or thunderstorm).
   */
  isRaining:                  boolean | null;
  /**
   * Wind speed at 10 m height, in km/h, rounded to one decimal place.
   */
  windSpeed:                  number | null;
  /**
   * Sky / cloud cover percentage (0–100 %).
   */
  cloudCover:                 number | null;
  /**
   * Human-readable weather summary, e.g.
   * "Partly cloudy, 8°C, 15 km/h wind".
   * Suitable as an AI context hint or display label.
   */
  weatherSummary:             string | null;
  /**
   * Provider that produced the weather data.
   * Currently always "open-meteo" when the stage runs successfully.
   * Null when weather enrichment was skipped or failed.
   */
  weatherSource:              string | null;

  // ── GA4 Analytics History (historical visitor signals from Google Analytics) ─
  //
  // Two distinct pairs of fields separate the most-recent session's data from
  // a prior session's data:
  //
  //   gaCurrent*    — location / channel from the visitor's most recent GA4 session
  //                   (the latest date row returned by the Data API).
  //   gaLastKnown*  — location / channel from a previous session (the second-most-
  //                   recent date row).  Null when only one date-row exists, meaning
  //                   we have no distinct "previous" record to compare against.
  //
  // This lets downstream rules and AI context distinguish "where the visitor is
  // right now" from "where they were last time we saw them".

  /**
   * City from the visitor's most-recent GA4 session (latest date row).
   * Null when no GA4 history is available.
   */
  gaCurrentCity:      string | null;
  /**
   * Region (state / province) from the visitor's most-recent GA4 session.
   * Null when no GA4 history is available.
   */
  gaCurrentRegion:    string | null;
  /**
   * Country from the visitor's most-recent GA4 session (e.g. "Netherlands").
   * Human-readable name as returned by GA4, not an ISO code.
   * Null when no GA4 history is available.
   */
  gaCurrentCountry:   string | null;
  /**
   * Default Channel Group from the visitor's most-recent GA4 session,
   * e.g. "Organic Search", "Direct", "Paid Search", "Email", "Referral".
   * Null when no GA4 history is available.
   */
  gaCurrentChannelGroup: string | null;

  /**
   * City from a previous GA4 session (the second-most-recent date row).
   * Null when only one date-row exists (no distinct previous session available).
   */
  gaLastKnownCity:    string | null;
  /**
   * Region from a previous GA4 session.
   * Null when only one date-row exists.
   */
  gaLastKnownRegion:  string | null;
  /**
   * Country from a previous GA4 session (e.g. "Netherlands").
   * Null when only one date-row exists.
   */
  gaLastKnownCountry: string | null;
  /**
   * Default Channel Group from a previous GA4 session.
   * Null when only one date-row exists.
   */
  gaLastChannelGroup: string | null;

  /**
   * Total number of GA4 sessions recorded for this visitor within the configured
   * lookback window (default 90 days).  Null when no sessions are found or the
   * GA4 stage did not run.
   */
  gaSessionCount:     number | null;
  /**
   * Number of date-rows returned by the GA4 Data API for this visitor.
   * 0 = visitor not yet seen in GA4; 1 = only a current row; ≥2 = current + previous.
   * Null when the GA4 stage did not run.
   */
  gaRowsReturned:     number | null;
  /**
   * Which source produced the GA4 history fields.
   * Currently always "ga4" when the stage runs successfully.
   * Null when the GA4 History stage was not run or produced no results.
   */
  gaHistorySource:    string | null;

  // ── Leadinfo client-side enrichment ───────────────────────────────────────

  /**
   * True when the Leadinfo client-side identify call succeeded and returned
   * a company match for this visitor.  False on a definitive no-match.
   * Null when the Leadinfo stage did not run (disabled, error, or not yet
   * collected).
   */
  leadinfoMatched: boolean | null;

  /**
   * Leadinfo internal company ID, e.g. "li_abc123".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoCompanyId: string | null;

  /**
   * Company display name from Leadinfo, e.g. "Acme Corp".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoCompanyName: string | null;

  /**
   * City from Leadinfo company record, e.g. "Amsterdam".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoCompanyCity: string | null;

  /**
   * Primary domain from Leadinfo company record, e.g. "acme.com".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoCompanyDomain: string | null;

  /**
   * ISO 3166-1 alpha-2 country code from Leadinfo, e.g. "NL", "DE".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoCompanyCountry: string | null;

  /**
   * Employee size bucket as returned by Leadinfo, e.g. "11-50", "51-200".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoEmployees: string | null;

  /**
   * Total employee count (integer) from Leadinfo.
   * Null when no match or Leadinfo was not run.
   */
  leadinfoEmployeesTotal: number | null;

  /**
   * Annual sales volume bucket from Leadinfo, e.g. "1M-10M".
   * Null when no match or Leadinfo was not run.
   */
  leadinfoSalesVolume: string | null;

  /**
   * Dutch Chamber of Commerce (KvK) number from Leadinfo, e.g. "12345678".
   * Only present for NL companies.  Null otherwise or when Leadinfo was not run.
   */
  leadinfoCocNumber: string | null;

  /**
   * Industry branch code from Leadinfo (SBI code for NL, NACE for EU).
   * Null when no match or Leadinfo was not run.
   */
  leadinfoBranchCode: string | null;

  /**
   * SIC-87 industry branch code from Leadinfo (international standard).
   * Null when no match or Leadinfo was not run.
   */
  leadinfoBranchCodeSic87: string | null;

  // ── Lead Base — returning-visitor signals (from the stored profile) ─────────
  //
  // Loaded from visitor_profiles at request time so the personalization engine
  // (rules / segments / AI) can adapt the site for someone we already know —
  // closing the loop between what we captured and what we show. Null/false on a
  // first-ever visit (no prior profile yet). See docs/lead-base-design.md.

  /** True when this visitor has a prior stored profile (visited before). */
  isReturningVisitor: boolean | null;
  /** Prior identity level: 'anonymous' | 'recognised' | 'known' | 'customer'. */
  returningLeadLevel: string | null;
  /** Prior lifecycle status: visitor | engaged | mql | sql | customer | churned. */
  returningLeadStatus: string | null;
  /** Composite hot-lead score (0–100) computed from the stored profile. */
  leadScore: number | null;
  /** True when leadScore clears the hot threshold (default 60). */
  isHotLead: boolean | null;
  /** True when the stored profile is a named (known) lead or a customer. */
  isKnownLead: boolean | null;
  /** True when the stored profile is a customer. */
  isCustomer: boolean | null;
  /** Visit count recorded before this request. */
  priorVisitCount: number | null;
  /** Whole days since the visitor's previous visit (null on first visit). */
  daysSinceLastVisit: number | null;

  // ── Normalized current location (GA4 preferred; IP geo fallback) ───────────
  //
  // These four fields provide a single, authoritative "where is the visitor now"
  // answer, abstracting over the two possible sources:
  //
  //   GA4 history  — gaCurrentCity / gaCurrentRegion / gaCurrentCountry
  //                  Most accurate for human-readable city/region/country names
  //                  because GA4 derives location from Google's own signals.
  //                  Always preferred when available.
  //
  //   IP geo       — city / region / countryCode (from MaxMind / CDN headers)
  //                  Used when GA4 history is unavailable or the stage was skipped.
  //                  Typically provides an ISO country code ("NL") rather than a
  //                  human-readable name ("Netherlands") for the country field.
  //
  // NOTE: IP-based geo ALWAYS runs independently — these normalized fields never
  //       suppress it.  IP geo is still needed for latitude/longitude,
  //       networkAsn, networkOrg, networkDomain, and company enrichment.

  /**
   * Best-available current city name for display and rules.
   *
   * Source precedence:
   *   1. gaCurrentCity  — from the visitor's most-recent GA4 session
   *   2. city           — from IP-based geo (MaxMind / CDN headers)
   *   Null when neither source produced a value.
   */
  currentCity:    string | null;

  /**
   * Best-available current region (state / province) for display and rules.
   *
   * Source precedence:
   *   1. gaCurrentRegion  — from the visitor's most-recent GA4 session
   *   2. region           — from IP-based geo
   *   Null when neither source produced a value.
   */
  currentRegion:  string | null;

  /**
   * Best-available current country for display and rules.
   *
   * Source precedence:
   *   1. gaCurrentCountry — human-readable name from GA4, e.g. "Netherlands"
   *   2. countryCode      — ISO 3166-1 alpha-2 code from IP geo, e.g. "NL"
   *   Null when neither source produced a value.
   *
   * Note: format differs by source — GA4 gives a human-readable name while the
   * IP geo fallback gives an ISO 2-letter code.  `currentLocationSource` tells
   * consumers which format is active.
   */
  currentCountry: string | null;

  /**
   * Which source produced the current* location fields.
   *
   *   "ga4"    — currentCity / currentRegion / currentCountry were populated
   *              from GA4 Analytics History (gaCurrentCity/Region/Country).
   *              The visitor's most-recent GA4 session was used.
   *
   *   "ip_geo" — GA4 history was unavailable (stage skipped, no rows, or not
   *              configured).  current* fields were populated from the IP-based
   *              geo stage (city / region / countryCode).
   *
   *   null     — no location data was resolved from either source; all
   *              current* fields are also null.
   */
  currentLocationSource: "ga4" | "ip_geo" | null;

  // ── Seasonal event (country-aware enrichment override) ─────────────────────
  /**
   * Country-aware seasonal event resolved by the holiday enrichment stage.
   *
   * When non-null, this value overrides the statically computed seasonalEvent
   * from `buildTimeContext` (which is date-only with no country awareness).
   * Consumers in `buildDecisionContext` apply this override after the pipeline
   * completes.
   *
   * Matches the SeasonalEvent type values ("christmas", "new-year", "easter",
   * "black-friday", "cyber-monday", "back-to-school", "none", …).
   * Typed as `string | null` here to avoid importing from context/time.ts
   * (this file has zero project imports).
   */
  seasonalEvent:   string | null;
  /**
   * Localised name of the public holiday that produced the seasonalEvent,
   * e.g. "Eerste Kerstdag" (NL Christmas) or "Noël" (FR Christmas).
   * Null when the event was produced by the business-event layer (date math)
   * rather than a holiday API.
   */
  holidayName:     string | null;
  /**
   * Which source produced the seasonalEvent value:
   *   "nager-date"      — Nager.Date public holiday API
   *   "business-events" — date-math business event layer (Black Friday, etc.)
   * Null when no commercial event was detected (event will be "none").
   */
  seasonalSource:  string | null;
}

// ── EnrichmentFieldTrace ──────────────────────────────────────────────────────

/**
 * Provenance record for a single resolved enrichment field.
 *
 * Attached as a parallel map alongside `EnrichmentOutput` so that the debug
 * overlay can show *which provider produced* each field and *whether a cache
 * was used*, without restructuring the flat `EnrichmentOutput` interface.
 *
 * One entry per field key of `EnrichmentOutput` that was actually resolved.
 */
export interface EnrichmentFieldTrace {
  /**
   * The stage label that produced this field.
   * Matches `StagedEnricher.label`, e.g. "geo:headers", "IPinfo Lite".
   */
  provider: string;
  /**
   * Human-readable data source, e.g. "CDN header", "ipinfo.io API",
   * "Nager.Date API", "date-math (business events)".
   */
  source: string;
  /**
   * Session-level cache status:
   *   "hit"  — value came from the in-process session enrichment cache
   *            (the full pipeline was skipped for this session)
   *   "miss" — pipeline ran fresh; no usable session-cache entry was found
   *   "n/a"  — not applicable (e.g. CDN-header geo has no cache concept)
   */
  cacheStatus: "hit" | "miss" | "n/a";
  /**
   * Which keys of `EnricherInput` this stage actually consumed.
   * e.g. ["ip"] for geo stages, ["countryCode"] for seasonal-event.
   */
  inputsUsed: string[];
}

/**
 * A parallel map from enrichment field keys → their provenance trace.
 * Only fields that were actually resolved (non-null output) are present.
 */
export type EnrichmentTrace = Partial<Record<keyof EnrichmentOutput, EnrichmentFieldTrace>>;

// ── EnricherInput ─────────────────────────────────────────────────────────────

/**
 * Signals passed to every enricher at run time.
 *
 * Enrichers receive only what they need to perform the lookup.
 * Using a dedicated input type (rather than passing the full DecisionContext)
 * keeps the enrichment layer decoupled from the decision engine.
 */
export interface EnricherInput {
  /** Visitor's IP address (from request headers). May be null in some edge environments. */
  ip:        string | null;
  /**
   * The effective IP to use for geo and network lookups.
   *
   * When an IP override is active (dev mode only), `effectiveIp` is the
   * operator-provided override.  Otherwise `effectiveIp === ip`.
   * Providers that perform IP lookups should prefer `effectiveIp` over `ip`.
   */
  effectiveIp?: string | null;
  /** Tenant identifier — used to scope CRM / account-list lookups. */
  tenantId:  string | null;
  /**
   * UTM and first-party attribution signals already parsed from the request.
   * Keys mirror the UTM standard (utm_campaign, utm_term, etc.).
   */
  utm: {
    campaign: string | null;
    source:   string | null;
    medium:   string | null;
    term:     string | null;
    content:  string | null;
  };
  /**
   * Session/visitor ID — used by CRM and account-list providers to perform
   * cookie-based identity resolution when available.
   */
  sessionId: string | null;
  /**
   * Visitor's email address — the primary CRM match signal.
   *
   * Populated when the visitor has submitted a form earlier in the session
   * and the email was persisted (e.g. stored in the `sessions` table or a
   * first-party identity cookie).  Null when no email is known.
   *
   * CRM providers should treat a non-null email as a high-confidence signal
   * for contact lookup; a null email should fall back to sessionId / IP.
   */
  email:     string | null;
  /**
   * First-party visitor identifier — the primary GA4 history lookup signal.
   *
   * Populated when the platform uses a custom User-scoped dimension in GA4
   * to track returning visitors across sessions (e.g. a UUID stored in a
   * first-party cookie and forwarded as a GA4 custom dimension).
   *
   * The GA4 History enricher uses this value to look up the visitor's
   * historical session data (location, session count, channel group).
   * Null when no first-party visitor ID is available.
   */
  visitorId?: string | null;
  /**
   * Visitor-provided location from a form submission (first-party). Takes
   * precedence over IP-derived lat/lng in the CBS location enricher — the visitor
   * gave their own location, so it works even without MaxMind/IPinfo.
   *
   *   postcode — primary, accurate (NL postcode → buurt via its PDOK centroid).
   *   place    — fallback, COARSE (town/city centre → central buurt), used only
   *              when no postcode is present.
   *
   * Persisted in the mc_loc cookie by the form-submit route; consumed only under
   * enrichment consent (the staged enrichers only run when consent is granted).
   */
  formLocation?: { postcode: string | null; place: string | null } | null;
}

// ── Enricher ──────────────────────────────────────────────────────────────────

/**
 * The minimal contract every enricher must satisfy.
 *
 * An enricher is a function that takes `EnricherInput` and resolves with a
 * partial `EnrichmentOutput` — only the fields it can populate.
 *
 * - MUST resolve (never reject) to ensure pipeline fail-safety.
 * - MUST return `{}` (empty partial) on any error or cache miss.
 * - SHOULD complete within the configured `timeoutMs`.
 *
 * @example
 * const geoEnricher: Enricher = async (input) => {
 *   const geo = await myGeoProvider.lookup(input.ip);
 *   return { countryCode: geo.country, region: geo.region, city: geo.city };
 * };
 */
export type Enricher = (
  input: EnricherInput,
) => Promise<Partial<EnrichmentOutput>>;

// ── PipelineOptions ───────────────────────────────────────────────────────────

/**
 * Configuration for `runEnrichmentPipeline()`.
 */
export interface PipelineOptions {
  /**
   * Maximum milliseconds to wait for each enricher.
   * Enrichers that exceed this budget produce `{}` and a warning log.
   * Default: 2000 ms.
   */
  timeoutMs?: number;

  /**
   * Optional structured logger.
   * Receives `{ enricherIndex, error, timedOut }` objects.
   * Default: `console.warn`.
   */
  logger?: (entry: EnrichmentLogEntry) => void;
}

// ── EnrichmentLogEntry ────────────────────────────────────────────────────────

/** Emitted by the pipeline for every enricher failure or timeout. */
export interface EnrichmentLogEntry {
  /** Zero-based index of the enricher in the pipeline array. */
  enricherIndex: number;
  /** Human-readable enricher label (if provided by the adapter). */
  enricherLabel?: string;
  /** Whether the enricher was cut off by the timeout. */
  timedOut: boolean;
  /** Error thrown by the enricher, if any. */
  error?: unknown;
}

// ── EnrichmentPipelineResult ──────────────────────────────────────────────────

/**
 * The result of `runEnrichmentPipeline()`.
 *
 * `output` is always present (may be `{}` if every enricher failed).
 * `errors` contains log entries for every enricher that timed out or threw.
 */
export interface EnrichmentPipelineResult {
  /** Merged output from all enrichers that resolved successfully. */
  output: Partial<EnrichmentOutput>;
  /** Log entries for failed / timed-out enrichers. */
  errors: EnrichmentLogEntry[];
}

// ── LabeledEnricher ───────────────────────────────────────────────────────────

/**
 * An enricher bundled with an optional human-readable label.
 * Used internally by the pipeline for clearer log output.
 */
export interface LabeledEnricher {
  enricher: Enricher;
  label?: string;
}

// ── Staged pipeline ───────────────────────────────────────────────────────────

/**
 * A single stage in the sequential enrichment pipeline.
 *
 * Unlike `Enricher` (which only sees `EnricherInput`), a `StagedEnricher`
 * also receives the accumulated output from all prior stages.  This allows
 * later stages to branch on earlier results — e.g. only running an OpenKvK
 * lookup when stage 1 has already resolved `countryCode === "NL"`.
 *
 * Contract:
 *   - `enricher` MUST resolve (never reject).
 *   - `enricher` MUST return `{}` on error or cache miss.
 *   - `shouldRun` is evaluated before the stage fires.  If it returns `false`
 *     the stage is skipped and recorded with `skipped: true` in the trace.
 *   - If `shouldRun` is omitted the stage always runs.
 */
export interface StagedEnricher {
  /** Human-readable stage label — shown in debug overlay and logs. */
  label: string;

  /**
   * Machine-readable stage key used by the admin pipeline configurator.
   *
   * When present, the pipeline configurator can:
   *   • Enable / disable this stage per tenant (disabled stages are omitted
   *     from the chain before `runStagedPipeline` is called).
   *   • Reorder this stage within its wave group (same-wave stages that share
   *     a stageKey are sorted by the configured `position` before execution).
   *
   * Stages without a `stageKey` are always-on internal stages (e.g. IP
   * Classification, Cloud Detection) that are never shown in the admin UI
   * and cannot be disabled.
   *
   * Must match one of the keys in `PIPELINE_STAGE_REGISTRY`.
   */
  stageKey?: string;

  /**
   * Optional wave number for parallel execution.
   *
   * Consecutive stages that share the same `wave` value are dispatched as a
   * `Promise.all` group — they execute concurrently and each sees the same
   * accumulated state from all stages that completed before the wave started.
   *
   * Stages without a `wave` (or separated by different wave numbers) always
   * run sequentially, receiving the fully-merged output of every prior stage.
   *
   * ─── When to assign the same wave ────────────────────────────────────────
   *
   *   Assign the same `wave` only when:
   *     a) A stage's `enricher` does NOT read any field produced by another
   *        stage in the same wave (no intra-wave dependency).
   *     b) The stage's `shouldRun` gate does NOT read any field produced by
   *        another stage in the same wave.
   *
   * ─── Example ──────────────────────────────────────────────────────────────
   *
   *   Wave 1: MaxMind + IPinfo Lite + GA4 History
   *     All three only read `input.effectiveIp` / `input.visitorId` — no
   *     dependency on each other's output.
   *
   *   (sequential: Cloud Detection)
   *     Reads `accumulated.networkOrg / networkAsn` — must follow wave 1.
   *
   *   Wave 2: ReverseGeocode + Weather + OpenKvK + Leadinfo
   *     All read `accumulated.latitude / longitude / countryCode /
   *     isCloudProvider` — all set by wave 1 + Cloud Detection, none set
   *     by each other.
   *
   *   (sequential: HubSpot, Seasonal Event)
   *     HubSpot reads `companyDomain` from wave 2; Seasonal Event reads
   *     `countryCode` which is stable after wave 1.
   */
  wave?: number;
  /**
   * The stage enricher function.
   *
   * @param input       — original request signals (IP, tenant, UTM, …)
   * @param accumulated — merged output from all stages that have already run
   * @param ctx         — per-invocation context; call `ctx.setCacheSource()`
   *                      to communicate whether the result came from a
   *                      provider cache or a live API call.  Optional for
   *                      backward compatibility — existing enrichers that
   *                      omit it continue to work (pipeline defaults to "fresh").
   */
  enricher: (
    input:       EnricherInput,
    accumulated: Partial<EnrichmentOutput>,
    ctx?:        EnricherContext,
  ) => Promise<Partial<EnrichmentOutput>>;
  /**
   * Optional gate function.  Return `false` to skip this stage entirely.
   * Called synchronously before the stage enricher is invoked.
   */
  shouldRun?: (
    input:       EnricherInput,
    accumulated: Partial<EnrichmentOutput>,
  ) => boolean;
  /**
   * Optional companion to `shouldRun`.  When `shouldRun` returns `false`,
   * this function is called to produce a human-readable reason that is stored
   * in `StageTrace.skipReason` for display in the debug overlay.
   *
   * Not called when `shouldRun` is omitted or when it returns `true`.
   */
  getSkipReason?: (
    input:       EnricherInput,
    accumulated: Partial<EnrichmentOutput>,
  ) => string;
}

// ── EnricherContext ────────────────────────────────────────────────────────────

/**
 * Per-invocation context object passed to each stage enricher.
 *
 * Enrichers call `setCacheSource` to communicate whether they served the
 * result from an internal provider-level cache or made a real external API
 * call.  The pipeline reads this after the enricher resolves and records the
 * value in `StageTrace.cacheSource`.
 *
 * Enrichers that do not call `setCacheSource` default to `"fresh"` (the
 * pipeline assumes a live API call was made).  Enrichers that only read
 * request-time data (CDN headers, IP classification) should signal
 * `"request-time"`.
 *
 * A fresh object is created per stage invocation — there is no shared state
 * between stages and no concurrency risk.
 */
export interface EnricherContext {
  /**
   * Signal the execution/cache source for this stage invocation.
   *
   * "provider-cache"  — result served from an in-process ProviderCache
   *                     (no external API call was made)
   * "fresh"           — result produced by a live external API call
   * "request-time"    — result derived purely from the incoming request
   *                     (CDN headers, IP address classification, date math)
   *                     with no I/O of any kind
   */
  setCacheSource(source: "provider-cache" | "fresh" | "request-time"): void;
  /**
   * Attach a short free-form diagnostic for the debug overlay/logs — e.g. WHY a
   * stage produced no output (a resolved id that missed its store, an upstream
   * lookup that returned null). Surfaced even when `output` is empty, so a stage
   * is never a silent no-op. Last call wins.
   */
  setNote(note: string): void;
  /**
   * Signal that this stage produced no (or partial) output because of a TRANSIENT
   * upstream failure (a timeout / 5xx from a free geocoder, say), and should be
   * retried on a later request rather than have this empty result cached for the
   * session's full TTL. The pipeline surfaces this as `StagedPipelineResult.
   * incomplete`, and `buildDecisionContext` then caches the result with a short
   * retry TTL instead of the normal 4h. A genuine negative (the upstream answered
   * "no data") must NOT call this — use `setNote` for that. Last call wins.
   */
  markRetry(reason: string): void;
}

// ── StageTrace ────────────────────────────────────────────────────────────────

/**
 * Per-stage execution record produced by `runStagedPipeline()`.
 * Used by the debug overlay and server-side logs to show exactly what
 * each stage contributed and how long it took.
 */
export interface StageTrace {
  /** Stage label from `StagedEnricher.label`. */
  label:       string;
  /** Wall-clock duration in milliseconds.  0 when the stage was skipped. */
  durationMs:  number;
  /** True when `shouldRun` returned false and the stage did not execute. */
  skipped:     boolean;
  /** Reason provided by the caller when `shouldRun` returns false. */
  skipReason?: string;
  /** The partial output this stage contributed (before merging). */
  output:      Partial<EnrichmentOutput>;
  /** Stringified error message if the stage threw or timed out. */
  error?:      string;
  /**
   * How the stage produced its result:
   *   "request-time"   — parsed from request headers / IP (no I/O)
   *   "provider-cache" — served from an in-process ProviderCache (no API call)
   *   "fresh"          — live external API call was made
   *
   * Absent when the stage was skipped (see `skipped`) or no source was
   * reported.  Set by the enricher via `EnricherContext.setCacheSource()`.
   */
  cacheSource?: "request-time" | "provider-cache" | "fresh";
  /**
   * Free-form diagnostic set by the enricher via `EnricherContext.setNote()`.
   * Shown in the debug overlay so a stage that contributes no `output` can still
   * explain why (e.g. "buurtcode=BU0599… · cbs=empty→negative-cache").
   */
  note?: string;
  /**
   * True when the stage called `EnricherContext.markRetry()` — its empty/partial
   * output was caused by a transient upstream failure and should be retried on a
   * later request rather than cached for the session's full TTL.
   */
  retry?: boolean;
  /** Reason passed to `markRetry()`, shown in the debug overlay. */
  retryReason?: string;
  /**
   * Wave number this stage belonged to, when it was dispatched as part of a
   * parallel wave group.  Absent for stages that ran sequentially (no `wave`
   * assigned, or the wave group contained only one member).
   *
   * The debug overlay uses this to visually group concurrent stages.
   */
  wave?: number;
}

// ── StagedPipelineResult ──────────────────────────────────────────────────────

/**
 * The result of `runStagedPipeline()`.
 *
 * `output` is always present — it is the deep-merged accumulation of every
 * stage that ran successfully.
 * `trace` contains one entry per stage, in execution order.
 */
export interface StagedPipelineResult {
  /** Merged enrichment output from all stages that completed successfully. */
  output: Partial<EnrichmentOutput>;
  /** Per-stage execution trace — always contains one entry per stage. */
  trace:  StageTrace[];
  /**
   * True when at least one stage called `EnricherContext.markRetry()` — i.e. the
   * merged output is missing data because of a TRANSIENT upstream failure, not a
   * genuine negative. Callers should cache this result with a short retry TTL so
   * the pipeline re-runs soon, instead of pinning an empty result for the full
   * session TTL. Absent/false means every stage produced a settled result.
   */
  incomplete?: boolean;
  /**
   * Field-level provenance map — records which stage produced each resolved
   * field and what inputs it consumed.
   *
   * Only fields with a non-null resolved value appear here.
   * `cacheStatus` defaults to "n/a" from the pipeline; callers
   * (`buildDecisionContext`) override it to "hit" / "miss" based on whether
   * the session enrichment cache was used.
   */
  enrichmentTrace: EnrichmentTrace;
}
