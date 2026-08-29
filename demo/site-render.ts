/**
 * demo/site-render.ts
 *
 * Optional JS-rendering for the Mirror demo, on SELF-HOSTED headless Chrome
 * (puppeteer-core + @sparticuz/chromium-min) — €0, no SaaS.
 *
 * The default capture (site-mirror.ts → fetchHtml) is a plain `fetch`, so it
 * returns the server-rendered HTML only. Client-rendered sites (React/Vue/Next
 * hydration, lazy heroes) come back empty or broken. When JS-rendering is enabled
 * we launch headless Chrome, load the page, and return the fully rendered DOM
 * (page.content()).
 *
 * Runtime:
 *   • prod (Vercel): @sparticuz/chromium-min — the Chromium binary is fetched at
 *     cold start from a fixed pack URL (CHROMIUM_PACK_URL) so it stays out of the
 *     ~50MB function bundle.
 *   • dev/local: a local Chrome (PUPPETEER_EXECUTABLE_PATH or a platform default).
 *
 * Config: a generic on/off + timeout in the platform demo_importer settings (no
 * API key, no SaaS). Any failure/timeout falls back to a plain fetch upstream.
 */

export type RenderService = "none" | "chromium";

export interface RenderConfig {
  service:   RenderService;
  timeoutMs: number;
}

/**
 * The phase a render failed in — the key diagnostic for "did Chrome launch?".
 *   config   — service not configured (should not happen when render is enabled)
 *   launch   — headless Chrome never launched (bad executablePath / pack download
 *              failure / OOM / puppeteer.launch error) → the prod-silent-fallback case
 *   navigate — Chrome launched but page.goto failed (nav error or its own timeout)
 *   empty    — Chrome launched + navigated but returned empty/too-short HTML
 *   timeout  — the overall render guard fired (hung browser)
 */
export type RenderPhase = "config" | "launch" | "navigate" | "empty" | "timeout";

/** Error carrying the phase it failed in, so the caller can report it. */
export class RenderError extends Error {
  constructor(public readonly phase: RenderPhase, message: string) {
    super(message);
    this.name = "RenderError";
  }
}

/** Visible outcome of a render attempt — logged and returned in the mirror response. */
export interface RenderOutcome {
  service:  RenderService;
  /** True only when rendered DOM HTML was actually served (not the plain-fetch fallback). */
  rendered: boolean;
  /** "ok" on success, "disabled" when render is off, else the failed phase / "error". */
  status:   "ok" | "disabled" | RenderPhase | "error";
  reason:   string;
  ms:       number;
}

/** Build a RenderOutcome from a caught render error (reads the RenderError phase). */
export function renderOutcomeFromError(err: unknown, ms: number, service: RenderService): RenderOutcome {
  const status = err instanceof RenderError ? err.phase : "error";
  const reason = err instanceof Error ? err.message : String(err);
  return { service, rendered: false, status, reason, ms };
}

/** Default render timeout — JS rendering needs longer than a plain fetch. */
export const DEFAULT_RENDER_TIMEOUT_MS = 25_000;

/**
 * Max render timeout. Kept safely under the mirror function's maxDuration (60s):
 * renderHtmlViaService adds a +3s guard and the rest of the request (analyze, AI
 * slots, store) needs headroom, so a render can't run longer than ~45s or Vercel
 * would kill the function before the render's own timeout fires.
 */
export const MAX_RENDER_TIMEOUT_MS = 45_000;
export const MIN_RENDER_TIMEOUT_MS = 5_000;

/**
 * Default Chromium pack URL for @sparticuz/chromium-min. MUST match the installed
 * @sparticuz/chromium-min major (131.x here). Override per environment via
 * CHROMIUM_PACK_URL.
 */
export const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

// ── Minimal structural browser interface (puppeteer Browser/Page satisfy it) ──
export interface RenderPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  content(): Promise<string>;
  url(): string;
  setViewport?(vp: { width: number; height: number }): Promise<unknown>;
}
export interface RenderBrowser {
  newPage(): Promise<RenderPage>;
  close(): Promise<void>;
}

/**
 * Resolve the render config from the platform demo_importer settings: a generic
 * `renderEnabled` flag + `renderTimeoutMs`. Returns `service:"none"` when
 * rendering is disabled, so the caller falls back to a plain fetch. Never throws.
 *
 * `client` is any object with a Supabase-style `.from().select().eq().maybeSingle()`
 * chain — injected so this stays testable.
 */
export async function resolveRenderConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
): Promise<RenderConfig> {
  let enabled   = false;
  let timeoutMs = DEFAULT_RENDER_TIMEOUT_MS;

  try {
    const { data } = await client
      .from("platform_settings")
      .select("value")
      .eq("key", "demo_importer")
      .maybeSingle();
    const value = (data?.value ?? {}) as { renderEnabled?: unknown; renderTimeoutMs?: unknown };
    if (value.renderEnabled === true) enabled = true;
    if (typeof value.renderTimeoutMs === "number" && value.renderTimeoutMs >= MIN_RENDER_TIMEOUT_MS && value.renderTimeoutMs <= MAX_RENDER_TIMEOUT_MS) {
      timeoutMs = value.renderTimeoutMs;
    }
  } catch {
    // Settings unavailable → rendering stays off.
  }

  return { service: enabled ? "chromium" : "none", timeoutMs };
}

/** Platform default local Chrome path (dev), overridable via PUPPETEER_EXECUTABLE_PATH. */
function localChromePath(env: NodeJS.ProcessEnv): string {
  const explicit = env["PUPPETEER_EXECUTABLE_PATH"]?.trim();
  if (explicit) return explicit;
  switch (process.platform) {
    case "darwin": return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32":  return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    default:       return "/usr/bin/google-chrome";
  }
}

/**
 * Launch headless Chrome: @sparticuz/chromium-min on Vercel/prod (binary fetched
 * from the pack URL), a local Chrome otherwise. Dynamic imports keep the heavy
 * modules out of any non-render code path.
 */
async function launchBrowser(env: NodeJS.ProcessEnv = process.env): Promise<RenderBrowser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const isServerless = Boolean(env["VERCEL"]) || env["NODE_ENV"] === "production";

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const packUrl  = env["CHROMIUM_PACK_URL"]?.trim() || DEFAULT_CHROMIUM_PACK_URL;
    const executablePath = await chromium.executablePath(packUrl);
    return puppeteer.launch({
      args:            chromium.args,
      executablePath,
      headless:        true,
      defaultViewport: chromium.defaultViewport,
    }) as unknown as Promise<RenderBrowser>;
  }

  return puppeteer.launch({
    headless:        true,
    executablePath:  localChromePath(env),
    args:            ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 900 },
  }) as unknown as Promise<RenderBrowser>;
}

/**
 * Render a URL with headless Chrome and return the fully-rendered DOM HTML.
 * Bounded by an overall timeout; throws on any failure so the caller can fall
 * back to a plain fetch. `launch` is injectable for tests.
 */
export async function renderHtmlViaService(
  targetUrl: string,
  config:    RenderConfig,
  launch:    (env?: NodeJS.ProcessEnv) => Promise<RenderBrowser> = launchBrowser,
): Promise<{ html: string; finalUrl: string }> {
  if (config.service !== "chromium") {
    throw new RenderError("config", "render service not configured");
  }

  const render = (async (): Promise<{ html: string; finalUrl: string }> => {
    // Launch is its own phase — a failure here means Chrome never started
    // (bad executablePath / @sparticuz pack download / OOM), which is the
    // prod-silent-fallback case we most need to distinguish.
    let browser: RenderBrowser;
    try {
      browser = await launch();
    } catch (e) {
      throw new RenderError("launch", e instanceof Error ? e.message : String(e));
    }
    try {
      const page = await browser.newPage();
      try {
        await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: config.timeoutMs });
      } catch (e) {
        throw new RenderError("navigate", e instanceof Error ? e.message : String(e));
      }
      const html = await page.content();
      if (!html || html.length < 200) throw new RenderError("empty", "render returned empty/too-short HTML");
      return { html, finalUrl: page.url() || targetUrl };
    } finally {
      await browser.close().catch(() => {});
    }
  })();

  // Hard overall cap so a hung browser can't exceed the function budget.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RenderError("timeout", "render timed out")), config.timeoutMs + 3_000);
  });
  try {
    return await Promise.race([render, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
