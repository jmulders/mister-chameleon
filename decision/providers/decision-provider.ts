/**
 * DecisionProvider interface
 *
 * The contract every decision provider must implement.
 * Keeping this as a thin interface means the rest of the codebase
 * (route handlers, RSC layouts, tests) depends on the interface,
 * not on any concrete implementation.
 *
 * Current implementations:
 *  RulesDecisionProvider — evaluates a static ordered rule set (MVP)
 *
 * Planned implementations (post-MVP):
 *  CmsDecisionProvider   — loads rules from Sanity in real time
 *  AbTestProvider        — wraps any provider with split-test logic
 *  MlDecisionProvider    — calls an inference endpoint for scoring
 *
 * Usage pattern (in a Next.js Route Handler or RSC):
 *
 *   import { RulesDecisionProvider } from "@/decision/providers/rules-decision-provider";
 *   import type { DecisionProvider } from "@/decision/providers/decision-provider";
 *
 *   const provider: DecisionProvider = new RulesDecisionProvider();
 *   const plan = await provider.getHomepagePlan(visitorContext);
 */

import type { ExperiencePlan, DecisionInput } from "../types";

export interface DecisionProvider {
  /**
   * Resolve an ExperiencePlan for the homepage given a decision input.
   *
   * Implementations must:
   *  - Never throw — return a fallback plan on any internal error.
   *  - Always return an ExperiencePlan with all three keys populated.
   *  - Be safe to call on every request (no mutable shared state).
   *
   * @param input - Visitor context + first-party history, built via buildDecisionInput().
   * @returns A promise that resolves to the selected ExperiencePlan.
   */
  getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan>;
}
