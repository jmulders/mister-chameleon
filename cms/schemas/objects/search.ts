/**
 * Sanity Schema — search (object)
 *
 * Full-text search input with inline result rendering.
 * The CMS authors configuration and copy — all search behaviour (provider
 * selection, result fetching) is platform-driven via /api/search.
 * No layout logic here.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "search",
  title: "Search",
  type: "object",
  fields: [
    defineField({ name: "title",       title: "Title",       type: "string" }),
    defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
    defineField({ name: "placeholder", title: "Placeholder", type: "string",
      description: "Placeholder text for the search input." }),
    defineField({
      name: "scopes",
      title: "Search Scopes",
      type: "array",
      description: 'Which content types to search. E.g. "pages", "vacancies", "news".',
      of: [defineArrayMember({ type: "string" })],
      options: {
        list: [
          { title: "Pages",     value: "pages"     },
          { title: "News",      value: "news"      },
          { title: "Vacancies", value: "vacancies" },
        ],
        layout: "tags",
      },
    }),
    defineField({ name: "showFilters",    title: "Show Filters",     type: "boolean", initialValue: false }),
    defineField({ name: "enableInstant",  title: "Instant Search",   type: "boolean", initialValue: true }),
    defineField({ name: "maxResults",     title: "Max Results",      type: "number" }),
    defineField({ name: "emptyMessage",   title: "Empty Message",    type: "string" }),
    defineField({ name: "noResultsMessage", title: "No Results Message", type: "string" }),
  ],
  preview: {
    select: { title: "title" },
    prepare({ title }) {
      return { title: title ?? "Search", subtitle: "Full-text search block" };
    },
  },
});
