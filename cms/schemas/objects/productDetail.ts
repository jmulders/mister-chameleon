import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Sanity schema — productDetail
 *
 * Full product detail view: gallery, title, description, specs, price,
 * primary + secondary CTAs, and an optional related products row.
 */
export default defineType({
  name:  "productDetail",
  title: "Product Detail",
  type:  "object",
  fields: [
    defineField({
      name:  "variant",
      title: "Layout Variant",
      type:  "string",
      options: {
        list: [
          { title: "Default (gallery left, copy right)", value: "product_detail_default" },
          { title: "Full width (stacked)",               value: "product_detail_full"    },
        ],
      },
      initialValue: "product_detail_default",
    }),

    defineField({ name: "title",       title: "Product Name",  type: "string" }),
    defineField({ name: "description", title: "Description",   type: "text", rows: 4 }),
    defineField({ name: "price",       title: "Price",         type: "string",
      description: 'Display string, e.g. "€49 / mo" or "From $99".' }),
    defineField({ name: "badge",       title: "Badge",         type: "string",
      description: 'Short pill label, e.g. "Popular" or "New".' }),

    // ── Gallery ───────────────────────────────────────────────────────────────

    defineField({
      name:  "gallery",
      title: "Product images",
      type:  "array",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "galleryImage",
          title: "Image",
          fields: [
            defineField({ name: "image", title: "Image", type: "image",
              options: { hotspot: true } }),
            defineField({ name: "alt", title: "Alt text", type: "string" }),
          ],
          preview: {
            select: { media: "image", title: "alt" },
            prepare({ media, title }) {
              return { media, title: title ?? "Product image" };
            },
          },
        }),
      ],
    }),

    // ── Specs ─────────────────────────────────────────────────────────────────

    defineField({
      name:  "specs",
      title: "Specifications",
      type:  "array",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "specItem",
          title: "Spec",
          fields: [
            defineField({ name: "label", title: "Label", type: "string" }),
            defineField({ name: "value", title: "Value", type: "string" }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
          },
        }),
      ],
    }),

    // ── CTAs ──────────────────────────────────────────────────────────────────

    defineField({ name: "ctaLabel",        title: "Primary CTA Label",   type: "string",
      description: 'E.g. "Add to cart", "Request quote".' }),
    defineField({ name: "ctaHref",         title: "Primary CTA Link",    type: "string" }),
    defineField({
      name:    "ctaVariant",
      title:   "Primary CTA Style",
      type:    "string",
      options: {
        list: [
          { title: "Primary",   value: "primary"   },
          { title: "Secondary", value: "secondary" },
          { title: "Outline",   value: "outline"   },
          { title: "Ghost",     value: "ghost"     },
        ],
      },
      initialValue: "primary",
      hidden: ({ parent }: { parent?: { ctaLabel?: string } }) => !parent?.ctaLabel,
    }),

    defineField({ name: "secondaryCtaLabel",   title: "Secondary CTA Label",  type: "string",
      description: 'E.g. "Learn more", "Download spec sheet".' }),
    defineField({ name: "secondaryCtaHref",    title: "Secondary CTA Link",   type: "string" }),
    defineField({
      name:    "secondaryCtaVariant",
      title:   "Secondary CTA Style",
      type:    "string",
      options: {
        list: [
          { title: "Secondary", value: "secondary" },
          { title: "Outline",   value: "outline"   },
          { title: "Ghost",     value: "ghost"     },
          { title: "Link",      value: "link"      },
        ],
      },
      initialValue: "outline",
      hidden: ({ parent }: { parent?: { secondaryCtaLabel?: string } }) => !parent?.secondaryCtaLabel,
    }),

    // ── Related products ──────────────────────────────────────────────────────

    defineField({
      name:  "relatedProducts",
      title: "Related products",
      type:  "array",
      description: "Optional row of related/upsell product cards shown below the detail view.",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "relatedProductCard",
          title: "Related product",
          fields: [
            defineField({ name: "title",       title: "Name",        type: "string" }),
            defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
            defineField({ name: "price",       title: "Price",       type: "string" }),
            defineField({ name: "badge",       title: "Badge",       type: "string" }),
            defineField({ name: "ctaLabel",    title: "CTA Label",   type: "string" }),
            defineField({ name: "ctaHref",     title: "CTA Link",    type: "string" }),
          ],
          preview: {
            select: { title: "title" },
            prepare({ title }: { title?: string }) {
              return { title: title ?? "(No name)", subtitle: "Related product" };
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", price: "price" },
    prepare({ title, price }: { title?: string; price?: string }) {
      return {
        title:    title ?? "(No name)",
        subtitle: price ? `Product Detail · ${price}` : "Product Detail",
      };
    },
  },
});
