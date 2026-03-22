/**
 * Capability Feature Matrix
 *
 * The authoritative, structured mapping of every platform capability to every
 * commercial package tier — with support level, availability conditions, and
 * add-on eligibility per cell.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────────
 *
 *   Three capability representations already exist in the codebase:
 *
 *   product/module-registry.ts  buildCapabilityMatrix()
 *     Returns a boolean grid: capability × package (true/false per cell).
 *     Audience: internal tooling, tenant provisioning, feature flag generation.
 *
 *   pricing/packages.ts  buildPackageFeatureMatrix()
 *     Returns a string grid: dimension × tier (human label per cell).
 *     Audience: pricing pages, proposal comparison tables, sales decks.
 *
 *   pricing/feature-matrix.ts  CAPABILITY_FEATURE_MATRIX  ← YOU ARE HERE
 *     Returns structured objects: capability × tier × support level + metadata.
 *     Audience: sales qualification, onboarding tooling, internal checks,
 *               and any consumer that needs more than true/false but structured
 *               data rather than display strings.
 *
 * ─── Support level vocabulary ─────────────────────────────────────────────────
 *
 *   included              Fully available. No conditions. Delivers value from
 *                         day one of the engagement.
 *
 *   included-planned      The tier commercially includes this capability, but
 *                         the underlying feature has not shipped yet. Clients
 *                         at this tier will receive it when it ships. Do not
 *                         present as available now.
 *
 *   included-conditional  Included in this tier but requires a specific
 *                         TenantFeatureFlag to be enabled, or additional
 *                         configuration work during onboarding. The capability
 *                         right is included; the activation is not automatic.
 *
 *   addon-eligible        Not included in this tier's base price. Can be
 *                         activated on this tier via a specific add-on fee or
 *                         a one-time service engagement — without upgrading to
 *                         the next commercial tier.
 *
 *   not-included          Not available at this tier under any configuration.
 *                         Upgrade to the tier listed in `minimumTier` to unlock.
 *
 * ─── Add-on eligibility ───────────────────────────────────────────────────────
 *
 *   Add-on eligible capabilities can be activated on a tier that does not
 *   include them by default, typically via a service engagement or fee selection
 *   from the pricing model. Not all capabilities support this — some are
 *   structurally tied to a higher tier.
 *
 * ─── How to answer the four key questions ────────────────────────────────────
 *
 *   "Which package includes AI decisioning?"
 *     getMinimumTierForCapability("ai-decisioning")  →  "scale"
 *     (Growth has AI as conditional; Scale includes it as the primary engine)
 *
 *   "Which package includes multi-CMS support?"
 *     getMinimumTierForCapability("multi-cms-support")  →  "start"
 *     (All tiers include it — it is a platform capability)
 *
 *   "Which package includes adaptive landing pages?"
 *     getMinimumTierForCapability("adaptive-landing-page")  →  "growth"
 *     (Growth includes it as planned; Scale inherits it)
 *
 *   "Which package includes advanced dashboarding?"
 *     getMinimumTierForCapability("dashboard-analytics")  →  "growth"
 *     (Planned in Growth and Scale — not yet shipped)
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/features.ts        → CapabilityId, CapabilityCategory, Capability
 *   product/module-registry.ts → PackageId, PackageDefinition, PACKAGE_REGISTRY
 *   pricing/packages.ts        → CommercialTierId, PricingPackage, PRICING_PACKAGES
 *   pricing/feature-matrix.ts  ← YOU ARE HERE
 *   pricing/index.ts           → barrel re-export
 */

import type { CapabilityId, CapabilityCategory, Capability } from "@/product/features";
import type { CommercialTierId }                              from "./packages";
import type { ModuleStatus }                                  from "@/product/types";

import { CAPABILITY_INDEX, CAPABILITIES }                     from "@/product/features";
import { PRICING_PACKAGES }                                   from "./packages";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The level at which a capability is available in a given tier.
 *
 * included              Available today, no conditions.
 * included-planned      Committed to this tier; ships when the feature is ready.
 * included-conditional  Available with a feature flag or onboarding configuration.
 * addon-eligible        Not included by default; can be activated via an add-on.
 * not-included          Not available at this tier. Upgrade required.
 */
export type MatrixSupportLevel =
  | "included"
  | "included-planned"
  | "included-conditional"
  | "addon-eligible"
  | "not-included";

/**
 * A single cell in the feature matrix — one capability in one tier.
 */
export interface TierCapabilityEntry {
  /**
   * The availability level of this capability in this tier.
   * Use this for programmatic logic and access-control decisions.
   */
  level: MatrixSupportLevel;

  /**
   * Short human-readable label for rendering in comparison tables.
   *
   * Convention:
   *   "included"              →  "✓  [brief description]"
   *   "included-planned"      →  "Planned — [brief description]"
   *   "included-conditional"  →  "✓  Available (conditions apply)"
   *   "addon-eligible"        →  "Add-on available"
   *   "not-included"          →  "—"
   */
  displayLabel: string;

  /**
   * For "included-conditional" and "addon-eligible" entries:
   * what must be true for this capability to activate?
   *
   * Written as a short clause: "Requires aiDecisionProvider flag + subclass wired"
   */
  conditions?: string;

  /**
   * For "addon-eligible" entries: the OptimizationFeeId or ServiceFeeId that
   * enables this capability on this tier. References pricing/model.ts fee IDs.
   */
  addonFeeRef?: string;

  /**
   * For "included-planned" entries: context on when / what is blocking.
   * Not a commitment — informational.
   */
  plannedNote?: string;

  /**
   * For "not-included" entries: the minimum tier to upgrade to.
   * Enables "upgrade to X to unlock" tooltip rendering.
   */
  minimumTierToUnlock?: CommercialTierId;
}

/**
 * A single row in the capability feature matrix.
 *
 * One row per CapabilityId. Contains the capability metadata and one
 * TierCapabilityEntry per commercial tier.
 *
 * Mirrors the Capability interface from product/features.ts — repeated here
 * for ergonomic access without requiring consumers to import from two modules.
 */
export interface CapabilityMatrixRow {
  /** The CapabilityId this row describes. */
  capabilityId: CapabilityId;

  /** Customer-facing label for this capability. */
  label: string;

  /** One-sentence customer-facing description. */
  description: string;

  /**
   * Display category for grouping rows in a comparison table.
   * Mirrors Capability.category from product/features.ts.
   */
  category: CapabilityCategory;

  /**
   * Current delivery status of this capability.
   * "available" = live and deliverable.
   * "planned"   = on the roadmap; not yet deliverable.
   */
  capabilityStatus: ModuleStatus;

  /**
   * Whether this row should be visually highlighted in a comparison table.
   * True for capabilities that are key commercial differentiators between tiers.
   */
  highlight: boolean;

  /** Entry for the Start commercial tier. */
  start: TierCapabilityEntry;

  /** Entry for the Growth commercial tier. */
  growth: TierCapabilityEntry;

  /** Entry for the Scale commercial tier. */
  scale: TierCapabilityEntry;
}

/**
 * The complete capability feature matrix — all capability × tier combinations.
 */
export type CapabilityFeatureMatrix = readonly CapabilityMatrixRow[];

/**
 * A summary of capabilities for a single commercial tier.
 *
 * Suitable for a sales qualification or onboarding scoping summary.
 */
export interface TierCapabilitySummary {
  /** The commercial tier this summary covers. */
  tierId: CommercialTierId;

  /** Display name of the tier. */
  tierName: string;

  /**
   * Capabilities fully included and available today.
   * No conditions, no planned gates.
   */
  included: readonly CapabilityMatrixRow[];

  /**
   * Capabilities included but requiring a feature flag or configuration step.
   * The right is included; activation requires additional setup.
   */
  conditional: readonly CapabilityMatrixRow[];

  /**
   * Capabilities committed to this tier but not yet shipped.
   * Clients at this tier will receive them when they ship.
   */
  planned: readonly CapabilityMatrixRow[];

  /**
   * Capabilities not in base price but activatable via an add-on.
   */
  addOnEligible: readonly CapabilityMatrixRow[];

  /**
   * Capabilities not available at this tier in any configuration.
   * Upgrade required.
   */
  notIncluded: readonly CapabilityMatrixRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MATRIX DATA
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per CapabilityId. Ordered by category (surface → decisioning →
// data → integration → platform) to match the CapabilityCategory taxonomy.
//
// Each cell references the authoritative source:
//   - PACKAGE_REGISTRY[packageId].capabilities  (product layer — which caps are in which pkg)
//   - PRICING_PACKAGES[tierId].aiSupportLevel   (commercial layer — how AI is scoped per tier)
//   - PRICING_PACKAGES[tierId].plannedCapabilities (commercial layer — what's coming soon)
//   - Capability.tenantFeatureFlag              (features layer — what gates activation)

const MATRIX_ROWS: readonly CapabilityMatrixRow[] = [

  // ── SURFACES ──────────────────────────────────────────────────────────────

  {
    capabilityId: "adaptive-homepage",
    label:       "Adaptive Homepage",
    description: "The homepage detects each visitor's traffic source and history, then renders the hero, proof, and CTA blocks most likely to convert them — server-side, with no client-side flicker.",
    category:    "surface",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included",
      displayLabel: "✓  Hero, proof & CTA — 3 variant slots",
    },
    growth: {
      level:        "included",
      displayLabel: "✓  Hero, proof & CTA — 5 variant slots",
    },
    scale: {
      level:        "included",
      displayLabel: "✓  Hero, proof & CTA — unlimited slots",
    },
  },

  {
    capabilityId: "adaptive-landing-page",
    label:       "Adaptive Landing Pages",
    description: "Campaign landing pages that read UTM parameters and visitor context on arrival and render the variant best matched to the audience each campaign was targeting — one URL, many first impressions.",
    category:    "surface",
    capabilityStatus: "planned",
    highlight:   true,

    start: {
      level:                 "not-included",
      displayLabel:          "—",
      minimumTierToUnlock:   "growth",
    },
    growth: {
      level:        "included-planned",
      displayLabel: "Planned — UTM-matched landing pages",
      plannedNote:  "Module ships as part of the Adaptive Landing Pages product module. Included in Growth tier at no additional module fee when available.",
    },
    scale: {
      level:        "included-planned",
      displayLabel: "Planned — UTM-matched landing pages",
      plannedNote:  "Inherited from Growth. Ships alongside the Growth landing pages rollout.",
    },
  },

  {
    capabilityId: "adaptive-product-page",
    label:       "Adaptive Product / Service Pages",
    description: "Product and service detail pages that adapt their emphasis to the audience that arrived — showing ROI framing to Google visitors, vision framing to LinkedIn visitors, and platform depth to returning evaluators.",
    category:    "surface",
    capabilityStatus: "planned",
    highlight:   true,

    start: {
      level:               "not-included",
      displayLabel:        "—",
      minimumTierToUnlock: "scale",
    },
    growth: {
      level:               "not-included",
      displayLabel:        "—",
      minimumTierToUnlock: "scale",
    },
    scale: {
      level:        "included-planned",
      displayLabel: "Planned — adaptive product & service pages",
      plannedNote:  "Requires new page route and product-page variant key types. Decisioning and rendering infrastructure is ready. Scale tier commercial commitment includes this capability when shipped.",
    },
  },

  // ── DECISIONING ─────────────────────────────────────────────────────────

  {
    capabilityId: "rules-decisioning",
    label:       "Rules-Based Decisioning",
    description: "An ordered rule set evaluates each visitor's traffic source and behavioural history to select the optimal experience plan — zero AI cost, zero latency overhead, live from day one.",
    category:    "decisioning",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included",
      displayLabel: "✓  Full rule set — source, device & history rules",
    },
    growth: {
      level:        "included",
      displayLabel: "✓  Full rule set — source, device & history rules",
    },
    scale: {
      level:        "included",
      displayLabel: "✓  Full rule set — primary fallback for AI provider",
    },
  },

  {
    capabilityId: "ai-decisioning",
    label:       "AI-Augmented Decisioning",
    description: "An LLM evaluates visitor signals to select the experience plan when the rules engine confidence is below the configured threshold. Falls back to rule evaluation gracefully when AI is unavailable.",
    category:    "decisioning",
    capabilityStatus: "available",
    highlight:   true,

    start: {
      level:               "not-included",
      displayLabel:        "—",
      minimumTierToUnlock: "scale",
    },
    growth: {
      level:        "included-conditional",
      displayLabel: "✓  Available as rules fallback",
      conditions:
        "Requires: (1) aiDecisionProvider feature flag set in TenantConfig, " +
        "(2) an AiDecisionProvider subclass wired into the page route, " +
        "(3) confidence policy configured in decision/ai-confidence-policy.ts. " +
        "Growth tier AI operates as rules-with-ai-fallback — rules handle standard " +
        "cases; AI activates only when confidence falls below threshold.",
    },
    scale: {
      level:        "included-conditional",
      displayLabel: "✓  AI-primary (rules as fallback)",
      conditions:
        "Same configuration requirements as Growth. Scale tier AI operates as " +
        "ai-primary — AI evaluates every request; rules serve as fallback when " +
        "AI is unavailable. Requires aiDecisionProvider flag + subclass.",
    },
  },

  {
    capabilityId: "experiment-support",
    label:       "A/B Experiment Support",
    description: "Run controlled variant experiments on any adaptive page. The experiment decorator intercepts the decision engine, applies bucket assignments, and records exposure events for statistical readout.",
    category:    "decisioning",
    capabilityStatus: "available",
    highlight:   true,

    start: {
      level:               "not-included",
      displayLabel:        "—",
      minimumTierToUnlock: "growth",
    },
    growth: {
      level:        "included-conditional",
      displayLabel: "✓  A/B experiments — bucket assignment & readout",
      conditions:
        "Requires abTesting feature flag set to true in TenantConfig. " +
        "The experiment decorator adds a DB round-trip per request; left false " +
        "until the client has an active experiment to avoid unnecessary latency.",
    },
    scale: {
      level:        "included-conditional",
      displayLabel: "✓  A/B experiments — bucket assignment & readout",
      conditions:
        "Same as Growth. The abTesting flag must be explicitly enabled per tenant. " +
        "Scale clients typically pair experiments with the quarterly strategy review.",
    },
  },

  // ── DATA ────────────────────────────────────────────────────────────────

  {
    capabilityId: "visitor-history",
    label:       "First-Party Visitor History",
    description: "The platform tracks page views, CTA clicks, and session patterns across visits to build a persistent profile — no third-party cookies, no consent dependency, no PII. History feeds back into decisioning on every return visit.",
    category:    "data",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included",
      displayLabel: "✓  Page views, CTA clicks & session history",
    },
    growth: {
      level:        "included",
      displayLabel: "✓  Page views, CTA clicks & session history",
    },
    scale: {
      level:        "included",
      displayLabel: "✓  Page views, CTA clicks & session history",
    },
  },

  {
    capabilityId: "contact-enrichment",
    label:       "Enriched Contact Submissions",
    description: "Every form submission is automatically enriched server-side with traffic source, UTMs, session depth, CTA engagement history, and the variant the visitor converted on — no client-side data passing required.",
    category:    "data",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included-conditional",
      displayLabel: "✓  Full enrichment on contact form submissions",
      conditions:
        "Requires the contact form to be active for this tenant. The contactForm " +
        "feature flag defaults to true — this capability is effectively always-on " +
        "unless the tenant explicitly disables the contact form.",
    },
    growth: {
      level:        "included-conditional",
      displayLabel: "✓  Full enrichment on contact form submissions",
      conditions:   "Same as Start — contactForm flag defaults to true.",
    },
    scale: {
      level:        "included-conditional",
      displayLabel: "✓  Full enrichment on contact form submissions",
      conditions:   "Same as Start — contactForm flag defaults to true.",
    },
  },

  {
    capabilityId: "dashboard-analytics",
    label:       "Variant Analytics Dashboard",
    description: "An internal dashboard surfacing variant selection frequency, CTA click rates per variant, conversion by traffic source, and session engagement depth trends — drawn from the platform's own first-party event data.",
    category:    "data",
    capabilityStatus: "planned",
    highlight:   true,

    start: {
      level:               "not-included",
      displayLabel:        "—",
      minimumTierToUnlock: "growth",
    },
    growth: {
      level:        "included-planned",
      displayLabel: "Planned — variant analytics dashboard",
      plannedNote:
        "The event data layer (events, sessions, served_variants tables) is " +
        "already collecting everything needed. This is a UI + query layer build. " +
        "Growth clients will receive this dashboard when it ships.",
    },
    scale: {
      level:        "included-planned",
      displayLabel: "Planned — advanced variant analytics dashboard",
      plannedNote:
        "Scale tier will receive the advanced dashboard level (decision audit " +
        "trail, rule configuration editor, experiment management, content status " +
        "view) when the analytics dashboard ships.",
    },
  },

  // ── INTEGRATION ─────────────────────────────────────────────────────────

  {
    capabilityId: "journey-orchestration",
    label:       "Journey Orchestration",
    description: "Contact submissions dispatch an enriched four-layer payload to n8n for routing to CRM, email sequences, Slack, or any connected workflow tool. Per-tenant webhook URL override supported.",
    category:    "integration",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included-conditional",
      displayLabel: "✓  n8n dispatch — enriched four-layer payload",
      conditions:
        "Requires N8N_CONTACT_WEBHOOK_URL environment variable (global) or " +
        "TenantContactConfig.webhookUrl (per-tenant override). Dispatches " +
        "silently when webhook is unconfigured — no error, no block.",
    },
    growth: {
      level:        "included-conditional",
      displayLabel: "✓  n8n dispatch — enriched four-layer payload",
      conditions:   "Same as Start.",
    },
    scale: {
      level:        "included-conditional",
      displayLabel: "✓  n8n dispatch — enriched four-layer payload",
      conditions:   "Same as Start.",
    },
  },

  {
    capabilityId: "multi-cms-support",
    label:       "Multi-CMS Support",
    description: "Connect the platform to any supported CMS — Sanity, Storyblok, Statamic, or the built-in mock. Each tenant chooses their own provider; the adaptive rendering pipeline is provider-agnostic.",
    category:    "integration",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included",
      displayLabel: "✓  Sanity, Storyblok, or Statamic",
    },
    growth: {
      level:        "included",
      displayLabel: "✓  Sanity, Storyblok, or Statamic",
    },
    scale: {
      level:        "included",
      displayLabel: "✓  Any supported CMS + migration assistance",
      conditions:
        "Scale tier includes CMS content migration assistance (multi-plus-migration " +
        "level). MC will help migrate existing structured content into the variant " +
        "key schema during onboarding.",
    },
  },

  // ── PLATFORM ────────────────────────────────────────────────────────────

  {
    capabilityId: "tenant-theming",
    label:       "Per-Tenant Brand Theming",
    description: "Each deployment gets its own brand theme — primary colours, radius personality, and brand metadata — injected as CSS custom properties at request time. Components inherit via cascade; no code changes needed.",
    category:    "platform",
    capabilityStatus: "available",
    highlight:   false,

    start: {
      level:        "included",
      displayLabel: "✓  Colours, radius, brand metadata",
    },
    growth: {
      level:        "included",
      displayLabel: "✓  Colours, radius, brand metadata",
    },
    scale: {
      level:        "included",
      displayLabel: "✓  Colours, radius, brand metadata",
    },
  },

] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED MATRIX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete capability feature matrix.
 *
 * 12 capability rows × 3 commercial tiers. Each cell carries a structured
 * support level, display label, conditions (where applicable), and
 * add-on/planned notes.
 *
 * Ordered: surface → decisioning → data → integration → platform.
 *
 * @example
 *   import { CAPABILITY_FEATURE_MATRIX } from "@/pricing";
 *   const aiRow = CAPABILITY_FEATURE_MATRIX.find(r => r.capabilityId === "ai-decisioning");
 *   console.log(aiRow.scale.level);   // "included-conditional"
 *   console.log(aiRow.start.level);   // "not-included"
 */
export const CAPABILITY_FEATURE_MATRIX: CapabilityFeatureMatrix = MATRIX_ROWS;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full TierCapabilityEntry for a capability × tier pair.
 *
 * The entry contains the support level, display label, conditions, and
 * any planned / add-on notes for that specific cell.
 *
 * @example
 *   const entry = getTierEntry("ai-decisioning", "scale");
 *   console.log(entry.level);      // "included-conditional"
 *   console.log(entry.conditions); // "Requires: aiDecisionProvider flag..."
 */
export function getTierEntry(
  capabilityId: CapabilityId,
  tierId: CommercialTierId,
): TierCapabilityEntry {
  const row = CAPABILITY_FEATURE_MATRIX.find((r) => r.capabilityId === capabilityId);
  if (!row) throw new Error(`No matrix row found for capability: ${capabilityId}`);
  return row[tierId];
}

/**
 * Returns the matrix row for a given capability ID.
 *
 * @example
 *   const row = getMatrixRow("multi-cms-support");
 *   console.log(row.start.level);   // "included"
 *   console.log(row.growth.level);  // "included"
 *   console.log(row.scale.level);   // "included"
 */
export function getMatrixRow(
  capabilityId: CapabilityId,
): CapabilityMatrixRow | undefined {
  return CAPABILITY_FEATURE_MATRIX.find((r) => r.capabilityId === capabilityId);
}

/**
 * Returns all matrix rows in the given capability category.
 *
 * @example
 *   const decisioning = getMatrixRowsByCategory("decisioning");
 *   // → [rules-decisioning, ai-decisioning, experiment-support]
 */
export function getMatrixRowsByCategory(
  category: CapabilityCategory,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter((r) => r.category === category);
}

/**
 * Returns matrix rows where the given tier has "included" level (available,
 * no conditions, no planned gate).
 *
 * Use this for "what does this tier deliver from day one?" summaries.
 *
 * @example
 *   const live = getIncludedCapabilities("start");
 *   // → [adaptive-homepage, rules-decisioning, visitor-history, ...]
 */
export function getIncludedCapabilities(
  tierId: CommercialTierId,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter((r) => r[tierId].level === "included");
}

/**
 * Returns matrix rows where the given tier has "included-conditional" level.
 *
 * Use this for "what does this tier include but requires configuration?" checks
 * during onboarding scoping.
 *
 * @example
 *   const conditional = getConditionalCapabilities("growth");
 *   // → [ai-decisioning, experiment-support, contact-enrichment, ...]
 */
export function getConditionalCapabilities(
  tierId: CommercialTierId,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter(
    (r) => r[tierId].level === "included-conditional",
  );
}

/**
 * Returns matrix rows where the given tier has "included-planned" level.
 *
 * Use this for "what is committed to this tier but not yet shipped?" checks.
 * Do not present these as available to clients without a confirmed ship date.
 *
 * @example
 *   const planned = getPlannedCapabilities("growth");
 *   // → [adaptive-landing-page, dashboard-analytics]
 */
export function getPlannedCapabilities(
  tierId: CommercialTierId,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter(
    (r) => r[tierId].level === "included-planned",
  );
}

/**
 * Returns matrix rows where the given tier has "addon-eligible" level.
 *
 * Use this to identify capabilities that can be activated on the current tier
 * via an add-on fee, without upgrading the full package.
 *
 * @example
 *   const addons = getAddonEligibleCapabilities("start");
 */
export function getAddonEligibleCapabilities(
  tierId: CommercialTierId,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter(
    (r) => r[tierId].level === "addon-eligible",
  );
}

/**
 * Returns matrix rows where the capability is NOT available in the given tier.
 * Includes "not-included" and "addon-eligible" levels.
 *
 * Use this for "what does this tier lack vs the full platform?" gap analysis.
 *
 * @example
 *   const gaps = getMissingCapabilities("start");
 *   // → [adaptive-landing-page, adaptive-product-page, ai-decisioning, ...]
 */
export function getMissingCapabilities(
  tierId: CommercialTierId,
): readonly CapabilityMatrixRow[] {
  return CAPABILITY_FEATURE_MATRIX.filter(
    (r) => r[tierId].level === "not-included" || r[tierId].level === "addon-eligible",
  );
}

/**
 * Returns the minimum commercial tier at which the capability is "included"
 * (fully available, not conditional or planned).
 *
 * Returns null if the capability is not fully included in any tier
 * (e.g. a planned capability not yet in any tier's "included" level).
 *
 * ─── The four key questions this answers ──────────────────────────────────
 *
 *   getMinimumTierForCapability("ai-decisioning")      →  null
 *     (AI is "included-conditional" in Growth and Scale — never purely "included")
 *
 *   getMinimumTierForCapability("multi-cms-support")   →  "start"
 *     (Available in all tiers with no conditions)
 *
 *   getMinimumTierForCapability("adaptive-landing-page") →  null
 *     (Currently "included-planned" in Growth and Scale — not yet shipped)
 *
 *   getMinimumTierForCapability("dashboard-analytics") →  null
 *     (Currently "included-planned" in Growth and Scale — not yet shipped)
 *
 * Use getMinimumTierWithAccess() to include "included-conditional" tiers.
 *
 * @example
 *   const min = getMinimumTierForCapability("rules-decisioning");
 *   // → "start"
 */
export function getMinimumTierForCapability(
  capabilityId: CapabilityId,
): CommercialTierId | null {
  const row = getMatrixRow(capabilityId);
  if (!row) return null;

  const tierOrder: CommercialTierId[] = ["start", "growth", "scale"];
  return tierOrder.find((t) => row[t].level === "included") ?? null;
}

/**
 * Returns the minimum commercial tier at which the capability is meaningfully
 * accessible — either "included" or "included-conditional".
 *
 * More permissive than getMinimumTierForCapability(). Use this when you want
 * to know "at which tier can this capability be activated at all?" including
 * cases that require feature flags or onboarding configuration.
 *
 * @example
 *   getMinimumTierWithAccess("ai-decisioning")  →  "growth"
 *   (Growth can activate AI as fallback with the aiDecisionProvider flag)
 *
 *   getMinimumTierWithAccess("multi-cms-support")  →  "start"
 *
 *   getMinimumTierWithAccess("adaptive-landing-page")  →  "growth"
 *   (Planned in Growth — returns "growth" for the "committed to this tier" case)
 */
export function getMinimumTierWithAccess(
  capabilityId: CapabilityId,
): CommercialTierId | null {
  const row = getMatrixRow(capabilityId);
  if (!row) return null;

  const tiers: CommercialTierId[] = ["start", "growth", "scale"];
  const accessLevels: MatrixSupportLevel[] = [
    "included",
    "included-conditional",
    "included-planned",
  ];

  return (
    tiers.find((t) => accessLevels.includes(row[t].level)) ?? null
  );
}

/**
 * Returns all commercial tiers in which the given capability is meaningfully
 * accessible (included, conditional, or planned).
 *
 * @example
 *   getTiersWithCapability("ai-decisioning")
 *   // → ["growth", "scale"]
 *
 *   getTiersWithCapability("adaptive-homepage")
 *   // → ["start", "growth", "scale"]
 */
export function getTiersWithCapability(
  capabilityId: CapabilityId,
): readonly CommercialTierId[] {
  const row = getMatrixRow(capabilityId);
  if (!row) return [];

  const tiers: CommercialTierId[] = ["start", "growth", "scale"];
  const accessLevels: MatrixSupportLevel[] = [
    "included",
    "included-conditional",
    "included-planned",
    "addon-eligible",
  ];

  return tiers.filter((t) => accessLevels.includes(row[t].level));
}

/**
 * Checks whether a capability is meaningfully available in the given tier.
 *
 * Returns true for "included" and "included-conditional" levels.
 * Returns false for "included-planned", "not-included", and "addon-eligible".
 *
 * Use isCapabilityAccessible() to include planned capabilities.
 *
 * @example
 *   isCapabilityInTier("rules-decisioning", "start")  →  true
 *   isCapabilityInTier("ai-decisioning", "start")     →  false
 *   isCapabilityInTier("ai-decisioning", "scale")     →  true (conditional)
 */
export function isCapabilityInTier(
  capabilityId: CapabilityId,
  tierId: CommercialTierId,
): boolean {
  const row = getMatrixRow(capabilityId);
  if (!row) return false;

  return (
    row[tierId].level === "included" ||
    row[tierId].level === "included-conditional"
  );
}

/**
 * Checks whether a capability is accessible in the given tier — including
 * planned capabilities that are committed but not yet shipped.
 *
 * @example
 *   isCapabilityAccessible("adaptive-landing-page", "growth") →  true (planned)
 *   isCapabilityAccessible("adaptive-landing-page", "start")  →  false
 */
export function isCapabilityAccessible(
  capabilityId: CapabilityId,
  tierId: CommercialTierId,
): boolean {
  const row = getMatrixRow(capabilityId);
  if (!row) return false;

  return row[tierId].level !== "not-included" && row[tierId].level !== "addon-eligible";
}

/**
 * Returns the tier the client needs to upgrade to in order to access the
 * given capability, given their current tier.
 *
 * Returns null if:
 *   - The capability is already accessible at the current tier, or
 *   - No tier above the current one includes the capability.
 *
 * @example
 *   getUpgradeTierForCapability("ai-decisioning", "start")
 *   // → "growth"  (AI is conditionally available in Growth)
 *
 *   getUpgradeTierForCapability("rules-decisioning", "start")
 *   // → null  (already included)
 *
 *   getUpgradeTierForCapability("adaptive-product-page", "growth")
 *   // → "scale"  (only in Scale)
 */
export function getUpgradeTierForCapability(
  capabilityId: CapabilityId,
  currentTierId: CommercialTierId,
): CommercialTierId | null {
  if (isCapabilityAccessible(capabilityId, currentTierId)) return null;

  const tierOrder: CommercialTierId[] = ["start", "growth", "scale"];
  const currentIndex = tierOrder.indexOf(currentTierId);

  for (let i = currentIndex + 1; i < tierOrder.length; i++) {
    const tierId = tierOrder[i];
    if (isCapabilityAccessible(capabilityId, tierId)) return tierId;
  }

  return null;
}

/**
 * Returns a human-readable upgrade message for a capability that is not
 * available in the client's current tier.
 *
 * Returns null if the capability is already accessible.
 *
 * Suitable for pricing table tooltip copy or proposal "upgrade to unlock" CTAs.
 *
 * @example
 *   getUpgradeMessage("ai-decisioning", "start")
 *   // → "Available from Growth — upgrade to unlock AI-augmented decisioning."
 *
 *   getUpgradeMessage("adaptive-product-page", "growth")
 *   // → "Available from Scale — upgrade to unlock Adaptive Product / Service Pages."
 *
 *   getUpgradeMessage("rules-decisioning", "start")
 *   // → null  (already included)
 */
export function getUpgradeMessage(
  capabilityId: CapabilityId,
  currentTierId: CommercialTierId,
): string | null {
  if (isCapabilityAccessible(capabilityId, currentTierId)) return null;

  const upgradeTier = getUpgradeTierForCapability(capabilityId, currentTierId);
  if (!upgradeTier) return null;

  const row = getMatrixRow(capabilityId);
  const tierName = PRICING_PACKAGES[upgradeTier].name;
  const capLabel = row?.label ?? capabilityId;
  const entry = row?.[upgradeTier];

  if (entry?.level === "included-planned") {
    return `Planned in ${tierName} — upgrade to access ${capLabel} when it ships.`;
  }

  return `Available from ${tierName} — upgrade to unlock ${capLabel}.`;
}

/**
 * Builds a structured summary of all capabilities for a given commercial tier.
 *
 * Groups capabilities into five buckets: included, conditional, planned,
 * add-on eligible, and not included.
 *
 * Use this for:
 *   - "What does this tier deliver?" summaries in proposals
 *   - Onboarding scoping: what needs configuration vs what's automatic
 *   - Internal qualification: does this tier cover the client's requirements?
 *
 * @example
 *   const summary = getTierCapabilitySummary("growth");
 *   console.log(summary.included.map(r => r.label));
 *   // → ["Adaptive Homepage", "Rules-Based Decisioning", "First-Party Visitor History", ...]
 *
 *   console.log(summary.planned.map(r => r.label));
 *   // → ["Adaptive Landing Pages", "Variant Analytics Dashboard"]
 */
export function getTierCapabilitySummary(
  tierId: CommercialTierId,
): TierCapabilitySummary {
  const tier = PRICING_PACKAGES[tierId];

  return {
    tierId,
    tierName:     tier.name,
    included:     getIncludedCapabilities(tierId),
    conditional:  getConditionalCapabilities(tierId),
    planned:      getPlannedCapabilities(tierId),
    addOnEligible: getAddonEligibleCapabilities(tierId),
    notIncluded:  CAPABILITY_FEATURE_MATRIX.filter(
      (r) => r[tierId].level === "not-included",
    ),
  };
}

/**
 * Checks whether a given set of required capabilities is fully covered by
 * the given tier. Returns a structured coverage report.
 *
 * "covered" means the capability is at least "included-conditional" or better.
 * "planned" and "not-included" capabilities are surfaced separately so the
 * caller can make an informed decision.
 *
 * Useful in a sales qualification flow: "does the Growth tier cover everything
 * this client needs?"
 *
 * @example
 *   const coverage = checkTierCoverage("start", [
 *     "adaptive-homepage",
 *     "ai-decisioning",
 *     "experiment-support",
 *   ]);
 *   // coverage.covered  → ["adaptive-homepage"]
 *   // coverage.notCovered → ["ai-decisioning", "experiment-support"]
 *   // coverage.fullyCovered → false
 */
export function checkTierCoverage(
  tierId: CommercialTierId,
  requiredCapabilityIds: readonly CapabilityId[],
): {
  covered:       readonly CapabilityId[];
  planned:       readonly CapabilityId[];
  notCovered:    readonly CapabilityId[];
  fullyCovered:  boolean;
} {
  const covered:    CapabilityId[] = [];
  const planned:    CapabilityId[] = [];
  const notCovered: CapabilityId[] = [];

  for (const capId of requiredCapabilityIds) {
    const row = getMatrixRow(capId);
    if (!row) {
      notCovered.push(capId);
      continue;
    }
    const level = row[tierId].level;
    if (level === "included" || level === "included-conditional") {
      covered.push(capId);
    } else if (level === "included-planned") {
      planned.push(capId);
    } else {
      notCovered.push(capId);
    }
  }

  return {
    covered,
    planned,
    notCovered,
    fullyCovered: notCovered.length === 0 && planned.length === 0,
  };
}

/**
 * Returns a flat, display-ready table structure for rendering a capability
 * comparison across all three tiers.
 *
 * Each row contains the dimension label, category, capability status, and
 * one display label per tier. Suitable for a React pricing table component.
 *
 * This is a display-string layer on top of the structured matrix — similar to
 * buildPackageFeatureMatrix() in packages.ts, but derived from the capability
 * model rather than handwritten.
 *
 * @example
 *   const table = buildDisplayMatrix();
 *   table.forEach(row =>
 *     console.log(row.label, row.start, row.growth, row.scale)
 *   );
 */
export function buildDisplayMatrix(): readonly {
  capabilityId:    CapabilityId;
  label:           string;
  category:        CapabilityCategory;
  status:          ModuleStatus;
  highlight:       boolean;
  start:           string;
  growth:          string;
  scale:           string;
}[] {
  return CAPABILITY_FEATURE_MATRIX.map((row) => ({
    capabilityId: row.capabilityId,
    label:        row.label,
    category:     row.category,
    status:       row.capabilityStatus,
    highlight:    row.highlight,
    start:        row.start.displayLabel,
    growth:       row.growth.displayLabel,
    scale:        row.scale.displayLabel,
  }));
}

/**
 * Resolves a Capability object from the feature matrix row.
 *
 * Returns the full Capability metadata (description, scope, sourceModule,
 * tenantFeatureFlag) for a matrix row — useful when consumers need the
 * full product-layer context alongside the matrix entry.
 *
 * @example
 *   const row = getMatrixRow("ai-decisioning");
 *   const cap = resolveCapability(row);
 *   console.log(cap.tenantFeatureFlag); // "aiDecisionProvider"
 */
export function resolveCapability(
  row: CapabilityMatrixRow,
): Capability | undefined {
  return CAPABILITY_INDEX[row.capabilityId];
}

/**
 * Returns the full matrix — all rows — for consumption by tools that need the
 * complete picture. Alias for CAPABILITY_FEATURE_MATRIX for explicit naming in
 * import statements.
 *
 * @example
 *   import { getFullMatrix } from "@/pricing";
 *   const all = getFullMatrix();
 */
export function getFullMatrix(): CapabilityFeatureMatrix {
  return CAPABILITY_FEATURE_MATRIX;
}
