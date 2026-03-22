/**
 * Sanity Schema — articleMeta (object)
 *
 * Header block for article / news detail pages.
 * Contains structured metadata: title, date, author, cover image, tags.
 * No layout decisions — the block component and its variant control presentation.
 *
 * On entity-assembled pages (NewsArticle → PageData) this block is
 * populated automatically by the entity-page assembler.  CMS authors may
 * also place it manually on hand-crafted article pages.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "articleMeta",
  title: "Article Meta",
  type: "object",
  fields: [
    defineField({ name: "title",       title: "Title",       type: "string" }),
    defineField({ name: "publishedAt", title: "Published At", type: "datetime" }),
    defineField({ name: "updatedAt",   title: "Updated At",   type: "datetime" }),
    defineField({ name: "category",    title: "Category",     type: "string" }),
    defineField({ name: "readingTime", title: "Reading Time (min)", type: "number" }),
    defineField({ name: "summary",     title: "Summary",      type: "text", rows: 3 }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "object",
      fields: [
        defineField({ name: "name",      title: "Name",         type: "string" }),
        defineField({ name: "role",      title: "Role",         type: "string" }),
        defineField({ name: "href",      title: "Profile URL",  type: "string" }),
        defineField({
          name: "avatar",
          title: "Avatar",
          type: "image",
          options: { hotspot: true },
          fields: [defineField({ name: "alt", title: "Alt Text", type: "string" })],
        }),
      ],
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alt Text", type: "string" })],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "publishedAt" },
    prepare({ title, subtitle }) {
      const date = subtitle
        ? new Date(subtitle as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";
      return { title: title ?? "Article Meta", subtitle: date };
    },
  },
});
