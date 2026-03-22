/**
 * Sanity Schema — company
 *
 * A Company is a standalone CMS document.  It is referenced by NewsArticle and
 * Vacancy documents and can be rendered via any page that fetches company data
 * — it is NOT a page section block.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId     string    Optional. Tenant owner slug, e.g. "workengine".
 *   name         string    Required. Company display name.
 *   slug         slug      Required. URL slug used to build company pages.
 *   logo         image     Optional. Logotype with alt text.
 *   description  text      Optional. Short intro paragraph for listings/cards.
 *   services     array     Optional. Ordered list of service/product area names.
 *   branches     array     Optional. Office/branch locations.
 *   stats        array     Optional. Key metrics (label + value pairs).
 *   images       array     Optional. Gallery images.
 *   isPublished  boolean   Required. Only published companies appear in queries.
 *
 * ─── GROQ query pattern (tenant-aware) ───────────────────────────────────────
 *
 *   *[_type == "company" && slug.current == $slug && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id, "slug": slug.current, tenantId, name, description, services,
 *     "logo": logo { "url": asset->url, alt },
 *     branches[], stats[],
 *     "images": images[] { "url": asset->url, alt }
 *   }
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "company",
  title: "Company",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this company record, e.g. \"workengine\". " +
        "Leave blank for shared / platform-level companies.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Name ───────────────────────────────────────────────────────────────────
    defineField({
      name: "name",
      title: "Company Name",
      type: "string",
      description: "Full display name of the company.",
      validation: (Rule) => Rule.required(),
    }),

    // ── Slug ───────────────────────────────────────────────────────────────────
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "URL slug used to build the company detail page path. " +
        "Generated from the company name — change with care once published.",
      options: { source: "name" },
      validation: (Rule) => Rule.required(),
    }),

    // ── Logo ───────────────────────────────────────────────────────────────────
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      description: "Company logotype. Used in listings, headers, and company cards.",
      options: { hotspot: false },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describes the logo for screen readers. E.g. 'Acme Corp logo'.",
          validation: (Rule) => Rule.required(),
        }),
      ],
    }),

    // ── Description ────────────────────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 4,
      description:
        "Short introductory paragraph. Shown in listing cards and company overview sections. " +
        "Keep to 2–3 sentences (≤300 chars).",
      validation: (Rule) => Rule.max(300),
    }),

    // ── Services ───────────────────────────────────────────────────────────────
    defineField({
      name: "services",
      title: "Services / Areas",
      type: "array",
      description:
        "Ordered list of service or product area names (e.g. 'Staffing', 'RPO'). " +
        "First item may be featured in summary cards.",
      of: [
        defineArrayMember({
          type: "object",
          name: "serviceItem",
          title: "Service",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (Rule) => Rule.required() }),
          ],
          preview: { select: { title: "label" } },
        }),
      ],
    }),

    // ── Branches ───────────────────────────────────────────────────────────────
    defineField({
      name: "branches",
      title: "Branches / Offices",
      type: "array",
      description: "Office and branch locations. Each item can hold name, city, address, and phone.",
      of: [
        defineArrayMember({
          type: "object",
          name: "branch",
          title: "Branch",
          fields: [
            defineField({ name: "name",    title: "Branch Name", type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "city",    title: "City",        type: "string" }),
            defineField({ name: "address", title: "Address",     type: "text", rows: 2 }),
            defineField({ name: "phone",   title: "Phone",       type: "string" }),
          ],
          preview: {
            select: { title: "name", subtitle: "city" },
            prepare({ title, subtitle }) {
              return { title: title ?? "(Unnamed branch)", subtitle: subtitle ?? "" };
            },
          },
        }),
      ],
    }),

    // ── Stats ──────────────────────────────────────────────────────────────────
    defineField({
      name: "stats",
      title: "Key Statistics",
      type: "array",
      description:
        "Key metrics shown in a stats strip. Each item is a label + value pair " +
        "(e.g. label: 'Founded', value: '2008').",
      of: [
        defineArrayMember({
          type: "object",
          name: "stat",
          title: "Stat",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "value", title: "Value", type: "string", validation: (Rule) => Rule.required() }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
          },
        }),
      ],
    }),

    // ── Gallery images ─────────────────────────────────────────────────────────
    defineField({
      name: "images",
      title: "Gallery Images",
      type: "array",
      description: "Office, team, or product images for gallery or media sections.",
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describe the image for screen readers.",
              validation: (Rule) => Rule.required(),
            }),
          ],
        }),
      ],
    }),

    // ── Published flag ─────────────────────────────────────────────────────────
    defineField({
      name: "isPublished",
      title: "Published",
      type: "boolean",
      description:
        "Only published companies are returned by default queries. " +
        "Unpublish to hide from all listings without deleting.",
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:       "name",
      subtitle:    "slug.current",
      published:   "isPublished",
      media:       "logo",
    },
    prepare({ title, subtitle, published, media }) {
      return {
        title:    title ?? "(Unnamed company)",
        subtitle: `${subtitle ?? "(no slug)"}${published === false ? " · ⚠ unpublished" : ""}`,
        media,
      };
    },
  },
});
