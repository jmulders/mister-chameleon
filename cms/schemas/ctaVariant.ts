/**
 * Sanity Schema — ctaVariant
 *
 * Defines the content structure for an adaptive standalone CTA block variant.
 * One document per variant key. Each document has a display headline,
 * supporting paragraph, and 1–2 call-to-action buttons.
 *
 * ─── Studio tabs ─────────────────────────────────────────────────────────────
 *
 *   Content             — headline, supporting copy, CTAs
 *   AI / Decision       — decisionMeta (audience, intent, goals, readiness gate)
 *   Identity & settings — tenant ID, variant key, layout, active flag
 *   Editorial tags      — sourceTags
 *
 * ─── Custom vs platform variants ─────────────────────────────────────────────
 *
 *   Platform variant:  tenantId is blank.  Serves as fallback for all tenants.
 *   Custom variant:    tenantId set.  Overrides the platform variant for that
 *                      specific tenant only (GROQ resolution order).
 *
 * ─── Variant keys ─────────────────────────────────────────────────────────────
 *
 *   cta_guide     Lead nurture — free guide download (Google traffic).
 *   cta_platform  Product-led — create an account (LinkedIn traffic).
 *   cta_meeting   Sales-led — book a demo (direct / fallback traffic).
 *
 * ─── Tenant-scoped identity ───────────────────────────────────────────────────
 *
 *   A variant is identified by the composite (tenantId, key) pair:
 *     • The same key (e.g. "cta_meeting") is reusable across tenants.
 *     • Uniqueness enforced per-tenant.
 *     • tenantId absent → shared/platform variant, available to ALL tenants.
 *
 * ─── Resolution order (GROQ) ──────────────────────────────────────────────────
 *
 *   1. Tenant-specific document  (tenantId == $tenantId)  — highest priority
 *   2. Shared/platform document  (!defined(tenantId))     — fallback
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId      string   Optional. Tenant owner slug, e.g. "workengine".
 *   key           string   Required. Business key, e.g. "cta_meeting".
 *   layoutVariant string   Optional. Layout variant for the block renderer.
 *   title         string   Required. Large display headline. ≤120 chars.
 *   text          text     Required. Supporting paragraph. ≤300 chars.
 *   ctas          array    Preferred. 1–2 CTA objects { label, href, variant? }.
 *   ctaLabel      string   Deprecated. Hidden in Studio.
 *   ctaHref       string   Deprecated. Hidden in Studio.
 *   sourceTags    array    Optional. Editorial taxonomy.
 *   decisionMeta  object   AI / decision metadata (aiReady gate + targeting fields).
 *   isActive      boolean  Required. Default: true.
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name:  "ctaVariant",
  title: "CTA Variant",
  type:  "document",

  // ── Field groups (Studio tabs) ─────────────────────────────────────────────
  groups: [
    {
      name:    "content",
      title:   "Content",
      default: true,
    },
    {
      name:  "ai",
      title: "AI / Decision",
    },
    {
      name:  "identity",
      title: "Identity & settings",
    },
    {
      name:  "editorial",
      title: "Editorial tags",
    },
  ],

  fields: [

    // ── Layout variant ── (identity group) ────────────────────────────────────
    defineField({
      name:  "layoutVariant",
      title: "Layout Variant",
      type:  "string",
      group: "identity",
      description:
        "Controls the structural layout of the CTA block. " +
        "The content (headline, text, CTAs) is the same regardless of layout.",
      options: {
        list: [
          { title: "Banner — full-width brand-coloured centred (default)",   value: "cta_banner"         },
          { title: "Split — headline/body left, buttons right",              value: "cta_split"          },
          { title: "Card — contained card on neutral background",            value: "cta_card"           },
          { title: "Banner Default — compact soft bar, title + CTAs inline", value: "cta_banner_default" },
          { title: "Banner Compact — notification-bar style, brand bg",      value: "cta_banner_compact" },
        ],
      },
      initialValue: "cta_banner",
    }),

    // ── Tenant ── (identity group) ────────────────────────────────────────────
    defineField({
      name:  "tenantId",
      title: "Tenant ID",
      type:  "string",
      group: "identity",
      description:
        "The tenant that owns this variant, e.g. \"workengine\".\n\n" +
        "• Leave blank to create a shared PLATFORM variant — it serves as the " +
        "fallback for every tenant that has no matching custom variant.\n\n" +
        "• Set a Tenant ID to create a CUSTOM variant — it overrides the platform " +
        "version for that specific tenant only.  Custom variant editing happens here.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Variant key ── (identity group) ───────────────────────────────────────
    defineField({
      name:  "key",
      title: "Variant Key",
      type:  "string",
      group: "identity",
      description:
        "Business key for this variant, e.g. \"cta_meeting\". " +
        "Use underscores, not spaces or hyphens. Must start with \"cta_\". " +
        "Unique within this Tenant ID — two tenants can independently use the same key.",
      validation: (Rule) =>
        Rule.required().custom(async (value, ctx) => {
          if (!value) return "Variant key is required.";
          if (!/^cta_[a-z][a-z0-9_]*$/.test(value)) {
            return 'Key must start with "cta_" and contain only lowercase letters, numbers, and underscores.';
          }

          const document = ctx.document;
          if (!document) return true;

          const client = ctx.getClient({ apiVersion: "2024-01-01" });

          const rawTenantId = (document as Record<string, unknown>)["tenantId"];
          const tenantId: string | null =
            typeof rawTenantId === "string" && rawTenantId.trim() !== ""
              ? rawTenantId.trim()
              : null;

          const baseId = document._id.replace(/^drafts\./, "");

          const conflictId = await client.fetch<string | null>(
            `*[
              _type == $type
              && key == $key
              && (
                ($tenantId == null && !defined(tenantId))
                || ($tenantId != null && tenantId == $tenantId)
              )
              && _id != $id
              && _id != "drafts." + $id
            ][0]._id`,
            {
              type:     document._type,
              key:      value,
              tenantId,
              id:       baseId,
            },
          );

          if (conflictId) {
            return tenantId
              ? `Key "${value}" already exists for tenant "${tenantId}". Choose a different key.`
              : `Shared key "${value}" already exists. Choose a different key or set a Tenant ID.`;
          }
          return true;
        }),
    }),

    // ── Locale ── (identity group) ────────────────────────────────────────────
    defineField({
      name:  "locale",
      title: "Locale",
      type:  "string",
      group: "identity",
      description:
        "Optional locale code (e.g. \"nl\" or \"de\"). " +
        "When set, this variant is returned in preference to the locale-neutral default " +
        "for visitors whose UI language matches. Leave blank for the EN / default version.",
      options: {
        list: [
          { title: "English (default — no locale)",  value: ""   },
          { title: "Nederlands (nl)",                value: "nl" },
          { title: "Deutsch (de)",                   value: "de" },
        ],
        layout: "radio",
      },
    }),

    // ── Active flag ── (identity group) ───────────────────────────────────────
    defineField({
      name:        "isActive",
      title:       "Active",
      type:        "boolean",
      group:       "identity",
      description:
        "Only active documents are returned by GROQ queries. " +
        "Deactivating a custom variant causes GROQ to fall back to the platform variant " +
        "(if one exists for the same key).",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),

    // ── Headline ── (content group) ───────────────────────────────────────────
    defineField({
      name:        "title",
      title:       "Headline",
      type:        "string",
      group:       "content",
      description: "Large display headline for the CTA section. Max 120 chars.",
      validation: (Rule) => Rule.required().max(120),
    }),

    // ── Supporting copy ── (content group) ───────────────────────────────────
    defineField({
      name:        "text",
      title:       "Supporting Copy",
      type:        "text",
      rows:        3,
      group:       "content",
      description: "Paragraph below the headline. 1–2 sentences. Max 300 chars.",
      validation: (Rule) => Rule.required().max(300),
    }),

    // ── CTAs ── (content group) ───────────────────────────────────────────────
    defineField({
      name:  "ctas",
      title: "Call-to-action buttons",
      type:  "array",
      group: "content",
      description:
        "1–2 CTA buttons displayed in the section. " +
        "First button is primary, second is secondary (unless variant is set).",
      of: [
        {
          type:  "object",
          name:  "ctaItem",
          title: "CTA",
          fields: [
            defineField({
              name:        "label",
              title:       "Label",
              type:        "string",
              description: "Button text. Keep short and action-oriented. Max 60 chars.",
              validation: (Rule) => Rule.required().max(60),
            }),
            defineField({
              name:  "href",
              title: "Destination",
              type:  "string",
              description:
                "Destination URL. Use a relative path (e.g. /contact) or an absolute URL.",
              validation: (Rule) =>
                Rule.required().custom((href) => {
                  if (!href) return "CTA destination is required.";
                  if (href.trim() === "") return "CTA destination cannot be blank.";
                  return true;
                }),
            }),
            defineField({
              name:  "variant",
              title: "Style variant",
              type:  "string",
              description:
                'Override the automatic style. Leave blank to use position-based default ' +
                '("primary" for first, "secondary" for second).',
              options: {
                list: [
                  { title: "Primary",   value: "primary"   },
                  { title: "Secondary", value: "secondary" },
                  { title: "Outline",   value: "outline"   },
                  { title: "Ghost",     value: "ghost"     },
                ],
                layout: "radio",
              },
            }),
          ],
          preview: {
            select: { label: "label", href: "href", variant: "variant" },
            prepare(selection: Record<string, string | undefined>) {
              const { label, href, variant } = selection;
              return {
                title:    label ?? "(no label)",
                subtitle: `${href ?? "(no href)"}${variant ? ` · ${variant}` : ""}`,
              };
            },
          },
        },
      ],
      validation: (Rule) => Rule.max(2).warning("Maximum 2 CTAs are rendered in the CTA block."),
    }),

    // ── Deprecated flat CTA fields (hidden) ── (content group) ───────────────
    defineField({
      name:        "ctaLabel",
      title:       "CTA Label (deprecated)",
      type:        "string",
      group:       "content",
      description: '⚠ Deprecated — use the "Call-to-action buttons" array above.',
      hidden:      true,
    }),

    defineField({
      name:        "ctaHref",
      title:       "CTA Destination (deprecated)",
      type:        "string",
      group:       "content",
      description: '⚠ Deprecated — use the "Call-to-action buttons" array above.',
      hidden:      true,
    }),

    // ── AI Decision Metadata ── (ai group) ────────────────────────────────────
    defineField({
      name:  "decisionMeta",
      title: "AI / Decision metadata",
      type:  "variantDecisionMeta",
      group: "ai",
      description:
        "Structured metadata the AI uses to decide whether to show this variant to a visitor. " +
        "Complete ALL required fields to enable AI-driven selection — readiness is derived " +
        "automatically from field completeness, no toggle needed. " +
        "Incomplete variants may still be used as a manual or rule-based fallback.",
    }),

    // ── Source tags ── (editorial group) ─────────────────────────────────────
    defineField({
      name:  "sourceTags",
      title: "Source Tags",
      type:  "array",
      group: "editorial",
      of: [{ type: "string" }],
      description: "Informational: traffic sources this variant is optimised for. Not used by queries.",
      options: {
        list: [
          { title: "Google Organic", value: "google-organic" },
          { title: "Google Paid",    value: "google-paid"    },
          { title: "LinkedIn",       value: "linkedin"       },
          { title: "Direct",         value: "direct"         },
          { title: "Referral",       value: "referral"       },
          { title: "Email",          value: "email"          },
        ],
        layout: "tags",
      },
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  //
  // AI readiness is derived from the 8 required decisionMeta field values.
  // No stored aiReady boolean is read — completeness is computed in prepare().
  preview: {
    select: {
      title:         "title",
      key:           "key",
      tenantId:      "tenantId",
      layoutVariant: "layoutVariant",
      active:        "isActive",
      // Required decisionMeta fields for completeness check
      dLabel:    "decisionMeta.decisionLabel",
      dSummary:  "decisionMeta.decisionSummary",
      dAudience: "decisionMeta.intendedAudience",
      dIntent:   "decisionMeta.intentLevel",
      dFunnel:   "decisionMeta.funnelStages",
      dSources:  "decisionMeta.bestForSources",
      dTone:     "decisionMeta.tone",
      dGoal:     "decisionMeta.primaryGoal",
    },
    prepare({ title, key, tenantId, layoutVariant, active,
              dLabel, dSummary, dAudience, dIntent, dFunnel, dSources, dTone, dGoal }) {
      const aiReady = Boolean(
        typeof dLabel    === "string" && dLabel.trim() &&
        typeof dSummary  === "string" && dSummary.trim() &&
        typeof dAudience === "string" && dAudience.trim() &&
        dIntent &&
        Array.isArray(dFunnel)  && (dFunnel  as unknown[]).length > 0 &&
        Array.isArray(dSources) && (dSources as unknown[]).length > 0 &&
        dTone &&
        typeof dGoal === "string" && dGoal.trim()
      );
      const tenantLabel = tenantId ? ` [${tenantId}]` : " [platform]";
      const layoutLabel =
        layoutVariant && layoutVariant !== "cta_banner"
          ? ` · ${layoutVariant.replace("cta_", "")}`
          : "";
      const aiLabel     = aiReady ? " · ✓ AI-ready" : " · ✗ AI not ready";
      const activeLabel = active === false ? " · ⚠ inactive" : "";
      return {
        title:    title ?? "(No headline)",
        subtitle: `${key ?? "(no key)"}${tenantLabel}${layoutLabel}${aiLabel}${activeLabel}`,
      };
    },
  },
});
