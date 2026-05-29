/**
 * Sanity Schema — quickLinks (object)
 *
 * Navigation hub or resource directory block. Displays a set of labelled
 * links with optional icons and short descriptions.
 * Commonly used for documentation hubs, resource pages, and dashboards.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant      string        Layout variant. Default: quicklinks_grid.
 *   heading      string?       Section heading, e.g. "Explore the docs".
 *   description  text?         Optional intro paragraph above the links.
 *   links        array[link]   Ordered list of quick-link entries.
 *
 * ─── link fields ──────────────────────────────────────────────────────────────
 *
 *   label        string   Required. Display text for the link.
 *   href         string   Required. Link destination (relative or absolute URL).
 *   description  string?  Optional short description below the label.
 *   icon         string?  Optional emoji or icon identifier, e.g. "🚀" or "star".
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   quicklinks_grid    — icon + label + description cards in a 3-col grid (default)
 *   quicklinks_list    — single-column rows with chevron indicators
 *   quicklinks_compact — dense flex tile strip, label only (no descriptions)
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "quickLinks",
  title: "Quick Links",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this quick-links block.",
      options: {
        list: [
          { title: "Grid — icon + label cards in 3-col grid (default)", value: "quicklinks_grid"    },
          { title: "List — single-column rows with chevrons",           value: "quicklinks_list"    },
          { title: "Compact — dense flex tile strip, label only",       value: "quicklinks_compact" },
        ],
      },
      initialValue: "quicklinks_grid",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Explore the docs\" or \"Quick links\".",
    }),

    // ── Description ───────────────────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
      description: "Optional short intro paragraph above the links.",
    }),

    // ── Links ──────────────────────────────────────────────────────────────────
    defineField({
      name: "links",
      title: "Links",
      type: "array",
      description: "Ordered list of quick-link entries.",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "quickLinkItem",
          title: "Link",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: "Display text for the link.",
              validation: (Rule) => Rule.required().max(80),
            }),
            defineField({
              name: "href",
              title: "URL",
              type: "string",
              description: "Link destination (relative or absolute URL).",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "string",
              description: "Optional short description shown below the label (grid and list only).",
            }),
            defineField({
              name: "icon",
              title: "Icon",
              type: "string",
              description: "Optional emoji or icon identifier, e.g. \"🚀\" or \"arrow-right\".",
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", links: "links" },
    prepare({ heading, links }) {
      const count = Array.isArray(links) ? links.length : 0;
      return {
        title:    heading ?? "Quick Links",
        subtitle: `${count} link${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
