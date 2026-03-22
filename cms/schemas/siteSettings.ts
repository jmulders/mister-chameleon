/**
 * Sanity Schema — siteSettings
 *
 * Global site configuration — SEO defaults, logo, navigation, contact
 * information, and social links. Intended as a singleton document: there
 * should be exactly one published siteSettings document per dataset.
 *
 * ─── Singleton setup in Sanity Studio ────────────────────────────────────────
 *
 *   To enforce singleton behaviour in Sanity Studio v3, configure the desk
 *   structure in your studio's `sanity.config.ts`:
 *
 *   ```typescript
 *   import { structureTool } from 'sanity/structure'
 *
 *   export default defineConfig({
 *     plugins: [
 *       structureTool({
 *         structure: (S) =>
 *           S.list().items([
 *             S.listItem()
 *               .title('Site Settings')
 *               .id('siteSettings')
 *               .child(
 *                 S.document()
 *                   .schemaType('siteSettings')
 *                   .documentId('siteSettings')  // Fixed document ID
 *               ),
 *             ...S.documentTypeListItems().filter(
 *               (item) => item.getId() !== 'siteSettings'
 *             ),
 *           ]),
 *       }),
 *     ],
 *   })
 *   ```
 *
 *   The fixed documentId ("siteSettings") means there is one canonical
 *   document. The "Create new" button is hidden automatically.
 *
 * ─── GROQ query to fetch site settings ───────────────────────────────────────
 *
 *   *[_type == "siteSettings"][0] {
 *     siteTitle,
 *     defaultSeoTitle,
 *     defaultSeoDescription,
 *     logo { asset->{ url, metadata { dimensions } }, alt },
 *     mainNavigation[]->{ _id, label, href, openInNewTab },
 *     footerNavigation[]->{ _id, label, href, openInNewTab },
 *     contactEmail,
 *     socialLinks[] { label, url }
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   siteTitle             string     Required. The site's primary title.
 *   defaultSeoTitle       string     Required. Default <title> tag value. ≤60 chars.
 *   defaultSeoDescription text       Required. Default meta description. ≤160 chars.
 *   logo                  image      Optional. Site logo with alt text.
 *   mainNavigation        reference  Optional. Ordered list of navigationItem refs.
 *   footerNavigation      reference  Optional. Ordered list of navigationItem refs.
 *   contactEmail          string     Optional. Public contact address.
 *   socialLinks           array      Optional. Array of { label, url } objects.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",

  // Singleton enforcement is handled in the Studio structure config (sanity.config.ts),
  // not in the schema definition. See the singleton setup instructions in the JSDoc
  // above for how to configure the desk structure to prevent duplicate documents.

  fields: [
    // ── Site identity ──────────────────────────────────────────────────────────
    defineField({
      name: "siteTitle",
      title: "Site Title",
      type: "string",
      description:
        "The site's primary title — used as the brand name in the header, " +
        "breadcrumbs, and anywhere the site identifies itself. " +
        "Example: \"Mister Chameleon\".",
      validation: (Rule) => Rule.required().min(1).max(80),
    }),

    // ── SEO defaults ───────────────────────────────────────────────────────────
    defineField({
      name: "defaultSeoTitle",
      title: "Default SEO Title",
      type: "string",
      description:
        "Fallback <title> tag for pages that do not define their own title. " +
        "Appears in browser tabs and search engine results. " +
        "Keep under 60 characters to avoid truncation in Google SERPs. " +
        "Example: \"Mister Chameleon — Adaptive Websites That Convert\".",
      validation: (Rule) =>
        Rule.required()
          .min(10)
          .max(60)
          .warning("SEO titles over 60 characters are truncated in search results."),
    }),

    defineField({
      name: "defaultSeoDescription",
      title: "Default SEO Description",
      type: "text",
      rows: 3,
      description:
        "Fallback meta description for pages that do not define their own. " +
        "Appears below the page title in search results. " +
        "Target 120–160 characters — below 120 may look thin; above 160 is truncated. " +
        "Write as a concise, benefit-led summary of the site.",
      validation: (Rule) =>
        Rule.required()
          .min(50)
          .max(160)
          .warning("Meta descriptions over 160 characters are truncated by Google."),
    }),

    // ── Logo ───────────────────────────────────────────────────────────────────
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      description:
        "The primary site logo. Used in the site header and wherever the brand " +
        "mark appears. Upload as SVG or high-resolution PNG. " +
        "Minimum recommended width: 200px. Provide the alt text below.",
      options: {
        accept: "image/svg+xml,image/png,image/webp",
        hotspot: false,  // Logos are not cropped
      },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description:
            "Descriptive alt text for the logo image. Used by screen readers and " +
            "displayed if the image fails to load. " +
            'Example: "Mister Chameleon logo".',
          validation: (Rule) =>
            Rule.custom((alt, context) => {
              // Alt is required if an image has been uploaded
              if (context.parent && !alt) {
                return "Alt text is required when a logo image is uploaded.";
              }
              return true;
            }),
        }),
      ],
    }),

    // ── Navigation ─────────────────────────────────────────────────────────────
    defineField({
      name: "mainNavigation",
      title: "Main Navigation",
      type: "array",
      description:
        "Ordered list of links for the primary site navigation (header). " +
        "Each item is a reference to a Navigation Item document — manage the " +
        "items themselves in the Navigation Items list in the sidebar.",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) =>
        Rule.unique().warning("Duplicate navigation items will cause confusing navigation."),
    }),

    defineField({
      name: "footerNavigation",
      title: "Footer Navigation",
      type: "array",
      description:
        "Ordered list of links for the site footer. " +
        "Typically includes secondary pages: Privacy Policy, Terms, Contact. " +
        "References Navigation Item documents — items can be shared between " +
        "mainNavigation and footerNavigation.",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "navigationItem" }],
        }),
      ],
      validation: (Rule) =>
        Rule.unique().warning("Duplicate footer navigation items will cause confusing navigation."),
    }),

    // ── Contact ────────────────────────────────────────────────────────────────
    defineField({
      name: "contactEmail",
      title: "Contact Email",
      type: "string",
      description:
        "The public contact email address displayed on the site and used as " +
        "the mailto: link in the footer. This is a display value — form " +
        "submissions are routed via the n8n webhook in tenant config, not this field. " +
        "Example: \"hello@misterchameleon.com\".",
      validation: (Rule) =>
        Rule.custom((email) => {
          if (!email) return true; // Field is optional
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            return "Please enter a valid email address.";
          }
          return true;
        }),
    }),

    // ── Social links ───────────────────────────────────────────────────────────
    defineField({
      name: "socialLinks",
      title: "Social Links",
      type: "array",
      description:
        "List of social media profile links. Each entry has a label (the platform name) " +
        "and a URL. Displayed in the site footer and used to generate social meta tags.",
      of: [
        defineArrayMember({
          type: "object",
          name: "socialLink",
          title: "Social Link",
          fields: [
            defineField({
              name: "label",
              title: "Platform Label",
              type: "string",
              description:
                'The social platform name. Used as the link\'s accessible label. ' +
                'Examples: "LinkedIn", "Twitter / X", "GitHub", "YouTube".',
              validation: (Rule) => Rule.required().min(1).max(60),
            }),
            defineField({
              name: "url",
              title: "Profile URL",
              type: "url",
              description:
                "The full URL of the social profile. Must be an absolute URL " +
                "(e.g. https://linkedin.com/company/mister-chameleon).",
              validation: (Rule) =>
                Rule.required().uri({
                  scheme: ["http", "https"],
                }),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "url" },
          },
        }),
      ],
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title: "siteTitle",
      subtitle: "defaultSeoTitle",
    },
    prepare({ title, subtitle }) {
      return {
        title: title ?? "Site Settings",
        subtitle: subtitle ?? "(No SEO title set)",
      };
    },
  },
});
