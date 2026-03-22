/**
 * Sanity Schema — listing (object)
 *
 * Displays a collection of items as cards in a configurable layout.
 * Items are authored directly in the CMS or populated by the listing
 * assembler from entity documents.  No layout logic lives here — the
 * block component and its `variant` field control presentation.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "listing",
  title: "Listing",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Optional section heading displayed above the listing grid.",
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      description: "Ordered list of listing cards. Each item is a title + link + optional excerpt.",
      of: [
        defineArrayMember({
          type: "object",
          name: "listingItem",
          title: "Item",
          fields: [
            defineField({ name: "title",    title: "Title",    type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "href",     title: "URL",      type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "excerpt",  title: "Excerpt",  type: "text", rows: 2 }),
            defineField({ name: "date",     title: "Date",     type: "date" }),
            defineField({ name: "category", title: "Category", type: "string" }),
            defineField({ name: "tags",     title: "Tags",     type: "array", of: [{ type: "string" }], options: { layout: "tags" } }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              fields: [
                defineField({ name: "alt", title: "Alt Text", type: "string" }),
              ],
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "href" },
          },
        }),
      ],
    }),
    defineField({
      name: "maxItems",
      title: "Max Items",
      type: "number",
      description: "Limit the number of items shown. Leave blank to show all.",
    }),
    defineField({ name: "viewAllHref",  title: "View All URL",   type: "string" }),
    defineField({ name: "viewAllLabel", title: "View All Label", type: "string" }),
  ],
  preview: {
    select: { title: "heading", items: "items" },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return { title: title ?? "(No heading)", subtitle: `Listing · ${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
