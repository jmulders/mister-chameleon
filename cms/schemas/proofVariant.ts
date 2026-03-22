/**
 * Sanity Schema — proofVariant
 *
 * Defines the content structure for an adaptive social proof block variant.
 * Each document contains a section heading and an array of proof items
 * (metric + supporting copy).
 *
 * ─── Variant keys ─────────────────────────────────────────────────────────────
 *
 *   proof_cases     ROI-focused evidence — case study numbers and outcomes.
 *   proof_vision    Industry recognition — analyst perspectives, awards.
 *   proof_platform  Technical reliability — scale, uptime, integration breadth.
 *
 * ─── GROQ query (from cms/queries/sanity/proof-queries.ts) ───────────────────
 *
 *   *[_type == "proofVariant" && key.current == $key && isActive == true][0] {
 *     _id, "key": key.current, title, items[] { _key, title, text }
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId    string            Optional. Tenant owner slug, e.g. "workengine".
 *   key         slug              Required. Must match a ProofVariantKey.
 *   title       string            Required. Section heading. ≤120 chars.
 *   items       array[proofItem]  Required. 3 items recommended.
 *   sourceTags  array             Optional. Editorial taxonomy.
 *   isActive    boolean           Required. Default: true.
 *
 * ─── proofItem fields ─────────────────────────────────────────────────────────
 *
 *   title   string  Required. Bold metric or label. e.g. "3.2× more leads". ≤80 chars.
 *   text    text    Required. 1–2 sentences of supporting copy. ≤300 chars.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "proofVariant",
  title: "Proof Variant",
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
        "Must match a ProofVariantKey exactly (e.g. proof_cases). " +
        "Use underscores, not hyphens.",
      options: {
        source: "title",
        slugify: (input) =>
          input.toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]/g, ""),
      },
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          if (!slug?.current) return "Variant key is required.";
          if (!/^proof_[a-z][a-z0-9_]*$/.test(slug.current)) {
            return 'Key must start with "proof_" and contain only lowercase letters, numbers, and underscores.';
          }
          return true;
        }),
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Section Heading",
      type: "string",
      description: "Heading displayed above the proof items. Max 120 chars.",
      validation: (Rule) => Rule.required().max(120),
    }),

    // ── Proof items ────────────────────────────────────────────────────────────
    defineField({
      name: "items",
      title: "Proof Items",
      type: "array",
      description: "3 items recommended. Each item shows a bold metric and 1–2 lines of support copy.",
      of: [
        defineArrayMember({
          type: "object",
          name: "proofItem",
          title: "Proof Item",
          fields: [
            defineField({
              name: "title",
              title: "Metric / Label",
              type: "string",
              description: 'Bold figure or label. e.g. "3.2× more leads" or "99.9% uptime". Max 80 chars.',
              validation: (Rule) => Rule.required().max(80),
            }),
            defineField({
              name: "text",
              title: "Supporting Copy",
              type: "text",
              rows: 2,
              description: "1–2 sentences expanding on the metric. Max 300 chars.",
              validation: (Rule) => Rule.required().max(300),
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "text" },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .max(6)
          .warning("3 proof items is the recommended layout. More than 6 may overflow."),
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
      itemCount: "items",
    },
    prepare({ title, subtitle, active, itemCount }) {
      const count = Array.isArray(itemCount) ? itemCount.length : 0;
      return {
        title: title ?? "(No heading)",
        subtitle: `${subtitle ?? "(no key)"} · ${count} item${count !== 1 ? "s" : ""}${active === false ? " · ⚠ inactive" : ""}`,
      };
    },
  },
});
