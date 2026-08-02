/**
 * Scenario Store
 *
 * Client-side, session-scoped state management for scenario overrides.
 * All scenario state is kept in sessionStorage so it:
 *   – is isolated to one browser tab (never leaks to real users)
 *   – is never sent to the server
 *   – clears automatically when the tab closes
 *
 * The store exposes a simple event-driven API so React components can
 * subscribe to changes without a full context tree rebuild.
 *
 * ─── Safety guarantees ───────────────────────────────────────────────────────
 *
 *   • Only available client-side (guard all reads behind typeof window check).
 *   • sessionStorage key is prefixed `mc_scenario_v1` — clear to identify.
 *   • Overrides are purely additive client-side transformations of JourneyState.
 *   • No override ever reaches the tracking API or behavior DB.
 *
 * ─── Override coverage (v2) ───────────────────────────────────────────────────
 *
 *   Group              Fields
 *   ─────────────────  ───────────────────────────────────────────────────────
 *   Request            visitType, source, device, utmSource/Medium/Campaign
 *   Enrichment — Geo   city, region, countryCode, latitude, longitude
 *   Enrichment — Net   networkOrg, ipVersion, isCloudProvider
 *   Enrichment — Co.   companyName, companyDomain, companyIndustry, companySize
 *   Enrichment — Ads   adCampaign, adAdGroup, adKeyword
 *   Enrichment — CRM   crmMatched, crmLifecycleStage, crmDealStage, crmSegment
 *   Enrichment — ABM   targetAccountMatched, targetAccountTier
 *   Enrichment — Wthr  weatherCode, temperatureNow, isRaining, windSpeed
 *   Interest           interestPrimary, interestSecondary, interestConfidence
 *   Behavior           funnelStage, scores, page flags, matchedSequences
 *   Lifecycle          isCustomer, planTier
 *   Batch              enrichmentPatch — raw Partial<EnrichmentOutput> from re-run
 */

import type { JourneyFunnelStage, ConfidenceBand } from "@/lib/journey/types";
import type { TrafficSource, VisitType, DeviceType } from "@/context/types";
import type { ThemePresetKey } from "@/design-system/theme/presets";

// ── Storage keys ─────────────────────────────────────────────────────────────

const STORE_KEY = "mc_scenario_v1";

/**
 * Cookie name written/cleared by the client whenever a scenario is activated or
 * cleared.  The server reads this cookie so scenario overrides propagate into the
 * real rule-evaluation pipeline on the NEXT request (page navigation/refresh).
 *
 * Value: URI-encoded JSON of ScenarioOverrides (the `overrides` field only).
 * Lifetime: session cookie (clears on tab close, same as sessionStorage).
 * SameSite: Lax — not sent on cross-site navigation, fine for same-origin SSR.
 * NOT HttpOnly: must be writable by JS in the browser.
 */
export const SCENARIO_COOKIE = "mc_scenario";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScenarioOverrides {
  // ── Request ────────────────────────────────────────────────────────────────
  /** Override the visit type — "new" for first-touch, "returning" for repeat. */
  visitType?:  VisitType;
  /** Override the detected device type. */
  device?:     DeviceType;
  /** Override the detected traffic source. */
  source?:     TrafficSource;
  /** Override utm_source query parameter. */
  utmSource?:  string | null;
  /** Override utm_medium query parameter. */
  utmMedium?:  string | null;
  /** Override utm_campaign query parameter. */
  utmCampaign?: string | null;

  // ── Enrichment — Geo ───────────────────────────────────────────────────────
  /** ISO 3166-1 alpha-2 country code, e.g. "NL", "US", "DE". */
  countryCode?: string | null;
  /** State / province / region name, e.g. "Noord-Holland". */
  region?:      string | null;
  /** City name from geo IP enrichment. */
  city?:        string | null;
  /** Approximate latitude from IP geo enrichment (city-level precision). */
  latitude?:    number | null;
  /** Approximate longitude from IP geo enrichment (city-level precision). */
  longitude?:   number | null;

  // ── Enrichment — Network / IP ──────────────────────────────────────────────
  /** Human-readable ISP / organization name, e.g. "Google LLC". */
  networkOrg?:      string | null;
  /** IP address family — "ipv4" or "ipv6". */
  ipVersion?:       "ipv4" | "ipv6" | null;
  /** True when the visitor's IP belongs to a cloud / datacenter provider. */
  isCloudProvider?: boolean | null;

  // ── Enrichment — Company ───────────────────────────────────────────────────
  /** Company display name from IP-to-company lookup. */
  companyName?:     string | null;
  /** Company primary domain, e.g. "acme.com". */
  companyDomain?:   string | null;
  /** Industry vertical, e.g. "Software", "Financial Services". */
  companyIndustry?: string | null;
  /** Employee size bucket, e.g. "51-200", "1001-5000". */
  companySize?:     string | null;

  // ── Enrichment — Ads ──────────────────────────────────────────────────────
  /** Ad campaign name / ID, e.g. "brand-search-nl". */
  adCampaign?: string | null;
  /** Ad group / ad set name. */
  adAdGroup?:  string | null;
  /** Search keyword that triggered the ad. */
  adKeyword?:  string | null;

  // ── Enrichment — CRM ──────────────────────────────────────────────────────
  /** Whether a CRM record was matched for this visitor. */
  crmMatched?:        boolean | null;
  /** CRM lifecycle stage, e.g. "lead", "mql", "sql", "opportunity", "customer". */
  crmLifecycleStage?: string | null;
  /** Deal / opportunity stage, e.g. "Proposal", "Negotiation". */
  crmDealStage?:      string | null;
  /** Marketing segment label from the CRM, e.g. "enterprise-prospect". */
  crmSegment?:        string | null;

  // ── Enrichment — ABM / Account List ───────────────────────────────────────
  /** Whether this visitor's company is on a target account list. */
  targetAccountMatched?: boolean | null;
  /** Account tier label, e.g. "tier-1", "tier-2", "tier-3". */
  targetAccountTier?:    string | null;

  // ── Enrichment — Weather ──────────────────────────────────────────────────
  /** WMO weather interpretation code (0=clear, 51-67=rain, 71-77=snow…). */
  weatherCode?:       number | null;
  /** Current air temperature in °C. */
  temperatureNow?:    number | null;
  /** True when weatherCode indicates active precipitation. */
  isRaining?:         boolean | null;
  /** Wind speed at 10 m height, in km/h. */
  windSpeed?:         number | null;

  // ── Enrichment — Batch patch (from re-run) ─────────────────────────────────
  /**
   * Raw Partial<EnrichmentOutput> written by the enricher re-run action.
   * Merged into ctx.enrichment in Pass 2 BEFORE individual field overrides,
   * so individual fields can still pin specific values on top.
   */
  enrichmentPatch?: Record<string, unknown>;

  // ── Interest / History ─────────────────────────────────────────────────────
  /** Primary interest profile key, e.g. "logistics", "hr-tech". */
  interestPrimary?:    string;
  /** Secondary interest profile key. */
  interestSecondary?:  string;
  /** Interest confidence score (0–1). */
  interestConfidence?: number;

  // ── Funnel + scores ────────────────────────────────────────────────────────
  funnelStage?:       JourneyFunnelStage;
  intentScore?:       number;        // 0–100
  engagementScore?:   number;        // 0–100
  confidenceBand?:    ConfidenceBand;
  overallConfidence?: number;        // 0–1
  frictionScore?:     number;        // 0–100
  sequenceScore?:     number;        // 0–100

  // ── Page flags ─────────────────────────────────────────────────────────────
  hasVisitedPricing?: boolean;
  hasVisitedAbout?:   boolean;
  hasVisitedCases?:   boolean;
  hasVisitedContact?: boolean;
  hasClickedCta?:     boolean;
  hasStartedForm?:    boolean;
  hasSubmittedForm?:  boolean;

  // ── Sequences ──────────────────────────────────────────────────────────────
  matchedSequences?:  string[];

  // ── Lifecycle / Customer ───────────────────────────────────────────────────
  isCustomer?:        boolean;
  planTier?:          string;        // "starter" | "growth" | "pro"

  // ── Short/long term scores ─────────────────────────────────────────────────
  shortTermIntentScore?:  number;
  longTermAffinityScore?: number;

  // ── Top-level VisitorHistory fields ────────────────────────────────────────
  pageViewCount?: number;

  // ── Network / Request — IP ─────────────────────────────────────────────────
  /**
   * Override the visitor's IP address.
   * Does NOT automatically re-run enrichment with the new IP — use the enricher
   * re-run action for that.  Stored in context for display and rule testing.
   */
  ipAddress?: string | null;

  // ── Direct scenario bypass key ─────────────────────────────────────────────
  /**
   * When set, the server-side homepage pipeline skips the rule engine entirely
   * and uses the named DEMO_SCENARIO_PLANS entry to resolve variant keys.
   *
   * This is set automatically by activateScenario() when a presetKey is given.
   * It makes scenario switching deterministic regardless of whether the tenant
   * has matching rules configured — which is the correct behaviour for demos.
   *
   * The value matches a key in DEMO_SCENARIO_PLANS (e.g. "consideration",
   * "high_intent", "form_dropout", "customer", "expansion", "awareness").
   * Preset keys that don't match a plan key are mapped to the closest plan
   * in the pipeline.
   */
  _scenarioKey?: string;

  /**
   * Opt-in to the demo-plan BYPASS. Default (undefined/false) = the demo runs on
   * the SAME code path as a real customer: the scenario overrides the context and
   * the real rule engine produces the plan. Set to true only as a fallback for a
   * tenant that has no matching rules yet — then the pipeline serves the hardcoded
   * DEMO_SCENARIO_PLANS entry instead. Keeping this off is what stops the demo
   * from silently diverging from real behaviour.
   */
  bypass?: boolean;

  // ── Audience segment override ───────────────────────────────────────────────
  /**
   * Override the evaluated audience segment IDs for this visitor.
   * Comma-joined segment keys, e.g. "high-intent,enterprise-prospect".
   * Set to null to simulate a visitor matching no segments.
   * When undefined (not set), real segment evaluation runs at request time.
   */
  audienceSegmentIds?: string | null;

  // ── Scenario theme override ─────────────────────────────────────────────────
  /**
   * Direct theme override for scenario preview.
   *
   * When set, this theme is applied immediately in layout.tsx regardless of
   * whether a matching theme rule exists in the tenant's rules_config.
   * This lets scenario presets demonstrate a specific visual theme without
   * requiring the admin to manually configure a theme rule in the DB.
   *
   * Only evaluated when the mc_scenario cookie is active — never affects
   * real visitor sessions.
   */
  themeKey?: ThemePresetKey;

  // ── Time / Temporal context ─────────────────────────────────────────────────
  /** Override the hour of day (0–23) in tenant local time. */
  currentHour?: number | null;
  /** Override the day of week in tenant local time. */
  dayOfWeek?:   "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null;
  /** Override the weekend flag (true = Saturday or Sunday). */
  isWeekend?:   boolean | null;
  /** Override the month (1–12) in tenant local time. */
  month?:       number | null;
  /** Override the date key as "YYYY-MM-DD". */
  dateKey?:     string | null;
  /** Override the coarse time-of-day bucket. */
  timeOfDay?:   "morning" | "afternoon" | "evening" | "night" | null;
  /** Override the active seasonal event. */
  seasonalEvent?: "none" | "new-year" | "christmas" | "easter" | "black-friday" | "cyber-monday" | "back-to-school" | "halloween" | "valentines" | null;
}

export interface ScenarioState {
  /** True when any override is active. */
  active:       boolean;
  /** Key of the active preset (null = custom overrides). */
  presetKey:    string | null;
  /** Human-readable label of the active preset/scenario. */
  label:        string | null;
  /** The active overrides. Empty object when no scenario is active. */
  overrides:    ScenarioOverrides;
  /** ISO timestamp of when the scenario was activated. */
  activatedAt:  string | null;
}

// ── Default state ─────────────────────────────────────────────────────────────

function defaultState(): ScenarioState {
  return {
    active:      false,
    presetKey:   null,
    label:       null,
    overrides:   {},
    activatedAt: null,
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

function load(): ScenarioState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as ScenarioState;
  } catch {
    return defaultState();
  }
}

function save(state: ScenarioState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (private browsing limits, etc.)
  }
  syncCookie(state);
}

/**
 * Writes or clears the mc_scenario cookie so the server-side pipeline can read
 * scenario overrides on the next navigation/request.
 *
 * Cookie spec:
 *   - No `HttpOnly` — must be writable by client JS.
 *   - `SameSite=Lax` — not sent cross-site; safe for same-origin SSR.
 *   - No `max-age` / no `expires` → session cookie (clears on tab close).
 *   - `path=/` — available across the whole site.
 */
function syncCookie(state: ScenarioState): void {
  if (typeof document === "undefined") return;
  if (state.active && Object.keys(state.overrides).length > 0) {
    try {
      const value = encodeURIComponent(JSON.stringify(state.overrides));
      document.cookie = `${SCENARIO_COOKIE}=${value}; path=/; SameSite=Lax`;
    } catch {
      // JSON serialisation failure — silently skip cookie write.
    }
  } else {
    // Clear the cookie by setting max-age=0.
    document.cookie = `${SCENARIO_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────────

type Listener = (state: ScenarioState) => void;
const listeners = new Set<Listener>();

function notify(): void {
  const state = load();
  listeners.forEach((l) => l(state));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read the current scenario state.
 * Safe to call on server (returns default state).
 */
export function getScenarioState(): ScenarioState {
  return load();
}

/**
 * Activate a scenario with the given overrides.
 */
export function activateScenario(
  overrides:  ScenarioOverrides,
  presetKey?: string,
  label?:     string,
): void {
  // Inject _scenarioKey into the overrides so the server-side pipeline can
  // bypass the rule engine and directly select the demo scenario plan.
  // This ensures variant content visibly changes when switching scenarios
  // even when the tenant has no matching rules configured.
  const effectiveOverrides: ScenarioOverrides = presetKey
    ? { ...overrides, _scenarioKey: presetKey }
    : overrides;

  const state: ScenarioState = {
    active:      true,
    presetKey:   presetKey ?? null,
    label:       label     ?? null,
    overrides:   effectiveOverrides,
    activatedAt: new Date().toISOString(),
  };
  save(state);
  notify();
}

/**
 * Update a single field in the current overrides without losing others.
 */
export function patchScenarioOverride(patch: Partial<ScenarioOverrides>): void {
  const current = load();
  save({
    ...current,
    active:    true,
    presetKey: null,          // custom after a patch
    label:     "Custom",
    overrides: { ...current.overrides, ...patch },
  });
  notify();
}

/**
 * Clear all scenario state and return to real behavioral data.
 */
export function clearScenario(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORE_KEY);
    // Clear the server-readable cookie so the pipeline reverts to real data.
    syncCookie(defaultState());
  }
  notify();
}

/**
 * Subscribe to scenario state changes.
 * Returns an unsubscribe function.
 */
export function subscribeToScenario(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns true when scenario mode is currently active.
 * Cheap check — no JSON parse needed.
 */
export function isScenarioActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORE_KEY) !== null && load().active;
  } catch {
    return false;
  }
}
