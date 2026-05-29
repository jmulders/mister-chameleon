/**
 * Sanity Schema — heroVariant
 *
 * Defines the content structure for an adaptive hero block variant.
 * One document per variant key. The decision engine selects the correct key
 * for each visitor; the CMS provider fetches the matching document.
 *
 * ─── Hero layout variants ─────────────────────────────────────────────────────
 *
 *   hero_default    Centred headline on dark brand background.  Optional media
 *                   (image / video) rendered below the CTA.
 *
 *   hero_split      50/50 two-column layout.  Text content on the left;
 *                   media panel (or decorative gradient) on the right.
 *
 *   hero_proof      Centred hero identical to default, plus a compact trust
 *                   metrics bar below the CTA.  Metrics are editable via the
 *                   `proofItems` field (only visible for this layout).
 *                   Optional media renders below the proof bar.
 *
 *   hero_background Full-viewport image/video background with a tint overlay.
 *                   Content (tag, title, subtitle, CTAs) overlays the media.
 *                   Horizontal alignment controlled by `contentAlign`
 *                   (only visible for this layout).
 *
 *   hero_page_banner Compact dark header for inner CMS pages (about, pricing,
 *                   blog, etc.).  Content-driven height (~160–240 px) — no
 *                   viewport clamp.  Uses h2 typography; no CTAs by default.
 *                   Set as the default hero slot for all CMS slug pages;
 *                   intentionally NOT overridden by the decision engine so each
 *                   page keeps its identifying banner regardless of visitor.
 *
 * ─── Studio tabs ─────────────────────────────────────────────────────────────
 *
 *   Content             — headline, subtitle, CTAs, media, proof bar items
 *   AI / Decision       — decisionMeta (audience, intent, goals, readiness gate)
 *   Identity & settings — tenant ID, variant key, layout, active flag
 *   Editorial tags      — sourceTags, stageTags
 *
 * ─── Custom vs platform variants ─────────────────────────────────────────────
 *
 *   Platform variant:  tenantId is blank.  Serves as fallback for all tenants.
 *   Custom variant:    tenantId set.  Overrides the platform variant for that
 *                      specific tenant only (GROQ resolution order).
 *
 * ─── Tenant-scoped identity ───────────────────────────────────────────────────
 *
 *   A variant is identified by the composite (tenantId, key) pair:
 *     • The same key (e.g. "hero_direct_brand") is reusable across tenants.
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
 *   layoutVariant string   One of 5 structural layouts. Default: hero_default.
 *   tenantId    string   Optional. Tenant owner slug, e.g. "workengine".
 *   key         string   Required. Business key, e.g. "hero_direct_brand".
 *   title       string   Required. Primary headline. ≤120 chars.
 *   subtitle    text     Required. Supporting paragraph. ≤300 chars.
 *   ctas        array    Preferred. 0–2 CTA objects { label, href, variant? }.
 *   ctaLabel    string   Deprecated. Hidden from editor.
 *   ctaHref     string   Deprecated. Hidden from editor.
 *   tag         string   Optional. Eyebrow badge above headline. ≤80 chars.
 *   proofItems  array    hero_proof only. Trust metrics bar items.
 *   media       object   Optional image/video.
 *   contentAlign string  hero_background only. left | center | right.
 *   sourceTags  array    Editorial taxonomy.
 *   stageTags   array    Editorial taxonomy.
 *   decisionMeta object  AI / decision metadata (aiReady gate + targeting fields).
 *   isActive    boolean  Required. Default: true.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name:  "heroVariant",
  title: "Hero Variant",
  type:  "document",

  // ── Field groups (Studio tabs) ─────────────────────────────────────────────
  //
  // Content is shown first (default) — that is what editors fill in most.
  // AI / Decision is the second tab — editors complete it once content is done.
  // Identity & settings and Editorial tags are utility tabs.
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
        "Structural layout of the hero block. " +
        "Content, media, and alignment are configured separately in the Content tab.",
      options: {
        list: [
          { title: "Default — centred headline on brand background",  value: "hero_default"     },
          { title: "Split — text left, media / gradient panel right", value: "hero_split"       },
          { title: "Proof — centered hero + trust metrics bar",       value: "hero_proof"       },
          { title: "Background — full-viewport image/video backdrop", value: "hero_background"  },
          { title: "Page banner — compact dark header for inner CMS pages", value: "hero_page_banner" },
        ],
        layout: "radio",
      },
      initialValue: "hero_default",
    }),

    // ── Tenant ── (identity group) ────────────────────────────────────────────
    //
    // Leave blank → platform variant (fallback for all tenants).
    // Set a value → custom variant that overrides the platform for that tenant.
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
        "version for that specific tenant only.  Custom variants editing happens here.",
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
        "Business key for this variant, e.g. \"hero_direct_brand\". " +
        "Use underscores, not spaces or hyphens. Must start with \"hero_\". " +
        "Unique within this Tenant ID — two tenants can independently use the same key.",
      validation: (Rule) =>
        Rule.required().custom(async (value, ctx) => {
          if (!value) return "Variant key is required.";
          if (!/^hero_[a-z][a-z0-9_]*$/.test(value)) {
            return 'Key must start with "hero_" and contain only lowercase letters, numbers, and underscores.';
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
    //
    // When set, this variant is preferred for visitors whose locale matches.
    // Leave blank for the default (EN / no-locale) version that serves as
    // the fallback for all locales that have no explicit translation.
    //
    // GROQ resolution order (highest priority wins):
    //   1. tenant-specific + locale match   (score 3)
    //   2. tenant-specific + no locale      (score 2)
    //   3. shared/platform + locale match   (score 1)
    //   4. shared/platform + no locale      (score 0)
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
        "(if one exists for the same key). Deactivating a platform variant hides it from " +
        "all tenants that rely on it as their fallback.",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),

    // ── Headline ── (content group) ───────────────────────────────────────────
    defineField({
      name:  "title",
      title: "Headline",
      type:  "string",
      group: "content",
      description: "Primary display headline. Target ≤80 chars for best visual fit. Max 120.",
      validation: (Rule) =>
        Rule.required().max(120).warning("Headlines over 80 characters may overflow on mobile."),
    }),

    // ── Subtitle ── (content group) ───────────────────────────────────────────
    defineField({
      name:  "subtitle",
      title: "Subtitle",
      type:  "text",
      rows:  3,
      group: "content",
      description: "Supporting paragraph below the headline. 1–2 sentences. Max 300 chars.",
      validation: (Rule) => Rule.required().max(300),
    }),

    // ── CTAs ── (content group) ───────────────────────────────────────────────
    defineField({
      name:  "ctas",
      title: "Call-to-action buttons",
      type:  "array",
      group: "content",
      description:
        "0–2 CTA buttons below the subtitle. " +
        "First button defaults to primary style; second defaults to secondary.",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "heroCta",
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
                'Destination URL. Use a relative path (e.g. "#signup", "/contact") or an absolute URL.',
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
                '("primary" for first button, "secondary" for second).',
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
        }),
      ],
      validation: (Rule) => Rule.max(2).warning("Maximum 2 CTAs are rendered in the hero."),
    }),

    // ── Legacy CTA fields (deprecated — hidden from editor) ── (content group) ─
    defineField({
      name:        "ctaLabel",
      title:       "CTA Label (deprecated)",
      type:        "string",
      group:       "content",
      description: '⚠ Deprecated — use the "Call-to-action buttons" array above.',
      hidden:      true,
      validation: (Rule) => Rule.max(60),
    }),

    defineField({
      name:        "ctaHref",
      title:       "CTA Destination (deprecated)",
      type:        "string",
      group:       "content",
      description: '⚠ Deprecated — use the "Call-to-action buttons" array above.',
      hidden:      true,
    }),

    // ── Eyebrow tag ── (content group) ───────────────────────────────────────
    defineField({
      name:        "tag",
      title:       "Eyebrow Tag",
      type:        "string",
      group:       "content",
      description: "Optional badge displayed above the headline. Max 80 chars. Leave blank to hide.",
      validation: (Rule) => Rule.max(80),
    }),

    // ── Proof bar items ── (content group) ───────────────────────────────────
    defineField({
      name:  "proofItems",
      title: "Proof Bar Items",
      type:  "array",
      group: "content",
      description:
        "Customise the trust metrics shown in the compact bar below the CTA buttons. " +
        "Leave empty to use the component's built-in defaults. " +
        "Only applies to the Proof layout — ignored by all other layouts.",
      hidden: ({ document }) =>
        (document as Record<string, unknown> | undefined)?.["layoutVariant"] !== "hero_proof",
      of: [
        defineArrayMember({
          type:  "object",
          name:  "proofItem",
          title: "Metric",
          fields: [
            defineField({
              name:        "metric",
              title:       "Metric Value",
              type:        "string",
              description: 'Bold value displayed at the top, e.g. "10,000+" or "99.9%".',
              validation: (Rule) => Rule.required().max(30),
            }),
            defineField({
              name:        "label",
              title:       "Metric Label",
              type:        "string",
              description: 'Descriptive label below the value, e.g. "customers" or "uptime SLA".',
              validation: (Rule) => Rule.required().max(60),
            }),
          ],
          preview: {
            select: { metric: "metric", label: "label" },
            prepare({ metric, label }: Record<string, string | undefined>) {
              return {
                title:    metric ?? "(no value)",
                subtitle: label  ?? "(no label)",
              };
            },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.max(6).warning("More than 6 proof items may overflow on small screens."),
    }),

    // ── Media ── (content group) ──────────────────────────────────────────────
    defineField({
      name:  "media",
      title: "Media",
      type:  "object",
      group: "content",
      description:
        "Optional image or video attachment. " +
        'Select "None" to show a text-only hero.',
      fields: [
        defineField({
          name:         "mediaType",
          title:        "Media type",
          type:         "string",
          initialValue: "none",
          options: {
            list: [
              { title: "None (text only)", value: "none"  },
              { title: "Image",            value: "image" },
              { title: "Video",            value: "video" },
            ],
            layout: "radio",
          },
          validation: (Rule) => Rule.required(),
        }),

        defineField({
          name:        "image",
          title:       "Image",
          type:        "image",
          description: "Upload the image asset.",
          options: { hotspot: true },
          fields: [
            defineField({
              name:  "alt",
              title: "Alt text",
              type:  "string",
              description:
                "Describe the image for screen readers and search engines. " +
                "Required when image is set.",
              validation: (Rule) =>
                Rule.custom((value, ctx) => {
                  const parent = ctx.parent as { mediaType?: string } | undefined;
                  if (parent?.mediaType === "image" && !value) {
                    return "Alt text is required for non-decorative images.";
                  }
                  return true;
                }),
            }),
          ],
          hidden: ({ parent }) =>
            (parent as { mediaType?: string } | undefined)?.mediaType !== "image",
        }),

        defineField({
          name:        "videoSource",
          title:       "Video source",
          type:        "string",
          description: "Where the video is hosted.",
          options: {
            list: [
              { title: "Upload (self-hosted file)", value: "upload"  },
              { title: "YouTube (video ID)",        value: "youtube" },
              { title: "Vimeo (video ID)",          value: "vimeo"   },
            ],
            layout: "radio",
          },
          hidden: ({ parent }) =>
            (parent as { mediaType?: string } | undefined)?.mediaType !== "video",
        }),

        defineField({
          name:        "videoFile",
          title:       "Video file",
          type:        "file",
          description: "Upload an MP4, WebM, or OGG video file.",
          options: { accept: "video/*" },
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:        "videoPoster",
          title:       "Poster image",
          type:        "image",
          description: "Optional. Shown before the video loads or while it buffers.",
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:        "videoAutoplay",
          title:       "Autoplay",
          type:        "boolean",
          description:
            "Play the video automatically on page load. " +
            "Requires Muted to be enabled — browsers block unmuted autoplay.",
          initialValue: false,
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:        "videoMuted",
          title:       "Muted",
          type:        "boolean",
          description: "Mute the audio track. Required for autoplay to work in most browsers.",
          initialValue: false,
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:        "videoLoop",
          title:       "Loop",
          type:        "boolean",
          description: "Loop the video continuously.",
          initialValue: false,
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:        "videoControls",
          title:       "Show controls",
          type:        "boolean",
          description: "Show native browser play / pause / seek controls.",
          initialValue: true,
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return p?.mediaType !== "video" || p?.videoSource !== "upload";
          },
        }),

        defineField({
          name:  "videoId",
          title: "Video ID",
          type:  "string",
          description:
            "YouTube: the 11-character ID from the video URL, e.g. dQw4w9WgXcQ. " +
            "Vimeo: the numeric ID from the video URL, e.g. 76979871.",
          validation: (Rule) =>
            Rule.custom((value, ctx) => {
              const p = ctx.parent as { mediaType?: string; videoSource?: string } | undefined;
              if (
                p?.mediaType === "video" &&
                (p?.videoSource === "youtube" || p?.videoSource === "vimeo") &&
                !value
              ) {
                return "Video ID is required.";
              }
              return true;
            }),
          hidden: ({ parent }) => {
            const p = parent as { mediaType?: string; videoSource?: string } | undefined;
            return (
              p?.mediaType !== "video" ||
              (p?.videoSource !== "youtube" && p?.videoSource !== "vimeo")
            );
          },
        }),
      ],
    }),

    // ── Content alignment ── (content group) ─────────────────────────────────
    defineField({
      name:  "contentAlign",
      title: "Content alignment",
      type:  "string",
      group: "content",
      description:
        "Horizontal alignment of the headline, subtitle, and CTA buttons over the background. " +
        "Only applies to the Background layout.",
      options: {
        list: [
          { title: "Left   — text and buttons flush left",  value: "left"   },
          { title: "Center — text and buttons centred",     value: "center" },
          { title: "Right  — text and buttons flush right", value: "right"  },
        ],
        layout: "radio",
      },
      initialValue: "center",
      hidden: ({ document }) =>
        (document as Record<string, unknown> | undefined)?.["layoutVariant"] !== "hero_background",
    }),

    // ── AI Decision Metadata ── (ai group) ────────────────────────────────────
    //
    // Complete all fields here to make this variant eligible for AI-driven
    // personalisation.  AI readiness is derived automatically from field
    // completeness — there is no "AI-ready" toggle to set manually.
    //
    // Custom variants (tenantId set) are fully editable here.
    // Platform variants (no tenantId) are shared and affect all tenants
    // that have no matching custom override.
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
      description:
        "Informational: record which traffic sources this variant is optimised for. " +
        "Used for editorial filtering in Studio only — not consumed by the decision engine.",
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

    defineField({
      name:  "stageTags",
      title: "Stage Tags",
      type:  "array",
      group: "editorial",
      of: [{ type: "string" }],
      description:
        "Informational: record which buyer journey stages this variant targets. " +
        "Used for editorial filtering in Studio only.",
      options: {
        list: [
          { title: "Awareness",     value: "awareness"     },
          { title: "Consideration", value: "consideration" },
          { title: "Decision",      value: "decision"      },
          { title: "Retention",     value: "retention"     },
        ],
        layout: "tags",
      },
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  //
  // Shows: headline · key [tenantId / platform] · AI ready / not ready · inactive
  //
  // This makes the document list immediately scannable:
  //   editors can spot custom vs platform variants and AI readiness at a glance.
  // ── Studio preview ──────────────────────────────────────────────────────────
  //
  // AI readiness is derived from the 8 required decisionMeta field values.
  // No stored aiReady boolean is read — completeness is computed in prepare().
  preview: {
    select: {
      title:         "title",
      key:           "key",
      tenantId:      "tenantId",
      active:        "isActive",
      layoutVariant: "layoutVariant",
      contentAlign:  "contentAlign",
      // Required decisionMeta fields — all 8 needed for completeness check
      dLabel:    "decisionMeta.decisionLabel",
      dSummary:  "decisionMeta.decisionSummary",
      dAudience: "decisionMeta.intendedAudience",
      dIntent:   "decisionMeta.intentLevel",
      dFunnel:   "decisionMeta.funnelStages",
      dSources:  "decisionMeta.bestForSources",
      dTone:     "decisionMeta.tone",
      dGoal:     "decisionMeta.primaryGoal",
    },
    prepare({ title, key, tenantId, active, layoutVariant, contentAlign,
              dLabel, dSummary, dAudience, dIntent, dFunnel, dSources, dTone, dGoal }) {
      // Derive AI readiness the same way isMetaComplete() does at runtime
      const aiReady = Boolean(
        typeof dLabel    === "string" && dLabel.trim() &&
        typeof dSummary  === "string" && dSummary.trim() &&
        typeof dAudience === "string" && dAudience.trim() &&
        dIntent &&
        Array.isArray(dFunnel)   && (dFunnel   as unknown[]).length > 0 &&
        Array.isArray(dSources)  && (dSources  as unknown[]).length > 0 &&
        dTone &&
        typeof dGoal === "string" && dGoal.trim()
      );
      const tenantLabel = tenantId ? ` [${tenantId}]` : " [platform]";
      const layoutShort = layoutVariant ? ` · ${layoutVariant.replace("hero_", "")}` : "";
      const alignLabel  =
        layoutVariant === "hero_background" && contentAlign && contentAlign !== "center"
          ? ` · ${contentAlign}`
          : "";
      const aiLabel     = aiReady ? " · ✓ AI-ready" : " · ✗ AI not ready";
      const activeLabel = active === false ? " · ⚠ inactive" : "";
      return {
        title:    title ?? "(No headline)",
        subtitle: `${key ?? "(no key)"}${tenantLabel}${layoutShort}${alignLabel}${aiLabel}${activeLabel}`,
      };
    },
  },
});
