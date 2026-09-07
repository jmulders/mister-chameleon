import "server-only";

/**
 * Platform-side seed for a demo rollout.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * The demo CMS seed ships a `context_slot` on its homepage and two hero
 * variants in the page's catalogue. That is only half of a working
 * demonstration: the slot asks the decision engine which variant to render, and
 * with no platform data the engine has nothing to choose between, so the slot
 * renders `hero_default` forever. A "demo" where personalisation never visibly
 * fires is not a demo.
 *
 * So a demo rollout also writes, for the new tenant:
 *
 *   - tenant-scoped adaptive blocks keyed by the variant keys the demo-home slots
 *     resolve (hero_default, hero_enterprise, feature_default), all brand-free
 *     Dutch (Acme) copy — so the slots stop falling back to the platform-wide
 *     Mister Chameleon product copy (see DEMO_SEEDED_BLOCK_KEYS);
 *   - one rule in `rules_config` (`homepage_<tenantId>`) that switches the hero on
 *     a signal an operator can actually produce on demand.
 *
 * ─── Why LinkedIn traffic is the trigger ─────────────────────────────────────
 *
 * A demo has to be demonstrable. `source` is derived from the referrer and the
 * scenario console can set it directly, so an operator can show the hero change
 * live without waiting for real traffic or faking a device. Device or UTM would
 * work equally well; the point is that it is one visible switch, not a subtle one.
 *
 * ─── Why the keys are platform keys ──────────────────────────────────────────
 *
 * `validateStoredConfig` rejects a plan naming a variant key outside
 * `ALLOWED_*_KEYS`, and a Statamic tenant contributes no extraKeys. So the rule
 * targets `hero_enterprise` — a platform key the CMS seed also uses — rather
 * than something invented here. A rejected config makes the ENTIRE rule set
 * invalid, not just the offending rule, so this matters more than it looks.
 *
 * ─── Fail-open ───────────────────────────────────────────────────────────────
 *
 * Nothing here is allowed to fail a rollout. A demo whose personalisation is
 * missing is still a working site with content on it; the caller surfaces a
 * warning and moves on.
 */

import { getDb }                    from "@/data/db";
import { upsertAdaptiveBlock }      from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { validateStoredConfig }     from "@/decision/rules/stored-rule";
import type { StoredRule, StoredRulesConfig } from "@/decision/rules/stored-rule";
import type { AdaptiveVariantContent }        from "@/cms/types";

/** The single place the example brand name is defined. */
export const DEMO_BRAND = "Acme";

/**
 * Adaptive blocks are resolved BY VARIANT KEY: the homepage slots call
 * getHeroVariant("hero_default") / getFeatureVariant("feature_default") etc.,
 * which look up an adaptive_blocks row whose `key` equals that variant key
 * (tenant row first, then the platform-wide row). So to override the platform
 * defaults for a demo we must seed one tenant-scoped block PER variant key the
 * demo-home resolves — not one block under an invented key. The keys below are
 * exactly the ones the neutral CMS demo-home (home.md) + the demo rule reference:
 *   - hero_default    — the hero slot's default plan
 *   - hero_enterprise — the hero slot under the LinkedIn rule
 *   - feature_default — the feature slot (else it falls back to the MC feature grid)
 * Without these, the tenant has no row for these keys and the slots render the
 * platform-wide Mister Chameleon product copy. See DEMO_SEEDED_BLOCK_KEYS.
 */
export const DEMO_SEEDED_BLOCK_KEYS = ["hero_default", "hero_enterprise", "feature_default"] as const;

/** Rule that switches the hero. Its priority must be unique in the config. */
export const DEMO_RULE_ID       = "demo_hero_linkedin";
export const DEMO_RULE_PRIORITY = 40;

export interface DemoPlatformSeedResult {
  ok:       boolean;
  message:  string;
  /** Which pieces were written, for the rollout's step list. */
  seeded:   string[];
  warnings: string[];
}

// ── Content ───────────────────────────────────────────────────────────────────

const heroDefault: AdaptiveVariantContent = {
  title:         `Een website die je zelf beheert`,
  subtitle:      `${DEMO_BRAND} bouwt overzichtelijke websites die je daarna zonder ons kunt onderhouden. Snel live, makkelijk uit te breiden.`,
  tag:           DEMO_BRAND,
  layoutVariant: "hero_default",
  contentAlign:  "center",
  ctas: [
    { label: "Neem contact op", href: "/contact" },
    { label: "Bekijk ons werk", href: "/cases" },
  ],
};

const heroEnterprise: AdaptiveVariantContent = {
  title:         "Eén site, elke doelgroep het juiste verhaal",
  subtitle:      "Laat de introductie meebewegen met waar je bezoeker vandaan komt, zonder dat je meerdere sites hoeft te beheren.",
  tag:           "Voor organisaties",
  layoutVariant: "hero_default",
  contentAlign:  "center",
  ctas: [
    { label: "Plan een gesprek", href: "/contact" },
    { label: "Lees de cases",    href: "/cases" },
  ],
};

// The feature slot's neutral variant — mirrors the CMS demo-home's
// feature_variants catalogue so it reads as one demo, and replaces the
// platform-wide Mister Chameleon "Everything you need…" grid for this tenant.
const featureDefault: AdaptiveVariantContent = {
  title:         "Wat je krijgt",
  subtitle:      `Een site die past bij hoe jouw organisatie werkt.`,
  layoutVariant: "feature_grid",
  items: [
    { title: "Eigen huisstijl",     body: "Kleuren, lettertype en logo van je eigen merk." },
    { title: "Werkt op elk scherm", body: "Van telefoon tot breedbeeld, zonder aparte mobiele site." },
    { title: "Vindbaar",            body: "Nette structuur en snelle pagina's, zodat zoekmachines je vinden." },
  ],
};

/** Variant key → neutral content, one adaptive_blocks row per key (see DEMO_SEEDED_BLOCK_KEYS). */
const SEEDED_BLOCKS: ReadonlyArray<{ key: string; label: string; content: AdaptiveVariantContent }> = [
  { key: "hero_default",    label: "Standaard",         content: heroDefault },
  { key: "hero_enterprise", label: "Voor organisaties", content: heroEnterprise },
  { key: "feature_default", label: "Wat je krijgt",     content: featureDefault },
];

/**
 * The demo rule: visitors arriving from LinkedIn see the organisation-facing
 * hero. Deliberately one condition on one field — an operator demonstrating
 * this should be able to explain it in a sentence.
 */
export function buildDemoRule(): StoredRule {
  return {
    id:              DEMO_RULE_ID,
    priority:        DEMO_RULE_PRIORITY,
    label:           "Demo: bezoeker via LinkedIn krijgt de organisatie-hero",
    condition:       { type: "field", field: "source", operator: "equals", value: "linkedin" },
    // All three keys are required: validateStoredConfig rejects a plan with an
    // undefined proofKey/ctaKey, and a rejected config invalidates the whole set.
    plan:            { heroKey: "hero_enterprise", proofKey: "proof_platform", ctaKey: "cta_meeting" },
    reason:          "Bezoeker komt van LinkedIn → zakelijke invalshoek in de hero.",
    enabled:         true,
    source:          "blueprint",
    precedenceLevel: "medium_segmentation",
  } as StoredRule;
}

/** The config written when the tenant has none yet. */
export function buildDemoRulesConfig(existing: StoredRulesConfig | null): StoredRulesConfig {
  const rule  = buildDemoRule();
  const rules = (existing?.rules ?? []).filter((r) => r.id !== rule.id);

  // Priorities must be unique — validateStoredConfig rejects the WHOLE config
  // on a duplicate, which would take the tenant's existing rules down with it.
  // Step past any collision rather than overwrite someone else's rule.
  let priority = rule.priority;
  const taken = new Set(rules.map((r) => r.priority));
  while (taken.has(priority)) priority++;

  return {
    schemaVersion: 1,
    updatedAt:     new Date().toISOString(),
    rules:         [...rules, { ...rule, priority }],
    defaultPlan:   existing?.defaultPlan ?? {
      heroKey:  "hero_default",
      proofKey: "proof_default",
      ctaKey:   "cta_default",
      reason:   "Standaardvariant — geen regel matchte.",
    },
    ...(existing?.rulesEnabled !== undefined ? { rulesEnabled: existing.rulesEnabled } : {}),
  };
}

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Write the adaptive block and the rule for a freshly created demo tenant.
 *
 * Idempotent: the block upserts on (key, tenant_id), and the rule is replaced
 * by id rather than appended, so a repeat rollout does not accumulate copies.
 * Any existing rules for the tenant are preserved.
 *
 * Never throws — every failure becomes a warning in the result.
 */
export async function seedDemoPlatformData(
  tenantId: string,
  /**
   * Injectable I/O. Exists so the write path can be tested without a database;
   * production callers pass nothing and get the real store and client.
   */
  deps: {
    upsertBlock?: typeof upsertAdaptiveBlock;
    db?:          () => unknown;
  } = {},
): Promise<DemoPlatformSeedResult> {
  const upsertBlock = deps.upsertBlock ?? upsertAdaptiveBlock;
  const openDb      = deps.db ?? getDb;

  const seeded:   string[] = [];
  const warnings: string[] = [];
  if (!tenantId) return { ok: false, message: "tenantId is required.", seeded, warnings };

  // ── 1. Adaptive blocks — one tenant-scoped row per variant key ────────────
  // Each block's `defaultVariant` is what getHeroVariant/getFeatureVariant return
  // for that key, so a tenant row here overrides the platform-wide Mister
  // Chameleon default for THIS tenant only. All neutral Acme copy.
  let blocksSeeded = 0;
  for (const block of SEEDED_BLOCKS) {
    try {
      const res = await upsertBlock({
        key:            block.key,
        tenantId,
        isActive:       true,
        defaultVariant: block.content,
        adaptiveVariants: [
          { variantKey: block.key, label: block.label, content: block.content },
        ],
      });
      if (res.ok) blocksSeeded++;
      else        warnings.push(`Adaptive block ${block.key}: ${res.error}`);
    } catch (err) {
      warnings.push(`Adaptive block ${block.key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (blocksSeeded > 0) {
    seeded.push(`${blocksSeeded} adaptive block${blocksSeeded === 1 ? "" : "s"} (${SEEDED_BLOCKS.map((b) => b.key).join(", ")})`);
  }

  // ── 2. Rule ───────────────────────────────────────────────────────────────
  try {
    const rulesKey = `homepage_${tenantId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hand-written Database types lag the schema.
    const db = openDb() as any;

    let existing: StoredRulesConfig | null = null;
    try {
      const { data } = await db.from("rules_config").select("config").eq("key", rulesKey).maybeSingle();
      const raw = (data as { config?: unknown } | null)?.config;
      if (typeof raw === "string") existing = JSON.parse(raw) as StoredRulesConfig;
      else if (raw && typeof raw === "object") existing = raw as StoredRulesConfig;
    } catch { /* no existing config — seed a fresh one */ }

    const config = buildDemoRulesConfig(existing);

    // Validate before writing. A config the engine rejects is worse than none:
    // validateStoredConfig is all-or-nothing, so an invalid write would disable
    // every rule the tenant has, not just this one.
    const errors = validateStoredConfig(config as unknown);
    if (errors.length > 0) {
      warnings.push(`Demo rule not written — it would invalidate the tenant's rule set: ${errors.map((e) => e.message).join("; ")}`);
    } else {
      const { error } = await db
        .from("rules_config")
        .upsert({ key: rulesKey, config: JSON.stringify(config), updated_at: new Date().toISOString() });
      if (error) warnings.push(`Demo rule: ${(error as { message?: string }).message ?? "write failed"}`);
      else       seeded.push(`rule ${DEMO_RULE_ID} in ${rulesKey}`);
    }
  } catch (err) {
    warnings.push(`Demo rule: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok:      seeded.length > 0,
    message: seeded.length
      ? `Seeded ${seeded.join(" and ")}.`
      : "Nothing was seeded — the demo will render its default variant only.",
    seeded,
    warnings,
  };
}
