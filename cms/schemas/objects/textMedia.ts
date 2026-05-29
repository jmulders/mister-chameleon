/**
 * Sanity Schema — textMedia (object)
 *
 * Editorial text + image/video split block. Suitable for product feature
 * sections, capability highlights, and "how it works" pages.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant    string   Layout variant. Default: text_media_right.
 *   eyebrow    string?  Small label above the heading. Max 80 chars.
 *   heading    string?  Section headline.
 *   body       text?    Supporting copy below the heading.
 *   mediaType  string   "image" | "video" (default: "image").
 *   image      image?   Sanity image asset with inline alt text. Shown when mediaType = "image".
 *   videoUrl   url?     Video URL. Shown when mediaType = "video".
 *   caption    string?  Optional caption below the media element.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   The old `mediaUrl` (string) and `mediaAlt` (string) fields are no longer in
 *   the schema. The GROQ query uses coalesce(image.asset->url, mediaUrl) for the
 *   image URL and coalesce(image.alt, mediaAlt) for alt text, so legacy documents
 *   continue to render until re-saved.
 *   ctas       array?   0–2 CTA buttons { label, href }.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   text_media_right   — text left, media right (default)
 *   text_media_left    — media left, text right
 *   text_media_stacked — media above, text below (full-width column)
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "textMedia",
  title: "Text + Media",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls how text and media are arranged.",
      options: {
        list: [
          { title: "Media right — text left, media right (default)", value: "text_media_right"   },
          { title: "Media left — media left, text right",            value: "text_media_left"    },
          { title: "Stacked — media above, text below full-width",   value: "text_media_stacked" },
        ],
      },
      initialValue: "text_media_right",
    }),

    // ── Eyebrow ────────────────────────────────────────────────────────────────
    defineField({
      name: "eyebrow",
      title: "Eyebrow Label",
      type: "string",
      description: "Small label above the heading. Max 80 chars.",
      validation: (Rule) => Rule.max(80),
    }),

    // ── Heading ────────────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section headline.",
    }),

    // ── Body copy ──────────────────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Body",
      type: "text",
      rows: 4,
      description: "Supporting copy alongside the media element.",
    }),

    // ── Media type selector ────────────────────────────────────────────────────
    defineField({
      name: "mediaType",
      title: "Media Type",
      type: "string",
      options: {
        list: [
          { title: "Image", value: "image" },
          { title: "Video", value: "video" },
        ],
        layout: "radio",
      },
      initialValue: "image",
    }),

    // ── Image (shown when mediaType = "image") ────────────────────────────────
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      description:
        "Upload or select an image from the Sanity asset library. " +
        "Add alt text inside the image field for accessibility.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the image for screen readers.",
        }),
      ],
      hidden: ({ parent }) => (parent as { mediaType?: string } | undefined)?.mediaType === "video",
    }),

    // ── Video URL (shown when mediaType = "video") ────────────────────────────
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description:
        "URL for the video to display alongside the text (e.g. a CDN URL or YouTube embed URL).",
      hidden: ({ parent }) => (parent as { mediaType?: string } | undefined)?.mediaType !== "video",
    }),

    // ── Caption ────────────────────────────────────────────────────────────────
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional short caption displayed below the media element.",
    }),

    // ── CTAs ───────────────────────────────────────────────────────────────────
    defineField({
      name: "ctas",
      title: "Call-to-action Buttons",
      type: "array",
      description: "0–2 CTA buttons displayed below the text. First is primary, second is secondary.",
      of: [
        defineArrayMember({
          type: "object",
          name: "textMediaCta",
          title: "CTA",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (Rule) => Rule.required().max(60),
            }),
            defineField({
              name: "href",
              title: "Destination",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { label: "label", href: "href" },
            prepare({ label, href }: Record<string, string | undefined>) {
              return { title: label ?? "(no label)", subtitle: href ?? "(no href)" };
            },
          },
        }),
      ],
      validation: (Rule) => Rule.max(2),
    }),
  ],

  preview: {
    select: { heading: "heading", variant: "variant" },
    prepare({ heading, variant }) {
      const variantLabel = variant ? ` · ${variant}` : "";
      return {
        title:    heading ?? "(No heading)",
        subtitle: `Text + Media${variantLabel}`,
      };
    },
  },
});
