/**
 * demo/screenshot-pipeline.ts
 *
 * Orchestrates the "screenshot" demo build: capture → upload → vision regions →
 * per-region scenario variants → a DemoScreenshot payload. Every step fail-opens;
 * a null result tells the mirror route to fall back to the plain-fetch mirror.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureScreenshot } from "./site-screenshot";
import { detectRegions } from "./screenshot-vision";
import { analyzeRegionsToSlots } from "./ai-slot-analyzer";
import type { DemoScreenshot, ScreenshotRegion } from "./types";
import type { SiteAnalysis } from "./types";

export interface ScreenshotBuildOk {
  ok:         true;
  screenshot: DemoScreenshot;
  /** Diagnostics for the mirror response, mirroring the render/ai blocks. */
  status:     { captured: boolean; regions: number; variantsRan: boolean; visionModel: string; aiStatus: string; aiReason?: string; ms: number };
}
export interface ScreenshotBuildSkip {
  ok:     false;
  reason: string;
}
export type ScreenshotBuildResult = ScreenshotBuildOk | ScreenshotBuildSkip;

/**
 * Build a screenshot demo for a prospect URL. Returns `{ ok:false, reason }` at
 * the first failure so the caller falls back to the mirror flow.
 *
 * @param _client  service-role Supabase client (unused today — the storage
 *                 adapter resolves its own; kept for symmetry + future scoping).
 */
export async function buildScreenshotDemo(
  _client:  SupabaseClient,
  url:      string,
  analysis: SiteAnalysis,
): Promise<ScreenshotBuildResult> {
  const started = Date.now();

  // 1) Capture.
  const shot = await captureScreenshot(url);
  if (!shot.ok) return { ok: false, reason: `screenshot: ${shot.reason}` };

  // 2) Upload the PNG to storage → public URL for the viewer.
  let screenshotUrl: string;
  try {
    const { getActiveStorageAdapterForTenant } = await import("@/lib/assets/storage-adapter");
    const adapter = await getActiveStorageAdapterForTenant("demo");
    const uploaded = await adapter.upload({
      tenantId: "demo",
      fileName: "prospect-screenshot.png",
      mimeType: shot.contentType,
      bytes:    shot.bytes,
      label:    "demo screenshot",
    });
    screenshotUrl = uploaded.publicUrl;
  } catch (err) {
    return { ok: false, reason: `upload: ${err instanceof Error ? err.message : String(err)}` };
  }

  // 3) Vision → regions (fractions + original text).
  const vision = await detectRegions(shot.bytes, shot.contentType, { url, title: analysis.title });
  if (!vision.ok) return { ok: false, reason: `vision: ${vision.reason}` };

  // 4) Per-region scenario variants (reuses the AI slot analyzer).
  const variants = await analyzeRegionsToSlots(
    vision.regions.map((r) => ({ slotKey: r.slotKey, originalText: r.originalText, tag: r.tag })),
    { url, title: analysis.title, category: analysis.category, description: analysis.description },
  );
  const scenariosBySlot = new Map(variants.regions.map((r) => [r.slotKey, r.scenarios]));

  const regions: ScreenshotRegion[] = vision.regions.map((r) => ({
    slotKey:      r.slotKey,
    box:          r.box,
    originalText: r.originalText,
    scenarios:    scenariosBySlot.get(r.slotKey) ?? {},
  }));

  const screenshot: DemoScreenshot = {
    screenshotUrl,
    width:  shot.width,
    height: null,
    regions,
  };

  // Surface WHY variants are empty (AI failed vs no slotKey match) instead of a
  // silent no-op — mirrors the render-status visibility from #332.
  if (!variants.aiRan) {
    console.warn(
      `[demo/screenshot-pipeline] no scenario variants attached — status=${variants.status}` +
      (variants.reason ? ` reason=${variants.reason}` : "") + ` regions=${regions.length} url=${url}`,
    );
  }

  return {
    ok: true,
    screenshot,
    status: {
      captured:    true,
      regions:     regions.length,
      variantsRan: variants.aiRan,
      visionModel: vision.model,
      aiStatus:    variants.status,
      ...(variants.reason ? { aiReason: variants.reason } : {}),
      ms:          Date.now() - started,
    },
  };
}
