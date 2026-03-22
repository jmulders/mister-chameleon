import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "textSection",
  title: "Text Section",
  type: "object",
  fields: [
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
