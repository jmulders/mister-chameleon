import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "textSection",
  title: "Text Section",
  type: "object",
  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this text section.",
      options: {
        list: [
          { title: "Single column — left-aligned (default)", value: "text_single" },
          { title: "Split — heading left, body right",       value: "text_split" },
          { title: "Lead — centred extra-large paragraph",   value: "text_lead" },
        ],
      },
      initialValue: "text_single",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [defineArrayMember({ type: "block" })],
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title ?? "(No heading)", subtitle: "Text Section" };
    },
  },
});
