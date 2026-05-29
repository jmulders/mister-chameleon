/**
 * Sanity Schema — siteSettings
 *
 * Per-tenant site configuration — brand identity, SEO defaults, logo (including
 * dark/light variants), header navigation & CTA, footer, and social links.
 *
 * ─── Multi-tenant model ───────────────────────────────────────────────────────
 *
 *   Each tenant has its own siteSettings document, identified by its `tenantId`
 *   field.  The platform uses the document ID convention:
 *
 *     `siteSettings-{tenantId}`   e.g.  `siteSettings-mister-chameleon`
 *
 *   The Studio desk structure exposes Site Settings inside each tenant's own
 *   workspace section.  Shared / platform-level settings (no tenantId) still
 *   appear under the Shared content section.
 *
 * ─── Brand / logo model ───────────────────────────────────────────────────────
 *
 *   Three logo fields are available:
 *     logo       — default logo (used on light backgrounds; required when any
 *                  logo is uploaded)
 *     logoDark   — optional variant for use on dark backgrounds (e.g. dark header)
 *     logoLight  — optional variant for use on very light/white backgrounds
 *
 *   When logoDark / logoLight are absent the renderer falls back to `logo`.
 *
 * ─── Header extras ────────────────────────────────────────────────────────────
 *
 *   headerCta          — optional single CTA button shown in the header
 *                        (e.g. "Start free trial", "Book a demo")
 *   headerUtilityItems — optional flat list of secondary/utility nav references
 *                        shown in the top utility bar above the main nav
 *   locales            — ordered list of supported locale codes (e.g. "en", "nl")
 *                        used to drive the language selector in the header
 *
 * ─── Footer architecture ──────────────────────────────────────────────────────
 *
 *   Two footer navigation models are supported simultaneously:
 *
 *   1. `footerColumns`   — structured column layout.  Each column has an
 *      optional heading and a list of inline link objects.  Renders as a
 *      proper multi-column footer (2–5 columns, responsive).
 *
 *   2. `footerNavigation` — flat list of navigationItem references.
 *      Used for the "bottom links" row (Privacy, Terms, Imprint, etc.) and
 *      as the legacy fallback for footers that don't need columns.
 *
 *   When `footerColumns` is populated the footer renderer will prefer it.
 *   When both are empty the footer renders brand + copyright only.
 *
 * ─── GROQ query ───────────────────────────────────────────────────────────────
 *
 *   *[_type == "siteSettings" && tenantId == $tenantId][0] {
 *     siteTitle,
 *     tenantId,
 *     logo { asset->{ url }, alt },
 *     logoDark { asset->{ url }, alt },
 *     logoLight { asset->{ url }, alt },
 *     "headerCta": headerCta { label, href, style },
 *     headerUtilityItems[]->{ _id, label, "href": select(...), openInNewTab },
 *     locales,
 *     mainNavigation[]->{ ... },
 *     footerColumns[] { title, links[] { label, linkType, "href": select(...), openInNewTab } },
 *     footerNavigation[]->{ ... },
 *     contactEmail,
 *     contactPhone,
 *     socialLinks[] { label, url }
 *   }
 */

import { defineArrayMember, defineField, defineType } from "sanity";

// ── Re-usable logo sub-field helper ───────────────────────────────────────────

function logoField(name: string, title: string, description: string) {
  return defineField({
    name,
    title,
    type: "image",
    description,
    options: {
      accept:  "image/svg+xml,image/png,image/webp",
      hotspot: false,
    },
    fields: [
      defineField({
        name:        "alt",
        title:       "Alt Text",
        type:        "string",
        description: "Descriptive alt text for screen readers.",
        validation:  (Rule) =>
          Rule.custom((alt, context) => {
            if (context.parent && !alt) return "Alt text is required when a logo is uploaded.";
            return true;
          }),
      }),
    ],
  });
}

// ── Schema ────────────────────────────────────────────────────────────────────

export default defineType({
  name:  "siteSettings",
  title: "Site Settings",
  type:  "document",

  fields: [
    // ── Tenant scope ──────────────────────────────────────────────────────────
    defineField({
      name:  "tenantId",
      title: "Tenant ID",
      type:  "string",
      description:
        "The tenant this document belongs to. Matches the platform tenantId " +
        '(e.g. "mister-chameleon"). Leave blank only for truly shared / ' +
        "platform-level settings.",
      validation: (Rule) => Rule.max(120),
    }),

    // ── Locale ────────────────────────────────────────────────────────────────
    //
    // When a tenant's site configuration differs per language (e.g. different
    // navigation labels, footer links, or social accounts per locale) each
    // locale variant is stored as a separate siteSettings document sharing the
    // same tenantId but with a different locale value.
    //
    // The GROQ query uses `(locale == $locale || !defined(locale))` to select
    // the right document per request, falling back to the unlocalized document
    // when no locale-specific variant exists.
    //
    // Leave blank for the default / English version.
    defineField({
      name:  "locale",
      title: "Locale",
      type:  "string",
      description:
        'Language variant of this settings document (e.g. "nl", "de"). ' +
        "Leave blank for the default English version. " +
        "Locale variants share the same tenantId — the query selects the right one per visitor.",
      options: {
        list: [
          { title: "English (default — leave blank)", value: ""   },
          { title: "Dutch (nl)",                      value: "nl" },
          { title: "German (de)",                     value: "de" },
        ],
      },
    }),

    // ── Site identity ─────────────────────────────────────────────────────────
    defineField({
      name:  "siteTitle",
      title: "Site Title",
      type:  "string",
      description:
        'The site\'s primary brand name — e.g. "Mister Chameleon". Used in the ' +
        "header, breadcrumbs, and wherever the site identifies itself.",
      validation: (Rule) => Rule.required().min(1).max(80),
    }),

    // ── SEO defaults ──────────────────────────────────────────────────────────
    defineField({
      name:  "defaultSeoTitle",
      title: "Default SEO Title",
      type:  "string",
      description:
        "Fallback <title> tag for pages without their own title. Keep under 60 characters.",
      validation: (Rule) =>
        Rule.required()
          .min(10)
          .max(60)
          .warning("SEO titles over 60 characters are truncated in search results."),
    }),

    defineField({
      name:  "defaultSeoDescription",
      title: "Default SEO Description",
      type:  "text",
      rows:  3,
      description:
        "Fallback meta description for pages without their own. Target 120–160 characters.",
      validation: (Rule) =>
        Rule.required()
          .min(50)
          .max(160)
          .warning("Meta descriptions over 160 characters are truncated by Google."),
    }),

    // ── Logos ─────────────────────────────────────────────────────────────────
    logoField(
      "logo",
      "Logo (default)",
      "Primary site logo — SVG or high-res PNG. Used on light backgrounds. Minimum 200 px wide.",
    ),

    logoField(
      "logoDark",
      "Logo — Dark variant",
      "Optional logo variant optimised for dark backgrounds (e.g. dark header, dark footer). " +
      "Falls back to the default logo when absent.",
    ),

    logoField(
      "logoLight",
      "Logo — Light variant",
      "Optional logo variant optimised for white/very-light backgrounds. " +
      "Falls back to the default logo when absent.",
    ),

    // ── Header CTA ────────────────────────────────────────────────────────────
    defineField({
      name:        "headerCta",
      title:       "Header CTA Button",
      type:        "object",
      description: "Optional call-to-action button shown at the far right of the header. " +
                   'Examples: "Book a demo", "Start free trial".',
      fields: [
        defineField({
          name:  "label",
          title: "Button Label",
          type:  "string",
          validation: (Rule) => Rule.required().max(40),
        }),
        defineField({
          name:  "href",
          title: "Destination URL",
          type:  "string",
          description: 'Relative ("/contact") or absolute ("https://app.example.com").',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name:         "style",
          title:        "Button Style",
          type:         "string",
          initialValue: "primary",
          options: {
            list: [
              { title: "Primary (filled)",  value: "primary" },
              { title: "Outline",            value: "outline" },
              { title: "Ghost",              value: "ghost" },
            ],
            layout: "radio",
          },
        }),
        defineField({
          name:         "openInNewTab",
          title:        "Open in new tab",
          type:         "boolean",
          initialValue: false,
        }),
      ],
      preview: {
        select: { title: "label", subtitle: "href" },
      },
    }),

    // ── Header utility links ──────────────────────────────────────────────────
    defineField({
      name:  "headerUtilityItems",
      title: "Header Utility Links",
      type:  "array",
      description:
        "Optional secondary links shown in a utility bar above (or alongside) the " +
        "main navigation — e.g. Login, Support, Language selector trigger. " +
        "Each item is a reference to a Navigation Item document.",
      of: [
        defineArrayMember({
          type: "reference",
          to:   [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) => Rule.unique().max(6),
    }),

    // ── Language / locale options ─────────────────────────────────────────────
    defineField({
      name:  "locales",
      title: "Supported Locales",
      type:  "array",
      description:
        'Ordered list of locale codes supported by this tenant — e.g. ["en", "nl", "de"]. ' +
        "When more than one locale is listed a language selector is shown in the header. " +
        "The first entry is treated as the default locale.",
      of: [
        defineArrayMember({
          type: "object",
          name: "localeEntry",
          fields: [
            defineField({
              name:  "code",
              title: "Locale Code",
              type:  "string",
              description: 'IETF tag, e.g. "en", "nl", "de", "fr".',
              validation: (Rule) => Rule.required().max(10),
            }),
            defineField({
              name:  "label",
              title: "Display Label",
              type:  "string",
              description: 'Human-readable label, e.g. "English", "Nederlands".',
              validation: (Rule) => Rule.required().max(40),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "code" },
          },
        }),
      ],
      validation: (Rule) => Rule.unique(),
    }),

    // ── Header navigation ─────────────────────────────────────────────────────
    defineField({
      name:  "mainNavigation",
      title: "Main Navigation",
      type:  "array",
      description:
        "Ordered list of top-level header navigation links. Each item is a " +
        "reference to a Navigation Item document — manage items in the " +
        "Navigation Items section of this tenant's workspace.",
      of: [
        defineArrayMember({
          type: "reference",
          to:   [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) =>
        Rule.unique().warning("Duplicate navigation items will confuse visitors."),
    }),

    // ── Footer columns (structured layout) ───────────────────────────────────
    defineField({
      name:  "footerColumns",
      title: "Footer Columns",
      type:  "array",
      description:
        "Structured footer layout — define 2–5 columns, each with an optional " +
        "heading and an ordered list of links.  When populated, the footer " +
        "renders a proper multi-column layout.  Leave empty to fall back to " +
        "the flat footer navigation links below.",
      of: [
        defineArrayMember({ type: "footerColumn" }),
      ],
      validation: (Rule) => Rule.max(6).warning("More than 6 footer columns will be cramped on desktop."),
    }),

    // ── Footer navigation (flat / bottom links) ───────────────────────────────
    defineField({
      name:  "footerNavigation",
      title: "Footer Bottom Links",
      type:  "array",
      description:
        "Flat list of links shown in the footer bottom bar — typically " +
        "secondary links: Privacy Policy, Terms of Service, Imprint, etc. " +
        "When Footer Columns are set this row appears below the columns.",
      of: [
        defineArrayMember({
          type: "reference",
          to:   [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) => Rule.unique(),
    }),

    // ── Contact info ──────────────────────────────────────────────────────────
    defineField({
      name:  "contactEmail",
      title: "Contact Email",
      type:  "string",
      description:
        "Public contact email address. Shown in the footer and used as " +
        "mailto: link. Form submissions route via the tenant's webhook config, " +
        "not this field.",
      validation: (Rule) =>
        Rule.custom((email) => {
          if (!email) return true;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return "Please enter a valid email address.";
          }
          return true;
        }),
    }),

    defineField({
      name:  "contactPhone",
      title: "Contact Phone",
      type:  "string",
      description: "Public phone number. Shown in the footer when provided.",
      validation: (Rule) => Rule.max(40),
    }),

    // ── Social links ──────────────────────────────────────────────────────────
    defineField({
      name:  "socialLinks",
      title: "Social Links",
      type:  "array",
      description: "Social media profiles shown in the footer.",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "socialLink",
          title: "Social Link",
          fields: [
            defineField({
              name:        "label",
              title:       "Platform",
              type:        "string",
              description: 'Platform name, e.g. "LinkedIn", "Twitter / X", "GitHub".',
              validation:  (Rule) => Rule.required().max(60),
            }),
            defineField({
              name:  "url",
              title: "Profile URL",
              type:  "url",
              description: "Full absolute URL of the social profile.",
              validation:  (Rule) => Rule.required().uri({ scheme: ["http", "https"] }),
            }),
          ],
          preview: {
            select:   { title: "label", subtitle: "url" },
          },
        }),
      ],
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:    "siteTitle",
      tenantId: "tenantId",
    },
    prepare({ title, tenantId }) {
      return {
        title:    title ?? "Site Settings",
        subtitle: tenantId ? `tenant: ${tenantId}` : "(shared / no tenant)",
      };
    },
  },
});
