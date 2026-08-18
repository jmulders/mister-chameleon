"use server";

/**
 * Server actions for the Custom Attributes admin page.
 *
 * Reads and writes TenantSettings.customAttributes: the tenant's declared domain
 * attributes usable in an AttributeCondition (e.g. massa / categorie / occasion).
 * Follows the read-merge-write pattern: getTenantById -> patch -> saveTenant.
 *
 * Attribute values themselves are client-supplied and spoofable; declaring an
 * attribute only makes it referenceable in a rule and lets the server keep it.
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type { CustomAttributeDeclaration } from "@/tenant/types";

const NAME_RE = /^[a-z0-9_-]{1,40}$/;
const MAX_DECLARATIONS = 32;

/** A declaration as it arrives from the editor: allowedValues are raw strings. */
export interface AttributeDraft {
  name:          string;
  type:          "string" | "number" | "boolean";
  label?:        string;
  description?:  string;
  allowedValues: string[];
}

export interface SaveAttributesResult {
  ok:     boolean;
  error?: string;
}

export async function getCustomAttributesAction(
  tenantId: string,
): Promise<CustomAttributeDeclaration[]> {
  const settings = await getTenantById(tenantId);
  return (settings?.customAttributes ?? []).map((d) => ({ ...d }));
}

export async function saveCustomAttributesAction(
  tenantId: string,
  drafts:   AttributeDraft[],
): Promise<SaveAttributesResult> {
  if (!tenantId) return { ok: false, error: "tenantId must be a non-empty string." };
  if (drafts.length > MAX_DECLARATIONS) {
    return { ok: false, error: `At most ${MAX_DECLARATIONS} attributes can be declared.` };
  }

  const seen = new Set<string>();
  const declarations: CustomAttributeDeclaration[] = [];

  for (const draft of drafts) {
    const name = (draft.name ?? "").trim().toLowerCase();
    if (!NAME_RE.test(name)) {
      return { ok: false, error: `Invalid attribute name "${draft.name}". Use lowercase letters, digits, "-" or "_", 1 to 40 characters.` };
    }
    if (seen.has(name)) {
      return { ok: false, error: `Duplicate attribute name "${name}".` };
    }
    seen.add(name);

    if (draft.type !== "string" && draft.type !== "number" && draft.type !== "boolean") {
      return { ok: false, error: `Invalid type for "${name}". Must be string, number, or boolean.` };
    }

    const label       = (draft.label ?? "").trim();
    const description  = (draft.description ?? "").trim();

    // allowedValues only apply to string / number. Coerce numbers; drop empties.
    let allowedValues: readonly (string | number)[] | undefined;
    if (draft.type !== "boolean") {
      const raw = (draft.allowedValues ?? []).map((v) => v.trim()).filter((v) => v !== "");
      if (raw.length > 0) {
        if (draft.type === "number") {
          const nums: number[] = [];
          for (const v of raw) {
            const n = Number(v);
            if (!Number.isFinite(n)) {
              return { ok: false, error: `Allowed value "${v}" for "${name}" is not a number.` };
            }
            nums.push(n);
          }
          allowedValues = nums;
        } else {
          allowedValues = raw;
        }
      }
    }

    declarations.push({
      name,
      type: draft.type,
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(allowedValues ? { allowedValues } : {}),
    });
  }

  const stored = await getTenantById(tenantId);
  if (!stored) return { ok: false, error: `Tenant "${tenantId}" not found.` };

  const result = await saveTenant({ ...stored, customAttributes: declarations });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/personalization/attributes`);
  revalidatePath(`/admin/tenants/${tenantId}/personalization/rules`);
  return { ok: true };
}
