/**
 * Merged Context Variable Registry
 *
 * Combines the static registry (context/registry.ts) with operator-editable
 * metadata from the database (context_variable_metadata table) to produce a
 * unified list of context variables for admin display and runtime filtering.
 *
 * ─── Merge strategy ───────────────────────────────────────────────────────────
 *
 *   Built-in variables (registry entries):
 *     System fields  — key, type, source, operators, allowedValues, exampleValue
 *                      always come from the registry (immutable).
 *     Display fields — label, description come from the DB row when present,
 *                      otherwise fall back to the registry value.
 *     Gate fields    — enabled defaults to true; usableInRules / usableInAI
 *                      default to the registry availableToRules / availableToAI
 *                      but can be overridden by the DB row.
 *     Custom fields  — isCustom = false; category / sortOrder from DB or 0.
 *
 *   Custom variables (DB-only, is_custom = true):
 *     All fields come from the DB row.  custom_type / custom_source are cast
 *     to ContextVarType / ContextVarSource.  operators are derived from type
 *     via getOperatorsForType().
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   Admin context page      — full list, all fields, for display/editing.
 *   Rules editor            — filter usableInRules = true and enabled = true.
 *   AI provider context     — filter usableInAI = true and enabled = true.
 *
 * ─── Runtime safety ───────────────────────────────────────────────────────────
 *
 *   This function is async (requires DB access) and is intended for server-side
 *   use only.  It never throws — on DB error it falls back to registry-only
 *   data so the admin page and rules editor always have a working baseline.
 *
 * ─── Existing code compatibility ─────────────────────────────────────────────
 *
 *   The static CONTEXT_VARIABLES / getVarsForRules() / getVarsForAI() exports
 *   from registry.ts are unchanged and continue to work for all existing
 *   synchronous consumers (field-registry, decision-context, etc.).
 *   This file adds a new async layer on top — it does not replace the static one.
 */

import {
  CONTEXT_VARIABLES,
  CONTEXT_VARIABLE_MAP,
  getOperatorsForType,
} from "@/context/registry";
import type { ContextVariableDef, ContextVarType, ContextVarSource } from "@/context/registry";
import { listAllMetadata } from "@/data/repositories/context-variables-repository";
import type { ContextVariableMetadataRow } from "@/data/types";
import { logger } from "@/lib/logger";

// ── Merged variable shape ─────────────────────────────────────────────────────

/**
 * A fully resolved context variable combining static registry fields with
 * DB-backed metadata.
 *
 * Extends ContextVariableDef with:
 *   - enabled:       operator-controlled soft-disable flag
 *   - usableInRules: resolved gate (registry flag + DB override)
 *   - usableInAI:    resolved gate (registry flag + DB override)
 *   - category:      optional grouping label from DB
 *   - sortOrder:     display ordering hint from DB
 *   - isCustom:      true only for admin-created variables
 *   - metadataRow:   the raw DB row when present (null for built-ins never edited)
 */
export interface MergedContextVar extends ContextVariableDef {
  /** When false, this variable is hidden from rules / AI selection. */
  enabled:       boolean;
  /** Final gate for rules availability (registry + DB override applied). */
  usableInRules: boolean;
  /** Final gate for AI availability (registry + DB override applied). */
  usableInAI:    boolean;
  /** Optional grouping label from DB metadata. */
  category:      string | null;
  /** Display order within a group. */
  sortOrder:     number;
  /** True only for variables created via the admin UI. */
  isCustom:      boolean;
  /** The raw metadata row from the DB, or null if no row exists yet. */
  metadataRow:   ContextVariableMetadataRow | null;
}

// ── getMergedContextVariables ─────────────────────────────────────────────────

/**
 * Returns the full list of context variables with DB metadata applied.
 *
 * Order:
 *   1. Built-in variables in their original registry order (DB sort_order
 *      can override position within the final sorted list if needed,
 *      but default behaviour preserves registry order).
 *   2. Custom variables sorted by sort_order ASC, then key ASC.
 *
 * Fallback: if the DB fetch fails, logs a warning and returns registry-only
 * data (all built-ins with default metadata, no custom variables).
 */
export async function getMergedContextVariables(): Promise<MergedContextVar[]> {
  // Fetch DB metadata — failures are gracefully handled below.
  const metaResult = await listAllMetadata();

  let metaMap: Map<string, ContextVariableMetadataRow>;

  if (!metaResult.ok) {
    logger.warn(
      "[merged-registry] Failed to load context variable metadata from DB; using registry defaults.",
      { error: metaResult.error },
    );
    metaMap = new Map();
  } else {
    metaMap = new Map(metaResult.data.map((row) => [row.key, row]));
  }

  // ── 1. Built-in variables ─────────────────────────────────────────────────

  const builtIns: MergedContextVar[] = CONTEXT_VARIABLES.map((def) => {
    const meta = metaMap.get(def.key) ?? null;

    return {
      // Immutable system fields always from registry.
      key:           def.key,
      type:          def.type,
      source:        def.source,
      operators:     def.operators,
      allowedValues: def.allowedValues,
      exampleValue:  def.exampleValue,

      // Display fields: DB overrides registry when present.
      label:         (meta?.label       ?? null) || def.label,
      description:   (meta?.description ?? null) || def.description,

      // Gate fields: DB overrides registry when non-null.
      usableInRules: meta?.usable_in_rules ?? def.availableToRules,
      usableInAI:    meta?.usable_in_ai    ?? def.availableToAI,

      // Keep ContextVariableDef's original flags unchanged for downstream
      // compatibility (field-registry etc. still use these).
      availableToRules: def.availableToRules,
      availableToAI:    def.availableToAI,

      // Metadata-only fields.
      enabled:   meta?.enabled    ?? true,
      category:  meta?.category   ?? null,
      sortOrder: meta?.sort_order ?? 0,
      isCustom:  false,
      metadataRow: meta,
    };
  });

  // ── 2. Custom variables ───────────────────────────────────────────────────

  const customRows = metaResult.ok
    ? metaResult.data.filter((row) => row.is_custom)
    : [];

  const customVars: MergedContextVar[] = customRows
    .filter((row) => {
      // Defensively skip rows where type/source are missing.
      if (!row.custom_type || !row.custom_source) {
        logger.warn("[merged-registry] Custom variable row missing custom_type or custom_source — skipped.", {
          key: row.key,
        });
        return false;
      }
      // Skip if the key somehow conflicts with a registry entry.
      if (row.key in CONTEXT_VARIABLE_MAP) {
        logger.warn("[merged-registry] Custom variable key conflicts with registry entry — skipped.", {
          key: row.key,
        });
        return false;
      }
      return true;
    })
    .map((row): MergedContextVar => {
      const type   = row.custom_type   as ContextVarType;
      const source = row.custom_source as ContextVarSource;
      const ops    = getOperatorsForType(type);

      return {
        key:           row.key,
        label:         row.label         ?? row.key,
        description:   row.description   ?? "",
        type,
        source,
        operators:     ops,
        allowedValues: undefined,
        exampleValue:  undefined,

        // Registry-level flags mirror the usable_ gates for custom variables.
        availableToRules: row.usable_in_rules ?? false,
        availableToAI:    row.usable_in_ai    ?? false,

        usableInRules: row.usable_in_rules ?? false,
        usableInAI:    row.usable_in_ai    ?? false,

        enabled:    row.enabled,
        category:   row.category   ?? null,
        sortOrder:  row.sort_order ?? 0,
        isCustom:   true,
        metadataRow: row,
      };
    });

  return [...builtIns, ...customVars];
}

// ── getVarsForRulesMerged ─────────────────────────────────────────────────────

/**
 * Returns only the variables that should be offered in the rules builder:
 *   enabled = true AND usableInRules = true.
 *
 * Drop-in async replacement for the synchronous getVarsForRules() where
 * runtime DB metadata is needed (e.g. admin rules editor).
 */
export async function getVarsForRulesMerged(): Promise<MergedContextVar[]> {
  const all = await getMergedContextVariables();
  return all.filter((v) => v.enabled && v.usableInRules);
}

// ── getVarsForAIMerged ────────────────────────────────────────────────────────

/**
 * Returns only the variables that should be included in the AI context snapshot:
 *   enabled = true AND usableInAI = true.
 *
 * Drop-in async replacement for the synchronous getVarsForAI() where
 * runtime DB metadata is needed.
 */
export async function getVarsForAIMerged(): Promise<MergedContextVar[]> {
  const all = await getMergedContextVariables();
  return all.filter((v) => v.enabled && v.usableInAI);
}
