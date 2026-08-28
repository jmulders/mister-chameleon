/**
 * Unit tests for the Mirror JS-render abstraction (self-hosted headless Chrome).
 * The real browser launch is injected, so these run without a Chromium binary.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  renderHtmlViaService,
  resolveRenderConfig,
  DEFAULT_RENDER_TIMEOUT_MS,
  type RenderConfig,
  type RenderBrowser,
} from "../../demo/site-render.ts";

// ── Fake browser/page (structurally satisfies RenderBrowser/RenderPage) ───────
function fakeBrowser(opts: {
  html?: string; url?: string; gotoThrows?: boolean; onClose?: () => void;
}): RenderBrowser {
  return {
    newPage: async () => ({
      goto: async () => { if (opts.gotoThrows) throw new Error("nav failed"); },
      content: async () => opts.html ?? "",
      url: () => opts.url ?? "https://ex.com",
    }),
    close: async () => { opts.onClose?.(); },
  };
}

// Mock Supabase-style client whose maybeSingle resolves to the given value row.
function mockClient(value: unknown) {
  const chain = {
    from: () => chain, select: () => chain, eq: () => chain,
    maybeSingle: async () => ({ data: value === undefined ? null : { value } }),
  };
  return chain;
}

const cfg: RenderConfig = { service: "chromium", timeoutMs: 25_000 };

describe("renderHtmlViaService (headless Chrome)", () => {
  it("returns the rendered DOM and closes the browser", async () => {
    let closed = false;
    const html = "<html><body>" + "x".repeat(300) + "</body></html>";
    const out = await renderHtmlViaService("https://ex.com", cfg, async () =>
      fakeBrowser({ html, url: "https://ex.com/final", onClose: () => { closed = true; } }));
    assert.equal(out.html, html);
    assert.equal(out.finalUrl, "https://ex.com/final");
    assert.equal(closed, true);
  });

  it("throws when rendering is not enabled", async () => {
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", { service: "none", timeoutMs: 1 }, async () => fakeBrowser({ html: "x".repeat(300) })),
      /not configured/,
    );
  });

  it("throws (and closes) on empty/too-short HTML", async () => {
    let closed = false;
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", cfg, async () => fakeBrowser({ html: "<html></html>", onClose: () => { closed = true; } })),
      /empty\/too-short/,
    );
    assert.equal(closed, true);
  });

  it("propagates a navigation failure so the caller can fall back", async () => {
    await assert.rejects(
      () => renderHtmlViaService("https://ex.com", cfg, async () => fakeBrowser({ gotoThrows: true })),
      /nav failed/,
    );
  });
});

describe("resolveRenderConfig", () => {
  it("chromium when renderEnabled is true", async () => {
    const c = await resolveRenderConfig(mockClient({ renderEnabled: true, renderTimeoutMs: 30_000 }));
    assert.equal(c.service, "chromium");
    assert.equal(c.timeoutMs, 30_000);
  });

  it("none when rendering is disabled (default)", async () => {
    const c = await resolveRenderConfig(mockClient({ renderEnabled: false }));
    assert.equal(c.service, "none");
    assert.equal(c.timeoutMs, DEFAULT_RENDER_TIMEOUT_MS);
  });

  it("ignores an out-of-range timeout", async () => {
    const c = await resolveRenderConfig(mockClient({ renderEnabled: true, renderTimeoutMs: 999 }));
    assert.equal(c.timeoutMs, DEFAULT_RENDER_TIMEOUT_MS);
  });

  it("never throws when the settings read fails", async () => {
    const bad = { from: () => { throw new Error("db down"); } };
    const c = await resolveRenderConfig(bad);
    assert.equal(c.service, "none");
  });
});
