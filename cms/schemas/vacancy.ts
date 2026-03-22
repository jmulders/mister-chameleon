/**
 * Sanity Schema — vacancy
 *
 * A Vacancy is a standalone CMS document.  It is NOT a page section block.
 * The vacancy detail page renders VacancyMetaData + ApplyPanelData page-section
 * blocks, populated by a mapper from the fetched VacancyData.
 *
 * This schema carries the full structured data.  VacancyMetaData (in cms/types.ts)
 * carries only the subset needed by the VacancyMeta page-section component.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId       string     Optional. Tenant owner slug, e.g. "workengine".
 *   title          string     Required. Job title.
 *   slug           slug       Required. URL slug for the detail page.
 *   company        reference  Optional. The hiring Company.
 *   location       string     Optional. City, region, or country.
 *   remote         string     Optional. on-site | hybrid | remote.
 *   contractType   string     Optional. Employment type.
 *   department     string     Optional. Department or team name.
 *   hoursPerWeek   string     Optional. Hours display string.
 *   salaryRange    string     Optional. Salary range display string.
 *   startDate      date       Optional. Desired start date.
 *   closingDate    date       Optional. Application closing date.
 *   description    array      Optional. Portable Text role description.
 *   requirements   array      Optional. List of requirement strings.
 *   processSteps   array      Optional. Ordered hiring process steps.
 *   recruiter      object     Optional. Recruiter contact details.
 *   isPublished    boolean    Required. Only published vacancies appear in queries.
 *
 * ─── GROQ query pattern ───────────────────────────────────────────────────────
 *
 *   *[_type == "vacancy" && slug.current == $slug && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id, "slug": slug.current, tenantId, title, location, remote, contractType,
 *     department, hoursPerWeek, salaryRange, startDate, closingDate,
 *     description, requirements, processSteps,
 *     "company": company-> { _id, name, "slug": slug.current },
 *     "recruiter": recruiter {
 *       name, role, email, phone,
 *       "avatar": avatar { "url": asset->url, alt }
 *     }
 *   }
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "vacancy",
  title: "Vacancy",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this vacancy, e.g. \"workengine\". " +
        "Leave blank for shared / platform-level vacancies.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Job title ──────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Job Title",
      type: "string",
      description: "Full job title as displayed in listings and the detail page.",
      validation: (Rule) => Rule.required(),
    }),

    // ── Slug ───────────────────────────────────────────────────────────────────
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "URL slug for the vacancy detail page path. " +
        "Generated from the job title — change with care once published.",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),

    // ── Company ────────────────────────────────────────────────────────────────
    defineField({
      name: "company",
      title: "Company",
      type: "reference",
      to: [{ type: "company" }],
      description: "The company offering this position.",
    }),

    // ── Location ───────────────────────────────────────────────────────────────
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description: 'City, region, or country (e.g. "Amsterdam", "Remote — EU").',
    }),

    // ── Remote arrangement ─────────────────────────────────────────────────────
    defineField({
      name: "remote",
      title: "Remote Arrangement",
      type: "string",
      options: {
        list: [
          { title: "On-site",  value: "on-site"  },
          { title: "Hybrid",   value: "hybrid"   },
          { title: "Remote",   value: "remote"   },
        ],
        layout: "radio",
      },
    }),

    // ── Contract type ──────────────────────────────────────────────────────────
    defineField({
      name: "contractType",
      title: "Contract Type",
      type: "string",
      options: {
        list: [
          { title: "Full-time",    value: "full-time"    },
          { title: "Part-time",    value: "part-time"    },
          { title: "Contract",     value: "contract"     },
          { title: "Internship",   value: "internship"   },
          { title: "Freelance",    value: "freelance"    },
        ],
        layout: "dropdown",
      },
    }),

    // ── Department ─────────────────────────────────────────────────────────────
    defineField({
      name: "department",
      title: "Department",
      type: "string",
      description: "Department or team this role sits in (e.g. 'Engineering', 'Sales').",
    }),

    // ── Hours per week ─────────────────────────────────────────────────────────
    defineField({
      name: "hoursPerWeek",
      title: "Hours per Week",
      type: "string",
      description: 'Display string — may include a range (e.g. "32–40 uur", "40 hours").',
    }),

    // ── Salary range ───────────────────────────────────────────────────────────
    defineField({
      name: "salaryRange",
      title: "Salary Range",
      type: "string",
      description: 'Display string (e.g. "€4 000 – €5 500 / maand"). Leave blank if not disclosed.',
    }),

    // ── Start date ─────────────────────────────────────────────────────────────
    defineField({
      name: "startDate",
      title: "Start Date",
      type: "date",
      description: "Desired or indicative start date. Displayed on the detail page.",
      options: { dateFormat: "YYYY-MM-DD" },
    }),

    // ── Closing date ───────────────────────────────────────────────────────────
    defineField({
      name: "closingDate",
      title: "Application Closing Date",
      type: "date",
      description: "Last date to apply. Displayed on the detail page and in the apply panel.",
      options: { dateFormat: "YYYY-MM-DD" },
    }),

    // ── Description (Portable Text) ────────────────────────────────────────────
    defineField({
      name: "description",
      title: "Job Description",
      type: "array",
      description:
        "Role description / summary. Rendered with PortableTextRenderer on the vacancy detail page. " +
        "Keep layout-neutral — no component or grid decisions belong here.",
      of: [defineArrayMember({ type: "block" })],
    }),

    // ── Requirements ───────────────────────────────────────────────────────────
    defineField({
      name: "requirements",
      title: "Requirements",
      type: "array",
      description:
        "Required and preferred skills / qualifications as plain strings. " +
        "Rendered as a bulleted list on the detail page.",
      of: [
        defineArrayMember({
          type: "object",
          name: "requirementItem",
          title: "Requirement",
          fields: [
            defineField({
              name: "text",
              title: "Requirement",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: { select: { title: "text" } },
        }),
      ],
    }),

    // ── Process steps ──────────────────────────────────────────────────────────
    defineField({
      name: "processSteps",
      title: "Application Process",
      type: "array",
      description: "Ordered list of steps in the hiring process (e.g. Screening → Interview → Offer).",
      of: [
        defineArrayMember({
          type: "object",
          name: "processStep",
          title: "Step",
          fields: [
            defineField({
              name: "title",
              title: "Step Title",
              type: "string",
              description: "Short step name (e.g. 'Phone screening').",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 2,
              description: "One sentence explaining what happens in this step.",
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "description" },
          },
        }),
      ],
    }),

    // ── Recruiter ──────────────────────────────────────────────────────────────
    defineField({
      name: "recruiter",
      title: "Recruiter",
      type: "object",
      description: "Contact details for the recruiter handling this vacancy.",
      fields: [
        defineField({
          name: "name",
          title: "Name",
          type: "string",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "role",
          title: "Role / Title",
          type: "string",
        }),
        defineField({
          name: "email",
          title: "Email",
          type: "string",
          validation: (Rule) =>
            Rule.custom((email) => {
              if (!email) return true;
              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                ? true
                : "Enter a valid email address.";
            }),
        }),
        defineField({
          name: "phone",
          title: "Phone",
          type: "string",
        }),
        defineField({
          name: "avatar",
          title: "Profile Photo",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describes the photo for screen readers.",
            }),
          ],
        }),
      ],
    }),

    // ── Published flag ─────────────────────────────────────────────────────────
    defineField({
      name: "isPublished",
      title: "Published",
      type: "boolean",
      description:
        "Only published vacancies are returned by default queries. " +
        "Unpublish to hide a vacancy from listings without deleting it.",
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:      "title",
      company:    "company.name",
      location:   "location",
      published:  "isPublished",
    },
    prepare({ title, company, location, published }) {
      const parts = [company, location].filter(Boolean).join(" · ");
      return {
        title:    title ?? "(Untitled vacancy)",
        subtitle: `${parts || "(no company / location)"}${published === false ? " · ⚠ unpublished" : ""}`,
      };
    },
  },
});
