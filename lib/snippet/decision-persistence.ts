/**
 * Decision-persistence gate for the snippet decide route and v1/slot.
 *
 * The decision providers persist per-visitor state when they are handed a
 * sessionId: RulesDecisionProvider merge-writes sticky rule context (including
 * the seeded `__entryPath`) into visitor_behavior_state, and
 * ExperimentDecisionProvider saves a plan_experiment_assignments row. Both are
 * behavioural profiling, so they may only run with personalization consent and
 * never for UA bots.
 *
 * Without that permission the route passes no sessionId to the rules provider
 * (rule evaluation still runs on the in-memory overlay, nothing is written) and
 * switches experiments off, so the visitor gets the matched rule's base plan
 * (control) and no assignment is stored.
 */

export interface DecisionPersistenceInput {
  /** The resolved visitor/session key for this request. */
  sessionId:              string;
  /** Effective personalization consent (tenant ceiling already applied). */
  personalizationConsent: boolean;
  /** Clear UA bot (isBotUserAgent). */
  isUaBot:                boolean;
  /** Tenant experiments master switch. */
  experimentsEnabled:     boolean;
}

export interface DecisionPersistence {
  /** Session id for the providers, or undefined when nothing may be persisted. */
  sessionId:          string | undefined;
  /** Whether plan experiments may run (and store an assignment). */
  experimentsEnabled: boolean;
}

export function resolveDecisionPersistence(input: DecisionPersistenceInput): DecisionPersistence {
  const allowed = input.personalizationConsent && !input.isUaBot && input.sessionId !== "";
  return {
    sessionId:          allowed ? input.sessionId : undefined,
    experimentsEnabled: allowed && input.experimentsEnabled,
  };
}
