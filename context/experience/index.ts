/**
 * Experience Context
 *
 * Represents a fully resolved experience — the combination of a decision
 * result and the CMS content associated with that variant.
 *
 * This context is injected at the layout level via a React Server Component
 * and passed down to adaptive blocks via React context or props.
 *
 * TODO: Implement provider, hooks, and RSC integration.
 */

import type { DecisionResult } from "../decision";

/** A resolved experience ready to be rendered. */
export interface Experience {
  key: string;
  decision: DecisionResult;
  /** CMS content payload — shape TBD once Sanity schema is defined */
  content: Record<string, unknown>;
}

/** Shape of the React context value. */
export interface ExperienceContextValue {
  experience: Experience | null;
  isLoading: boolean;
}
