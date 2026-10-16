/**
 * Route-level rate limits for the visitor-facing personalization endpoints.
 *
 * snippet decide is limited per siteKey + visitor IP and v1/slot per siteKey,
 * both inside the route (the proxy exempts them). These tests pin the counter
 * keys, the bucket sizes and the 429 headers.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { checkRateLimit } from "@/lib/rate-limiting";
import {
  snippetRateLimitKey,
  slotRateLimitKey,
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
