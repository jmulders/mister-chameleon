/**
 * Deterministic avatar helpers — initials + stable colour.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initialsFrom, avatarColorClass, AVATAR_PALETTE,
  parseAvatarConfig, avatarEmojiBgClass, AVATAR_COLOR_OPTIONS,
} from "../../components/admin/avatar-util.ts";

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

describe("parseAvatarConfig", () => {
  it("returns null for empty / non-object / bad shapes", () => {
    assert.equal(parseAvatarConfig(null), null);
    assert.equal(parseAvatarConfig(undefined), null);
    assert.equal(parseAvatarConfig("x"), null);
    assert.equal(parseAvatarConfig([]), null);
    assert.equal(parseAvatarConfig({ kind: "emoji" }), null);        // no value
    assert.equal(parseAvatarConfig({ kind: "emoji", value: "  " }), null);
    assert.equal(parseAvatarConfig({ kind: "image" }), null);        // no url
    assert.equal(parseAvatarConfig({ kind: "other", value: "x" }), null);
  });

  it("parses an emoji with a valid colour", () => {
    assert.deepEqual(parseAvatarConfig({ kind: "emoji", value: "🎯", color: "sky" }), { kind: "emoji", value: "🎯", color: "sky" });
  });

  it("drops an unknown colour but keeps the emoji", () => {
    assert.deepEqual(parseAvatarConfig({ kind: "emoji", value: "🎯", color: "chartreuse" }), { kind: "emoji", value: "🎯" });
  });

  it("caps a long emoji value and trims", () => {
    const out = parseAvatarConfig({ kind: "emoji", value: "  🎯🎯🎯🎯🎯🎯  " });
    assert.equal(out?.kind, "emoji");
    assert.equal([...(out as { value: string }).value].length, 4);
  });

  it("parses an image url (trimmed)", () => {
    assert.deepEqual(parseAvatarConfig({ kind: "image", url: "  /assets/a.png " }), { kind: "image", url: "/assets/a.png" });
  });
});

describe("avatarEmojiBgClass", () => {
  it("uses the chosen colour's tint when valid", () => {
    const sky = AVATAR_COLOR_OPTIONS.find((c) => c.key === "sky")!;
    assert.equal(avatarEmojiBgClass("sky", "seed"), sky.bgClass);
  });
  it("falls back to a seed-derived bg tint when no/invalid colour", () => {
    const cls = avatarEmojiBgClass(undefined, "enterprise");
    assert.ok(cls.startsWith("bg-"));
    assert.equal(avatarEmojiBgClass("nope", "enterprise"), avatarEmojiBgClass(undefined, "enterprise"));
  });
});
