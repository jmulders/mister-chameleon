/**
 * Admin — Tenant Settings Server Actions
 *
 * Thin server-side wrapper around tenant-store functions.
 * Imported by the TenantSettingsForm client component so that it can
 * call server-only store functions without shipping them to the browser.
 */

"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

import { cookies }        from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect }       from "next/navigation";
import { saveTenant, getTenantById } from "@/tenant/server";
import { getDb }          from "@/data/db";
import {
  getRequiredAdminSession,
  isSuperAdmin,
  canAccessTenant,
}                         from "@/lib/admin-auth/authorization";
import { DEV_TENANT_COOKIE, DEV_TENANT_COOKIE_MAX_AGE } from "@/tenant/dev-tenant-cookie";
import { validateDesignTokenUpload } from "@/tenant/design-token-validator";
import { logger } from "@/lib/logger";
import { parseAvatarConfig, type AdminAvatarConfig } from "@/components/admin/avatar-util";
import { provisionTenant }           from "@/cms/seed/tenant-provisioner";
import { getPackageDefinition, isValidPackageKey } from "@/tenant";
import { templateKeysToPageEntries }  from "@/page-config";
import { deletePage }                from "@/page-store";
import type { TenantSettings, StoreResult, TenantAiSettings, TenantDesignSettings, TenantCmsSettings } from "@/tenant/server";
import type { DesignTokenUploadInput }  from "@/tenant/design-token-validator";
import type { TenantTokenOverrides, ThemeKey, TemplateCatalogKey, HeaderVariant, FooterVariant, FooterDensity } from "@/tenant/types";
import type { ThemeRuleConfig }        from "@/decision/theme-decision";
import {
  BUILTIN_THEME_CONDITION_MAP,
  BUILTIN_THEME_PRIORITY_MAP,
} from "@/decision/theme-decision";
import type { StoredRule }             from "@/decision/rules/stored-rule";
import type { ProvisionResult }        from "@/cms/providers/cms-provider";
import type { SiteType }               from "@/page-config";
import type { ThemePresetKey }         from "@/design-system/theme/presets";
import type { BlockTokenSet }          from "@/design-system/theme/block-token-set";
import { CURATED_TOKEN_KEYS, VALID_SURFACE_ROLES, BLOCK_TOKEN_SET_SLOTS } from "@/design-system/theme/block-token-set";
import { isFeaturedFamilyKey }         from "@/design-system/theme/theme-families.config";
import type {
  ProvisionSiteResult,
  CreateSiteResult,
  SiteInitReport,
  CmsInitSection,
  StarterContentMode,
  DeployStatamicResult,
  DeployStatamicStep,
} from "./types";
import type { SiteIntakeData } from "@/site/types";

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
    layout,
    grid,
    responsive,
    elevation,
    focus,
    button,
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
    // Structural chrome + design-preset token groups (previously dropped here).
    ...(layout     ? { layout:     { ...existingOverrides.layout,     ...layout     } } : {}),
    ...(grid       ? { grid:       { ...existingOverrides.grid,       ...grid       } } : {}),
    ...(responsive ? { responsive: { ...existingOverrides.responsive, ...responsive } } : {}),
    ...(elevation  ? { elevation:  { ...existingOverrides.elevation,  ...elevation  } } : {}),
    ...(focus      ? { focus:      { ...existingOverrides.focus,      ...focus      } } : {}),
    ...(button     ? { button:     { ...existingOverrides.button,     ...button     } } : {}),
  };
  const hasAnyOverride = Object.keys(newTokenOverrides).length > 0;

  const updatedDesign: TenantDesignSettings = {
    ...current.design,
    ...(theme        !== undefined ? { theme }        : {}),
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(primaryFont  !== undefined ? { primaryFont }  : {}),
    ...(hasAnyOverride ? { tokenOverrides: newTokenOverrides } : {}),
    // Typography overrides only render when this flag is on (resolve-theme.ts).
    ...(typography ? { typographyOverrideEnabled: true } : {}),
    // A "custom" look (Builder / preset) clears any curated Style family so the
    // family's personality doesn't linger and mix with the tokens.
    ...(theme === "custom" ? { selectedStyleFamily: undefined } : {}),
  };

  // ── Persist ────────────────────────────────────────────────────────────────
  const updated: TenantSettings = { ...current, design: updatedDesign };
  const saveResult = await saveTenant(updated);

  if (!saveResult.ok) {
    return { ok: false, errors: [saveResult.error] };
  }

  // Re-render the public tenant site so the new tokens take effect.
  revalidatePath("/", "layout");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);

  return {
    ok:          true,
    appliedKeys,
    warnings:    [...warnings, ...(saveResult.warnings ?? [])],
    format,
  };
}

// ── Design preset gallery action ───────────────────────────────────────────────

/**
 * Applies a curated design preset (from DESIGN_PRESET_GALLERY) to a tenant.
 *
 * A preset is a COMPLETE look, so this replaces `design.tokenOverrides` wholesale
 * (rather than merging) and sets `design.theme = preset.baseTheme`. It also turns
 * on `typographyOverrideEnabled` so the preset's heading/body fonts actually
 * render (resolve-theme.ts gates typography behind that flag).
 *
 * The preset data is trusted, in-repo content — no upload validator needed; the
 * authoritative structural validation still runs inside saveTenant().
 */
export async function applyDesignPresetAction(
  tenantId: string,
  presetId: string,
): Promise<{ ok: true; presetId: string } | { ok: false; error: string }> {
  const { getDesignPreset } = await import("@/tenant/design-presets-gallery");
  const preset = getDesignPreset(presetId);
  if (!preset) return { ok: false, error: `Unknown preset "${presetId}".` };

  const current = await getTenantById(tenantId);
  if (!current) return { ok: false, error: `Tenant "${tenantId}" not found.` };

  // A preset is a COMPLETE look. buildCompleteLookDesign derives the site-wide
  // block tokens so every content block / adaptive slot inherits the preset's
  // colours, cards, buttons and typography. Aurora Purple Gold uses its
  // hand-tuned example; the rest are mapped generically from the overrides.
  const { buildCompleteLookDesign } = await import("@/lib/design/complete-look");
  let derivedOverride: import("@/design-system/theme/block-token-set").CuratedBlockTokens | undefined;
  if (presetId === "aurora-purple-gold") {
    const { EXAMPLE_SITE_DESIGN_TOKENS } = await import("@/design-system/theme/block-token-set-examples");
    derivedOverride = EXAMPLE_SITE_DESIGN_TOKENS;
  }

  const updatedDesign: TenantDesignSettings = {
    ...buildCompleteLookDesign(
      current.design,
      preset.tokenOverrides,
      preset.baseTheme,
      derivedOverride,
    ),
    // Snippet inherit-host-style flag: on for the "Inherit host style" preset,
    // cleared for every other preset so switching away turns it off.
    inheritHostStyle: preset.inheritHostStyle ?? false,
  };

  const saveResult = await saveTenant({ ...current, design: updatedDesign });
  if (!saveResult.ok) return { ok: false, error: saveResult.error };

  // Re-render the public site (token vars are injected at the [data-site] layer)
  // plus the admin views.
  revalidatePath("/", "layout");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  return { ok: true, presetId };
}

// ── Save tenant branding logos (light / dark) ──────────────────────────────────

export type SaveBrandingResult = { success: true } | { success: false; error: string };

/**
 * Persist the tenant's brand logos. These are the PRIMARY logo source for the
 * chrome (Header / Footer), overriding the CMS site settings. Only the two
 * variants edited in the admin are written; an omitted variant clears that slot.
 * validateTenantSettings enforces the { url, alt? } shape on save.
 */
export async function saveBrandingAction(
  tenantId: string,
  branding: {
    logo?:      { url: string; alt?: string };
    logoDark?:  { url: string; alt?: string };
    logoLight?: { url: string; alt?: string };
  },
): Promise<SaveBrandingResult> {
  try {
    await getRequiredAdminSession();

    const current = await getTenantById(tenantId);
    if (!current) return { success: false, error: `Tenant "${tenantId}" not found.` };

    // Drop empty variants so an unset logo clears rather than storing "".
    const clean = (l?: { url: string; alt?: string }) =>
      l?.url?.trim() ? { url: l.url.trim(), ...(l.alt?.trim() ? { alt: l.alt.trim() } : {}) } : undefined;
    const cleaned: NonNullable<TenantSettings["branding"]> = {
      ...(clean(branding.logo)      ? { logo:      clean(branding.logo)! }      : {}),
      ...(clean(branding.logoDark)  ? { logoDark:  clean(branding.logoDark)! }  : {}),
      ...(clean(branding.logoLight) ? { logoLight: clean(branding.logoLight)! } : {}),
    };

    const hasAny = Object.keys(cleaned).length > 0;
    const updated: TenantSettings = { ...current, ...(hasAny ? { branding: cleaned } : { branding: undefined }) };

    const saveResult = await saveTenant(updated);
    if (!saveResult.ok) return { success: false, error: saveResult.error };

    // Re-render the public site (chrome logo) + admin views.
    revalidatePath("/", "layout");
    revalidatePath(`/admin/tenants/${tenantId}`);
    return { success: true };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[saveBrandingAction] error", { tenantId, error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Persist the tenant avatar (image URL or emoji, or null to reset to initials).
 * The image is already uploaded to tenant_assets by the picker; only its URL is
 * stored here on the tenant settings (JSONB) — no migration.
 */
export async function saveTenantAvatarAction(
  tenantId: string,
  avatar:   AdminAvatarConfig | null,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await getRequiredAdminSession();

    const current = await getTenantById(tenantId);
    if (!current) return { success: false, error: `Tenant "${tenantId}" not found.` };

    // Validate/normalise the incoming avatar; null (or invalid) clears it.
    const clean = avatar ? parseAvatarConfig(avatar) : null;
    const updated: TenantSettings = { ...current, avatar: clean ?? undefined };

    const saveResult = await saveTenant(updated);
    if (!saveResult.ok) return { success: false, error: saveResult.error };

    revalidatePath("/", "layout");
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath(`/admin/tenants/${tenantId}/setup`);
    return { success: true };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[saveTenantAvatarAction] error", { tenantId, error: msg });
    return { success: false, error: msg };
  }
}

// ── Import a design preset from raw JSON (Builder "Importeer JSON") ─────────────

export type ImportPresetResult =
  | { ok: true; name?: string; appliedKeys: string[]; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Imports a design preset from a raw JSON string (pasted or uploaded in the
 * admin Design Builder) and applies it to a tenant as a COMPLETE look.
 *
 * The JSON is the grouped design-token UPLOAD format: `theme` + token groups
 * (color / typography / radius / …) at the top level. An optional `meta` and
 * `swatch` block (as in the exported preset files) is ignored — only known
 * token groups are read — so the human-readable files import cleanly.
 *
 * Validation is the SAME authoritative `validateDesignTokenUpload` used by the
 * token-upload path (CSS-injection guard, allowlisted keys, theme check).
 *
 * Unlike applyDesignTokensAction (which MERGES), this REPLACES
 * `design.tokenOverrides` wholesale — a preset is a complete look, matching the
 * gallery's applyDesignPresetAction behaviour.
 */
export async function importDesignPresetAction(
  tenantId: string,
  rawJson: string,
): Promise<ImportPresetResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, errors: ["Invalid JSON. Could not read the file."] };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ["JSON must be an object with token groups (color, typography, …)."] };
  }
  const obj = parsed as Record<string, unknown>;

  // Everything below is wrapped so the action NEVER throws — a thrown server
  // action surfaces to the client as an unhandled error and crashes the page to
  // the "This page couldn't load" boundary. We always return a structured result
  // instead, so the UI can show a message.
  try {
    // validateDesignTokenUpload accepts our grouped format, auto-converts a DTCG
    // / Tokens Studio (Figma) export, and ignores metadata keys (meta, swatch,
    // $schema). So the parsed file can be handed to it as-is.
    const validation = validateDesignTokenUpload(parsed);
    if (!validation.ok) return { ok: false, errors: validation.errors };

    const current = await getTenantById(tenantId);
    if (!current) return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };

    // Build tokenOverrides from the validated groups (REPLACE, not merge).
    const t = validation.tokens;
    const overrides: TenantTokenOverrides = {
      ...(t.radiusInteractive !== undefined ? { radiusInteractive: t.radiusInteractive } : {}),
      ...(t.radiusCard        !== undefined ? { radiusCard:        t.radiusCard }        : {}),
      ...(t.radiusPopover     !== undefined ? { radiusPopover:     t.radiusPopover }     : {}),
      ...(t.color      ? { color:      { ...t.color }      } : {}),
      ...(t.typography ? { typography: { ...t.typography } } : {}),
      ...(t.radius     ? { radius:     { ...t.radius }     } : {}),
      ...(t.spacing    ? { spacing:    { ...t.spacing }    } : {}),
      ...(t.border     ? { border:     { ...t.border }     } : {}),
      ...(t.shadow     ? { shadow:     { ...t.shadow }     } : {}),
      ...(t.motion     ? { motion:     { ...t.motion }     } : {}),
      ...(t.component  ? { component:  { ...t.component }  } : {}),
      ...(t.layout     ? { layout:     { ...t.layout }     } : {}),
      ...(t.grid       ? { grid:       { ...t.grid }       } : {}),
      ...(t.responsive ? { responsive: { ...t.responsive } } : {}),
      ...(t.elevation  ? { elevation:  { ...t.elevation }  } : {}),
      ...(t.focus      ? { focus:      { ...t.focus }      } : {}),
      ...(t.button     ? { button:     { ...t.button }     } : {}),
    };

    const updatedDesign: TenantDesignSettings = {
      ...current.design,
      theme:                     t.theme ?? "custom",
      tokenOverrides:            overrides,
      typographyOverrideEnabled: true,
      selectedStyleFamily:       undefined,
    };

    const saveResult = await saveTenant({ ...current, design: updatedDesign });
    if (!saveResult.ok) return { ok: false, errors: [saveResult.error] };

    revalidatePath("/", "layout");
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${tenantId}`);

    const meta = obj.meta as Record<string, unknown> | undefined;
    const name = meta && typeof meta.name === "string" ? meta.name : undefined;

    return {
      ok: true,
      name,
      appliedKeys: validation.appliedKeys,
      warnings: validation.warnings,
    };
  } catch (err) {
    logger.error("[importDesignPreset] unexpected error", { tenantId, error: String(err) });
    return { ok: false, errors: [`Import mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`] };
  }
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

// ProvisionSiteResult is imported from ./types — do not define it here.
// The canonical definition includes pagesCreated, pagesUpdated, variantsWritten,
// siteSettingsWritten, and navItemsWritten in addition to documentIds and warnings.
export type { ProvisionSiteResult } from "./types";

/**
 * Provisions starter CMS content for a tenant and records the provisioning
 * timestamp in the tenant store.
 *
 * Routes to the correct provisioner based on the tenant's configured CMS provider:
 *   - Sanity:    calls `provisionTenant()` (Sanity-specific, uses createOrReplace)
 *   - Storyblok: calls `StoryblokProvider.provisionSite()` (Management API)
 *   - Statamic:  calls `StatamicProvider.provisionSite()` (REST write API)
 *   - Other:     returns an error — only Sanity, Storyblok and Statamic support managed provisioning
 *
 * On success, updates `TenantSettings.cmsProvisionedAt` so the admin page and
 * readiness checks reflect the current state without querying the CMS.
 *
 * The action is idempotent — re-running replaces existing documents.
 * Operators are warned in the UI that existing content will be overwritten.
 *
 * @param tenantId  The tenant to provision.
 */
export async function provisionSiteAction(
  tenantId: string,
): Promise<ProvisionSiteResult> {
  try {
  // ── Load tenant ───────────────────────────────────────────────────────────
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── Route to the correct provisioner based on CMS provider ───────────────
  const cmsProvider = tenant.cms?.provider ?? "sanity";

  let result: ProvisionResult;

  if (cmsProvider === "storyblok") {
    const { StoryblokProvider } = await import("@/cms/providers/storyblok-provider");
    const provider = new StoryblokProvider();
    result = await provider.provisionSite(tenant);
  } else if (cmsProvider === "statamic") {
    // Resolve Statamic URL directly rather than via createCMSProviderAsync so
    // that the platform-level DB setting is always checked regardless of which
    // other CMS env vars happen to be set.  createCMSProviderAsync has a fast
    // path that skips the DB when *any* env var CMS is configured, which would
    // silently return the wrong provider (e.g. Sanity) for Statamic tenants.
    const { StatamicProvider }          = await import("@/cms/providers/statamic-provider");
    const { StatamicClient }            = await import("@/cms/providers/statamic-client");
    const { getPlatformStatamicSettings } = await import("@/platform/platform-store");

    const tenantUrl    = tenant.cms?.statamicBaseUrl?.trim();
    const platformResult = await getPlatformStatamicSettings().catch(() => null);
    const platformUrl  = platformResult?.ok ? platformResult.data.baseUrl?.trim() : undefined;
    const resolvedUrl  = tenantUrl || platformUrl;

    if (!resolvedUrl) {
      return {
        ok:    false,
        error: "No Statamic base URL configured. " +
               "Set it in the tenant's CMS settings or in Platform → CMS settings.",
      };
    }

    const apiKey = platformResult?.ok ? (platformResult.data.apiKey ?? undefined) : undefined;
    const client = new StatamicClient(resolvedUrl, apiKey);
    result = await new StatamicProvider(client).provisionSite(tenant);
  } else if (cmsProvider === "sanity" || !cmsProvider) {
    result = await provisionTenant(tenant);
  } else {
    return {
      ok:    false,
      error: `Managed provisioning is not supported for the "${cmsProvider}" CMS provider. ` +
             `Configure content manually in your CMS dashboard.`,
    };
  }

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
    ok:                  true,
    documentIds:         result.documentIds,
    pagesCreated:        result.pagesCreated,
    pagesUpdated:        result.pagesUpdated,
    variantsWritten:     result.variantsWritten,
    siteSettingsWritten: result.siteSettingsWritten,
    navItemsWritten:     result.navItemsWritten,
    warnings:            [...result.warnings, ...storeWarnings],
  };
  } catch (err) {
    rethrowNextInternal(err);
    // Top-level safety net — prevents unhandled exceptions from crashing the
    // server action handler (which would cause the client to see "Failed to fetch"
    // instead of a proper error message).
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Site initialization action ─────────────────────────────────────────────────

/**
 * Full first-time (and re-initialization) site bootstrap orchestrator.
 *
 * Runs all initialization sections in sequence, capturing per-section status
 * into a `SiteInitReport` so the admin UI can show a granular summary.
 * Individual section failures do NOT abort the run — they are recorded in the
 * report and the action continues.  Only a fatal pre-condition failure (tenant
 * not found, invalid package) returns `ok: false`.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   1. tenantBase   — validates tenant + packageKey; derives display name.
 *   2. designSystem — applies block entitlements from package; ensures theme.
 *   3. cmsContent   — provisions pages, variants, nav, site settings via CMS.
 *   4. integrations — records integration baseline (CRM, enrichment, AI).
 *   5. domains      — records domain baseline.
 *
 *   All changes are persisted with `siteInitializedAt`, `siteType`,
 *   `selectedTemplates`, and `cmsProvisionedAt` timestamps.
 *
 * @param tenantId            The tenant to initialize.
 * @param siteType            Corporate | Recruitment | Content archetype.
 * @param selectedTemplates   Template catalog keys chosen in the panel.
 * @param includeDefaultBlocks Whether to include default block stubs.
 * @param starterContentMode  fill | none | overwrite content depth.
 * @param includeShowcasePage Whether to include the showcase / demo page.
 * @param recommendedThemePreset Optional theme preset from the setup wizard.
 * @param blueprintKey        Optional blueprint key (e.g. "b2b_saas") to run
 *                            the full initializeSite() flow (PART 6).
 * @param intake              Operator intake data for blueprint-driven content.
 * @param referenceUrl        Optional URL analyzed for branding inspiration.
 */
export async function createSiteAction(
  tenantId:                string,
  siteType:                SiteType,
  selectedTemplates:       TemplateCatalogKey[],
  includeDefaultBlocks:    boolean,
  starterContentMode:      StarterContentMode,
  includeShowcasePage:     boolean,
  recommendedThemePreset?: ThemePresetKey,
  blueprintKey?:           string,
  intake?:                 SiteIntakeData,
  referenceUrl?:           string,
  selectedModules?:        string[],
): Promise<CreateSiteResult> {

  const allWarnings: string[] = [];

  // ── PART 1 — Tenant base ──────────────────────────────────────────────────
  //
  // Load the tenant and validate the packageKey.  Without these two values
  // the rest of initialization cannot run, so a failure here is fatal.

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  if (!isValidPackageKey(tenant.packageKey)) {
    return {
      ok:    false,
      error: `Tenant "${tenantId}" has an unrecognised packageKey: "${tenant.packageKey}". ` +
             `Expected one of: starter, growth, pro.`,
    };
  }

  const report: SiteInitReport = {
    tenantBase:   { status: "ok", message: `Package: ${tenant.packageKey}` },
    designSystem: { status: "ok" },
    cmsContent:   { status: "ok" },
    integrations: { status: "ok" },
    domains:      { status: "ok" },
  };

  // Accumulate in-place updates; persist once at the end.
  let working: TenantSettings = tenant;

  // ── PART 2 — Design system ────────────────────────────────────────────────
  //
  // Apply the package's block entitlements and ensure a default theme exists.

  try {
    const pkg = getPackageDefinition(tenant.packageKey);

    // When the site preset declares a recommended theme, apply it now so that
    // the operator gets the correct starting visual identity for this archetype.
    // Falls back to the existing tenant theme, then to "default".
    const appliedTheme: ThemeKey =
      (recommendedThemePreset as ThemeKey | undefined) ??
      working.design?.theme ??
      "default";

    // For premium style families (dark-ai, clean-corporate, structured-saas),
    // the preset key IS the featured family key.  Write selectedStyleFamily so
    // that the featured-family CSS variable cascade activates immediately after
    // initialization — matching the behaviour of clicking "Select family" in
    // Design → Style.  Clear it for standard presets so stale family state
    // from a previous initialization run is not carried forward.
    const appliedStyleFamily: string | undefined =
      recommendedThemePreset && isFeaturedFamilyKey(recommendedThemePreset)
        ? recommendedThemePreset
        : undefined;

    working = {
      ...working,
      blocks: {
        context: [...pkg.allowedBlocks.context],
        content: [...pkg.allowedBlocks.content],
      },
      design: {
        ...working.design,
        theme: appliedTheme,
        // Activate the featured-family cascade when the preset is a premium family.
        // Leave selectedStyleFamily unchanged when no recommendation is given.
        ...(recommendedThemePreset !== undefined
          ? { selectedStyleFamily: appliedStyleFamily }
          : {}),
      },
    };

    report.designSystem = {
      status:  "ok",
      message: `Block entitlements applied from ${tenant.packageKey} package.`,
      details: [
        `Context blocks: ${pkg.allowedBlocks.context.length}`,
        `Content blocks: ${pkg.allowedBlocks.content.length}`,
        `Theme: ${appliedTheme}${recommendedThemePreset ? " (preset recommendation)" : ""}`,
      ],
    };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    report.designSystem = { status: "error", message: `Design system setup failed: ${msg}` };
    allWarnings.push(`Design system: ${msg}`);
  }

  // ── PART 3 — CMS content ──────────────────────────────────────────────────
  //
  // Convert the selected template keys to page entries and provision all CMS
  // documents: pages, variant docs, nav items, site settings.
  //
  // Routes to the correct provisioner based on the tenant's configured CMS:
  //   • Statamic → StatamicProvider.provisionSite() (with pages array)
  //   • Sanity / default → provisionTenant() (Sanity-specific)

  let cmsProvisionedAt: string | undefined;

  try {
    const pages      = templateKeysToPageEntries(selectedTemplates, siteType);
    const cmsProvider = working.cms?.provider ?? "sanity";

    let provisionResult: ProvisionResult;

    if (cmsProvider === "statamic") {
      // Resolve Statamic connection — mirror the pattern from provisionSiteAction.
      const { StatamicProvider }           = await import("@/cms/providers/statamic-provider");
      const { StatamicClient }             = await import("@/cms/providers/statamic-client");
      const { getPlatformStatamicSettings } = await import("@/platform/platform-store");

      const tenantUrl      = working.cms?.statamicBaseUrl?.trim();
      const platformResult = await getPlatformStatamicSettings().catch(() => null);
      const platformUrl    = platformResult?.ok ? platformResult.data.baseUrl?.trim() : undefined;
      const resolvedUrl    = tenantUrl || platformUrl;

      if (!resolvedUrl) {
        throw new Error(
          "No Statamic base URL configured. " +
          "Set it in the tenant's CMS settings or in Platform → CMS settings.",
        );
      }

      const apiKey = platformResult?.ok ? (platformResult.data.apiKey ?? undefined) : undefined;
      const client = new StatamicClient(resolvedUrl, apiKey);
      provisionResult = await new StatamicProvider(client).provisionSite(working, {
        dryRun:              false,
        siteType,
        pages,
        includeDefaultBlocks,
        starterContentMode,
        includeShowcasePage,
        modules:             selectedModules,
      });
    } else {
      provisionResult = await provisionTenant(
        working,
        /* dryRun          */ false,
        siteType,
        pages,
        includeDefaultBlocks,
        starterContentMode,
        includeShowcasePage,
      );
    }

    if (!provisionResult.ok) {
      const cmsSection: CmsInitSection = {
        status:  "error",
        message: provisionResult.error,
      };
      if (provisionResult.partial?.length) {
        cmsSection.cmsDocumentIds = provisionResult.partial;
      }
      report.cmsContent = cmsSection;
      allWarnings.push(`CMS content: ${provisionResult.error}`);
    } else {
      cmsProvisionedAt = new Date().toISOString();

      const details: string[] = [
        `Pages created: ${provisionResult.pagesCreated}`,
        `Pages updated: ${provisionResult.pagesUpdated}`,
        `Variants written: ${provisionResult.variantsWritten}`,
        `Nav items written: ${provisionResult.navItemsWritten}`,
        `Site settings written: ${provisionResult.siteSettingsWritten ? "yes" : "no"}`,
      ];

      const cmsSection: CmsInitSection = {
        status:          provisionResult.warnings.length > 0 ? "warn" : "ok",
        message:         `Provisioned ${provisionResult.pagesCreated + provisionResult.pagesUpdated} page(s).`,
        details,
        pagesCreated:    provisionResult.pagesCreated,
        pagesUpdated:    provisionResult.pagesUpdated,
        variantsWritten: provisionResult.variantsWritten,
        siteSettingsWritten: provisionResult.siteSettingsWritten,
        navItemsWritten: provisionResult.navItemsWritten,
        cmsDocumentIds:  provisionResult.documentIds,
      };
      report.cmsContent = cmsSection;

      if (provisionResult.warnings.length > 0) {
        allWarnings.push(...provisionResult.warnings.map((w: string) => `CMS: ${w}`));
      }
    }
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    report.cmsContent = { status: "error", message: `CMS provisioning threw: ${msg}` };
    allWarnings.push(`CMS content: ${msg}`);
  }

  // ── PART 4 — Integrations baseline ───────────────────────────────────────
  //
  // Record the current integration state without changing it — CRM and
  // enrichment are initialized to disabled-by-default if not yet configured.

  try {
    const details: string[] = [];

    if (!working.crm) {
      working = {
        ...working,
        crm: {
          enabled:          false,
          useCrmEnrichment: false,
        },
      };
      details.push("CRM: disabled (default)");
    } else {
      details.push("CRM: already configured");
    }

    if (!working.enrichment) {
      working = {
        ...working,
        enrichment: {
          enabled:                false,
          useGeoEnrichment:       false,
          useIpinfoLite:          false,
          useOpenKvK:             false,
          useLeadinfo:            false,
          useIpCompanyEnrichment: false,
        },
      };
      details.push("Enrichment: disabled (default)");
    } else {
      details.push("Enrichment: already configured");
    }

    const aiMode = working.ai?.mode ?? "disabled";
    details.push(`AI mode: ${aiMode}`);

    report.integrations = {
      status:  "ok",
      message: "Integration baseline recorded.",
      details,
    };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    report.integrations = { status: "error", message: `Integrations setup failed: ${msg}` };
    allWarnings.push(`Integrations: ${msg}`);
  }

  // ── PART 5 — Domains baseline ─────────────────────────────────────────────
  //
  // Record whether a primary domain is configured; skip gracefully if not.

  try {
    if (working.primaryDomain) {
      report.domains = {
        status:  "ok",
        message: `Primary domain: ${working.primaryDomain}`,
      };
    } else {
      report.domains = {
        status:  "skipped",
        message: "No primary domain configured yet. Set one in the Domains tab.",
      };
    }
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    report.domains = { status: "error", message: `Domain baseline failed: ${msg}` };
    allWarnings.push(`Domains: ${msg}`);
  }

  // ── PART 6 — Blueprint + intake initialization ────────────────────────────
  //
  // When a blueprintKey and intake data are provided, run initializeSite():
  //   - Persist tenant_sites + tenant_site_setup rows (blueprint + theme).
  //   - Create pages from the blueprint's page list (Supabase pages table).
  //   - Generate and persist navigation (site_navigation DB fallback).
  //   - Activate interest profiles matching the blueprint's site type family.
  //   - Scaffold content from intake data (no empty pages).
  //
  // This section runs after the CMS provisioning section so that the DB page
  // store complements any CMS (Sanity) pages rather than conflicting with them.
  // Failures here are non-fatal — the report captures the outcome.

  if (blueprintKey && intake) {
    try {
      const { initializeSite } = await import("@/site/initialize-site") as
        typeof import("@/site/initialize-site");

      const siteResult = await initializeSite({
        tenantId,
        siteTypeKey:  blueprintKey,
        blueprintKey,
        themeKey:     recommendedThemePreset,
        intake,
        referenceUrl,
        overwrite:    starterContentMode === "overwrite",
      });

      const siteSection: import("./types").SiteInitSection = {
        status:  siteResult.warnings.length > 0 ? "warn" : "ok",
        message: `Blueprint "${blueprintKey}" applied.`,
        details: [
          `Site ID: ${siteResult.siteId}`,
          `Pages: ${siteResult.pages.filter((p) => p.status !== "skipped").length} created / overwritten`,
          `Navigation items: ${siteResult.navigation.length}`,
          `Interest profiles activated: ${siteResult.activeProfiles.length}`,
          `Decision rules seeded: ${siteResult.seededRulesCount}`,
          `Theme: ${siteResult.theme}`,
        ],
      };

      // Attach to report — blueprint section lives alongside cmsContent.
      (report as unknown as Record<string, unknown>).blueprint = siteSection;

      if (siteResult.warnings.length > 0) {
        allWarnings.push(...siteResult.warnings.map((w) => `Blueprint: ${w}`));
      }
    } catch (err) {
    rethrowNextInternal(err);
      const msg = err instanceof Error ? err.message : String(err);
      (report as unknown as Record<string, unknown>).blueprint = {
        status:  "error",
        message: `Blueprint initialization failed: ${msg}`,
      };
      allWarnings.push(`Blueprint: ${msg}`);
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  //
  // Write the fully-updated tenant record with all initialization timestamps.

  const now = new Date().toISOString();

  const final: TenantSettings = {
    ...working,
    siteInitializedAt: now,
    siteType,
    selectedTemplates,
    ...(cmsProvisionedAt ? { cmsProvisionedAt } : {}),
    ...(selectedModules?.length ? { selectedModules } : {}),
  };

  const saveResult = await saveTenant(final);
  if (!saveResult.ok) {
    allWarnings.push(`Note: initialization completed but store save failed: ${saveResult.error}`);
  } else {
    if (saveResult.warnings?.length) allWarnings.push(...saveResult.warnings);
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");

  return { ok: true, report, warnings: allWarnings };
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
 *   colorPrimaryHover → tokenOverrides.color.primaryHover
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
  colorPrimary?:        string;
  colorPrimaryHover?:   string;
  colorSecondary?:      string;
  colorBackground?: string;
  colorForeground?: string;
  // typography group — base families
  fontSans?:        string;
  fontMono?:        string;
  fontSerif?:       string;
  baseFontSize?:    string;
  lineHeightBase?:  string;
  fontSansSource?:  string;
  fontSerifSource?: string;
  fontMonoSource?:  string;
  // typography group — usage-role mappings
  fontHeading?:       string;
  fontBody?:          string;
  fontUI?:            string;
  fontCode?:          string;
  fontHeadingSource?: string;
  // component group
  buttonRadius?:    string;
  cardRadius?:      string;
  cardPadding?:     string;
  // spacing group
  spacingMd?:       string;
  spacingLg?:       string;
  spacingXl?:       string;
  // layout group — header & footer shell (color tokens)
  headerBg?:         string;
  headerBgScrolled?: string;
  headerFg?:         string;
  headerBorder?:     string;
  footerBg?:         string;
  footerFg?:         string;
  footerBorder?:     string;
  // layout group — navigation typography
  /** CSS size value for top-level nav links, e.g. "1rem", "0.9375rem". Maps to --nav-link-size. */
  navLinkSize?:         string;
  /** CSS weight value for top-level nav links, e.g. "500", "600", "700". Maps to --nav-link-weight. */
  navLinkWeight?:       string;
  /** CSS letter-spacing for top-level nav links, e.g. "0.025em", "normal". Maps to --nav-link-tracking. */
  navLinkTracking?:     string;
  /** CSS size value for dropdown child links. Maps to --nav-dropdown-item-size. */
  navDropdownItemSize?: string;
  /** CSS size value for footer nav links. Maps to --footer-nav-size. */
  footerNavSize?:       string;
  // layout structure — header & footer structural variant overrides.
  // Non-empty string → set the override.
  // Empty string ""  → clear the override (revert to family default).
  // undefined        → leave unchanged.
  headerVariant?: HeaderVariant | "";
  footerVariant?: FooterVariant | "";
  footerDensity?: FooterDensity | "";
  /**
   * The Featured Theme Family key that was explicitly chosen in Design → Style.
   *
   * When provided, this is written to TenantDesignSettings.selectedStyleFamily
   * so the admin UI can display "Inherited from [Family]" labels in the
   * Typography and Layout sections.
   *
   * Set to "" to clear (remove) the stored family key.
   * Omit (undefined) to leave the existing value unchanged.
   */
  selectedStyleFamily?: string;
  /**
   * When `true`:  typography overrides in tokenOverrides.typography are applied
   *               on top of the active theme family's typography.
   * When `false`: all tokenOverrides.typography values are ignored; the active
   *               theme family's typography is used as-is.
   * Omitting this field leaves the stored value unchanged.
   *
   * Pass `false` whenever switching to a new theme preset so the new family's
   * typography is visible immediately without a manual reset step.
   */
  typographyOverrideEnabled?: boolean;
  /**
   * When `true`, ALL existing tokenOverrides are cleared (set to undefined) on
   * save, regardless of any per-field sets above.  Used by the Style tab so that
   * activating a curated theme family fully replaces any design-preset / Builder
   * tokens — keeping curated "Style" and token "Presets" mutually exclusive (one
   * source of truth) instead of layering on top of each other.
   */
  clearTokenOverrides?: boolean;
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
  if (fields.colorPrimary      !== undefined) { if (fields.colorPrimary.trim())      colorSet.primary      = fields.colorPrimary.trim();      else colorClear.push("primary");      }
  if (fields.colorPrimaryHover !== undefined) { if (fields.colorPrimaryHover.trim()) colorSet.primaryHover = fields.colorPrimaryHover.trim(); else colorClear.push("primaryHover"); }
  if (fields.colorSecondary    !== undefined) { if (fields.colorSecondary.trim())    colorSet.secondary    = fields.colorSecondary.trim();    else colorClear.push("secondary");    }
  if (fields.colorBackground !== undefined) { if (fields.colorBackground.trim()) colorSet.background = fields.colorBackground.trim(); else colorClear.push("background"); }
  if (fields.colorForeground !== undefined) { if (fields.colorForeground.trim()) colorSet.foreground = fields.colorForeground.trim(); else colorClear.push("foreground"); }

  const typoSet:   Record<string, string> = {};
  const typoClear: string[]               = [];
  if (fields.fontSans        !== undefined) { if (fields.fontSans.trim())        typoSet.fontSans        = fields.fontSans.trim();        else typoClear.push("fontSans");        }
  if (fields.fontMono        !== undefined) { if (fields.fontMono.trim())        typoSet.fontMono        = fields.fontMono.trim();        else typoClear.push("fontMono");        }
  if (fields.fontSerif       !== undefined) { if (fields.fontSerif.trim())       typoSet.fontSerif       = fields.fontSerif.trim();       else typoClear.push("fontSerif");       }
  if (fields.baseFontSize    !== undefined) { if (fields.baseFontSize.trim())    typoSet.baseFontSize    = fields.baseFontSize.trim();    else typoClear.push("baseFontSize");    }
  if (fields.lineHeightBase  !== undefined) { if (fields.lineHeightBase.trim())  typoSet.lineHeightBase  = fields.lineHeightBase.trim();  else typoClear.push("lineHeightBase");  }
  if (fields.fontSansSource  !== undefined) { if (fields.fontSansSource.trim())  typoSet.fontSansSource  = fields.fontSansSource.trim();  else typoClear.push("fontSansSource");  }
  if (fields.fontSerifSource !== undefined) { if (fields.fontSerifSource.trim()) typoSet.fontSerifSource = fields.fontSerifSource.trim(); else typoClear.push("fontSerifSource"); }
  if (fields.fontMonoSource  !== undefined) { if (fields.fontMonoSource.trim())  typoSet.fontMonoSource  = fields.fontMonoSource.trim();  else typoClear.push("fontMonoSource");  }
  // Font role mappings
  if (fields.fontHeading       !== undefined) { if (fields.fontHeading.trim())       typoSet.fontHeading       = fields.fontHeading.trim();       else typoClear.push("fontHeading");       }
  if (fields.fontBody          !== undefined) { if (fields.fontBody.trim())          typoSet.fontBody          = fields.fontBody.trim();          else typoClear.push("fontBody");          }
  if (fields.fontUI            !== undefined) { if (fields.fontUI.trim())            typoSet.fontUI            = fields.fontUI.trim();            else typoClear.push("fontUI");            }
  if (fields.fontCode          !== undefined) { if (fields.fontCode.trim())          typoSet.fontCode          = fields.fontCode.trim();          else typoClear.push("fontCode");          }
  if (fields.fontHeadingSource !== undefined) { if (fields.fontHeadingSource.trim()) typoSet.fontHeadingSource = fields.fontHeadingSource.trim(); else typoClear.push("fontHeadingSource"); }

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

  // Layout group — header/footer shell tokens + navigation typography.
  // Values are CSS strings; no separate validation pass needed
  // (any non-empty value is accepted, same as the legacy primaryColor field).
  const layoutSet:   Record<string, string> = {};
  const layoutClear: string[]               = [];
  if (fields.headerBg            !== undefined) { if (fields.headerBg.trim())            layoutSet.headerBg            = fields.headerBg.trim();            else layoutClear.push("headerBg");            }
  if (fields.headerBgScrolled    !== undefined) { if (fields.headerBgScrolled.trim())    layoutSet.headerBgScrolled    = fields.headerBgScrolled.trim();    else layoutClear.push("headerBgScrolled");    }
  if (fields.headerFg            !== undefined) { if (fields.headerFg.trim())            layoutSet.headerFg            = fields.headerFg.trim();            else layoutClear.push("headerFg");            }
  if (fields.headerBorder        !== undefined) { if (fields.headerBorder.trim())        layoutSet.headerBorder        = fields.headerBorder.trim();        else layoutClear.push("headerBorder");        }
  if (fields.footerBg            !== undefined) { if (fields.footerBg.trim())            layoutSet.footerBg            = fields.footerBg.trim();            else layoutClear.push("footerBg");            }
  if (fields.footerFg            !== undefined) { if (fields.footerFg.trim())            layoutSet.footerFg            = fields.footerFg.trim();            else layoutClear.push("footerFg");            }
  if (fields.footerBorder        !== undefined) { if (fields.footerBorder.trim())        layoutSet.footerBorder        = fields.footerBorder.trim();        else layoutClear.push("footerBorder");        }
  // Navigation typography
  if (fields.navLinkSize         !== undefined) { if (fields.navLinkSize.trim())         layoutSet.navLinkSize         = fields.navLinkSize.trim();         else layoutClear.push("navLinkSize");         }
  if (fields.navLinkWeight       !== undefined) { if (fields.navLinkWeight.trim())       layoutSet.navLinkWeight       = fields.navLinkWeight.trim();       else layoutClear.push("navLinkWeight");       }
  if (fields.navLinkTracking     !== undefined) { if (fields.navLinkTracking.trim())     layoutSet.navLinkTracking     = fields.navLinkTracking.trim();     else layoutClear.push("navLinkTracking");     }
  if (fields.navDropdownItemSize !== undefined) { if (fields.navDropdownItemSize.trim()) layoutSet.navDropdownItemSize = fields.navDropdownItemSize.trim(); else layoutClear.push("navDropdownItemSize"); }
  if (fields.footerNavSize       !== undefined) { if (fields.footerNavSize.trim())       layoutSet.footerNavSize       = fields.footerNavSize.trim();       else layoutClear.push("footerNavSize");       }

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
  const layoutTouched    = Object.keys(layoutSet).length    > 0 || layoutClear.length    > 0;

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
  if (layoutTouched) {
    const merged = mergeGroup(
      existingOverrides.layout as Readonly<Record<string, string>> | undefined,
      layoutSet,
      layoutClear,
    );
    if (merged) updatedOverrides.layout = merged; else delete updatedOverrides.layout;
  }

  const finalOverrides =
    Object.keys(updatedOverrides).length > 0
      ? (updatedOverrides as TenantTokenOverrides)
      : undefined;

  // ── Persist ────────────────────────────────────────────────────────────────
  //
  // Structural variant overrides sit directly on TenantDesignSettings (not in
  // tokenOverrides) because they control JSX component dispatch, not CSS values.
  // An empty-string value means "clear" — spreading undefined removes the key
  // from the serialised object so the family default takes effect at runtime.
  const updatedDesign: TenantDesignSettings = {
    ...current.design,
    ...(fields.theme               !== undefined ? { theme:               fields.theme }                                      : {}),
    ...(fields.headerVariant       !== undefined ? { headerVariant:       (fields.headerVariant as HeaderVariant) || undefined } : {}),
    ...(fields.footerVariant       !== undefined ? { footerVariant:       (fields.footerVariant as FooterVariant) || undefined } : {}),
    ...(fields.footerDensity       !== undefined ? { footerDensity:       (fields.footerDensity as FooterDensity) || undefined } : {}),
    ...(fields.selectedStyleFamily       !== undefined ? { selectedStyleFamily:       fields.selectedStyleFamily || undefined }                                              : {}),
    ...(fields.typographyOverrideEnabled !== undefined ? { typographyOverrideEnabled: fields.typographyOverrideEnabled }                                                    : {}),
    // clearTokenOverrides wipes all design-preset/Builder tokens so a curated
    // Style fully replaces them (mutually exclusive with the Presets tab).
    tokenOverrides: fields.clearTokenOverrides ? undefined : finalOverrides,
  };

  const updated: TenantSettings = { ...current, design: updatedDesign };
  const saveResult = await saveTenant(updated);

  if (!saveResult.ok) {
    return { ok: false, errors: [saveResult.error] };
  }

  // ── Clear the mc_theme session cookie when the active preset changes ─────────
  //
  // The cookie locks the theme for 4 hours so that a real visitor's theme stays
  // stable during their session.  When an admin explicitly activates a new preset
  // the lock becomes stale — it would mask the new theme until the 4-hour TTL
  // expires.  Clearing it forces the next site visit to pick up the new preset
  // from the DB immediately.
  //
  // We also clear on headerVariant / footerVariant changes because those affect
  // the layout structure, and a stale session cookie should never hide the change.
  //
  // In development we also auto-activate the mc_dev_tenant cookie for this tenant
  // so that visiting localhost:3000 immediately uses the tenant whose design was
  // just edited — without requiring a separate trip to /admin/tenants/[id]/debug.
  if (fields.theme !== undefined || fields.headerVariant !== undefined || fields.footerVariant !== undefined) {
    try {
      const cookieStore = await cookies();
      const { clearThemeSessionCookie } =
        await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
      clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);

      // ── Dev: activate this tenant for the public site preview ────────────────
      if (process.env.NODE_ENV === "development") {
        cookieStore.set(DEV_TENANT_COOKIE, tenantId, {
          path:     "/",
          maxAge:   DEV_TENANT_COOKIE_MAX_AGE,
          httpOnly: true,
          sameSite: "lax",
        });
      }
    } catch {
      // Non-critical: if clearing fails the cookie expires naturally after 4 hours.
    }
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  // Always bust the public site's full-route cache whenever any design setting
  // changes — theme preset, layout variant, color tokens, typography overrides,
  // spacing, etc.  The root layout is re-rendered on the next request so CSS
  // variables reflecting the new settings are served immediately.
  revalidatePath("/", "layout");

  return { ok: true, warnings: [...warnings, ...(saveResult.warnings ?? [])] };
}

// ── saveRuleThemeKeyAction ────────────────────────────────────────────────────

/**
 * Patch plan.themeKey on a single StoredRule in the tenant's rules_config.
 *
 * Called by the ThemeRulesEditor when an operator assigns or clears a
 * theme override for a specific decision rule.
 *
 * Passing null for themeKey removes the override (the rule will no longer
 * trigger a theme switch when it fires).
 *
 * Also clears the mc_theme session cookie so the next page load re-evaluates
 * with the updated rule config.
 */
export async function saveRuleThemeKeyAction(
  tenantId: string,
  ruleId:   string,
  themeKey: import("@/design-system/theme/presets").ThemePresetKey | null,
): Promise<{ ok: boolean; errors?: string[] }> {
  if (!tenantId || !ruleId) {
    return { ok: false, errors: ["tenantId and ruleId are required."] };
  }

  // Load the current rules config (or fall back to seed)
  const { getTenantRulesAction, saveTenantRulesAction } =
    await import("@/app/admin/tenants/[tenantId]/rules/actions") as
      typeof import("@/app/admin/tenants/[tenantId]/rules/actions");

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) {
    return { ok: false, errors: [`Failed to load rules: ${current.error}`] };
  }

  const rule = current.config.rules.find((r) => r.id === ruleId);
  if (!rule) {
    return { ok: false, errors: [`Rule "${ruleId}" not found.`] };
  }

  // Validate themeKey when provided
  if (themeKey !== null) {
    const { isThemePresetKey } =
      await import("@/design-system/theme/presets") as
        typeof import("@/design-system/theme/presets");
    if (!isThemePresetKey(themeKey)) {
      return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
    }
  }

  // Patch the rule in-place
  const updatedRules = current.config.rules.map((r) =>
    r.id === ruleId
      ? { ...r, plan: themeKey !== null ? { ...r.plan, themeKey } : (() => { const p = { ...r.plan }; delete p.themeKey; return p; })() }
      : r,
  );

  const updatedConfig = { ...current.config, rules: updatedRules };
  const saveResult = await saveTenantRulesAction(tenantId, updatedConfig);

  if (!saveResult.ok) {
    const errs: string[] =
      "fieldErrors" in saveResult && saveResult.fieldErrors
        ? saveResult.fieldErrors
        : [saveResult.error];
    return { ok: false, errors: errs };
  }

  // Clear the session theme lock so the next page load re-evaluates.
  try {
    const { clearThemeSessionCookie } =
      await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch {
    // Non-critical
  }

  revalidatePath(`/admin/tenants/${tenantId}/design`);

  return { ok: true };
}

/**
 * Set a rule's theme outcome to EITHER a curated theme key OR a gallery preset
 * (item 6). Exactly one of `themeKey` / `themePresetId` should be non-null; the
 * other is cleared. Both null clears the theme outcome. Validates the value and
 * clears the mc_theme session lock so the next load re-evaluates.
 */
export async function saveRuleThemeSelectionAction(
  tenantId: string,
  ruleId:   string,
  selection: {
    themeKey?:      import("@/design-system/theme/presets").ThemePresetKey | null;
    themePresetId?: string | null;
  },
): Promise<{ ok: boolean; errors?: string[] }> {
  if (!tenantId || !ruleId) return { ok: false, errors: ["tenantId and ruleId are required."] };

  const { getTenantRulesAction, saveTenantRulesAction } =
    await import("@/app/admin/tenants/[tenantId]/rules/actions") as
      typeof import("@/app/admin/tenants/[tenantId]/rules/actions");
  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) return { ok: false, errors: [`Failed to load rules: ${current.error}`] };
  const rule = current.config.rules.find((r) => r.id === ruleId);
  if (!rule) return { ok: false, errors: [`Rule "${ruleId}" not found.`] };

  const themeKey      = selection.themeKey ?? null;
  const themePresetId = selection.themePresetId ?? null;

  if (themeKey !== null) {
    const { isThemePresetKey } = await import("@/design-system/theme/presets");
    if (!isThemePresetKey(themeKey)) return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
  }
  if (themePresetId !== null) {
    const { getDesignPreset } = await import("@/tenant/design-presets-gallery");
    if (!getDesignPreset(themePresetId)) return { ok: false, errors: [`Unknown gallery preset: "${themePresetId}".`] };
  }

  const updatedRules = current.config.rules.map((r) => {
    if (r.id !== ruleId) return r;
    const plan = { ...r.plan };
    delete plan.themeKey;
    delete plan.themePresetId;
    if (themePresetId !== null)  plan.themePresetId = themePresetId;
    else if (themeKey !== null)  plan.themeKey = themeKey;
    return { ...r, plan };
  });

  const saveResult = await saveTenantRulesAction(tenantId, { ...current.config, rules: updatedRules });
  if (!saveResult.ok) {
    const errs: string[] = "fieldErrors" in saveResult && saveResult.fieldErrors ? saveResult.fieldErrors : [saveResult.error];
    return { ok: false, errors: errs };
  }

  try {
    const { clearThemeSessionCookie } = await import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch { /* non-critical */ }

  revalidatePath(`/admin/tenants/${tenantId}/design`);
  return { ok: true };
}

// ── saveThemeRulesAction ───────────────────────────────────────────────────────

/**
 * @deprecated Use saveRuleThemeKeyAction() to patch plan.themeKey directly on
 * StoredRules.  This action persists the legacy ThemeRuleConfig which is stored
 * in tenant.design.themeRules and is no longer evaluated at runtime.
 *
 * Kept for backward compatibility — existing ThemeRuleConfig data is preserved
 * in the DB but the production theme decision now reads StoredRulesConfig.
 */
export async function saveThemeRulesAction(
  tenantId: string,
  config:   ThemeRuleConfig,
): Promise<{ ok: boolean; errors?: string[] }> {
  const current = await getTenantById(tenantId);
  if (!current) {
    return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };
  }

  // Basic validation
  if (config.rules.length > 50) {
    return { ok: false, errors: ["Maximum 50 theme rules allowed."] };
  }

  for (const rule of config.rules) {
    if (!rule.id || !rule.label || typeof rule.priority !== "number") {
      return { ok: false, errors: [`Invalid rule: ${rule.id || "(missing id)"}`] };
    }
    if (!rule.themeKey && !rule.familyKey) {
      return { ok: false, errors: [`Rule "${rule.label}" must have a themeKey or familyKey.`] };
    }
    // Every rule must have a condition source so it can actually fire at runtime.
    // Accept either the new sourceRuleId reference OR the legacy inline condition
    // (backward compat for rules saved before the sourceRuleId architecture).
    if (!rule.sourceRuleId && !rule.condition) {
      return {
        ok: false,
        errors: [
          `Rule "${rule.label}" has no condition source. ` +
          `Set sourceRuleId (e.g. "template:christmas" or a StoredRule id) ` +
          `or provide an inline condition.`,
        ],
      };
    }
  }

  const updatedDesign: TenantDesignSettings = {
    ...current.design,
    themeRules: config,
  };

  const updated: TenantSettings = { ...current, design: updatedDesign };
  const saveResult = await saveTenant(updated);

  if (!saveResult.ok) {
    return { ok: false, errors: [saveResult.error] };
  }

  // Clear the session theme lock so the next page load re-evaluates rules.
  try {
    const { clearThemeSessionCookie } =
      await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch {
    // Non-critical: if clearing the cookie fails, the old theme persists
    // until the cookie naturally expires (4 hours).
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/design`);

  return { ok: true };
}

// ── addThemeMappingAction ──────────────────────────────────────────────────────

/**
 * Human-readable labels for built-in theme condition templates.
 * Mirrors the keys of BUILTIN_THEME_CONDITION_MAP.
 */
const BUILTIN_TEMPLATE_LABELS: Readonly<Record<string, string>> = {
  "christmas":    "Christmas season",
  "valentines":   "Valentine's Day",
  "halloween":    "Halloween",
  "new-year":     "New Year",
  "black-friday": "Black Friday / Cyber Monday",
  "night":        "Night time",
  "evening":      "Evening",
  "morning":      "Morning",
  "day":          "Daytime",
  "weekend":      "Weekend",
  "any-campaign": "Any UTM campaign",
  "mobile":       "Mobile visitors",
};

/**
 * Add (or update) a theme mapping.
 *
 * `source` format:
 *   "rule:<ruleId>"         — patches plan.themeKey on an existing StoredRule
 *   "builtin:<templateId>"  — finds or creates a StoredRule with ID
 *                             `theme.builtin.<templateId>` using the
 *                             corresponding BUILTIN_THEME_CONDITION_MAP entry
 *
 * Returns the created / updated rule's id, label, priority, and enabled state
 * so the client can update its optimistic state without a full refetch.
 */
export async function addThemeMappingAction(
  tenantId: string,
  source:   string,
  themeKey: import("@/design-system/theme/presets").ThemePresetKey | null,
  themePresetId?: string | null,
): Promise<{
  ok:     boolean;
  rule?:  { id: string; label: string; priority: number; enabled: boolean };
  errors?: string[];
}> {
  if (!tenantId || !source || (!themeKey && !themePresetId)) {
    return { ok: false, errors: ["tenantId, source, and a theme (curated or gallery) are required."] };
  }

  // Validate the theme outcome — a curated key or a gallery preset id.
  if (themePresetId) {
    const { getDesignPreset } = await import("@/tenant/design-presets-gallery");
    if (!getDesignPreset(themePresetId)) return { ok: false, errors: [`Unknown gallery preset: "${themePresetId}".`] };
  } else {
    const { isThemePresetKey } =
      await import("@/design-system/theme/presets") as
        typeof import("@/design-system/theme/presets");
    if (!isThemePresetKey(themeKey!)) return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
  }
  // Plan theme fields (one of themeKey / themePresetId); used at every build site.
  const themeFields = themePresetId ? { themePresetId } : { themeKey: themeKey! };
  // For updates: clear any prior theme outcome before setting the chosen one.
  const clearedPlan = (p: import("@/decision/rules/stored-rule").StoredPlan): import("@/decision/rules/stored-rule").StoredPlan => {
    const c = { ...p }; delete c.themeKey; delete c.themePresetId; return c;
  };

  const { getTenantRulesAction, saveTenantRulesAction } =
    await import("@/app/admin/tenants/[tenantId]/rules/actions") as
      typeof import("@/app/admin/tenants/[tenantId]/rules/actions");

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) {
    return { ok: false, errors: [`Failed to load rules: ${current.error}`] };
  }

  let updatedRules: StoredRule[];
  let targetRule:   StoredRule;

  if (source.startsWith("rule:")) {
    // ── Existing StoredRule ────────────────────────────────────────────────────
    const ruleId  = source.slice(5);
    const existing = current.config.rules.find((r) => r.id === ruleId);
    if (!existing) {
      return { ok: false, errors: [`Rule "${ruleId}" not found.`] };
    }
    targetRule   = { ...existing, plan: { ...clearedPlan(existing.plan), ...themeFields } };
    updatedRules = current.config.rules.map((r) => r.id === ruleId ? targetRule : r);

  } else if (source.startsWith("builtin:")) {
    // ── Built-in template ──────────────────────────────────────────────────────
    const templateId = source.slice(8);
    const condition  = BUILTIN_THEME_CONDITION_MAP[templateId];
    if (!condition) {
      return { ok: false, errors: [`Unknown built-in template: "${templateId}".`] };
    }

    const builtinId = `theme.builtin.${templateId}`;
    const existing  = current.config.rules.find((r) => r.id === builtinId);

    if (existing) {
      // Update themeKey on the existing rule
      targetRule   = { ...existing, plan: { ...clearedPlan(existing.plan), ...themeFields } };
      updatedRules = current.config.rules.map((r) => r.id === builtinId ? targetRule : r);
    } else {
      // Create a new StoredRule for this built-in condition.
      // Find a conflict-free priority: start from the canonical default and
      // increment until we find a slot not occupied by another rule.
      const desiredPriority = BUILTIN_THEME_PRIORITY_MAP[templateId] ?? 50;
      const usedPriorities  = new Set(current.config.rules.map((r) => r.priority));
      let priority = desiredPriority;
      while (usedPriorities.has(priority)) priority++;

      const dp = current.config.defaultPlan;
      targetRule = {
        id:        builtinId,
        label:     BUILTIN_TEMPLATE_LABELS[templateId] ?? templateId,
        condition,
        plan:      {
          heroKey:  dp.heroKey,
          proofKey: dp.proofKey,
          ctaKey:   dp.ctaKey,
          ...themeFields,
        },
        priority,
        reason:    `Auto-created built-in theme mapping for "${templateId}"`,
        enabled:   true,
      };
      updatedRules = [...current.config.rules, targetRule];
    }

  } else {
    return { ok: false, errors: [`Unknown source format: "${source}". Expected "rule:<id>" or "builtin:<templateId>".`] };
  }

  const updatedConfig = { ...current.config, rules: updatedRules };
  const saveResult    = await saveTenantRulesAction(tenantId, updatedConfig);

  if (!saveResult.ok) {
    const errs: string[] =
      "fieldErrors" in saveResult && saveResult.fieldErrors
        ? saveResult.fieldErrors
        : [saveResult.error];
    return { ok: false, errors: errs };
  }

  // Clear the session theme lock so the next page load re-evaluates rules.
  try {
    const { clearThemeSessionCookie } =
      await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch {
    // Non-critical
  }

  revalidatePath(`/admin/tenants/${tenantId}/design`);

  return {
    ok:   true,
    rule: {
      id:      targetRule.id,
      label:   targetRule.label,
      priority: targetRule.priority,
      enabled: targetRule.enabled !== false,
    },
  };
}

// ── removeThemeMappingAction ───────────────────────────────────────────────────

/**
 * Remove a theme override from a rule (clears plan.themeKey).
 * Built-in auto-created rules (id starts with "theme.builtin.") are left in
 * place with no themeKey; they participate in variant decisions but no longer
 * affect the theme.
 */
export async function removeThemeMappingAction(
  tenantId: string,
  ruleId:   string,
): Promise<{ ok: boolean; errors?: string[] }> {
  return saveRuleThemeKeyAction(tenantId, ruleId, null);
}

// ── setThemeMappingEnabledAction ───────────────────────────────────────────────

/**
 * Enable or disable a rule (sets StoredRule.enabled).
 * This affects both variant-slot decisions AND theme decisions for the rule.
 */
export async function setThemeMappingEnabledAction(
  tenantId: string,
  ruleId:   string,
  enabled:  boolean,
): Promise<{ ok: boolean; errors?: string[] }> {
  if (!tenantId || !ruleId) {
    return { ok: false, errors: ["tenantId and ruleId are required."] };
  }

  const { getTenantRulesAction, saveTenantRulesAction } =
    await import("@/app/admin/tenants/[tenantId]/rules/actions") as
      typeof import("@/app/admin/tenants/[tenantId]/rules/actions");

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) {
    return { ok: false, errors: [`Failed to load rules: ${current.error}`] };
  }

  const rule = current.config.rules.find((r) => r.id === ruleId);
  if (!rule) {
    return { ok: false, errors: [`Rule "${ruleId}" not found.`] };
  }

  const updatedRules  = current.config.rules.map((r) =>
    r.id === ruleId ? { ...r, enabled } : r,
  );
  const updatedConfig = { ...current.config, rules: updatedRules };
  const saveResult    = await saveTenantRulesAction(tenantId, updatedConfig);

  if (!saveResult.ok) {
    const errs: string[] =
      "fieldErrors" in saveResult && saveResult.fieldErrors
        ? saveResult.fieldErrors
        : [saveResult.error];
    return { ok: false, errors: errs };
  }

  // Clear the session theme lock so the next page load re-evaluates.
  try {
    const { clearThemeSessionCookie } =
      await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch {
    // Non-critical
  }

  revalidatePath(`/admin/tenants/${tenantId}/design`);

  return { ok: true };
}

// ── addContextLibraryThemeMappingAction ───────────────────────────────────────

/**
 * Create a new theme mapping whose condition is based on the Context Library
 * (audience-profile matching) rather than raw field predicates.
 *
 * ─── Two trigger modes ────────────────────────────────────────────────────────
 *
 *   "context_match":
 *     Condition is a ContextLibraryCondition { type:"context_library", contextIds, minConfidence }.
 *     Rule fires when the visitor matches ANY of the referenced audience profiles
 *     with confidence ≥ minConfidence.
 *
 *   "context_plus_condition":
 *     When extraCondition is set, wraps both parts in a GroupCondition { logic:"and" }.
 *     Rule fires only when BOTH the context library part AND the extra condition match.
 *
 * ─── Parameters ───────────────────────────────────────────────────────────────
 *
 *   contextIds      — IDs of ContextDefinitions from context/library/definitions.ts
 *   minConfidence   — 0–1 threshold; visitor must score ≥ this on the definition
 *   themeKey        — theme preset to apply when the rule fires
 *   label           — human-readable rule name shown in admin UI and debug panel
 *   priority        — evaluation order (lower = higher precedence); defaults to 80
 *   extraCondition  — optional raw condition to AND with the context match
 */
export async function addContextLibraryThemeMappingAction(
  tenantId: string,
  params: {
    contextIds:      string[];
    minConfidence:   number;
    themeKey?:       import("@/design-system/theme/presets").ThemePresetKey | null;
    themePresetId?:  string | null;
    label:           string;
    priority?:       number;
    extraCondition?: import("@/decision/rules/stored-rule").RuleCondition;
  },
): Promise<{
  ok:     boolean;
  rule?:  { id: string; label: string; priority: number; enabled: boolean };
  errors?: string[];
}> {
  const { contextIds, minConfidence, themeKey, themePresetId, label, extraCondition } = params;
  const priority = params.priority ?? 80;

  if (!tenantId) return { ok: false, errors: ["tenantId is required."] };
  if (!contextIds || contextIds.length === 0)
    return { ok: false, errors: ["At least one contextId is required."] };
  if (!themeKey && !themePresetId) return { ok: false, errors: ["A theme (curated or gallery) is required."] };
  if (!label?.trim()) return { ok: false, errors: ["label is required."] };

  if (themePresetId) {
    const { getDesignPreset } = await import("@/tenant/design-presets-gallery");
    if (!getDesignPreset(themePresetId)) return { ok: false, errors: [`Unknown gallery preset: "${themePresetId}".`] };
  } else {
    const { isThemePresetKey } =
      await import("@/design-system/theme/presets") as
        typeof import("@/design-system/theme/presets");
    if (!isThemePresetKey(themeKey!)) return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
  }
  const themeFields = themePresetId ? { themePresetId } : { themeKey: themeKey! };

  const { getTenantRulesAction, saveTenantRulesAction } =
    await import("@/app/admin/tenants/[tenantId]/rules/actions") as
      typeof import("@/app/admin/tenants/[tenantId]/rules/actions");

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) {
    return { ok: false, errors: [`Failed to load rules: ${current.error}`] };
  }

  // Derive a stable rule ID from the context IDs
  const idSuffix = contextIds.slice(0, 3).join("_").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  const baseId   = `theme.ctx.${idSuffix}`;

  // Find a conflict-free ID
  const existingIds = new Set(current.config.rules.map((r) => r.id));
  let ruleId  = baseId;
  let counter = 2;
  while (existingIds.has(ruleId)) ruleId = `${baseId}_${counter++}`;

  // Find a conflict-free priority
  const usedPriorities = new Set(current.config.rules.map((r) => r.priority));
  let effectivePriority = priority;
  while (usedPriorities.has(effectivePriority)) effectivePriority++;

  // Build the condition
  const libCondition: import("@/decision/rules/stored-rule").ContextLibraryCondition = {
    type:          "context_library",
    contextIds:    contextIds as readonly string[],
    minConfidence: Math.max(0, Math.min(1, minConfidence)),
  };

  const condition: import("@/decision/rules/stored-rule").RuleCondition = extraCondition
    ? { type: "group", logic: "and", conditions: [libCondition, extraCondition] }
    : libCondition;

  const dp = current.config.defaultPlan;
  const targetRule: StoredRule = {
    id:        ruleId,
    label:     label.trim(),
    condition,
    plan:      { heroKey: dp.heroKey, proofKey: dp.proofKey, ctaKey: dp.ctaKey, ...themeFields },
    priority:  effectivePriority,
    reason:    `Context Library theme mapping for: ${contextIds.join(", ")}`,
    enabled:   true,
  };

  const updatedConfig = { ...current.config, rules: [...current.config.rules, targetRule] };
  const saveResult    = await saveTenantRulesAction(tenantId, updatedConfig);

  if (!saveResult.ok) {
    const errs: string[] =
      "fieldErrors" in saveResult && saveResult.fieldErrors
        ? saveResult.fieldErrors
        : [saveResult.error];
    return { ok: false, errors: errs };
  }

  // Clear the session theme lock so the next page load re-evaluates rules.
  try {
    const { clearThemeSessionCookie } =
      await import("@/lib/theme-session") as typeof import("@/lib/theme-session");
    const cookieStore = await cookies();
    clearThemeSessionCookie(cookieStore as Parameters<typeof clearThemeSessionCookie>[0]);
  } catch { /* Non-critical */ }

  revalidatePath(`/admin/tenants/${tenantId}/design`);

  return {
    ok:   true,
    rule: {
      id:       targetRule.id,
      label:    targetRule.label,
      priority: targetRule.priority,
      enabled:  targetRule.enabled !== false,
    },
  };
}

// ── Delete tenant ─────────────────────────────────────────────────────────────

/**
 * Permanently deletes a tenant and all associated data.
 *
 * Super-admin only.  Removes (in order):
 *   1. subscriptions          — billing rows for the tenant
 *   2. Orphaned admin_users   — non-superadmin users whose ONLY tenant is this one
 *                               (frees their email so they can re-register later)
 *   3. admin_user_tenants     — junction rows linking admins to this tenant
 *   4. tenant_settings        — the tenant record itself
 *
 * After deletion, revalidates the tenant list cache and redirects the caller
 * to /admin/tenants.
 *
 * NOTE: This does NOT cancel the Stripe subscription — the admin should do
 * that manually in the Stripe Dashboard first if needed.
 */
export async function deleteTenantAction(tenantId: string): Promise<{ error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) {
    return { error: "Only super-admins can delete tenants." };
  }

  if (!tenantId) return { error: "Tenant ID is required." };

  const db = getDb();

  // 1. Remove billing rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: subErr } = await (db as any)
    .from("subscriptions")
    .delete()
    .eq("tenant_id", tenantId);

  if (subErr) {
    console.error("[deleteTenantAction] subscriptions delete error:", subErr.message);
    return { error: `Failed to remove billing data: ${subErr.message}` };
  }

  // 2. Find and delete orphaned admin users — non-superadmins whose only tenant
  //    is this one.  Deleting them frees their email address so the same person
  //    can re-register through the checkout flow later.
  try {
    // 2a. Get all user IDs currently assigned to this tenant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignedRows } = await (db as any)
      .from("admin_user_tenants")
      .select("user_id")
      .eq("tenant_id", tenantId);

    const assignedIds: string[] = (assignedRows ?? []).map((r: { user_id: string }) => r.user_id);

    if (assignedIds.length > 0) {
      // 2b. Fetch their roles — skip superadmins (they may have access to many tenants).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRows } = await (db as any)
        .from("admin_users")
        .select("id, role")
        .in("id", assignedIds)
        .not("role", "in", '("superadmin","admin")');

      const tenantAdminIds: string[] = (userRows ?? []).map((r: { id: string }) => r.id);

      if (tenantAdminIds.length > 0) {
        // 2c. Among those tenant admins, find ones that belong ONLY to this tenant
        //    (i.e. they have exactly 1 assignment row).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: otherAssignments } = await (db as any)
          .from("admin_user_tenants")
          .select("user_id")
          .in("user_id", tenantAdminIds)
          .neq("tenant_id", tenantId);

        const hasOtherTenants = new Set(
          (otherAssignments ?? []).map((r: { user_id: string }) => r.user_id),
        );

        const orphanIds = tenantAdminIds.filter((id) => !hasOtherTenants.has(id));

        if (orphanIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: userDelErr } = await (db as any)
            .from("admin_users")
            .delete()
            .in("id", orphanIds);

          if (userDelErr) {
            console.error("[deleteTenantAction] admin_users delete error:", userDelErr.message);
            // Non-fatal: log and continue — the tenant data will still be removed.
          } else {
            console.log(`[deleteTenantAction] Deleted ${orphanIds.length} orphaned user(s) for tenant ${tenantId}`);
          }
        }
      }
    }
  } catch (err) {
    rethrowNextInternal(err);
    // Non-fatal: log and continue — the core tenant deletion still proceeds.
    console.error("[deleteTenantAction] orphan user cleanup error:", err);
  }

  // 3. Remove admin ↔ tenant links
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: autErr } = await (db as any)
    .from("admin_user_tenants")
    .delete()
    .eq("tenant_id", tenantId);

  if (autErr) {
    console.error("[deleteTenantAction] admin_user_tenants delete error:", autErr.message);
    return { error: `Failed to remove user associations: ${autErr.message}` };
  }

  // 4. Remove the tenant settings record itself
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tsErr } = await (db as any)
    .from("tenant_settings")
    .delete()
    .eq("tenant_id", tenantId);

  if (tsErr) {
    console.error("[deleteTenantAction] tenant_settings delete error:", tsErr.message);
    return { error: `Failed to delete tenant: ${tsErr.message}` };
  }

  revalidatePath("/admin/tenants");

  // Redirect to the tenant list — this throws internally so we return after.
  redirect("/admin/tenants");

  // Unreachable, but satisfies the return type for the error branch.
  return { error: "" };
}

// ── Statamic blueprint sync ────────────────────────────────────────────────────

/**
 * Result returned by syncStatamicBlueprintAction.
 */
export type SyncBlueprintResult =
  | { ok: true;  path: string; contextBlocks: number; contentBlocks: number; fieldsetsCount: number; sitesCount: number }
  | { ok: false; error: string };

/**
 * Generate and write the Statamic `pages.yaml` blueprint for a tenant.
 *
 * Reads the tenant's `blocks.context` and `blocks.content` settings, runs them
 * through the blueprint generator, and writes the YAML to:
 *
 *   `$STATAMIC_CMS_PATH/resources/blueprints/collections/pages/pages.yaml`
 *
 * ─── Requirements ─────────────────────────────────────────────────────────────
 *
 *   - The `STATAMIC_CMS_PATH` environment variable must be set and point to the
 *     Statamic installation root on the file system.
 *   - The tenant must exist and have a blocks configuration.
 *   - The write operation is synchronous and must complete before the action
 *     resolves — no background queue.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   Safe to call multiple times.  Each call overwrites the previous blueprint.
 *   The Statamic CP re-reads blueprints from disk on each request, so the new
 *   blueprint is effective immediately after this action completes.
 *
 * @param tenantId  The tenant whose block settings drive the blueprint.
 */
export async function syncStatamicBlueprintAction(
  tenantId: string,
): Promise<SyncBlueprintResult> {
  try {
    // ── 1. Resolve STATAMIC_CMS_PATH ─────────────────────────────────────────
    const cmsFsPath = process.env.STATAMIC_CMS_PATH?.trim();
    if (!cmsFsPath) {
      return {
        ok:    false,
        error: "STATAMIC_CMS_PATH is not configured. " +
               "Set it in your .env.local to the absolute path of the Statamic installation.",
      };
    }

    // ── 2. Load tenant ────────────────────────────────────────────────────────
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return { ok: false, error: `Tenant "${tenantId}" not found.` };
    }

    const contextBlocks = tenant.blocks?.context ?? [];
    const contentBlocks = tenant.blocks?.content ?? [];

    // ── 3. Generate blueprint + sites YAML ───────────────────────────────────
    const { generatePagesBlueprintYaml, generateSitesYaml } = await import(
      "@/cms/schemas/statamic/blueprint-generator"
    ) as typeof import("@/cms/schemas/statamic/blueprint-generator");

    const yamlContent = generatePagesBlueprintYaml(contextBlocks, contentBlocks);
    const languages   = tenant.languages ?? [];
    const sitesYaml   = languages.length > 0 ? generateSitesYaml(languages) : null;

    // ── 4. Write to disk ──────────────────────────────────────────────────────
    const { promises: fs, existsSync } = await import("fs") as typeof import("fs");
    const path = await import("path") as typeof import("path");

    const blueprintDir  = path.join(
      path.resolve(process.cwd(), cmsFsPath),
      "resources",
      "blueprints",
      "collections",
      "pages",
    );
    const blueprintPath = path.join(blueprintDir, "pages.yaml");

    // Ensure the directory exists (it should already, but be safe)
    if (!existsSync(blueprintDir)) {
      await fs.mkdir(blueprintDir, { recursive: true });
    }

    await fs.writeFile(blueprintPath, yamlContent, "utf8");

    // ── 4b. Write sites.yaml when languages are configured ────────────────────
    let sitesCount = 0;
    if (sitesYaml) {
      const resourcesDir = path.join(path.resolve(process.cwd(), cmsFsPath), "resources");
      if (!existsSync(resourcesDir)) {
        await fs.mkdir(resourcesDir, { recursive: true });
      }
      await fs.writeFile(path.join(resourcesDir, "sites.yaml"), sitesYaml, "utf8");
      sitesCount = languages.length;
    }

    // ── 5. Sync platform files (fieldsets + blueprints) ───────────────────────
    //
    // Copies all platform-managed files to the tenant's Statamic instance.
    // Always overwritten — these files are platform-managed and must stay in
    // sync with the codebase.  Three categories:
    //   a) mrc_*.yaml fieldsets  → resources/fieldsets/
    //   b) globals blueprints    → resources/blueprints/globals/
    //   c) taxonomy blueprints   → resources/blueprints/taxonomies/
    let fieldsetsCount = 0;

    const platformRoot = path.resolve(
      process.cwd(),
      "mister-chameleon-cms",
      "mister-chameleon-cms",
    );
    const absRoot = path.resolve(process.cwd(), cmsFsPath);

    // ── a) mrc_* fieldsets ─────────────────────────────────────────────────
    const platformFieldsetsDir = path.join(platformRoot, "resources", "fieldsets");
    const tenantFieldsetsDir   = path.join(absRoot, "resources", "fieldsets");

    if (existsSync(platformFieldsetsDir)) {
      const allFiles = await fs.readdir(platformFieldsetsDir);
      const mrcFiles = allFiles.filter((f) => f.startsWith("mrc_") && f.endsWith(".yaml"));

      if (mrcFiles.length > 0) {
        if (!existsSync(tenantFieldsetsDir)) {
          await fs.mkdir(tenantFieldsetsDir, { recursive: true });
        }
        for (const filename of mrcFiles) {
          await fs.copyFile(
            path.join(platformFieldsetsDir, filename),
            path.join(tenantFieldsetsDir, filename),
          );
        }
        fieldsetsCount += mrcFiles.length;
      }
    }

    // ── b) Globals blueprints ──────────────────────────────────────────────
    const platformGlobalsBpDir = path.join(platformRoot, "resources", "blueprints", "globals");
    const tenantGlobalsBpDir   = path.join(absRoot, "resources", "blueprints", "globals");

    if (existsSync(platformGlobalsBpDir)) {
      const allFiles = await fs.readdir(platformGlobalsBpDir);
      const yamlFiles = allFiles.filter((f) => f.endsWith(".yaml"));
      if (yamlFiles.length > 0) {
        if (!existsSync(tenantGlobalsBpDir)) {
          await fs.mkdir(tenantGlobalsBpDir, { recursive: true });
        }
        for (const filename of yamlFiles) {
          await fs.copyFile(
            path.join(platformGlobalsBpDir, filename),
            path.join(tenantGlobalsBpDir, filename),
          );
        }
        fieldsetsCount += yamlFiles.length;
      }
    }

    // ── c) Taxonomy blueprints ─────────────────────────────────────────────
    const platformTaxBpDir = path.join(platformRoot, "resources", "blueprints", "taxonomies");
    const tenantTaxBpDir   = path.join(absRoot, "resources", "blueprints", "taxonomies");

    if (existsSync(platformTaxBpDir)) {
      const allFiles = await fs.readdir(platformTaxBpDir);
      const yamlFiles = allFiles.filter((f) => f.endsWith(".yaml"));
      if (yamlFiles.length > 0) {
        if (!existsSync(tenantTaxBpDir)) {
          await fs.mkdir(tenantTaxBpDir, { recursive: true });
        }
        for (const filename of yamlFiles) {
          await fs.copyFile(
            path.join(platformTaxBpDir, filename),
            path.join(tenantTaxBpDir, filename),
          );
        }
        fieldsetsCount += yamlFiles.length;
      }
    }

    return {
      ok:            true,
      path:          blueprintPath,
      contextBlocks: contextBlocks.length,
      contentBlocks: contentBlocks.length,
      fieldsetsCount,
      sitesCount,
    };
  } catch (err) {
    rethrowNextInternal(err);
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Statamic Forge deployment ──────────────────────────────────────────────────

/**
 * Deploy a new Statamic site on Laravel Forge for a given tenant.
 *
 * Orchestrates the full end-to-end flow:
 *   1. Create Forge site (on the platform server or the supplied override)
 *   2. Install git repository (mister-chameleon-cms starter branch)
 *   3. Trigger first deployment and wait for it to finish
 *   4. Push .env (APP_URL, STATAMIC_API_ENABLED, unique API token, …)
 *   5. Run artisan key:generate
 *   6. Store statamicBaseUrl + writeToken in tenant settings
 *   7. Run provisionSite to seed blueprints, navigation, and globals
 *
 * ─── Long-running ────────────────────────────────────────────────────────────
 *
 *   Forge deployments typically take 2–5 minutes.  On serverless hosts (Vercel)
 *   the function timeout must be ≥ 300 s.  Add `export const maxDuration = 300`
 *   to the route segment config in the page that calls this action.
 *   In a future iteration this should be moved to a background job or webhook.
 *
 * @param tenantId  The tenant to deploy for.
 * @param domain    The domain / hostname for the new Statamic site (e.g. cms.client.nl).
 * @param serverId  Optional Forge server ID override; falls back to platform default.
 */
export async function deployStatamicSiteAction(
  tenantId: string,
  domain:   string,
  serverId?: number,
): Promise<DeployStatamicResult> {
  const completedSteps: DeployStatamicStep[] = [];

  function step(name: string): {
    ok:   (msg?: string) => void;
    warn: (msg: string) => void;
    fail: (msg: string) => DeployStatamicResult;
  } {
    return {
      ok:   (msg?: string) => completedSteps.push({ step: name, status: "ok",   message: msg }),
      warn: (msg: string)  => completedSteps.push({ step: name, status: "warn", message: msg }),
      fail: (msg: string): DeployStatamicResult => {
        completedSteps.push({ step: name, status: "failed", message: msg });
        return { ok: false, error: msg, failedStep: name, completedSteps };
      },
    };
  }

  try {
    // ── 0. Load dependencies ─────────────────────────────────────────────────
    const { ForgeClient, ForgeClientError } = await import("@/lib/forge/forge-client");
    const { getPlatformForgeSettings }      = await import("@/platform/platform-store");

    // ── 1. Load tenant ───────────────────────────────────────────────────────
    const s1 = step("Load tenant");
    const tenant = await getTenantById(tenantId);
    if (!tenant) return s1.fail(`Tenant "${tenantId}" not found.`);
    s1.ok();

    // ── 2. Load Forge settings ───────────────────────────────────────────────
    const s2 = step("Load Forge settings");
    const forgeResult = await getPlatformForgeSettings();
    if (!forgeResult.ok) return s2.fail(`Could not load Forge settings: ${forgeResult.error}`);

    const { apiKey, defaultServerId, gitRepository, gitBranch, phpVersion } = forgeResult.data;
    const resolvedApiKey = apiKey ?? process.env["FORGE_API_TOKEN"] ?? "";
    if (!resolvedApiKey) return s2.fail("No Forge API token configured. Configure it at Platform → Integrations → Forge.");
    if (!gitRepository)  return s2.fail("No git repository configured. Set it at Platform → Integrations → Forge.");

    const resolvedBranch     = gitBranch  ?? "starter";
    const resolvedPhpVersion = phpVersion ?? "php82";
    const resolvedServerId   = serverId   ?? defaultServerId;
    if (!resolvedServerId) return s2.fail("No Forge server ID configured. Set a default server ID at Platform → Integrations → Forge, or supply one when deploying.");
    s2.ok(`Server ${resolvedServerId}, repo ${gitRepository}@${resolvedBranch}`);

    const forge = new ForgeClient(resolvedApiKey);

    // ── 3. Create Forge site ─────────────────────────────────────────────────
    const s3 = step("Create Forge site");
    let site;
    try {
      site = await forge.createSite(resolvedServerId, {
        domain,
        project_type: "php",
        directory:    "/public",
        php_version:  resolvedPhpVersion,
      });
      s3.ok(`Site #${site.id} created`);
    } catch (err) {
      return s3.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    const forgeSiteId = site.id;

    // ── 4. Wait for site to be installed ────────────────────────────────────
    const s4 = step("Wait for site installation");
    try {
      await forge.waitForSiteInstalled(resolvedServerId, forgeSiteId, 120_000);
      s4.ok();
    } catch (err) {
      return s4.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    // ── 5. Install git repository ────────────────────────────────────────────
    const s5 = step("Install git repository");
    try {
      await forge.installGit(resolvedServerId, forgeSiteId, {
        provider:   "github",
        repository: gitRepository,
        branch:     resolvedBranch,
        composer:   true,
      });
      s5.ok(`${gitRepository}@${resolvedBranch}`);
    } catch (err) {
      return s5.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    // ── 6. Trigger first deployment ──────────────────────────────────────────
    const s6 = step("Deploy");
    try {
      await forge.deploy(resolvedServerId, forgeSiteId);
      await forge.pollDeployment(resolvedServerId, forgeSiteId, 300_000);
      s6.ok("First deployment finished");
    } catch (err) {
      return s6.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    // ── 7. Push .env variables ───────────────────────────────────────────────
    const s7 = step("Configure .env");
    const apiToken = crypto.randomUUID().replace(/-/g, "");
    try {
      const currentEnv = await forge.getEnv(resolvedServerId, forgeSiteId);
      const updatedEnv = patchEnvVars(currentEnv, {
        APP_URL:               `https://${domain}`,
        APP_ENV:               "production",
        STATAMIC_API_ENABLED:  "true",
        // Statamic navigations + structures are a Pro feature. Without this the
        // /api/navs/{handle}/tree endpoint 404s → the site renders no navigation.
        STATAMIC_PRO_ENABLED:  "true",
        STATAMIC_API_TOKEN:    apiToken,
      });
      await forge.updateEnv(resolvedServerId, forgeSiteId, updatedEnv);
      s7.ok("APP_URL, STATAMIC_API_ENABLED, STATAMIC_PRO_ENABLED, STATAMIC_API_TOKEN set");
    } catch (err) {
      return s7.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    // ── 8. artisan key:generate ──────────────────────────────────────────────
    const s8 = step("Generate app key");
    try {
      const cmd = await forge.runCommand(resolvedServerId, forgeSiteId, "php artisan key:generate --force");
      await forge.pollCommand(resolvedServerId, forgeSiteId, cmd.id, 60_000);
      s8.ok();
    } catch (err) {
      // Non-fatal — warn rather than fail (key may already exist)
      s8.warn(`artisan key:generate failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── 9. Run final deploy to pick up new .env ──────────────────────────────
    const s9 = step("Re-deploy with new .env");
    try {
      await forge.deploy(resolvedServerId, forgeSiteId);
      await forge.pollDeployment(resolvedServerId, forgeSiteId, 300_000);
      s9.ok();
    } catch (err) {
      return s9.fail(err instanceof ForgeClientError ? err.message : String(err));
    }

    // ── 10. Persist Statamic URL + token in tenant settings ─────────────────
    const s10 = step("Save tenant settings");
    const siteUrl = `https://${domain}`;
    try {
      const updatedCms: TenantCmsSettings = {
        ...tenant.cms,
        provider:          "statamic",
        statamicBaseUrl:   siteUrl,
        writeToken:        apiToken,
      };
      const updatedTenant = { ...tenant, cms: updatedCms };
      const saveResult    = await saveTenant(updatedTenant);
      if (!saveResult.ok) return s10.fail(`Could not save tenant: ${saveResult.error}`);
      s10.ok(`statamicBaseUrl = ${siteUrl}`);
    } catch (err) {
      return s10.fail(err instanceof Error ? err.message : String(err));
    }

    // ── 11. Run provisionSite to seed CMS structure ──────────────────────────
    const s11 = step("Initialize CMS (provision site)");
    try {
      const { StatamicProvider } = await import("@/cms/providers/statamic-provider");
      const { StatamicClient }   = await import("@/cms/providers/statamic-client");
      const client   = new StatamicClient(siteUrl, apiToken);
      const reloaded = await getTenantById(tenantId);
      if (reloaded) {
        const provResult = await new StatamicProvider(client).provisionSite(reloaded);
        if (provResult.ok) {
          s11.ok(`${provResult.navItemsWritten ?? 0} nav items, blueprint synced`);
        } else {
          s11.warn(`Provision completed with warnings: ${provResult.error}`);
        }
      } else {
        s11.warn("Could not reload tenant for provision step");
      }
    } catch (err) {
      // Non-fatal — the site is deployed; seeding can be re-run via Initialize site
      s11.warn(`CMS initialization failed (re-run via Initialize site): ${err instanceof Error ? err.message : String(err)}`);
    }

    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath("/admin/tenants");

    return {
      ok:            true,
      siteUrl,
      forgeServerId: resolvedServerId,
      forgeSiteId,
      steps:         completedSteps,
      warnings:      completedSteps
        .filter((s) => s.status === "warn")
        .map((s) => `${s.step}: ${s.message ?? ""}`),
    };

  } catch (err) {
    rethrowNextInternal(err);
    return {
      ok:             false,
      error:          err instanceof Error ? err.message : String(err),
      completedSteps,
    };
  }
}

/**
 * Patch environment variables in a .env file string.
 * Sets existing keys in-place and appends missing keys at the end.
 */
function patchEnvVars(
  content: string,
  vars:    Record<string, string>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line  = `${key}=${value}`;
    if (regex.test(result)) {
      result = result.replace(regex, line);
    } else {
      result = result.trimEnd() + "\n" + line + "\n";
    }
  }
  return result;
}

// ── Per-tenant CMS deploy (Statamic / Ploi webhook) ───────────────────────────

/**
 * Save this tenant's Ploi deploy webhook URL. Empty string clears it.
 * Each Statamic instance has its own webhook, so this is stored per tenant.
 */
export async function saveTenantDeployHookAction(
  tenantId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  await getRequiredAdminSession();
  try {
    const url = String(formData.get("cmsDeployHookUrl") ?? "").trim();
    if (url && !/^https:\/\/.+/i.test(url)) {
      return { ok: false, error: "Enter a valid https:// deploy webhook URL (or leave empty to clear)." };
    }
    const tenant = await getTenantById(tenantId);
    if (!tenant) return { ok: false, error: `Tenant '${tenantId}' not found.` };

    const next: TenantSettings = {
      ...tenant,
      deploy: { ...tenant.deploy, cmsDeployHookUrl: url || undefined },
    };
    const result = await saveTenant(next);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/admin/tenants/${tenantId}/setup`);
    return { ok: true, detail: url ? "Deploy webhook saved." : "Deploy webhook cleared." };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Trigger a redeploy of this tenant's Statamic instance via its Ploi deploy
 * webhook (git pull + composer install + `php please mc:sync` + cache clear).
 */
export async function triggerTenantCmsDeployAction(
  tenantId: string,
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  await getRequiredAdminSession();
  try {
    const tenant = await getTenantById(tenantId);
    const url = tenant?.deploy?.cmsDeployHookUrl?.trim();
    if (!url) {
      return { ok: false, error: "No deploy webhook configured for this tenant. Add the Ploi deploy webhook URL first." };
    }
    const res = await fetch(url, { method: "POST", cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Deploy webhook returned HTTP ${res.status}.` };
    return {
      ok: true,
      detail: "CMS deploy triggered on Ploi (git pull + composer install + php please mc:sync). Give it a minute.",
    };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Provision a brand-new Statamic CMS instance for this tenant, fully automated:
 *   Fase 1 — generate a per-tenant GitHub repo from the template (complete copy,
 *            incl. committed fieldsets), then
 *   Fase 2 — create the Ploi Cloud application (IaC apply) pointing at that repo.
 *
 * Requires a GitHub token (platform GitHub settings or env GITHUB_TOKEN) and a
 * Ploi Cloud API token (platform Ploi settings or env PLOI_CLOUD_TOKEN).
 *
 * `dryRun` (Ploi side) lets the operator preview without creating the app; the
 * GitHub repo is still generated (it's the prerequisite and is idempotent).
 */
export async function provisionTenantCmsAction(
  tenantId: string,
  opts?: { dryRun?: boolean; domain?: string },
): Promise<{
  ok: boolean;
  error?: string;
  detail?: string;
  repoUrl?: string;
  appName?: string;
  changes?: string[];
}> {
  await getRequiredAdminSession();
  try {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return { ok: false, error: `Tenant '${tenantId}' not found.` };

    const siteKey = tenant.snippet?.siteKey;
    if (!siteKey) {
      return { ok: false, error: "Tenant has no siteKey yet. Generate one on the Snippet tab first." };
    }

    const {
      getPlatformGithubSettings, githubFlags, resolveGithubToken,
      getPlatformPloiSettings, ploiFlags, resolvePloiToken,
    } = await import("@/platform/platform-store");
    const {
      generateRepoFromTemplate, seedNeutralContentIntoRepo, buildStatamicInfraYaml, applyPloiInfrastructure, provisioningSlug,
      buildContentOverlayCommands, buildIndexRefreshCommands,
    } = await import("@/lib/provisioning/cms-provisioner");

    const ghResult = await getPlatformGithubSettings();
    if (!ghResult.ok) return { ok: false, error: ghResult.error };
    const ploiResult = await getPlatformPloiSettings();
    if (!ploiResult.ok) return { ok: false, error: ploiResult.error };

    const gh    = githubFlags(ghResult.data);
    const ploi  = ploiFlags(ploiResult.data);
    const ghTok = resolveGithubToken(ghResult.data);
    const ploiTok = resolvePloiToken(ploiResult.data);

    if (!ghTok)   return { ok: false, error: "No GitHub token configured. Add one in Platform → Integrations → Provisioning (or env GITHUB_TOKEN)." };
    if (!ploi.team) return { ok: false, error: "No Ploi Cloud team configured. Set it in Platform → Integrations → Provisioning." };
    if (!ploiTok) return { ok: false, error: "No Ploi Cloud API token configured. Add one in Platform → Integrations → Provisioning (or env PLOI_CLOUD_TOKEN)." };

    const slug     = provisioningSlug(tenantId);
    const repoName = `${gh.templateRepo}-${slug}`;
    const appName  = `mc-cms-${slug}`;

    // ── Fase 1: generate the per-tenant repo from the template ──
    const repo = await generateRepoFromTemplate({
      token:         ghTok,
      templateOwner: gh.templateOwner,
      templateRepo:  gh.templateRepo,
      owner:         gh.repoOwner,
      name:          repoName,
      privateRepo:   gh.privateRepos,
      description:   `Mister Chameleon CMS (tenant ${tenantId})`,
    });
    if (!repo.ok) return { ok: false, error: `Fase 1 (repo): ${repo.message}` };

    // ── Fase 1b: seed neutral content into the FRESH repo only ──
    // A generated repo is a copy of the template, including its (possibly live)
    // content/. Write the neutral seed over it and drop the collection entries
    // the seed doesn't provide, so the tenant rolls out brand-free. Skipped when
    // the repo already existed, so an existing tenant's content is never
    // touched. Best-effort + non-fatal.
    if (!repo.alreadyExisted) {
      const seedResult = await seedNeutralContentIntoRepo({
        token: ghTok,
        owner: gh.repoOwner,
        name:  repoName,
        branch: "main",
      });
      logger.info("[provision] neutral content seed", { tenantId, repo: repoName, ...seedResult });
    }

    // ── Fase 2: create the Ploi Cloud application ──
    const { randomBytes } = await import("crypto");
    const appKey = `base64:${randomBytes(32).toString("base64")}`;
    const platformUrl = ploi.platformApiUrl || "https://www.misterchameleon.nl";

    const yaml = buildStatamicInfraYaml({
      appName,
      team:       ploi.team,
      repoUrl:    repo.htmlUrl ?? `https://github.com/${gh.repoOwner}/${repoName}`,
      repoOwner:  gh.repoOwner,
      repoName,
      branch:     "main",
      phpVersion: ploi.phpVersion,
      domain:     opts?.domain,
      // Same two build steps as the one-click rollout: Ploi Cloud never runs
      // deploy.sh, so restoring the CP's content snapshot and ensuring a CP
      // login both have to happen here or not at all.
      extraBuildCommands: [
        ...buildContentOverlayCommands({ repoOwner: gh.repoOwner, repoName }),
        "php artisan mc:ensure-super-user",
        // LAST: warm the Stache index + clear caches (Ploi Cloud never runs
        // deploy.sh), else /api/collections/*/entries 500s on a fresh build.
        ...buildIndexRefreshCommands(),
      ],
      secrets: [
        { key: "APP_ENV",   value: "production" },
        { key: "APP_DEBUG", value: "false" },
        { key: "APP_KEY",   value: appKey },
        { key: "APP_URL",   value: platformUrl },
        { key: "STATAMIC_API_ENABLED", value: "true" },
        // Pro is REQUIRED: navigations are a Statamic Pro feature. Without it the
        // /api/navs/{handle}/tree endpoint 404s and the site renders no nav.
        { key: "STATAMIC_PRO_ENABLED", value: "true" },
        { key: "MISTER_CHAMELEON_API_URL",    value: platformUrl },
        { key: "MISTER_CHAMELEON_TENANT_KEY", value: siteKey },
        { key: "MC_PREVIEW_FRONTEND_URL",     value: platformUrl },
        // Parity with the working tenant — these were previously set by hand:
        { key: "CP_ENABLED",            value: "true" },
        { key: "SESSION_DRIVER",        value: "file" },
        { key: "MISTER_CHAMELEON_MODE", value: "edge" },
        // Statamic Git integration — persists CP content edits back to the repo
        // (the container filesystem is ephemeral, so without this, edits are lost
        // on redeploy — this is what caused a CP site-URL edit to silently diverge
        // from the repo).  The committer identity is set here so commits are valid;
        // STATAMIC_GIT_PUSH=true ALSO needs a deploy key with WRITE access on the
        // per-tenant repo, which must be set up in Ploi/GitHub (it cannot be safely
        // injected as a secret here). The Finalize step prints that checklist.
        { key: "STATAMIC_GIT_ENABLED",        value: "true" },
        { key: "STATAMIC_GIT_AUTOMATIC",      value: "true" },
        { key: "STATAMIC_GIT_PUSH",           value: "true" },
        { key: "STATAMIC_GIT_DISPATCH_DELAY", value: "5" },
        { key: "STATAMIC_GIT_USER_NAME",      value: `Mister Chameleon CMS (${tenantId})` },
        { key: "STATAMIC_GIT_USER_EMAIL",     value: `cms+${tenantId}@misterchameleon.nl` },
      ],
    });

    const applied = await applyPloiInfrastructure({
      token:      ploiTok,
      yaml,
      dryRun:     opts?.dryRun ?? false,
      autoDeploy: true,
    });
    if (!applied.ok) {
      return {
        ok: false,
        error: `Fase 2 (Ploi): ${applied.message}`,
        detail: `Repo is ready: ${repo.fullName}. Fix the Ploi error and retry. Repo creation is idempotent.`,
        repoUrl: repo.htmlUrl,
      };
    }

    revalidatePath(`/admin/tenants/${tenantId}/setup`);
    return {
      ok: true,
      detail: opts?.dryRun
        ? `Repo ${repo.fullName} ready. Ploi dry-run OK (no app created).`
        : `Repo ${repo.fullName} ${repo.alreadyExisted ? "reused" : "created"}; Ploi app '${appName}' applied. Set APP_URL to the Ploi host once assigned, then deploy.`,
      repoUrl: repo.htmlUrl,
      appName,
      changes: applied.changes,
    };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Finalize provisioning: wire the tenant to its freshly-created Statamic
 * instance + public domain (the part that can only happen once the Ploi host is
 * assigned and the operator has chosen a domain).
 *
 *   1. tenant.cms.statamicBaseUrl = https://<ploiHost>   (where content is fetched)
 *   2. tenant_domains rows for <apex> + www.<apex>        (host → tenant resolution)
 *   3. best-effort: point the repo's sites.yaml primary site at the domain
 *
 * Returns the exact DNS records + Ploi env values the operator still has to set
 * (Vercel domain add + DNS + Ploi env can't be done from here).
 */
export async function finalizeTenantProvisioningAction(
  tenantId: string,
  input: { ploiHost: string; domain: string },
): Promise<{
  ok: boolean;
  error?: string;
  detail?: string;
  steps?: { label: string; ok: boolean; note: string }[];
  dns?: { type: string; name: string; value: string }[];
  ploiEnv?: { key: string; value: string }[];
  manualSteps?: { label: string; detail: string }[];
}> {
  await getRequiredAdminSession();
  try {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return { ok: false, error: `Tenant '${tenantId}' not found.` };

    const { bareHost, provisioningSlug, updateRepoSitesYaml } = await import("@/lib/provisioning/cms-provisioner");
    const { addDomain } = await import("@/tenant/domain-store");
    const { getPlatformGithubSettings, githubFlags, resolveGithubToken } = await import("@/platform/platform-store");
    const { isVercelConfigured, addVercelDomain } = await import("@/lib/vercel-domains");

    const host = bareHost(input.ploiHost);
    const apex = bareHost(input.domain).replace(/^www\./i, "");
    if (!host) return { ok: false, error: "Ploi host is required." };
    if (!apex || !apex.includes(".")) return { ok: false, error: "Enter a valid domain, e.g. steunles.nl." };

    const baseUrl     = `https://${host}`;
    const www         = `www.${apex}`;
    const primaryUrl  = `https://${www}`;
    const steps: { label: string; ok: boolean; note: string }[] = [];

    // 1 — statamicBaseUrl
    const next: TenantSettings = {
      ...tenant,
      cms: { ...tenant.cms, statamicBaseUrl: baseUrl } as TenantCmsSettings,
    };
    const saved = await saveTenant(next);
    steps.push({ label: "Set statamicBaseUrl", ok: saved.ok, note: saved.ok ? baseUrl : (saved.error ?? "failed") });

    // 2 — domains: map in our DB (host → tenant) AND register on Vercel.
    const vercelConfigured = isVercelConfigured();
    const vercelDns: { type: string; name: string; value: string }[] = [];
    for (const [d, primary] of [[www, true], [apex, false]] as [string, boolean][]) {
      const r = await addDomain(tenantId, d, { isPrimary: primary, status: "active" });
      const already = !r.ok && /already registered for this tenant/i.test(r.error ?? "");
      steps.push({ label: `Map domain ${d}`, ok: r.ok || already, note: r.ok ? "added" : (already ? "already mapped" : (r.error ?? "failed")) });

      if (vercelConfigured) {
        const v = await addVercelDomain(d);
        if (v.ok) {
          steps.push({ label: `Vercel domain ${d}`, ok: true, note: v.alreadyVerified ? "added (verified)" : "added (DNS pending)" });
          // Vercel returns the authoritative DNS records to set at the registrar.
          for (const rec of v.verification ?? []) {
            if (rec?.type && rec?.value) vercelDns.push({ type: rec.type, name: rec.domain ?? d, value: rec.value });
          }
        } else {
          steps.push({ label: `Vercel domain ${d}`, ok: false, note: v.error });
        }
      }
    }

    // 3 — sites.yaml (best-effort, needs GitHub token + per-tenant repo)
    const ghRes = await getPlatformGithubSettings();
    if (ghRes.ok) {
      const gh    = githubFlags(ghRes.data);
      const token = resolveGithubToken(ghRes.data);
      const repo  = `${gh.templateRepo}-${provisioningSlug(tenantId)}`;
      if (token) {
        const sy = await updateRepoSitesYaml({ token, owner: gh.repoOwner, repo, primarySiteUrl: primaryUrl });
        steps.push({ label: "Update repo sites.yaml", ok: sy.ok, note: sy.message });
      } else {
        steps.push({ label: "Update repo sites.yaml", ok: false, note: "skipped (no GitHub token configured)" });
      }
    }

    revalidatePath(`/admin/tenants/${tenantId}/setup`);
    const allOk = steps.every((s) => s.ok);
    return {
      ok: allOk,
      detail: allOk
        ? `Wired ${tenantId} → ${baseUrl} and ${www}. Now add the domain in Vercel, set DNS, set the Ploi env, then redeploy both.`
        : "Finished with some warnings. See steps below.",
      steps,
      // Routing records (apex A + www CNAME) plus any Vercel ownership-verification
      // TXT records returned when the domain was registered.
      dns: [
        { type: "A",     name: apex,  value: "76.76.21.21" },
        { type: "CNAME", name: "www", value: "cname.vercel-dns-0.com" },
        ...vercelDns,
      ],
      ploiEnv: [
        { key: "APP_URL",                 value: baseUrl },
        { key: "MC_PREVIEW_FRONTEND_URL", value: primaryUrl },
      ],
      // Two things that CANNOT be automated from here (they need GitHub/Ploi
      // credentials + registrar DNS) but are required to avoid the two failure
      // modes we hit in production. Surfaced as an explicit operator checklist.
      manualSteps: [
        {
          label: "Use a STABLE CMS domain (not the *.preview.ploi.it host)",
          detail:
            `Preview hosts sleep and cold-start, which made the public nav flip between ` +
            `the real site and a fallback. Add a domain like cms.${apex} to the Ploi app ` +
            `(A-record → the IP Ploi shows under Domains), wait for SSL, then re-run Finalize ` +
            `with that host so statamicBaseUrl = https://cms.${apex}.`,
        },
        {
          label: "Add a WRITE deploy key so STATAMIC_GIT_PUSH actually pushes",
          detail:
            `STATAMIC_GIT_PUSH=true + the committer identity are set automatically, but the ` +
            `container still needs a deploy key with write access or CP edits commit locally ` +
            `and are LOST on the next redeploy (this is what made a CP site-URL edit silently ` +
            `diverge from the repo). In Ploi, add the app's deploy key to ` +
            `github.com/${ghRes.ok ? githubFlags(ghRes.data).repoOwner : "<owner>"}/${(ghRes.ok ? `${githubFlags(ghRes.data).templateRepo}-` : "")}${provisioningSlug(tenantId)} ` +
            `→ Settings → Deploy keys, with "Allow write access" checked.`,
        },
      ],
    };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK-LEVEL TOKEN SETS
// ═════════════════════════════════════════════════════════════════════════════
//
// Named, reusable bundles of curated design tokens that individual content
// blocks and adaptive slots can reference by `key`. Stored in
// `design.blockTokenSets`. This action REPLACES the whole array (the editor
// always submits the full list), after validating each set's shape.

export interface SaveBlockTokenSetsResult {
  ok:     boolean;
  errors: string[];
}

/**
 * Validate + persist the tenant's named block token sets.
 *
 * Each set needs a non-empty `key`, `name`, and `id`; keys must be unique and
 * slug-safe. Unknown token fields are stripped so stored data stays clean.
 * Passing an empty array clears all sets.
 */
export async function saveBlockTokenSetsAction(
  tenantId: string,
  rawSets:  unknown,
): Promise<SaveBlockTokenSetsResult> {
  try {
    await getRequiredAdminSession();

    const current = await getTenantById(tenantId);
    if (!current) return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };

    if (!Array.isArray(rawSets)) {
      return { ok: false, errors: ["Expected an array of token sets."] };
    }

    const errors: string[] = [];
    const seenKeys = new Set<string>();
    const clean: BlockTokenSet[] = [];

    rawSets.forEach((raw, i) => {
      const set = raw as Partial<BlockTokenSet> | null;
      if (!set || typeof set !== "object") {
        errors.push(`Set #${i + 1}: not an object.`);
        return;
      }
      const name = typeof set.name === "string" ? set.name.trim() : "";
      const key  = typeof set.key === "string"  ? set.key.trim().toLowerCase() : "";
      if (!name) errors.push(`Set #${i + 1}: name is required.`);
      if (!key)  errors.push(`Set #${i + 1}: key is required.`);
      if (key && !/^[a-z0-9][a-z0-9-]*$/.test(key)) {
        errors.push(`Set "${name || key}": key may only contain a-z, 0-9 and hyphens.`);
      }
      if (key && seenKeys.has(key)) {
        errors.push(`Set "${name || key}": duplicate key "${key}".`);
      }
      seenKeys.add(key);

      // Strip tokens down to known fields with non-empty string values.
      const rawTokens = (set.tokens ?? {}) as Record<string, unknown>;
      const tokens: Record<string, string> = {};
      for (const field of CURATED_TOKEN_KEYS) {
        const v = rawTokens[field];
        if (typeof v !== "string" || !v.trim()) continue;
        if (field === "surface" && !(VALID_SURFACE_ROLES as readonly string[]).includes(v.trim())) {
          errors.push(`Set "${name || key}": invalid surface "${v}".`);
          continue;
        }
        tokens[field] = v.trim();
      }

      // Optional block-type scope — keep only known slot types; empty → all blocks.
      const slots = Array.isArray(set.slots)
        ? set.slots.filter((s): s is string =>
            typeof s === "string" && (BLOCK_TOKEN_SET_SLOTS as readonly string[]).includes(s))
        : [];

      clean.push({
        id:   typeof set.id === "string" && set.id.trim() ? set.id : `bts_${key || i}_${Date.now()}`,
        key,
        name,
        ...(typeof set.description === "string" && set.description.trim()
          ? { description: set.description.trim() }
          : {}),
        ...(slots.length ? { slots } : {}),
        tokens: tokens as BlockTokenSet["tokens"],
      });
    });

    if (errors.length > 0) return { ok: false, errors };

    const updatedDesign: TenantDesignSettings = {
      ...current.design,
      blockTokenSets: clean.length > 0 ? clean : undefined,
    };
    const saveResult = await saveTenant({ ...current, design: updatedDesign });
    if (!saveResult.ok) return { ok: false, errors: [saveResult.error] };

    revalidatePath(`/admin/tenants/${tenantId}/design`);
    return { ok: true, errors: [] };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/**
 * Save the SITE-WIDE default design tokens (design.defaultTokens) — the central
 * design-token system. These are applied at the page root so every block/slot
 * inherits them; per-block token refs still override for their own subtree.
 */
export async function saveDefaultTokensAction(
  tenantId:  string,
  rawTokens: unknown,
): Promise<SaveBlockTokenSetsResult> {
  try {
    await getRequiredAdminSession();

    const current = await getTenantById(tenantId);
    if (!current) return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };

    if (rawTokens === null || typeof rawTokens !== "object" || Array.isArray(rawTokens)) {
      return { ok: false, errors: ["Expected a design-tokens object (color, typography, …)."] };
    }

    const errors: string[] = [];
    const src = rawTokens as Record<string, unknown>;
    const tokens: Record<string, string> = {};
    for (const field of CURATED_TOKEN_KEYS) {
      const v = src[field];
      if (typeof v !== "string" || !v.trim()) continue;
      if (field === "surface" && !(VALID_SURFACE_ROLES as readonly string[]).includes(v.trim())) {
        errors.push(`Invalid surface "${v}".`);
        continue;
      }
      tokens[field] = v.trim();
    }

    if (errors.length > 0) return { ok: false, errors };

    const hasAny = Object.keys(tokens).length > 0;
    const updatedDesign: TenantDesignSettings = {
      ...current.design,
      defaultTokens: hasAny ? (tokens as TenantDesignSettings["defaultTokens"]) : undefined,
    };
    const saveResult = await saveTenant({ ...current, design: updatedDesign });
    if (!saveResult.ok) return { ok: false, errors: [saveResult.error] };

    revalidatePath(`/admin/tenants/${tenantId}/design`);
    return { ok: true, errors: [] };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/**
 * Reset a tenant's design to a clean slate.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   Importing a JSON token file (Advanced / Builder) writes `tokenOverrides`
 *   (and can write `defaultTokens`, `blockTokenSets`, `customFonts`). Those sit
 *   at the HIGHEST specificity in the theme cascade, so they keep masking any
 *   preset the operator activates afterwards — making it look like "presets
 *   won't load anymore". There was no single control to clear all of that, so
 *   the tenant could get stuck. This wipes every visual override in one save.
 *
 *   Preserved on purpose: `themeRules` (the Automatic-switching contextual
 *   rules) — those are a separate concern from the visual design, and silently
 *   dropping them on a "reset design" would be surprising.
 *
 * @returns `{ ok: true }` or `{ ok: false, error }`. Never throws to the client.
 */
export async function resetDesignAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();

    const current = await getTenantById(tenantId);
    if (!current) return { ok: false, error: `Tenant "${tenantId}" not found.` };

    const resetDesign: TenantDesignSettings = {
      theme: "default" as ThemeKey,
      // Keep the automatic theme-switching rules; drop every visual override.
      ...(current.design?.themeRules ? { themeRules: current.design.themeRules } : {}),
    };

    const saveResult = await saveTenant({ ...current, design: resetDesign });
    if (!saveResult.ok) return { ok: false, error: saveResult.error };

    revalidatePath("/", "layout");
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath(`/admin/tenants/${tenantId}/design`);
    return { ok: true };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Pages ─────────────────────────────────────────────────────────────────────

/**
 * Delete a single CMS page belonging to a tenant.
 *
 * ─── Why this was missing ────────────────────────────────────────────────────
 *
 *   DeletePageButton.tsx has imported `deletePageAction` from this file since it
 *   was written. The function never existed. Webpack downgrades an unresolved
 *   import to a warning and next.config set typescript.ignoreBuildErrors, so the
 *   build said "Compiled successfully" and shipped a Delete button that throws
 *   "deletePageAction is not a function" the moment anyone confirms the dialog.
 *   Nothing in the admin has ever been deletable this way.
 *
 *   (The same shape as app/api/billing/cancel-subscription importing a `getStripe`
 *   that never existed. Two in one codebase, both found by turning the typecheck
 *   back on.)
 *
 * ─── Access ──────────────────────────────────────────────────────────────────
 *
 *   Requires an admin session with access to this tenant. `canAccessTenant`
 *   rather than `assertTenantAccess`: the latter redirects, which is right for a
 *   layout but wrong here — the client expects `{ ok, error }` so it can show the
 *   reason in the confirmation dialog.
 *
 *   tenantId is passed to deletePage() as well, so scoping is enforced at the
 *   query too: a page id from another tenant simply is not found.
 *
 * @returns `{ ok: true }`, or `{ ok: false, error }` with a message the operator
 *          can act on. Never throws — the button surfaces `error` in an alert.
 */
export async function deletePageAction(
  tenantId: string,
  pageId:   string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  if (!pageId)   return { ok: false, error: "Page ID is required." };

  const session = await getRequiredAdminSession();
  if (!(await canAccessTenant(session, tenantId))) {
    return { ok: false, error: "You do not have access to this tenant." };
  }

  try {
    const removed = await deletePage(pageId, tenantId);
    if (!removed) {
      return { ok: false, error: "Page not found, or it belongs to another tenant." };
    }
  } catch (err) {
    logger.error("[deletePageAction] delete failed", {
      tenantId, pageId, error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // The list is a Server Component — revalidate so the row disappears without
  // the client having to refetch or reload.
  revalidatePath(`/admin/tenants/${tenantId}/content/pages`);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════════════
// ONE-CLICK STATAMIC ROLLOUT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * What a rolled-out site starts with.
 *
 *   "demo"    — a curated, brand-free Dutch example site: every block type, real
 *               collections, working adaptive slots. Presentable immediately.
 *   "vanilla" — the neutral starter: a couple of blank pages to build on.
 *
 * The mode only picks which seed directory the provisioner applies (and, for
 * "demo", whether the platform-side adaptive data is seeded too). Everything
 * else about the rollout is identical.
 */
export type RolloutMode = "demo" | "vanilla";

export interface RolloutResult {
  ok:        boolean;
  error?:    string;
  /** "ready" — everything wired. "host-pending" — finish once Ploi assigns a host. */
  status?:   "ready" | "host-pending";
  tenantId?: string;
  /** Public demo site, at <slug>.demo.misterchameleon.nl. */
  demoUrl?:  string;
  /** Statamic control panel, on the Ploi host. */
  cpUrl?:    string;
  cpEmail?:  string;
  /** Shown ONCE — it is never stored anywhere the operator can read it back. */
  cpPassword?: string;
  repoUrl?:  string;
  appName?:  string;
  steps?:    { label: string; ok: boolean; note: string }[];
  warnings?: string[];
  /** The one DNS record the operator must set at their DNS provider (Strato has
   *  no wildcard). Host/prefix relative to the misterchameleon.nl zone. */
  dnsHost?:      string;
  /** CNAME value for dnsHost — Vercel's project-specific target, or the legacy fallback. */
  dnsCnameValue?: string;
  /** True when dnsCnameValue is the legacy fallback (Vercel gave no value). */
  dnsIsFallback?: boolean;
}

/**
 * Roll out a complete, working Statamic site in one action.
 *
 * Everything that used to be a manual checklist item after provisioning is done
 * here: the tenant record, the repo, neutral content, a write deploy key, a
 * super-user to log in with, and a public URL.
 *
 * ─── Per-demo DNS (Strato has no wildcard) ───────────────────────────────────
 *
 * Strato does not support wildcard DNS, and its only "own nameservers" option is
 * domain-wide — which would break the Strato-hosted @misterchameleon.nl mail. So
 * each demo gets its own subdomain `<slug>.demo.misterchameleon.nl`: this action
 * adds the `tenant_domains` row AND registers the host on Vercel automatically,
 * then returns the ONE CNAME the operator must set at the DNS provider (Vercel's
 * project-specific target when available, else the legacy `cname.vercel-dns.com`).
 * See docs/demo-rollout.md. Mail is untouched (nameservers stay at Strato).
 *
 * ─── Never leaves a half-built demo ──────────────────────────────────────────
 *
 * Ploi assigns a host asynchronously. When it hasn't within the polling window,
 * this returns `status: "host-pending"` with the credentials and repo it DID
 * create, and the operator finishes with the existing finalize action once the
 * host shows up. Steps that are merely nice-to-have — the deploy key, the
 * public domain row — degrade to a warning rather than failing the rollout.
 */
export async function provisionTenantSiteAction(
  name: string,
  opts?: { mode?: RolloutMode; hostPollAttempts?: number; hostPollIntervalMs?: number },
): Promise<RolloutResult> {
  const mode: RolloutMode = opts?.mode ?? "demo";
  await getRequiredAdminSession();
  try {
    const {
      generateRepoFromTemplate, seedNeutralContentIntoRepo, buildStatamicInfraYaml,
      applyPloiInfrastructure, pollPloiApplicationHost, ensureRepoDeployKey,
      demoNaming, generateDemoPassword, buildDemoSecrets, provisioningSlug,
      buildContentOverlayCommands, buildIndexRefreshCommands,
    } = await import("@/lib/provisioning/cms-provisioner");
    const {
      getPlatformGithubSettings, githubFlags, resolveGithubToken,
      getPlatformPloiSettings, ploiFlags, resolvePloiToken,
    } = await import("@/platform/platform-store");
    const { addDomain } = await import("@/tenant/domain-store");

    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Give the demo a name." };

    const tenantId = provisioningSlug(trimmed);
    const steps:    { label: string; ok: boolean; note: string }[] = [];
    const warnings: string[] = [];

    // ── Credentials / tokens ──────────────────────────────────────────────────
    const ghResult = await getPlatformGithubSettings();
    if (!ghResult.ok) return { ok: false, error: ghResult.error };
    const ploiResult = await getPlatformPloiSettings();
    if (!ploiResult.ok) return { ok: false, error: ploiResult.error };

    const gh      = githubFlags(ghResult.data);
    const ploi    = ploiFlags(ploiResult.data);
    const ghTok   = resolveGithubToken(ghResult.data);
    const ploiTok = resolvePloiToken(ploiResult.data);
    if (!ghTok)     return { ok: false, error: "No GitHub token configured. Add one in Platform → Integrations → Provisioning." };
    if (!ploi.team) return { ok: false, error: "No Ploi Cloud team configured. Set it in Platform → Integrations → Provisioning." };
    if (!ploiTok)   return { ok: false, error: "No Ploi Cloud API token configured. Add one in Platform → Integrations → Provisioning." };

    const naming = demoNaming(tenantId, gh.templateRepo);

    // ── 1. Tenant — reuse the normal onboarding path ──────────────────────────
    // createTenant() generates the siteKey itself, so nothing is hand-rolled here.
    let tenant = await getTenantById(tenantId);
    if (tenant) {
      steps.push({ label: "Tenant", ok: true, note: `${tenantId} already existed — reused` });
    } else {
      const { createTenantFromOnboardingAction } = await import("@/app/admin/tenants/actions");
      const created = await createTenantFromOnboardingAction({
        tenantId,
        tenantName:  trimmed,
        websiteUrl:  naming.demoHost,
        packageKey:  "growth",
        cmsProvider: "statamic",
        themePreset: "minimal",
      });
      if (!created.ok) return { ok: false, error: `Could not create the tenant: ${created.error}` };
      tenant = created.tenant;
      steps.push({ label: "Tenant", ok: true, note: `created ${tenantId}` });
    }

    const siteKey = tenant.snippet?.siteKey;
    if (!siteKey) return { ok: false, error: `Tenant '${tenantId}' has no siteKey — cannot wire the CMS to the platform.` };

    // ── 2. Repo from the template ─────────────────────────────────────────────
    const repo = await generateRepoFromTemplate({
      token:         ghTok,
      templateOwner: gh.templateOwner,
      templateRepo:  gh.templateRepo,
      owner:         gh.repoOwner,
      name:          naming.repoName,
      privateRepo:   true,
      description:   `Mister Chameleon CMS — ${mode} site (${tenantId})`,
    });
    if (!repo.ok) return { ok: false, error: `Repo: ${repo.message}`, steps };
    steps.push({ label: "GitHub repo", ok: true, note: repo.alreadyExisted ? "reused" : "created from template" });

    // ── 3. Content — only ever on a repo we just made ─────────────────────────
    // The mode picks the seed directory; the apply-and-prune mechanism, and its
    // guard rails, are the same either way.
    const seedRoot = mode === "demo" ? "demo-seed" : "seed";
    const contentLabel = mode === "demo" ? "Demo content" : "Neutral content";
    if (!repo.alreadyExisted) {
      const seeded = await seedNeutralContentIntoRepo({
        token: ghTok, owner: gh.repoOwner, name: naming.repoName, branch: "main", seedRoot,
      });
      steps.push({ label: contentLabel, ok: seeded.ok, note: seeded.message });
      if (!seeded.ok) warnings.push(`Content seed: ${seeded.message}`);
    } else {
      steps.push({ label: contentLabel, ok: true, note: "skipped — repo already existed, content left alone" });
    }

    // ── 4. Write deploy key, so CP edits survive a redeploy ───────────────────
    const key = await ensureRepoDeployKey({ token: ghTok, owner: gh.repoOwner, repo: naming.repoName });
    steps.push({ label: "Write deploy key", ok: key.ok, note: key.message });
    if (!key.ok) warnings.push(`Deploy key: ${key.message} CP edits will not persist across redeploys until this is fixed.`);

    // ── 5. Ploi application ───────────────────────────────────────────────────
    const { randomBytes } = await import("crypto");
    const appKey      = `base64:${randomBytes(32).toString("base64")}`;
    const cpPassword  = generateDemoPassword();
    const platformUrl = ploi.platformApiUrl || "https://www.misterchameleon.nl";

    // Ploi Cloud never runs deploy.sh, so the content overlay that makes CP edits
    // survive a redeploy has to live in the build commands — followed by the
    // super-user, which is idempotent and has to run every deploy because the
    // container filesystem is ephemeral.
    //
    // Computed once: the infra is applied TWICE below (before the host is known,
    // then again with the corrected APP_URL) and the two must not drift apart.
    const extraBuildCommands = [
      ...buildContentOverlayCommands({ repoOwner: gh.repoOwner, repoName: naming.repoName }),
      "php artisan mc:ensure-super-user",
      // LAST: content is on disk, so warm the index + fix permalinks. Ploi Cloud
      // never runs deploy.sh, so without this /api/collections/*/entries 500s.
      ...buildIndexRefreshCommands(),
    ];

    const yaml = buildStatamicInfraYaml({
      appName:    naming.appName,
      team:       ploi.team,
      repoUrl:    repo.htmlUrl ?? `https://github.com/${gh.repoOwner}/${naming.repoName}`,
      repoOwner:  gh.repoOwner,
      repoName:   naming.repoName,
      branch:     "main",
      phpVersion: ploi.phpVersion,
      extraBuildCommands,
      secrets: buildDemoSecrets({
        platformUrl,
        // Ploi has not assigned a host yet, so this is provisionally the
        // platform URL and is corrected below once the real host is known.
        appUrl:     platformUrl,
        appKey,
        siteKey,
        tenantId,
        cpEmail:    naming.cpEmail,
        cpPassword,
        siteUrl:    `https://${naming.demoHost}`,
        ...(key.privateKey ? { gitSshKey: key.privateKey } : {}),
      }),
    });

    const applied = await applyPloiInfrastructure({ token: ploiTok, yaml, autoDeploy: true });
    if (!applied.ok) {
      return {
        ok: false,
        error: `Ploi: ${applied.message}`,
        steps,
        repoUrl: repo.htmlUrl,
        cpEmail: naming.cpEmail,
        cpPassword,
      };
    }
    steps.push({ label: "Ploi application", ok: true, note: `${naming.appName} applied` });

    // ── 6. Wait for the host Ploi assigned ────────────────────────────────────
    const hostResult = await pollPloiApplicationHost({
      token:      ploiTok,
      appName:    naming.appName,
      ...(opts?.hostPollAttempts   !== undefined ? { attempts:   opts.hostPollAttempts }   : {}),
      ...(opts?.hostPollIntervalMs !== undefined ? { intervalMs: opts.hostPollIntervalMs } : {}),
    });

    if (!hostResult.ok || !hostResult.host) {
      // Not a failure: everything above is built and the operator can finish
      // with Finalize once the host appears. Returning the credentials matters —
      // the password exists nowhere else.
      revalidatePath(`/admin/tenants/${tenantId}/setup`);
      steps.push({ label: "Ploi host", ok: false, note: hostResult.message });
      return {
        ok: true,
        status: "host-pending",
        tenantId,
        demoUrl:  `https://${naming.demoHost}`,
        cpEmail:  naming.cpEmail,
        cpPassword,
        repoUrl:  repo.htmlUrl,
        appName:  naming.appName,
        steps,
        warnings: [...warnings, `Ploi has not assigned a host yet. Run Finalize with the host once it appears in Ploi — everything else is done.`],
      };
    }

    const ploiHost = hostResult.host;
    steps.push({ label: "Ploi host", ok: true, note: ploiHost });

    // ── 7. Point the tenant at its CMS ────────────────────────────────────────
    const cmsBaseUrl = `https://${ploiHost}`;
    const savedTenant = await saveTenant({
      ...tenant,
      cms: { ...tenant.cms, statamicBaseUrl: cmsBaseUrl } as TenantCmsSettings,
    });
    steps.push({ label: "statamicBaseUrl", ok: savedTenant.ok, note: savedTenant.ok ? cmsBaseUrl : (savedTenant.error ?? "failed") });

    // ── 8. Correct APP_URL and redeploy ───────────────────────────────────────
    // The CP has to know its own origin or it generates links and redirects to
    // the platform. Re-applying the same infra with the real host is the
    // supported way to change a secret, and it triggers the redeploy that picks
    // it up. This is the whole reason step 6 waits for the host.
    const correctedYaml = buildStatamicInfraYaml({
      appName:    naming.appName,
      team:       ploi.team,
      repoUrl:    repo.htmlUrl ?? `https://github.com/${gh.repoOwner}/${naming.repoName}`,
      repoOwner:  gh.repoOwner,
      repoName:   naming.repoName,
      branch:     "main",
      phpVersion: ploi.phpVersion,
      extraBuildCommands,
      secrets: buildDemoSecrets({
        platformUrl,
        appUrl:     cmsBaseUrl,
        appKey,
        siteKey,
        tenantId,
        cpEmail:    naming.cpEmail,
        cpPassword,
        siteUrl:    `https://${naming.demoHost}`,
        ...(key.privateKey ? { gitSshKey: key.privateKey } : {}),
      }),
    });
    const reapplied = await applyPloiInfrastructure({ token: ploiTok, yaml: correctedYaml, autoDeploy: true });
    steps.push({ label: "APP_URL → CP host + redeploy", ok: reapplied.ok, note: reapplied.ok ? cmsBaseUrl : reapplied.message });
    if (!reapplied.ok) warnings.push(`APP_URL correction: ${reapplied.message}`);

    // ── 8b. Platform-side adaptive data, demo only ────────────────────────────
    // The CMS seed ships a context_slot and two hero variants; without a block
    // and a rule on this side the slot has nothing to choose between and always
    // renders the default. Fail-open: a demo without personalisation is still a
    // working site, so this warns rather than failing the rollout.
    if (mode === "demo") {
      const { seedDemoPlatformData } = await import("@/lib/provisioning/demo-platform-seed");
      const platformSeed = await seedDemoPlatformData(tenantId);
      steps.push({ label: "Adaptive demo data", ok: platformSeed.ok, note: platformSeed.message });
      warnings.push(...platformSeed.warnings);
    }

    // ── 9. Public demo URL — a tenant_domains row + the Vercel domain ─────────
    const domainResult = await addDomain(tenantId, naming.demoHost, { isPrimary: true, status: "active" });
    const alreadyMapped = !domainResult.ok && /already registered for this tenant/i.test(domainResult.error ?? "");
    steps.push({
      label: `Demo domain ${naming.demoHost}`,
      ok:    domainResult.ok || alreadyMapped,
      note:  domainResult.ok ? "mapped" : (alreadyMapped ? "already mapped" : (domainResult.error ?? "failed")),
    });
    if (!domainResult.ok && !alreadyMapped) {
      warnings.push(`Demo domain: ${domainResult.error}. The CP and content still work; only the public URL won't resolve.`);
    }

    // ── 9b. Vercel domain + the one manual DNS record ─────────────────────────
    // Strato has no wildcard, so each demo needs its own subdomain. Register the
    // host on Vercel automatically and resolve the single CNAME the operator must
    // set at the DNS provider. Fail-open: a Vercel hiccup never breaks the rollout.
    const { isVercelConfigured, addVercelDomain, getVercelRecommendedCname } =
      await import("@/lib/vercel-domains");
    const { resolveDemoDnsStep } = await import("@/lib/provisioning/demo-dns");
    const dns = await resolveDemoDnsStep(naming.demoHost, naming.slug, {
      isVercelConfigured, addVercelDomain, getVercelRecommendedCname,
    });
    steps.push(...dns.steps);
    warnings.push(...dns.warnings);

    revalidatePath(`/admin/tenants/${tenantId}/setup`);
    revalidatePath("/admin/tenants");
    return {
      ok:      true,
      status:  "ready",
      tenantId,
      demoUrl: `https://${naming.demoHost}`,
      cpUrl:   `${cmsBaseUrl}/cp`,
      cpEmail: naming.cpEmail,
      cpPassword,
      repoUrl: repo.htmlUrl,
      appName: naming.appName,
      steps,
      warnings,
      dnsHost:       dns.dnsHost,
      dnsCnameValue: dns.dnsCnameValue,
      dnsIsFallback: dns.dnsIsFallback,
    };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @deprecated Renamed to provisionTenantSiteAction now that a rollout can be a
 * curated demo OR a blank site. Kept so existing callers keep working; it rolls
 * out a demo, which is what the old name did.
 */
export const provisionDemoTenantAction = provisionTenantSiteAction;

/** @deprecated Renamed to RolloutResult. */
export type DemoRolloutResult = RolloutResult;
