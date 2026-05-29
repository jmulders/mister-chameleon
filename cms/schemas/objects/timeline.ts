/**
 * Sanity Schema — timeline (object)
 *
 * Ordered list of milestones, events, or history entries.
 * Commonly used for company history, product roadmaps, or hiring process timelines.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant      string          Layout variant. Default: timeline_vertical.
 *   heading      string?         Section heading, e.g. "Our story".
 *   description  text?           Optional intro paragraph above the timeline.
 *   items        array[item]     Ordered list of timeline entries.
 *
 * ─── item fields ──────────────────────────────────────────────────────────────
 *
 *   date         string   Required. Year or date label, e.g. "2023 Q3".
 *   title        string   Required. Milestone title, e.g. "Series A — €4.2M".
 *   description  text?    Optional supporting copy for this milestone.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   timeline_vertical   — stacked vertical timeline with dot markers and alternating
 *                         content (default)
 *   timeline_compact    — tight single-column list with inline dates
 *   timeline_milestones — bold date cards in a grid (suitable for company history)
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "timeline",
  title: "Timeline",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this timeline.",
      options: {
        list: [
          { title: "Vertical — dot markers, alternating content (default)", value: "timeline_vertical"   },
          { title: "Compact — tight list with inline dates",                value: "timeline_compact"    },
          { title: "Milestones — bold date cards in a grid",                value: "timeline_milestones" },
        ],
      },
      initialValue: "timeline_vertical",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Our story\" or \"Key milestones\".",
    }),

    // ── Description ───────────────────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Optional intro paragraph above the timeline entries.",
    }),

    // ── Timeline items ─────────────────────────────────────────────────────────
    defineField({
      name: "items",
      title: "Timeline Items",
      type: "array",
      description: "Ordered list of milestones or events. Add in chronological order.",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "timelineItem",
          title: "Timeline Entry",
          fields: [
            defineField({
              name: "date",
              title: "Date / Year",
              type: "string",
              description: "Year or date label, e.g. \"2023\", \"2024 Q1\", \"March 2025\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              description: "Milestone title, e.g. \"Series A — €4.2M\" or \"50 tenants milestone\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 3,
              description: "Optional supporting copy for this milestone.",
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "date" },
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
        title:    heading ?? "Timeline",
        subtitle: `${count} entr${count !== 1 ? "ies" : "y"}`,
      };
    },
  },
});
