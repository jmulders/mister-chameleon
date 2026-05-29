/**
 * Sanity Schema — navigationItem
 *
 * A navigation link that can point to an internal CMS page or an external URL,
 * and supports nested child and grandchild items for dropdown and mega menus.
 *
 * ─── Multi-tenant model ───────────────────────────────────────────────────────
 *
 *   Each tenant has its own navigation items, identified by the `tenantId` field.
 *   Shared / platform-level navigation items have no `tenantId`.
 *
 *   The Studio desk structure exposes Navigation Items inside each tenant's own
 *   workspace section so operators manage navigation in a tenant-first workflow.
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
 *   `children` holds references to other navigationItem documents. This enables
 *   dropdown navigation (top-level item → child items → optional grandchild items).
 *
 *   For mega menus, child items can themselves have children (grandchild items).
 *   The rendering layer enforces depth limits — typically two levels max.
 *
 *   Each child follows the same linkType rules as top-level items, and can
 *   also carry a `description` for rich mega-menu entries.
 *
 * ─── Description field ───────────────────────────────────────────────────────
 *
 *   The `description` field (optional) supplies a short supporting sentence for
 *   mega-menu or flyout-menu entries that show a title + subtitle pattern.
 *   It is ignored in simple nav bars and compact dropdown menus.
 *
 * ─── GROQ to fetch main navigation (with children and descriptions) ──────────
 *
 *   *[_type == "siteSettings" && tenantId == $tenantId][0] {
 *     mainNavigation[]->{
 *       _id, label, description, openInNewTab,
 *       "href": select(
 *         linkType == "internal" => "/" + internalPage->slug.current,
 *         linkType == "external" => externalUrl,
 *         "#"
 *       ),
 *       children[]->{
 *         _id, label, description, openInNewTab,
 *         "href": select(
 *           linkType == "internal" => "/" + internalPage->slug.current,
 *           linkType == "external" => externalUrl,
 *           "#"
 *         ),
 *         children[]->{
 *           _id, label,
 *           "href": select(
 *             linkType == "internal" => "/" + internalPage->slug.current,
 *             linkType == "external" => externalUrl,
 *             "#"
 *           )
 *         }
 *       }
 *     }
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId      string                Optional. Tenant scope.
 *   label         string                Required. Display text for the link.
 *   description   string                Optional. Short supporting copy for mega menus.
 *   linkType      "internal"|"external" Required. Determines which link field is used.
 *   internalPage  reference → page      Required when linkType = "internal".
 *   externalUrl   url                   Required when linkType = "external".
 *   openInNewTab  boolean               Optional. Open link in a new browser tab.
 *   children      array[→navigationItem] Optional. Nested child links (dropdown/mega).
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "navigationItem",
  title: "Navigation Item",
  type: "document",

  fields: [
    // ── Tenant scope ────────────────────────────────────────────────────────────
    defineField({
      name:  "tenantId",
      title: "Tenant ID",
      type:  "string",
      description:
        "The tenant this navigation item belongs to. " +
        'Matches the platform tenantId (e.g. "mister-chameleon"). ' +
        "Leave blank only for truly shared / platform-level navigation.",
      validation: (Rule) => Rule.max(120),
    }),

    // ── Locale ────────────────────────────────────────────────────────────────
    //
    // When a navigation item exists in multiple languages (translated label,
    // same href) each language variant is stored as a separate navigationItem
    // document sharing the same tenantId but with a different locale value.
    //
    // The GROQ query selects the right variant per request using:
    //   (locale == $locale || !defined(locale)) | order(defined(locale) desc) [0]
    //
    // Leave blank for the default / English version.
    defineField({
      name:  "locale",
      title: "Locale",
      type:  "string",
      description:
        'Language of this navigation item (e.g. "nl", "de"). ' +
        "Leave blank for the default English version.",
      options: {
        list: [
          { title: "English (default — leave blank)", value: ""   },
          { title: "Dutch (nl)",                      value: "nl" },
          { title: "German (de)",                     value: "de" },
        ],
      },
    }),

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

    // ── Description ───────────────────────────────────────────────────────────
    defineField({
      name:  "description",
      title: "Description",
      type:  "string",
      description:
        "Optional short supporting sentence — shown in mega menus and flyout menus " +
        "that display a title + subtitle pattern. Ignored in compact nav bars.",
      validation: (Rule) =>
        Rule.max(120).warning("Mega-menu descriptions over 80 characters may be truncated."),
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
    defineField({
      name: "externalUrl",
      title: "External URL",
      type: "url",
      description:
        "The full URL of the external destination. Must start with https:// or http://.",
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

    // ── Open in new tab ────────────────────────────────────────────────────────
    defineField({
      name:         "openInNewTab",
      title:        "Open in new tab",
      type:         "boolean",
      description:  "When enabled the link opens in a new browser tab (target=_blank).",
      initialValue: false,
    }),

    // ── Children ───────────────────────────────────────────────────────────────
    //
    // Hidden when hasMegaMenu is true: the mega menu column layout replaces the
    // simple dropdown entirely, so showing both fields at the same time would
    // mislead editors into thinking the child items list is also rendered.
    // Editors who want a simple dropdown keep hasMegaMenu off and use this field.
    // Editors who want a rich mega menu turn hasMegaMenu on and configure columns —
    // this field is hidden so there is no ambiguity about what gets rendered.
    defineField({
      name: "children",
      title: "Child Items",
      type: "array",
      description:
        "Optional nested navigation items for a simple dropdown menu. " +
        "Each item is a reference to another Navigation Item document. " +
        "Child items can themselves have children (grandchild items). " +
        "This field is hidden when Enable Mega Menu is on — mega menu columns " +
        "replace the simple dropdown in the rendered navigation.",
      hidden: ({ parent }) =>
        !!(parent as { hasMegaMenu?: boolean } | undefined)?.hasMegaMenu,
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) =>
        Rule.unique().warning("Duplicate child items will produce confusing dropdown menus."),
    }),

    // ── Has mega menu ──────────────────────────────────────────────────────────
    //
    // Toggle that shows or hides the Mega Menu configuration section below.
    // When false the item renders as a standard link or simple dropdown
    // (using Children).  When true the Mega Menu columns section is exposed.
    //
    // Keeping this as an explicit flag rather than inferring from column count
    // ensures the editor can enable the mega menu before adding any content,
    // and clearly communicates intent in the document list preview.
    defineField({
      name:         "hasMegaMenu",
      title:        "Enable Mega Menu",
      type:         "boolean",
      description:
        "Turn on to configure a rich column-based mega menu for this item. " +
        "When enabled the Mega Menu columns section appears below and the " +
        "simple Children dropdown is replaced by the column layout at render time.",
      initialValue: false,
    }),

    // ── Mega menu ──────────────────────────────────────────────────────────────
    //
    // When configured, the mega menu replaces the simple children dropdown.
    // It supports a flexible column layout with optional column titles and
    // mixed content types: navigation links or rich media (image / video / GIF).
    //
    // Column title rule: when a column's title is left blank the heading is not
    // rendered — the column still shows its items.
    //
    // Column types:
    //   "links"  → vertical list of link items with optional descriptions
    //   "media"  → image / video / GIF blocks with hover states
    //
    // Hidden when hasMegaMenu is false to keep the editor UI uncluttered for
    // items that only use the simple link / children model.
    defineField({
      name:  "megaMenu",
      title: "Mega Menu",
      type:  "object",
      description:
        "Configure a rich column-based mega menu for this navigation item. " +
        "When columns are added here they replace the simple Children dropdown. " +
        "Add between 1 and 5 columns; each column can hold links or media.",
      hidden: ({ parent }) =>
        !(parent as { hasMegaMenu?: boolean } | undefined)?.hasMegaMenu,
      fields: [
        defineField({
          name:  "columns",
          title: "Columns",
          type:  "array",
          description:
            "Add and reorder columns. Each column can have an optional title, " +
            "a type (Links or Media), and a list of items. " +
            "Columns with no items are hidden at render time.",
          of: [defineArrayMember({ type: "megaMenuColumn" })],
          validation: (Rule) =>
            Rule.max(5).warning(
              "More than 5 columns can cause layout issues on smaller screens.",
            ),
        }),
      ],
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:        "label",
      tenantId:     "tenantId",
      linkType:     "linkType",
      internalPage: "internalPage.slug.current",
      externalUrl:  "externalUrl",
      children:     "children",
      hasMegaMenu:  "hasMegaMenu",
    },
    prepare({ title, tenantId, linkType, internalPage, externalUrl, children, hasMegaMenu }) {
      const childCount = Array.isArray(children) ? children.length : 0;
      const childSuffix = childCount > 0 ? ` · ${childCount} child${childCount !== 1 ? "ren" : ""}` : "";
      const tenantSuffix = tenantId ? ` [${tenantId}]` : "";
      const megaSuffix   = hasMegaMenu ? " · mega menu" : "";

      let destination = "(no destination)";
      if (linkType === "internal") {
        destination = internalPage ? `/${internalPage}` : "⚠ no page selected";
      } else if (linkType === "external") {
        destination = externalUrl ?? "⚠ no URL set";
      }

      const typeLabel = linkType === "internal" ? "↳ internal" : linkType === "external" ? "↗ external" : "";

      return {
        title:    title ?? "(No label)",
        subtitle: `${typeLabel}  ${destination}${childSuffix}${megaSuffix}${tenantSuffix}`,
      };
    },
  },
});
