/**
 * Unit tests for the Mirror JS-render adapter (ScrapingBee).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  buildScrapingBeeUrl,
  renderHtmlViaService,
  resolveRenderConfig,
  DEFAULT_RENDER_TIMEOUT_MS,
  type RenderConfig,
} from "../../demo/site-render.ts";

// Minimal Response-like stub.
function res(body: string, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) {
  const headers = new Map(Object.entries(init.headers ?? {}));
  return {
    ok:      init.ok ?? true,
    status:  init.status ?? 200,
    headers: { get: (k: string) => headers.get(k) ?? null },
    text:    async () => body,
  } as unknown as Response;
}

// Mock Supabase-style client whose maybeSingle resolves to the given value row.
function mockClient(value: unknown) {
  const chain = {
    from:       () => chain,
    select:     () => chain,
    eq:         () => chain,
    maybeSingle: async () => ({ data: value === undefined ? null : { value } }),
  };
  return chain;
}

describe("buildScrapingBeeUrl", () => {
  it("includes api_key, encoded url, and render_js", () => {
    const u = buildScrapingBeeUrl("https://ex.com/a?b=c", "KEY123");
    assert.match(u, /^https:\/\/app\.scrapingbee\.com\/api\/v1\/\?/);
    assert.match(u, /api_key=KEY123/);
    assert.match(u, /render_js=true/);
    assert.match(u, /url=https%3A%2F%2Fex\.com%2Fa%3Fb%3Dc/);
  });
});

describe("renderHtmlViaService", () => {
  const cfg: RenderConfig = { service: "scrapingbee", apiKey: "K", timeoutMs: 25_000 };

  it("returns rendered HTML on a 200", async () => {
    const html = "<html><body>" + "x".repeat(300) + "</body></html>";
    const out = await renderHtmlViaService("https://ex.com", cfg, async () => res(html, { headers: { "Spb-resolved-url": "https://ex.com/final" } }));
    assert.equal(out.html, html);
    assert.equal(out.finalUrl, "https://ex.com/final");
  });

  it("falls back finalUrl to the target when no resolved-url header", async () => {
    const html = "<html>" + "y".repeat(300) + "</html>";
    const out = await renderHtmlViaService("https://ex.com", cfg, async () => res(html));
    assert.equal(out.finalUrl, "https://ex.com");
  });

  it("throws when the service is not configured", async () => {
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", { service: "none", timeoutMs: 1 }, async () => res("x".repeat(300))),
      /not configured/,
    );
  });

  it("throws on a non-OK response", async () => {
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", cfg, async () => res("nope", { ok: false, status: 500 })),
      /HTTP 500/,
    );
  });

  it("throws on empty / too-short HTML", async () => {
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", cfg, async () => res("<html></html>")),
      /empty\/too-short/,
    );
  });
});

describe("resolveRenderConfig", () => {
  it("service none when the env key is absent (even if settings enable it)", async () => {
    const cfg = await resolveRenderConfig(mockClient({ renderService: "scrapingbee" }), {} as NodeJS.ProcessEnv);
    assert.equal(cfg.service, "none");
  });

  it("service scrapingbee when settings enable it AND the env key is present", async () => {
    const cfg = await resolveRenderConfig(
      mockClient({ renderService: "scrapingbee", renderTimeoutMs: 30_000 }),
      { SCRAPINGBEE_API_KEY: "K" } as unknown as NodeJS.ProcessEnv,
    );
    assert.equal(cfg.service, "scrapingbee");
    assert.equal(cfg.apiKey, "K");
    assert.equal(cfg.timeoutMs, 30_000);
  });

  it("service none when settings disable rendering (even with a key)", async () => {
    const cfg = await resolveRenderConfig(
      mockClient({ renderService: "none" }),
      { SCRAPINGBEE_API_KEY: "K" } as unknown as NodeJS.ProcessEnv,
    );
    assert.equal(cfg.service, "none");
  });

  it("defaults the timeout and ignores out-of-range values", async () => {
    const cfg = await resolveRenderConfig(
      mockClient({ renderService: "scrapingbee", renderTimeoutMs: 999 }),
      { SCRAPINGBEE_API_KEY: "K" } as unknown as NodeJS.ProcessEnv,
    );
    assert.equal(cfg.timeoutMs, DEFAULT_RENDER_TIMEOUT_MS);
  });

  it("never throws when the settings read fails", async () => {
    const badClient = { from: () => { throw new Error("db down"); } };
    const cfg = await resolveRenderConfig(badClient, { SCRAPINGBEE_API_KEY: "K" } as unknown as NodeJS.ProcessEnv);
    assert.equal(cfg.service, "none");
  });
});
