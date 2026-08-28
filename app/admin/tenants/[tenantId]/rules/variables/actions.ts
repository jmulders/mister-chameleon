"use server";

/**
 * Server actions for the Copy Variables admin page.
 *
 * Reads and writes TenantSettings.copyVariables: the tenant's managed registry
 * of insertable {tokens} for body copy, each with an optional value map (raw ->
 * display) and a fallback. Follows the read-merge-write pattern used by the
 * custom-attributes page: getTenantById -> patch -> saveTenant.
 *
 * Values themselves stay untrusted (visitor-influenced); this only configures
 * which variables are insertable and how their raw value is displayed.
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type { CopyVariable, CopyVariableMapping } from "@/tenant/types";
import { BUILTIN_SOURCE_KEYS } from "@/lib/blocks/substitute-context-tokens";

const TOKEN_RE = /^[a-z0-9_-]{1,40}$/;
const MAX_VARIABLES = 48;
const MAX_MAP_ROWS = 64;

const BUILTIN_KEY_SET: ReadonlySet<string> = new Set(BUILTIN_SOURCE_KEYS);

/** A value-map row as it arrives from the editor. */
export interface MappingDraft {
  from: string;
  to:   string;
}

/** A variable as it arrives from the editor. */
export interface CopyVariableDraft {
  token:      string;
  label:      string;
  sourceKind: "builtin" | "custom";
  /** The built-in field key or the custom attribute name (per sourceKind). */
  sourceKey:  string;
  valueMap:   MappingDraft[];
  fallback:   string;
}

export interface SaveCopyVariablesResult {
  ok:     boolean;
  error?: string;
}

export async function getCopyVariablesAction(tenantId: string): Promise<CopyVariable[]> {
  const settings = await getTenantById(tenantId);
  return (settings?.copyVariables ?? []).map((v) => ({ ...v }));
}

export async function saveCopyVariablesAction(
  tenantId: string,
  drafts:   CopyVariableDraft[],
): Promise<SaveCopyVariablesResult> {
  if (!tenantId) return { ok: false, error: "tenantId must be a non-empty string." };
  if (drafts.length > MAX_VARIABLES) {
    return { ok: false, error: `At most ${MAX_VARIABLES} variables can be declared.` };
  }

  const stored = await getTenantById(tenantId);
  if (!stored) return { ok: false, error: `Tenant "${tenantId}" not found.` };
  const customNames = new Set((stored.customAttributes ?? []).map((a) => a.name));

  const seen = new Set<string>();
  const variables: CopyVariable[] = [];

  for (const draft of drafts) {
    const token = (draft.token ?? "").trim().toLowerCase();
    if (!TOKEN_RE.test(token)) {
      return { ok: false, error: `Invalid variable token "${draft.token}". Use lowercase letters, digits, "-" or "_", 1 to 40 characters.` };
    }
    if (seen.has(token)) {
      return { ok: false, error: `Duplicate variable token "${token}".` };
    }
    seen.add(token);

    const key = (draft.sourceKey ?? "").trim();
    let source: CopyVariable["source"];
    if (draft.sourceKind === "builtin") {
      if (!BUILTIN_KEY_SET.has(key)) {
        return { ok: false, error: `"${token}" has an unknown built-in source "${key}".` };
      }
      source = { kind: "builtin", key };
    } else if (draft.sourceKind === "custom") {
      if (!customNames.has(key)) {
        return { ok: false, error: `"${token}" references custom attribute "${key}", which is not declared.` };
      }
      source = { kind: "custom", name: key };
    } else {
      return { ok: false, error: `"${token}" has an invalid source kind.` };
    }

    // Value map: trim rows, drop fully-empty rows, keep operator-authored order.
    const rows = (draft.valueMap ?? [])
      .map((m) => ({ from: (m.from ?? "").trim(), to: (m.to ?? "").trim() }))
      .filter((m) => m.from !== "" || m.to !== "");
    if (rows.length > MAX_MAP_ROWS) {
      return { ok: false, error: `"${token}" has too many value-map rows (max ${MAX_MAP_ROWS}).` };
    }
    for (const m of rows) {
      if (m.from === "") {
        return { ok: false, error: `"${token}" has a value-map row with an empty "from".` };
      }
    }
    const valueMap: CopyVariableMapping[] = rows;

    const label    = (draft.label ?? "").trim();
    const fallback = (draft.fallback ?? "").trim();

    variables.push({
      token,
      ...(label ? { label } : {}),
      source,
      ...(valueMap.length > 0 ? { valueMap } : {}),
      ...(fallback ? { fallback } : {}),
    });
  }

  const result = await saveTenant({ ...stored, copyVariables: variables });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/rules/variables`);
  return { ok: true };
}
