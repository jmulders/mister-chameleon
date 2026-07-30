/**
 * Per-Form Override Actions
 *
 * Server actions for reading and writing per-form configuration overrides from
 * the `tenant_form_overrides` Supabase table.
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   These actions are called from the per-form config page
 *   (/admin/tenants/[tenantId]/forms/[formKey]).  Authorization is enforced by
 *   the parent layout.tsx (assertTenantAccess) — only authenticated tenant admins
 *   can reach this page.
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   Inputs are scalar fields only (booleans, string arrays, optional strings)
 *   with no injection risk.  Strings are trimmed; arrays are filtered.
 */

"use server";

import { revalidatePath }                     from "next/cache";
import { getDb }                              from "@/data/db";
import { logger }                             from "@/lib/logger";
import type { TenantFormOverrideSettings, FormLayout } from "@/tenant/types";
import { DEFAULT_FORM_OVERRIDE_SETTINGS }     from "@/tenant/types";
import { loadTenantFormOverrides }            from "@/forms/load-tenant-form-overrides";

/** Sanitise a form layout from admin input (phase 1). Returns undefined when unusable. */
function sanitiseLayout(raw: FormLayout | undefined): FormLayout | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const template =
    raw.template === "split-left" || raw.template === "split-right" || raw.template === "single"
      ? raw.template
      : undefined;
  if (!template) return undefined;
  if (template === "single") return { template };

  const clean = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
  const cp = raw.contactPanel ?? {};
  const contactPanel = {
    name:     clean(cp.name, 120),
    role:     clean(cp.role, 120),
    photoUrl: clean(cp.photoUrl, 500),
    phone:    clean(cp.phone, 40),
    email:    clean(cp.email, 200),
  };
  const hasPanel = Object.values(contactPanel).some(Boolean);
  return { template, ...(hasPanel ? { contactPanel } : {}) };
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Read the current form-level override settings for a (tenant, form) pair.
 *
 * Returns DEFAULT_FORM_OVERRIDE_SETTINGS when no override exists yet.
 */
export async function getTenantFormOverrideAction(
  tenantId: string,
  formKey:  string,
): Promise<
  | { ok: true;  settings: TenantFormOverrideSettings }
  | { ok: false; error: string }
> {
  try {
    const settings = await loadTenantFormOverrides(tenantId, formKey);
    return { ok: true, settings };
  } catch (err) {
    const msg = String(err);
    logger.error("[forms] getTenantFormOverrideAction failed", { tenantId, formKey, error: msg });
    return { ok: false, error: msg };
  }
}

// ── Save ───────────────────────────────────────────────────────────────────────

/**
 * Upsert the per-form override settings for a (tenant, form) pair.
 *
 * Uses PostgreSQL's ON CONFLICT … DO UPDATE via Supabase upsert so a single
 * call handles both first-time creation and subsequent updates.
 */
export async function saveTenantFormOverrideAction(
  tenantId:  string,
  formKey:   string,
  overrides: Partial<TenantFormOverrideSettings>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sanitised: TenantFormOverrideSettings = {
      overrideEnabled:
        typeof overrides.overrideEnabled === "boolean"
          ? overrides.overrideEnabled
          : DEFAULT_FORM_OVERRIDE_SETTINGS.overrideEnabled,

      notifyEnabled:
        typeof overrides.notifyEnabled === "boolean"
          ? overrides.notifyEnabled
          : DEFAULT_FORM_OVERRIDE_SETTINGS.notifyEnabled,

      confirmEnabled:
        typeof overrides.confirmEnabled === "boolean"
          ? overrides.confirmEnabled
          : DEFAULT_FORM_OVERRIDE_SETTINGS.confirmEnabled,

      storeEnabled:
        typeof overrides.storeEnabled === "boolean"
          ? overrides.storeEnabled
          : DEFAULT_FORM_OVERRIDE_SETTINGS.storeEnabled,

      turnstileEnabled:
        typeof overrides.turnstileEnabled === "boolean"
          ? overrides.turnstileEnabled
          : DEFAULT_FORM_OVERRIDE_SETTINGS.turnstileEnabled,

      customRecipients:
        Array.isArray(overrides.customRecipients)
          ? overrides.customRecipients
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim())
              .filter((v) => v !== "")
              .slice(0, 20) // safety cap
          : DEFAULT_FORM_OVERRIDE_SETTINGS.customRecipients,

      customSubject:
        typeof overrides.customSubject === "string" && overrides.customSubject.trim()
          ? overrides.customSubject.trim().slice(0, 200)
          : undefined,

      customSenderName:
        typeof overrides.customSenderName === "string" && overrides.customSenderName.trim()
          ? overrides.customSenderName.trim().slice(0, 100)
          : undefined,

      layout: sanitiseLayout(overrides.layout),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_form_overrides")
      .upsert(
        {
          tenant_id:  tenantId,
          form_key:   formKey,
          overrides:  sanitised,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,form_key" },
      )) as { error: { message: string } | null };

    if (result.error) {
      logger.warn("[forms] Failed to save form-level override", {
        tenantId,
        formKey,
        error: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    revalidatePath(`/admin/tenants/${tenantId}/forms/${formKey}`);
    revalidatePath(`/admin/tenants/${tenantId}/forms`);
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    logger.error("[forms] saveTenantFormOverrideAction failed", { tenantId, formKey, error: msg });
    return { ok: false, error: msg };
  }
}

// ── Reset ──────────────────────────────────────────────────────────────────────

/**
 * Delete the per-form override row for a (tenant, form) pair.
 *
 * After reset, the form inherits all settings from the tenant-level defaults.
 * Returns success even when no row existed (idempotent).
 */
export async function resetTenantFormOverrideAction(
  tenantId: string,
  formKey:  string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_form_overrides")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("form_key",  formKey)) as { error: { message: string } | null };

    if (result.error) {
      logger.warn("[forms] Failed to reset form-level override", {
        tenantId,
        formKey,
        error: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    revalidatePath(`/admin/tenants/${tenantId}/forms/${formKey}`);
    revalidatePath(`/admin/tenants/${tenantId}/forms`);
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    logger.error("[forms] resetTenantFormOverrideAction failed", { tenantId, formKey, error: msg });
    return { ok: false, error: msg };
  }
}
