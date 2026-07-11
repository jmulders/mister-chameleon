/**
 * Apply Blueprint — Server Action
 *
 * Idempotent, non-destructive blueprint activation for a tenant.
 *
 * ─── What gets created/updated ───────────────────────────────────────────────
 *
 *   1. Behavioral rules  → upserted into rules_config (key: "homepage_<tid>")
 *   2. Scoring rules     → inserted into behavior_scoring_rules
 *   3. Sequence patterns → inserted into behavior_sequence_patterns
 *   4. Theme preset      → written to tenant_settings (when applyTheme=true)
 *   5. Pages             → for Statamic tenants, real page entries are written to
 *                          the CMS (writeBlueprintPagesToStatamic) so they render
 *                          on the live site. For other tenants they are scaffolded
 *                          into the platform page-store (getPagesByTenant/savePage).
 *                          Non-destructive by slug (unless force).
 *
 * ─── Safety model ────────────────────────────────────────────────────────────
 *
 *   By default (force=false):
 *     • Scoring rules with an existing `key` for this tenant are skipped.
 *     • Sequence patterns with an existing `slug` for this tenant are skipped.
 *     • Behavioral rules are REPLACED (rules_config is a single JSON blob).
 *
 *   With force=true:
 *     • Everything is overwritten.
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   Applying the same blueprint twice is safe.  Existing customizations are
 *   preserved by default.  The operation is additive, not destructive.
 *
 * ─── Server-only ─────────────────────────────────────────────────────────────
 *
 *   Uses service-role DB client.  Do NOT import in Client Components.
 */

"use server";

import { getDb }                                 from "@/data/db";
import type { StoredRulesConfig }                from "@/decision/rules/stored-rule";
import { loadTenantRulesConfig }                 from "@/decision/rules/load-tenant-rules";
import { savePage, getPagesByTenant }            from "@/page-store";
import type { EditablePage, EditableContentBlock } from "@/page-store";
import { REGISTERED_CONTENT_BLOCK_TYPES }        from "@/page-config";
import type { ContentBlockKey }                  from "@/tenant/types";
import { getTenantById }                         from "@/tenant/server";
import { writeBlueprintPagesToStatamic }         from "./write-cms-pages";
import type {
  ApplyBlueprintOptions,
  ApplyBlueprintResult,
  BlueprintScoringRule,
  BlueprintSequencePattern,
} from "./blueprint-types";
import { revalidatePath } from "next/cache";

// ── DB type cast helpers (mirrors pattern used in behavior/actions.ts) ────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function dbAny(): any { return getDb() as any; }
function asRows<T>(res: any): { data: T[] | null; error: any } { return res as any; }
function asVoid(res: any): { error: any } { return res as any; }

// ── Main apply function ───────────────────────────────────────────────────────

export async function applyBlueprint(
  options: ApplyBlueprintOptions,
): Promise<ApplyBlueprintResult> {
  const { tenantId, blueprint, force = false, applyTheme = true } = options;

  let rulesCreated        = 0;
  let rulesSkipped        = 0;
  let scoringRulesCreated = 0;
  let sequencesCreated    = 0;
  let pagesCreated        = 0;
  let themeApplied        = false;

  const db = dbAny();

  // ── Step 1: Upsert behavioral rules ──────────────────────────────────────

  try {
    // Load existing config (or empty seed).
    const existing = await loadTenantRulesConfig(tenantId);
    const rulesKey = `homepage_${tenantId}`;

    // Assign stable IDs to blueprint rules.
    const blueprintRules = blueprint.rules.map((r, i) => ({
      ...r,
      id: `${blueprint.key}_rule_${i + 1}`,
    }));

    let finalRules = blueprintRules;

    if (!force && existing && (existing as any).rules?.length > 0) {
      // Non-destructive: keep existing custom rules, add any missing blueprint rules.
      const existingIds = new Set((existing as any).rules?.map((r: any) => r.id) ?? []);
      const newRules = blueprintRules.filter((r) => !existingIds.has(r.id));
      finalRules = [...((existing as any).rules ?? []), ...newRules];
      rulesSkipped = blueprintRules.length - newRules.length;
      rulesCreated = newRules.length;
    } else {
      rulesCreated = blueprintRules.length;
    }

    const config: StoredRulesConfig = {
      ...((existing as any) ?? {}),
      rules: finalRules,
      defaultPlan: (existing as any)?.defaultPlan ?? {
        heroKey:  "hero_default",
        proofKey: "proof_default",
        ctaKey:   "cta_default",
      },
    };

    const serialized = JSON.stringify(config);
    const upsertRes = asVoid(
      await db
        .from("rules_config")
        .upsert({ key: rulesKey, config: serialized, updated_at: new Date().toISOString() }),
    );

    if (upsertRes.error) {
      return {
        ok:                  false,
        error:               `Failed to write rules: ${upsertRes.error.message}`,
        pagesCreated:        0,
        rulesCreated:        0,
        rulesSkipped:        0,
        scoringRulesCreated: 0,
        sequencesCreated:    0,
        themeApplied:        false,
      };
    }
  } catch (err) {
    return {
      ok:                  false,
      error:               `Rules error: ${err instanceof Error ? err.message : String(err)}`,
      pagesCreated:        0,
      rulesCreated:        0,
      rulesSkipped:        0,
      scoringRulesCreated: 0,
      sequencesCreated:    0,
      themeApplied:        false,
    };
  }

  // ── Step 2: Insert scoring rules (skip existing by key unless force) ──────

  try {
    if (!force) {
      // Load existing scoring rule keys for this tenant.
      const existingRes = asRows<{ key: string }>(
        await db
          .from("behavior_scoring_rules")
          .select("key")
          .eq("tenant_id", tenantId),
      );
      const existingKeys = new Set(
        (existingRes.data ?? []).map((r) => r.key).filter(Boolean),
      );

      const toInsert = blueprint.scoringRules.filter(
        (r) => !existingKeys.has(r.key),
      );

      if (toInsert.length > 0) {
        const rows = toInsert.map((r) => buildScoringRuleRow(tenantId, r));
        const insertRes = asVoid(await db.from("behavior_scoring_rules").insert(rows));
        if (insertRes.error) {
          // Log but don't fail the whole operation.
          console.warn("[apply-blueprint] scoring rules insert partial error:", insertRes.error.message);
        } else {
          scoringRulesCreated = rows.length;
        }
      }
    } else {
      // Force: delete existing, re-insert all.
      await db.from("behavior_scoring_rules").delete().eq("tenant_id", tenantId);
      const rows = blueprint.scoringRules.map((r) => buildScoringRuleRow(tenantId, r));
      const insertRes = asVoid(await db.from("behavior_scoring_rules").insert(rows));
      if (!insertRes.error) scoringRulesCreated = rows.length;
    }
  } catch (err) {
    // Non-fatal — log and continue.
    console.warn("[apply-blueprint] scoring rules error:", err);
  }

  // ── Step 3: Insert sequence patterns (skip existing by slug unless force) ──

  try {
    if (!force) {
      const existingRes = asRows<{ slug: string }>(
        await db
          .from("behavior_sequence_patterns")
          .select("slug")
          .eq("tenant_id", tenantId),
      );
      const existingSlugs = new Set((existingRes.data ?? []).map((r) => r.slug));

      const toInsert = blueprint.sequencePatterns.filter(
        (p) => !existingSlugs.has(p.slug),
      );

      if (toInsert.length > 0) {
        const rows = toInsert.map((p) => buildSequenceRow(tenantId, p));
        const insertRes = asVoid(await db.from("behavior_sequence_patterns").insert(rows));
        if (!insertRes.error) sequencesCreated = rows.length;
      }
    } else {
      await db.from("behavior_sequence_patterns").delete().eq("tenant_id", tenantId);
      const rows = blueprint.sequencePatterns.map((p) => buildSequenceRow(tenantId, p));
      const insertRes = asVoid(await db.from("behavior_sequence_patterns").insert(rows));
      if (!insertRes.error) sequencesCreated = rows.length;
    }
  } catch (err) {
    console.warn("[apply-blueprint] sequences error:", err);
  }

  // ── Step 4: Apply theme preset ────────────────────────────────────────────

  if (applyTheme && blueprint.recommendedThemePreset) {
    try {
      // Update or insert tenant_settings.design.theme.preset.
      const settingsRes = asRows<{ id: string; settings: Record<string, unknown> }>(
        await db
          .from("tenant_settings")
          .select("id, settings")
          .eq("tenant_id", tenantId)
          .limit(1),
      );

      const existing = settingsRes.data?.[0];
      const id       = existing?.id ?? crypto.randomUUID();
      const settings = existing?.settings ?? {};

      // design.theme is a ThemePresetKey string (e.g. "modern-saas", "corporate-blue").
      // Set it directly — never wrap it in a nested object, which would corrupt
      // the DB by spreading the string into numeric character indices + a "preset" key.
      const updatedSettings = {
        ...settings,
        design: {
          ...((settings.design as Record<string, unknown>) ?? {}),
          theme: blueprint.recommendedThemePreset,
        },
      };

      const themeRes = asVoid(
        await db.from("tenant_settings").upsert({
          id,
          tenant_id:  tenantId,
          settings:   updatedSettings,
          updated_at: new Date().toISOString(),
        }),
      );

      if (!themeRes.error) themeApplied = true;
    } catch (err) {
      console.warn("[apply-blueprint] theme error:", err);
    }
  }

  // ── Step 5: Scaffold pages into the platform page-store ──────────────────────
  //
  // Non-destructive by slug: a page whose slug already exists is kept as-is
  // (unless force=true, which overwrites it in place, preserving its id). Blocks
  // are filtered to live registered types; the block content itself is left empty
  // for the operator to fill in via the page editor. Homepage ("/") is stored
  // with the empty slug, matching the store's homepage convention.
  //
  // For Platform-CMS tenants these pages render live. For external-CMS tenants
  // (Statamic/Sanity/Storyblok) they are real, editable page records in the
  // platform, but the public site continues to render from that external CMS.
  try {
    const tenant = await getTenantById(tenantId);

    if (tenant && tenant.cms?.provider === "statamic") {
      // External Statamic CMS: write real page entries so they render on the
      // live site. Non-destructive by slug (unless force).
      const res = await writeBlueprintPagesToStatamic(tenant, blueprint, force);
      pagesCreated = res.created;
      if (res.warnings.length > 0) {
        console.warn("[apply-blueprint] Statamic page warnings:", res.warnings);
      }
    } else {
      // Platform-CMS (or unknown provider): scaffold into the platform page-store.
      const existingPages = await getPagesByTenant(tenantId);
      const bySlug = new Map(existingPages.map((p) => [p.slug, p]));
      const allowedBlocks = new Set<string>(REGISTERED_CONTENT_BLOCK_TYPES);
      const now = new Date().toISOString();

      for (const bp of blueprint.pages) {
        const slug = bp.slug.replace(/^\//, "").trim();   // "/" → "" (homepage)
        const existing = bySlug.get(slug);
        if (existing && !force) continue;                 // preserve customised page

        const contentBlocks: EditableContentBlock[] = bp.blocks
          .filter((b) => allowedBlocks.has(b.type))
          .map((b) => ({
            id:        crypto.randomUUID(),
            blockType: b.type as ContentBlockKey,
            variant:   "default",
            data:      {},
          }));

        const page: EditablePage = {
          id:           existing?.id ?? crypto.randomUUID(),
          tenantId,
          slug,
          title:        bp.title,
          templateKey:  "marketing-page",
          contextSlots: existing?.contextSlots ?? [],
          contentBlocks,
          seo:          existing?.seo ?? {},
          createdAt:    existing?.createdAt ?? now,
          updatedAt:    now,
        };
        await savePage(page);
        pagesCreated++;
      }
    }
  } catch (err) {
    console.warn("[apply-blueprint] pages error:", err);
  }

  // ── Step 6: Revalidate admin pages ────────────────────────────────────────

  revalidatePath(`/admin/tenants/${tenantId}/blueprints`);
  revalidatePath(`/admin/tenants/${tenantId}/behavior`);
  revalidatePath(`/admin/tenants/${tenantId}/rules`);
  revalidatePath(`/admin/tenants/${tenantId}/pages`);
  revalidatePath(`/admin/tenants/${tenantId}/content`);

  return {
    ok:                  true,
    pagesCreated,
    rulesCreated,
    rulesSkipped,
    scoringRulesCreated,
    sequencesCreated,
    themeApplied,
  };
}

// ── Row builders ──────────────────────────────────────────────────────────────

function buildScoringRuleRow(
  tenantId: string,
  r: BlueprintScoringRule,
): Record<string, unknown> {
  return {
    tenant_id:     tenantId,
    key:           r.key,
    label:         r.label,
    description:   r.description ?? null,
    event_type:    r.event_type,
    event_value:   r.event_value ?? null,
    page_category: r.page_category ?? null,
    score:         r.score,
    decay_profile: r.decay_profile,
    is_active:     true,
    priority:      r.priority,
  };
}

function buildSequenceRow(
  tenantId: string,
  p: BlueprintSequencePattern,
): Record<string, unknown> {
  return {
    tenant_id:        tenantId,
    slug:             p.slug,
    label:            p.label,
    sequence:         JSON.stringify(p.sequence),
    max_gap_minutes:  p.max_gap_minutes,
    score:            p.score,
  };
}
