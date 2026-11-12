/**
 * The admin can start three workflows, on a plain ref, with string inputs.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { parseWorkflowDispatch } from "../../lib/admin-auth/workflow-dispatch-input.ts";

describe("parseWorkflowDispatch", () => {
  it("accepts what the System page sends", () => {
    assert.deepEqual(parseWorkflowDispatch({ workflow: "production.yml", ref: "main" }), {
      ok: true,
      value: { workflow: "production.yml", ref: "main", inputs: {} },
    });
    const rollback = parseWorkflowDispatch({
      workflow: "rollback.yml",
      ref: "main",
      inputs: { deployment_url: "https://mister-chameleon-abc123.vercel.app", reason: "Manual rollback via admin panel" },
    });
    assert.equal(rollback.ok, true);
  });

  it("defaults the ref to main", () => {
    const r = parseWorkflowDispatch({ workflow: "staging.yml" });
    assert.equal(r.ok && r.value.ref, "main");
  });

  it("refuses any other workflow, including a path", () => {
    for (const workflow of ["ci.yml", "hotfix.yml", "../../../user", "production.yml/../ci.yml", "", 5, undefined]) {
      assert.equal(parseWorkflowDispatch({ workflow }).ok, false, String(workflow));
    }
  });

  it("refuses a ref that is not a plain name", () => {
    for (const ref of ["main; rm -rf", "a b", "../main", "refs/../x", "", "-x", 7]) {
      assert.equal(parseWorkflowDispatch({ workflow: "production.yml", ref }).ok, false, String(ref));
    }
  });

  it("refuses inputs that are not short strings", () => {
    assert.equal(parseWorkflowDispatch({ workflow: "rollback.yml", inputs: { reason: 5 } }).ok, false);
    assert.equal(parseWorkflowDispatch({ workflow: "rollback.yml", inputs: { reason: "x".repeat(501) } }).ok, false);
    assert.equal(parseWorkflowDispatch({ workflow: "rollback.yml", inputs: { "bad key": "x" } }).ok, false);
    assert.equal(parseWorkflowDispatch({ workflow: "rollback.yml", inputs: ["x"] }).ok, false);
    assert.equal(parseWorkflowDispatch("production.yml").ok, false);
  });
});
