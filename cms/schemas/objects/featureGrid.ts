import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "featureGrid",
  title: "Feature Grid",
  type: "object",
  fields: [
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this feature grid.",
      options: {
        list: [
          { title: "3-column bordered grid (default)", value: "feature_grid_3up" },
          { title: "4-column grid",                   value: "feature_grid_4up" },
          { title: "Elevated shadow cards",            value: "feature_grid_cards" },
          { title: "Icon-left checklist rows",         value: "feature_grid_checklist" },
        ],
      },
      initialValue: "feature_grid_3up",
    }),

    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
    }),
    defineField({
      name: "features",
      title: "Features",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "featureItem",
          title: "Feature",
          fields: [
            defineField({ name: "title",       title: "Title",       type: "string" }),
            defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
            defineField({ name: "icon",        title: "Icon",        type: "string" }),
          ],
          preview: {
            select: { title: "title", subtitle: "description" },
          },
        }),
      ],
    }),

    // ── Optional CTA below the grid ────────────────────────────────────────────

    defineField({
      name: "ctaLabel",
      title: "CTA Label",
      type: "string",
      description: "Label for the call-to-action button shown below the grid. Leave blank to hide the CTA.",
    }),
    defineField({
      name: "ctaHref",
      title: "CTA Link",
      type: "string",
      description: "URL or internal path the CTA button links to (e.g. /contact or https://…).",
    }),
    defineField({
      name: "ctaVariant",
      title: "CTA Button Style",
      type: "string",
      description: "Visual style of the CTA button. Defaults to Primary when not set.",
      options: {
        list: [
          { title: "Primary (filled)",         value: "primary"   },
          { title: "Secondary (tinted)",        value: "secondary" },
          { title: "Outline (border only)",     value: "outline"   },
          { title: "Ghost (low emphasis)",      value: "ghost"     },
          { title: "Link (text only)",          value: "link"      },
        ],
        layout: "radio",
      },
      initialValue: "primary",
      hidden: ({ parent }: { parent?: { ctaLabel?: string } }) => !parent?.ctaLabel,
    }),
  ],
  preview: {
    select: { title: "heading", features: "features" },
    prepare({ title, features }) {
      const count = Array.isArray(features) ? features.length : 0;
      return { title: title ?? "(No heading)", subtitle: `Feature Grid · ${count} item${count !== 1 ? "s" : ""}` };
    },
  },
});
