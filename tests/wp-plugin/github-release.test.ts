/**
 * tests/wp-plugin/github-release.test.ts
 *
 * The server-side GitHub release reader: parses the latest release into our
 * shape (picking the correctly-named ZIP asset), sends the token only to GitHub,
 * and returns null when the proxy is unconfigured. `fetch` is injected so no
 * network is touched.
 */

import { test, describe, afterEach } from "node:test";
import assert                        from "node:assert/strict";

import { getLatestPluginRelease, fetchPluginAsset, _resetReleaseCacheForTests } from "@/lib/wp-plugin/github-release";

const LATEST_JSON = {
  tag_name:     "v0.6.0",
  name:         "v0.6.0",
  body:         "notes",
  published_at: "2026-09-08T20:10:56Z",
  html_url:     "https://github.com/jmulders/mister-chameleon-wordpress/releases/tag/v0.6.0",
  assets: [
    { name: "source.zip",                     url: "https://api.github.com/repos/o/r/releases/assets/9", size: 10 },
    { name: "mister-chameleon-connect.zip",   url: "https://api.github.com/repos/o/r/releases/assets/1", size: 206274 },
  ],
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  _resetReleaseCacheForTests();
  delete process.env.WP_PLUGIN_GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.WP_PLUGIN_GITHUB_REPO;
});

describe("getLatestPluginRelease", () => {
  test("parses the release and picks the plugin ZIP asset", async () => {
    process.env.WP_PLUGIN_GITHUB_TOKEN = "tok_secret";
    let sawAuth = "";
    let sawUrl  = "";
    const release = await getLatestPluginRelease({
      force: true,
      fetchImpl: (async (url: string, init: RequestInit) => {
        sawUrl  = String(url);
        sawAuth = String((init.headers as Record<string, string>).Authorization ?? "");
        return jsonResponse(LATEST_JSON);
      }) as unknown as typeof fetch,
    });

    assert.ok(release);
    assert.equal(release!.version, "0.6.0");
    assert.equal(release!.tag, "v0.6.0");
    assert.equal(release!.zipAsset?.name, "mister-chameleon-connect.zip");
    assert.equal(release!.zipAsset?.apiUrl, "https://api.github.com/repos/o/r/releases/assets/1");
    // token goes to GitHub only, as a Bearer header.
    assert.match(sawUrl, /api\.github\.com\/repos\/jmulders\/mister-chameleon-wordpress\/releases\/latest/);
    assert.equal(sawAuth, "Bearer tok_secret");
  });

  test("returns null when unconfigured (no token)", async () => {
    let called = false;
    const release = await getLatestPluginRelease({
      force: true,
      fetchImpl: (async () => { called = true; return jsonResponse(LATEST_JSON); }) as unknown as typeof fetch,
    });
    assert.equal(release, null);
    assert.equal(called, false, "GitHub is not called when there is no token");
  });

  test("returns null on a GitHub error status", async () => {
    process.env.WP_PLUGIN_GITHUB_TOKEN = "tok";
    const release = await getLatestPluginRelease({
      force: true,
      fetchImpl: (async () => jsonResponse({}, false, 401)) as unknown as typeof fetch,
    });
    assert.equal(release, null);
  });
});

describe("fetchPluginAsset", () => {
  test("requests the asset with an octet-stream Accept + Bearer token", async () => {
    process.env.WP_PLUGIN_GITHUB_TOKEN = "tok_secret";
    let sawAccept = "";
    let sawAuth   = "";
    const res = await fetchPluginAsset("https://api.github.com/repos/o/r/releases/assets/1", {
      fetchImpl: (async (_url: string, init: RequestInit) => {
        const h = init.headers as Record<string, string>;
        sawAccept = h.Accept ?? "";
        sawAuth   = h.Authorization ?? "";
        return new Response("zip", { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.ok(res);
    assert.equal(sawAccept, "application/octet-stream");
    assert.equal(sawAuth, "Bearer tok_secret");
  });

  test("returns null when unconfigured", async () => {
    const res = await fetchPluginAsset("https://api.github.com/x", {
      fetchImpl: (async () => new Response("zip")) as unknown as typeof fetch,
    });
    assert.equal(res, null);
  });
});
