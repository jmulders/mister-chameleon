/**
 * Sanity Schema — proofVariant
 *
 * Defines the content structure for an adaptive social proof block variant.
 * Each document contains a section heading and an array of proof items
 * (metric + supporting copy).
 *
 * ─── Studio tabs ─────────────────────────────────────────────────────────────
 *
 *   Content             — section heading, proof items
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
 *   proof_cases     ROI-focused evidence — case study numbers and outcomes.
 *   proof_vision    Industry recognition — analyst perspectives, awards.
 *   proof_platform  Technical reliability — scale, uptime, integration breadth.
 *
 * ─── Tenant-scoped identity ───────────────────────────────────────────────────
 *
 *   A variant is identified by the composite (tenantId, key) pair:
 *     • The same key (e.g. "proof_cases") is reusable across tenants.
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
 *   tenantId    string            Optional. Tenant owner slug, e.g. "workengine".
 *   key         string            Required. Business key, e.g. "proof_cases".
 *   title       string            Required. Section heading. ≤120 chars.
 *   items       array[proofItem]  Required. 3 items recommended.
 *   sourceTags  array             Optional. Editorial taxonomy.
 *   decisionMeta object           AI / decision metadata (aiReady gate + targeting fields).
 *   isActive    boolean           Required. Default: true.
 *
 * ─── proofItem fields ─────────────────────────────────────────────────────────
 *
 *   title   string  Required. Bold metric or label. e.g. "3.2× more leads". ≤80 chars.
 *   text    text    Required. 1–2 sentences of supporting copy. ≤300 chars.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name:  "proofVariant",
  title: "Proof Variant",
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
        "Controls the structural layout of the proof block. " +
        "The content (heading, items) is the same regardless of layout.",
      options: {
        list: [
          { title: "Stats — headline metric row (default)", value: "proof_stats"  },
          { title: "Logos — client/partner logo strip",     value: "proof_logos"  },
          { title: "Quotes — grid of testimonial cards",    value: "proof_quotes" },
        ],
      },
      initialValue: "proof_stats",
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
        "Business key for this variant, e.g. \"proof_cases\". " +
        "Use underscores, not spaces or hyphens. Must start with \"proof_\". " +
        "Unique within this Tenant ID — two tenants can independently use the same key.",
      validation: (Rule) =>
        Rule.required().custom(async (value, ctx) => {
          if (!value) return "Variant key is required.";
          if (!/^proof_[a-z][a-z0-9_]*$/.test(value)) {
            return 'Key must start with "proof_" and contain only lowercase letters, numbers, and underscores.';
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

    // ── Section heading ── (content group) ───────────────────────────────────
    defineField({
      name:        "title",
      title:       "Section Heading",
      type:        "string",
      group:       "content",
      description: "Heading displayed above the proof items. Max 120 chars.",
      validation: (Rule) => Rule.required().max(120),
    }),

    // ── Proof items ── (content group) ───────────────────────────────────────
    defineField({
      name:  "items",
      title: "Proof Items",
      type:  "array",
      group: "content",
      description: "3 items recommended. Each item shows a bold metric and 1–2 lines of support copy.",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "proofItem",
          title: "Proof Item",
          fields: [
            defineField({
              name:        "title",
              title:       "Metric / Label",
              type:        "string",
              description: 'Bold figure or label. e.g. "3.2× more leads" or "99.9% uptime". Max 80 chars.',
              validation: (Rule) => Rule.required().max(80),
            }),
            defineField({
              name:        "text",
              title:       "Supporting Copy",
              type:        "text",
              rows:        2,
              description: "1–2 sentences expanding on the metric. Max 300 chars.",
              validation: (Rule) => Rule.required().max(300),
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "text" },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .max(6)
          .warning("3 proof items is the recommended layout. More than 6 may overflow."),
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
      title:    "title",
      key:      "key",
      tenantId: "tenantId",
      active:   "isActive",
      items:    "items",
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
    prepare({ title, key, tenantId, active, items,
              dLabel, dSummary, dAudience, dIntent, dFunnel, dSources, dTone, dGoal }) {
      const count   = Array.isArray(items) ? items.length : 0;
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
      const aiLabel     = aiReady ? " · ✓ AI-ready" : " · ✗ AI not ready";
      const activeLabel = active === false ? " · ⚠ inactive" : "";
      return {
        title:    title ?? "(No heading)",
        subtitle: `${key ?? "(no key)"}${tenantLabel} · ${count} item${count !== 1 ? "s" : ""}${aiLabel}${activeLabel}`,
      };
    },
  },
});
