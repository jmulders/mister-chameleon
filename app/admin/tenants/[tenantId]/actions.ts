/**
 * Admin — Tenant Settings Server Actions
 *
 * Thin server-side wrapper around tenant-store functions.
 * Imported by the TenantSettingsForm client component so that it can
 * call server-only store functions without shipping them to the browser.
 */

"use server";

import { cookies }        from "next/headers";
import { revalidatePath } from "next/cache";
import { saveTenant, getTenantById } from "@/tenant/server";
import { DEV_TENANT_COOKIE, DEV_TENANT_COOKIE_MAX_AGE } from "@/tenant/dev-tenant-cookie";
import { validateDesignTokenUpload } from "@/tenant/design-token-validator";
import { provisionTenant }           from "@/cms/seed/tenant-provisioner";
import type { TenantSettings, StoreResult, TenantAiSettings, TenantDesignSettings, TenantCmsSettings } from "@/tenant/server";
import type { DesignTokenUploadInput }  from "@/tenant/design-token-validator";
import type { TenantTokenOverrides, ThemeKey } from "@/tenant/types";
import type { ProvisionResult }        from "@/cms/seed/tenant-provisioner";

// ── API key preservation ───────────────────────────────────────────────────────
//
// The admin form never sends stored API keys back to the server — the page
// strips them before serialising TenantSettings into the client payload.
// This means a save submitted without a new apiKey value would overwrite the
// stored secret with undefined.
//
// mergeStoredApiKeys() re-reads the current stored record and copies any
// existing apiKey values back into provider slots that arrived without one.

function mergeStoredApiKeys(
  incoming: TenantAiSettings,
  stored:   TenantAiSettings,
): TenantAiSettings {
  const mergeSlot = <T extends { apiKey?: string }>(
    inc: T | undefined,
    sto: T | undefined,
  ): T | undefined => {
    if (!inc) return inc;
    // Preserve the stored key when the form sent no new value.
    if (!inc.apiKey && sto?.apiKey) {
      return { ...inc, apiKey: sto.apiKey };
    }
    return inc;
  };

  return {
    ...incoming,
    liveProvider:   mergeSlot(incoming.liveProvider,   stored.liveProvider),
    shadowProvider: mergeSlot(incoming.shadowProvider, stored.shadowProvider),
  };
}

// ── CMS write token preservation ─────────────────────────────────────────────
//
// The admin form never sends back the stored CMS write token — the page
// strips it before serialising TenantSettings into the client payload.
// Without this merge, saving via the form would overwrite the stored token
// with undefined.  mergeCmsWriteToken() re-reads the stored record and copies
// any existing writeToken back when the incoming payload doesn't include one.

function mergeCmsWriteToken(
  incoming: TenantCmsSettings,
  stored:   TenantCmsSettings,
): TenantCmsSettings {
  if (!incoming.writeToken && stored.writeToken) {
    return { ...incoming, writeToken: stored.writeToken };
  }
  return incoming;
}

// ── Token override preservation ───────────────────────────────────────────────
//
// The main settings form does not expose design.tokenOverrides — it only
// handles theme, primaryColor, and primaryFont.  Without this merge, saving
// via the form would silently wipe any token overrides set via the design
// token upload.  We restore them from the stored record when the form
// submission doesn't include its own tokenOverrides.

function mergeStoredTokenOverrides(
  incoming: TenantDesignSettings,
  stored:   TenantDesignSettings,
): TenantDesignSettings {
  // If the incoming payload already carries tokenOverrides (e.g. from a
  // programmatic save), keep them as-is.
  if (incoming.tokenOverrides !== undefined) return incoming;

  // If the stored record has tokenOverrides, carry them forward.
  if (stored.tokenOverrides && Object.keys(stored.tokenOverrides).length > 0) {
    return { ...incoming, tokenOverrides: stored.tokenOverrides };
  }

  return incoming;
}

/**
 * Upserts a tenant's settings, then invalidates the admin cache.
 *
 * Before writing, re-reads the stored record to merge back values that the
 * browser never received (and therefore couldn't echo back):
 *
 *   1. AI API keys            — stripped before sending to client; restored here.
 *   2. design.tokenOverrides  — set via token upload, not in the main form.
 *   3. cmsProvisionedAt       — managed by provisionSiteAction, not the form.
 *
 * Validates the shape server-side (via saveTenant → validateTenantSettings)
 * before writing.  On success, revalidates both the tenant list and the
 * detail page so that navigating away and back serves fresh data.
 * Returns StoreResult so the client can branch on `ok` without a try/catch.
 */
export async function saveTenantAction(
  incoming: TenantSettings,
): Promise<StoreResult<TenantSettings>> {
  // Re-read the stored record so we can merge back values the browser
  // never received (and therefore couldn't echo back in the form payload).
  const stored = await getTenantById(incoming.tenantId);

  const tenant: TenantSettings = stored
    ? {
        ...incoming,
        ai:     mergeStoredApiKeys(incoming.ai, stored.ai),
        cms:    mergeCmsWriteToken(incoming.cms, stored.cms),
        design: mergeStoredTokenOverrides(incoming.design, stored.design),
        // Preserve the CMS provisioning timestamp — it is managed exclusively
        // by provisionSiteAction and must survive form saves that don't know
        // about it.  The incoming form payload will never include it, so we
        // fall back to the stored value.
        cmsProvisionedAt: incoming.cmsProvisionedAt ?? stored.cmsProvisionedAt,
      }
    : incoming;

  const result = await saveTenant(tenant);

  if (result.ok) {
    // Purge the Next.js full-route cache for these paths so that any
    // subsequent navigation (or server-component refresh) fetches fresh data.
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${tenant.tenantId}`);
  }

  return result;
}

// ── Dev tenant cookie actions ──────────────────────────────────────────────────
//
// These actions are guarded by NODE_ENV — they are no-ops in production.
// Both actions revalidate the admin tenant detail page so the Dev Controls
// section immediately reflects the new override state after the form submits.

/**
 * Sets the mc_dev_tenant cookie to the given tenantId, making it the active
 * development tenant override for all routes until cleared or expired.
 *
 * Only works in development — silently no-ops in production.
 */
export async function setDevTenantAction(tenantId: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const c = await cookies();
  c.set(DEV_TENANT_COOKIE, tenantId, {
    path:     "/",
    maxAge:   DEV_TENANT_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
}

/**
 * Clears the mc_dev_tenant cookie, restoring Host-header tenant resolution
 * across all routes.
 *
 * Only works in development — silently no-ops in production.
 */
export async function clearDevTenantAction(tenantId: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const c = await cookies();
  c.delete(DEV_TENANT_COOKIE);

  revalidatePath(`/admin/tenants/${tenantId}`);
}

// ── Design token upload action ─────────────────────────────────────────────────

/**
 * Result type for applyDesignTokensAction.
 *
 *   ok: true  — tokens were validated and persisted; `appliedKeys` lists what
 *               changed (group names for grouped format, key names for legacy);
 *               `format` identifies which token format was used.
 *   ok: false — validation or save failed; `errors` explains why.
 */
export type ApplyTokensResult =
  | { ok: true;  appliedKeys: string[]; warnings: string[]; format: "legacy" | "grouped" }
  | { ok: false; errors: string[] };

/**
 * Validates a design token payload, merges it into the tenant's design
 * settings, and persists the result.
 *
 * Validation runs server-side regardless of any client-side pre-check, so
 * the stored data is always in a known-good state.
 *
 * @param tenantId  The tenant to update.
 * @param rawTokens The uploaded token payload (as-is from the client; untrusted).
 */
export async function applyDesignTokensAction(
  tenantId: string,
  rawTokens: unknown,
): Promise<ApplyTokensResult> {
  // ── Server-side validation (authoritative) ─────────────────────────────────
  const validation = validateDesignTokenUpload(rawTokens);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const { tokens, appliedKeys, warnings, format } = validation;

  // ── Load current tenant settings ───────────────────────────────────────────
  const current = await getTenantById(tenantId);
  if (!current) {
    return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };
  }

  // ── Build updated design settings ──────────────────────────────────────────
  // Merge all token fields into tokenOverrides, preserving any existing
  // overrides for tokens not included in this upload.
  //
  // Legacy flat fields (primaryColor, primaryFont, radius*) are merged
  // individually.  Grouped token objects are shallow-merged within each group
  // so that a new upload only overwrites the specific keys it supplies.
  const {
    theme,
    primaryColor,
    primaryFont,
    radiusInteractive,
    radiusCard,
    radiusPopover,
    color,
    typography,
    radius,
    spacing,
    border,
    shadow,
    motion,
    component,
  } = tokens;

  const existingOverrides: TenantTokenOverrides = current.design.tokenOverrides ?? {};

  const newTokenOverrides: TenantTokenOverrides = {
    ...existingOverrides,
    // Legacy flat radius fields
    ...(radiusInteractive !== undefined ? { radiusInteractive } : {}),
    ...(radiusCard        !== undefined ? { radiusCard }        : {}),
    ...(radiusPopover     !== undefined ? { radiusPopover }     : {}),
    // Grouped token objects — shallow-merge so existing group keys survive
    ...(color      ? { color:      { ...existingOverrides.color,      ...color      } } : {}),
    ...(typography ? { typography: { ...existingOverrides.typography, ...typography } } : {}),
    ...(radius     ? { radius:     { ...existingOverrides.radius,     ...radius     } } : {}),
    ...(spacing    ? { spacing:    { ...existingOverrides.spacing,    ...spacing    } } : {}),
    ...(border     ? { border:     { ...existingOverrides.border,     ...border     } } : {}),
    ...(shadow     ? { shadow:     { ...existingOverrides.shadow,     ...shadow     } } : {}),
    ...(motion     ? { motion:     { ...existingOverrides.motion,     ...motion     } } : {}),
    ...(component  ? { component:  { ...existingOverrides.component,  ...component  } } : {}),
  };
  const hasAnyOverride = Object.keys(newTokenOverrides).length > 0;

  const updatedDesign: TenantDesignSettings = {
    ...current.design,
    ...(theme        !== undefined ? { theme }        : {}),
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(primaryFont  !== undefined ? { primaryFont }  : {}),
    ...(hasAnyOverride ? { tokenOverrides: newTokenOverrides } : {}),
  };

  // ── Persist ────────────────────────────────────────────────────────────────
  const updated: TenantSettings = { ...current, design: updatedDesign };
  const saveResult = await saveTenant(updated);

  if (!saveResult.ok) {
    return { ok: false, errors: [saveResult.error] };
  }

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);

  return {
    ok:          true,
    appliedKeys,
    warnings:    [...warnings, ...(saveResult.warnings ?? [])],
    format,
  };
}

// ── CMS credentials action ────────────────────────────────────────────────────

/**
 * Saves CMS credentials (write token) for a tenant.
 *
 * The write token is stored server-side only — it is never returned to the
 * client after save.  The UI receives only a boolean "hasCmsWriteToken" flag
 * that indicates whether a token is configured.
 *
 * An empty string clears the stored token (so passing "" removes any existing
 * token, treating it as "not configured").
 *
 * @param tenantId   The tenant to update.
 * @param writeToken The Sanity write token to store, or "" to clear.
 */
export async function saveCmsCredentialsAction(
  tenantId:   string,
  writeToken: string,
): Promise<StoreResult<{ hasCmsWriteToken: boolean }>> {
  const current = await getTenantById(tenantId);
  if (!current) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  const trimmed = writeToken.trim();

  const updated: TenantSettings = {
    ...current,
    cms: {
      ...current.cms,
      // Empty string → omit the field (treated as "not configured").
      ...(trimmed ? { writeToken: trimmed } : { writeToken: undefined }),
    },
  };

  const result = await saveTenant(updated);

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return {
    ok:   true,
    data: { hasCmsWriteToken: !!trimmed },
  };
}

// ── CMS provisioning action ────────────────────────────────────────────────────

/**
 * Result type for provisionSiteAction.
 *
 *   ok: true  — provisioning succeeded; `documentIds` lists what was written;
 *               `warnings` carries non-fatal notes.
 *   ok: false — provisioning failed; `error` explains why.
 *               `partial` lists any document IDs written before the failure.
 */
export type ProvisionSiteResult =
  | { ok: true;  documentIds: string[]; warnings: string[] }
  | { ok: false; error: string; partial?: string[] };

/**
 * Provisions starter CMS content for a tenant and records the provisioning
 * timestamp in the tenant store.
 *
 * Calls `provisionTenant()` to write homepage, hero/proof/cta variants and
 * package-gated page sections to Sanity using `createOrReplace`.  On success,
 * updates `TenantSettings.cmsProvisionedAt` so the admin page and readiness
 * checks reflect the current state without querying Sanity.
 *
 * The action is idempotent — re-running replaces existing documents.
 * Operators are warned in the UI that existing content will be overwritten.
 *
 * @param tenantId  The tenant to provision.
 */
export async function provisionSiteAction(
  tenantId: string,
): Promise<ProvisionSiteResult> {
  // ── Load tenant ───────────────────────────────────────────────────────────
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── Run the provisioner ───────────────────────────────────────────────────
  const result: ProvisionResult = await provisionTenant(tenant);

  if (!result.ok) {
    return result;
  }

  // ── Record the provisioning timestamp in the tenant store ─────────────────
  // This lets the admin page and SiteBuilderReadiness reflect the provisioned
  // state without querying Sanity on every page load.
  const updatedTenant: TenantSettings = {
    ...tenant,
    cmsProvisionedAt: new Date().toISOString(),
  };

  const saveResult = await saveTenant(updatedTenant);
  const storeWarnings: string[] = saveResult.ok
    ? (saveResult.warnings ?? [])
    : [`Note: provisioning succeeded but could not update store timestamp: ${saveResult.error}`];

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return {
    ok:          true,
    documentIds: result.documentIds,
    warnings:    [...result.warnings, ...storeWarnings],
  };
}

// ── Visual token editor action ─────────────────────────────────────────────────

/**
 * Fields the visual token editor can set or clear.
 *
 * ─── Semantics ────────────────────────────────────────────────────────────────
 *
 *   non-empty string — set this override (validated, then written to
 *                      TenantDesignSettings.tokenOverrides)
 *   ""               — clear this override (removes the key from the group,
 *                      resetting it to the active theme preset)
 *   undefined        — leave this override unchanged
 *
 * All fields map into the grouped TenantTokenOverrides model:
 *
 *   theme             → TenantDesignSettings.theme
 *   colorPrimary      → tokenOverrides.color.primary
 *   colorSecondary    → tokenOverrides.color.secondary
 *   colorBackground   → tokenOverrides.color.background
 *   colorForeground   → tokenOverrides.color.foreground
 *   fontSans          → tokenOverrides.typography.fontSans
 *   baseFontSize      → tokenOverrides.typography.baseFontSize
 *   buttonRadius      → tokenOverrides.component.buttonRadius
 *   cardRadius        → tokenOverrides.component.cardRadius
 *   cardPadding       → tokenOverrides.component.cardPadding
 *   spacingMd         → tokenOverrides.spacing.md
 *   spacingLg         → tokenOverrides.spacing.lg
 *   spacingXl         → tokenOverrides.spacing.xl
 *
 * Both the visual editor and the JSON upload flow write into the same
 * tokenOverrides model — they are fully compatible and additive.
 */
export interface VisualTokenFields {
  theme?:           ThemeKey;
  // color group
  colorPrimary?:    string;
  colorSecondary?:  string;
  colorBackground?: string;
  colorForeground?: string;
  // typography group
  fontSans?:        string;
  baseFontSize?:    string;
  // component group
  buttonRadius?:    string;
  cardRadius?:      string;
  cardPadding?:     string;
  // spacing group
  spacingMd?:       string;
  spacingLg?:       string;
  spacingXl?:       string;
}

export type SaveVisualTokensResult =
  | { ok: true;  warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Saves visual token editor fields for a tenant.
 *
 * Non-empty values are validated using the same validator as the JSON upload
 * path (validateDesignTokenUpload), ensuring both flows share identical
 * validation rules.  Empty strings remove the corresponding key from its
 * override group (resetting to the active theme preset).  Undefined fields
 * are left unchanged.
 *
 * ─── Merge semantics ──────────────────────────────────────────────────────────
 *
 *   Only the groups whose managed keys are touched (set or cleared) are
 *   rewritten.  All other tokenOverrides — including groups managed only by
 *   the JSON upload (border, shadow, motion, radius) — are preserved intact.
 *
 * @param tenantId  The tenant to update.
 * @param fields    Visual token fields — see VisualTokenFields for semantics.
 */
export async function saveVisualTokensAction(
  tenantId: string,
  fields:   VisualTokenFields,
): Promise<SaveVisualTokensResult> {
  // ── Load current settings ─────────────────────────────────────────────────
  const current = await getTenantById(tenantId);
  if (!current) {
    return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };
  }

  // ── Separate fields into "set" vs "clear" per group ───────────────────────
  //
  // Non-empty string → put the value into `*Set` (validated, then written).
  // Empty string     → put the key into `*Clear` (removed from the group).
  // Undefined        → absent from both maps (left unchanged in store).

  const colorSet:   Record<string, string> = {};
  const colorClear: string[]               = [];
  if (fields.colorPrimary    !== undefined) { if (fields.colorPrimary.trim())    colorSet.primary    = fields.colorPrimary.trim();    else colorClear.push("primary");    }
  if (fields.colorSecondary  !== undefined) { if (fields.colorSecondary.trim())  colorSet.secondary  = fields.colorSecondary.trim();  else colorClear.push("secondary");  }
  if (fields.colorBackground !== undefined) { if (fields.colorBackground.trim()) colorSet.background = fields.colorBackground.trim(); else colorClear.push("background"); }
  if (fields.colorForeground !== undefined) { if (fields.colorForeground.trim()) colorSet.foreground = fields.colorForeground.trim(); else colorClear.push("foreground"); }

  const typoSet:   Record<string, string> = {};
  const typoClear: string[]               = [];
  if (fields.fontSans     !== undefined) { if (fields.fontSans.trim())     typoSet.fontSans     = fields.fontSans.trim();     else typoClear.push("fontSans");     }
  if (fields.baseFontSize !== undefined) { if (fields.baseFontSize.trim()) typoSet.baseFontSize = fields.baseFontSize.trim(); else typoClear.push("baseFontSize"); }

  const componentSet:   Record<string, string> = {};
  const componentClear: string[]               = [];
  if (fields.buttonRadius !== undefined) { if (fields.buttonRadius.trim()) componentSet.buttonRadius = fields.buttonRadius.trim(); else componentClear.push("buttonRadius"); }
  if (fields.cardRadius   !== undefined) { if (fields.cardRadius.trim())   componentSet.cardRadius   = fields.cardRadius.trim();   else componentClear.push("cardRadius");   }
  if (fields.cardPadding  !== undefined) { if (fields.cardPadding.trim())  componentSet.cardPadding  = fields.cardPadding.trim();  else componentClear.push("cardPadding");  }

  const spacingSet:   Record<string, string> = {};
  const spacingClear: string[]               = [];
  if (fields.spacingMd !== undefined) { if (fields.spacingMd.trim()) spacingSet.md = fields.spacingMd.trim(); else spacingClear.push("md"); }
  if (fields.spacingLg !== undefined) { if (fields.spacingLg.trim()) spacingSet.lg = fields.spacingLg.trim(); else spacingClear.push("lg"); }
  if (fields.spacingXl !== undefined) { if (fields.spacingXl.trim()) spacingSet.xl = fields.spacingXl.trim(); else spacingClear.push("xl"); }

  // ── Validate non-empty "set" values ───────────────────────────────────────
  //
  // Reuse the JSON-upload validator so both flows share identical rules.
  // Clears are unconditionally safe and do not need validation.

  const warnings: string[] = [];

  const hasSetFields =
    Object.keys(colorSet).length     > 0 ||
    Object.keys(typoSet).length      > 0 ||
    Object.keys(componentSet).length > 0 ||
    Object.keys(spacingSet).length   > 0 ||
    (fields.theme !== undefined);

  if (hasSetFields) {
    // Construct a grouped-format DesignTokenUploadInput containing only the
    // non-empty values so the existing validator can check them.
    const payload: DesignTokenUploadInput = {
      ...(fields.theme                               ? { theme:      fields.theme }   : {}),
      ...(Object.keys(colorSet).length     > 0       ? { color:      colorSet }       : {}),
      ...(Object.keys(typoSet).length      > 0       ? { typography: typoSet }        : {}),
      ...(Object.keys(componentSet).length > 0       ? { component:  componentSet }   : {}),
      ...(Object.keys(spacingSet).length   > 0       ? { spacing:    spacingSet }     : {}),
    };
    const validation = validateDesignTokenUpload(payload);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }
    warnings.push(...validation.warnings);
  }

  // ── Merge into existing overrides ─────────────────────────────────────────
  //
  // Apply targeted changes to each touched group; leave all other groups and
  // keys intact.  When a group becomes completely empty after clearing, remove
  // it entirely (returning all its tokens to the active preset defaults).

  function mergeGroup(
    existing:  Readonly<Record<string, string>> | undefined,
    setValues: Record<string, string>,
    clearKeys: string[],
  ): Record<string, string> | undefined {
    const merged = { ...(existing ?? {}) };
    for (const [k, v] of Object.entries(setValues)) merged[k] = v;
    for (const k of clearKeys)                       delete merged[k];
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  const existingOverrides: TenantTokenOverrides = current.design.tokenOverrides ?? {};

  const colorTouched     = Object.keys(colorSet).length     > 0 || colorClear.length     > 0;
  const typoTouched      = Object.keys(typoSet).length      > 0 || typoClear.length      > 0;
  const componentTouched = Object.keys(componentSet).length > 0 || componentClear.length > 0;
  const spacingTouched   = Object.keys(spacingSet).length   > 0 || spacingClear.length   > 0;

  // Work on a mutable copy so we can delete group keys when they become empty.
  const updatedOverrides: Record<string, unknown> = { ...existingOverrides };

  if (colorTouched) {
    const merged = mergeGroup(existingOverrides.color, colorSet, colorClear);
    if (merged) updatedOverrides.color = merged; else delete updatedOverrides.color;
  }
  if (typoTouched) {
    const merged = mergeGroup(existingOverrides.typography, typoSet, typoClear);
    if (merged) updatedOverrides.typography = merged; else delete updatedOverrides.typography;
  }
  if (componentTouched) {
    const merged = mergeGroup(existingOverrides.component, componentSet, componentClear);
    if (merged) updatedOverrides.component = merged; else delete updatedOverrides.component;
  }
  if (spacingTouched) {
    const merged = mergeGroup(existingOverrides.spacing, spacingSet, spacingClear);
    if (merged) updatedOverrides.spacing = merged; else delete updatedOverrides.spacing;
  }

  const finalOverrides =
    Object.keys(updatedOverrides).length > 0
      ? (updatedOverrides as TenantTokenOverrides)
      : undefined;

  // ── Persist ────────────────────────────────────────────────────────────────
  const updatedDesign: TenantDesignSettings = {
    ...current.design,
    ...(fields.theme !== undefined ? { theme: fields.theme } : {}),
    tokenOverrides: finalOverrides,
  };

  const updated: TenantSettings = { ...current, design: updatedDesign };
  const saveResult = await saveTenant(updated);

  if (!saveResult.ok) {
    return { ok: false, errors: [saveResult.error] };
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return { ok: true, warnings: [...warnings, ...(saveResult.warnings ?? [])] };
}
