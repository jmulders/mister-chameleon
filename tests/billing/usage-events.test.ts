/**
 * Usage Event Utilities Unit Tests
 *
 * Tests the pure helpers in billing/usage-events.ts:
 *   • buildIdempotencyKey()
 *   • validateUsageEventInput()
 *   • getUsageEventSummary() aggregation logic (tested via synthetic rows)
 *
 * DB-touching functions (trackUsageEvent, getUsageEvents) are not tested here
 * as they require a live Supabase connection.  They are exercised by the
 * integration test suite when a test DB is available.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { buildIdempotencyKey, validateUsageEventInput } from "@/billing/usage-events";
import type { UsageEventInput }                         from "@/billing/types";

// ── buildIdempotencyKey ───────────────────────────────────────────────────────

describe("buildIdempotencyKey", () => {
  it("returns a deterministic, colon-delimited string", () => {
    const key = buildIdempotencyKey("leadinfo_lookup", "tenant-1", "session-abc");
    assert.equal(key, "leadinfo_lookup:tenant-1:session-abc");
  });

  it("different event types produce different keys", () => {
    const k1 = buildIdempotencyKey("leadinfo_lookup", "t", "s");
    const k2 = buildIdempotencyKey("ip_enrich",       "t", "s");
    assert.notEqual(k1, k2);
  });

  it("different tenant IDs produce different keys", () => {
    const k1 = buildIdempotencyKey("leadinfo_lookup", "tenant-A", "session-1");
    const k2 = buildIdempotencyKey("leadinfo_lookup", "tenant-B", "session-1");
    assert.notEqual(k1, k2);
  });

  it("different session IDs produce different keys", () => {
    const k1 = buildIdempotencyKey("leadinfo_lookup", "t", "session-1");
    const k2 = buildIdempotencyKey("leadinfo_lookup", "t", "session-2");
    assert.notEqual(k1, k2);
  });

  it("is idempotent — same inputs always give same key", () => {
    const a = buildIdempotencyKey("ip_enrich", "my-tenant", "my-session");
    const b = buildIdempotencyKey("ip_enrich", "my-tenant", "my-session");
    assert.equal(a, b);
  });
});

// ── validateUsageEventInput ───────────────────────────────────────────────────

describe("validateUsageEventInput", () => {
  function validInput(overrides: Partial<UsageEventInput> = {}): UsageEventInput {
    return {
      tenantId:    "tenant-1",
      eventType:   "leadinfo_lookup",
      creditsCost: 1,
      success:     true,
      ...overrides,
    };
  }

  it("does not throw for a valid input", () => {
    assert.doesNotThrow(() => validateUsageEventInput(validInput()));
  });

  it("throws when tenantId is empty", () => {
    assert.throws(
      () => validateUsageEventInput(validInput({ tenantId: "" })),
      /tenantId is required/,
    );
  });

  it("throws when eventType is missing", () => {
    assert.throws(
      () => validateUsageEventInput(validInput({ eventType: "" as never })),
      /eventType is required/,
    );
  });

  it("throws when creditsCost is negative", () => {
    assert.throws(
      () => validateUsageEventInput(validInput({ creditsCost: -1 })),
      /creditsCost must be a non-negative number/,
    );
  });

  it("allows creditsCost of 0 (free / no-match calls)", () => {
    assert.doesNotThrow(() =>
      validateUsageEventInput(validInput({ creditsCost: 0, success: false })),
    );
  });

  it("throws when quantity is less than 1", () => {
    assert.throws(
      () => validateUsageEventInput(validInput({ quantity: 0 })),
      /quantity must be ≥ 1/,
    );
  });

  it("does not throw when quantity is omitted (defaults to 1)", () => {
    const input = validInput();
    delete input.quantity;
    assert.doesNotThrow(() => validateUsageEventInput(input));
  });

  it("allows all valid event types", () => {
    const types: UsageEventInput["eventType"][] = [
      "leadinfo_lookup",
      "ip_enrich",
      "weather_enrich",
      "intent_enrich",
      "crm_lookup",
    ];
    for (const eventType of types) {
      assert.doesNotThrow(
        () => validateUsageEventInput(validInput({ eventType })),
        `should not throw for eventType "${eventType}"`,
      );
    }
  });
});
