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
import { getDb } from "@/data/db";
import { loadTenantFormOverrides } from "@/forms/load-tenant-form-overrides";
import { getAdaptiveBlockByKey } from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { applyFormOverlay } from "./resolve";
import type { FormVariantContent } from "./variant";
import type { FormContextSignals, ResolvedForm } from "./types";

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

  // The legacy per-segment overlays/rules (settings.formContext) are retired:
  // per-visitor form selection now runs through the decision engine — a rule
  // sets plan.formVariants[<type>] and the decide route merges the chosen
  // variant onto this base. So here we return the base form (fields + copy from
  // the definition) plus the presentation extras; the variant is layered on by
  // the caller. `signals` is kept in the signature for that caller contract.
  void signals;
  return { ...applyFormOverlay(base, null, undefined), ...extras };
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

// (Contextual CTA overlays retired — CTA personalisation runs through the
//  cta_* adaptive blocks + rules. See the contextual-forms retirement.)
