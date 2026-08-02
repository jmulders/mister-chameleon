/**
 * bench-decide — two-tenant decision benchmark + cross-tenant isolation check.
 *
 * Answers two of the advisor's questions in one runnable script:
 *
 *   1. What is the p95 of the decide COMPUTE? This is the Active-CPU-relevant
 *      cost and the part of the 700ms reveal budget that is ours. We run two
 *      tenants concurrently, many iterations, and report p50/p95/p99.
 *
 *   2. Can tenant A ever receive tenant B's plan? Two providers are built from
 *      differently-marked configs and run concurrently; we assert each always
 *      returns its own plan. A single cross is a hard failure.
 *
 * Scope: this measures the in-process decision engine (no network, no DB). The
 * shared-cache layer — where the "A sees B's rules" bug would actually live —
 * is guarded by the ownership check in readRawTenantConfig (load-tenant-rules.ts),
 * which needs the Next runtime + DB to exercise end-to-end. The production
 * two-tenant runtime test (hit tenant A and B on the live site concurrently)
 * remains the end-to-end proof; this covers the engine and the compute budget.
 *
 * Run:  npx tsx scripts/bench-decide.ts
 */

import { RulesDecisionProvider } from "@/decision/providers/rules-decision-provider";
import { SEED_RULES_CONFIG } from "@/decision/rules/stored-rule";
import { buildDecisionInput } from "@/decision/types";

const LATENCY_ITERATIONS  = 20_000;
const ISOLATION_ITERATIONS = 50_000;
const WARMUP               = 2_000;

// ── A plausible visitor input (types are stripped by tsx at runtime) ──────────
const baseContext = {
  source: "direct",
  device: "desktop",
  visitType: "first",
  rawReferrer: null,
  referrerDomain: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  userAgent: "bench-decide",
  resolvedAt: Date.now(),
};
const history = { fromDatabase: false } as unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const input = buildDecisionInput(baseContext as any, history as any);

function clone<T>(v: T): T {
  return structuredClone(v);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  // ── Latency: two tenants, realistic (seed) rules, run concurrently ──────────
  const providerA = new RulesDecisionProvider(clone(SEED_RULES_CONFIG));
  const providerB = new RulesDecisionProvider(clone(SEED_RULES_CONFIG));

  for (let i = 0; i < WARMUP; i++) {
    await Promise.all([providerA.getHomepagePlan(input), providerB.getHomepagePlan(input)]);
  }

  const timings: number[] = [];
  for (let i = 0; i < LATENCY_ITERATIONS; i++) {
    const t0 = performance.now();
    await Promise.all([providerA.getHomepagePlan(input), providerB.getHomepagePlan(input)]);
    timings.push(performance.now() - t0);
  }
  timings.sort((a, b) => a - b);

  const mean = timings.reduce((s, v) => s + v, 0) / timings.length;

  // ── Isolation: differently-marked configs, assert no cross ──────────────────
  const configA = clone(SEED_RULES_CONFIG);
  const configB = clone(SEED_RULES_CONFIG);
  configA.rules = [];
  configB.rules = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (configA.defaultPlan as any).heroKey = "hero_default";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (configB.defaultPlan as any).heroKey = "hero_consideration";

  const isoA = new RulesDecisionProvider(configA);
  const isoB = new RulesDecisionProvider(configB);

  let crosses = 0;
  for (let i = 0; i < ISOLATION_ITERATIONS; i++) {
    const [planA, planB] = await Promise.all([
      isoA.getHomepagePlan(input),
      isoB.getHomepagePlan(input),
    ]);
    if (planA.heroKey !== "hero_default" || planB.heroKey !== "hero_consideration") {
      crosses++;
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log("\n── decide compute (two tenants concurrent) ─────────────────");
  console.log(`iterations (pairs):  ${LATENCY_ITERATIONS.toLocaleString("en-US")}`);
  console.log(`mean:   ${mean.toFixed(4)} ms/pair`);
  console.log(`p50:    ${percentile(timings, 50).toFixed(4)} ms`);
  console.log(`p95:    ${percentile(timings, 95).toFixed(4)} ms`);
  console.log(`p99:    ${percentile(timings, 99).toFixed(4)} ms`);
  console.log(`max:    ${timings[timings.length - 1].toFixed(4)} ms`);
  console.log(`\n700 ms reveal budget headroom (p95): ${(700 / percentile(timings, 95)).toFixed(0)}× the compute`);

  console.log("\n── cross-tenant isolation ──────────────────────────────────");
  console.log(`iterations (pairs):  ${ISOLATION_ITERATIONS.toLocaleString("en-US")}`);
  console.log(`cross-tenant plan leaks: ${crosses}`);
  console.log(crosses === 0 ? "PASS — no tenant ever received another tenant's plan." : "FAIL — cross-tenant leak detected.");

  process.exit(crosses === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("bench-decide failed:", err);
  process.exit(2);
});
