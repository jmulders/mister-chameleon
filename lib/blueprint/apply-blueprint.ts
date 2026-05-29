/**
 * Blueprint Apply System
 *
 * Provides safe, merge-based loading of a Blueprint into a tenant's
 * personalization configuration.
 *
 * ── Modes ─────────────────────────────────────────────────────────────────────
 *
 *   Merge (default)
 *     - If an entity with the same key doesn't exist → create it.
 *     - If the entity exists AND its source is "system" or "blueprint" → update.
 *     - If the entity exists AND its source is "tenant" → skip (protect).
 *     No entities are deleted.
 *
 *   Reset (explicit — requires UI confirmation)
 *     - Replaces all "system" and "blueprint" entities with blueprint content.
 *     - Entities with source "tenant" are never touched.
 *     - Equivalent to a clean merge after removing all non-tenant entities.
 *
 * ── What gets seeded in code vs CMS ──────────────────────────────────────────
 *
 *   This module operates on in-memory representations (BlueprintVariant[],
 *   BlueprintRule[]).  Persistence is the responsibility of the caller:
 *     • For variant content  → write to the CMS (Sanity document upsert).
 *     • For rules            → write to runtime-rules.json or the DB rules table.
 *
 *   Callers should call applyBlueprint() and then persist the result via their
 *   own storage adapters.
 */

import type {
  Blueprint,
  BlueprintVariant,
  BlueprintRule,
  SourceLabel,
} from "@/lib/blueprint/types";

// ── Result types ──────────────────────────────────────────────────────────────

export interface VariantApplyResult {
  key:    string;
  action: "created" | "updated" | "skipped_tenant" | "unchanged";
}

export interface RuleApplyResult {
  id:     string;
  action: "created" | "updated" | "skipped_tenant" | "unchanged";
}

export interface ApplyBlueprintResult {
  blueprintId: string;
  version:     string;
  mode:        "merge" | "reset";
  heroVariants:  VariantApplyResult[];
  proofVariants: VariantApplyResult[];
  ctaVariants:   VariantApplyResult[];
  rules:         RuleApplyResult[];
  defaultPlanUpdated: boolean;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface ApplyBlueprintOptions {
  /**
   * "merge"  — (default) protect tenant entities; upsert system/blueprint.
   * "reset"  — replace all system/blueprint entities; still protect tenant.
   */
  mode?: "merge" | "reset";
}

// ── Existing entity shapes (what the caller passes as current state) ──────────

export interface ExistingVariant {
  key:    string;
  source: SourceLabel;
}

export interface ExistingRule {
  id:     string;
  source: SourceLabel;
}

export interface ExistingConfig {
  heroVariants:  ExistingVariant[];
  proofVariants: ExistingVariant[];
  ctaVariants:   ExistingVariant[];
  rules:         ExistingRule[];
  defaultPlanSource?: SourceLabel;
}

// ── Core merge helpers ────────────────────────────────────────────────────────

function mergeVariants(
  incoming:  BlueprintVariant[],
  existing:  ExistingVariant[],
  mode:      "merge" | "reset",
): { merged: BlueprintVariant[]; results: VariantApplyResult[] } {
  const existingMap = new Map(existing.map(v => [v.key, v]));
  const merged:  BlueprintVariant[]    = [];
  const results: VariantApplyResult[]  = [];

  for (const variant of incoming) {
    const current = existingMap.get(variant.key);

    if (!current) {
      // Key doesn't exist → always create
      merged.push(variant);
      results.push({ key: variant.key, action: "created" });
      continue;
    }

    if (current.source === "tenant") {
      // Tenant entity → never overwrite
      results.push({ key: variant.key, action: "skipped_tenant" });
      continue;
    }

    if (mode === "reset" || current.source === "system" || current.source === "blueprint") {
      merged.push(variant);
      results.push({ key: variant.key, action: "updated" });
    } else {
      results.push({ key: variant.key, action: "unchanged" });
    }
  }

  return { merged, results };
}

function mergeRules(
  incoming: BlueprintRule[],
  existing: ExistingRule[],
  mode:     "merge" | "reset",
): { merged: BlueprintRule[]; results: RuleApplyResult[] } {
  const existingMap = new Map(existing.map(r => [r.id, r]));
  const merged:  BlueprintRule[]    = [];
  const results: RuleApplyResult[]  = [];

  for (const rule of incoming) {
    const current = existingMap.get(rule.id);

    if (!current) {
      merged.push(rule);
      results.push({ id: rule.id, action: "created" });
      continue;
    }

    if (current.source === "tenant") {
      results.push({ id: rule.id, action: "skipped_tenant" });
      continue;
    }

    if (mode === "reset" || current.source === "system" || current.source === "blueprint") {
      merged.push(rule);
      results.push({ id: rule.id, action: "updated" });
    } else {
      results.push({ id: rule.id, action: "unchanged" });
    }
  }

  return { merged, results };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the merged set of variants and rules by applying a Blueprint onto
 * the existing tenant configuration.
 *
 * Returns the full ApplyBlueprintResult including:
 *   - The merged variant arrays (ready to persist to CMS / DB)
 *   - The merged rule array (ready to write to runtime-rules.json / DB)
 *   - Per-entity action log for audit / admin UI
 *
 * @param blueprint      The blueprint to apply.
 * @param existing       Current tenant state (what's already in the DB / CMS).
 * @param options        Merge mode (default "merge").
 */
export function applyBlueprint(
  blueprint: Blueprint,
  existing:  ExistingConfig,
  options:   ApplyBlueprintOptions = {},
): ApplyBlueprintResult {
  const mode = options.mode ?? "merge";

  const { merged: heroVariants,  results: heroResults  } = mergeVariants(
    blueprint.heroVariants, existing.heroVariants, mode,
  );
  const { merged: proofVariants, results: proofResults } = mergeVariants(
    blueprint.proofVariants, existing.proofVariants, mode,
  );
  const { merged: ctaVariants,   results: ctaResults   } = mergeVariants(
    blueprint.ctaVariants, existing.ctaVariants, mode,
  );
  const { merged: rules,         results: ruleResults  } = mergeRules(
    blueprint.rules, existing.rules, mode,
  );

  // Default plan: update unless the existing one is tenant-owned
  const defaultPlanSource = existing.defaultPlanSource ?? "blueprint";
  const defaultPlanUpdated =
    mode === "reset"
    || defaultPlanSource === "system"
    || defaultPlanSource === "blueprint";

  return {
    blueprintId:        blueprint.id,
    version:            blueprint.version,
    mode,
    heroVariants:       heroResults,
    proofVariants:      proofResults,
    ctaVariants:        ctaResults,
    rules:              ruleResults,
    defaultPlanUpdated,
  };
}

// ── Convenience: summary helpers ──────────────────────────────────────────────

/**
 * Returns a human-readable summary line for a result, useful for admin logs
 * and test assertions.
 */
export function summariseResult(result: ApplyBlueprintResult): string {
  const count = (arr: Array<{ action: string }>, action: string) =>
    arr.filter(r => r.action === action).length;

  const allVariants = [
    ...result.heroVariants,
    ...result.proofVariants,
    ...result.ctaVariants,
  ];

  return [
    `Blueprint "${result.blueprintId}" v${result.version} applied (mode: ${result.mode}).`,
    `  Variants — created: ${count(allVariants, "created")}, ` +
    `updated: ${count(allVariants, "updated")}, ` +
    `protected (tenant): ${count(allVariants, "skipped_tenant")}.`,
    `  Rules    — created: ${count(result.rules, "created")}, ` +
    `updated: ${count(result.rules, "updated")}, ` +
    `protected (tenant): ${count(result.rules, "skipped_tenant")}.`,
  ].join("\n");
}
