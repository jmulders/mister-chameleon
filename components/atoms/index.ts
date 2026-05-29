/**
 * Atoms — unified UI primitives barrel
 *
 * The atoms layer is the lowest level of the component hierarchy: small,
 * single-responsibility building blocks with no business logic. Blocks
 * and higher-level components are built on top of these atoms.
 *
 * ─── Import paths ─────────────────────────────────────────────────────────────
 *
 *   Prefer importing from this barrel in block and layout code:
 *     import { Button, Heading, Input, Image } from "@/components/atoms";
 *
 *   The underlying module paths (@/components/primitives/*, @/components/ui/*)
 *   remain valid for targeted imports when a barrel import would be too broad.
 *
 * ─── Atom categories ──────────────────────────────────────────────────────────
 *
 *   Layout atoms   — structure and spacing, no visual opinions
 *   Typography     — text rendering with design-token colour + scale
 *   Media          — responsive images
 *   Interactive    — buttons, links, badges
 *   Form           — input elements, field wrappers
 *
 * ─── What does NOT live here ──────────────────────────────────────────────────
 *
 *   - Composite components (Card, complex data displays) → @/components/ui
 *   - Content blocks (HeroBlock, FeatureGridBlock, …)  → @/components/blocks
 *   - Tracking-aware wrappers (TrackedCTAButton)       → @/components/tracking
 *   - CMS-specific renderers (PortableTextRenderer)    → @/components/blocks/sections
 */

// ── Layout atoms ──────────────────────────────────────────────────────────────

export { Container }       from "@/components/primitives/Container";
export { Section }         from "@/components/primitives/Section";
export { Stack }           from "@/components/primitives/Stack";
export { Grid }            from "@/components/primitives/Grid";

// ── Typography atoms ──────────────────────────────────────────────────────────

export { Text }            from "@/components/primitives/Text";
export { Heading }         from "@/components/primitives/Heading";
export { Prose }           from "@/components/primitives/Prose";

// ── Media atoms ───────────────────────────────────────────────────────────────

export { Image }           from "@/components/primitives/Image";

// ── Interactive atoms ─────────────────────────────────────────────────────────

export { Button }          from "@/components/ui/Button";
export { Badge }           from "@/components/ui/Badge";
export { Link }            from "@/components/ui/Link";

// ── Form atoms ────────────────────────────────────────────────────────────────

export { Input }           from "@/components/ui/Input";
export { Textarea }        from "@/components/ui/Textarea";
export { Select }          from "@/components/ui/Select";
export { FormField }       from "@/components/ui/FormField";

// ── Re-export prop types for consumer TypeScript use ─────────────────────────

export type { ContainerProps }  from "@/components/primitives/Container";
export type { SectionProps }    from "@/components/primitives/Section";
export type { HeadingProps }    from "@/components/primitives/Heading";
export type { ProseProps }      from "@/components/primitives/Prose";
export type { ImageProps }      from "@/components/primitives/Image";
export type { InputProps }      from "@/components/ui/Input";
export type { TextareaProps }   from "@/components/ui/Textarea";
export type { SelectProps }     from "@/components/ui/Select";
export type { FormFieldProps }  from "@/components/ui/FormField";
