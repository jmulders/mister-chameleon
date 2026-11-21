/**
 * The result of a plan experiment.
 *
 * An experiment could be created, run and ended, and nowhere did the admin
 * say which arm did better. These tests hold the sum behind the results table
 * and the verdict that keeps a reader from seeing a winner in noise.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  conversionRate,
  judgeExperiment,
  MIN_CONVERSIONS_TOTAL,
  MIN_VISITORS_PER_ARM,
  tallyExperimentResults,
  type AssignmentForResult,
} from "../../experiments/plan-experiment-results.ts";

const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T10:00:00+00:00`;
const enrol = (experiment: string, session: string, bucket: 0 | 1, day = 10): AssignmentForResult =>
  ({ experiment_id: experiment, session_id: session, bucket, created_at: at(day) });

describe("tallyExperimentResults", () => {
  it("counts visitors and conversions per arm", () => {
    const out = tallyExperimentResults(
      [enrol("e1", "a", 0), enrol("e1", "b", 0), enrol("e1", "c", 1), enrol("e1", "d", 1), enrol("e1", "e", 1)],
      new Map([["b", at(12)], ["c", at(11)], ["d", at(15)]]),
    );
    assert.deepEqual(out.get("e1"), {
      control:    { visitors: 2, conversions: 1 },
      challenger: { visitors: 3, conversions: 2 },
    });
  });

  it("does not count a request made before the visitor was enrolled", () => {
    const out = tallyExperimentResults([enrol("e1", "a", 1, 10)], new Map([["a", at(3)]]));
    assert.deepEqual(out.get("e1")?.challenger, { visitors: 1, conversions: 0 });
  });

  it("counts a request made at the moment of enrolment", () => {
    const out = tallyExperimentResults([enrol("e1", "a", 1, 10)], new Map([["a", at(10)]]));
    assert.equal(out.get("e1")?.challenger.conversions, 1);
  });

  it("keeps experiments apart, and a visitor can be in two", () => {
    const out = tallyExperimentResults(
      [enrol("e1", "a", 0), enrol("e2", "a", 1), enrol("e2", "b", 0)],
      new Map([["a", at(20)]]),
    );
    assert.deepEqual(out.get("e1"), { control: { visitors: 1, conversions: 1 }, challenger: { visitors: 0, conversions: 0 } });
    assert.deepEqual(out.get("e2"), { control: { visitors: 1, conversions: 0 }, challenger: { visitors: 1, conversions: 1 } });
  });

  it("counts a visitor once when a row comes in twice", () => {
    const out = tallyExperimentResults([enrol("e1", "a", 1), enrol("e1", "a", 1)], new Map([["a", at(20)]]));
    assert.deepEqual(out.get("e1")?.challenger, { visitors: 1, conversions: 1 });
  });

  it("has no entry for an experiment nobody was enrolled in", () => {
    assert.equal(tallyExperimentResults([], new Map()).size, 0);
  });
});

describe("conversionRate", () => {
  it("is conversions per visitor, and 0 without visitors", () => {
    assert.equal(conversionRate({ visitors: 200, conversions: 30 }), 0.15);
    assert.equal(conversionRate({ visitors: 0, conversions: 0 }), 0);
  });
});

describe("judgeExperiment", () => {
  const result = (cv: number, cc: number, hv: number, hc: number) =>
    ({ control: { visitors: cv, conversions: cc }, challenger: { visitors: hv, conversions: hc } });

  it("says too early with few visitors in either arm", () => {
    assert.equal(judgeExperiment(result(MIN_VISITORS_PER_ARM - 1, 10, 500, 100)), "too-early");
    assert.equal(judgeExperiment(result(500, 100, MIN_VISITORS_PER_ARM - 1, 10)), "too-early");
  });

  it("says too early with few requests in total, however many visitors", () => {
    assert.equal(judgeExperiment(result(5000, 2, 5000, MIN_CONVERSIONS_TOTAL - 3)), "too-early");
  });

  it("does not call ten against eight a difference", () => {
    assert.equal(judgeExperiment(result(200, 8, 200, 10)), "no-clear-difference");
  });

  it("calls three hundred against two hundred one", () => {
    assert.equal(judgeExperiment(result(2000, 200, 2000, 300)), "challenger-ahead");
    assert.equal(judgeExperiment(result(2000, 300, 2000, 200)), "control-ahead");
  });

  it("sits on the usual 95 percent line", () => {
    // 1000 visitors per arm, 100 against 128: z is about 1.97. Against 127: about 1.90.
    assert.equal(judgeExperiment(result(1000, 100, 1000, 128)), "challenger-ahead");
    assert.equal(judgeExperiment(result(1000, 100, 1000, 127)), "no-clear-difference");
  });

  it("handles arms where everyone or no one converted", () => {
    assert.equal(judgeExperiment(result(50, 50, 50, 50)), "no-clear-difference");
    assert.equal(judgeExperiment(result(50, 0, 50, 0)), "too-early");
  });
});

describe("the admin shows it", () => {
  const read = (file: string) => readFileSync(file, "utf8");

  it("the experiments page loads the results and renders them", () => {
    const page = read("app/admin/tenants/[tenantId]/personalization/experiments/page.tsx");
    assert.match(page, /getPlanExperimentResults\(tenantId, planExperimentsResult\.data\.map\(\(e\) => e\.id\)\)/);
    assert.match(page, /<PlanExperimentResults/);
    assert.match(page, /The results could not be loaded/);
  });

  it("the table says what it counts and when it is too early", () => {
    const table = read("app/admin/tenants/[tenantId]/personalization/experiments/_components/PlanExperimentResults.tsx");
    assert.match(table, /visitors who gave consent/);
    assert.match(table, /Too early to tell/);
    assert.match(table, /\{MIN_VISITORS_PER_ARM\} visitors per arm/);
  });

  it("the read stays inside the tenant and counts conversions only", () => {
    const repo = read("data/repositories/plan-experiments-repository.ts");
    const fn = repo.slice(repo.indexOf("export async function getPlanExperimentResults"));
    assert.match(fn, /\.in\("experiment_id", \[\.\.\.experimentIds\]\)/);
    assert.match(fn, /\.eq\("tenant_id", tenantId\)\s*\.not\("converted_at", "is", null\)/);
    assert.match(fn, /if \(experimentIds\.length === 0\) return/);
  });

  it("the Performance page no longer calls the holdout a planned step", () => {
    const page = read("app/admin/tenants/[tenantId]/personalization/performance/page.tsx");
    assert.doesNotMatch(page, /planned next step/);
    assert.match(page, /Personalization holdout/);
    assert.match(page, /does not test whether a difference could be chance/);
  });
});
