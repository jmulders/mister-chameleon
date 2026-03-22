/**
 * Sanity Schema — filterBar (object)
 *
 * Configures a filter control shown above a listing or search results block.
 * The CMS authors the available categories, tags, and sort options as data.
 * All filtering behaviour is client-side / platform-driven — no logic here.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

const filterOptionMember = defineArrayMember({
  type: "object",
  name: "filterOption",
  title: "Option",
  fields: [
    defineField({ name: "label", title: "Label", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "value", title: "Value", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "count", title: "Count",  type: "number" }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
});

export default defineType({
  name: "filterBar",
  title: "Filter Bar",
  type: "object",
  fields: [
    defineField({
      name: "placeholder",
      title: "Search Placeholder",
      type: "string",
      description: "Placeholder text for the search input inside the filter bar.",
    }),
    defineField({ name: "showSearch",         title: "Show Search Input",     type: "boolean", initialValue: true }),
    defineField({ name: "showCategoryFilter", title: "Show Category Filter",  type: "boolean", initialValue: true }),
    defineField({ name: "showTagFilter",      title: "Show Tag Filter",       type: "boolean", initialValue: false }),
    defineField({ name: "categories",  title: "Categories",   type: "array", of: [filterOptionMember] }),
    defineField({ name: "tags",        title: "Tags",         type: "array", of: [filterOptionMember] }),
    defineField({ name: "sortOptions", title: "Sort Options", type: "array", of: [filterOptionMember] }),
  ],
  preview: {
    select: { categories: "categories" },
    prepare({ categories }) {
      const count = Array.isArray(categories) ? categories.length : 0;
      return { title: "Filter Bar", subtitle: `${count} categor${count !== 1 ? "ies" : "y"}` };
    },
  },
});
