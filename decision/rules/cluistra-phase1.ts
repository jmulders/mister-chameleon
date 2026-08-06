/**
 * Cluistra — Phase 1 rules config (service vs default)
 *
 * A pure builder for Cluistra's Phase-1 StoredRulesConfig. Cluistra is a trailer
 * dealer (aanhanger-dealer); Phase 1 personalises ONLY a "service" experience for
 * returning visitors who have shown service intent, and leaves everything else on
 * the default experience.
 *
 * ─── The mechanism (all existing engine primitives, no new platform mechanics) ──
 *
 *   1. Sticky context-write rule — when the CURRENT page is a service page
 *      (/onderhoud, /accessoires, /contact) and the visitor is not a bot, write
 *      the sticky, monotone flag `visited_service_page = true`. Monotone so it
 *      latches for the session and never falls back.
 *
 *   2. R1 "Service" (priority 10) — a RETURNING visitor who carries that flag AND
 *      is currently on the homepage or a sector page (a pathname allowlist) gets
 *      the service variants for hero / features / social-proof (proof) / cta.
 *
 *   3. Default — everything else stays on the platform defaults.
 *
 * ─── Page scoping ───────────────────────────────────────────────────────────────
 *
 *   Scoping is via the `pathname` field (the page being rendered), NOT `entryPath`
 *   (the landing page): the sticky rule fires on the current service page; R1 reads
 *   the latched flag on a later homepage/sector view. SECTOR_PATHS are PLACEHOLDERS
 *   until the real Cluistra sitemap is supplied.
 *
 * ─── Variant keys ───────────────────────────────────────────────────────────────
 *
 *   default = platform defaults (hero_default / proof_default / cta_default /
 *   feature_grid_primary). service = the service blueprint keys (hero_service /
 *   proof_service / cta_service / feature_service). Copy for the service variants
 *   is placeholder direction until the brand strategist delivers the CSD copy.
 *
 * ─── Holdout + bots ─────────────────────────────────────────────────────────────
 *
 *   Holdout is tenant-wide (`enrichment.personalizationHoldoutPct = 10`): a
 *   deterministic 10% control sees the default. With R1 the only serving rule,
 *   that IS R1's holdout. `isBot = false` sits on both rules; the pipeline also
 *   excludes bots from serving and measurement.
 */

import type {
  StoredRulesConfig,
  StoredRule,
  FieldCondition,
  FlagCondition,
  GroupCondition,
} from "./stored-rule";

// ── Path allowlists ─────────────────────────────────────────────────────────────

/** Service pages: visiting one latches the `visited_service_page` flag. */
export const CLUISTRA_SERVICE_PATHS = ["/onderhoud", "/accessoires", "/contact"] as const;

/**
 * Sector pages where R1 may serve the service experience, alongside the homepage.
 * PLACEHOLDERS — replace with Cluistra's real sitemap paths in a later pass.
 */
export const CLUISTRA_SECTOR_PATHS_PLACEHOLDER = [
  "/aanhangers",
  "/sectoren/agrarisch",
  "/sectoren/transport",
] as const;

/** Homepage + sector pages: the scope where R1 is allowed to fire. */
export const CLUISTRA_R1_PATHS = ["/", ...CLUISTRA_SECTOR_PATHS_PLACEHOLDER] as const;

/** The flag written by the sticky rule and read by R1. */
export const VISITED_SERVICE_PAGE_FLAG = "visited_service_page";

// ── Condition helpers ────────────────────────────────────────────────────────────

const notBot: FieldCondition = { type: "field", field: "isBot", operator: "equals", value: false };

function pathnameIn(paths: readonly string[]): FieldCondition {
  return { type: "field", field: "pathname", operator: "in", value: [...paths] };
}

// ── Config builder ───────────────────────────────────────────────────────────────

/**
 * Build Cluistra's Phase-1 StoredRulesConfig. Pure — pass the timestamp in so the
 * output is deterministic for tests / seeding.
 */
export function buildCluistraPhase1Config(updatedAt = "2026-01-01T00:00:00.000Z"): StoredRulesConfig {
  // 1) Sticky context-write rule (tag-only): latch visited_service_page on a
  //    service page. Plan stays on defaults — service pages themselves are not
  //    personalised in Phase 1; the write is what matters.
  const stickyCondition: GroupCondition = {
    type: "group",
    logic: "and",
    conditions: [pathnameIn(CLUISTRA_SERVICE_PATHS), notBot],
  };
  const stickyRule: StoredRule = {
    id:              "cluistra.visited_service_page",
    priority:        5,
    precedenceLevel: "hard_state",
    packId:          "pack_behaviour",
    label:           "Service page visited (measure)",
    condition:       stickyCondition,
    plan: {
      heroKey:  "hero_default",
      proofKey: "proof_default",
      ctaKey:   "cta_default",
      setContext: [
        { key: VISITED_SERVICE_PAGE_FLAG, value: true, sticky: true, monotone: true },
      ],
    },
    reason:  "Tag-only. Latches visited_service_page when a service page (onderhoud/accessoires/contact) is viewed.",
    enabled: true,
    source:  "tenant",
  };

  // 2) R1 Service: returning + flag latched + on homepage/sector + not a bot.
  const flagSet: FlagCondition = { type: "flag", name: VISITED_SERVICE_PAGE_FLAG, operator: "equals", value: true };
  const returning: FieldCondition = { type: "field", field: "visitType", operator: "equals", value: "returning" };
  const r1Condition: GroupCondition = {
    type: "group",
    logic: "and",
    conditions: [returning, flagSet, pathnameIn(CLUISTRA_R1_PATHS), notBot],
  };
  const r1Service: StoredRule = {
    id:              "cluistra.r1_service",
    priority:        10,
    precedenceLevel: "high_intent",
    packId:          "pack_behaviour",
    label:           "Service (returning, visited a service page)",
    condition:       r1Condition,
    plan: {
      heroKey:    "hero_service",
      proofKey:   "proof_service",
      ctaKey:     "cta_service",
      featureKey: "feature_service",
    },
    reason:  "Returning visitor who earlier viewed a service page, now on the homepage or a sector page. Lead with the service experience. Placeholder copy until CSD.",
    enabled: true,
    source:  "tenant",
  };

  return {
    schemaVersion: 1,
    updatedAt,
    rules: [stickyRule, r1Service],
    defaultPlan: {
      heroKey:  "hero_default",
      proofKey: "proof_default",
      ctaKey:   "cta_default",
      reason:   "Default experience. All traffic that is not a returning service-intent visitor on the homepage or a sector page.",
    },
    rulesEnabled: true,
  };
}
