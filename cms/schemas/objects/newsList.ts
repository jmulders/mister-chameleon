/**
 * Sanity Schema — newsList (object)
 *
 * A curated list of news / blog teasers. Authors manually add or select
 * articles rather than auto-loading from a collection query.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   heading   string   Optional section heading above the news cards.
 *   items     array    Curated list of news items.
 *     ↳ title     string   Article headline.
 *     ↳ url       string   Link to the article detail page.
 *     ↳ excerpt   string?  Short teaser text.
 *     ↳ date      string?  Publication date (ISO 8601 or display string).
 *     ↳ image     image?   Cover image (Sanity asset with inline alt).
 *     ↳ category  string?  Category label.
 *   maxItems  number   Optional display limit (default: show all).
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "newsList",
  title: "News List",
  type: "object",

  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this news list section.",
      options: {
        list: [
          { title: "3-column card grid (default)",    value: "default" },
          { title: "Single-column row list",          value: "list" },
          { title: "Featured item + smaller grid",    value: "featured" },
          { title: "Horizontal scroll carousel",      value: "news_slider" },
        ],
      },
      initialValue: "default",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Optional heading above the news item cards.",
    }),

    defineField({
      name: "items",
      title: "News Items",
      type: "array",
      description: "Curated list of articles to display. Add in the order you want them shown.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              description: "Article headline.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "url",
              title: "URL",
              type: "string",
              description: "Link to the article, e.g. /news/article-slug or an external URL.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "excerpt",
              title: "Excerpt",
              type: "text",
              rows: 2,
              description: "Short teaser text shown below the title in the card.",
            }),
            defineField({
              name: "date",
              title: "Date",
              type: "string",
              description: "Publication date. ISO 8601 preferred (e.g. \"2025-03-15\").",
            }),
            defineField({
              name: "image",
              title: "Cover Image",
              type: "image",
              description: "Upload or select a cover image for the card from the Sanity asset library.",
              options: { hotspot: true },
              fields: [
                defineField({
                  name: "alt",
                  title: "Alt Text",
                  type: "string",
                  description: "Describe the image for screen readers.",
                }),
              ],
            }),
            defineField({
              name: "category",
              title: "Category",
              type: "string",
              description: "Optional category label shown as a badge on the card.",
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "date" },
          },
        }),
      ],
    }),

    defineField({
      name: "maxItems",
      title: "Max Items",
      type: "number",
      description: "Maximum number of items to display. Leave blank to show all.",
      validation: (Rule) => Rule.min(1).max(20),
    }),
  ],

  preview: {
    select: { heading: "heading", items: "items" },
    prepare({ heading, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return {
        title: heading ?? "News List",
        subtitle: `${count} item${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
