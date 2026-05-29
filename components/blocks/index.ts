/**
 * Blocks barrel export
 *
 * Content blocks are composite components that map 1:1 to page sections.
 * They accept typed props that will be driven by CMS content and the
 * experience context once the adaptive layer is implemented.
 *
 *   import { HeroBlock, IntroBlock, ProofBlock, SolutionBlock, CTABlock }
 *     from "@/components/blocks";
 */

export { HeroBlock } from "./HeroBlock";
export type { HeroBlockProps } from "./HeroBlock";

export { IntroBlock } from "./IntroBlock";
export type { IntroBlockProps } from "./IntroBlock";

export { ProofBlock } from "./ProofBlock";
export type { ProofBlockProps } from "./ProofBlock";

export { SolutionBlock } from "./SolutionBlock";
export type { SolutionBlockProps } from "./SolutionBlock";

export { CTABlock } from "./CTABlock";
export type { CTABlockProps } from "./CTABlock";

export { ExperienceDiagnosticsBar } from "./ExperienceDiagnosticsBar";
export type { ExperienceDiagnosticsBarProps } from "./ExperienceDiagnosticsBar";

export { NotificationBlock } from "./NotificationBlock";
export type { NotificationBlockProps } from "./NotificationBlock";
