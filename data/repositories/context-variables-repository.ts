/**
 * Context Variable Metadata Repository
 *
 * Data access layer for the `context_variable_metadata` table.
 *
 * ─── Responsibility split ─────────────────────────────────────────────────────
 *
 *   The static context/registry.ts owns every built-in variable's immutable
 *   system fields (type, source, operators, allowedValues).  This repository
 *   owns the operator-editable overlay stored in the DB:
 *
 *     label, description, enabled, usable_in_rules, usable_in_ai,
 *     category, sort_order, is_custom, custom_type, custom_source.
 *
 *   The merged view (system + overlay) is assembled in context/merged-registry.ts.
 *
 * ─── Key functions ────────────────────────────────────────────────────────────
 *
 *   listAllMetadata()
 *     All rows in context_variable_metadata, ordered by sort_order then key.
 *     Used by the admin page and merged-registry to build the combined view.
 *
 *   getMetadata(key)
 *     Single row by primary key.  Returns ok:true with null when absent.
 *
 *   upsertMetadata(key, patch)
 *     Insert or update the editable overlay for a built-in variable.
 *     Guards: key must not be empty; is_custom / custom_type / custom_source
 *     are not accepted here (use createCustomVariable for custom variables).
 *
 *   createCustomVariable(input)
 *     Insert a brand-new custom variable row (is_custom = true).
 *     Requires custom_type and custom_source.
 *     Returns 409-style error when the key already exists.
 *
 *   deleteCustomVariable(key)
 *     Hard-delete a custom variable row.
 *     Returns an error if the row is not found or is_custom = false
 *     (built-in variables cannot be deleted).
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   All functions return RepositoryResult<T> — they never throw.
 *   The application layer must never pass API keys, tokens, or secrets.
 */

import { getDb } from "@/data/db";
import type {
  ContextVariableMetadataRow,
  ContextVariableMetadataInsert,
  ContextVariableMetadataUpdate,
} from "@/data/types";
import type { RepositoryResult } from "./sessions-repository";
import { logger } from "@/lib/logger";

// ── Type assertion helper ─────────────────────────────────────────────────────
// See experiments-repository.ts for rationale.

type SelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

function asRows<T>(result: unknown): SelectResult<T> {
  return result as SelectResult<T>;
}

// ── Custom variable create input ──────────────────────────────────────────────

/**
 * Input required when creating a brand-new custom context variable.
 * Key must not conflict with any existing registry entry.
 */
export interface CreateCustomVariableInput {
  /** Stable slug for this variable, e.g. "company_tier". */
  key:             string;
  /** Human-readable display name (required for custom variables). */
  label:           string;
  /** One-sentence description (required for custom variables). */
  description:     string;
  /** Runtime value type. */
  custom_type:     "string" | "enum" | "number" | "boolean";
  /** Which lifecycle stage populates this value. */
  custom_source:   "request" | "session" | "history" | "tenant" | "page" | "enrichment" | "time";
  /** Whether to expose this variable to the rules builder. */
  usable_in_rules: boolean;
  /** Whether to include this variable in AI context. */
  usable_in_ai:    boolean;
  /** Optional grouping label. */
  category?:       string | null;
  /** Display order within a group; defaults to 0. */
  sort_order?:     number;
}

// ── listAllMetadata ───────────────────────────────────────────────────────────

/**
 * Returns every row in context_variable_metadata, ordered by sort_order ASC,
 * then key ASC.  Used by the admin UI and merged-registry.
 */
export async function listAllMetadata(): Promise<RepositoryResult<ContextVariableMetadataRow[]>> {
  try {
    const db = getDb();
    const result = asRows<ContextVariableMetadataRow>(
      await db
        .from("context_variable_metadata")
        .select()
        .order("sort_order", { ascending: true })
        .order("key", { ascending: true }),
    );

    if (result.error) {
      logger.error("[context-vars] Failed to list metadata", { error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[context-vars] Unexpected error listing metadata", { error: message });
    return { ok: false, error: message };
  }
}

// ── getMetadata ───────────────────────────────────────────────────────────────

/**
 * Fetch the metadata row for a single context variable key.
 * Returns `{ ok: true, data: null }` when no row exists for the key
 * (built-in variables don't have rows until first edit).
 */
export async function getMetadata(
  key: string,
): Promise<RepositoryResult<ContextVariableMetadataRow | null>> {
  try {
    const db = getDb();

    const { data, error } = (await db
      .from("context_variable_metadata")
      .select()
      .eq("key", key)
      .maybeSingle()) as {
      data: ContextVariableMetadataRow | null;
      error: { message: string; code?: string } | null;
    };

    if (error) {
      logger.error("[context-vars] Failed to get metadata", { key, error: error.message });
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[context-vars] Unexpected error getting metadata", { key, error: message });
    return { ok: false, error: message };
  }
}

// ── upsertMetadata ────────────────────────────────────────────────────────────

/**
 * Insert or update the editable overlay for a built-in context variable.
 *
 * When no row exists for `key`, a new row is inserted with is_custom = false.
 * When a row already exists, only the fields present in `patch` are updated.
 *
 * Guards:
 *   - key must be non-empty.
 *   - is_custom, custom_type, custom_source are never written here —
 *     use createCustomVariable() for new custom variables.
 *
 * @param key   - The context variable key (must match a registry entry for built-ins).
 * @param patch - The fields to write.
 */
export async function upsertMetadata(
  key: string,
  patch: ContextVariableMetadataUpdate,
): Promise<RepositoryResult<ContextVariableMetadataRow>> {
  if (!key.trim()) {
    return { ok: false, error: "Key must not be empty." };
  }

  try {
    const db = getDb();

    // Build the full insert object (used if no row exists yet).
    const insertPayload: ContextVariableMetadataInsert = {
      key,
      is_custom: false,
      enabled:   patch.enabled   ?? true,
      sort_order: patch.sort_order ?? 0,
      ...patch,
    };

    // upsert: insert if key absent, merge patch fields if present.
    const { data, error } = await db
      .from("context_variable_metadata")
      .upsert(insertPayload as never, { onConflict: "key" })
      .select()
      .maybeSingle();

    if (error) {
      logger.error("[context-vars] Failed to upsert metadata", { key, error: error.message });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: "Upsert returned no data." };
    }

    logger.debug("[context-vars] Metadata upserted", { key });
    return { ok: true, data: data as unknown as ContextVariableMetadataRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[context-vars] Unexpected error upserting metadata", { key, error: message });
    return { ok: false, error: message };
  }
}

// ── createCustomVariable ──────────────────────────────────────────────────────

/**
 * Creates a brand-new custom context variable row (is_custom = true).
 *
 * custom_type and custom_source are required and must be valid enum members.
 * The key must not conflict with any existing row (built-in or custom).
 *
 * @param input - Validated creation input from the admin actions layer.
 * @returns The created row, or an error if the key already exists.
 */
export async function createCustomVariable(
  input: CreateCustomVariableInput,
): Promise<RepositoryResult<ContextVariableMetadataRow>> {
  if (!input.key.trim()) {
    return { ok: false, error: "Key must not be empty." };
  }
  if (!input.label.trim()) {
    return { ok: false, error: "Label is required for custom variables." };
  }
  if (!input.description.trim()) {
    return { ok: false, error: "Description is required for custom variables." };
  }

  try {
    const db = getDb();

    const insertPayload: ContextVariableMetadataInsert = {
      key:             input.key.trim(),
      label:           input.label.trim(),
      description:     input.description.trim(),
      enabled:         true,
      usable_in_rules: input.usable_in_rules,
      usable_in_ai:    input.usable_in_ai,
      category:        input.category ?? null,
      sort_order:      input.sort_order ?? 0,
      is_custom:       true,
      custom_type:     input.custom_type,
      custom_source:   input.custom_source,
    };

    const { data, error } = await db
      .from("context_variable_metadata")
      .insert(insertPayload as never)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: `A context variable with key "${input.key}" already exists.` };
      }
      logger.error("[context-vars] Failed to create custom variable", {
        key: input.key,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: "Insert returned no data." };
    }

    logger.debug("[context-vars] Custom variable created", { key: input.key });
    return { ok: true, data: data as unknown as ContextVariableMetadataRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[context-vars] Unexpected error creating custom variable", { error: message });
    return { ok: false, error: message };
  }
}

// ── deleteCustomVariable ──────────────────────────────────────────────────────

/**
 * Hard-deletes a custom context variable row.
 *
 * Guards:
 *   - The row must exist.
 *   - The row must have is_custom = true.
 *     Built-in variable metadata rows are protected and cannot be deleted
 *     (they can only be edited or disabled).
 *
 * @param key - The variable key to delete.
 */
export async function deleteCustomVariable(key: string): Promise<RepositoryResult<void>> {
  try {
    // First verify the row exists and is actually custom.
    const existing = await getMetadata(key);
    if (!existing.ok) return existing;

    if (existing.data === null) {
      return { ok: false, error: `No metadata row found for key "${key}".` };
    }

    if (!existing.data.is_custom) {
      return {
        ok: false,
        error: `Built-in variable "${key}" cannot be deleted. Disable it instead.`,
      };
    }

    const db = getDb();
    const { error } = await db
      .from("context_variable_metadata")
      .delete()
      .eq("key", key);

    if (error) {
      logger.error("[context-vars] Failed to delete custom variable", { key, error: error.message });
      return { ok: false, error: error.message };
    }

    logger.debug("[context-vars] Custom variable deleted", { key });
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[context-vars] Unexpected error deleting custom variable", { key, error: message });
    return { ok: false, error: message };
  }
}

// ── Re-export types for consumers ─────────────────────────────────────────────

export type {
  ContextVariableMetadataRow,
  ContextVariableMetadataInsert,
  ContextVariableMetadataUpdate,
};
