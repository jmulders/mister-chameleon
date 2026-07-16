/**
 * tests/lead-base/session-cap-cohort.test.ts
 *
 * How the session cap folds into the lift cohort.
 *
 * There are now two reasons a visitor sees the default page:
 *   control — sampled into the holdout, on purpose, at random
 *   capped  — the tenant ran out of monthly sessions
 *
 * They must stay apart. The lift report only counts "control" and "personalized"
 * (see visitor-profiles-store.ts), so mislabelling a capped visitor as control
 * would quietly poison the baseline with non-random traffic — and only in the
 * busiest months, which is precisely when the number gets looked at.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assignPersonalizationGroup,
  applySessionCap,
  servesDefaultExperience,
} from "@/lib/lead-base/holdout";

describe("applySessionCap", () => {

  test("under the cap: the holdout draw stands", () => {
    assert.equal(applySessionCap("personalized", false), "personalized");
    assert.equal(applySessionCap("control", false),      "control");
  });

  test("over the cap: personalized becomes capped", () => {
    assert.equal(applySessionCap("personalized", true), "capped");
  });

  test("over the cap: control ALSO becomes capped, not control", () => {
    // The visitor sees the same default page either way, so this looks like a
    // no-op. It is not: leaving them as "control" adds non-random traffic to the
    // baseline the lift is measured against.
    assert.equal(
      applySessionCap("control", true),
      "capped",
      "a capped visitor must never be counted in the holdout baseline",
    );
  });
});

describe("servesDefaultExperience", () => {

  test("personalized gets the adapted experience", () => {
    assert.equal(servesDefaultExperience("personalized"), false);
  });

  test("control gets the default", () => {
    assert.equal(servesDefaultExperience("control"), true);
  });

  test("capped gets the default", () => {
    assert.equal(servesDefaultExperience("capped"), true);
  });
});

describe("assignPersonalizationGroup is unchanged by the new value", () => {

  test("never returns capped on its own — only the cap can do that", () => {
    for (let i = 0; i < 200; i++) {
      const g = assignPersonalizationGroup(`v-${i}`, 25);
      assert.ok(g === "control" || g === "personalized", `unexpected group: ${g}`);
    }
  });

  test("still deterministic per visitor", () => {
    assert.equal(
      assignPersonalizationGroup("visitor-abc", 30),
      assignPersonalizationGroup("visitor-abc", 30),
    );
  });
});
