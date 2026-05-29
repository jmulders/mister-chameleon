/**
 * Sanity Schema — stats (object)
 *
 * A metrics / key-numbers section. Displays a grid of stat cards,
 * each showing a numeric value with optional prefix, suffix, and description.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   heading   string   Optional section heading above the stat cards.
 *   items     array    Ordered list of stat entries.
 *     ↳ label        string   Short descriptive label, e.g. "Active clients".
 *     ↳ value        string   The metric value, e.g. "500+" or "€12 M".
 *     ↳ prefix       string?  Optional prefix before the value, e.g. "€" or "~".
 *     ↳ suffix       string?  Optional suffix after the value, e.g. "%" or "+".
 *     ↳ description  string?  Optional short copy below the label.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "stats",
  title: "Stats",
  type: "object",

  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this stats section.",
      options: {
        list: [
          { title: "Metric cards row (default)", value: "default" },
          { title: "Compact inline row",         value: "compact" },
        ],
      },
      initialValue: "default",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Optional section heading displayed above the stat cards.",
    }),

    defineField({
      name: "items",
      title: "Stats",
      type: "array",
      description: "Key metrics to display. Typically 3–5 stats for best visual balance.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: "Short descriptive label, e.g. \"Active clients\" or \"Founded\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              description: "The metric value. Can include formatting: \"500+\", \"€12 M\", \"3.2×\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "prefix",
              title: "Prefix",
              type: "string",
              description: "Optional character(s) before the value, e.g. \"€\" or \"~\".",
            }),
            defineField({
              name: "suffix",
              title: "Suffix",
              type: "string",
              description: "Optional character(s) after the value, e.g. \"%\" or \"+\".",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "string",
              description: "Optional short supporting copy below the label.",
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", items: "items" },
    prepare({ heading, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return {
        title: heading ?? "Stats",
        subtitle: `${count} stat${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
