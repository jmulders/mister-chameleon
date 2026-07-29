"use server";

/**
 * Contextual forms — admin server actions.
 *
 * Persists the tenant's contextual-forms config (rules + per-form/per-segment
 * overlays) into tenant settings (settings.formContext) via read-then-merge,
 * so other tenant settings are preserved. Auth is enforced by the tenant
 * workspace layout and re-checked here.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/server";
import type {
  TenantFormContext, FormContextRule, FormOverlay,
  TenantBlockContext, CtaOverlay,
} from "@/forms/context/types";
import { safeRelativePath } from "@/forms/context/resolve";
import type { FormField } from "@/forms";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FIELD_TYPES = new Set(["text", "email", "textarea", "tel", "url", "select", "checkbox", "hidden"]);

/** Light runtime validation of a segment field-set (parsed from the editor). */
function validateFields(fields: unknown): { ok: true; fields: FormField[] } | { ok: false; error: string } {
  if (!Array.isArray(fields)) return { ok: false, error: "Fields must be an array." };
  const out: FormField[] = [];
  const keys = new Set<string>();
  for (const raw of fields) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Each field must be an object." };
    const f = raw as Record<string, unknown>;
    if (typeof f.key !== "string" || !f.key.trim()) return { ok: false, error: "Each field needs a non-empty key." };
    if (typeof f.type !== "string" || !FIELD_TYPES.has(f.type)) return { ok: false, error: `Field "${String(f.key)}" has an invalid type.` };
    if (typeof f.label !== "string" || !f.label.trim()) return { ok: false, error: `Field "${String(f.key)}" needs a label.` };
    if (keys.has(f.key)) return { ok: false, error: `Duplicate field key "${f.key}".` };
    if (f.type === "select" && !Array.isArray(f.options)) return { ok: false, error: `Select field "${f.key}" needs options.` };
    keys.add(f.key);
    out.push(raw as FormField);
  }
  return { ok: true, fields: out };
}

function cleanRule(r: unknown): FormContextRule | null {
  if (!r || typeof r !== "object") return null;
  const x = r as Record<string, unknown>;
  const id = typeof x.id === "string" && x.id.trim() ? x.id : null;
  const segment = typeof x.segment === "string" && x.segment.trim() ? x.segment.trim() : null;
  if (!id || !segment) return null;
  const c = (x.conditions ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    id,
    label:    str(x.label) ?? segment,
    segment,
    priority: Number.isFinite(Number(x.priority)) ? Number(x.priority) : 100,
    enabled:  x.enabled !== false,
    conditions: {
      pathStartsWith: str(c.pathStartsWith),
      pathExact:      str(c.pathExact),
      utmSource:      str(c.utmSource),
      utmMedium:      str(c.utmMedium),
      utmCampaign:    str(c.utmCampaign),
      queryKey:       str(c.queryKey),
      queryValue:     str(c.queryValue),
      country:        str(c.country)?.toUpperCase(),
    },
  };
}

/**
 * Save the full contextual-forms config for a tenant. Overlays arrive with
 * `fields` already parsed (or omitted); this validates them before persisting.
 */
export async function saveFormContextAction(
  tenantId: string,
  input: {
    rules: unknown[];
    overlays: Record<string, Record<string, FormOverlay>>;
    blockOverlays?: Record<string, Record<string, CtaOverlay>>;
  },
): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const rules = (input.rules ?? []).map(cleanRule).filter((r): r is FormContextRule => r !== null);

  const overlays: Record<string, Record<string, FormOverlay>> = {};
  for (const [formKey, bySeg] of Object.entries(input.overlays ?? {})) {
    for (const [segment, ov] of Object.entries(bySeg ?? {})) {
      const clean: {
        title?: string; intro?: string; submitLabel?: string;
        successMessage?: string; redirectPath?: string; fields?: readonly FormField[];
      } = {};
      if (typeof ov.title === "string" && ov.title.trim()) clean.title = ov.title.trim();
      if (typeof ov.intro === "string" && ov.intro.trim()) clean.intro = ov.intro.trim();
      if (typeof ov.submitLabel === "string" && ov.submitLabel.trim()) clean.submitLabel = ov.submitLabel.trim();
      if (typeof ov.successMessage === "string" && ov.successMessage.trim()) clean.successMessage = ov.successMessage.trim();
      if (typeof ov.redirectPath === "string") {
        const safe = safeRelativePath(ov.redirectPath);
        if (safe) clean.redirectPath = safe;
      }
      if (ov.fields && Array.isArray(ov.fields) && ov.fields.length > 0) {
        const v = validateFields(ov.fields);
        if (!v.ok) return { ok: false, error: `Form "${formKey}" / segment "${segment}": ${v.error}` };
        clean.fields = v.fields;
      }
      // Only keep non-empty overlays.
      if (Object.keys(clean).length > 0) {
        overlays[formKey] ??= {};
        overlays[formKey][segment] = clean;
      }
    }
  }

  // ── CTA / block overlays ─────────────────────────────────────────────────
  const blockOverlays: Record<string, Record<string, CtaOverlay>> = {};
  for (const [key, bySeg] of Object.entries(input.blockOverlays ?? {})) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    for (const [segment, ov] of Object.entries(bySeg ?? {})) {
      const clean: { title?: string; description?: string; ctaLabel?: string; ctaHref?: string } = {};
      if (typeof ov.title === "string" && ov.title.trim()) clean.title = ov.title.trim();
      if (typeof ov.description === "string" && ov.description.trim()) clean.description = ov.description.trim();
      if (typeof ov.ctaLabel === "string" && ov.ctaLabel.trim()) clean.ctaLabel = ov.ctaLabel.trim();
      if (typeof ov.ctaHref === "string" && ov.ctaHref.trim()) clean.ctaHref = ov.ctaHref.trim();
      if (Object.keys(clean).length > 0) {
        blockOverlays[cleanKey] ??= {};
        blockOverlays[cleanKey][segment] = clean;
      }
    }
  }

  const formContext: TenantFormContext = { rules, overlays };
  const blockContext: TenantBlockContext = { overlays: blockOverlays };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await saveTenant({ ...tenant, formContext, blockContext } as any);
  revalidatePath(`/admin/tenants/${tenantId}/personalization/contextual-forms`);
  return { ok: true };
}
