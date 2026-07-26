/**
 * Contextual forms — server-side resolution.
 *
 * Combines the tenant's stored rules/overlays (settings.formContext) with the
 * base FormDefinition and the request signals to produce the ready-to-render
 * form. Used by both the render endpoint and the submit handler so they always
 * agree on the same segment (and therefore the same field set).
 */

import "server-only";

import { getFormDefinition, isFormKey } from "@/forms";
import { getTenantById } from "@/tenant/server";
import { resolveFormSegment, applyFormOverlay } from "./resolve";
import type { FormContextSignals, ResolvedForm, TenantFormContext } from "./types";

/**
 * Resolve the contextual form for a request. Returns null when the form key is
 * not a platform-registered form (CMS-managed forms keep their own copy).
 * Never throws — falls back to the base definition on any config error.
 */
export async function resolveContextualForm(
  tenantId: string | null | undefined,
  formKey: string,
  signals: FormContextSignals,
): Promise<ResolvedForm | null> {
  const formDef = isFormKey(formKey) ? getFormDefinition(formKey) : null;
  if (!formDef) return null;

  const base = { fields: formDef.fields };

  let ctx: TenantFormContext | undefined;
  if (tenantId) {
    try {
      const tenant = await getTenantById(tenantId);
      ctx = (tenant as { formContext?: TenantFormContext } | null)?.formContext;
    } catch {
      /* fall back to base form */
    }
  }

  if (!ctx?.rules?.length) return applyFormOverlay(base, null, undefined);

  const segment = resolveFormSegment(ctx.rules, signals);
  const overlay = segment ? ctx.overlays?.[formKey]?.[segment] : undefined;
  return applyFormOverlay(base, segment, overlay);
}
