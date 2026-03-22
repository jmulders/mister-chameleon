/**
 * Sanity Schema — heroVariant
 *
 * Defines the content structure for an adaptive hero block variant.
 * One document per variant key. The decision engine selects the correct key
 * for each visitor; the CMS provider fetches the matching document.
 *
 * ─── Variant keys ─────────────────────────────────────────────────────────────
 *
 *   hero_google_problem   Problem-aware copy for Google organic/paid traffic.
 *   hero_linkedin_vision  Vision-forward copy for LinkedIn social traffic.
 *   hero_direct_brand     Brand clarity — safe fallback for all other visitors.
 *
 * ─── Tenant awareness ─────────────────────────────────────────────────────────
 *
 *   tenantId  string  Optional. Identifies the tenant this variant belongs to.
 *                     Absent = shared/platform variant served to all tenants.
 *
 * ─── GROQ query (from cms/queries/sanity/hero-queries.ts) ────────────────────
 *
 *   *[_type == "heroVariant" && key.current == $key && isActive == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id, "key": key.current, tenantId, title, subtitle, ctaLabel, ctaHref, tag
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId    string   Optional. Tenant owner slug, e.g. "workengine".
 *   key         slug     Required. Must match a HeroVariantKey exactly.
 *   title       string   Required. Primary headline. ≤120 chars.
 *   subtitle    text     Required. Supporting paragraph. ≤300 chars.
 *   ctaLabel    string   Required. CTA button text. ≤60 chars.
 *   ctaHref     string   Required. CTA destination URL (relative or absolute).
 *   tag         string   Optional. Eyebrow badge above headline. ≤80 chars.
 *   sourceTags  array    Optional. Editorial taxonomy — not used by queries.
 *   stageTags   array    Optional. Editorial taxonomy — not used by queries.
 *   isActive    boolean  Required. Only active documents are returned. Default: true.
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name: "heroVariant",
  title: "Hero Variant",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this variant, e.g. \"workengine\". " +
        "Leave blank for shared platform variants available to all tenants.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Variant key ────────────────────────────────────────────────────────────
    defineField({
      name: "key",
      title: "Variant Key",
      type: "slug",
      description:
        "Must match a HeroVariantKey exactly (e.g. hero_google_problem). " +
        "Use underscores, not hyphens. This value is matched by GROQ — any " +
        "mismatch means no content will be returned for this variant.",
      options: {
        source: "title",
        slugify: (input) =>
          input.toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]/g, ""),
      },
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          if (!slug?.current) return "Variant key is required.";
          if (!/^hero_[a-z][a-z0-9_]*$/.test(slug.current)) {
            return 'Key must start with "hero_" and contain only lowercase letters, numbers, and underscores.';
          }
          return true;
        }),
    }),

    // ── Headline ───────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Headline",
      type: "string",
      description: "Primary display headline. Target ≤80 chars for best visual fit. Max 120.",
      validation: (Rule) =>
        Rule.required().max(120).warning("Headlines over 80 characters may overflow on mobile."),
    }),

    // ── Subtitle ───────────────────────────────────────────────────────────────
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "text",
      rows: 3,
      description: "Supporting paragraph below the headline. 1–2 sentences. Max 300 chars.",
      validation: (Rule) => Rule.required().max(300),
    }),

    // ── CTA ────────────────────────────────────────────────────────────────────
    defineField({
      name: "ctaLabel",
      title: "CTA Label",
      type: "string",
      description: "Button text. Keep short and action-oriented. Max 60 chars.",
      validation: (Rule) => Rule.required().max(60),
    }),

    defineField({
      name: "ctaHref",
      title: "CTA Destination",
      type: "string",
      description:
        'Destination URL. Use a relative path (e.g. "#signup", "/contact") or ' +
        "an absolute URL. Not validated as a URL — relative paths are intentional.",
      validation: (Rule) =>
        Rule.required().custom((href) => {
          if (!href) return "CTA destination is required.";
          if (href.trim() === "") return "CTA destination cannot be blank.";
          return true;
        }),
    }),

    // ── Eyebrow tag (optional) ─────────────────────────────────────────────────
    defineField({
      name: "tag",
      title: "Eyebrow Tag",
      type: "string",
      description: "Optional badge displayed above the headline. Max 80 chars. Leave blank to hide.",
      validation: (Rule) => Rule.max(80),
    }),

    // ── Editorial tags (informational — not used by GROQ queries) ─────────────
    defineField({
      name: "sourceTags",
      title: "Source Tags",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Informational: record which traffic sources this variant is optimised for. " +
        "Used for editorial filtering in Studio only — not consumed by the decision engine.",
      options: {
        list: [
          { title: "Google Organic", value: "google-organic" },
          { title: "Google Paid", value: "google-paid" },
          { title: "LinkedIn", value: "linkedin" },
          { title: "Direct", value: "direct" },
          { title: "Referral", value: "referral" },
          { title: "Email", value: "email" },
        ],
        layout: "tags",
      },
    }),

    defineField({
      name: "stageTags",
      title: "Stage Tags",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Informational: record which buyer journey stages this variant targets. " +
        "Used for editorial filtering in Studio only.",
      options: {
        list: [
          { title: "Awareness", value: "awareness" },
          { title: "Consideration", value: "consideration" },
          { title: "Decision", value: "decision" },
          { title: "Retention", value: "retention" },
        ],
        layout: "tags",
      },
    }),

    // ── Active flag ────────────────────────────────────────────────────────────
    defineField({
      name: "isActive",
      title: "Active",
      type: "boolean",
      description:
        "Only active documents are returned by GROQ queries. " +
        "Set to false to take this variant offline without deleting it.",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:    "title",
      key:      "key.current",
      tenantId: "tenantId",
      active:   "isActive",
    },
    prepare({ title, key, tenantId, active }) {
      const tenantLabel = tenantId ? ` [${tenantId}]` : "";
      return {
        title:    title ?? "(No headline)",
        subtitle: `${key ?? "(no key)"}${tenantLabel}${active === false ? " · ⚠ inactive" : ""}`,
      };
    },
  },
});
