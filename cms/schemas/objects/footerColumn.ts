/**
 * Sanity Schema Object — footerColumn
 *
 * A single column in the site footer.  Columns group related links under
 * an optional heading — the pattern used by corporate, SaaS, and editorial
 * footers that organise five-to-twenty links into scannable vertical sections.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Used as an inline array member inside `siteSettings.footerColumns`.
 *   Not a top-level document — content lives directly in the parent document.
 *
 * ─── Link model ───────────────────────────────────────────────────────────────
 *
 *   Each link in `links` is an inline object (no separate document required).
 *   The `linkType` field mirrors the navigationItem schema:
 *
 *     "internal"  → `internalPage` reference, href resolved at query time.
 *     "external"  → `externalUrl` string.
 *     "label"     → non-clickable section label (for visual grouping only).
 */

import { defineArrayMember, defineField, defineType } from "sanity";

// ── footerLink (embedded object — link entry inside a column) ─────────────────

export const footerLinkSchema = defineType({
  name:  "footerLink",
  title: "Footer Link",
  type:  "object",
  fields: [
    defineField({
      name:  "label",
      title: "Label",
      type:  "string",
      description: "Display text for this link.",
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name:        "linkType",
      title:       "Link Type",
      type:        "string",
      initialValue: "internal",
      options: {
        list: [
          { title: "Internal — CMS page",   value: "internal" },
          { title: "External — URL",         value: "external" },
          { title: "Label only (no link)",   value: "label" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name:  "internalPage",
      title: "Internal Page",
      type:  "reference",
      to:    [{ type: "page" }],
      hidden: ({ parent }) =>
        (parent as { linkType?: string } | undefined)?.linkType !== "internal",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { linkType?: string } | undefined;
          if (parent?.linkType === "internal" && !value) {
            return "Select a page for an internal link.";
          }
          return true;
        }),
    }),
    defineField({
      name:  "externalUrl",
      title: "External URL",
      type:  "url",
      hidden: ({ parent }) =>
        (parent as { linkType?: string } | undefined)?.linkType !== "external",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { linkType?: string } | undefined;
          if (parent?.linkType === "external" && !value) {
            return "External URL is required when link type is External.";
          }
          return true;
        }).uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name:  "openInNewTab",
      title: "Open in new tab",
      type:  "boolean",
      initialValue: false,
      hidden: ({ parent }) =>
        (parent as { linkType?: string } | undefined)?.linkType === "label",
    }),
  ],
  preview: {
    select: { title: "label", linkType: "linkType", externalUrl: "externalUrl", slug: "internalPage.slug.current" },
    prepare({ title, linkType, externalUrl, slug }) {
      const icon = linkType === "external" ? "↗" : linkType === "label" ? "—" : "↳";
      const dest = linkType === "external" ? (externalUrl ?? "⚠ no URL") : linkType === "internal" ? `/${slug ?? "⚠ no page"}` : "(label)";
      return { title: title ?? "(no label)", subtitle: `${icon} ${dest}` };
    },
  },
});

// ── footerColumn ──────────────────────────────────────────────────────────────

export default defineType({
  name:  "footerColumn",
  title: "Footer Column",
  type:  "object",

  fields: [
    defineField({
      name:  "title",
      title: "Column Heading",
      type:  "string",
      description:
        "Optional column heading displayed above the link list. " +
        'Examples: "Product", "Company", "Resources". ' +
        "Leave blank for a column with no visible heading.",
      validation: (Rule) => Rule.max(60),
    }),

    defineField({
      name:  "links",
      title: "Links",
      type:  "array",
      description: "Ordered list of links in this column.",
      of: [
        defineArrayMember({ type: "footerLink" }),
      ],
      validation: (Rule) => Rule.min(1).error("A column must have at least one link."),
    }),
  ],

  preview: {
    select: { title: "title", links: "links" },
    prepare({ title, links }) {
      const count  = Array.isArray(links) ? links.length : 0;
      return {
        title:    title ?? "(No heading)",
        subtitle: `${count} link${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
