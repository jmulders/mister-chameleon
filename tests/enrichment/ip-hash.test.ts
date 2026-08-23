/**
 * Unit tests for the ip_company_cache key hash (lib/ip-hash.ts).
 *
 * loadKey() reads process.env at call time, so each test sets or clears
 * IP_HASH_KEY to exercise the keyed and keyless (dev) modes — no module reset
 * needed.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ipHash } from "@/lib/ip-hash";

const KEY = "a".repeat(64); // 32-byte hex

afterEach(() => { delete process.env.IP_HASH_KEY; });

describe("ipHash", () => {
  it("is deterministic for the same IP (keyed)", () => {
    process.env.IP_HASH_KEY = KEY;
    assert.equal(ipHash("203.0.113.7"), ipHash("203.0.113.7"));
  });

  it("differs across IPs", () => {
    process.env.IP_HASH_KEY = KEY;
    assert.notEqual(ipHash("203.0.113.7"), ipHash("203.0.113.8"));
  });

  it("returns a 64-char hex digest (never the raw IP)", () => {
    process.env.IP_HASH_KEY = KEY;
    const out = ipHash("203.0.113.7");
    assert.match(out, /^[0-9a-f]{64}$/);
    assert.equal(out.includes("203.0.113.7"), false);
  });

  it("trims whitespace before hashing", () => {
    process.env.IP_HASH_KEY = KEY;
    assert.equal(ipHash("  203.0.113.7 "), ipHash("203.0.113.7"));
  });

  it("keyed and unkeyed modes produce different digests", () => {
    process.env.IP_HASH_KEY = KEY;
    const keyed = ipHash("203.0.113.7");
    delete process.env.IP_HASH_KEY;
    const unkeyed = ipHash("203.0.113.7");
    assert.notEqual(keyed, unkeyed);
  });

  it("an invalid (non-hex) key falls back to unkeyed, not a throw", () => {
    process.env.IP_HASH_KEY = "not-hex";
    const bad = ipHash("203.0.113.7");
    delete process.env.IP_HASH_KEY;
    const unkeyed = ipHash("203.0.113.7");
    assert.equal(bad, unkeyed);
  });
});
