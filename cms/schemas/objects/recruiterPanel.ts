/**
 * Sanity Schema — recruiterPanel (object)
 *
 * Recruiter / contact-person spotlight panel. Displays a named contact
 * with optional photo, bio, and CTA for candidates to reach out.
 * Commonly used on vacancy detail pages and apply pages.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant    string   Layout variant. Default: default.
 *   heading    string?  Optional panel heading, e.g. "Your contact".
 *   name       string?  Recruiter's full name.
 *   role       string?  Job title, e.g. "Talent Acquisition Partner".
 *   bio        text?    Short bio or intro sentence.
 *   avatar     image?   Profile photo (Sanity asset, hotspot-aware).
 *   email      string?  Contact e-mail address.
 *   phone      string?  Contact phone number.
 *   ctaLabel   string?  CTA button label, e.g. "Send a message".
 *   ctaHref    string?  CTA button destination.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   default — full card: avatar + name + bio + contact details + CTA (default)
 *   compact — minimal: avatar + name + role + email link only
 *   card    — elevated card with avatar centred above details
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name: "recruiterPanel",
  title: "Recruiter Panel",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this recruiter panel.",
      options: {
        list: [
          { title: "Default — avatar + bio + contact + CTA (default)", value: "default" },
          { title: "Compact — avatar + name + role + email only",      value: "compact" },
          { title: "Card — elevated card with centred avatar",         value: "card"    },
        ],
      },
      initialValue: "default",
    }),

    // ── Panel heading ──────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Panel Heading",
      type: "string",
      description: "Optional heading above the recruiter details, e.g. \"Your contact\".",
    }),

    // ── Recruiter name ─────────────────────────────────────────────────────────
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "Recruiter's full name.",
    }),

    // ── Role / title ───────────────────────────────────────────────────────────
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description: "Job title or role, e.g. \"Talent Acquisition Partner\".",
    }),

    // ── Short bio ──────────────────────────────────────────────────────────────
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 3,
      description: "Short bio or intro sentence about the recruiter.",
    }),

    // ── Avatar ────────────────────────────────────────────────────────────────
    defineField({
      name: "avatar",
      title: "Profile Photo",
      type: "image",
      description: "Upload or select the recruiter's profile photo from the Sanity asset library.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the photo for screen readers (e.g. \"Photo of Sarah Jones\").",
        }),
      ],
    }),

    // ── Contact details ────────────────────────────────────────────────────────
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      description: "Contact e-mail address.",
    }),

    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
      description: "Contact phone number.",
    }),

    // ── CTA ────────────────────────────────────────────────────────────────────
    defineField({
      name: "ctaLabel",
      title: "CTA Label",
      type: "string",
      description: "CTA button label, e.g. \"Send a message\" or \"Book a call\".",
    }),

    defineField({
      name: "ctaHref",
      title: "CTA Destination",
      type: "string",
      description: "CTA button destination URL or mailto: link.",
    }),
  ],

  preview: {
    select: { name: "name", role: "role", variant: "variant" },
    prepare({ name, role, variant }) {
      const variantLabel = variant ? ` · ${variant}` : "";
      return {
        title:    name ?? "Recruiter Panel",
        subtitle: role ? `${role}${variantLabel}` : `Recruiter Panel${variantLabel}`,
      };
    },
  },
});
