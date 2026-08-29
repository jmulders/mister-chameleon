/**
 * fetchHtmlMaybeRendered — render-first, plain-fetch fallback
 *
 * The URL token extractor optionally captures the start page through the
 * self-hosted headless Chrome render service (same one Mirror uses), so tokens
 * come from the JS-built DOM. It must:
 *   - render when a service is configured, and NOT hit the plain fetcher;
 *   - fall back to plain fetch when render is disabled, throws, or returns empty;
 *   - respect the byte cap on rendered HTML.
 *
 * Deps are injected so no headless Chrome or network is involved.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchHtmlMaybeRendered } from "@/lib/design-tokens/url-token-extractor";
import type { RenderConfig } from "@/demo/site-render";

const CHROMIUM: RenderConfig = { service: "chromium", timeoutMs: 25_000 };
const NONE:     RenderConfig = { service: "none",     timeoutMs: 25_000 };

describe("fetchHtmlMaybeRendered", () => {

  it("uses the render service when configured and skips the plain fetch", async () => {
    let fetched = false;
    const html = await fetchHtmlMaybeRendered("https://x.test", CHROMIUM, 8000, 1_000_000, {
      renderHtml: async () => ({ html: "<html>rendered</html>", finalUrl: "https://x.test" }),
      fetchPlain: async () => { fetched = true; return "<html>fetched</html>"; },
    });
    assert.equal(html, "<html>rendered</html>");
    assert.equal(fetched, false, "plain fetch must not run when render succeeds");
  });

  it("falls back to plain fetch when the render service throws", async () => {
    const html = await fetchHtmlMaybeRendered("https://x.test", CHROMIUM, 8000, 1_000_000, {
      renderHtml: async () => { throw new Error("chrome boom"); },
      fetchPlain: async () => "<html>fetched</html>",
    });
    assert.equal(html, "<html>fetched</html>");
  });

  it("falls back to plain fetch when the render returns empty HTML", async () => {
    const html = await fetchHtmlMaybeRendered("https://x.test", CHROMIUM, 8000, 1_000_000, {
      renderHtml: async () => ({ html: "", finalUrl: "https://x.test" }),
      fetchPlain: async () => "<html>fetched</html>",
    });
    assert.equal(html, "<html>fetched</html>");
  });

  it("uses plain fetch directly when the service is 'none' (render disabled)", async () => {
    let rendered = false;
    const html = await fetchHtmlMaybeRendered("https://x.test", NONE, 8000, 1_000_000, {
      renderHtml: async () => { rendered = true; return { html: "<html>rendered</html>", finalUrl: "" }; },
      fetchPlain: async () => "<html>fetched</html>",
    });
    assert.equal(html, "<html>fetched</html>");
    assert.equal(rendered, false, "render must not run when service is none");
  });

  it("uses plain fetch when no render config is provided", async () => {
    const html = await fetchHtmlMaybeRendered("https://x.test", undefined, 8000, 1_000_000, {
      renderHtml: async () => { throw new Error("should not be called"); },
      fetchPlain: async () => "<html>fetched</html>",
    });
    assert.equal(html, "<html>fetched</html>");
  });

  it("caps rendered HTML at maxBytes", async () => {
    const big = "<html>" + "x".repeat(50) + "</html>";
    const html = await fetchHtmlMaybeRendered("https://x.test", CHROMIUM, 8000, 10, {
      renderHtml: async () => ({ html: big, finalUrl: "https://x.test" }),
      fetchPlain: async () => "should-not-be-used",
    });
    assert.equal(html.length, 10, "rendered HTML must be sliced to maxBytes");
  });
});
