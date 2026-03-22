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
 *   imageUrl     string?     URL for an optional hero/split image.
 *   imageAlt     string?     Alt text for the image.
 *   teamMembers  array?      Team member cards.
 *     ↳ name      string     Full name.
 *     ↳ role      string     Job title / role.
 *     ↳ bio       string?    Short biography.
 *     ↳ imageUrl  string?    Profile photo URL.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "about",
  title: "About",
  type: "object",

  fields: [
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
      name: "imageUrl",
      title: "Image URL",
      type: "string",
      description:
        "URL for the section image. Used as a split-media image or full-width illustration.",
    }),

    defineField({
      name: "imageAlt",
      title: "Image Alt Text",
      type: "string",
      description: "Alt text for accessibility. Describe the image content.",
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
              name: "imageUrl",
              title: "Profile Photo URL",
              type: "string",
              description: "URL for the team member's profile photo.",
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
