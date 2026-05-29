/**
 * Sanity Schema — pricingSection (object)
 *
 * Pricing plans / tiers block. Displays a set of pricing cards with
 * features lists, CTAs, and optional badge / highlight state.
 * Commonly used on product and SaaS marketing pages.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   variant     string         Layout variant. Default: pricing_tiers.
 *   heading     string?        Section heading, e.g. "Simple, transparent pricing".
 *   subheading  string?        Optional sub-heading or intro line.
 *   tiers       array[tier]    Ordered list of pricing tiers.
 *   footnote    string?        Optional footnote below the tiers.
 *
 * ─── tier fields ──────────────────────────────────────────────────────────────
 *
 *   name         string    Required. Plan name, e.g. "Pro" or "Enterprise".
 *   price        string?   Display price, e.g. "€29" or "Custom".
 *   period       string?   Billing period, e.g. "/month" or "/user/month".
 *   description  string?   One-line plan summary.
 *   features     array     List of feature strings for this plan.
 *   ctaLabel     string?   CTA button label.
 *   ctaHref      string?   CTA button destination.
 *   highlighted  boolean   Visually highlight this tier (most popular). Default: false.
 *   badge        string?   Optional badge label, e.g. "Most popular".
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   pricing_tiers   — card-per-tier layout with feature lists (default)
 *   pricing_compact — minimal card strip without feature lists
 *   pricing_table   — comparison table: tiers as columns, features as rows
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "pricingSection",
  title: "Pricing Section",
  type: "object",

  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls the visual layout of this pricing block.",
      options: {
        list: [
          { title: "Tiers — card-per-tier with feature lists (default)", value: "pricing_tiers"   },
          { title: "Compact — minimal card strip, no feature lists",     value: "pricing_compact" },
          { title: "Table — comparison table: tiers as columns",        value: "pricing_table"   },
        ],
      },
      initialValue: "pricing_tiers",
    }),

    // ── Section heading ────────────────────────────────────────────────────────
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Section heading, e.g. \"Simple, transparent pricing\".",
    }),

    // ── Sub-heading ────────────────────────────────────────────────────────────
    defineField({
      name: "subheading",
      title: "Sub-heading",
      type: "string",
      description: "Optional sub-heading or intro line below the main heading.",
    }),

    // ── Pricing tiers ──────────────────────────────────────────────────────────
    defineField({
      name: "tiers",
      title: "Pricing Tiers",
      type: "array",
      description: "Ordered list of pricing tiers. Add in the order you want them shown.",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "pricingTier",
          title: "Pricing Tier",
          fields: [
            defineField({
              name: "name",
              title: "Plan Name",
              type: "string",
              description: "Plan name, e.g. \"Starter\", \"Pro\", or \"Enterprise\".",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "price",
              title: "Price",
              type: "string",
              description: "Display price, e.g. \"€29\", \"Free\", or \"Custom\".",
            }),
            defineField({
              name: "period",
              title: "Billing Period",
              type: "string",
              description: "Billing period label, e.g. \"/month\", \"/user/month\", or \"/year\".",
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "string",
              description: "One-line summary of this plan.",
            }),
            defineField({
              name: "features",
              title: "Features",
              type: "array",
              description: "List of features included in this plan.",
              of: [
                defineArrayMember({
                  type: "object",
                  name: "pricingFeature",
                  title: "Feature",
                  fields: [
                    defineField({
                      name: "label",
                      title: "Feature",
                      type: "string",
                      description: "Feature description, e.g. \"Unlimited users\" or \"Priority support\".",
                      validation: (Rule) => Rule.required(),
                    }),
                  ],
                  preview: {
                    select: { title: "label" },
                  },
                }),
              ],
            }),
            defineField({
              name: "ctaLabel",
              title: "CTA Label",
              type: "string",
              description: "CTA button label, e.g. \"Get started\" or \"Contact sales\".",
            }),
            defineField({
              name: "ctaHref",
              title: "CTA Destination",
              type: "string",
              description: "CTA button destination URL.",
            }),
            defineField({
              name: "highlighted",
              title: "Highlighted",
              type: "boolean",
              description: "Visually emphasise this tier (e.g. \"most popular\").",
              initialValue: false,
            }),
            defineField({
              name: "badge",
              title: "Badge",
              type: "string",
              description: "Optional badge label shown on the card, e.g. \"Most popular\".",
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "price", badge: "badge" },
            prepare({ title, subtitle, badge }: Record<string, string | undefined>) {
              return {
                title:    title ?? "(unnamed tier)",
                subtitle: [subtitle, badge].filter(Boolean).join(" · "),
              };
            },
          },
        }),
      ],
    }),

    // ── Footnote ───────────────────────────────────────────────────────────────
    defineField({
      name: "footnote",
      title: "Footnote",
      type: "string",
      description: "Optional footnote below the tiers, e.g. \"All prices exclude VAT.\".",
    }),
  ],

  preview: {
    select: { heading: "heading", tiers: "tiers" },
    prepare({ heading, tiers }) {
      const count = Array.isArray(tiers) ? tiers.length : 0;
      return {
        title:    heading ?? "Pricing Section",
        subtitle: `${count} tier${count !== 1 ? "s" : ""}`,
      };
    },
  },
});
