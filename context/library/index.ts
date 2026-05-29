/**
 * Context Library — Barrel Export
 *
 * context/library/index.ts
 */

export type {
  ContextFamilyKey,
  ContextFamily,
  ContextSiteModel,
  ContextDefinitionStatus,
  ContextCriterion,
  ContextCriterionResult,
  ContextDefinition,
  ContextMatch,
  ContextEvalInput,
} from "./types";

export {
  CONTEXT_FAMILIES,
  CONTEXT_DEFINITIONS,
  getContextFamily,
} from "./definitions";

export {
  buildContextEvalInput,
  matchContextDefinitions,
} from "./match";
