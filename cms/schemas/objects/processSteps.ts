/**
 * Sanity Schema — processSteps (object)
 *
 * Ordered list of named steps describing a process (e.g. a hiring flow,
 * onboarding journey, or how-it-works walkthrough).
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant   string          Layout variant. Default: default.
 *   heading   string?         Section heading, e.g. "Our hiring process".
 *   steps     array[step]     Ordered list of steps.
 *
 * ─── step fields ──────────────────────────────────────────────────────────────
 *
 *   title        string   Required. Step name, e.g. "Screening call".
 *   description  text?    Supporting copy for this step.
 *   duration     string?  Optional time estimate, e.g. "30 min" or "3–4 h".
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   default   — numbered vertical list with dividers (default)
 *   accordion — each step is a collapsible details/summary element (zero-JS)
 *   compact   — tight numbered list with minimal padding
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "processSteps",
  title: "Process Steps",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this process steps block.",
      options: {
        list: [
          { title: "Default — numbered vertical list with dividers (default)", value: "default"   },
          { title: "Accordion — collapsible details/summary (zero-JS)",        value: "accordion" },
          { title: "Compact — tight numbered list with minimal padding",       value: "compact"   },
        ],
      },
      initialValue: "default",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Our hiring process\" or \"How it works\".",
    }),

    // ── Steps ──────────────────────────────────────────────────────────────────
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      description: "Ordered list of process steps. Add in the order they occur.",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "processStep",
          title: "Step",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              description: "Step name, e.g. \"Screening call\" or \"Apply online\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 3,
              description: "Supporting copy for this step. Explain what happens and what to expect.",
            }),
            defineField({
              name: "duration",
              title: "Duration",
              type: "string",
              description: "Optional time estimate, e.g. \"30 min\", \"3–4 h\", or \"1–2 weeks\".",
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "duration" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", steps: "steps" },
    prepare({ heading, steps }) {
      const count = Array.isArray(steps) ? steps.length : 0;
      return {
        title:    heading ?? "Process Steps",
        subtitle: `${count} step${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
