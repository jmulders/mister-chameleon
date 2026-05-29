/**
 * GET /api/admin/tenants/[tenantId]/experiments/debug
 *
 * Deep-diagnostic endpoint for plan experiment debugging.
 * Runs every step of the experiment pipeline explicitly and reports
 * success/failure at each stage — nothing is swallowed silently.
 */

import { NextRequest, NextResponse }              from "next/server";
import { listAllPlanExperiments,
         getActivePlanExperimentsForRule }         from "@/data/repositories/plan-experiments-repository";
import { loadTenantRulesConfig }                  from "@/decision/rules/load-tenant-rules";
import { RulesDecisionProvider }                  from "@/decision/providers/rules-decision-provider";
import { isEnrolled, assignBucket }               from "@/experiments/bucket-assignment";
import { emptyHistory }                           from "@/context/visitor-history";

// Deterministic test session used for all simulations in this endpoint
const TEST_SESSION = "debug-test-00000000-0000-0000-0000-000000000001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const out: Record<string, unknown> = { tenantId };

  // ── Step 1: List all experiments ────────────────────────────────────────────
  const expListResult = await listAllPlanExperiments(tenantId);
  out.step1_listExperiments = expListResult.ok
    ? { ok: true, count: expListResult.data.length, experiments: expListResult.data }
    : { ok: false, error: expListResult.error };

  if (!expListResult.ok) {
    out._conclusion = "DB connection failed at step 1 — Supabase may be paused or unreachable.";
    return NextResponse.json(out);
  }

  const experiments = expListResult.data;
  const activeExperiments = experiments.filter((e) => e.status === "active");

  // ── Step 2: Load rules config ────────────────────────────────────────────────
  const rulesConfig = await loadTenantRulesConfig(tenantId);
  out.step2_rulesConfig = {
    ok: !!rulesConfig,
    ruleCount: rulesConfig?.rules.length ?? 0,
    ruleIds: (rulesConfig?.rules ?? []).map((r) => r.id),
  };

  // ── Step 3: Per-experiment live DB lookup ────────────────────────────────────
  // Directly call getActivePlanExperimentsForRule for each active experiment's
  // rule_id — this is exactly what the runtime pipeline does.
  const step3 = await Promise.all(
    activeExperiments.map(async (exp) => {
      const result = await getActivePlanExperimentsForRule(exp.rule_id, tenantId);
      const found = result.ok ? result.data.find((e) => e.id === exp.id) : null;
      return {
        experimentId:    exp.id,
        rule_id:         exp.rule_id,
        dbQueryOk:       result.ok,
        dbQueryError:    result.ok ? null : result.error,
        foundInQuery:    !!found,
        rowsReturnedForRule: result.ok ? result.data.length : null,
        ruleExistsInConfig:  (rulesConfig?.rules ?? []).some((r) => r.id === exp.rule_id),
      };
    })
  );
  out.step3_liveDbLookupPerExperiment = step3;

  // ── Step 4: Rule matching simulation ────────────────────────────────────────
  // Simulate what rule fires for a fresh visitor. If the matched rule equals
  // an active experiment's rule_id, the experiment should run at runtime.
  const freshInput = {
    source: "direct" as const, device: "desktop" as const, visitType: "new" as const,
    utmSource: null, utmMedium: null, utmCampaign: null,
    referrerDomain: null, history: emptyHistory(), sessionId: TEST_SESSION,
  };
  const rulesProvider = new RulesDecisionProvider(rulesConfig ?? undefined);
  try {
    await rulesProvider.getHomepagePlan(freshInput as never);
  } catch { /* ignore — we only need lastMatchedRuleInfo */ }
  const matchedRuleId = rulesProvider.lastMatchedRuleInfo?.ruleId ?? null;

  out.step4_ruleMatchSimulation = {
    matchedRuleId,
    matchedRuleLabel: rulesProvider.lastMatchedRuleInfo?.ruleLabel ?? null,
    activeExperimentTargetsMatchedRule: activeExperiments.some((e) => e.rule_id === matchedRuleId),
  };

  // ── Step 5: Bucket assignment for each active experiment ─────────────────────
  // Shows which bucket the test session would land in.
  // bucket=0 → control (plan unchanged), bucket=1 → challenger (override applied).
  out.step5_bucketAssignment = activeExperiments.map((exp) => {
    const enrolled = isEnrolled(TEST_SESSION, exp.id, exp.traffic_fraction);
    const bucket   = enrolled ? assignBucket(TEST_SESSION, exp.id, 2) : null;
    return {
      experimentId:     exp.id,
      rule_id:          exp.rule_id,
      traffic_fraction: exp.traffic_fraction,
      enrolled,
      bucket,
      bucketLabel:      bucket === null ? "not enrolled" : bucket === 1 ? "challenger (plan overridden)" : "control (plan unchanged)",
    };
  });

  // ── Conclusion ───────────────────────────────────────────────────────────────
  const dbFailed  = step3.some((s) => !s.dbQueryOk);
  const notFound  = step3.some((s) => s.dbQueryOk && !s.foundInQuery);
  const noRuleMatch = !activeExperiments.some((e) => e.rule_id === matchedRuleId);
  const inControl = (out.step5_bucketAssignment as Array<{bucket: number|null}>)
    .some((s) => s.bucket === 0);

  if (dbFailed) {
    out._conclusion = "❌ DB query failed — Supabase connection error. Check step3 for details.";
  } else if (notFound) {
    out._conclusion = "❌ Experiment not returned by getActivePlanExperimentsForRule — tenant_id mismatch or status not active.";
  } else if (noRuleMatch) {
    out._conclusion = `⚠️ No active experiment targets the matched rule ("${matchedRuleId}"). Change the experiment's rule to match what fires for your test session.`;
  } else if (inControl) {
    out._conclusion = "⚠️ Experiment fires but test session lands in bucket 0 (control) — plan is UNCHANGED. To see the challenger, change the experiment ID or test with a different session cookie.";
  } else {
    out._conclusion = "✅ Experiment should fire and apply challenger plan. If the page looks unchanged, the challenger variant key may be identical to the control variant, or the CMS variant doesn't exist.";
  }

  return NextResponse.json(out);
}
