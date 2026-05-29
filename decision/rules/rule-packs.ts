/**
 * Rule Packs
 *
 * Groups of related decision rules bundled under a shared theme, scope, and
 * priority tier.  Rule packs are metadata — they don't change how rules are
 * evaluated, but they give the admin UI and debug output structure.
 *
 * ─── Precedence tiers ────────────────────────────────────────────────────────
 *
 *   Each tier maps to a numeric priority range.  Rules within a tier compete
 *   by their specific priority value; rules in a lower-number tier always win
 *   over rules in a higher-number tier.
 *
 *   Tier            Range   Description
 *   ─────────────── ─────── ─────────────────────────────────────────────────
 *   hard_state       1–9    Deterministic visitor state signals that should
 *                           always override any other segmentation.  Examples:
 *                           known customer in onboarding, returning CTA-clicker.
 *
 *   high_intent     10–19   Strong intent signals that meaningfully change
 *                           the messaging strategy.  Examples: specific UTM
 *                           campaigns, conversion-ready behaviour.
 *
 *   medium_segmentation 20–49  Standard segmentation rules — traffic source,
 *                           device type, funnel stage.  These provide the
 *                           default personalisation for most visitors.
 *
 *   decorative      50–99   Low-confidence hints used only when nothing more
 *                           specific applies.  Examples: time of day, season,
 *                           first visit with no other signals.
 *
 * ─── Built-in packs ──────────────────────────────────────────────────────────
 *
 *   pack_behaviour        — Rules driven by visitor history & engagement
 *                           (returning, CTA-clicked, page view count)
 *   pack_traffic_source   — Rules driven by UTM source / referrer
 *   pack_device           — Rules driven by device type
 *   pack_funnel_stage     — Rules driven by funnel/lifecycle stage context
 *   pack_campaigns        — Rules targeting specific ad campaigns via UTM
 *
 * ─── Adding a pack ────────────────────────────────────────────────────────────
 *
 *   1. Add an entry to RULE_PACK_REGISTRY.
 *   2. Set packId on any new rules that belong to the pack.
 *   3. Choose a precedence level consistent with the tier ranges above.
 *   4. Optionally set a `color` for the admin UI badge (Tailwind color name).
 */

// ── Precedence tiers ───────────────────────────────────────────────────────────

/**
 * The four named precedence tiers.
 *
 * Tiers map to numeric ranges:
 *   hard_state           → 1–9
 *   high_intent          → 10–19
 *   medium_segmentation  → 20–49
 *   decorative           → 50–99
 */
export type PrecedenceLevel =
  | "hard_state"
  | "high_intent"
  | "medium_segmentation"
  | "decorative";

/**
 * Metadata for each tier: priority range and human-readable labels.
 */
export const PRECEDENCE_TIERS: Readonly<Record<
  PrecedenceLevel,
  { range: readonly [number, number]; label: string; description: string; color: string }
>> = {
  hard_state: {
    range:       [1, 9],
    label:       "Hard state",
    description: "Deterministic visitor state that always overrides any other rule. Use for known customers, post-conversion states, and returning CTA-clickers.",
    color:       "red",
  },
  high_intent: {
    range:       [10, 19],
    label:       "High intent",
    description: "Strong intent signals that meaningfully change the messaging strategy: specific campaigns, high-engagement behaviour, or direct-apply actions.",
    color:       "orange",
  },
  medium_segmentation: {
    range:       [20, 49],
    label:       "Medium segmentation",
    description: "Standard audience segmentation — traffic source, device type, funnel stage. Provides personalisation for the broad middle of the funnel.",
    color:       "blue",
  },
  decorative: {
    range:       [50, 99],
    label:       "Decorative",
    description: "Low-confidence hints applied only when no higher-priority rule matches: time of day, day of week, first visit with no other signals.",
    color:       "neutral",
  },
} as const;

/**
 * Infer which precedence tier a numeric priority value falls into.
 * Returns undefined when the priority is out of all tier ranges.
 */
export function inferPrecedenceLevel(priority: number): PrecedenceLevel | undefined {
  for (const [level, meta] of Object.entries(PRECEDENCE_TIERS)) {
    const [min, max] = meta.range;
    if (priority >= min && priority <= max) {
      return level as PrecedenceLevel;
    }
  }
  return undefined;
}

// ── Rule packs ─────────────────────────────────────────────────────────────────

/**
 * A named group of related rules sharing a common theme or scope.
 *
 * `scope` is a free-form tag used for filtering in the admin UI
 * (e.g. "traffic", "device", "lifecycle").
 *
 * `color` is a Tailwind color name used to tint the pack badge; defaults to
 * "neutral" when absent.
 */
export interface RulePack {
  readonly id:          string;
  readonly label:       string;
  readonly description: string;
  readonly scope?:      string;
  readonly color?:      string;
}

/**
 * The authoritative map of all platform-defined rule packs.
 *
 * Keys are pack IDs matching the `id` field inside each definition.
 * Tenant-level custom packs are NOT stored here — they live in the
 * StoredRulesConfig.packs array alongside the tenant's rules.
 */
export const RULE_PACK_REGISTRY: Readonly<Record<string, RulePack>> = {

  pack_behaviour: {
    id:          "pack_behaviour",
    label:       "Behaviour & engagement",
    description: "Rules driven by visitor history signals: returning visitors, CTA clicks, and page view count.",
    scope:       "engagement",
    color:       "purple",
  },

  pack_traffic_source: {
    id:          "pack_traffic_source",
    label:       "Traffic source",
    description: "Rules driven by UTM source or detected referrer channel (Google, LinkedIn, paid, direct).",
    scope:       "traffic",
    color:       "blue",
  },

  pack_device: {
    id:          "pack_device",
    label:       "Device type",
    description: "Rules that optimise layout and CTA copy for mobile vs. desktop visitors.",
    scope:       "device",
    color:       "slate",
  },

  pack_funnel_stage: {
    id:          "pack_funnel_stage",
    label:       "Funnel stage",
    description: "Rules that map visitor lifecycle stage (awareness, consideration, intent, customer) to tailored variant plans.",
    scope:       "funnel",
    color:       "green",
  },

  pack_campaigns: {
    id:          "pack_campaigns",
    label:       "Campaigns",
    description: "Rules targeting specific paid or organic campaigns via UTM parameters.",
    scope:       "campaigns",
    color:       "amber",
  },

  pack_interest: {
    id:          "pack_interest",
    label:       "Interest profiles",
    description: "Rules driven by computed visitor interest scores. Activates when a visitor's keyword cloud matches a platform-managed interest profile (pricing, product, trust, technical, etc.).",
    scope:       "interest",
    color:       "teal",
  },

} as const;

/** All registered pack IDs. */
export const ALL_PACK_IDS: readonly string[] = Object.keys(RULE_PACK_REGISTRY);

/**
 * Look up a RulePack by ID.  Returns undefined for unknown packs (e.g. a tenant
 * custom pack not in the platform registry).
 */
export function getRulePack(packId: string): RulePack | undefined {
  return RULE_PACK_REGISTRY[packId];
}
