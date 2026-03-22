import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "faqSection",
  title: "FAQ Section",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
    }),
    defineField({
      name: "items",
      title: "FAQ Items",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "faqItem",
          title: "FAQ Item",
          fields: [
            defineField({ name: "question", title: "Question", type: "string" }),
            defineField({ name: "answer",   title: "Answer",   type: "text", rows: 4 }),
          ],
          preview: {
            select: { title: "question", subtitle: "answer" },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "heading", items: "items" },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return { title: title ?? "(No heading)", subtitle: `FAQ Section · ${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
