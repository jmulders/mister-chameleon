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
import type {
  FormContextSignals, ResolvedForm, TenantFormContext,
  TenantBlockContext, CtaOverlay,
} from "./types";

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

/**
 * Resolve the contextual CTA overlay for a block key on this request. Reuses
 * the tenant's form-context rules to pick the segment, then looks up the
 * per-block/per-segment overlay in settings.blockContext. Returns the segment
 * and the overlay (or null when nothing matched). Never throws.
 */
export async function resolveContextualCta(
  tenantId: string | null | undefined,
  contextKey: string,
  signals: FormContextSignals,
): Promise<{ segment: string | null; overlay: CtaOverlay | null }> {
  if (!tenantId || !contextKey) return { segment: null, overlay: null };

  let rulesCtx: TenantFormContext | undefined;
  let blockCtx: TenantBlockContext | undefined;
  try {
    const tenant = await getTenantById(tenantId);
    rulesCtx = (tenant as { formContext?: TenantFormContext } | null)?.formContext;
    blockCtx = (tenant as { blockContext?: TenantBlockContext } | null)?.blockContext;
  } catch {
    return { segment: null, overlay: null };
  }

  if (!rulesCtx?.rules?.length || !blockCtx?.overlays) return { segment: null, overlay: null };

  const segment = resolveFormSegment(rulesCtx.rules, signals);
  const overlay = segment ? blockCtx.overlays?.[contextKey]?.[segment] ?? null : null;
  return { segment, overlay };
}
