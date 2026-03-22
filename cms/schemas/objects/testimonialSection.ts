import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "testimonialSection",
  title: "Testimonial Section",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
    }),
    defineField({
      name: "testimonials",
      title: "Testimonials",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "testimonialItem",
          title: "Testimonial",
          fields: [
            defineField({ name: "quote",   title: "Quote",   type: "text", rows: 3 }),
            defineField({ name: "author",  title: "Author",  type: "string" }),
            defineField({ name: "company", title: "Company", type: "string" }),
          ],
          preview: {
            select: { title: "author", subtitle: "quote" },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "heading", testimonials: "testimonials" },
    prepare({ title, testimonials }) {
      const count = Array.isArray(testimonials) ? testimonials.length : 0;
      return { title: title ?? "(No heading)", subtitle: `Testimonials · ${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
