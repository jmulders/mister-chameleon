/**
 * Sanity Schema — logoStrip (object)
 *
 * A horizontal strip of partner/client logos with an optional heading.
 * Commonly used as a "Trusted by" or "As seen in" section.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   heading  string    Optional label above the logo row, e.g. "Trusted by".
 *   logos    array     Ordered list of logo entries.
 *     ↳ name  string   Company/brand name (used as alt text if no alt provided).
 *     ↳ src   string   Logo image URL (CDN URL or relative path).
 *     ↳ url   string?  Optional link target for the logo.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "logoStrip",
  title: "Logo Strip",
  type: "object",

  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: 'Optional label above the logo row, e.g. "Trusted by" or "As seen in".',
    }),

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
              title: "Name",
              type: "string",
              description: "Company or brand name — used as image alt text.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "src",
              title: "Logo URL",
              type: "string",
              description: "Image URL (CDN path, absolute, or root-relative). E.g. /logos/acme.svg",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "url",
              title: "Link URL",
              type: "string",
              description: "Optional: make the logo a link to this URL.",
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "src" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", logos: "logos" },
    prepare({ heading, logos }) {
      const count = Array.isArray(logos) ? logos.length : 0;
      return {
        title: heading ?? "Logo Strip",
        subtitle: `${count} logo${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
