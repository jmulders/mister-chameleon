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
import { redirect }       from "next/navigation";
import { saveTenant, getTenantById } from "@/tenant/server";
import { getDb }          from "@/data/db";
import {
  getRequiredAdminSession,
  isSuperAdmin,
}                         from "@/lib/admin-auth/authorization";
import { DEV_TENANT_COOKIE, DEV_TENANT_COOKIE_MAX_AGE } from "@/tenant/dev-tenant-cookie";
import { validateDesignTokenUpload } from "@/tenant/design-token-validator";
import { provisionTenant }           from "@/cms/seed/tenant-provisioner";
import { getPackageDefinition, isValidPackageKey } from "@/tenant";
import { templateKeysToPageEntries }  from "@/page-config";
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
import { isFeaturedFamilyKey }         from "@/design-system/theme/theme-families.config";
import type {
  ProvisionSiteResult,
  CreateSiteResult,
  SiteInitReport,
  CmsInitSection,
  StarterContentMode,
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
 *   - Other:     returns an error — only Sanity and Storyblok support managed provisioning
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
    const msg = err instanceof Error ? err.message : String(err);
    report.designSystem = { status: "error", message: `Design system setup failed: ${msg}` };
    allWarnings.push(`Design system: ${msg}`);
  }

  // ── PART 3 — CMS content ──────────────────────────────────────────────────
  //
  // Convert the selected template keys to page entries and provision all CMS
  // documents: pages, variant docs, nav items, site settings.

  let cmsProvisionedAt: string | undefined;

  try {
    const pages = templateKeysToPageEntries(selectedTemplates, siteType);

    const provisionResult: ProvisionResult = await provisionTenant(
      working,
      /* dryRun          */ false,
      siteType,
      pages,
      includeDefaultBlocks,
      starterContentMode,
      includeShowcasePage,
    );

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
  themeKey: import("@/design-system/theme/presets").ThemePresetKey,
): Promise<{
  ok:     boolean;
  rule?:  { id: string; label: string; priority: number; enabled: boolean };
  errors?: string[];
}> {
  if (!tenantId || !source || !themeKey) {
    return { ok: false, errors: ["tenantId, source, and themeKey are required."] };
  }

  // Validate themeKey
  const { isThemePresetKey } =
    await import("@/design-system/theme/presets") as
      typeof import("@/design-system/theme/presets");
  if (!isThemePresetKey(themeKey)) {
    return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
  }

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
    targetRule   = { ...existing, plan: { ...existing.plan, themeKey } };
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
      targetRule   = { ...existing, plan: { ...existing.plan, themeKey } };
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
          themeKey,
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
    themeKey:        import("@/design-system/theme/presets").ThemePresetKey;
    label:           string;
    priority?:       number;
    extraCondition?: import("@/decision/rules/stored-rule").RuleCondition;
  },
): Promise<{
  ok:     boolean;
  rule?:  { id: string; label: string; priority: number; enabled: boolean };
  errors?: string[];
}> {
  const { contextIds, minConfidence, themeKey, label, extraCondition } = params;
  const priority = params.priority ?? 80;

  if (!tenantId) return { ok: false, errors: ["tenantId is required."] };
  if (!contextIds || contextIds.length === 0)
    return { ok: false, errors: ["At least one contextId is required."] };
  if (!themeKey)     return { ok: false, errors: ["themeKey is required."] };
  if (!label?.trim()) return { ok: false, errors: ["label is required."] };

  const { isThemePresetKey } =
    await import("@/design-system/theme/presets") as
      typeof import("@/design-system/theme/presets");
  if (!isThemePresetKey(themeKey)) {
    return { ok: false, errors: [`Invalid themeKey: "${themeKey}".`] };
  }

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
    plan:      { heroKey: dp.heroKey, proofKey: dp.proofKey, ctaKey: dp.ctaKey, themeKey },
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
