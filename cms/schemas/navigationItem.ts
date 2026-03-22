/**
 * Sanity Schema — navigationItem
 *
 * A navigation link that can point to an internal CMS page or an external URL,
 * and supports one level of nested child items for dropdown menus.
 *
 * ─── Link type model ──────────────────────────────────────────────────────────
 *
 *   linkType drives conditional field visibility and validation:
 *
 *   "internal"   internalPage is required. Renders as a reference to a page
 *                document — the URL is derived from the page's slug at render
 *                time rather than hardcoded here. Safe against URL changes.
 *
 *   "external"   externalUrl is required. Used for links to third-party sites,
 *                social profiles, or any URL outside the CMS page tree.
 *
 * ─── Children / nesting ───────────────────────────────────────────────────────
 *
 *   children holds references to other navigationItem documents. This enables
 *   one level of dropdown navigation (top-level item → child items). The
 *   rendering layer is responsible for enforcing depth limits — the schema
 *   permits only one level of children by convention.
 *
 *   Children items follow the same linkType rules as top-level items.
 *
 * ─── Usage in siteSettings ────────────────────────────────────────────────────
 *
 *   siteSettings.mainNavigation  → array of references to navigationItem
 *   siteSettings.footerNavigation → array of references to navigationItem
 *
 * ─── GROQ to fetch main navigation (with children) ───────────────────────────
 *
 *   *[_type == "siteSettings"][0] {
 *     mainNavigation[]->{
 *       _id,
 *       label,
 *       linkType,
 *       "href": select(
 *         linkType == "internal" => internalPage->slug.current,
 *         linkType == "external" => externalUrl,
 *       ),
 *       children[]->{
 *         _id,
 *         label,
 *         linkType,
 *         "href": select(
 *           linkType == "internal" => internalPage->slug.current,
 *           linkType == "external" => externalUrl,
 *         )
 *       }
 *     }
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   label         string                Required. Display text for the link.
 *   linkType      "internal"|"external" Required. Determines which link field is used.
 *   internalPage  reference → page      Required when linkType = "internal".
 *   externalUrl   url                   Required when linkType = "external".
 *   children      array[→navigationItem] Optional. One level of nested child links.
 *
 * ─── Dependency note ──────────────────────────────────────────────────────────
 *
 *   internalPage references the "page" document type. Register a "page" schema
 *   in cms/schemas/index.ts for the reference picker to work in Studio.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "navigationItem",
  title: "Navigation Item",
  type: "document",

  fields: [
    // ── Label ──────────────────────────────────────────────────────────────────
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description:
        "The text displayed in the navigation link. Keep concise — max 60 chars. " +
        "Used as the accessible link text and the visible menu label.",
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .max(60)
          .warning("Navigation labels over 30 characters may cause layout issues on mobile."),
    }),

    // ── Link type ──────────────────────────────────────────────────────────────
    defineField({
      name: "linkType",
      title: "Link Type",
      type: "string",
      description:
        'Choose "Internal" to link to a page managed in this CMS (recommended — ' +
        'URL stays correct if the page slug changes). Choose "External" for links ' +
        "to third-party sites, social profiles, or URLs outside the CMS.",
      options: {
        list: [
          { title: "Internal — link to a CMS page", value: "internal" },
          { title: "External — link to a URL",       value: "external" },
        ],
        layout: "radio",
      },
      initialValue: "internal",
      validation: (Rule) => Rule.required(),
    }),

    // ── Internal page reference ────────────────────────────────────────────────
    // Shown only when linkType = "internal". The URL is resolved at render time
    // via the page document's slug — no hardcoded path stored here.
    defineField({
      name: "internalPage",
      title: "Internal Page",
      type: "reference",
      to: [{ type: "page" }],
      description:
        "Select the CMS page this link should point to. The URL is derived from " +
        "the page's slug at render time — if the page slug changes, this link " +
        "updates automatically.",
      hidden: ({ parent }) =>
        (parent as { linkType?: string } | undefined)?.linkType !== "internal",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { linkType?: string } | undefined;
          if (parent?.linkType === "internal" && !value) {
            return "Internal page is required when link type is set to Internal.";
          }
          return true;
        }),
    }),

    // ── External URL ───────────────────────────────────────────────────────────
    // Shown only when linkType = "external".
    defineField({
      name: "externalUrl",
      title: "External URL",
      type: "url",
      description:
        "The full URL of the external destination. Must start with https:// or http://. " +
        "Example: https://linkedin.com/company/mister-chameleon.",
      hidden: ({ parent }) =>
        (parent as { linkType?: string } | undefined)?.linkType !== "external",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { linkType?: string } | undefined;
          if (parent?.linkType === "external" && !value) {
            return "External URL is required when link type is set to External.";
          }
          return true;
        }).uri({
          allowRelative: false,
          scheme: ["http", "https"],
        }),
    }),

    // ── Children ───────────────────────────────────────────────────────────────
    // One level of nested navigation items for dropdown menus.
    // Each child follows the same linkType rules as the parent.
    defineField({
      name: "children",
      title: "Child Items",
      type: "array",
      description:
        "Optional dropdown items nested under this navigation link. " +
        "Keep to one level — the rendering layer does not support deeply nested menus. " +
        "Each child item is a reference to another Navigation Item document.",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) =>
        Rule.unique().warning("Duplicate child items will produce confusing dropdown menus."),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:        "label",
      linkType:     "linkType",
      internalPage: "internalPage.slug.current",
      externalUrl:  "externalUrl",
      children:     "children",
    },
    prepare({ title, linkType, internalPage, externalUrl, children }) {
      const childCount = Array.isArray(children) ? children.length : 0;
      const childSuffix = childCount > 0 ? ` · ${childCount} child${childCount !== 1 ? "ren" : ""}` : "";

      let destination = "(no destination)";
      if (linkType === "internal") {
        destination = internalPage ? `/${internalPage}` : "⚠ no page selected";
      } else if (linkType === "external") {
        destination = externalUrl ?? "⚠ no URL set";
      }

      const typeLabel = linkType === "internal" ? "↳ internal" : linkType === "external" ? "↗ external" : "";

      return {
        title:    title ?? "(No label)",
        subtitle: `${typeLabel}  ${destination}${childSuffix}`,
      };
    },
  },
});
