/**
 * demo/screenshot-vision.ts
 *
 * Claude-vision pass over a full-page screenshot → the personalizable regions
 * (hero headline / subtitle / primary CTA / proof) as bounding boxes expressed as
 * FRACTIONS of the image size (0..1, so they scale over any render width) plus the
 * original on-page text per region.
 *
 * Server-only. Reuses the ai-slot-analyzer's key/model resolution. Fail-open:
 * any failure returns `{ ok:false, reason }` so the caller falls back to mirror.
 */

import "server-only";
import { resolveAnthropicKey, resolveSlotModel } from "./ai-slot-analyzer";

const VISION_TIMEOUT_MS = 40_000;
const MAX_TOKENS        = 2_000;

/** Allowed region slot ids (kept small + stable for the MVP overlay). */
export const REGION_SLOT_KEYS = ["hero-title", "hero-subtitle", "hero-cta", "proof"] as const;

export interface VisionRegion {
  slotKey:      string;
  tag:          string;
  box:          { x: number; y: number; w: number; h: number };
  originalText: string;
}

export type VisionResult =
  | { ok: true;  regions: VisionRegion[]; model: string; ms: number }
  | { ok: false; reason: string; model: string; ms: number };

const SYSTEM_PROMPT =
  `You are a conversion-analysis assistant. You receive a full-page screenshot of a company website. ` +
  `Identify the personalizable hero/proof regions and return ONLY JSON (no prose, no markdown fences).\n\n` +
  `Return this exact shape:\n` +
  `{ "regions": [ { "slotKey": "hero-title" | "hero-subtitle" | "hero-cta" | "proof", ` +
  `"tag": "h1" | "h2" | "p" | "button" | "a" | "div", ` +
  `"box": { "x": number, "y": number, "w": number, "h": number }, ` +
  `"originalText": "the exact visible text in this region" } ] }\n\n` +
  `Rules:\n` +
  `- box coordinates are FRACTIONS of the image (0..1): x,y = top-left corner, w,h = width,height.\n` +
  `- Only include a region you can clearly see; omit any you cannot. At most one of each slotKey.\n` +
  `- originalText must be the real on-screen copy, trimmed, no HTML.\n` +
  `- Prefer the primary above-the-fold hero headline, its supporting subtitle, the primary call-to-action button, and one social-proof/trust element.`;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Parse + validate the vision JSON into VisionRegion[]. Pure; exported for tests. */
export function parseVisionRegions(raw: string): VisionRegion[] {
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return []; }
  const list = (parsed as { regions?: unknown })?.regions;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const out: VisionRegion[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const slotKey = typeof o.slotKey === "string" ? o.slotKey : "";
    if (!(REGION_SLOT_KEYS as readonly string[]).includes(slotKey) || seen.has(slotKey)) continue;
    const box = o.box as Record<string, unknown> | undefined;
    if (!box || ["x", "y", "w", "h"].some((k) => typeof box[k] !== "number")) continue;
    const x = clamp01(box.x as number), y = clamp01(box.y as number);
    const w = clamp01(box.w as number), h = clamp01(box.h as number);
    if (w <= 0 || h <= 0) continue;
    const originalText = typeof o.originalText === "string" ? o.originalText.trim() : "";
    if (!originalText) continue;
    seen.add(slotKey);
    out.push({
      slotKey,
      tag: typeof o.tag === "string" && o.tag ? o.tag : "p",
      box: { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) },
      originalText,
    });
  }
  return out;
}

/** Detect regions on a screenshot via Claude vision. Never throws (fail-open). */
export async function detectRegions(
  imageBytes:  ArrayBuffer,
  mediaType:   string,
  siteContext: { url: string; title: string },
): Promise<VisionResult> {
  const started = Date.now();
  const model = await resolveSlotModel();
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return { ok: false, reason: "no Anthropic key configured", model, ms: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client    = new Anthropic({ apiKey });
    const data = Buffer.from(imageBytes).toString("base64");

    const message = await client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: (mediaType || "image/png") as "image/png", data } },
              { type: "text", text: `Site: ${siteContext.title}\nURL: ${siteContext.url}\nReturn the personalizable regions as JSON.` },
            ],
          },
        ],
      },
      { signal: controller.signal },
    );

    const rawBlock = message.content[0];
    const raw = rawBlock?.type === "text" ? rawBlock.text : "";
    if (!raw) return { ok: false, reason: "vision returned no text", model, ms: Date.now() - started };

    const regions = parseVisionRegions(raw);
    if (regions.length === 0) return { ok: false, reason: "no regions parsed from vision output", model, ms: Date.now() - started };
    return { ok: true, regions, model, ms: Date.now() - started };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[demo/screenshot-vision] vision call failed (model=${model}):`, detail);
    return { ok: false, reason: detail, model, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
