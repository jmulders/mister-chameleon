/**
 * Sanity Schema — teamSection (object)
 *
 * Team member showcase section. Displays an optional heading and intro
 * alongside an array of team member cards.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant    string           Layout variant. Default: team_grid.
 *   heading    string?          Section heading, e.g. "Meet the team".
 *   intro      text?            Optional short intro paragraph below the heading.
 *   members    array[member]    Ordered list of team members.
 *
 * ─── member fields ────────────────────────────────────────────────────────────
 *
 *   name         string   Required. Full name.
 *   role         string   Required. Job title / role.
 *   bio          text?    Short biography (1–2 sentences).
 *   photo        image?   Profile photo (Sanity asset, hotspot-aware).
 *   profileHref  string?  Optional link to a full profile page.
 *   linkedinUrl  string?  LinkedIn profile URL.
 *   twitterUrl   string?  Twitter / X profile URL.
 *   githubUrl    string?  GitHub profile URL.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   team_grid    — 3-column card grid with avatar, bio, and social links (default)
 *   team_compact — tight single-column list: avatar + name + role inline
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "teamSection",
  title: "Team Section",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this team section.",
      options: {
        list: [
          { title: "Grid — 3-column card grid with avatar, bio, social links (default)", value: "team_grid"    },
          { title: "Compact — tight single-column list: avatar + name + role",           value: "team_compact" },
        ],
      },
      initialValue: "team_grid",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Meet the team\".",
    }),

    // ── Intro ──────────────────────────────────────────────────────────────────
    defineField({
      name: "intro",
      title: "Intro",
      type: "text",
      rows: 3,
      description: "Optional short intro paragraph below the heading.",
    }),

    // ── Team members ───────────────────────────────────────────────────────────
    defineField({
      name: "members",
      title: "Team Members",
      type: "array",
      description: "Ordered list of team members. Add in the order you want them shown.",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "teamMember",
          title: "Team Member",
          fields: [
            defineField({
              name: "name",
              title: "Name",
              type: "string",
              description: "Full name.",
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
              description: "Upload or select the team member's profile photo from the Sanity asset library.",
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
            defineField({
              name: "profileHref",
              title: "Profile Page URL",
              type: "string",
              description: "Optional link to the full team member profile page.",
            }),
            defineField({
              name: "linkedinUrl",
              title: "LinkedIn URL",
              type: "string",
              description: "Optional LinkedIn profile URL.",
            }),
            defineField({
              name: "twitterUrl",
              title: "Twitter / X URL",
              type: "string",
              description: "Optional Twitter or X profile URL.",
            }),
            defineField({
              name: "githubUrl",
              title: "GitHub URL",
              type: "string",
              description: "Optional GitHub profile URL.",
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
    select: { heading: "heading", members: "members" },
    prepare({ heading, members }) {
      const count = Array.isArray(members) ? members.length : 0;
      return {
        title:    heading ?? "Team Section",
        subtitle: `${count} member${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
