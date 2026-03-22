/**
 * Experience module — barrel export
 *
 * Public API for the experience composer layer.
 * Import from "@/experience" for types and the composer function.
 *
 * Internal module structure:
 *
 *   types.ts
 *     HomepageExperience, ExperienceComposerMeta, ComposedHomepageExperience
 *
 *   compose-experience.ts
 *     composeHomepageExperience(context, decisionProvider, cmsProvider)
 *
 *   log-served-variants.ts
 *     logServedVariants(sessionId, experience)
 */

// Types
export type {
  HomepageExperience,
  ExperienceComposerMeta,
  ComposedHomepageExperience,
} from "./types";

// Composer
export { composeHomepageExperience } from "./compose-experience";
export type { CmsFallbackKeys }       from "./compose-experience";

// Logging komt later terug zodra de data/repositories-laag bestaat