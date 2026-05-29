/**
 * AI Policy — Barrel Export
 */

export type {
  AiPolicyMode,
  AiPolicyConfig,
  AiPhasePolicies,
  SlotAiPolicyOverrides,
  ResolvedAiPolicy,
  AiPolicyDebugInfo,
} from "./types";

export { SYSTEM_DEFAULT_POLICIES }           from "./types";

export {
  resolveAiPolicy,
  shouldCallAi,
  shouldApplyAi,
  buildNotAppliedReason,
  buildPolicyDebugInfo,
  getPlatformAiPolicy,
} from "./resolve-policy";
export type { AiPhase, ResolvePolicyInput } from "./resolve-policy";
