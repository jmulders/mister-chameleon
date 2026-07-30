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
import { getDb } from "@/data/db";
import { loadTenantFormOverrides } from "@/forms/load-tenant-form-overrides";
import { getAdaptiveBlockByKey } from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { resolveFormSegment, applyFormOverlay } from "./resolve";
import type { FormVariantContent } from "./variant";
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

  // Per-form override drives BOTH the Turnstile toggle and the presentation
  // layout. Load it once. Resolved independently of the overlay so both return
  // paths carry the extras.
  let turnstileEnabled = false;
  let layout: ResolvedForm["layout"];
  if (tenantId) {
    try {
      const override = await loadTenantFormOverrides(tenantId, formKey);
      turnstileEnabled = override.turnstileEnabled;
      layout = override.layout;
    } catch {
      /* fall back to base form */
    }
  }
  const turnstile = (tenantId && turnstileEnabled)
    ? await loadTurnstileSiteKey(tenantId)
    : undefined;
  const extras = { turnstile, ...(layout ? { layout } : {}) };

  let ctx: TenantFormContext | undefined;
  if (tenantId) {
    try {
      const tenant = await getTenantById(tenantId);
      ctx = (tenant as { formContext?: TenantFormContext } | null)?.formContext;
    } catch {
      /* fall back to base form */
    }
  }

  if (!ctx?.rules?.length) return { ...applyFormOverlay(base, null, undefined), ...extras };

  const segment = resolveFormSegment(ctx.rules, signals);
  const overlay = segment ? ctx.overlays?.[formKey]?.[segment] : undefined;
  return { ...applyFormOverlay(base, segment, overlay), ...extras };
}

/**
 * Load a single form variant's content from the tenant's `form:<type>`
 * adaptive-block row (forms-as-adaptive-blocks, phase 2). Returns null when the
 * block or the variant key is absent. Never throws. The variant payload lives in
 * the block's flexible JSONB, so it is cast to FormVariantContent at this
 * boundary.
 */
export async function loadFormVariant(
  tenantId: string,
  formType: string,
  variantKey: string,
): Promise<FormVariantContent | null> {
  try {
    const block = await getAdaptiveBlockByKey(`form:${formType}`, tenantId);
    const entry = block?.adaptiveVariants?.find((v) => v.variantKey === variantKey);
    return entry ? (entry.content as unknown as FormVariantContent) : null;
  } catch {
    return null;
  }
}

/**
 * Read the tenant's public Turnstile site key. Returns undefined when unset.
 * Never throws. (The per-form turnstileEnabled gate is checked by the caller.)
 */
async function loadTurnstileSiteKey(
  tenantId: string,
): Promise<{ siteKey: string } | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: { settings: Record<string, unknown> } | null };
    const siteKey = res.data?.settings?.turnstileSiteKey;
    return typeof siteKey === "string" && siteKey.trim() !== ""
      ? { siteKey: siteKey.trim() }
      : undefined;
  } catch {
    return undefined;
  }
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
