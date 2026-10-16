/**
 * Unit tests for the journey event-id helpers.
 *
 * visitor_journey_events.event_id is a uuid column. A non-UUID event id (the
 * snippet's `mc_<ts>_<rand>` fallback on browsers without crypto.randomUUID)
 * makes the idempotent upsert fail silently, so the route must only ever hand
 * recordJourneyEvent a valid UUID. Pure functions, no infra.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { deterministicUuid, isUuid, toJourneyEventId } from "@/lib/snippet/event-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("deterministicUuid", () => {
  it("produces a stable RFC 4122 v5-shaped UUID", () => {
    const a = deterministicUuid("v1slot|vid|/pricing|123");
    assert.match(a, UUID_RE);
    assert.equal(a[14], "5");
    assert.ok("89ab".includes(a[19]));
    assert.equal(deterministicUuid("v1slot|vid|/pricing|123"), a);
    assert.notEqual(deterministicUuid("v1slot|vid|/pricing|124"), a);
  });
});

describe("isUuid", () => {
  it("accepts a UUID in any case and rejects everything else", () => {
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
    assert.equal(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), true);
    for (const v of ["mc_1737500000000_ab12cd34ef", "", "3f2504e0-4f89-41d3-9a0c", null, 42, undefined]) {
      assert.equal(isUuid(v), false);
    }
  });
});

describe("toJourneyEventId", () => {
  it("passes a valid UUID through unchanged (trimmed)", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    assert.equal(toJourneyEventId(id, "t1"), id);
    assert.equal(toJourneyEventId(`  ${id} `, "t1"), id);
  });

  it("derives a deterministic UUID from the snippet's non-UUID fallback id", () => {
    const raw = "mc_1737500000000_ab12cd34ef";
    const out = toJourneyEventId(raw, "t1");
    assert.ok(out);
    assert.match(out, UUID_RE);
    // Same pageview id (a retry) → same UUID, so the upsert still dedupes.
    assert.equal(toJourneyEventId(raw, "t1"), out);
    // Scoped per tenant.
    assert.notEqual(toJourneyEventId(raw, "t2"), out);
  });

  it("omits non-string, empty and oversized ids", () => {
    for (const v of [undefined, null, 123, {}, "", "   ", "x".repeat(201)]) {
      assert.equal(toJourneyEventId(v, "t1"), undefined);
    }
  });
});
