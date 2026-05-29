import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "faqSection",
  title: "FAQ Section",
  type: "object",
  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this FAQ section.",
      options: {
        list: [
          { title: "Single-column accordion (default)", value: "faq_default" },
          { title: "Two-column accordion grid",         value: "faq_split" },
        ],
      },
      initialValue: "faq_default",
    }),

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
            defineField({
              name:  "answer",
              title: "Answer",
              // Plain text — not Portable Text. Keeps the Studio editor simple
              // and avoids "Expected type String, got Array" validation errors
              // when answer content is provisioned as a plain string.
              type:  "text",
              rows:  4,
            }),
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
