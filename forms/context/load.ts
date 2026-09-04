/**
 * Contextual forms — server-side resolution.
 *
 * Builds the ready-to-render form from the base FormDefinition plus per-form
 * presentation extras (Turnstile, layout). Per-visitor variant selection is
 * handled by the decision engine (a rule sets plan.formVariants and the decide
 * route layers the chosen variant on top), so this module no longer reads the
 * retired settings.formContext rules/overlays.
 */

import "server-only";

import { getFormDefinition, resolveFormKey } from "@/forms";
import { getDb } from "@/data/db";
import { loadTenantFormOverrides } from "@/forms/load-tenant-form-overrides";
import { getAdaptiveBlockByKey } from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { fetchCMSFormByName, toPlatformFields } from "@/forms/cms-form";
import { applyFormOverlay, buildCmsResolvedForm } from "./resolve";
import type { FormVariantContent } from "./variant";
import type { FormContextSignals, ResolvedForm } from "./types";

/**
 * Resolve the ready-to-render form for a request.
 *
 * Resolution order mirrors the submit route (POST /api/forms/[formKey]) so
 * render and submit always agree on the same field set:
 *   1. Platform-registered code FormDefinition (takes precedence).
 *   2. CMS-managed form (authored in the CP), loaded via fetchCMSFormByName and
 *      converted to FormField[] with toPlatformFields.
 * Returns null only when neither source has the form — the caller then renders a
 * clean empty. Never throws — falls back to the base definition on any config
 * error.
 */
export async function resolveContextualForm(
  tenantId: string | null | undefined,
  formKey: string,
  signals: FormContextSignals,
): Promise<ResolvedForm | null> {
  // Resolve the handle to a registered FormKey (tolerating Statamic's
  // snake_case / separatorless CP handle vs the code's kebab-case key), exactly
  // as the submit route does — so a code form is recognised here even when it
  // arrives as a raw CP handle, instead of wrongly falling through to the CMS.
  const resolvedKey = resolveFormKey(formKey);
  const formDef = resolvedKey ? getFormDefinition(resolvedKey) : null;

  // Per-form override drives BOTH the Turnstile toggle and the presentation
  // layout. Keyed by formKey, so it applies to code AND CMS forms. Load it once.
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

  // ── 1. Code FormDefinition (precedence) ──────────────────────────────────
  if (formDef) {
    // The legacy per-segment overlays/rules (settings.formContext) are retired:
    // per-visitor form selection now runs through the decision engine — a rule
    // sets plan.formVariants[<type>] and the decide route merges the chosen
    // variant onto this base. So here we return the base form (fields + copy from
    // the definition) plus the presentation extras; the variant is layered on by
    // the caller. `signals` is kept in the signature for that caller contract.
    void signals;
    return { ...applyFormOverlay({ fields: formDef.fields }, null, undefined), ...extras };
  }

  // ── 2. CMS-managed form fallback ─────────────────────────────────────────
  // A form built entirely in the CP: resolve its blueprint and render the same
  // field atoms as code forms. Same loader the submit route uses, so a submit to
  // /api/forms/[formKey] validates against the identical field set.
  void signals;
  const cmsForm = await fetchCMSFormByName(formKey, tenantId);
  if (!cmsForm) return null;
  return {
    ...buildCmsResolvedForm({
      title:          cmsForm.title,
      successMessage: cmsForm.successMessage,
      redirectPath:   cmsForm.successRedirectUrl,
      fields:         toPlatformFields(cmsForm.fields),
    }),
    ...extras,
  };
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
