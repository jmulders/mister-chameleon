/**
 * Context module — barrel export
 *
 * Public API for the visitor context layer.
 * Import from "@/context" to access types and the detection function.
 *
 * Internal module structure:
 *  types.ts          — canonical type definitions
 *  helpers.ts        — pure utility functions (parseReferrer, readCookies, detectDevice)
 *  detect-context.ts — main detectVisitorContext() function
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
