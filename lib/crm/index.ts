/**
 * CRM Layer — Public API
 *
 * Re-exports from the CRM layer for use by the rules engine,
 * decision pipeline, debug panel, and admin UI.
 *
 * Usage:
 *   import { mergeCrmWithBehavior, computeCustomerMode } from "@/lib/crm";
 *   import type { CrmProfile, CrmMergedState, CustomerMode } from "@/lib/crm";
 */

export type {
  CrmLifecycleStage,
  CustomerMode,
  CrmProfile,
  CrmMergedState,
  VisitorCrmIdentity,
} from "./types";

export {
  normalizeCrmLifecycleStage,
  emptyCrmProfile,
  emptyCrmMergedState,
} from "./types";

export {
  computeCustomerMode,
} from "./derive-customer-mode";

export {
  mergeCrmWithBehavior,
  normalizeCrmProfile,
} from "./merge-lifecycle";
