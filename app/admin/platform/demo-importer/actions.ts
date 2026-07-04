/**
 * Demo Importer — Server Actions
 *
 * Accessible at /admin/platform/demo-importer.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   getDemoImporterStatusAction   — provider readiness + recent run summary
 *   getDemoImporterSettingsAction — behavior + output defaults (non-secret)
 *   saveDemoImporterSettingsAction — persist settings to platform_settings
 *   testAnalyzerConnectionAction  — live-fetch a URL through the analyzer
 *   runDemoTestAction             — analysis-only or full dry-run generation
 *
 * ─── Provider model ───────────────────────────────────────────────────────────
 *
 *   analyzer     — built-in HTTP fetcher + HTML parser (no key required)
 *   ai_content   — Anthropic / template fallback for scenario copy
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Behavior + output settings are stored in platform_settings where
 *   key = "demo_importer".  No secrets are stored — AI keys live in the
 *   AI integration section (/admin/platform/integrations/ai).
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   All actions require a valid admin session (mc_admin_token cookie).
 *   Secrets (ANTHROPIC_API_KEY) are read server-side and never returned.
 */

"use server";

import { cookies }          from "next/headers";
import { revalidatePath }   from "next/cache";
import { createClient }     from "@supabase/supabase-js";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { analyzeSite }      from "@/demo/analyzer";
import { generateScenarios } from "@/demo/content-generator";
import { listDemoInstances } from "@/demo/store";
import { resolveRequestBaseUrl } from "@/lib/base-url";
import type { SiteAnalysis, DemoInstance } from "@/demo/types";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) return { ok: false, error: "No admin session — please log in." };

  const session = await verifySession(token);
  if (!session) return { ok: false, error: "Admin session expired — please log in again." };
  if (session.twoFaEnabled && !session.twoFaVerified)
    return { ok: false, error: "Two-factor authentication required. Complete 2FA at /admin/login/2fa." };

  return { ok: true, email: session.email };
}

// ── Supabase service-role client ──────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProviderStatus = "ready" | "partial" | "not_configured";

export interface ProviderInfo {
  id:          string;
  label:       string;
  description: string;
  status:      ProviderStatus;
  statusNote:  string;
  /** If the provider has a setup page elsewhere, link to it. */
  configPath?: string;
}

export interface DemoImporterStatus {
  overall:       ProviderStatus;
  providers:     ProviderInfo[];
  recentRuns:    RecentRunSummary[];
  totalRuns:     number;
  lastRunAt:     string | null;   // ISO
  lastExpiredAt: string | null;   // ISO — last expired demo
}

export interface RecentRunSummary {
  id:           string;
  sourceUrl:    string;
  siteName:     string;
  siteCategory: string;
  generatedAt:  string;
  expiresAt:    string;
  isExpired:    boolean;
  viewCount:    number;
  generationMs: number | null;
  generatedBy:  string | null;
}

export interface DemoImporterSettings {
  // Behavior
  analyzeHomepageOnly:    boolean;
  followNavLinks:         boolean;
  maxPages:               number;
  detectColors:           boolean;
  detectTypography:       boolean;
  detectLayoutPatterns:   boolean;
  generatePreset:         boolean;
  generateBlueprint:      boolean;
  // Output defaults
  defaultSiteType:        string;
  defaultPageSet:         string;
  defaultScenarioPack:    string;
  defaultThemeFallback:   string;
  expiryDays:             number;
}

const SETTINGS_DEFAULTS: DemoImporterSettings = {
  analyzeHomepageOnly:   true,
  followNavLinks:        false,
  maxPages:              1,
  detectColors:          true,
  detectTypography:      false,
  detectLayoutPatterns:  false,
  generatePreset:        false,
  generateBlueprint:     false,
  defaultSiteType:       "general",
  defaultPageSet:        "homepage",
  defaultScenarioPack:   "standard-5",
  defaultThemeFallback:  "neutral",
  expiryDays:            7,
};

// ── Provider status resolution ────────────────────────────────────────────────

async function resolveProviders(): Promise<ProviderInfo[]> {
  // ── Analyzer (built-in) ──────────────────────────────────────────────────────
  const analyzer: ProviderInfo = {
    id:          "analyzer",
    label:       "Website Analyzer",
    description: "Fetches the prospect URL and extracts brand signals: title, description, colors, logo, favicon, and industry category. Built-in — no API key required.",
    status:      "ready",
    statusNote:  "Built-in HTTP fetcher — always available",
  };

  // ── AI content provider (Anthropic) ──────────────────────────────────────────
  // Priority: platform settings DB → ANTHROPIC_API_KEY env var
  let anthropicKey: string | null = null;
  let keySource = "env";
  try {
    const { getPlatformAiSettings } = await import("@/platform/platform-store");
    const result = await getPlatformAiSettings();
    if (result.ok && result.data.anthropicKey) {
      anthropicKey = result.data.anthropicKey;
      keySource    = "dashboard";
    }
  } catch { /* DB unavailable */ }

  if (!anthropicKey) {
    const envKey = (process.env["ANTHROPIC_API_KEY"] ?? "").trim();
    if (envKey && envKey !== "dummy") {
      anthropicKey = envKey;
      keySource    = "env";
    }
  }

  const looksValid = Boolean(anthropicKey && anthropicKey.startsWith("sk-ant-"));

  let aiStatus:     ProviderStatus;
  let aiStatusNote: string;

  if (!anthropicKey) {
    aiStatus     = "not_configured";
    aiStatusNote = "Anthropic API key not set — content uses built-in templates. Add it in Admin → Integrations → AI.";
  } else if (!looksValid) {
    aiStatus     = "partial";
    aiStatusNote = `Key set via ${keySource} but doesn't look like a valid Anthropic key (expected sk-ant-…). Templates used as fallback.`;
  } else {
    aiStatus     = "ready";
    aiStatusNote = `Anthropic key configured via ${keySource} — AI-generated scenario copy is active.`;
  }

  const aiContent: ProviderInfo = {
    id:          "ai_content",
    label:       "AI Content Provider",
    description: "Generates personalised scenario copy using Anthropic Claude. Falls back to built-in industry templates when no API key is configured.",
    status:      aiStatus,
    statusNote:  aiStatusNote,
    configPath:  "/admin/platform/integrations/ai",
  };

  return [analyzer, aiContent];
}

function overallStatus(providers: ProviderInfo[]): ProviderStatus {
  if (providers.every((p) => p.status === "not_configured")) return "not_configured";
  if (providers.some((p)  => p.status === "not_configured" || p.status === "partial")) return "partial";
  return "ready";
}

// ── getDemoImporterStatusAction ───────────────────────────────────────────────

/**
 * Returns provider readiness, recent demo run summaries, and lifecycle stats.
 *
 * Never returns secrets.  Safe to pass to client components.
 */
export async function getDemoImporterStatusAction(): Promise<
  | { ok: true;  status: DemoImporterStatus }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const providers = await resolveProviders();
  const overall   = overallStatus(providers);

  let recentInstances: DemoInstance[] = [];
  try {
    recentInstances = await listDemoInstances(getServiceClient(), 20);
  } catch (err) {
    console.error(
      `[demo-importer/actions] getDemoImporterStatusAction: listDemoInstances error — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    // Non-fatal — proceed with empty list
  }

  const now       = new Date();
  const runs: RecentRunSummary[] = recentInstances.map((inst) => ({
    id:           inst.id,
    sourceUrl:    inst.source_url,
    siteName:     inst.site_name,
    siteCategory: inst.site_category,
    generatedAt:  inst.created_at,
    expiresAt:    inst.expires_at,
    isExpired:    new Date(inst.expires_at) < now,
    viewCount:    inst.view_count,
    generationMs: inst.generation_ms,
    generatedBy:  inst.generated_by,
  }));

  const lastRun    = recentInstances[0] ?? null;
  const lastExpired = recentInstances.find((i) => new Date(i.expires_at) < now) ?? null;

  return {
    ok: true,
    status: {
      overall,
      providers,
      recentRuns:    runs,
      totalRuns:     recentInstances.length,  // bounded by limit=20; display as "20+" if full
      lastRunAt:     lastRun     ? lastRun.created_at     : null,
      lastExpiredAt: lastExpired ? lastExpired.expires_at : null,
    },
  };
}

// ── getDemoImporterSettingsAction ─────────────────────────────────────────────

/**
 * Load behavior + output default settings from platform_settings.
 * Falls back to SETTINGS_DEFAULTS when no row is stored yet.
 */
export async function getDemoImporterSettingsAction(): Promise<
  | { ok: true;  settings: DemoImporterSettings; updatedAt: string | null }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const db = getServiceClient();

  const { data, error } = await db
    .from("platform_settings")
    .select("value, updated_at")
    .eq("key", "demo_importer")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .maybeSingle() as any;

  if (error) {
    // 42P01 = table missing (migration not yet applied) — return defaults silently
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { ok: true, settings: { ...SETTINGS_DEFAULTS }, updatedAt: null };
    }
    console.error(
      `[demo-importer/actions] getDemoImporterSettingsAction: DB error — code=${error.code} message=${error.message}`,
    );
    return { ok: false, error: `Failed to load settings: ${error.message}` };
  }

  const stored = (data?.value ?? {}) as Partial<DemoImporterSettings>;

  return {
    ok:        true,
    settings:  { ...SETTINGS_DEFAULTS, ...stored },
    updatedAt: data?.updated_at ?? null,
  };
}

// ── saveDemoImporterSettingsAction ────────────────────────────────────────────

/**
 * Persist behavior + output default settings to platform_settings.
 *
 * All fields are non-secret — they are stored as-is.
 * Invalid numeric ranges are rejected at the action boundary.
 */
export async function saveDemoImporterSettingsAction(
  input: Partial<DemoImporterSettings>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  // Validate ranges
  if (input.maxPages !== undefined) {
    if (!Number.isInteger(input.maxPages) || input.maxPages < 1 || input.maxPages > 50) {
      return { ok: false, error: "maxPages must be an integer between 1 and 50." };
    }
  }
  if (input.expiryDays !== undefined) {
    if (!Number.isInteger(input.expiryDays) || input.expiryDays < 1 || input.expiryDays > 30) {
      return { ok: false, error: "expiryDays must be an integer between 1 and 30." };
    }
  }

  // Load current settings to merge (not overwrite)
  const current = await getDemoImporterSettingsAction();
  const base    = current.ok ? current.settings : { ...SETTINGS_DEFAULTS };
  const merged  = { ...base, ...input };

  const db = getServiceClient();

  const { error } = await db
    .from("platform_settings")
    .upsert(
      { key: "demo_importer", value: merged, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    ) as { error: { code?: string; message: string } | null };

  if (error) {
    console.error(
      `[demo-importer/actions] saveDemoImporterSettingsAction: DB error — code=${error.code} message=${error.message}`,
    );
    return { ok: false, error: `Failed to save settings: ${error.message}` };
  }

  revalidatePath("/admin/platform/demo-importer");
  return { ok: true };
}

// ── testAnalyzerConnectionAction ──────────────────────────────────────────────

/**
 * Live-test the website analyzer by running it against a URL.
 *
 * This is read-only — no DB writes.  Returns the SiteAnalysis result or an
 * error with the failing step and error message.
 */
export async function testAnalyzerConnectionAction(url: string): Promise<
  | {
      ok:            true;
      fetchSucceeded: boolean;
      title:          string;
      category:       string;
      primaryColor:   string;
      keywords:       string[];
      durationMs:     number;
    }
  | { ok: false; step: string; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, step: "auth", error: auth.error };

  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 4) {
    return { ok: false, step: "validation", error: "Please enter a valid URL (minimum 4 characters)." };
  }

  const start = Date.now();
  let analysis: SiteAnalysis;
  try {
    analysis = await analyzeSite(trimmed);
  } catch (err) {
    return {
      ok:    false,
      step:  "analyzer",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    ok:             true,
    fetchSucceeded: analysis.fetchSucceeded,
    title:          analysis.title,
    category:       analysis.category,
    primaryColor:   analysis.primaryColor,
    keywords:       analysis.keywords,
    durationMs:     Date.now() - start,
  };
}

// ── runDemoTestAction ─────────────────────────────────────────────────────────

/**
 * Run the full demo generation pipeline as a dry-run (no DB write) or
 * as a real generation (stores the demo instance).
 *
 * When `dryRun: true` the generated scenarios are returned but nothing is
 * persisted.  When `dryRun: false` a real demo_instances row is created and
 * the shareable URL is returned.
 */
export async function runDemoTestAction(input: {
  url:         string;
  analyzeOnly: boolean;
  dryRun:      boolean;
}): Promise<
  | {
      ok:             true;
      dryRun:         boolean;
      analyzeOnly:    boolean;
      fetchSucceeded: boolean;
      title:          string;
      category:       string;
      primaryColor:   string;
      scenarioCount:  number;
      generationMs:   number;
      /** Only present when dryRun=false and analyzeOnly=false */
      demoId?:        string;
      demoUrl?:       string;
    }
  | { ok: false; step: "auth" | "validation" | "analyzer" | "generator" | "store"; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, step: "auth", error: auth.error };

  const url = input.url.trim();
  if (!url || url.length < 4) {
    return { ok: false, step: "validation", error: "A valid URL is required." };
  }

  const start = Date.now();

  // ── 1. Analyze ────────────────────────────────────────────────────────────────
  let analysis: SiteAnalysis;
  try {
    analysis = await analyzeSite(url);
  } catch (err) {
    return {
      ok:    false,
      step:  "analyzer",
      error: `Website analyzer failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (input.analyzeOnly) {
    return {
      ok:             true,
      dryRun:         input.dryRun,
      analyzeOnly:    true,
      fetchSucceeded: analysis.fetchSucceeded,
      title:          analysis.title,
      category:       analysis.category,
      primaryColor:   analysis.primaryColor,
      scenarioCount:  0,
      generationMs:   Date.now() - start,
    };
  }

  // ── 2. Generate scenarios ────────────────────────────────────────────────────
  let scenarioCount = 0;
  try {
    const scenarios = generateScenarios(analysis);
    scenarioCount   = scenarios.length;

    if (!input.dryRun) {
      // ── 3. Store ───────────────────────────────────────────────────────────────
      const { createDemoInstance } = await import("@/demo/store");
      const generationMs           = Date.now() - start;
      const db                     = getServiceClient();

      const demo = await createDemoInstance(db, {
        analysis,
        scenarios,
        generatedBy:  `${auth.email} (test-panel)`,
        generationMs,
        expiryDays:   7,
      }).catch((err: unknown) => {
        throw Object.assign(
          new Error(`Store failed: ${err instanceof Error ? err.message : String(err)}`),
          { step: "store" },
        );
      });

      const baseUrl = await resolveRequestBaseUrl();

      return {
        ok:             true,
        dryRun:         false,
        analyzeOnly:    false,
        fetchSucceeded: analysis.fetchSucceeded,
        title:          analysis.title,
        category:       analysis.category,
        primaryColor:   analysis.primaryColor,
        scenarioCount,
        generationMs,
        demoId:         demo.id,
        demoUrl:        `${baseUrl}/demo/${demo.id}`,
      };
    }
  } catch (err) {
    const anyErr = err as { step?: string; message?: string };
    return {
      ok:    false,
      step:  (anyErr.step as "store") ?? "generator",
      error: anyErr.message ?? String(err),
    };
  }

  return {
    ok:             true,
    dryRun:         true,
    analyzeOnly:    false,
    fetchSucceeded: analysis.fetchSucceeded,
    title:          analysis.title,
    category:       analysis.category,
    primaryColor:   analysis.primaryColor,
    scenarioCount,
    generationMs:   Date.now() - start,
  };
}

// ── deleteDemoInstanceAction ──────────────────────────────────────────────────

/**
 * Hard-deletes a demo_instances row by ID.
 * Requires an active admin session.  Returns { ok: true } on success.
 */
export async function deleteDemoInstanceAction(
  demoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!demoId || typeof demoId !== "string" || demoId.trim().length === 0) {
    return { ok: false, error: "Invalid demo ID." };
  }

  const { error } = await getServiceClient()
    .from("demo_instances")
    .delete()
    .eq("id", demoId.trim());

  if (error) {
    return { ok: false, error: `Delete failed: ${error.message}` };
  }

  revalidatePath("/admin/platform/demo-importer");
  return { ok: true };
}
