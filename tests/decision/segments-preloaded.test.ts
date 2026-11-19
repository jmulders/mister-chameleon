/**
 * evaluateAudienceSegments() can take a list that was started earlier.
 *
 * The list of a tenant's active segments is the same for every visitor and
 * needs only the tenant. The homepage pipeline starts reading it before the
 * decision context is built, and hands the read to the evaluation, which must
 * still run after the context is complete. See docs/performance/.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { evaluateAudienceSegments, type ActiveAudienceSegments } from "@/audience-segments/evaluate";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";

const ctx = { source: "linkedin", device: "desktop" } as unknown as RuleEvaluationContext;

function segment(key: string, criteria: unknown) {
  return { key, criteria } as unknown as Extract<ActiveAudienceSegments, { ok: true }>["data"][number];
}
const sourceIs = (value: string) => ({ type: "field", field: "source", operator: "equals", value });

describe("evaluateAudienceSegments with a list that was started earlier", () => {
  it("evaluates the handed-over list against the context", async () => {
    const preloaded = Promise.resolve<ActiveAudienceSegments>({
      ok:   true,
      data: [segment("via-linkedin", sourceIs("linkedin")), segment("via-google", sourceIs("google")), segment("ook-linkedin", sourceIs("linkedin"))],
    });
    assert.equal(await evaluateAudienceSegments(ctx, "t1", preloaded), "via-linkedin,ook-linkedin");
  });

  it("makes no segments of a read that failed", async () => {
    const failed = Promise.resolve<ActiveAudienceSegments>({ ok: false, error: "geen verbinding" });
    assert.equal(await evaluateAudienceSegments(ctx, "t1", failed), null);
    // A promise that rejects after all must not take the pipeline down either.
    const rejected = Promise.reject<ActiveAudienceSegments>(new Error("kapot"));
    assert.equal(await evaluateAudienceSegments(ctx, "t1", rejected), null);
  });

  it("still skips a segment without criteria, which would match everyone", async () => {
    const preloaded = Promise.resolve<ActiveAudienceSegments>({
      ok:   true,
      data: [segment("leeg", {}), segment("zonder", null), segment("via-linkedin", sourceIs("linkedin"))],
    });
    assert.equal(await evaluateAudienceSegments(ctx, "t1", preloaded), "via-linkedin");
  });

  it("gives no segments without a tenant, and does not wait for the list", async () => {
    const never = new Promise<ActiveAudienceSegments>(() => {});
    assert.equal(await evaluateAudienceSegments(ctx, "", never), null);
  });
});
