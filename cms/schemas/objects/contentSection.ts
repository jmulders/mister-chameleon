/**
 * Sanity Schema — contentSection (object)
 *
 * Flexible editorial section with an eyebrow label, heading, optional intro
 * paragraph, Portable Text body, and 0–2 CTA buttons.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant   string   Layout variant (see options.list). Default: content_default.
 *   eyebrow   string?  Small label above the heading (e.g. "Our process"). Max 80 chars.
 *   heading   string?  Section headline.
 *   intro     text?    Short intro paragraph above the body copy.
 *   body      array?   Portable Text rich-text body.
 *   ctas      array?   0–2 CTA buttons { label, href, variant? }.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   content_default — single left-aligned or centred column (default)
 *   content_split   — eyebrow / heading left, body / CTAs right (two-column)
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "contentSection",
  title: "Content Section",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the structural layout of this content section.",
      options: {
        list: [
          { title: "Default — single left-aligned column (default)", value: "content_default" },
          { title: "Split — heading left, body right (two-column)",  value: "content_split"   },
        ],
      },
      initialValue: "content_default",
    }),

    // ── Eyebrow ────────────────────────────────────────────────────────────────
    defineField({
      name: "eyebrow",
      title: "Eyebrow Label",
      type: "string",
      description: "Small label displayed above the heading. Max 80 chars.",
      validation: (Rule) => Rule.max(80),
    }),

    // ── Heading ────────────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section headline.",
    }),

    // ── Intro ──────────────────────────────────────────────────────────────────
    defineField({
      name: "intro",
      title: "Intro",
      type: "text",
      rows: 3,
      description: "Optional intro paragraph displayed before the body copy.",
    }),

    // ── Body ───────────────────────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      description: "Rich text body content.",
      of: [defineArrayMember({ type: "block" })],
    }),

    // ── CTAs ───────────────────────────────────────────────────────────────────
    defineField({
      name: "ctas",
      title: "Call-to-action Buttons",
      type: "array",
      description: "0–2 CTA buttons displayed below the body. First is primary, second is secondary.",
      of: [
        {
          type: "object",
          name: "contentCta",
          title: "CTA",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (Rule) => Rule.required().max(60),
            }),
            defineField({
              name: "href",
              title: "Destination",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "variant",
              title: "Style",
              type: "string",
              options: {
                list: [
                  { title: "Primary",   value: "primary"   },
                  { title: "Secondary", value: "secondary" },
                  { title: "Outline",   value: "outline"   },
                  { title: "Ghost",     value: "ghost"     },
                ],
                layout: "radio",
              },
            }),
          ],
          preview: {
            select: { label: "label", href: "href" },
            prepare({ label, href }: Record<string, string | undefined>) {
              return { title: label ?? "(no label)", subtitle: href ?? "(no href)" };
            },
          },
        },
      ],
      validation: (Rule) => Rule.max(2),
    }),
  ],

  preview: {
    select: { heading: "heading", eyebrow: "eyebrow" },
    prepare({ heading, eyebrow }) {
      return {
        title:    heading ?? "(No heading)",
        subtitle: eyebrow ? `Content Section · ${eyebrow}` : "Content Section",
      };
    },
  },
});
