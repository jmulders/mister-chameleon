/**
 * Sanity Schema — relatedContent (object)
 *
 * A curated or algorithmic set of related item teasers shown at the end of
 * an article or detail page.  Items are authored as data (title + href +
 * optional excerpt / image) — no layout logic here.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "relatedContent",
  title: "Related Content",
  type: "object",
  fields: [
    defineField({ name: "heading",  title: "Heading",   type: "string" }),
    defineField({ name: "maxItems", title: "Max Items", type: "number",
      description: "Limit to this many items. Leave blank to show all." }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "relatedItem",
          title: "Related Item",
          fields: [
            defineField({ name: "title",   title: "Title",    type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "href",    title: "URL",      type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "excerpt", title: "Excerpt",  type: "text", rows: 2 }),
            defineField({ name: "category",title: "Category", type: "string" }),
            defineField({ name: "date",    title: "Date",     type: "date" }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              fields: [defineField({ name: "alt", title: "Alt Text", type: "string" })],
            }),
          ],
          preview: { select: { title: "title", subtitle: "href" } },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "heading", items: "items" },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return { title: title ?? "Related Content", subtitle: `${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
