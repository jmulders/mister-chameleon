/**
 * Admin: Design Effect Set server actions
 *
 * CRUD for the declarative-effect library (design_effect_sets) plus the
 * tenant-wide default effects (design.defaultEffects). Each action is
 * admin-guarded. All incoming effect configs pass sanitizeEffectConfigs, which
 * validates them against the effect registry and drops anything unknown — the
 * storage boundary that enforces "declarative only, no raw JS".
 */

"use server";

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { sanitizeEffectConfigs } from "@/design-system/effects/effect-ref";
import { upsertDesignEffectSet, deleteDesignEffectSet } from "@/lib/design-effect-sets/effect-sets-store";
import { getTenantById, saveTenant } from "@/tenant/server";

function designPath(tenantId: string): string {
  return `/admin/tenants/${tenantId}/design`;
}

/** Create or update a tenant-scoped effect set. Effects are validated/sanitised. */
export async function saveEffectSetAction(
  tenantId: string,
  input: { id?: string; name: string; effects: unknown; slots?: string[] | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "A name is required." };
  const effects = sanitizeEffectConfigs(input.effects);
  if (effects.length === 0) return { ok: false, error: "Add at least one known effect." };

  const res = await upsertDesignEffectSet({
    id:       input.id,
    tenantId,
    name,
    effects,
    slots:    input.slots && input.slots.length > 0 ? input.slots : null,
  });
  if (res.ok) revalidatePath(designPath(tenantId));
  return res;
}

/** Delete an effect set by id. */
export async function deleteEffectSetAction(
  tenantId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const res = await deleteDesignEffectSet(id);
  if (res.ok) revalidatePath(designPath(tenantId));
  return res;
}

/**
 * Set (or clear) the tenant-wide default effects on design.defaultEffects.
 * Pass an empty array to clear.
 */
export async function setDefaultEffectsAction(
  tenantId: string,
  effects: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const sanitized = sanitizeEffectConfigs(effects);
  const next = {
    ...tenant,
    design: {
      ...tenant.design,
      defaultEffects: sanitized.length > 0 ? sanitized : undefined,
    },
  };

  const res = await saveTenant(next);
  if (!res.ok) return { ok: false, error: res.error ?? "Save failed." };
  revalidatePath(designPath(tenantId));
  return { ok: true };
}
