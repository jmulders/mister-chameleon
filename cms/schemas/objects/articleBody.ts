/**
 * Sanity Schema — articleBody (object)
 *
 * Portable Text body block for article, news, and vacancy description content.
 * Used on both article detail pages (NewsArticle body) and vacancy pages
 * (Vacancy description).  Supports inline images and optional footnotes.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "articleBody",
  title: "Article Body",
  type: "object",
  fields: [
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      description: "The main content. Supports rich text, headings, and inline images.",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt",     title: "Alt Text", type: "string" }),
            defineField({ name: "caption", title: "Caption",  type: "string" }),
          ],
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "footnotes",
      title: "Footnotes",
      type: "array",
      description: "Optional footnote strings displayed below the body.",
      of: [defineArrayMember({ type: "string" })],
    }),
  ],
  preview: {
    select: { body: "body" },
    prepare({ body }) {
      const count = Array.isArray(body) ? body.length : 0;
      return { title: "Article Body", subtitle: `${count} block${count !== 1 ? "s" : ""}` };
    },
  },
});
