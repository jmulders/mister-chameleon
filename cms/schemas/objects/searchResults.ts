/**
 * Sanity Schema — searchResults (object)
 *
 * A dynamic result list driven by platform-side search / filtering.
 * The CMS authors configuration and copy only — items are resolved at runtime.
 */
import { defineField, defineType } from "sanity";

export default defineType({
  name: "searchResults",
  title: "Search Results",
  type: "object",
  fields: [
    defineField({ name: "heading",      title: "Heading",       type: "string" }),
    defineField({ name: "emptyMessage", title: "Empty Message", type: "string",
      description: "Message shown when the result set is empty." }),
    defineField({ name: "itemsPerPage", title: "Items Per Page", type: "number",
      description: "Number of results per page. Defaults to 12 when blank." }),
    defineField({ name: "enableSearch", title: "Enable Search Input",  type: "boolean", initialValue: true }),
    defineField({ name: "enableFilter", title: "Enable Filter Bar",    type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title ?? "Search Results", subtitle: "Dynamic result set" };
    },
  },
});
