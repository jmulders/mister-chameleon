/**
 * Deterministic avatar helpers — initials + stable colour.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialsFrom, avatarColorClass, AVATAR_PALETTE } from "../../components/admin/avatar-util.ts";

describe("initialsFrom", () => {
  it("takes the first two letters of a single word", () => {
    assert.equal(initialsFrom("Enterprise"), "EN");
  });
  it("takes the first letter of the first two words", () => {
    assert.equal(initialsFrom("Enterprise Buyer"), "EB");
    assert.equal(initialsFrom("high value lead"), "HV");
  });
  it("splits on underscores, dashes and other punctuation (keys)", () => {
    assert.equal(initialsFrom("enterprise_buyer"), "EB");
    assert.equal(initialsFrom("high-intent"), "HI");
    // Standalone punctuation tokens are ignored, not used as an initial.
    assert.equal(initialsFrom("SMB / Startup"), "SS");
  });
  it("falls back to ? for an empty name", () => {
    assert.equal(initialsFrom("   "), "?");
    assert.equal(initialsFrom(""), "?");
  });
});

describe("avatarColorClass", () => {
  it("is deterministic for the same seed", () => {
    assert.equal(avatarColorClass("cta_meeting"), avatarColorClass("cta_meeting"));
  });
  it("always returns a class from the palette", () => {
    for (const seed of ["a", "enterprise_buyer", "", "zzz", "segment-42"]) {
      assert.ok(AVATAR_PALETTE.includes(avatarColorClass(seed) as (typeof AVATAR_PALETTE)[number]));
    }
  });
  it("spreads different seeds across more than one colour", () => {
    const seen = new Set(
      ["one", "two", "three", "four", "five", "six", "seven", "eight"].map(avatarColorClass),
    );
    assert.ok(seen.size > 1);
  });
});
