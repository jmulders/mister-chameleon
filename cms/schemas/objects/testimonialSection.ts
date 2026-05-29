import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "testimonialSection",
  title: "Testimonial Section",
  type: "object",
  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this testimonial section.",
      options: {
        list: [
          { title: "3-column grid of quote cards (default)", value: "testimonial_grid" },
          { title: "Single full-width centred quote",        value: "testimonial_single" },
          { title: "Featured large + smaller cards below",   value: "testimonial_highlight" },
          { title: "Auto-advancing carousel",                value: "testimonial_slider" },
          { title: "Featured quote with author photo",       value: "testimonial_featured_image" },
        ],
      },
      initialValue: "testimonial_grid",
    }),

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
            defineField({ name: "quote",     title: "Quote",           type: "text",   rows: 3 }),
            defineField({ name: "author",    title: "Author",          type: "string" }),
            defineField({ name: "role",      title: "Role / Title",    type: "string",
              description: "Optional — e.g. \"Head of Digital\"." }),
            defineField({ name: "company",   title: "Company",         type: "string" }),
            defineField({
              name: "avatar",
              title: "Avatar Photo",
              type: "image",
              description:
                "Optional profile photo. Upload or select from the Sanity asset library. " +
                "Used by the slider and featured-image variants.",
              options: { hotspot: true },
              fields: [
                defineField({
                  name: "alt",
                  title: "Alt Text",
                  type: "string",
                  description: "Describe the photo for screen readers.",
                }),
              ],
            }),
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
