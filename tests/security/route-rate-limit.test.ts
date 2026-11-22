/**
 * Route-level rate limits for the endpoints a tenant's site calls.
 *
 * snippet decide is limited per siteKey + visitor IP, v1/slot and the WordPress
 * plugin's update proxy per siteKey, all inside the route (the proxy exempts
 * them). These tests pin the counter keys, the bucket sizes, the 429 headers
 * and the list of paths the proxy leaves alone.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { checkRateLimit } from "@/lib/rate-limiting";
import {
  snippetRateLimitKey,
  slotRateLimitKey,
  pluginRateLimitKey,
  rateLimitHeaders,
} from "@/lib/rate-limiting/route-limit";

describe("route rate-limit keys", () => {
  it("keys snippet decide per siteKey and visitor IP", () => {
    assert.equal(snippetRateLimitKey("sk_abc", "203.0.113.4"), "sk_abc:203.0.113.4");
  });

  it("gives two tenants seen from one IP separate snippet budgets", () => {
    assert.notEqual(
      snippetRateLimitKey("sk_a", "203.0.113.4"),
      snippetRateLimitKey("sk_b", "203.0.113.4"),
    );
  });

  it("falls back to 'unknown' for a missing IP", () => {
    assert.equal(snippetRateLimitKey("sk_abc", ""), "sk_abc:unknown");
  });

  it("keys v1/slot per siteKey only, so the shared CMS host IP is irrelevant", () => {
    assert.equal(slotRateLimitKey("sk_abc"), "sk_abc");
  });

  it("caps an oversized siteKey so it cannot bloat the counter key", () => {
    const huge = "x".repeat(10_000);
    assert.equal(slotRateLimitKey(huge).length, 128);
    assert.equal(snippetRateLimitKey(huge, "1.2.3.4"), `${"x".repeat(128)}:1.2.3.4`);
  });
});

describe("route rate-limit buckets", () => {
  it("allows 300 decide calls per minute by default", async () => {
    const rl = await checkRateLimit("snippet", "sk:1.2.3.4");
    assert.equal(rl.limit, 300);
    assert.equal(rl.allowed, true);
  });

  it("allows 6000 slot calls per tenant per minute by default", async () => {
    const rl = await checkRateLimit("slot", "sk");
    assert.equal(rl.limit, 6000);
  });
});

describe("the WordPress plugin's update proxy", () => {
  it("is keyed per siteKey, so sites on one hosting IP do not share a budget", () => {
    assert.equal(pluginRateLimitKey("sk_abc"), "sk_abc");
    assert.notEqual(pluginRateLimitKey("sk_a"), pluginRateLimitKey("sk_b"));
    assert.equal(pluginRateLimitKey("x".repeat(500)).length, 128);
  });

  it("allows 60 update checks and 10 downloads per site per minute by default", async () => {
    assert.equal((await checkRateLimit("pluginUpdate", "sk")).limit, 60);
    assert.equal((await checkRateLimit("pluginDownload", "sk")).limit, 10);
  });

  it("counts update checks and downloads apart", () => {
    // One bucket would let update checks eat the budget for the download.
    const update   = readFileSync("app/api/plugin/wp/update/route.ts", "utf8");
    const download = readFileSync("app/api/plugin/wp/download/route.ts", "utf8");
    assert.match(update,   /checkRateLimit\("pluginUpdate", pluginRateLimitKey\(siteKey\)\)/);
    assert.match(download, /checkRateLimit\("pluginDownload", pluginRateLimitKey\(siteKey\)\)/);
  });
});

describe("the paths the proxy does not rate-limit", () => {
  const proxy  = readFileSync("proxy.ts", "utf8");
  const exempt = [.../const RATE_LIMIT_EXEMPT = new Set\(\[([\s\S]*?)\]\)/.exec(proxy)![1]!.matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1]!);

  it("all exist as a route", () => {
    // An entry for a path without a route exempts nothing, and reads as if a
    // route were covered that is not.
    assert.ok(exempt.length >= 6, `only found ${exempt.length} paths`);
    for (const path of exempt) {
      assert.ok(existsSync(`app${path}/route.ts`), `${path} is exempt but app${path}/route.ts does not exist`);
    }
  });

  it("include both routes of the WordPress plugin's update proxy, next to the older manifest", () => {
    for (const path of ["/api/wp-plugin/update", "/api/plugin/wp/update", "/api/plugin/wp/download"]) {
      assert.ok(exempt.includes(path), `${path} is rate-limited per IP`);
    }
  });

  it("limit themselves wherever a call does work for a siteKey", () => {
    // Exempt from the per-IP limit must not mean unlimited for a route that
    // looks up a tenant on every call.
    const own: Record<string, string> = {
      "/api/snippet/decide":     "snippet",
      "/api/v1/slot":            "slot",
      "/api/plugin/wp/update":   "pluginUpdate",
      "/api/plugin/wp/download": "pluginDownload",
    };
    for (const path of exempt) {
      const route = readFileSync(`app${path}/route.ts`, "utf8");
      if (!/getTenantBySiteKey/.test(route)) continue;
      assert.ok(own[path], `${path} looks up a tenant by siteKey and has no limit of its own`);
      assert.ok(route.includes(`checkRateLimit("${own[path]}"`), `${path} does not use its "${own[path]}" bucket`);
    }
  });
});

describe("rateLimitHeaders", () => {
  it("reports limit, remaining and retry for a 429", () => {
    const h = rateLimitHeaders({ allowed: false, count: 305, limit: 300, retryAfterSeconds: 12 });
    assert.equal(h["Retry-After"], "12");
    assert.equal(h["X-RateLimit-Limit"], "300");
    assert.equal(h["X-RateLimit-Remaining"], "0");
    const reset = Number(h["X-RateLimit-Reset"]);
    const now   = Math.floor(Date.now() / 1000);
    assert.ok(reset >= now + 11 && reset <= now + 13);
  });
});
