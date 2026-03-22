/**
 * Sanity Schema — ctaVariant
 *
 * Defines the content structure for an adaptive standalone CTA block variant.
 * One document per variant key. Each document has a display headline,
 * supporting paragraph, and a single call-to-action button.
 *
 * ─── Variant keys ─────────────────────────────────────────────────────────────
 *
 *   cta_guide     Lead nurture — free guide download (Google traffic).
 *   cta_platform  Product-led — create an account (LinkedIn traffic).
 *   cta_meeting   Sales-led — book a demo (direct / fallback traffic).
 *
 * ─── GROQ query (from cms/queries/sanity/cta-queries.ts) ─────────────────────
 *
 *   *[_type == "ctaVariant" && key.current == $key && isActive == true][0] {
 *     _id, "key": key.current, title, text, ctaLabel, ctaHref
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId    string   Optional. Tenant owner slug, e.g. "workengine".
 *   key         slug     Required. Must match a CTAVariantKey.
 *   title       string   Required. Large display headline. ≤120 chars.
 *   text        text     Required. Supporting paragraph. ≤300 chars.
 *   ctaLabel    string   Required. Button text. ≤60 chars.
 *   ctaHref     string   Required. CTA destination URL.
 *   sourceTags  array    Optional. Editorial taxonomy.
 *   isActive    boolean  Required. Default: true.
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name: "ctaVariant",
  title: "CTA Variant",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this variant, e.g. \"workengine\". " +
        "Leave blank for shared platform variants available to all tenants.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Variant key ────────────────────────────────────────────────────────────
    defineField({
      name: "key",
      title: "Variant Key",
      type: "slug",
      description:
        "Must match a CTAVariantKey exactly (e.g. cta_guide). " +
        "Use underscores, not hyphens.",
      options: {
        source: "title",
        slugify: (input) =>
          input.toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]/g, ""),
      },
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          if (!slug?.current) return "Variant key is required.";
          if (!/^cta_[a-z][a-z0-9_]*$/.test(slug.current)) {
            return 'Key must start with "cta_" and contain only lowercase letters, numbers, and underscores.';
          }
          return true;
        }),
    }),

    // ── Headline ───────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Headline",
      type: "string",
      description: "Large display headline for the CTA section. Max 120 chars.",
      validation: (Rule) => Rule.required().max(120),
    }),

    // ── Supporting copy ────────────────────────────────────────────────────────
    defineField({
      name: "text",
      title: "Supporting Copy",
      type: "text",
      rows: 3,
      description: "Paragraph below the headline. 1–2 sentences. Max 300 chars.",
      validation: (Rule) => Rule.required().max(300),
    }),

    // ── CTA ────────────────────────────────────────────────────────────────────
    defineField({
      name: "ctaLabel",
      title: "CTA Label",
      type: "string",
      description: "Button text. Keep short and action-oriented. Max 60 chars.",
      validation: (Rule) => Rule.required().max(60),
    }),

    defineField({
      name: "ctaHref",
      title: "CTA Destination",
      type: "string",
      description:
        "Destination URL. Use a relative path (e.g. /contact) or absolute URL.",
      validation: (Rule) =>
        Rule.required().custom((href) => {
          if (!href) return "CTA destination is required.";
          if (href.trim() === "") return "CTA destination cannot be blank.";
          return true;
        }),
    }),

    // ── Editorial tags (informational) ─────────────────────────────────────────
    defineField({
      name: "sourceTags",
      title: "Source Tags",
      type: "array",
      of: [{ type: "string" }],
      description: "Informational: traffic sources this variant is optimised for. Not used by queries.",
      options: {
        list: [
          { title: "Google Organic", value: "google-organic" },
          { title: "Google Paid", value: "google-paid" },
          { title: "LinkedIn", value: "linkedin" },
          { title: "Direct", value: "direct" },
          { title: "Referral", value: "referral" },
          { title: "Email", value: "email" },
        ],
        layout: "tags",
      },
    }),

    // ── Active flag ────────────────────────────────────────────────────────────
    defineField({
      name: "isActive",
      title: "Active",
      type: "boolean",
      description: "Only active documents are returned by GROQ queries. Default: true.",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title: "title",
      subtitle: "key.current",
      active: "isActive",
    },
    prepare({ title, subtitle, active }) {
      return {
        title: title ?? "(No headline)",
        subtitle: `${subtitle ?? "(no key)"}${active === false ? " · ⚠ inactive" : ""}`,
      };
    },
  },
});
