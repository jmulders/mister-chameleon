/**
 * tests/wp-plugin/update-service.test.ts
 *
 * The siteKey-authenticated WP plugin update proxy: a valid siteKey gets a
 * manifest pointing at our own download route; an unknown/inactive siteKey gets
 * a 404 (no update, no download); the download streams the release asset. The
 * GitHub token never appears here — it lives server-side in the release reader.
 */

import { test, describe } from "node:test";
import assert             from "node:assert/strict";

import {
  resolveUpdate,
  resolveDownload,
  PLUGIN_SLUG,
  type UpdateDeps,
  type DownloadDeps,
} from "@/lib/wp-plugin/update-service";
import type { PluginRelease } from "@/lib/wp-plugin/github-release";

// ── Fixtures ────────────────────────────────────────────────────────────────

const RELEASE: PluginRelease = {
  version:     "0.6.0",
  tag:         "v0.6.0",
  name:        "v0.6.0",
  body:        "## 0.6.0\nRealigned the version line.",
  publishedAt: "2026-09-08T20:10:56Z",
  htmlUrl:     "https://github.com/jmulders/mister-chameleon-wordpress/releases/tag/v0.6.0",
  zipAsset:    { name: "mister-chameleon-connect.zip", apiUrl: "https://api.github.com/repos/o/r/releases/assets/1", size: 206274 },
};

const ORIGIN = "https://www.misterchameleon.nl";

function updateDeps(over: Partial<UpdateDeps> = {}): UpdateDeps {
  return {
    getTenant:  async () => ({ tenantId: "nascita", active: true }),
    getRelease: async () => RELEASE,
    ...over,
  };
}

// ── resolveUpdate ─────────────────────────────────────────────────────────────

describe("resolveUpdate — manifest for a valid siteKey", () => {
  test("returns 200 with the release version and our siteKey-authenticated download_url", async () => {
    const res = await resolveUpdate({ siteKey: "sk_live_abc", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps());
    assert.equal(res.status, 200);
    if (res.status !== 200) return;

    assert.equal(res.manifest.version, "0.6.0");
    assert.equal(res.manifest.slug, PLUGIN_SLUG);
    // download_url points back at OUR proxy (not GitHub) and carries the siteKey.
    assert.ok(res.manifest.download_url.startsWith(`${ORIGIN}/api/plugin/wp/download`));
    assert.ok(res.manifest.download_url.includes("siteKey=sk_live_abc"));
    assert.ok(!/github\.com/i.test(res.manifest.download_url), "download_url must not leak GitHub");
    assert.ok(res.manifest.sections.changelog.includes("0.6.0"));
  });

  test("passes the siteKey through url-encoded", async () => {
    const res = await resolveUpdate({ siteKey: "sk live+/x", slug: "", origin: ORIGIN }, updateDeps());
    assert.equal(res.status, 200);
    assert.ok(res.status === 200 && res.manifest.download_url.includes("siteKey=sk%20live%2B%2Fx"));
  });
});

describe("resolveUpdate — rejects", () => {
  test("unknown siteKey → 404", async () => {
    const res = await resolveUpdate({ siteKey: "nope", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps({ getTenant: async () => null }));
    assert.equal(res.status, 404);
  });

  test("inactive tenant → 404", async () => {
    const res = await resolveUpdate({ siteKey: "sk", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps({ getTenant: async () => ({ tenantId: "t", active: false }) }));
    assert.equal(res.status, 404);
  });

  test("empty siteKey → 404 (and the tenant lookup is never called)", async () => {
    let called = false;
    const res = await resolveUpdate({ siteKey: "", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps({ getTenant: async () => { called = true; return null; } }));
    assert.equal(res.status, 404);
    assert.equal(called, false);
  });

  test("wrong slug → 404", async () => {
    const res = await resolveUpdate({ siteKey: "sk", slug: "some-other-plugin", origin: ORIGIN }, updateDeps());
    assert.equal(res.status, 404);
  });

  test("no release / no asset → 404 (nothing to offer)", async () => {
    assert.equal((await resolveUpdate({ siteKey: "sk", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps({ getRelease: async () => null }))).status, 404);
    const noAsset = { ...RELEASE, zipAsset: null };
    assert.equal((await resolveUpdate({ siteKey: "sk", slug: PLUGIN_SLUG, origin: ORIGIN }, updateDeps({ getRelease: async () => noAsset }))).status, 404);
  });
});

// ── resolveDownload ───────────────────────────────────────────────────────────

function downloadDeps(over: Partial<DownloadDeps> = {}): DownloadDeps {
  return {
    getTenant:  async () => ({ tenantId: "nascita", active: true }),
    getRelease: async () => RELEASE,
    fetchAsset: async () => new Response("PKzip-bytes", { status: 200 }),
    ...over,
  };
}

describe("resolveDownload", () => {
  test("valid siteKey → 200 with the asset response to stream", async () => {
    const res = await resolveDownload({ siteKey: "sk_live_abc", slug: PLUGIN_SLUG }, downloadDeps());
    assert.equal(res.status, 200);
    assert.ok(res.status === 200 && typeof res.response.text === "function");
    if (res.status === 200) {
      assert.match(await res.response.text(), /zip-bytes/);
    }
  });

  test("unknown siteKey → 404 and the asset is never fetched", async () => {
    let fetched = false;
    const res = await resolveDownload(
      { siteKey: "nope", slug: PLUGIN_SLUG },
      downloadDeps({ getTenant: async () => null, fetchAsset: async () => { fetched = true; return null; } }),
    );
    assert.equal(res.status, 404);
    assert.equal(fetched, false);
  });

  test("asset fetch failure → 502", async () => {
    const res = await resolveDownload({ siteKey: "sk", slug: PLUGIN_SLUG }, downloadDeps({ fetchAsset: async () => null }));
    assert.equal(res.status, 502);
  });
});
