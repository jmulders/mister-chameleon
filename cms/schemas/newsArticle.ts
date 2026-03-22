/**
 * Sanity Schema — newsArticle
 *
 * A NewsArticle is a standalone CMS document.  It is NOT a page section block.
 * The article detail page renders it via ArticleMetaData + ArticleBodyData
 * page-section blocks, populated by a mapper from the fetched NewsArticleData.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId        string     Optional. Tenant owner slug, e.g. "workengine".
 *   title           string     Required. Article headline.
 *   slug            slug       Required. URL slug for the detail page.
 *   publishedAt     datetime   Required. ISO 8601 publication timestamp.
 *   coverImage      image      Optional. Hero / cover image with alt text.
 *   body            array      Optional. Portable Text article body.
 *   relatedCompany  reference  Optional. The Company this article is about.
 *   tags            array      Optional. Editorial taxonomy tags.
 *   excerpt         text       Optional. Short teaser for listing cards.
 *   isPublished     boolean    Required. Only published articles appear in queries.
 *
 * ─── GROQ query pattern (tenant-aware) ───────────────────────────────────────
 *
 *   *[_type == "newsArticle" && slug.current == $slug && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id, "slug": slug.current, title, publishedAt, excerpt, tags,
 *     "coverImage": coverImage { "url": asset->url, alt },
 *     body,
 *     "relatedCompany": relatedCompany-> {
 *       _id, name, "slug": slug.current
 *     }
 *   }
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "newsArticle",
  title: "News Article",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this article, e.g. \"workengine\". " +
        "Leave blank for shared / platform-level news.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Headline ───────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Headline",
      type: "string",
      description: "Article title. Keep ≤100 chars for best listing display.",
      validation: (Rule) => Rule.required().max(200),
    }),

    // ── Slug ───────────────────────────────────────────────────────────────────
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "URL slug for the article detail page path. " +
        "Generated from the headline — change with care once published.",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),

    // ── Publication date ───────────────────────────────────────────────────────
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      description: "Publication date and time. Used for ordering and display in listings.",
      validation: (Rule) => Rule.required(),
    }),

    // ── Cover image ────────────────────────────────────────────────────────────
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      description: "Hero image shown at the top of the article and in listing cards.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describes the image for screen readers.",
          validation: (Rule) => Rule.required(),
        }),
      ],
    }),

    // ── Excerpt ────────────────────────────────────────────────────────────────
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description:
        "Short teaser text shown in listing cards. " +
        "If blank the listing component falls back to the first body paragraph. " +
        "Keep to 1–2 sentences (≤280 chars).",
      validation: (Rule) => Rule.max(280),
    }),

    // ── Body (Portable Text) ───────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Article Body",
      type: "array",
      description: "Full article content. Rendered with PortableTextRenderer on the detail page.",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describes the inline image for screen readers.",
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
              description: "Optional caption displayed below the image.",
            }),
          ],
        }),
      ],
    }),

    // ── Related company ────────────────────────────────────────────────────────
    defineField({
      name: "relatedCompany",
      title: "Related Company",
      type: "reference",
      to: [{ type: "company" }],
      description:
        "Optional: the Company this article is primarily about. " +
        "Used to show the article on the company detail page and for filtering in listings.",
    }),

    // ── Tags ───────────────────────────────────────────────────────────────────
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      description:
        "Editorial taxonomy tags (e.g. 'acquisition', 'funding', 'sector-news'). " +
        "Used for filtering in listing and search sections.",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),

    // ── Published flag ─────────────────────────────────────────────────────────
    defineField({
      name: "isPublished",
      title: "Published",
      type: "boolean",
      description:
        "Only published articles are returned by default queries. " +
        "Unpublish to pull an article from listings without deleting it.",
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:      "title",
      subtitle:   "publishedAt",
      published:  "isPublished",
      media:      "coverImage",
    },
    prepare({ title, subtitle, published, media }) {
      const date = subtitle
        ? new Date(subtitle as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "no date";
      return {
        title:    title ?? "(No headline)",
        subtitle: `${date}${published === false ? " · ⚠ unpublished" : ""}`,
        media,
      };
    },
  },
});
