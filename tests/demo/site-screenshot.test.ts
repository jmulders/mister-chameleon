/**
 * site-screenshot — ScreenshotOne capture (URL build + fail-open fetch).
 * The managed screenshot API is the visual layer of the screenshot demo mode.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildScreenshotUrl, captureScreenshot } from "@/demo/site-screenshot";

describe("buildScreenshotUrl", () => {
  it("requests a full-page PNG with cookie-banner blocking", () => {
    const u = buildScreenshotUrl("https://nike.com/nl", "KEY123", 1280);
    assert.match(u, /^https:\/\/api\.screenshotone\.com\/take\?/);
    assert.match(u, /access_key=KEY123/);
    assert.match(u, /full_page=true/);
    assert.match(u, /format=png/);
    assert.match(u, /block_cookie_banners=true/);
    assert.match(u, /viewport_width=1280/);
    assert.match(u, new RegExp(`url=${encodeURIComponent("https://nike.com/nl")}`));
  });
});

describe("captureScreenshot (fail-open)", () => {
  const key = async () => "TESTKEY";

  it("returns ok with bytes on an image response", async () => {
    const png = new Uint8Array(2048).fill(1).buffer;
    const fetchImpl = (async () => ({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => png,
    })) as unknown as typeof fetch;
    const r = await captureScreenshot("https://x.test", fetchImpl, key);
    assert.equal(r.ok, true);
    if (r.ok) { assert.equal(r.contentType, "image/png"); assert.equal(r.width, 1280); assert.ok(r.bytes.byteLength >= 1000); }
  });

  it("returns ok:false with no key configured", async () => {
    const r = await captureScreenshot("https://x.test", (async () => { throw new Error("should not fetch"); }) as unknown as typeof fetch, async () => null);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /no ScreenshotOne key/);
  });

  it("fails open on a non-OK response", async () => {
    const fetchImpl = (async () => ({
      ok: false, status: 429,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => "rate limited",
    })) as unknown as typeof fetch;
    const r = await captureScreenshot("https://x.test", fetchImpl, key);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /429/);
  });

  it("fails open on a non-image (JSON error) response", async () => {
    const fetchImpl = (async () => ({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => '{"error":"bad url"}',
    })) as unknown as typeof fetch;
    const r = await captureScreenshot("https://x.test", fetchImpl, key);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /non-image/);
  });
});
