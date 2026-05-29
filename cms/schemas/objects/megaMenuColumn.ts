/**
 * Mega Menu Schema Objects
 *
 * Three object types that power the column-based mega menu:
 *
 *   megaMenuLinkItem   — A navigation link with optional description.
 *   megaMenuMediaItem  — An image / video / GIF with optional hover state.
 *   megaMenuColumn     — A container that holds EITHER link items OR media
 *                        items, driven by the `columnType` selector.
 *
 * ─── How they fit together ───────────────────────────────────────────────────
 *
 *   navigationItem (document)
 *     └─ megaMenu (object)
 *          └─ columns[]  (array of megaMenuColumn)
 *               ├─ linkItems[]   (visible when columnType == "links")
 *               │    └─ megaMenuLinkItem
 *               └─ mediaItems[]  (visible when columnType == "media")
 *                    └─ megaMenuMediaItem
 *
 * ─── Why linkItems / mediaItems instead of a single items[] ─────────────────
 *
 *   The previous schema used a single items[] that accepted both
 *   megaMenuLinkItem and megaMenuMediaItem.  Sanity Studio would then show
 *   a type picker ("Link Item" or "Media Item?") on every "Add item" click,
 *   regardless of what columnType the editor had selected.
 *
 *   This meant:
 *     • Editors adding a link had to choose from two confusingly-named options.
 *     • Media items could accidentally be added to a links column and vice versa.
 *     • There was no contextual guidance — the UI didn't adapt to columnType.
 *
 *   The fix: columnType now drives which items array is visible.
 *     - columnType = "links"  → linkItems[] is shown; mediaItems[] is hidden.
 *     - columnType = "media"  → mediaItems[] is shown; linkItems[] is hidden.
 *
 *   The GROQ projection folds them back into a single `items[]` field in the
 *   output using `select(columnType == "links" => linkItems[], ...)` so the
 *   frontend mapper and TypeScript types require zero changes.
 *
 * ─── Column title rule ───────────────────────────────────────────────────────
 *
 *   The `title` field on megaMenuColumn is optional.  When left blank the
 *   renderer skips the heading entirely — the column still shows its items.
 *
 * ─── Media image fields ───────────────────────────────────────────────────────
 *
 *   `megaMenuMediaItem` uses Sanity image assets (`type: "image"`).
 *   Field names:
 *     `image`      — primary image or GIF (replaces old "asset" name)
 *     `hoverImage` — optional hover swap image (replaces old "hoverAsset" name)
 *
 *   GROQ projection aliases these to `assetUrl` / `hoverAssetUrl` (strings)
 *   so the frontend receives a plain CDN URL, not a Sanity reference object.
 *
 * ─── Schema registration ─────────────────────────────────────────────────────
 *
 *   Import `megaMenuLinkItem`, `megaMenuMediaItem`, and `megaMenuColumn`
 *   (default export) in cms/schemas/index.ts and add them to schemaTypes.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

// ── megaMenuLinkItem ──────────────────────────────────────────────────────────

/**
 * A single navigation link in a mega menu links column.
 *
 * Supports both internal CMS page references and external URLs.
 * The optional `description` is shown as a supporting sentence beneath the
 * link label — useful for product nav where each destination needs a blurb.
 */
export const megaMenuLinkItem = defineType({
  name:  "megaMenuLinkItem",
  title: "Link Item",
  type:  "object",

  fields: [
    // ── Label ──────────────────────────────────────────────────────────────────
    defineField({
      name:  "label",
      title: "Label",
      type:  "string",
      description: "The text displayed as the link. Keep concise — max 80 characters.",
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .max(80)
          .warning("Link labels over 40 characters may cause layout issues."),
    }),

    // ── Supporting description ─────────────────────────────────────────────────
    defineField({
      name:  "description",
      title: "Description",
      type:  "string",
      description:
        "Optional supporting sentence shown beneath the link label in rich mega menus. " +
        "Leave blank to show only the label.",
      validation: (Rule) =>
        Rule.max(160).warning("Descriptions over 100 characters may be truncated."),
    }),

    // ── Link type selector ─────────────────────────────────────────────────────
    defineField({
      name:  "linkType",
      title: "Link Type",
      type:  "string",
      description:
        "Choose Internal to link to a CMS page (URL auto-updates if slug changes). " +
        "Choose External for any URL outside the CMS.",
      options: {
        list: [
          { title: "Internal — link to a CMS page", value: "internal" },
          { title: "External — link to a URL",       value: "external" },
        ],
        layout: "radio",
      },
      initialValue: "external",
      validation: (Rule) => Rule.required(),
    }),

    // ── Internal page reference ────────────────────────────────────────────────
    defineField({
      name:  "internalPage",
      title: "Internal Page",
      type:  "reference",
      to:    [{ type: "page" }],
      description:
        "Select the CMS page this link should point to. " +
        "The URL is derived from the page slug at render time.",
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
      name:  "externalUrl",
      title: "External URL",
      type:  "url",
      description: "The full destination URL. Must start with https:// or http://.",
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

    // ── New-tab toggle ─────────────────────────────────────────────────────────
    defineField({
      name:         "openInNewTab",
      title:        "Open in new tab",
      type:         "boolean",
      description:  "When enabled the link opens in a new browser tab (target=_blank).",
      initialValue: false,
    }),
  ],

  preview: {
    select: {
      title:    "label",
      subtitle: "description",
      linkType: "linkType",
    },
    prepare({ title, subtitle, linkType }) {
      const icon = linkType === "internal" ? "↳" : "↗";
      return {
        title:    title ?? "(No label)",
        subtitle: subtitle ? `${icon} ${subtitle}` : `${icon} ${linkType ?? "link"}`,
      };
    },
  },
});

// ── megaMenuMediaItem ─────────────────────────────────────────────────────────

/**
 * A media block — image, animated GIF, or video — in a mega menu media column.
 *
 * Image / GIF: use the `image` field (Sanity asset picker — upload or select
 * from the asset library). The optional `hoverImage` is swapped in on cursor
 * enter; when absent, a CSS scale animation is applied instead.
 *
 * Video: set mediaType to "Video" then fill in the `videoUrl` field with a
 * direct URL to a hosted .mp4. The video autoplays silently on hover.
 *
 * Link: when `linkType` is set the entire media block becomes clickable.
 * Supports the same internal/external pattern as megaMenuLinkItem.
 */
export const megaMenuMediaItem = defineType({
  name:  "megaMenuMediaItem",
  title: "Media Item",
  type:  "object",

  fields: [
    // ── Media type selector ────────────────────────────────────────────────────
    defineField({
      name:  "mediaType",
      title: "Media Type",
      type:  "string",
      description: "Choose Image/GIF to upload from the Sanity asset library, or Video for a hosted mp4.",
      options: {
        list: [
          { title: "Image — JPG, PNG, WebP, or SVG",    value: "image" },
          { title: "GIF — animated image",               value: "gif"   },
          { title: "Video — hosted mp4 (hover autoplay)", value: "video" },
        ],
        layout: "radio",
      },
      initialValue: "image",
      validation:   (Rule) => Rule.required(),
    }),

    // ── Primary image / GIF ────────────────────────────────────────────────────
    //
    // Named `image` (was previously `asset`).  The GROQ projection reads
    // `image.asset->url` which is the standard Sanity pattern for dereferencing
    // an image asset to its CDN URL.
    defineField({
      name:    "image",
      title:   "Image / GIF",
      type:    "image",
      description:
        "Upload or select the primary image or animated GIF. " +
        "Click the image area to open the Sanity asset picker.",
      options: { hotspot: true },
      hidden: ({ parent }) => {
        const p = parent as { mediaType?: string } | undefined;
        return p?.mediaType === "video";
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if ((parent?.mediaType === "image" || parent?.mediaType === "gif") && !value) {
            return "Please upload or select an image for this media item.";
          }
          return true;
        }),
    }),

    // ── Video URL ──────────────────────────────────────────────────────────────
    defineField({
      name:  "videoUrl",
      title: "Video URL",
      type:  "url",
      description:
        "Direct URL to a hosted video file (mp4 strongly recommended). " +
        "The video plays automatically and silently when the visitor hovers.",
      hidden: ({ parent }) => {
        const p = parent as { mediaType?: string } | undefined;
        return p?.mediaType !== "video";
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if (parent?.mediaType === "video" && !value) {
            return "Video URL is required for video media items.";
          }
          return true;
        }),
    }),

    // ── Asset URL (fallback) ───────────────────────────────────────────────────
    //
    // A plain string URL used as a fallback when no Sanity image asset is
    // uploaded (e.g. seed data pointing to external CDN or Unsplash images).
    // The GROQ projection coalesces: image.asset->url takes precedence; this
    // field is only used when `image` has no Sanity asset reference.
    // Hidden in Studio — editors should use the `image` asset picker instead.
    defineField({
      name:   "assetUrl",
      title:  "Asset URL (external fallback)",
      type:   "url",
      hidden: true,
      description:
        "External image URL used when no Sanity image asset is uploaded. " +
        "Managed programmatically — use the Image / GIF field in Studio instead.",
    }),

    // ── Hover image ────────────────────────────────────────────────────────────
    //
    // Named `hoverImage` (was previously `hoverAsset`).
    defineField({
      name:    "hoverImage",
      title:   "Hover Image (optional)",
      type:    "image",
      description:
        "Optional alternative image or GIF shown when the visitor hovers over this item. " +
        "When absent, a subtle scale animation is applied instead. Not applicable for video.",
      options: { hotspot: true },
      hidden: ({ parent }) => {
        const p = parent as { mediaType?: string } | undefined;
        return p?.mediaType === "video";
      },
    }),

    // ── Hover asset URL (fallback) ─────────────────────────────────────────────
    //
    // Plain string URL fallback for `hoverImage` — same pattern as `assetUrl`.
    // Hidden in Studio; use the Hover Image asset picker instead.
    defineField({
      name:   "hoverAssetUrl",
      title:  "Hover Asset URL (external fallback)",
      type:   "url",
      hidden: true,
      description:
        "External image URL used when no Sanity hover image asset is uploaded. " +
        "Managed programmatically — use the Hover Image field in Studio instead.",
    }),

    // ── Alt text ───────────────────────────────────────────────────────────────
    defineField({
      name:  "alt",
      title: "Alt text",
      type:  "string",
      description:
        "Describe the image for screen readers and search engines. " +
        "Required for images and GIFs; optional for decorative video.",
      validation: (Rule) => Rule.max(200),
    }),

    // ── Caption ────────────────────────────────────────────────────────────────
    defineField({
      name:  "caption",
      title: "Caption",
      type:  "string",
      description:
        "Optional short caption rendered below the media. " +
        "Useful for labelling product screenshots or highlighting a feature.",
      validation: (Rule) =>
        Rule.max(120).warning("Captions over 80 characters may overflow the column."),
    }),

    // ── Optional click-through link ────────────────────────────────────────────
    //
    // When a link is configured the entire media block becomes clickable.
    // Mirrors the same linkType / internalPage / externalUrl pattern used by
    // megaMenuLinkItem and navigationItem so editors have a consistent workflow.
    defineField({
      name:  "linkType",
      title: "Link Type (optional)",
      type:  "string",
      description:
        "When set, the entire media block becomes a clickable link. " +
        'Choose "Internal" to link to a CMS page (URL stays correct if the slug changes). ' +
        'Choose "External" for any URL outside the CMS. ' +
        "Leave unset for a purely decorative media item with no click-through.",
      options: {
        list: [
          { title: "Internal — link to a CMS page", value: "internal" },
          { title: "External — link to a URL",       value: "external" },
        ],
        layout: "radio",
      },
    }),

    defineField({
      name:  "internalPage",
      title: "Internal Page",
      type:  "reference",
      to:    [{ type: "page" }],
      description:
        "Select the CMS page this media block should link to. " +
        "The URL is derived from the page slug at render time.",
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

    defineField({
      name:  "externalUrl",
      title: "External URL",
      type:  "url",
      description:
        "The full destination URL this media block should link to. " +
        "Must start with https:// or http://.",
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

    defineField({
      name:         "linkOpenInNewTab",
      title:        "Open link in new tab",
      type:         "boolean",
      description:  "Open the link in a new browser tab when clicked.",
      initialValue: false,
      hidden: ({ parent }) =>
        !(parent as { linkType?: string } | undefined)?.linkType,
    }),
  ],

  preview: {
    select: {
      title:     "alt",
      caption:   "caption",
      mediaType: "mediaType",
      media:     "image",
    },
    prepare({ title, caption, mediaType, media }) {
      return {
        title:    caption ?? title ?? "(No caption or alt text)",
        subtitle: mediaType ? `Media item · ${mediaType}` : "Media item",
        media,
      };
    },
  },
});

// ── megaMenuColumn ────────────────────────────────────────────────────────────

/**
 * A single column in a mega menu.
 *
 * Columns are arranged horizontally in the mega menu panel.  Each column
 * has an optional title heading and a list of items.
 *
 * ─── Key design: columnType-gated items arrays ────────────────────────────────
 *
 *   Instead of a single items[] that accepts both megaMenuLinkItem and
 *   megaMenuMediaItem (which forces editors to choose from a confusing type
 *   picker on every "Add item" click), this schema uses two separate arrays:
 *
 *     linkItems[]   — visible and editable only when columnType == "links"
 *     mediaItems[]  — visible and editable only when columnType == "media"
 *
 *   When the editor selects "Links" as the column type, only the Link Items
 *   array is shown — adding an item goes directly to a Link Item form with
 *   no type ambiguity.  Selecting "Media" shows only the Media Items array.
 *
 *   The GROQ projection in site-settings-query.ts folds these back into a
 *   single `items[]` array using:
 *
 *     "items": select(
 *       columnType == "links" => linkItems[]{...},
 *       columnType == "media" => mediaItems[]{...},
 *       []
 *     )
 *
 *   so the frontend and TypeScript types are unchanged.
 *
 * ─── Column title rule ───────────────────────────────────────────────────────
 *
 *   The `title` field is optional.  When left blank the heading is not rendered
 *   (the column still shows its items).  This lets editors mix titled and
 *   untitled columns in the same mega menu.
 */
export const megaMenuColumn = defineType({
  name:  "megaMenuColumn",
  title: "Mega Menu Column",
  type:  "object",

  fields: [
    // ── Optional column heading ────────────────────────────────────────────────
    defineField({
      name:  "title",
      title: "Column Title",
      type:  "string",
      description:
        "Optional heading displayed above the column items. " +
        "Leave blank to render the column without a title.",
      validation: (Rule) =>
        Rule.max(60).warning("Column titles over 30 characters may cause layout issues."),
    }),

    // ── Column type selector ───────────────────────────────────────────────────
    defineField({
      name:  "columnType",
      title: "Column Type",
      type:  "string",
      description:
        "Controls which items are shown in this column and how they render. " +
        '"Links" → vertical list of text navigation links. ' +
        '"Media" → image, GIF, or video cards.',
      options: {
        list: [
          { title: "Links — vertical list of navigation links",  value: "links" },
          { title: "Media — images, videos, or animated GIFs",   value: "media" },
        ],
        layout: "radio",
      },
      initialValue: "links",
      validation: (Rule) => Rule.required(),
    }),

    // ── Link items (visible only when columnType == "links") ──────────────────
    //
    // Editors see a clean "Add link item" button with no type picker —
    // every item added goes directly into a megaMenuLinkItem form.
    defineField({
      name:  "linkItems",
      title: "Link Items",
      type:  "array",
      description:
        "Add the navigation links for this column. Each link has a label, " +
        "an optional supporting description, and a destination (internal page or external URL).",
      of: [defineArrayMember({ type: "megaMenuLinkItem" })],
      hidden: ({ parent }) =>
        (parent as { columnType?: string } | undefined)?.columnType !== "links",
      validation: (Rule) =>
        Rule.min(1).warning("A column with no items will be hidden in the rendered mega menu."),
    }),

    // ── Media items (visible only when columnType == "media") ─────────────────
    //
    // Editors see a clean "Add media item" button with no type picker —
    // every item added goes directly into a megaMenuMediaItem form.
    defineField({
      name:  "mediaItems",
      title: "Media Items",
      type:  "array",
      description:
        "Add image, GIF, or video blocks for this column. " +
        "Each item can have an alt text, caption, and an optional click-through link.",
      of: [defineArrayMember({ type: "megaMenuMediaItem" })],
      hidden: ({ parent }) =>
        (parent as { columnType?: string } | undefined)?.columnType !== "media",
      validation: (Rule) =>
        Rule.min(1).warning("A column with no items will be hidden in the rendered mega menu."),
    }),
  ],

  preview: {
    select: {
      title:      "title",
      columnType: "columnType",
      linkItems:  "linkItems",
      mediaItems: "mediaItems",
    },
    prepare({ title, columnType, linkItems, mediaItems }) {
      const items = columnType === "media" ? mediaItems : linkItems;
      const count = Array.isArray(items) ? items.length : 0;
      const typeLabel = columnType === "media" ? "media" : "links";
      return {
        title:    title || "(Untitled column)",
        subtitle: `${typeLabel} · ${count} item${count !== 1 ? "s" : ""}`,
      };
    },
  },
});

export default megaMenuColumn;
