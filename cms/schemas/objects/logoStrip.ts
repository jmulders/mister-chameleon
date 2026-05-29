/**
 * Sanity Schema — logoStrip (object)
 *
 * A horizontal strip of partner/client logos with an optional heading.
 * Commonly used as a "Trusted by" or "As seen in" section.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   heading           string    Optional label above the logo row, e.g. "Trusted by".
 *   variant           string    Layout variant: default | muted | logo_grid
 *
 *   Display options:
 *   animationEnabled  boolean   Enable the slow marquee carousel (default: true).
 *   speed             string    Animation speed: slow | medium | fast (default: slow).
 *   grayscale         boolean   Render logos in greyscale (default: false; true for muted variant).
 *   showLabels        boolean   Show company name beneath each logo image (default: false).
 *
 *   logos             array     Ordered list of logo entries:
 *     ↳ name  string            Company/brand name (used as alt text; fallback when no image).
 *     ↳ image image             Sanity image asset (replaces the old `src` URL field).
 *     ↳ url   string?           Optional link target for the logo.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   The old `src` (string URL) field is no longer in the schema. The GROQ query
 *   uses `coalesce(image.asset->url, src)` so existing documents continue to
 *   render until they are re-saved with a Sanity asset.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "logoStrip",
  title: "Logo Strip",
  type: "object",

  fields: [
    // ── Layout ───────────────────────────────────────────────────────────────

    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual treatment of this logo strip.",
      options: {
        list: [
          { title: "Marquee carousel — full contrast (default)", value: "default" },
          { title: "Marquee carousel — muted opacity / greyscale (\"Trusted by\")", value: "muted" },
          { title: "Static grid — show all logos at once",        value: "logo_grid" },
        ],
      },
      initialValue: "default",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: 'Optional label above the logo row, e.g. "Trusted by" or "As seen in".',
    }),

    // ── Display options ───────────────────────────────────────────────────────

    defineField({
      name:        "animationEnabled",
      title:       "Enable carousel animation",
      type:        "boolean",
      description: "When on, logos scroll in a slow seamless marquee. When off, logos are displayed statically. Has no effect on the logo_grid variant.",
      initialValue: true,
    }),

    defineField({
      name:        "speed",
      title:       "Animation speed",
      type:        "string",
      description: "Controls how quickly the logos scroll across the strip.",
      options: {
        list: [
          { title: "Slow  — calm, 60 s per cycle (recommended)", value: "slow"   },
          { title: "Medium — moderate, 30 s per cycle",           value: "medium" },
          { title: "Fast  — energetic, 15 s per cycle",           value: "fast"   },
        ],
      },
      initialValue: "slow",
      hidden: ({ parent }) => parent?.animationEnabled === false,
    }),

    defineField({
      name:        "grayscale",
      title:       "Greyscale logos",
      type:        "boolean",
      description: "Render all logos in greyscale. Leave unset to use the variant default (muted variant is greyscale by default).",
    }),

    defineField({
      name:        "showLabels",
      title:       "Show company names",
      type:        "boolean",
      description: "Display the company name as a small caption beneath each logo image.",
      initialValue: false,
    }),

    // ── Logo items ────────────────────────────────────────────────────────────

    defineField({
      name: "logos",
      title: "Logos",
      type: "array",
      description: "Ordered list of company/partner logos to display.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "name",
              title: "Company name",
              type: "string",
              description: "Company or brand name — used as image alt text and as text fallback when no logo image is set.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "image",
              title: "Logo Image",
              type: "image",
              description:
                "Upload or select the logo from the Sanity asset library. " +
                "SVG, PNG, and WebP all work well. " +
                "The company name is used as alt text automatically.",
              options: { hotspot: false },
            }),
            defineField({
              name: "url",
              title: "Link URL",
              type: "string",
              description: "Optional: clicking the logo navigates to this URL (opens in a new tab).",
            }),
          ],
          preview: {
            select: { title: "name", media: "image" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", logos: "logos", variant: "variant" },
    prepare({ heading, logos, variant }) {
      const count   = Array.isArray(logos) ? logos.length : 0;
      const vLabel  = variant === "muted" ? " · muted" : variant === "logo_grid" ? " · grid" : "";
      return {
        title:    heading ?? "Logo Strip",
        subtitle: `${count} logo${count !== 1 ? "s" : ""}${vLabel}`,
      };
    },
  },
});
