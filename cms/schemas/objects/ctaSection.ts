import { defineField, defineType } from "sanity";

export default defineType({
  name: "ctaSection",
  title: "CTA Section",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "buttonLabel",
      title: "Button Label",
      type: "string",
    }),
    defineField({
      name: "buttonHref",
      title: "Button Link",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "buttonLabel" },
    prepare({ title, subtitle }) {
      return { title: title ?? "(No title)", subtitle: subtitle ? `CTA Section · "${subtitle}"` : "CTA Section" };
    },
  },
});
