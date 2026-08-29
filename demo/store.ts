/**
 * demo/store.ts
 *
 * Supabase CRUD helpers for the demo_instances table.
 * Server only — uses service-role client.
 *
 * v2: supports new rich content columns (content_en, content_nl, brand_signals, page_images).
 * Falls back gracefully when columns are missing (older DB schema).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DemoInstance,
  DemoScenario,
  DemoPageContent,
  BrandSignals,
  DemoImages,
  DemoInstanceMode,
  DemoScreenshot,
  SiteAnalysis,
  SiteCategory,
} from "./types";

// ── Column name extractor ─────────────────────────────────────────────────────

function extractMissingColumn(message: string): string | null {
  let m = message.match(/Could not find the '([^']+)' column/);
  if (m) return m[1];
  m = message.match(/column "([^"]+)"/);
  if (m) return m[1];
  return null;
}

// ── ID generation ─────────────────────────────────────────────────────────────

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateShortId(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Uses crypto.randomUUID() while the DB column is uuid type.
 * Switch to generateShortId() after migration 063 changes the column to text.
 */
function generateDemoId(): string {
  return crypto.randomUUID();
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateDemoInput {
  analysis:     SiteAnalysis;
  scenarios:    DemoScenario[];
  generatedBy?: string;
  generationMs?: number;
  expiryDays?:  number;
  // v2 rich content
  contentEn?:   DemoPageContent | null;
  contentNl?:   DemoPageContent | null;
  pageImages?:  DemoImages | null;
  // v3 mirror mode
  demoMode?:      DemoInstanceMode;
  mirroredHtml?:  string | null;
  /**
   * AI-generated slot content per blueprint scenario.
   * Stored in demo_instances.scenario_slots and served by the decide endpoint
   * when the scenario panel passes _demoId in context.
   */
  scenarioSlots?: Record<string, Record<string, string>> | null;
  /**
   * Curated per-block design tokens extracted from the prospect's site, merged
   * into brand_signals so the synthetic demo renders in their brand style.
   */
  blockTokens?:   Record<string, string> | null;
  /** Screenshot demo payload (screenshot URL + vision hotspot regions). */
  screenshot?:    DemoScreenshot | null;
}

export async function createDemoInstance(
  client: SupabaseClient,
  input:  CreateDemoInput,
): Promise<DemoInstance> {
  const {
    analysis,
    scenarios,
    generatedBy,
    generationMs,
    expiryDays   = 7,
    contentEn    = null,
    contentNl    = null,
    pageImages   = null,
    demoMode      = "mirror",
    mirroredHtml  = null,
    scenarioSlots = null,
    blockTokens   = null,
    screenshot    = null,
  } = input;

  const id        = generateDemoId();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const row: Record<string, unknown> = {
    id,
    source_url:       analysis.fetchedUrl,
    site_name:        analysis.title,
    site_description: analysis.description,
    site_category:    analysis.category,
    primary_color:    analysis.primaryColor,
    secondary_color:  analysis.secondaryColor,
    logo_url:         analysis.logoUrl    ?? null,
    favicon_url:      analysis.faviconUrl ?? null,
    scenarios:        scenarios as unknown as object[],
    expires_at:       expiresAt,
    generated_by:     generatedBy ?? null,
    generation_ms:    generationMs ?? null,
    content_en:       contentEn,
    content_nl:       contentNl,
    page_images:      pageImages,
    brand_signals:
      (analysis.brandSignals || blockTokens)
        ? { ...(analysis.brandSignals ?? {}), ...(blockTokens ? { blockTokens } : {}) }
        : null,
    demo_mode:        demoMode,
    mirrored_html:    mirroredHtml,
    scenario_slots:   scenarioSlots,
    screenshot:       screenshot,
  };

  let { data, error } = await client
    .from("demo_instances")
    .insert(row)
    .select()
    .single();

  // ── Graceful fallback for missing optional columns ────────────────────────
  //
  // scenario_slots (migration 128) and other columns added after the initial
  // schema may not exist yet.  If the insert fails because an optional column
  // is missing, retry without it so demos keep working until the migration
  // is applied.  The decide endpoint falls back to DEMO_SCENARIO_PLANS in
  // that case.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    const missingCol = extractMissingColumn(error.message ?? "");
    if (missingCol === "scenario_slots") {
      console.warn("[demo/store] scenario_slots column missing — retrying without it (apply migration 128)");
      const rowWithout = { ...row };
      delete rowWithout["scenario_slots"];
      const retry = await client
        .from("demo_instances")
        .insert(rowWithout)
        .select()
        .single();
      data  = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    const code = error.code ?? "unknown";
    const msg  = error.message ?? "unknown error";

    console.error("[demo/store] createDemoInstance failed", {
      fn: "createDemoInstance", table: "demo_instances", code, message: msg,
    });

    let detail: string;
    switch (code) {
      case "PGRST205":
      case "42P01":
        detail = `demo_instances table missing — run: supabase db push (migration 052)`;
        break;
      case "PGRST204":
      case "42703": {
        const col = extractMissingColumn(msg);
        detail = col
          ? `column '${col}' missing from demo_instances — run: supabase db push (migration 128)`
          : `column missing in demo_instances — run: supabase db push (migration 128)`;
        break;
      }
      case "23502":
        detail = `NOT NULL constraint violated in demo_instances — ${msg}`;
        break;
      case "23505":
        detail = `duplicate key in demo_instances — retry (code: ${code})`;
        break;
      default:
        detail = `${msg} (code: ${code})`;
    }

    throw new Error(`[demo/store] createDemoInstance failed: ${detail}`);
  }

  return normalizeDemoRow(data);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getDemoById(
  client:  SupabaseClient,
  demoId:  string,
): Promise<DemoInstance | null> {
  const { data, error } = await client
    .from("demo_instances")
    .select("*")
    .eq("id", demoId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[demo/store] getDemoById: demo_instances table missing", {
        fn: "getDemoById", table: "demo_instances", code: error.code,
      });
      return null;
    }
    throw new Error(
      `[demo/store] getDemoById failed for id "${demoId}": ${error.message} (code: ${error.code})`,
    );
  }

  if (!data) return null;

  const demo = normalizeDemoRow(data);
  if (new Date(demo.expires_at) < new Date()) return null;

  return demo;
}

export async function listDemoInstances(
  client:  SupabaseClient,
  limit    = 50,
): Promise<DemoInstance[]> {
  const { data, error } = await client
    .from("demo_instances")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(
      `[demo/store] listDemoInstances failed: ${error.message} (code: ${error.code})`,
    );
  }

  return (data ?? []).map(normalizeDemoRow);
}

// ── View count ────────────────────────────────────────────────────────────────

export async function incrementViewCount(
  client:  SupabaseClient,
  demoId:  string,
): Promise<void> {
  const { error } = await client.rpc("increment_demo_view_count", { p_demo_id: demoId });
  if (error && error.code !== "PGRST202" && error.code !== "42883") {
    console.warn("[demo/store] incrementViewCount RPC error", {
      demoId, code: error.code, message: error.message,
    });
  }
}

export async function bumpViewCount(
  client:  SupabaseClient,
  demoId:  string,
  current: number,
): Promise<void> {
  await client
    .from("demo_instances")
    .update({ view_count: current + 1 })
    .eq("id", demoId)
    .then(({ error }) => {
      if (error) console.warn("[demo/store] bumpViewCount failed", { demoId, code: error.code });
    });
}

// ── Normaliser ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDemoRow(row: any): DemoInstance {
  return {
    id:               row.id,
    source_url:       row.source_url,
    site_name:        row.site_name        ?? "",
    site_description: row.site_description ?? "",
    site_category:    (row.site_category   ?? "general") as SiteCategory,
    primary_color:    row.primary_color    ?? "#3b82f6",
    secondary_color:  row.secondary_color  ?? "#1e3a8a",
    logo_url:         row.logo_url         ?? null,
    favicon_url:      row.favicon_url      ?? null,
    scenarios:        (row.scenarios       ?? []) as DemoScenario[],
    created_at:       row.created_at,
    expires_at:       row.expires_at,
    view_count:       row.view_count       ?? 0,
    generated_by:     row.generated_by     ?? null,
    generation_ms:    row.generation_ms    ?? null,
    content_en:       (row.content_en      ?? null) as DemoPageContent | null,
    content_nl:       (row.content_nl      ?? null) as DemoPageContent | null,
    brand_signals:    (row.brand_signals   ?? null) as BrandSignals | null,
    page_images:      (row.page_images     ?? null) as DemoImages | null,
    demo_mode:        (row.demo_mode       ?? "mirror") as DemoInstanceMode,
    mirrored_html:    (row.mirrored_html   ?? null) as string | null,
    scenario_slots:   (row.scenario_slots  ?? null) as Record<string, Record<string, string>> | null,
    screenshot:       (row.screenshot      ?? null) as DemoScreenshot | null,
  };
}
