/**
 * Sanity Schema — formSection (object)
 *
 * Places a form on a page.  Supports two source modes:
 *
 *   Platform form  — set formKey to one of the platform-registered keys
 *                    (e.g. "contact", "application").  Field definitions and
 *                    routing are resolved platform-side from the code registry.
 *
 *   CMS form       — set formDefinitionRef to reference a formDefinition CMS
 *                    document.  Field definitions, validation, and email
 *                    behaviour are all resolved from the CMS at runtime.
 *
 * Exactly one of formKey or formDefinitionRef should be set.
 * When formDefinitionRef is set it takes precedence over formKey.
 *
 * Layout and copy overrides are independent of the source mode.
 */
import { defineField, defineType } from "sanity";

export default defineType({
  name: "formSection",
  title: "Form",
  type: "object",
  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls how the form section is visually wrapped.",
      options: {
        list: [
          { title: "Inline — subtle background, border separator (default)", value: "form_inline" },
          { title: "Split — intro / heading left, form right",               value: "form_split" },
          { title: "Panel — form inside an elevated card container",         value: "form_panel" },
          // Legacy aliases kept for backward compatibility
          { title: "Default (alias → inline)",                               value: "default" },
          { title: "Card (alias → panel)",                                   value: "card" },
          { title: "Minimal — bare form, no section wrapper",               value: "minimal" },
        ],
      },
      initialValue: "form_inline",
    }),

    // ── Form source: CMS-defined form definition (preferred) ────────────────────
    defineField({
      name: "formDefinitionRef",
      title: "CMS Form Definition",
      type: "reference",
      to: [{ type: "formDefinition" }],
      description:
        "Reference a CMS-managed formDefinition document. " +
        "When set this takes precedence over the Form Key field below. " +
        "The form fields, validation, and email actions are all controlled in the CMS.",
    }),

    // ── Form source: platform-registered key (legacy / fallback) ────────────────
    defineField({
      name: "formKey",
      title: "Form Key",
      type: "string",
      description:
        'Platform-registered FormKey (e.g. "contact", "application"). ' +
        "Use this for platform-defined forms. " +
        "Leave blank when using a CMS Form Definition above.",
    }),
    defineField({
      name: "title",
      title: "Title Override",
      type: "string",
      description: "Optional heading displayed above the form fields. Overrides the form default.",
    }),
    defineField({
      name: "intro",
      title: "Intro Copy",
      type: "text",
      rows: 3,
      description: "Optional introductory paragraph below the title.",
    }),
    defineField({
      name: "submitLabel",
      title: "Submit Button Label",
      type: "string",
      description: "Override the default submit button label.",
    }),
    defineField({
      name: "successMessage",
      title: "Success Message",
      type: "text",
      rows: 2,
      description: "Override the message shown after successful submission.",
    }),
  ],
  preview: {
    select: { title: "formKey", subtitle: "title" },
    prepare({ title, subtitle }) {
      return {
        title:    subtitle ?? "(No title)",
        subtitle: `Form · key: ${title ?? "(unset)"}`,
      };
    },
  },
});
