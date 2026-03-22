import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "featureGrid",
  title: "Feature Grid",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
    }),
    defineField({
      name: "features",
      title: "Features",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "featureItem",
          title: "Feature",
          fields: [
            defineField({ name: "title",       title: "Title",       type: "string" }),
            defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
            defineField({ name: "icon",        title: "Icon",        type: "string" }),
          ],
          preview: {
            select: { title: "title", subtitle: "description" },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "heading", features: "features" },
    prepare({ title, features }) {
      const count = Array.isArray(features) ? features.length : 0;
      return { title: title ?? "(No heading)", subtitle: `Feature Grid · ${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
