/**
 * Sanity Schema — formFieldDef (object)
 *
 * Defines a single field within a CMS-managed form definition.
 * Used as a member of formDefinition.fields[].
 *
 * ─── Supported field types ────────────────────────────────────────────────────
 *
 *   text      — single-line text input
 *   email     — email address (auto-validates format)
 *   tel       — telephone number
 *   textarea  — multi-line text
 *   select    — dropdown (requires options array)
 *   radio     — radio group (requires options array)
 *   checkbox  — single boolean checkbox (e.g. newsletter opt-in)
 *   number    — numeric input
 *   date      — date picker
 *   hidden    — carries a static preset value, never rendered
 *   consent   — GDPR / terms consent checkbox (required by default)
 *
 * ─── Template variable reference ─────────────────────────────────────────────
 *
 *   The `key` field value (e.g. "email", "naam", "telefoonnummer") is what
 *   gets referenced in email action templates as {{email}}, {{naam}}, etc.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

const FIELD_TYPES = [
  { title: "Text",     value: "text"     },
  { title: "Email",    value: "email"    },
  { title: "Tel",      value: "tel"      },
  { title: "Textarea", value: "textarea" },
  { title: "Select",   value: "select"   },
  { title: "Radio",    value: "radio"    },
  { title: "Checkbox", value: "checkbox" },
  { title: "Number",   value: "number"   },
  { title: "Date",     value: "date"     },
  { title: "Hidden",   value: "hidden"   },
  { title: "Consent",  value: "consent"  },
];

export default defineType({
  name: "formFieldDef",
  title: "Form Field",
  type: "object",

  fields: [
    // ── Key (field name) ────────────────────────────────────────────────────────
    defineField({
      name: "key",
      title: "Field Key",
      type: "string",
      description:
        "Unique identifier for this field within the form. " +
        "Used as the submission key and in email templates as {{key}}. " +
        "Lowercase, no spaces (e.g. \"naam\", \"email\", \"telefoonnummer\").",
      validation: (Rule) =>
        Rule.required()
          .regex(/^[a-z][a-zA-Z0-9_]*$/)
          .error("Key must start with a lowercase letter and contain only letters, digits, and underscores."),
    }),

    // ── Label ──────────────────────────────────────────────────────────────────
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description: "The visible label shown above the field in the form.",
      validation: (Rule) => Rule.required().max(120),
    }),

    // ── Field type ─────────────────────────────────────────────────────────────
    defineField({
      name: "type",
      title: "Field Type",
      type: "string",
      options: { list: FIELD_TYPES, layout: "dropdown" },
      initialValue: "text",
      validation: (Rule) => Rule.required(),
    }),

    // ── Required ───────────────────────────────────────────────────────────────
    defineField({
      name: "required",
      title: "Required",
      type: "boolean",
      description: "Whether submitting without a value triggers a validation error.",
      initialValue: false,
    }),

    // ── Placeholder ────────────────────────────────────────────────────────────
    defineField({
      name: "placeholder",
      title: "Placeholder",
      type: "string",
      description: "Hint text shown inside the empty input. Not shown for select/radio.",
    }),

    // ── Help text ──────────────────────────────────────────────────────────────
    defineField({
      name: "helpText",
      title: "Help Text",
      type: "text",
      rows: 2,
      description: "Optional explanatory text shown below the field.",
    }),

    // ── Default value ──────────────────────────────────────────────────────────
    defineField({
      name: "defaultValue",
      title: "Default / Hidden Value",
      type: "string",
      description:
        "Pre-filled value. For hidden fields this is the static value sent with the submission.",
    }),

    // ── Options (select / radio) ───────────────────────────────────────────────
    defineField({
      name: "options",
      title: "Options",
      type: "array",
      description: "Required for select and radio field types.",
      of: [
        defineArrayMember({
          type: "object",
          name: "option",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: "Visible text shown to the user.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              description: "The value stored in the submission.",
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
            prepare: ({ title, subtitle }) => ({
              title:    title ?? "(no label)",
              subtitle: subtitle ?? "(no value)",
            }),
          },
        }),
      ],
    }),

    // ── Validation rules ───────────────────────────────────────────────────────
    defineField({
      name: "validation",
      title: "Validation",
      type: "object",
      description: "Optional extra validation rules for this field.",
      fields: [
        defineField({
          name: "minLength",
          title: "Min length",
          type: "number",
          description: "Minimum number of characters required.",
        }),
        defineField({
          name: "maxLength",
          title: "Max length",
          type: "number",
          description: "Maximum number of characters allowed.",
        }),
        defineField({
          name: "pattern",
          title: "Regex pattern",
          type: "string",
          description: "RegExp source string (no delimiters). Value must match.",
        }),
        defineField({
          name: "patternMessage",
          title: "Pattern error message",
          type: "string",
          description: "Error shown when the pattern does not match.",
        }),
      ],
    }),
  ],

  preview: {
    select: {
      title:    "label",
      subtitle: "key",
      type:     "type",
      required: "required",
    },
    prepare({ title, subtitle, type, required }) {
      const req = required ? " *" : "";
      return {
        title:    `${title ?? "(no label)"}${req}`,
        subtitle: `${type ?? "text"} · key: ${subtitle ?? "(unset)"}`,
      };
    },
  },
});
