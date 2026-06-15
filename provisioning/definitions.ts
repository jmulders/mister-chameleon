/**
 * Provisioning — canonical block / context-slot definitions.
 *
 * THIS is the single source of truth for the blocks and slots the platform
 * manages. The `/api/v1/provision/manifest` endpoint turns these definitions
 * (plus the tenant's design tokens) into CMS-specific build artifacts —
 * Statamic fieldsets + Antlers templates, WordPress blocks, Sanity/Storyblok
 * schemas — and the per-CMS adapter writes them into the customer's site.
 *
 * Editing a slot here, then having tenants run their sync, is how a change
 * rolls out everywhere without hand-editing each CMS. No definition lives in
 * the addon repo — the addon only ships starters as an offline fallback.
 */

/**
 * Canonical slot ids. Kept as a local union (not imported) so the provisioning
 * source of truth doesn't couple to any one CMS-mapper's narrower type. These
 * match the decision engine's slots resolved in /api/snippet/decide.
 */
export type ContextSlotId =
  | "hero"
  | "proof"
  | "cta"
  | "feature"
  | "conversion"
  | "notification";

export type SlotFieldType = "text" | "textarea" | "url" | "media" | "select";

export interface SlotFieldDef {
  /** Stable handle used in templates and resolved content. */
  handle: string;
  label: string;
  type: SlotFieldType;
  /** For type: "select". */
  options?: Record<string, string>;
  /** Half-width in editors that support it. */
  half?: boolean;
  instructions?: string;
}

export interface SlotDef {
  /** Matches ContextSlotId in cms/types so the decision engine lines up. */
  id: ContextSlotId;
  label: string;
  description: string;
  /** Default variant key authored as the CMS fallback. */
  defaultVariantKey: string;
  fields: SlotFieldDef[];
}

/** The canonical context slots, aligned with the decision engine's slot ids. */
export const SLOT_DEFINITIONS: readonly SlotDef[] = [
  {
    id: "hero",
    label: "Hero",
    description: "Above-the-fold headline, subtext and primary call to action.",
    defaultVariantKey: "hero_default",
    fields: [
      { handle: "tag", label: "Eyebrow / tag", type: "text" },
      { handle: "heading", label: "Heading", type: "text" },
      { handle: "body", label: "Subtext", type: "textarea" },
      { handle: "cta_label", label: "CTA label", type: "text", half: true },
      { handle: "cta_url", label: "CTA URL", type: "url", half: true },
      { handle: "media", label: "Media", type: "media" },
    ],
  },
  {
    id: "proof",
    label: "Social proof",
    description: "Trust signals: stats, logos or testimonials.",
    defaultVariantKey: "proof_default",
    fields: [
      { handle: "heading", label: "Heading", type: "text" },
      { handle: "body", label: "Body", type: "textarea" },
    ],
  },
  {
    id: "cta",
    label: "Call to action",
    description: "Mid- or end-of-page conversion prompt.",
    defaultVariantKey: "cta_default",
    fields: [
      { handle: "heading", label: "Heading", type: "text" },
      { handle: "body", label: "Body", type: "textarea" },
      { handle: "cta_label", label: "CTA label", type: "text", half: true },
      { handle: "cta_url", label: "CTA URL", type: "url", half: true },
    ],
  },
  {
    id: "feature",
    label: "Feature",
    description: "Feature highlight or grid.",
    defaultVariantKey: "feature_default",
    fields: [
      { handle: "heading", label: "Heading", type: "text" },
      { handle: "body", label: "Body", type: "textarea" },
    ],
  },
  {
    id: "conversion",
    label: "Conversion",
    description: "High-intent conversion block (demo, signup, contact).",
    defaultVariantKey: "conversion_default",
    fields: [
      { handle: "heading", label: "Heading", type: "text" },
      { handle: "body", label: "Body", type: "textarea" },
      { handle: "cta_label", label: "CTA label", type: "text", half: true },
      { handle: "cta_url", label: "CTA URL", type: "url", half: true },
    ],
  },
  {
    id: "notification",
    label: "Notification",
    description: "Banner / bar for urgency or returning-visitor messaging.",
    defaultVariantKey: "notification_default",
    fields: [
      { handle: "message", label: "Message", type: "text" },
      {
        handle: "severity",
        label: "Severity",
        type: "select",
        options: { info: "Info", success: "Success", warning: "Warning" },
        half: true,
      },
      { handle: "cta_label", label: "CTA label", type: "text", half: true },
      { handle: "cta_url", label: "CTA URL", type: "url", half: true },
    ],
  },
] as const;

/** Version stamp — bump when definitions change so syncs are traceable. */
export const DEFINITIONS_VERSION = "1.0.0";
