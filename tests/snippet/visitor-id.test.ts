/**
 * Unit tests for the snippet visitor-id normaliser.
 *
 * Pure function, no infra — safe for the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { normaliseVisitorId } from "../../lib/snippet/visitor-id.ts";

describe("normaliseVisitorId", () => {
  it("accepts a UUID v4", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    assert.equal(normaliseVisitorId(id), id);
  });

  it("accepts the snippet's mc_<ts>_<rand> fallback id", () => {
    const id = "mc_1737500000000_ab12cd34ef";
    assert.equal(normaliseVisitorId(id), id);
  });

  it("trims surrounding whitespace", () => {
    assert.equal(normaliseVisitorId("  mc_1737500000000_x9y8z7  "), "mc_1737500000000_x9y8z7");
  });

  it("rejects empty, short, or oversized ids", () => {
    assert.equal(normaliseVisitorId(""), null);
    assert.equal(normaliseVisitorId("short"), null);          // < 8 chars
    assert.equal(normaliseVisitorId("a".repeat(101)), null);  // > 100 chars
  });

  it("rejects ids with unsafe characters", () => {
    assert.equal(normaliseVisitorId("mc_1737500000000; DROP TABLE"), null);
    assert.equal(normaliseVisitorId("has spaces here"), null);
    assert.equal(normaliseVisitorId("weird/../slash"), null);
    assert.equal(normaliseVisitorId("<script>alert(1)</script>"), null);
  });

  it("rejects non-string input", () => {
    assert.equal(normaliseVisitorId(null), null);
    assert.equal(normaliseVisitorId(undefined), null);
    assert.equal(normaliseVisitorId(12345678), null);
    assert.equal(normaliseVisitorId({}), null);
  });
});
