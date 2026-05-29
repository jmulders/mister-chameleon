/**
 * site/initialize-site.ts
 *
 * Central orchestrator for first-time (and re-) site initialization.
 *
 * ─── What initializeSite() does ───────────────────────────────────────────────
 *
 *   PART 3 — Persist tenant_sites + tenant_site_setup rows.
 *   PART 4 — Apply the chosen theme to tenant_settings.design.theme.
 *   PART 5 — Create pages from the blueprint's page list (pages table).
 *   PART 6 — Generate and persist navigation (site_navigation table).
 *   PART 7 — Activate interest profiles matching the site type family.
 *   PART 7b — Seed preset decision rules into rules_config for this tenant.
 *   PART 8 — Scaffold content from intake data (companyName, description, etc.).
 *            (Woven into Part 5 — each content block is seeded by the generator.)
 *   PART 9 — Store referenceUrl in tenant_site_setup for optional future analysis.
 *   PART 10 — Idempotency: skip existing pages/nav unless overwrite=true.
 *   PART 11 — Return { siteId, pages, navigation, theme, activeProfiles,
 *              warnings, previewUrl }.
 *
 * ─── Failure model ────────────────────────────────────────────────────────────
 *
 *   Each section runs independently.  A failure in one section (e.g. profile
 *   activation) does not abort the others.  All non-fatal errors are collected
 *   as warnings in the result.
 *
 *   Only the tenant_sites upsert is strictly required — if it fails, the
 *   function throws so the caller can surface a meaningful error.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   Uses getDb() (service-role) and saveTenant().  Do NOT import in client
 *   components.
 */

import "server-only";

import { getDb }                     from "@/data/db";
import { getTenantById, saveTenant } from "@/tenant/server";
import { findBlueprintByKey }        from "@/blueprints/blueprint-registry";
import { createPagesFromBlueprint }  from "./page-factory";
import { generateNavItems }          from "./navigation-generator";
import { writeNavItems }             from "./navigation-store";
import { activateProfilesForSiteType } from "./profile-activator";
import { generatePresetRulesConfig, mergePresetRules } from "@/decision/rules/generate-preset-rules";
import { loadTenantRulesConfig, tenantRulesConfigKey } from "@/decision/rules/load-tenant-rules";
import type {
  InitializeSiteInput,
  InitializeSiteResult,
  TenantSiteRow,
  TenantSiteInsert,
  TenantSiteSetupInsert,
} from "./types";

// ── Type helpers ──────────────────────────────────────────────────────────────

type SingleResult<T> = {
  data:  T | null;
  error: { message: string; code?: string } | null;
};

function asSingle<T>(r: unknown): SingleResult<T> {
  return r as SingleResult<T>;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Initialize a tenant's site from a blueprint + intake data.
 *
 * @throws {Error} Only when the pre-conditions fail (tenant not found,
 *                 blueprint not found, or tenant_sites write fails).
 *                 All other section errors are surfaced as warnings.
 */
export async function initializeSite(
  input: InitializeSiteInput,
): Promise<InitializeSiteResult> {
  const {
    tenantId,
    siteTypeKey,
    blueprintKey,
    intake,
    referenceUrl,
    overwrite = false,
  } = input;

  const warnings: string[] = [];

  // ── Pre-conditions ─────────────────────────────────────────────────────────

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error(`[initializeSite] Tenant "${tenantId}" not found.`);
  }

  const blueprint = findBlueprintByKey(blueprintKey);
  if (!blueprint) {
    throw new Error(
      `[initializeSite] Blueprint "${blueprintKey}" not found in registry.`,
    );
  }

  // Resolve theme: explicit input > blueprint recommendation > existing > "default".
  const themeKey: string =
    input.themeKey ??
    blueprint.recommendedThemePreset ??
    tenant.design?.theme ??
    "default";

  // ── PART 3 — Persist tenant_sites ─────────────────────────────────────────

  let siteId: string;

  {
    const existing = asSingle<TenantSiteRow>(
      await getDb()
        .from("tenant_sites")
        .select("id")
        .eq("tenant_id", tenantId as never)
        .maybeSingle(),
    );

    const sitePayload: TenantSiteInsert = {
      tenant_id:     tenantId,
      site_type_key: siteTypeKey,
      theme_key:     themeKey,
      blueprint_key: blueprintKey,
      status:        "draft",
    };

    if (existing.data) {
      // Update existing row.
      siteId = existing.data.id;
      const { error } = await getDb()
        .from("tenant_sites")
        .update({
          site_type_key: siteTypeKey,
          theme_key:     themeKey,
          blueprint_key: blueprintKey,
          updated_at:    new Date().toISOString(),
        } as never)
        .eq("id", siteId as never);

      if (error) {
        throw new Error(
          `[initializeSite] Failed to update tenant_sites: ${error.message}`,
        );
      }
    } else {
      // Insert new row.
      const { data: inserted, error } = asSingle<TenantSiteRow>(
        await getDb()
          .from("tenant_sites")
          .insert(sitePayload as never)
          .select()
          .maybeSingle(),
      );

      if (error || !inserted) {
        throw new Error(
          `[initializeSite] Failed to create tenant_sites row: ${error?.message ?? "no data returned"}`,
        );
      }

      siteId = inserted.id;
    }
  }

  // ── PART 3 — Persist tenant_site_setup ────────────────────────────────────

  {
    const setupPayload: TenantSiteSetupInsert = {
      tenant_id:         tenantId,
      setup_status:      "completed",
      initialized_at:    new Date().toISOString(),
      company_name:      intake.companyName      || null,
      description:       intake.description      || null,
      target_audience:   intake.targetAudience   || null,
      tone_of_voice:     intake.toneOfVoice      || null,
      primary_cta_label: intake.primaryCtaLabel  || null,
      reference_url:     referenceUrl            || null,
    };

    // Upsert — ON CONFLICT tenant_id DO UPDATE.
    const { error } = await getDb()
      .from("tenant_site_setup")
      .upsert(setupPayload as never, { onConflict: "tenant_id" });

    if (error) {
      // Non-fatal — warn but continue.
      warnings.push(
        `[initializeSite] Could not persist tenant_site_setup: ${error.message}`,
      );
    }
  }

  // ── PART 4 — Apply theme to tenant_settings ────────────────────────────────

  try {
    const updated = await saveTenant({
      ...tenant,
      design: {
        ...tenant.design,
        theme: themeKey as import("@/tenant/types").ThemeKey,
      },
    });
    if (!updated.ok) {
      warnings.push(`[initializeSite] Theme write to tenant_settings failed: ${updated.error}`);
    }
  } catch (err) {
    warnings.push(
      `[initializeSite] Theme update threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── PART 5 + 8 — Create pages with scaffold content ───────────────────────

  let pages: InitializeSiteResult["pages"] = [];

  try {
    pages = await createPagesFromBlueprint({
      tenantId,
      pages:    blueprint.pages,
      intake,
      overwrite,
    });
  } catch (err) {
    warnings.push(
      `[initializeSite] Page creation threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── PART 6 — Generate and persist navigation ───────────────────────────────

  let navigation: InitializeSiteResult["navigation"] = [];

  try {
    const navItems = generateNavItems(blueprint.pages);
    navigation = await writeNavItems({ tenantId, items: navItems, overwrite });
  } catch (err) {
    warnings.push(
      `[initializeSite] Navigation generation threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── PART 7 — Activate interest profiles ───────────────────────────────────

  const activeProfiles: string[] = [];

  try {
    const profileResult = await activateProfilesForSiteType(siteTypeKey);
    activeProfiles.push(...profileResult.activated, ...profileResult.alreadyActive);
    warnings.push(...profileResult.warnings);
  } catch (err) {
    warnings.push(
      `[initializeSite] Profile activation threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── PART 7b — Seed preset decision rules ─────────────────────────────────

  let seededRulesCount = 0;

  try {
    const generated = generatePresetRulesConfig(tenantId);

    // Load any existing config so we can merge rather than overwrite.
    const existing = await loadTenantRulesConfig(tenantId);

    const configToWrite = existing
      ? mergePresetRules(existing, generated)
      : generated;

    seededRulesCount = configToWrite.rules.length;

    const rulesKey = tenantRulesConfigKey(tenantId);

    const { error: rulesError } = await getDb()
      .from("rules_config")
      .upsert(
        { key: rulesKey, config: configToWrite as never, updated_at: new Date().toISOString() } as never,
        { onConflict: "key" },
      );

    if (rulesError) {
      warnings.push(
        `[initializeSite] Could not seed preset rules: ${rulesError.message}`,
      );
    }
  } catch (err) {
    warnings.push(
      `[initializeSite] Preset rules seeding threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── PART 3 — Mark tenant_sites as active ──────────────────────────────────

  // All sections ran — upgrade status to "active".
  try {
    await getDb()
      .from("tenant_sites")
      .update({ status: "active", updated_at: new Date().toISOString() } as never)
      .eq("id", siteId as never);
  } catch {
    // Non-fatal — site was initialized even if the status flag didn't update.
    warnings.push("[initializeSite] Could not set tenant_sites.status to active.");
  }

  // ── PART 11 — Return result ────────────────────────────────────────────────

  return {
    siteId,
    pages,
    navigation,
    theme:          themeKey,
    activeProfiles,
    seededRulesCount,
    warnings,
    previewUrl:     "/",
  };
}
