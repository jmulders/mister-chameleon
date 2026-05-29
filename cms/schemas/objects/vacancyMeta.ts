/**
 * Sanity Schema — vacancyMeta (object)
 *
 * Structured metadata header for a vacancy detail page.
 * Contains job details: title, location, contract type, hours, salary, dates.
 * No layout logic — the block component controls presentation.
 *
 * On entity-assembled pages (Vacancy → PageData) this block is populated
 * automatically by the entity-page assembler.  CMS authors may also place it
 * manually when hand-crafting vacancy pages.
 */
import { defineField, defineType } from "sanity";

export default defineType({
  name: "vacancyMeta",
  title: "Vacancy Meta",
  type: "object",
  fields: [
    // ── Layout variant ─────────────────────────────────────────────────────────
    defineField({
      name: "variant",
      title: "Layout Variant",
      type: "string",
      description: "Controls how job metadata is presented on the page.",
      options: {
        list: [
          { title: "Default — metadata summary card centred on the page (default)", value: "default" },
          { title: "Compact — condensed single-row badge strip",                    value: "compact" },
          { title: "Sidebar — float-right card for two-column detail layout",       value: "sidebar" },
        ],
      },
      initialValue: "default",
    }),

    defineField({ name: "title",        title: "Job Title",     type: "string" }),
    defineField({ name: "department",   title: "Department",    type: "string" }),
    defineField({ name: "location",     title: "Location",      type: "string" }),
    defineField({
      name: "remote",
      title: "Remote Arrangement",
      type: "string",
      options: {
        list: [
          { title: "On-site", value: "on-site" },
          { title: "Hybrid",  value: "hybrid"  },
          { title: "Remote",  value: "remote"  },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "contractType",
      title: "Contract Type",
      type: "string",
      options: {
        list: [
          { title: "Full-time",  value: "full-time"  },
          { title: "Part-time",  value: "part-time"  },
          { title: "Contract",   value: "contract"   },
          { title: "Internship", value: "internship" },
          { title: "Freelance",  value: "freelance"  },
        ],
        layout: "dropdown",
      },
    }),
    defineField({ name: "hoursPerWeek", title: "Hours per Week", type: "string" }),
    defineField({ name: "salaryRange",  title: "Salary Range",   type: "string" }),
    defineField({ name: "startDate",    title: "Start Date",     type: "date" }),
    defineField({ name: "closingDate",  title: "Closing Date",   type: "date" }),
    defineField({ name: "level",        title: "Level / Seniority", type: "string" }),
  ],
  preview: {
    select: { title: "title", subtitle: "location" },
    prepare({ title, subtitle }) {
      return { title: title ?? "Vacancy Meta", subtitle: subtitle ?? "" };
    },
  },
});
