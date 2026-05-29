/**
 * Sanity Schema — about (object)
 *
 * An "About us" / split-media section. Supports a rich-text body,
 * an optional image, and an optional team-member grid.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   heading      string      Optional section heading.
 *   body         richText?   Portable Text supporting copy.
 *   image        image?      Sanity image asset with inline alt text.
 *   teamMembers  array?      Team member cards.
 *     ↳ name      string     Full name.
 *     ↳ role      string     Job title / role.
 *     ↳ bio       string?    Short biography.
 *     ↳ photo     image?     Profile photo (Sanity asset, hotspot-aware).
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   The old `imageUrl` (string) and `imageAlt` (string) fields are no longer
 *   present in the schema. The GROQ query uses coalesce(image.asset->url, imageUrl)
 *   so legacy documents continue to render until re-saved with a Sanity asset.
 *   Similarly teamMembers[].photo replaces teamMembers[].imageUrl.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "about",
  title: "About",
  type: "object",

  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this about section.",
      options: {
        list: [
          { title: "Text left, image right (default)", value: "media_right" },
          { title: "Image left, text right",           value: "media_left" },
          { title: "Full-width image above text",      value: "media_full" },
          { title: "Team member card grid",            value: "team-grid" },
        ],
      },
      initialValue: "media_right",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Optional section heading.",
    }),

    defineField({
      name: "body",
      title: "Body",
      type: "array",
      description: "Supporting rich text. Keep concise — 2–4 paragraphs.",
      of: [{ type: "block" }],
    }),

    defineField({
      name: "image",
      title: "Image",
      type: "image",
      description:
        "Upload or select a Sanity image asset. Used as a split-media image or full-width illustration.",
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
      name: "teamMembers",
      title: "Team Members",
      type: "array",
      description: "Optional team member cards displayed below the body copy.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "name",
              title: "Name",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "role",
              title: "Role",
              type: "string",
              description: "Job title or role.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "bio",
              title: "Bio",
              type: "text",
              rows: 2,
              description: "Short biography (1–2 sentences).",
            }),
            defineField({
              name: "photo",
              title: "Profile Photo",
              type: "image",
              description: "Upload or select a profile photo from the Sanity asset library.",
              options: { hotspot: true },
              fields: [
                defineField({
                  name: "alt",
                  title: "Alt Text",
                  type: "string",
                  description: "Describe the photo for screen readers.",
                }),
              ],
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "role" },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { heading: "heading", teamMembers: "teamMembers" },
    prepare({ heading, teamMembers }) {
      const count = Array.isArray(teamMembers) ? teamMembers.length : 0;
      return {
        title: heading ?? "About",
        subtitle: count > 0 ? `${count} team member${count !== 1 ? "s" : ""}` : undefined,
      };
    },
  },
});
