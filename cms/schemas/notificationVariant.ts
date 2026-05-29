/**
 * Sanity Schema — notificationVariant
 *
 * Defines the content structure for a notification banner/toast variant.
 * One document per variant key. The decision engine selects the correct key
 * for each visitor; the CMS provider fetches the matching document.
 *
 * ─── Notification positions ───────────────────────────────────────────────────
 *
 *   top            Full-width banner pinned to the top of the viewport.
 *   bottom-right   Toast anchored to the bottom-right corner.
 *
 * ─── Studio tabs ─────────────────────────────────────────────────────────────
 *
 *   Content             — message, severity, CTA, display behaviour
 *   Identity & settings — tenant ID, variant key, active flag
 *
 * ─── Custom vs platform variants ─────────────────────────────────────────────
 *
 *   Platform variant:  tenantId is blank.  Serves as fallback for all tenants.
 *   Custom variant:    tenantId set.  Overrides the platform variant for that
 *                      specific tenant only (GROQ resolution order).
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   key            string   Required. Unique variant identifier, e.g. "notification_default".
 *   tenantId       string   Optional. Tenant owner slug, e.g. "workengine".
 *   message        text     Required. Notification body text. Max 300 chars.
 *   severity       string   Required. One of: info | success | warning | promo.
 *   ctaLabel       string   Optional. CTA button label. Max 60 chars.
 *   ctaHref        string   Optional. CTA destination URL.
 *   position       string   Required. top | bottom-right. Default: top.
 *   dismissible    boolean  Required. Whether the user can dismiss. Default: true.
 *   autoDismissMs  number   Auto-dismiss delay in ms. 0 = never. Default: 0.
 *   isActive       boolean  Required. Only active documents are returned.
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name:  "notificationVariant",
  title: "Notification Variant",
  type:  "document",

  // ── Field groups (Studio tabs) ─────────────────────────────────────────────
  groups: [
    {
      name:    "content",
      title:   "Content",
      default: true,
    },
    {
      name:  "identity",
      title: "Identity & settings",
    },
  ],

  fields: [

    // ── Identity & settings ── ─────────────────────────────────────────────────

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
        "version for that specific tenant only.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    defineField({
      name:  "key",
      title: "Variant Key",
      type:  "string",
      group: "identity",
      description:
        "Business key for this variant, e.g. \"notification_default\". " +
        "Use underscores, not spaces or hyphens. Must start with \"notification_\". " +
        "Unique within this Tenant ID.",
      validation: (Rule) =>
        Rule.required().custom(async (value, ctx) => {
          if (!value) return "Variant key is required.";
          if (!/^notification_[a-z][a-z0-9_]*$/.test(value)) {
            return 'Key must start with "notification_" and contain only lowercase letters, numbers, and underscores.';
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

    defineField({
      name:        "isActive",
      title:       "Active",
      type:        "boolean",
      group:       "identity",
      description:
        "Only active documents are returned by GROQ queries. " +
        "Deactivating a variant hides the notification immediately.",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),

    // ── Content ──────────────────────────────────────────────────────────────

    defineField({
      name:  "message",
      title: "Message",
      type:  "text",
      rows:  3,
      group: "content",
      description:
        "The notification body text displayed to the visitor. Max 300 characters.",
      validation: (Rule) => Rule.required().max(300),
    }),

    defineField({
      name:  "severity",
      title: "Severity",
      type:  "string",
      group: "content",
      description:
        "Visual style of the notification. " +
        "info = neutral blue  ·  success = green  ·  warning = amber  ·  promo = brand accent.",
      options: {
        list: [
          { title: "Info — neutral informational",    value: "info"    },
          { title: "Success — positive confirmation", value: "success" },
          { title: "Warning — caution or alert",      value: "warning" },
          { title: "Promo — promotional / brand",     value: "promo"   },
        ],
        layout: "radio",
      },
      initialValue: "info",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name:  "ctaLabel",
      title: "CTA Label",
      type:  "string",
      group: "content",
      description:
        "Optional. Button label shown inside the notification. Leave blank to hide the CTA. Max 60 chars.",
      validation: (Rule) => Rule.max(60),
    }),

    defineField({
      name:  "ctaHref",
      title: "CTA Destination",
      type:  "string",
      group: "content",
      description:
        "Optional. Destination URL for the CTA button. " +
        'Use a relative path (e.g. "/pricing") or an absolute URL.',
      hidden: ({ document }) => !document?.ctaLabel,
    }),

    defineField({
      name:  "position",
      title: "Position",
      type:  "string",
      group: "content",
      description:
        "Where the notification appears on screen.",
      options: {
        list: [
          { title: "Top — full-width banner at the top of the viewport", value: "top"          },
          { title: "Bottom-right — toast anchored to the corner",         value: "bottom-right" },
        ],
        layout: "radio",
      },
      initialValue: "top",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name:        "dismissible",
      title:       "Dismissible",
      type:        "boolean",
      group:       "content",
      description: "When enabled, visitors can close the notification manually.",
      initialValue: true,
    }),

    defineField({
      name:  "autoDismissMs",
      title: "Auto-dismiss delay (ms)",
      type:  "number",
      group: "content",
      description:
        "How long (in milliseconds) before the notification auto-dismisses. " +
        "Set to 0 to never auto-dismiss. E.g. 5000 = 5 seconds.",
      initialValue: 0,
      validation: (Rule) =>
        Rule.required().min(0).integer()
          .warning("Values between 1 and 999 are very short — consider 3000 ms (3 seconds) or more."),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      message:   "message",
      key:       "key",
      tenantId:  "tenantId",
      severity:  "severity",
      position:  "position",
      active:    "isActive",
    },
    prepare({ message, key, tenantId, severity, position, active }) {
      const tenantLabel  = tenantId ? ` [${tenantId}]` : " [platform]";
      const activeLabel  = active === false ? " · ⚠ inactive" : "";
      const severityIcon =
        severity === "success" ? "✅" :
        severity === "warning" ? "⚠️" :
        severity === "promo"   ? "🎉" : "ℹ️";
      return {
        title:    `${severityIcon} ${message ?? "(no message)"}`,
        subtitle: `${key ?? "(no key)"}${tenantLabel} · ${position ?? "top"}${activeLabel}`,
      };
    },
  },
});
