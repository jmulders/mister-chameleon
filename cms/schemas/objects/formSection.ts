/**
 * Sanity Schema — formSection (object)
 *
 * Places a platform-registered form on a page by its formKey.
 * All field definitions, validation, and submission routing are resolved
 * platform-side from the FormDefinition — the CMS carries only placement
 * config and optional copy overrides.  Layout logic lives in the block
 * component, not here.
 */
import { defineField, defineType } from "sanity";

export default defineType({
  name: "formSection",
  title: "Form",
  type: "object",
  fields: [
    defineField({
      name: "formKey",
      title: "Form Key",
      type: "string",
      description: 'The platform-registered FormKey to render (e.g. "contact", "application").',
      validation: (Rule) => Rule.required(),
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
