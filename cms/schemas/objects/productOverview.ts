import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Sanity schema — productOverview
 *
 * A grid or list of product cards with optional heading, intro text,
 * per-card prices/badges/CTAs, and a section-level CTA below the grid.
 */
export default defineType({
  name:  "productOverview",
  title: "Product Overview",
  type:  "object",
  fields: [
    defineField({
      name:  "variant",
      title: "Layout Variant",
      type:  "string",
      options: {
        list: [
          { title: "Card grid (default)", value: "product_grid"  },
          { title: "Elevated cards",      value: "product_cards" },
          { title: "List view",           value: "product_list"  },
        ],
      },
      initialValue: "product_grid",
    }),

    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({ name: "intro",   title: "Intro text", type: "text", rows: 2 }),

    defineField({
      name:  "showPrices",
      title: "Show prices",
      type:  "boolean",
      description: "Toggle to hide all prices across the entire grid.",
      initialValue: true,
    }),

    // ── Products ──────────────────────────────────────────────────────────────

    defineField({
      name:  "products",
      title: "Products",
      type:  "array",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "productCard",
          title: "Product",
          fields: [
            defineField({ name: "title",       title: "Name",         type: "string" }),
            defineField({ name: "description", title: "Description",  type: "text", rows: 3 }),
            defineField({ name: "price",       title: "Price",        type: "string",
              description: 'Display string, e.g. "€49 / mo" or "From $99". Leave blank to hide.' }),
            defineField({ name: "badge",       title: "Badge",        type: "string",
              description: 'Short pill label, e.g. "Popular" or "New".' }),
            defineField({ name: "image",       title: "Product image", type: "image",
              options: { hotspot: true } }),
            defineField({
              name:  "ctaLabel",
              title: "CTA Label",
              type:  "string",
              description: "Button label for this product (e.g. \"Buy now\", \"Learn more\").",
            }),
            defineField({ name: "ctaHref",    title: "CTA Link",         type: "string" }),
            defineField({
              name:    "ctaVariant",
              title:   "CTA Style",
              type:    "string",
              options: {
                list: [
                  { title: "Primary",   value: "primary"   },
                  { title: "Secondary", value: "secondary" },
                  { title: "Outline",   value: "outline"   },
                  { title: "Ghost",     value: "ghost"     },
                  { title: "Link",      value: "link"      },
                ],
              },
              initialValue: "primary",
              hidden: ({ parent }: { parent?: { ctaLabel?: string } }) => !parent?.ctaLabel,
            }),
          ],
          preview: {
            select: { title: "title", price: "price", badge: "badge" },
            prepare({ title, price, badge }: { title?: string; price?: string; badge?: string }) {
              const parts = [price, badge].filter(Boolean).join(" · ");
              return { title: title ?? "(No name)", subtitle: parts || "Product card" };
            },
          },
        }),
      ],
    }),

    // ── Section-level CTA ─────────────────────────────────────────────────────

    defineField({ name: "ctaLabel",   title: "Section CTA Label",
      type: "string",
      description: "Label for a section-level CTA below the product grid. Leave blank to hide." }),
    defineField({ name: "ctaHref",    title: "Section CTA Link",    type: "string" }),
    defineField({
      name:    "ctaVariant",
      title:   "Section CTA Style",
      type:    "string",
      options: {
        list: [
          { title: "Primary",   value: "primary"   },
          { title: "Secondary", value: "secondary" },
          { title: "Outline",   value: "outline"   },
          { title: "Ghost",     value: "ghost"     },
          { title: "Link",      value: "link"      },
        ],
      },
      initialValue: "primary",
      hidden: ({ parent }: { parent?: { ctaLabel?: string } }) => !parent?.ctaLabel,
    }),
  ],
  preview: {
    select: { heading: "heading", products: "products" },
    prepare({ heading, products }: { heading?: string; products?: unknown[] }) {
      const count = Array.isArray(products) ? products.length : 0;
      return {
        title:    heading ?? "(No heading)",
        subtitle: `Product Overview · ${count} product${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
