/**
 * Experiment bucket assignment.
 *
 * Plain FNV-1a `% 2` only read the parity of the input characters, so a
 * visitor got the same (or always the opposite) bucket in every experiment.
 * Buckets must be stable per (session, experiment), split about 50/50, and be
 * independent between experiments.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { assignBucket, isEnrolled, resolveExperimentBucket } from "@/experiments/bucket-assignment";

/** Deterministic UUID-shaped session ids. */
function sessions(n: number): string[] {
  const out: string[] = [];
  let x = 0x9e3779b9;
  const hex = () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x.toString(16).padStart(8, "0");
  };
  for (let i = 0; i < n; i++) {
    const a = hex(), b = hex(), c = hex(), d = hex();
    out.push(`${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`);
  }
  return out;
}

const IDS = sessions(10_000);

describe("assignBucket", () => {
  it("is stable for the same session and experiment", () => {
    for (const s of IDS.slice(0, 50)) {
      assert.equal(assignBucket(s, "exp_a", 2), assignBucket(s, "exp_a", 2));
    }
  });

  it("splits sessions about 50/50", () => {
    const ones = IDS.filter((s) => assignBucket(s, "hero_careers_high_intent_vs_brand", 2) === 1).length;
    assert.ok(ones > 4_800 && ones < 5_200, `challenger share ${ones}/10000`);
  });

  it("assigns buckets independently per experiment", () => {
    // Independent 50/50 buckets agree for about half of the sessions. The old
    // hash agreed for 0% or 100% of them, for any pair of experiments.
    const pairs: [string, string][] = [["exp_a", "exp_b"], ["hero_test", "cta_test"], ["a", "b"], ["exp_1", "exp_2"]];
    for (const [x, y] of pairs) {
      const same = IDS.filter((s) => assignBucket(s, x, 2) === assignBucket(s, y, 2)).length;
      assert.ok(same > 4_800 && same < 5_200, `${x} vs ${y}: ${same}/10000 in the same bucket`);
    }
  });

  it("stays in range for more than two variants", () => {
    const seen = new Set(IDS.slice(0, 500).map((s) => assignBucket(s, "exp_multi", 3)));
    assert.deepEqual([...seen].sort(), [0, 1, 2]);
  });
});

describe("isEnrolled", () => {
  it("enrolls everyone at a fraction of 1", () => {
    assert.ok(IDS.slice(0, 100).every((s) => isEnrolled(s, "exp_a", 1)));
  });

  it("enrolls about the requested fraction", () => {
    const n = IDS.filter((s) => isEnrolled(s, "exp_a", 0.3)).length;
    assert.ok(n > 2_800 && n < 3_200, `${n}/10000 enrolled at 0.3`);
  });

  it("is independent of the bucket", () => {
    const enrolled = IDS.filter((s) => isEnrolled(s, "exp_a", 0.5));
    const ones = enrolled.filter((s) => assignBucket(s, "exp_a", 2) === 1).length;
    const share = ones / enrolled.length;
    assert.ok(share > 0.46 && share < 0.54, `challenger share among enrolled ${share.toFixed(3)}`);
  });
});

describe("resolveExperimentBucket", () => {
  it("returns null when not enrolled and the bucket otherwise", () => {
    const s = IDS.find((id) => !isEnrolled(id, "exp_a", 0.5))!;
    assert.equal(resolveExperimentBucket(s, "exp_a", 2, 0.5), null);
    const t = IDS.find((id) => isEnrolled(id, "exp_a", 0.5))!;
    assert.equal(resolveExperimentBucket(t, "exp_a", 2, 0.5), assignBucket(t, "exp_a", 2));
  });
});
