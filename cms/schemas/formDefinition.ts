/**
 * Sanity Schema — formDefinition
 *
 * A FormDefinition is a standalone CMS document that defines a reusable form:
 * its field structure, success behaviour, and email actions.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   The platform controls mail transport (SMTP credentials / Resend key).
 *   The CMS controls form structure, field definitions, and email behaviour.
 *
 *   formDefinition (CMS)  →  formSection block on a page (CMS)
 *        ↓                         ↓
 *   Loaded at runtime by    References form by name or Sanity document ref
 *   /api/forms/[name]       (formDefinitionRef field in formSection schema)
 *
 * ─── Form key / name ──────────────────────────────────────────────────────────
 *
 *   The `name` field is a URL-safe slug that identifies the form for the API.
 *   Submissions are POSTed to /api/forms/[name].  The name must be unique
 *   within the tenant.
 *
 *   Platform-registered forms (contact, application, appointment) share the
 *   same API route but are resolved from the platform registry first.
 *   CMS-defined forms with names that do NOT match a platform key are looked up
 *   from Sanity at runtime.
 *
 * ─── Template variables ───────────────────────────────────────────────────────
 *
 *   The email action templates support {{key}} placeholders.
 *   Any field key defined in the fields array is valid (e.g. {{email}}, {{naam}}).
 *   System variables are also available:
 *     {{formName}}     — this form's name
 *     {{submittedAt}}  — UTC timestamp of submission
 *     {{tenantName}}   — tenant display name
 *
 * ─── Multi-tenancy ────────────────────────────────────────────────────────────
 *
 *   tenantId is optional.  When set, the form is scoped to a specific tenant.
 *   When absent, the form is shared across all tenants (useful for platform-
 *   wide forms or testing).
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId         string          Optional tenant owner.
 *   name             string (slug)   Required. Form key for the API route.
 *   title            string          Required. Human-readable display name.
 *   successMessage   text            Message shown after successful submission.
 *   successRedirectUrl url           Optional redirect instead of message.
 *   storeSubmissions boolean         Whether to write to form_submissions table.
 *   fields           formFieldDef[]  Ordered field definitions.
 *   emailActions     emailAction[]   Email actions to trigger on submission.
 *   isActive         boolean         Only active forms are loaded at runtime.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "formDefinition",
  title: "Form Definition",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this form definition, e.g. \"workengine\". " +
        "Leave blank for shared / platform-level forms.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Name / key ─────────────────────────────────────────────────────────────
    defineField({
      name: "name",
      title: "Form Name (Key)",
      type: "slug",
      description:
        "URL-safe identifier used in the API route: /api/forms/[name]. " +
        "Must be unique within the tenant. " +
        "Use descriptive slugs like \"contact-form\", \"aanvraag-formulier\".",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),

    // ── Title ──────────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Human-readable name for this form (used in the Studio and in email templates as {{formName}}).",
      validation: (Rule) => Rule.required().max(100),
    }),

    // ── Active ─────────────────────────────────────────────────────────────────
    defineField({
      name: "isActive",
      title: "Active",
      type: "boolean",
      description: "Only active form definitions are returned by the API. Disable to retire a form without deleting it.",
      initialValue: true,
    }),

    // ── Success behaviour ──────────────────────────────────────────────────────
    defineField({
      name: "successMessage",
      title: "Success Message",
      type: "text",
      rows: 3,
      description:
        "Message shown to the submitter after a successful submission. " +
        "Supports template variables, e.g. \"Thank you {{naam}}, we will be in touch.\"",
    }),

    defineField({
      name: "successRedirectUrl",
      title: "Success Redirect URL",
      type: "url",
      description:
        "Optional redirect URL after submission. When set, the form block navigates " +
        "here instead of showing the inline success message. " +
        "Must be an absolute URL (https://…) or root-relative path (/bedankt).",
    }),

    // ── Store submissions ──────────────────────────────────────────────────────
    defineField({
      name: "storeSubmissions",
      title: "Store Submissions in Database",
      type: "boolean",
      description:
        "Whether to write a row to the form_submissions table on each submission. " +
        "Useful for reviewing submissions in the admin. " +
        "Email and webhook actions still fire even when this is off.",
      initialValue: true,
    }),

    // ── Fields ─────────────────────────────────────────────────────────────────
    defineField({
      name: "fields",
      title: "Form Fields",
      type: "array",
      description: "Ordered list of fields. Drag to reorder. At least one field is required.",
      of: [defineArrayMember({ type: "formFieldDef" })],
      validation: (Rule) => Rule.required().min(1),
    }),

    // ── Email actions ──────────────────────────────────────────────────────────
    defineField({
      name: "emailActions",
      title: "Email Actions",
      type: "array",
      description:
        "Email actions triggered on every successful submission. " +
        "Add up to one confirmation action (to submitter) and one backoffice action (to team). " +
        "Both are optional.",
      of: [defineArrayMember({ type: "emailAction" })],
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:    "title",
      name:     "name",
      active:   "isActive",
      tenantId: "tenantId",
    },
    prepare({ title, name, active, tenantId }) {
      const slug   = name && typeof name === "object" && "current" in name
        ? (name as { current: string }).current
        : (name ?? "—");
      const state  = active === false ? " · INACTIVE" : "";
      const tenant = tenantId ? ` (${tenantId})` : "";
      return {
        title:    `${title ?? "(Untitled form)"}${state}`,
        subtitle: `/api/forms/${slug}${tenant}`,
      };
    },
  },
});
