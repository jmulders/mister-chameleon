/**
 * demo/site-render.ts
 *
 * Optional JS-rendering for the Mirror demo.
 *
 * The default capture (site-mirror.ts → fetchHtml) is a plain `fetch`, so it
 * returns the server-rendered HTML only. Client-rendered sites (React/Vue/Next
 * hydration, lazy heroes) come back empty or broken. When a managed headless
 * render service is configured, we route the capture through it so the mirror
 * reflects the page AS A BROWSER RENDERS IT.
 *
 * Service: ScrapingBee (https://www.scrapingbee.com) — a single GET with
 * `render_js=true` returns the fully rendered DOM as HTML, with built-in proxy /
 * anti-bot handling.
 *
 * Config split (security):
 *   • The NON-secret config (which service, timeout) lives in the platform
 *     demo_importer settings (admin-editable, surfaced to the settings UI).
 *   • The SECRET API key is read from the SCRAPINGBEE_API_KEY env var — never
 *     stored in the demo_importer settings row, which is returned wholesale to
 *     the client.
 *
 * This module is pure (fetch + string ops only): the DB read is injected via a
 * Supabase client so it stays unit-testable.
 */

export type RenderService = "none" | "scrapingbee";

export interface RenderConfig {
  service:   RenderService;
  /** ScrapingBee API key (from SCRAPINGBEE_API_KEY). Absent → service is "none". */
  apiKey?:   string;
  timeoutMs: number;
}

/** Default render timeout — JS rendering needs longer than a plain fetch. */
export const DEFAULT_RENDER_TIMEOUT_MS = 25_000;

const SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/";

/**
 * Resolve the render config from the platform demo_importer settings (service +
 * timeout) and the SCRAPINGBEE_API_KEY env var (secret). Returns `service:"none"`
 * whenever rendering is disabled or the key is missing, so the caller falls back
 * to a plain fetch. Never throws.
 *
 * `client` is any object with a Supabase-style `.from().select().eq().maybeSingle()`
 * chain — injected so this stays testable and free of server-only imports.
 */
export async function resolveRenderConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RenderConfig> {
  const apiKey = (env["SCRAPINGBEE_API_KEY"] ?? "").trim() || undefined;

  let service:   RenderService = "none";
  let timeoutMs: number        = DEFAULT_RENDER_TIMEOUT_MS;

  try {
    const { data } = await client
      .from("platform_settings")
      .select("value")
      .eq("key", "demo_importer")
      .maybeSingle();
    const value = (data?.value ?? {}) as { renderService?: unknown; renderTimeoutMs?: unknown };
    if (value.renderService === "scrapingbee") service = "scrapingbee";
    if (typeof value.renderTimeoutMs === "number" && value.renderTimeoutMs >= 5_000 && value.renderTimeoutMs <= 60_000) {
      timeoutMs = value.renderTimeoutMs;
    }
  } catch {
    // Settings unavailable → rendering stays off.
  }

  // Rendering needs both a service selection AND a key. Otherwise: none.
  if (service === "scrapingbee" && apiKey) {
    return { service, apiKey, timeoutMs };
  }
  return { service: "none", timeoutMs };
}

/** Build the ScrapingBee request URL for a fully-rendered HTML capture. */
export function buildScrapingBeeUrl(targetUrl: string, apiKey: string): string {
  const params = new URLSearchParams({
    api_key:    apiKey,
    url:        targetUrl,
    render_js:  "true",
    block_ads:  "true",
    // Return the page's own HTML (not a ScrapingBee wrapper) and follow redirects.
    return_page_source: "true",
  });
  return `${SCRAPINGBEE_ENDPOINT}?${params.toString()}`;
}

/**
 * Render a URL via the configured service and return the fully-rendered HTML.
 * Throws on any failure (misconfig, non-OK response, timeout) so the caller can
 * fall back to a plain fetch.
 */
export async function renderHtmlViaService(
  targetUrl: string,
  config:    RenderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ html: string; finalUrl: string }> {
  if (config.service !== "scrapingbee" || !config.apiKey) {
    throw new Error("render service not configured");
  }

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestUrl = buildScrapingBeeUrl(targetUrl, config.apiKey);
    const response   = await fetchImpl(requestUrl, { signal: controller.signal });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ScrapingBee HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const html = await response.text();
    if (!html || html.length < 200) {
      throw new Error("ScrapingBee returned empty/too-short HTML");
    }

    // ScrapingBee surfaces the resolved URL via a response header when available.
    const finalUrl = response.headers.get("Spb-resolved-url") || targetUrl;
    return { html, finalUrl };
  } finally {
    clearTimeout(timeout);
  }
}
