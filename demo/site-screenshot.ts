/**
 * demo/site-screenshot.ts
 *
 * Full-page screenshot of a prospect site via a MANAGED screenshot API
 * (ScreenshotOne) — the visual layer for the "screenshot" demo mode. This
 * sidesteps self-hosted Chromium on Vercel entirely: pixel-perfect, JS-rendered,
 * cookie-banners blocked, lazy-load handled, no broken assets/CSS.
 *
 * Server-only. Fail-open: any failure (no key, non-OK, timeout) returns
 * `{ ok:false, reason }` so the caller falls back to the existing mirror flow.
 */

import "server-only";

const SCREENSHOTONE_ENDPOINT = "https://api.screenshotone.com/take";
const DEFAULT_VIEWPORT_WIDTH = 1280;
const CAPTURE_TIMEOUT_MS      = 45_000; // full-page render + scroll can be slow

export type ScreenshotResult =
  | { ok: true;  bytes: ArrayBuffer; contentType: string; width: number; ms: number }
  | { ok: false; reason: string; ms: number };

/** Resolve the ScreenshotOne key: platform AI settings → SCREENSHOTONE_API_KEY env. */
export async function resolveScreenshotOneKey(): Promise<string | null> {
  try {
    const { getPlatformAiSettings } = await import("@/platform/platform-store");
    const result = await getPlatformAiSettings();
    if (result.ok && result.data.screenshotOneKey) return result.data.screenshotOneKey;
  } catch {
    // DB unavailable — fall through to env var
  }
  return process.env["SCREENSHOTONE_API_KEY"] ?? null;
}

/** Build the ScreenshotOne request URL (exported for tests). */
export function buildScreenshotUrl(targetUrl: string, accessKey: string, viewportWidth = DEFAULT_VIEWPORT_WIDTH): string {
  const params = new URLSearchParams({
    access_key:           accessKey,
    url:                  targetUrl,
    full_page:            "true",
    format:               "png",
    // Managed cleanups so the capture is demo-ready.
    block_cookie_banners: "true",
    block_ads:            "true",
    block_chats:          "true",
    // Give lazy-loaded imagery time to settle (ScreenshotOne auto-scrolls for full_page).
    delay:                "3",
    viewport_width:       String(viewportWidth),
    cache:                "false",
  });
  return `${SCREENSHOTONE_ENDPOINT}?${params.toString()}`;
}

/**
 * Capture a full-page screenshot. Returns the raw PNG bytes (to upload + to feed
 * Claude vision). Fail-open — never throws.
 */
export async function captureScreenshot(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
  resolveKey: () => Promise<string | null> = resolveScreenshotOneKey,
): Promise<ScreenshotResult> {
  const started = Date.now();
  const key = await resolveKey();
  if (!key) return { ok: false, reason: "no ScreenshotOne key configured", ms: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(buildScreenshotUrl(targetUrl, key), { signal: controller.signal });
    if (!res.ok) {
      // ScreenshotOne returns JSON error bodies; surface a short reason.
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`, ms: Date.now() - started };
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `non-image response (${contentType})${body ? `: ${body.slice(0, 200)}` : ""}`, ms: Date.now() - started };
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 1000) {
      return { ok: false, reason: `screenshot too small (${bytes.byteLength} bytes)`, ms: Date.now() - started };
    }
    return { ok: true, bytes, contentType, width: DEFAULT_VIEWPORT_WIDTH, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
