/**
 * Sanity Schema — eventEntry
 *
 * An EventEntry is a standalone CMS document representing a single event
 * (conference, webinar, meetup, workshop, etc.).  It is NOT a page section
 * block.  The event detail page renders it via ArticleMetaData + ArticleBodyData
 * page-section blocks, populated by a mapper from the fetched EventEntryData.
 *
 * ─── Relationship to templates ────────────────────────────────────────────────
 *
 *   event_listing — list page that queries eventEntry documents via the `listing`
 *                   section block. Default slug: "events".
 *
 *   event_detail  — detail page that renders a single eventEntry via articleMeta,
 *                   articleBody (programme / description), and a ctaSection
 *                   (registration CTA). Default slug: "events/event".
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId          string     Optional. Tenant owner slug, e.g. "workengine".
 *   title             string     Required. Event name.
 *   slug              slug       Required. URL slug for the detail page.
 *   startDate         datetime   Required. ISO 8601 start timestamp.
 *   endDate           datetime   Optional. ISO 8601 end timestamp.
 *   location          string     Optional. Physical or virtual location label.
 *   coverImage        image      Optional. Hero / cover image with alt text.
 *   excerpt           text       Optional. Short teaser for listing cards.
 *   body              array      Optional. Portable Text programme / description.
 *   registrationUrl   url        Optional. External registration link.
 *   tags              array      Optional. Taxonomy tags (e.g. "webinar", "in-person").
 *   isPublished       boolean    Required. Only published events appear in queries.
 *
 * ─── GROQ query pattern (tenant-aware) ───────────────────────────────────────
 *
 *   *[_type == "eventEntry" && slug.current == $slug && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id, "slug": slug.current, title, startDate, endDate, location, excerpt, tags,
 *     registrationUrl,
 *     "coverImage": coverImage { "url": asset->url, alt },
 *     body
 *   }
 *
 * ─── Listing query pattern ────────────────────────────────────────────────────
 *
 *   *[_type == "eventEntry" && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *     && dateTime(startDate) >= dateTime(now())
 *   ] | order(startDate asc) [0...24] {
 *     _id, "slug": slug.current, title, startDate, endDate, location, excerpt,
 *     "coverImage": coverImage { "url": asset->url, alt },
 *     tags
 *   }
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "eventEntry",
  title: "Event",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant that owns this event, e.g. \"workengine\". " +
        "Leave blank for shared / platform-level events.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Event name ─────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Event Name",
      type: "string",
      description: "Full name of the event. Keep ≤120 chars for best listing display.",
      validation: (Rule) => Rule.required().max(200),
    }),

    // ── Slug ───────────────────────────────────────────────────────────────────
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "URL slug for the event detail page path. " +
        "Generated from the event name — change with care once published.",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),

    // ── Start date ─────────────────────────────────────────────────────────────
    defineField({
      name: "startDate",
      title: "Start Date & Time",
      type: "datetime",
      description: "When the event begins. Used for ordering and listing display.",
      validation: (Rule) => Rule.required(),
    }),

    // ── End date ───────────────────────────────────────────────────────────────
    defineField({
      name: "endDate",
      title: "End Date & Time",
      type: "datetime",
      description: "When the event ends. Optional — leave blank for open-ended events.",
    }),

    // ── Location ───────────────────────────────────────────────────────────────
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description:
        "Physical location (e.g. \"Amsterdam, Netherlands\") or virtual label " +
        "(e.g. \"Online — Zoom\"). Shown in listing cards and the detail page meta.",
      validation: (Rule) => Rule.max(200),
    }),

    // ── Cover image ────────────────────────────────────────────────────────────
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      description: "Hero image shown at the top of the event detail page and in listing cards.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describes the image for screen readers.",
          validation: (Rule) => Rule.required(),
        }),
      ],
    }),

    // ── Excerpt ────────────────────────────────────────────────────────────────
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description:
        "Short teaser shown in listing cards. " +
        "If blank the listing component falls back to the first body paragraph. " +
        "Keep to 1–2 sentences (≤280 chars).",
      validation: (Rule) => Rule.max(280),
    }),

    // ── Body (Portable Text) ───────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Event Description / Programme",
      type: "array",
      description:
        "Full event description, agenda, or programme. " +
        "Rendered with PortableTextRenderer on the detail page.",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describes the inline image for screen readers.",
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
              description: "Optional caption displayed below the image.",
            }),
          ],
        }),
      ],
    }),

    // ── Registration URL ───────────────────────────────────────────────────────
    defineField({
      name: "registrationUrl",
      title: "Registration URL",
      type: "url",
      description:
        "External registration link (e.g. Eventbrite, Hopin, Zoom). " +
        "Used as the CTA button target on the event detail page.",
    }),

    // ── Tags ───────────────────────────────────────────────────────────────────
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      description:
        "Taxonomy tags (e.g. 'webinar', 'in-person', 'workshop', 'conference'). " +
        "Used for filtering in listing and search sections.",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),

    // ── Published flag ─────────────────────────────────────────────────────────
    defineField({
      name: "isPublished",
      title: "Published",
      type: "boolean",
      description:
        "Only published events are returned by default queries. " +
        "Unpublish to hide an event from listings without deleting it.",
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:      "title",
      startDate:  "startDate",
      location:   "location",
      published:  "isPublished",
      media:      "coverImage",
    },
    prepare({ title, startDate, location, published, media }) {
      const date = startDate
        ? new Date(startDate as string).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })
        : "no date";
      const loc = location ? ` · ${location}` : "";
      return {
        title:    title ?? "(Untitled event)",
        subtitle: `${date}${loc}${published === false ? " · ⚠ unpublished" : ""}`,
        media,
      };
    },
  },
});
