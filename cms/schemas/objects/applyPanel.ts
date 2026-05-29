/**
 * Sanity Schema — applyPanel (object)
 *
 * The application call-to-action panel on a vacancy detail page.
 * Contains a heading, body copy, primary / secondary CTAs, optional form
 * reference, and closing date.  No layout logic here.
 */
import { defineField, defineType } from "sanity";

export default defineType({
  name: "applyPanel",
  title: "Apply Panel",
  type: "object",
  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls how the application CTA panel is displayed.",
      options: {
        list: [
          { title: "Default — full-width application CTA section (default)", value: "default" },
          { title: "Inline — card embedded mid-page",                        value: "inline"  },
          { title: "Sticky — sticky sidebar card (desktop)",                 value: "sticky"  },
        ],
      },
      initialValue: "default",
    }),

    defineField({ name: "heading",     title: "Heading",      type: "string" }),
    defineField({ name: "body",        title: "Body",         type: "text", rows: 3 }),
    defineField({ name: "closingDate", title: "Closing Date", type: "date",
      description: "Application deadline. Displayed prominently on the panel." }),
    defineField({
      name: "primaryCta",
      title: "Primary CTA",
      type: "object",
      fields: [
        defineField({ name: "label", title: "Label", type: "string" }),
        defineField({ name: "href",  title: "URL",   type: "string" }),
      ],
    }),
    defineField({
      name: "secondaryCta",
      title: "Secondary CTA",
      type: "object",
      fields: [
        defineField({ name: "label", title: "Label", type: "string" }),
        defineField({ name: "href",  title: "URL",   type: "string" }),
      ],
    }),
    defineField({ name: "formKey", title: "Form Key", type: "string",
      description: 'Optional: embed a platform form inside the panel (e.g. "application").' }),
  ],
  preview: {
    select: { title: "heading", subtitle: "closingDate" },
    prepare({ title, subtitle }) {
      return { title: title ?? "Apply Panel", subtitle: subtitle ? `Closes ${subtitle}` : "" };
    },
  },
});
