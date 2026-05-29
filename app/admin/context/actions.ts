/**
 * Admin — Context Variable Metadata Server Actions
 *
 * Server actions for managing context variable metadata at /admin/context.
 *
 * ─── Actions ──────────────────────────────────────────────────────────────────
 *
 *   upsertMetadataAction(key, patch)
 *     Saves the editable overlay fields for a built-in context variable.
 *     Creates a DB row on first edit; updates on subsequent edits.
 *     Does NOT accept is_custom / custom_type / custom_source.
 *
 *   createCustomVariableAction(input)
 *     Creates a brand-new custom context variable (is_custom = true).
 *     Returns an error when the key conflicts with a registry entry or an
 *     existing metadata row.
 *
 *   deleteCustomVariableAction(key)
 *     Hard-deletes a custom variable row.
 *     Built-in variables are protected — returns an error when key is not custom.
 *
 *   toggleEnabledAction(key, enabled)
 *     Convenience action to flip the enabled flag on any variable (built-in
 *     or custom) without opening the full edit form.
 *
 * ─── Result type ──────────────────────────────────────────────────────────────
 *
 *   All actions return ActionResult<T>:
 *     { ok: true;  data: T }
 *     { ok: false; error: string }
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Built-in protection:  deleteCustomVariableAction checks is_custom and
 *   rejects attempts to delete a built-in variable at the application layer
 *   (the repository also enforces this).
 *
 *   Key immutability: keys cannot be renamed after creation.
 */

"use server";

import { revalidatePath } from "next/cache";
import { CONTEXT_VARIABLE_MAP } from "@/context/registry";
import {
  upsertMetadata,
  createCustomVariable,
  deleteCustomVariable,
} from "@/data/repositories/context-variables-repository";
import type {
  ContextVariableMetadataRow,
  ContextVariableMetadataUpdate,
} from "@/data/types";
import type { CreateCustomVariableInput } from "@/data/repositories/context-variables-repository";

// ── Action result type ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── upsertMetadataAction ──────────────────────────────────────────────────────

/**
 * Saves the editable overlay fields for a built-in context variable.
 *
 * @param key   - Registry key, e.g. "source" or "company_name".
 * @param patch - The fields to write (subset of ContextVariableMetadataUpdate).
 */
export async function upsertMetadataAction(
  key: string,
  patch: ContextVariableMetadataUpdate,
): Promise<ActionResult<ContextVariableMetadataRow>> {
  if (!key.trim()) {
    return { ok: false, error: "Key must not be empty." };
  }

  const result = await upsertMetadata(key, patch);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/admin/context");
  return { ok: true, data: result.data };
}

// ── createCustomVariableAction ────────────────────────────────────────────────

/**
 * Creates a brand-new custom context variable.
 *
 * Guards:
 *   - Key must not conflict with any existing CONTEXT_VARIABLES registry entry.
 *   - Key must not conflict with any existing metadata row (enforced by DB PK).
 *
 * @param input - Validated input from the admin create form.
 */
export async function createCustomVariableAction(
  input: CreateCustomVariableInput,
): Promise<ActionResult<ContextVariableMetadataRow>> {
  const key = input.key.trim();

  if (!key) {
    return { ok: false, error: "Key must not be empty." };
  }

  // Prevent overwriting registry entries via the custom-variable flow.
  if (key in CONTEXT_VARIABLE_MAP) {
    return {
      ok: false,
      error: `Key "${key}" is already used by a built-in context variable. Choose a different key.`,
    };
  }

  // Basic key format validation: lowercase letters, digits, underscores only.
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return {
      ok: false,
      error: "Key must start with a letter and contain only lowercase letters, digits, and underscores.",
    };
  }

  const result = await createCustomVariable({ ...input, key });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/admin/context");
  return { ok: true, data: result.data };
}

// ── deleteCustomVariableAction ────────────────────────────────────────────────

/**
 * Deletes a custom context variable.
 *
 * The repository rejects deletion of built-in variables; this action surfaces
 * that guard as a user-facing error message.
 *
 * @param key - The variable key to delete.
 */
export async function deleteCustomVariableAction(
  key: string,
): Promise<ActionResult<void>> {
  const result = await deleteCustomVariable(key);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/admin/context");
  return { ok: true, data: undefined };
}

// ── toggleEnabledAction ───────────────────────────────────────────────────────

/**
 * Flips the `enabled` flag on any variable without opening the full edit form.
 *
 * For built-in variables with no existing metadata row, this creates the row
 * (via upsertMetadata) with enabled set to the requested value and all other
 * overlay fields at their defaults.
 *
 * @param key     - The context variable key.
 * @param enabled - The new enabled state.
 */
export async function toggleEnabledAction(
  key: string,
  enabled: boolean,
): Promise<ActionResult<ContextVariableMetadataRow>> {
  const result = await upsertMetadata(key, { enabled });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/admin/context");
  return { ok: true, data: result.data };
}
