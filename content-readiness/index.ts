/**
 * Content Readiness Module — Public API
 *
 * A structured, evaluatable checklist system for verifying that a tenant
 * has sufficient content coverage and quality before launching on the platform.
 *
 * ─── What this module provides ───────────────────────────────────────────────
 *
 *   Types
 *     ContentReadinessCheckId   — stable IDs for all 19 checks
 *     CheckCategory             — "coverage" | "completeness" | "quality" | ...
 *     CheckSeverity             — "error" | "warning" | "info"
 *     CheckStatus               — "pass" | "fail" | "skipped"
 *     ContentFetchError         — a failed CMS fetch for a specific variant key
 *     ContentSnapshot           — fetched CMS content indexed by variant key
 *     ContentReadinessContext   — tenant config + snapshot (input to all checks)
 *     CheckResult               — outcome of evaluating one check
 *     ContentReadinessCheck     — a check definition with evaluate() function
 *     CheckResultEntry          — check + result pair (in reports)
 *     ReadinessSummary          — aggregated pass/fail/skip counts
 *     ReadinessReport           — complete evaluation output for one tenant
 *
 *   Checklist data
 *     DEFAULT_READINESS_CHECKLIST — 19 checks across 5 categories
 *
 *   Context builder (async)
 *     buildContentReadinessContext()  — fetches all CMS content → context
 *
 *   Evaluation
 *     evaluateCheck()      — run one check against a context
 *     evaluateReadiness()  — run all checks, produce a ReadinessReport
 *
 *   Query helpers
 *     getBlockingChecks()    — error-severity failures (launch blockers)
 *     getFailedChecks()      — all failed checks (errors + warnings + infos)
 *     getPassedChecks()      — all passing checks
 *     getSkippedChecks()     — checks not applicable for this tenant
 *     getChecksByCategory()  — filter results by category
 *     getAffectedKeys()      — flat list of variant keys that need fixing
 *     formatReadinessSummary() — one-line human-readable status string
 *
 * ─── Typical usage ───────────────────────────────────────────────────────────
 *
 *   // 1. Build a CMS provider from the tenant config
 *   import { createCMSProvider } from "@/cms";
 *   import { buildContentReadinessContext, evaluateReadiness } from "@/content-readiness";
 *
 *   const cms     = createCMSProvider(tenant.cmsProvider);
 *   const context = await buildContentReadinessContext(tenant, cms);
 *   const report  = evaluateReadiness(context);
 *
 *   // 2. Check launch readiness
 *   if (!report.isLaunchReady) {
 *     const blockers = getBlockingChecks(report);
 *     // → render blockers in admin readiness view
 *   }
 *
 *   // 3. Get the content gaps list for the CMS team
 *   const keysToFix = getAffectedKeys(report);
 *   // → ["cta_meeting", "hero_linkedin_vision", "proof_vision"]
 *
 * ─── Extending with custom checks ────────────────────────────────────────────
 *
 *   Implement ContentReadinessCheck with an evaluate() function and pass
 *   a custom array to evaluateReadiness():
 *
 *   const customChecks = [...DEFAULT_READINESS_CHECKLIST, myExtraCheck];
 *   const report = evaluateReadiness(context, customChecks);
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ContentReadinessCheckId,
  CheckCategory,
  CheckSeverity,
  CheckStatus,
  ContentFetchError,
  ContentSnapshot,
  ContentReadinessContext,
  CheckResult,
  ContentReadinessCheck,
  CheckResultEntry,
  ReadinessSummary,
  ReadinessReport,
} from "./types";

// ── Checklist data ────────────────────────────────────────────────────────────
export { DEFAULT_READINESS_CHECKLIST, PLATFORM_VARIANT_KEYS } from "./checklist";

// ── Context builder ───────────────────────────────────────────────────────────
export { buildContentReadinessContext } from "./checklist";

// ── Evaluation ────────────────────────────────────────────────────────────────
export { evaluateCheck, evaluateReadiness } from "./checklist";

// ── Query helpers ─────────────────────────────────────────────────────────────
export {
  getBlockingChecks,
  getFailedChecks,
  getPassedChecks,
  getSkippedChecks,
  getChecksByCategory,
  getAffectedKeys,
  formatReadinessSummary,
} from "./checklist";
