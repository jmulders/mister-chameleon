/**
 * Context module — barrel export
 *
 * Public API for the visitor context layer.
 * Import from "@/context" to access types and the detection function.
 *
 * Internal module structure:
 *  types.ts          — canonical type definitions
 *  helpers.ts        — pure utility functions (parseReferrer, readCookies, detectDevice)
 *  detect-context.ts — main detectVisitorContext() function, reads attribution cookie
 *  attribution.ts    — mc_attr cookie: UTM + referrer persistence across navigations
 *  decision/         — decision engine types (DecisionResult, DecisionRule)
 *  experience/       — resolved experience types
 */

// Types
export type {
  TrafficSource,
  DeviceType,
  VisitType,
  VisitorContext,
  SerializedVisitorContext,
} from "./types";

// Detection
export {
  detectVisitorContext,
  SEEN_COOKIE,
  SEEN_COOKIE_VALUE,
} from "./detect-context";

// Attribution persistence — UTM params + referrer stored in mc_attr cookie
// Written by middleware on UTM touches; read by detectVisitorContext() as fallback.
export type { AttributionData, AttributionResolution } from "./attribution";
export {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  resolveAttribution,
  serializeAttribution,
  parseAttributionCookie,
  hasUtmParams,
  parseUtmFromUrl,
} from "./attribution";

// Helpers (exported for unit testing and external use)
export { parseReferrer, readCookies, detectDevice } from "./helpers";
export type { ParsedReferrer } from "./helpers";

// Decision engine types
export type { DecisionResult, DecisionRule } from "./decision";
export { FALLBACK_EXPERIENCE_KEY } from "./decision";

// Experience types
export type { Experience, ExperienceContextValue } from "./experience";

// Visitor history — first-party behavioural signals
export type { VisitorHistory } from "./visitor-history";
export { emptyHistory, historyToLogMeta } from "./visitor-history";
export { fetchVisitorHistory } from "./fetch-visitor-history";

// ── Context variable registry ──────────────────────────────────────────────────
//
// Central typed catalog of all runtime context variables.
// Consumed by: admin dictionary UI, AI providers, rules UI, validation.

export type {
  ContextOperator,
  ContextVarType,
  ContextVarSource,
  ContextVariableDef,
} from "./registry";

export {
  // Data
  CONTEXT_VARIABLES,
  CONTEXT_VARIABLE_MAP,
  CONTEXT_VARS_BY_SOURCE,
  CONTEXT_SOURCE_ORDER,
  CONTEXT_SOURCE_LABELS,
  // Operator shortlists per type
  OPS_ENUM,
  OPS_STRING,
  OPS_NUMBER,
  OPS_BOOLEAN,
  // Lookup helpers
  getContextVar,
  getVarsForRules,
  getVarsForAI,
  getVarsBySource,
  getVarsByType,
  // Rules compatibility helpers
  getOperatorsForType,
  getOperatorsForKey,
  getAllContextKeys,
  getRuleContextKeys,
  isValidRuleKey,
} from "./registry";
