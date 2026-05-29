/**
 * Sanity Schema — ctaSection (object)
 *
 * An in-page CTA section embedded in a page's sections array.
 * Supports a title, supporting description, and a structured CTA button.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant      string   Layout variant (see options.list below). Default: cta_banner.
 *   title        string   Primary headline above the CTA button.
 *   description  text?    Optional supporting paragraph.
 *   cta          object   Structured CTA button: label + href.
 *
 * ─── Deprecated fields (kept hidden for backward compatibility) ───────────────
 *
 *   buttonLabel  string   Replaced by cta.label. Hidden in Studio.
 *   buttonHref   string   Replaced by cta.href.  Hidden in Studio.
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name: "ctaSection",
  title: "CTA Section",
  type: "object",
  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this CTA section.",
      options: {
        list: [
          // Full-section family
          { title: "Banner — full-width brand-coloured centred (default)", value: "cta_banner" },
          { title: "Split — heading/body left, buttons right",             value: "cta_split" },
          { title: "Card — elevated card on neutral section",              value: "cta_card" },
          { title: "Media first — full-bleed background image",           value: "cta_media_first" },
          // Compact banner family
          { title: "Compact banner — neutral background, inline bar",     value: "cta_banner_default" },
          { title: "Compact banner — brand background, alert-style",      value: "cta_banner_compact" },
        ],
      },
      initialValue: "cta_banner",
    }),

    // ── Headline ───────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Primary headline displayed in the CTA section.",
    }),

    // ── Supporting copy ────────────────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Optional supporting paragraph beneath the headline.",
    }),

    // ── CTA button (structured) ────────────────────────────────────────────────
    defineField({
      name: "cta",
      title: "Call-to-action Button",
      type: "object",
      description: "The primary action button for this section.",
      fields: [
        defineField({
          name: "label",
          title: "Button Label",
          type: "string",
          description: "Button text. Keep short and action-oriented.",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "href",
          title: "Button Link",
          type: "string",
          description: 'Destination URL. Use a relative path (e.g. /contact) or absolute URL.',
          validation: (Rule) => Rule.required(),
        }),
      ],
    }),

    // ── Deprecated flat CTA fields ─────────────────────────────────────────────
    //
    // Kept in the schema so existing documents continue to validate in Studio.
    // Hidden from the editor — use the structured `cta` object above instead.
    // The page-config mapper reads `cta.label`/`cta.href` with a fallback to
    // these flat fields for documents that have not yet been re-saved in Studio.
    defineField({
      name: "buttonLabel",
      title: "Button Label (deprecated)",
      type: "string",
      hidden: true,
    }),

    defineField({
      name: "buttonHref",
      title: "Button Link (deprecated)",
      type: "string",
      hidden: true,
    }),
  ],

  preview: {
    select: {
      title:    "title",
      ctaLabel: "cta.label",
      variant:  "variant",
    },
    prepare({ title, ctaLabel, variant }) {
      const variantLabel = variant && variant !== "cta_banner" ? ` · ${variant}` : "";
      return {
        title:    title ?? "(No title)",
        subtitle: ctaLabel ? `CTA Section · "${ctaLabel}"${variantLabel}` : `CTA Section${variantLabel}`,
      };
    },
  },
});
