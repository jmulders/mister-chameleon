"use server";

/**
 * app/admin/tenants/[tenantId]/integrations/pipeline/actions.ts
 *
 * Server actions for reading and writing per-tenant enrichment pipeline
 * stage configuration (ordering + activation state).
 *
 * Data is stored in `public.tenant_pipeline_stages` — one row per
 * (tenant_id, stage_key) pair.  When no rows exist for a tenant, callers
 * fall back to the default config from PIPELINE_STAGE_REGISTRY.
 */

import { createClient }             from "@supabase/supabase-js";
import { revalidatePath }           from "next/cache";
import { getRequiredAdminSession }  from "@/lib/admin-auth/authorization";
import {
  PIPELINE_STAGE_REGISTRY,
  getDefaultPipelineConfig,
  type PipelineStageDefinition,
} from "@/lib/enrichment/pipeline-stage-registry";
import {
  getPlatformFirstPartyCompanySettings,
  firstPartyCompanyFlags,
} from "@/platform/platform-store";

// ── First-party company-DB ToS toggles ────────────────────────────────────────
//
// Two independent per-tenant policy toggles, stored in tenant_pipeline_stages
// under dedicated keys (NOT reorderable pipeline stages). Each is tri-state:
//   • "inherit" — no DB row; falls back to the platform default.
//   • "on"/"off"— a DB row overrides the platform default.
const FIRSTPARTY_CONSUME_KEY    = "firstpartyConsume";
const FIRSTPARTY_CONTRIBUTE_KEY = "firstpartyContribute";
export type FirstPartyToggleState = "inherit" | "on" | "off";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineStageRow {
  stageKey:    string;
  position:    number;
  enabled:     boolean;
  /** Merged from PIPELINE_STAGE_REGISTRY — not stored in DB. */
  meta:        PipelineStageDefinition;
}

export interface PipelineConfig {
  tenantId: string;
  /** All 9 configurable stages, sorted by (wave, position). */
  stages:   PipelineStageRow[];
  /** True when the config came from DB; false when using defaults. */
  fromDb:   boolean;
}

export interface PipelineActionResult {
  ok:      boolean;
  error?:  string;
}

// ── Supabase client ───────────────────────────────────────────────────────────

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── First-party toggles: read + write ─────────────────────────────────────────

export interface FirstPartyTogglesConfig {
  tenantId:            string;
  consume:            FirstPartyToggleState;
  contribute:         FirstPartyToggleState;
  /** Resolved platform defaults, shown as the "inherit" value. */
  platformConsume:    boolean;
  platformContribute: boolean;
}

export async function getFirstPartyTogglesAction(
  tenantId: string,
): Promise<FirstPartyTogglesConfig> {
  await getRequiredAdminSession();

  const db = makeClient();
  const platformResult = await getPlatformFirstPartyCompanySettings();
  const defaults = firstPartyCompanyFlags(platformResult.ok ? platformResult.data : {});

  let consume:    FirstPartyToggleState = "inherit";
  let contribute: FirstPartyToggleState = "inherit";
  try {
    const { data } = await db
      .from("tenant_pipeline_stages")
      .select("stage_key, enabled")
      .eq("tenant_id", tenantId)
      .in("stage_key", [FIRSTPARTY_CONSUME_KEY, FIRSTPARTY_CONTRIBUTE_KEY]);
    for (const row of (data ?? []) as { stage_key: string; enabled: boolean }[]) {
      const state: FirstPartyToggleState = row.enabled ? "on" : "off";
      if (row.stage_key === FIRSTPARTY_CONSUME_KEY)    consume    = state;
      if (row.stage_key === FIRSTPARTY_CONTRIBUTE_KEY) contribute = state;
    }
  } catch { /* table missing → inherit */ }

  return {
    tenantId,
    consume,
    contribute,
    platformConsume:    defaults.consume,
    platformContribute: defaults.contribute,
  };
}

async function applyToggle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:       any,
  tenantId: string,
  stageKey: string,
  state:    FirstPartyToggleState,
): Promise<{ error?: { code?: string; message: string } }> {
  if (state === "inherit") {
    const { error } = await db
      .from("tenant_pipeline_stages")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("stage_key", stageKey);
    return { error: error ?? undefined };
  }
  const { error } = await db
    .from("tenant_pipeline_stages")
    .upsert(
      { tenant_id: tenantId, stage_key: stageKey, position: 1, enabled: state === "on", updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,stage_key" },
    );
  return { error: error ?? undefined };
}

export async function saveFirstPartyTogglesAction(
  tenantId:   string,
  consume:    FirstPartyToggleState,
  contribute: FirstPartyToggleState,
): Promise<PipelineActionResult> {
  await getRequiredAdminSession();
  if (!tenantId) return { ok: false, error: "tenantId is required." };

  const db = makeClient();
  for (const [key, state] of [
    [FIRSTPARTY_CONSUME_KEY, consume],
    [FIRSTPARTY_CONTRIBUTE_KEY, contribute],
  ] as const) {
    const { error } = await applyToggle(db, tenantId, key, state);
    if (error) {
      if (error.code === "42P01") {
        return { ok: false, error: "Pipeline stages table not found. Apply migration 090, then reload." };
      }
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(`/admin/tenants/${tenantId}/integrations/pipeline`);
  return { ok: true };
}

// ── getPipelineConfig ─────────────────────────────────────────────────────────

/**
 * Load the enrichment pipeline config for a tenant.
 *
 * Returns DB rows when present, otherwise returns the default config from
 * PIPELINE_STAGE_REGISTRY.  Each row is enriched with the static metadata
 * (label, description, wave, etc.) from the registry.
 *
 * Stages in the registry that have no DB row get their default values.
 */
export async function getPipelineConfigAction(
  tenantId: string,
): Promise<PipelineConfig> {
  await getRequiredAdminSession();

  const db = makeClient();

  const { data, error } = await db
    .from("tenant_pipeline_stages")
    .select("stage_key, position, enabled")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });

  // 42P01 = table does not exist (migration not yet applied) — return defaults silently
  const fromDb = !error && data !== null && data.length > 0;

  // Build a map of DB values for fast lookup
  const dbMap = new Map(
    fromDb
      ? (data as { stage_key: string; position: number; enabled: boolean }[]).map(
          (r) => [r.stage_key, { position: r.position, enabled: r.enabled }],
        )
      : [],
  );

  // Merge registry metadata with DB values (or defaults)
  const stages: PipelineStageRow[] = PIPELINE_STAGE_REGISTRY.map((def) => {
    const dbRow = dbMap.get(def.key);
    return {
      stageKey: def.key,
      position: dbRow?.position ?? def.defaultPosition,
      enabled:  dbRow?.enabled  ?? def.defaultEnabled,
      meta:     def,
    };
  });

  // Sort by wave group first, then position within wave
  const waveOrder: Record<string, number> = { "1": 0, "2": 1, "sequential": 2 };
  stages.sort((a, b) => {
    const wA = waveOrder[String(a.meta.wave)] ?? 0;
    const wB = waveOrder[String(b.meta.wave)] ?? 0;
    if (wA !== wB) return wA - wB;
    return a.position - b.position;
  });

  return { tenantId, stages, fromDb };
}

// ── savePipelineConfig ────────────────────────────────────────────────────────

/**
 * Persist the enrichment pipeline config for a tenant.
 *
 * Upserts all 9 stage rows in a single call.  Existing rows are overwritten.
 * Stage keys not present in PIPELINE_STAGE_REGISTRY are silently dropped.
 */
export async function savePipelineConfigAction(
  tenantId: string,
  stages: Array<{ stageKey: string; position: number; enabled: boolean }>,
): Promise<PipelineActionResult> {
  await getRequiredAdminSession();

  if (!tenantId) {
    return { ok: false, error: "tenantId is required." };
  }

  // Validate: only known stage keys are allowed
  const validKeys = new Set(PIPELINE_STAGE_REGISTRY.map((s) => s.key));
  const rows = stages
    .filter((s) => validKeys.has(s.stageKey))
    .map((s) => ({
      tenant_id:  tenantId,
      stage_key:  s.stageKey,
      position:   Math.max(1, s.position),
      enabled:    Boolean(s.enabled),
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return { ok: false, error: "No valid stage keys provided." };
  }

  const db = makeClient();

  const { error } = await db
    .from("tenant_pipeline_stages")
    .upsert(rows, { onConflict: "tenant_id,stage_key" });

  if (error) {
    console.error("[pipeline/actions] savePipelineConfigAction error:", error);
    // 42P01 = table does not exist — migration not applied yet
    if (error.code === "42P01") {
      return {
        ok:    false,
        error: "Pipeline stages table not found. Run `supabase db push` to apply migration 090, then reload.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/tenants/${tenantId}/integrations/pipeline`);
  return { ok: true };
}

// ── resetPipelineConfig ───────────────────────────────────────────────────────

/**
 * Reset a tenant's pipeline config to the platform defaults.
 *
 * Deletes all rows for the tenant and re-inserts the default config from
 * PIPELINE_STAGE_REGISTRY.
 */
export async function resetPipelineConfigAction(
  tenantId: string,
): Promise<PipelineActionResult> {
  await getRequiredAdminSession();

  if (!tenantId) {
    return { ok: false, error: "tenantId is required." };
  }

  const db = makeClient();

  // Delete existing rows for this tenant — but only the reorderable pipeline
  // stages. The first-party ToS toggles (firstpartyConsume / firstpartyContribute)
  // are policy rows, not pipeline stages: a pipeline-order reset must not silently
  // flip a tenant's data-sharing permissions.
  const { error: deleteError } = await db
    .from("tenant_pipeline_stages")
    .delete()
    .eq("tenant_id", tenantId)
    .in("stage_key", PIPELINE_STAGE_REGISTRY.map((s) => s.key));

  if (deleteError) {
    console.error("[pipeline/actions] resetPipelineConfigAction delete error:", deleteError);
    if (deleteError.code === "42P01") {
      return {
        ok:    false,
        error: "Pipeline stages table not found. Run `supabase db push` to apply migration 090, then reload.",
      };
    }
    return { ok: false, error: deleteError.message };
  }

  // Insert defaults
  const defaults = getDefaultPipelineConfig();
  const rows = defaults.map((d) => ({
    tenant_id:  tenantId,
    stage_key:  d.stageKey,
    position:   d.position,
    enabled:    d.enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await db
    .from("tenant_pipeline_stages")
    .insert(rows);

  if (insertError) {
    console.error("[pipeline/actions] resetPipelineConfigAction insert error:", insertError);
    return { ok: false, error: insertError.message };
  }

  revalidatePath(`/admin/tenants/${tenantId}/integrations/pipeline`);
  return { ok: true };
}
