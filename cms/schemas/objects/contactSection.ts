/**
 * Sanity Schema — contactSection (object)
 *
 * Contact information block. Displays office address, phone, email,
 * opening hours, and optional map embed alongside optional CTAs.
 * Commonly used on contact pages and footer supplementary sections.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant      string   Layout variant. Default: contact_default.
 *   heading      string?  Section heading, e.g. "Get in touch".
 *   description  text?    Optional intro paragraph above the contact details.
 *   address      text?    Postal address (multi-line).
 *   phone        string?  Phone number.
 *   email        string?  Email address.
 *   hours        string?  Opening hours, e.g. "Mon–Fri, 09:00–17:00".
 *   mapUrl       string?  URL for an embedded map or directions link.
 *   ctas         array?   0–2 CTA buttons { label, href }.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   contact_default — heading + description + contact details in one column (default)
 *   contact_split   — text/contact left, map embed right (two-column split)
 *   contact_minimal — compact inline row with icon+text pairs, no map
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "contactSection",
  title: "Contact Section",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this contact block.",
      options: {
        list: [
          { title: "Default — single-column contact details (default)", value: "contact_default" },
          { title: "Split — contact details left, map right",           value: "contact_split"   },
          { title: "Minimal — compact inline icon + text pairs",        value: "contact_minimal" },
        ],
      },
      initialValue: "contact_default",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Get in touch\" or \"Contact us\".",
    }),

    // ── Description ───────────────────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Optional intro paragraph above the contact details.",
    }),

    // ── Address ────────────────────────────────────────────────────────────────
    defineField({
      name: "address",
      title: "Address",
      type: "text",
      rows: 3,
      description: "Postal address. Each line will be rendered separately.",
    }),

    // ── Phone ──────────────────────────────────────────────────────────────────
    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
      description: "Contact phone number, e.g. \"+31 20 123 4567\".",
    }),

    // ── Email ──────────────────────────────────────────────────────────────────
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      description: "Contact email address.",
    }),

    // ── Opening hours ──────────────────────────────────────────────────────────
    defineField({
      name: "hours",
      title: "Opening Hours",
      type: "string",
      description: "Opening hours label, e.g. \"Mon–Fri, 09:00–17:00\".",
    }),

    // ── Map ────────────────────────────────────────────────────────────────────
    defineField({
      name: "mapUrl",
      title: "Map URL",
      type: "string",
      description: "URL for a map embed or Google Maps directions link.",
    }),

    // ── CTAs ───────────────────────────────────────────────────────────────────
    defineField({
      name: "ctas",
      title: "Call-to-action Buttons",
      type: "array",
      description: "0–2 CTA buttons displayed below the contact details.",
      of: [
        defineArrayMember({
          type: "object",
          name: "contactCta",
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
        title:    heading ?? "Contact Section",
        subtitle: `Contact${variantLabel}`,
      };
    },
  },
});
