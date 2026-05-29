/**
 * Sanity Schema — emailAction (object)
 *
 * Defines a single email action within a CMS-managed form definition.
 * Used as a member of formDefinition.emailActions[].
 *
 * ─── Action types ─────────────────────────────────────────────────────────────
 *
 *   confirmation  — Thank-you email sent to the person who submitted the form.
 *                   Recipient is the value of the field specified by recipientField
 *                   (typically the "email" field).
 *
 *   backoffice    — Internal notification sent to a fixed address or list.
 *                   Recipient can be a fixed email, comma-separated list,
 *                   or a field reference like {{email}} when recipientType
 *                   is set to "field".
 *
 * ─── Template variables ───────────────────────────────────────────────────────
 *
 *   Use {{key}} placeholders in subject and body to insert submitted field values
 *   or system variables:
 *
 *   Submitted field values:
 *     {{email}}, {{naam}}, {{telefoonnummer}}, etc. (any field key in the form)
 *
 *   System variables (always available):
 *     {{formName}}      — internal name of the form definition
 *     {{submittedAt}}   — UTC submission timestamp (e.g. "Mon, 06 Apr 2026 09:00:00 GMT")
 *     {{tenantName}}    — display name of the receiving tenant
 *
 * ─── Content format ───────────────────────────────────────────────────────────
 *
 *   text  — plain-text only (default, always works)
 *   html  — HTML-formatted body (use <br> for line breaks)
 *   both  — send both text and HTML parts; clients prefer HTML
 */

import { defineField, defineType } from "sanity";

export default defineType({
  name: "emailAction",
  title: "Email Action",
  type: "object",

  fields: [
    // ── Action type ────────────────────────────────────────────────────────────
    defineField({
      name: "actionType",
      title: "Action Type",
      type: "string",
      description: "Whether this email is sent to the submitter (confirmation) or to the team (backoffice).",
      options: {
        list: [
          {
            title: "Confirmation — thank-you email to the person who submitted",
            value: "confirmation",
          },
          {
            title: "Backoffice — internal notification to the team",
            value: "backoffice",
          },
        ],
        layout: "radio",
      },
      initialValue: "backoffice",
      validation: (Rule) => Rule.required(),
    }),

    // ── Enabled ────────────────────────────────────────────────────────────────
    defineField({
      name: "enabled",
      title: "Enabled",
      type: "boolean",
      description: "Toggle this action on/off without deleting its configuration.",
      initialValue: true,
    }),

    // ── Recipient type ─────────────────────────────────────────────────────────
    defineField({
      name: "recipientType",
      title: "Recipient Type",
      type: "string",
      description:
        "How the recipient address is resolved. " +
        "\"Fixed\" = a static email address or comma-separated list. " +
        "\"Field\" = read the address from a submitted field (e.g. {{email}}). " +
        "For confirmation emails, select \"Field\" and set recipient to {{email}}.",
      options: {
        list: [
          { title: "Fixed email address (e.g. hello@example.com)", value: "fixed" },
          { title: "From submitted field (e.g. {{email}})",        value: "field" },
        ],
        layout: "radio",
      },
      initialValue: "fixed",
      validation: (Rule) => Rule.required(),
    }),

    // ── Recipient ──────────────────────────────────────────────────────────────
    defineField({
      name: "recipient",
      title: "Recipient",
      type: "string",
      description:
        "For \"fixed\": one or more email addresses separated by commas. " +
        "For \"field\": a template variable referencing an email field, e.g. {{email}}.",
      validation: (Rule) => Rule.required().max(500),
    }),

    // ── Subject ────────────────────────────────────────────────────────────────
    defineField({
      name: "subject",
      title: "Subject",
      type: "string",
      description:
        "Email subject line. Supports template variables, e.g. " +
        "\"New message from {{naam}}\" or \"Thank you for your message, {{naam}}\".",
      validation: (Rule) => Rule.required().max(200),
    }),

    // ── Body ───────────────────────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Body",
      type: "text",
      rows: 8,
      description:
        "Email body content. Supports template variables. " +
        "For backoffice notifications, leave blank to use an auto-generated " +
        "summary of all submitted field values. " +
        "For HTML format, use <br> for line breaks and basic HTML tags.",
    }),

    // ── Content format ─────────────────────────────────────────────────────────
    defineField({
      name: "contentFormat",
      title: "Content Format",
      type: "string",
      description:
        "Whether to send the email as plain text, HTML, or both. " +
        "\"Both\" sends a multipart email — email clients prefer HTML but " +
        "fall back to text.",
      options: {
        list: [
          { title: "Plain text (default)",     value: "text" },
          { title: "HTML",                     value: "html" },
          { title: "Both (text + HTML parts)", value: "both" },
        ],
        layout: "dropdown",
      },
      initialValue: "text",
    }),

    // ── Reply-To ───────────────────────────────────────────────────────────────
    defineField({
      name: "replyTo",
      title: "Reply-To",
      type: "string",
      description:
        "Optional Reply-To address or field reference (e.g. {{email}}). " +
        "Useful for backoffice notifications so the team can reply directly " +
        "to the submitter.",
    }),
  ],

  preview: {
    select: {
      actionType: "actionType",
      enabled:    "enabled",
      subject:    "subject",
      recipient:  "recipient",
    },
    prepare({ actionType, enabled, subject, recipient }) {
      const type  = actionType === "confirmation" ? "Confirmation" : "Backoffice";
      const state = enabled === false ? " · DISABLED" : "";
      return {
        title:    `${type}${state}`,
        subtitle: `${subject ?? "(no subject)"} → ${recipient ?? "(no recipient)"}`,
      };
    },
  },
});
