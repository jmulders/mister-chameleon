/**
 * Sanity Schema — page
 *
 * A general-purpose CMS page. Editors compose pages from an ordered array of
 * registered section blocks. The page carries SEO metadata, a templateKey that
 * determines which platform template is used, and an optional contextConfig for
 * adaptive slot configuration (marketing / landing pages only).
 *
 * ─── Templates ────────────────────────────────────────────────────────────────
 *
 *   marketing-page   Hero + Proof + CTA adaptive slots wrapping content blocks.
 *                    Standard homepage / primary marketing format.
 *
 *   landing-page     Hero + CTA adaptive slots.  No proof block.
 *                    Focused conversion pages (campaign, gated content).
 *
 *   careers-page     Hero + Proof + CTA adaptive slots.  Careers-specific
 *                    variant library (hero_careers_*, proof_careers_*, cta_careers_*).
 *                    Jobs overview, team pages, employer brand.
 *
 *   article-page     No adaptive slots.  Pure editorial content blocks.
 *                    Guides, documentation, legal, changelog.
 *
 *   listing-page     No adaptive slots.  Listing + filterBar blocks.
 *                    Blog index, case study index, jobs listing.
 *
 *   detail-page      No adaptive slots.  Entity detail blocks.
 *                    Blog post detail, case study detail, vacancy detail.
 *                    Auto-assembled by entity-page mappers or authored manually.
 *
 * ─── Sections supported ───────────────────────────────────────────────────────
 *
 *   Core:        textSection, featureGrid, testimonialSection, faqSection,
 *                ctaSection, formSection
 *   Listing:     listing, filterBar, searchResults
 *   Detail:      articleMeta, articleBody, relatedContent,
 *                vacancyMeta, applyPanel, recruiterPanel
 *   Search:      search
 *   Editorial:   contentSection, textMedia, teamSection, timeline,
 *                quickLinks, processSteps, pricingSection, contactSection
 *
 * ─── Adaptive context slots (marketing-page / landing-page only) ──────────────
 *
 *   contextConfig.hero.fallbackVariantKey  — hero variant key used when the
 *     decision engine returns null (or on static pages with no engine).
 *   contextConfig.proof.fallbackVariantKey — proof variant key fallback.
 *   contextConfig.cta.fallbackVariantKey   — CTA variant key fallback.
 *
 *   Applies to: marketing-page, landing-page, careers-page.
 *   Not used by: article-page, listing-page, detail-page (no adaptive slots).
 *
 * ─── Tenant awareness ─────────────────────────────────────────────────────────
 *
 *   tenantId  string  Optional. Lowercase slug identifying the tenant that owns
 *                     this page, e.g. "workengine". When absent the document is
 *                     treated as shared/platform content and is returned for any
 *                     tenantId query. Documents with a tenantId are only returned
 *                     when the GROQ query is filtered to that specific tenant.
 *
 * ─── Slug uniqueness model ────────────────────────────────────────────────────
 *
 *   Slugs are unique per tenant, not globally.  The "home" slug may exist once
 *   per tenant — multiple tenants can each have a "home" page.
 *
 *   Sanity's built-in slug type enforces dataset-wide uniqueness by default.
 *   We override this with a custom `isUnique` function that scopes the check
 *   to documents sharing the same `tenantId` value.  Two documents with the
 *   same slug but different tenantIds are allowed.
 *
 * ─── GROQ query to fetch a page by slug (tenant-aware) ───────────────────────
 *
 *   *[_type == "page" && slug.current == $slug && isPublished == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0] {
 *     _id,
 *     title,
 *     "slug": slug.current,
 *     templateKey,
 *     tenantId,
 *     seoTitle,
 *     seoDescription,
 *     contextConfig,
 *     sections[] { _key, _type, ... }
 *   }
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   tenantId        string   Optional. Tenant owner slug, e.g. "workengine".
 *                            Absent = shared/platform content.
 *   title           string   Required. Internal title (Studio label; SEO fallback).
 *   slug            slug     Required. URL path. Must be unique per tenant.
 *   templateKey     string   Optional. One of the 5 template keys. Inferred from
 *                            sections when absent.
 *   seoTitle        string   Optional. ≤60 chars. Overrides siteSettings default.
 *   seoDescription  text     Optional. ≤160 chars. Overrides siteSettings default.
 *   contextConfig   object   Optional. Adaptive slot fallback keys.
 *   sections        array    Optional. Ordered list of content blocks.
 *   isPublished     boolean  Required. Default true.
 *
 * ─── Dependency note ──────────────────────────────────────────────────────────
 *
 *   This schema references all registered object types.
 *   Register them all in cms/schemas/index.ts before deploying to Studio.
 */

import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "page",
  title: "Page",
  type: "document",

  fields: [
    // ── Tenant ─────────────────────────────────────────────────────────────────
    // Identifies the tenant (client site) that owns this page.
    // Leave blank for shared / platform-level pages; set e.g. "workengine" for
    // content that belongs exclusively to the WorkEngine tenant.
    defineField({
      name: "tenantId",
      title: "Tenant ID",
      type: "string",
      description:
        "Tenant identifier for this page, e.g. \"workengine\". " +
        "Leave blank for shared / platform content that appears on all tenants. " +
        "Lowercase letters, numbers, and hyphens only.",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true;
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(value)) {
            return "Tenant ID must be lowercase letters, numbers, and hyphens only.";
          }
          return true;
        }),
    }),

    // ── Locale ─────────────────────────────────────────────────────────────────
    //
    // When a page exists in multiple languages, each language variant is a
    // separate document with the SAME slug but a different locale value.
    // The GROQ query uses `(locale == $locale || !defined(locale))` to select
    // the right document per request, falling back to the unlocalized (English)
    // document when no translated variant exists.
    //
    // Leave blank for the default / English version — the query's
    // `!defined(locale)` branch will serve it as the fallback for all locales
    // that don't have their own document.
    defineField({
      name: "locale",
      title: "Locale",
      type: "string",
      description:
        "Language of this page variant (e.g. \"nl\", \"de\"). " +
        "Leave blank for the default English version. " +
        "All locale variants share the same slug — the query selects the right one per visitor.",
      options: {
        list: [
          { title: "English (default — leave blank)", value: "" },
          { title: "Dutch (nl)",                      value: "nl" },
          { title: "German (de)",                     value: "de" },
        ],
      },
    }),

    // ── Title ──────────────────────────────────────────────────────────────────
    // Internal label used in Studio. Not rendered on the live page.
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description:
        "Internal page title — used in the Studio sidebar and as a fallback for SEO " +
        "title if no override is set. Not necessarily rendered on the page. Max 120 chars.",
      validation: (Rule) => Rule.required().min(1).max(120),
    }),

    // ── Slug ───────────────────────────────────────────────────────────────────
    //
    // Uniqueness is scoped to the same tenantId — not the whole dataset.
    // Two pages with the same slug but different tenantIds are both valid.
    // The custom isUnique function below enforces this per-tenant scoping.
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        'The URL path for this page (e.g. "about-us" → /about-us). ' +
        "Auto-generated from the title — click Generate or edit manually. " +
        "Use lowercase letters, numbers, and hyphens only. " +
        "Must be unique within the same Tenant ID (not globally).",
      options: {
        source: "title",
        maxLength: 96,
        slugify: (input) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "")
            .replace(/--+/g, "-"),

        // ── Tenant + locale scoped uniqueness ─────────────────────────────────
        //
        // Sanity's default isUnique checks the whole dataset.  We override it
        // to only reject slugs when another document shares the same slug,
        // the same tenantId, AND the same locale.
        //
        // This means:
        //   • Two tenants may each have a "home" page          (different tenantId)
        //   • EN / NL / DE variants may share the same slug    (different locale)
        //   • Two EN pages in the same tenant may NOT share a slug
        isUnique: async (slug, context) => {
          const { document, getClient } = context;
          if (!document) return true;

          const client  = getClient({ apiVersion: "2024-01-01" });
          const doc     = document as Record<string, unknown>;
          const tenantId = doc["tenantId"] as string | null ?? null;
          const locale   = doc["locale"]   as string | null ?? null;

          // A conflict exists only when slug + tenantId + locale all match
          // another document (excluding this one).
          const conflictId = await client.fetch<string | null>(
            `*[
              _type == "page"
              && slug.current == $slug
              && (
                ($tenantId == null && !defined(tenantId))
                || ($tenantId != null && tenantId == $tenantId)
              )
              && (
                ($locale == null && !defined(locale))
                || ($locale != null && locale == $locale)
              )
              && _id != $id
              && _id in path("*")
            ][0]._id`,
            {
              slug,
              tenantId,
              locale,
              id: document._id,
            },
          );

          return conflictId === null;
        },
      },
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          if (!slug?.current) return "Slug is required.";
          if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug.current)) {
            return "Slug must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen.";
          }
          return true;
        }),
    }),

    // ── SEO overrides ──────────────────────────────────────────────────────────
    // These override the siteSettings defaults for this page only.
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
      description:
        "Page-specific <title> tag. Overrides the site default from Site Settings. " +
        "Leave blank to fall back to the site default. " +
        "Appears in browser tabs and search engine results. Keep under 60 characters.",
      validation: (Rule) =>
        Rule.max(60).warning("SEO titles over 60 characters are truncated in search results."),
    }),

    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 3,
      description:
        "Page-specific meta description. Overrides the site default from Site Settings. " +
        "Leave blank to fall back to the site default. " +
        "Target 120–160 characters.",
      validation: (Rule) =>
        Rule.max(160).warning("Meta descriptions over 160 characters are truncated by Google."),
    }),

    defineField({
      name: "metaKeywords",
      title: "Interest Keywords",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      description:
        "Keywords that describe the primary topics of this page. " +
        "Used by the platform's interest-profile scoring engine to infer visitor interests " +
        "from browsing history — e.g. \"logistics\", \"warehousing\", \"automation\". " +
        "These are NOT rendered as HTML meta keywords (that tag has no SEO value); " +
        "they are first-party behavioural signals only.",
    }),

    // ── Template key ───────────────────────────────────────────────────────────
    defineField({
      name: "templateKey",
      title: "Template",
      type: "string",
      description:
        "The platform template that determines how context slots are structured. " +
        "When blank the platform infers the template from the sections present. " +
        "Set explicitly for reliability — inferred only as a fallback.",
      options: {
        list: [
          { title: "Marketing page (Hero + Proof + CTA slots)",    value: "marketing-page"  },
          { title: "Landing page (Hero + CTA slots)",              value: "landing-page"    },
          { title: "Careers page (Hero + Proof + CTA slots)",      value: "careers-page"    },
          { title: "Article (no slots — editorial content)",       value: "article-page"    },
          { title: "Listing (no slots — collection overview)",     value: "listing-page"    },
          { title: "Detail (no slots — single entity document)",   value: "detail-page"     },
        ],
        layout: "dropdown",
      },
    }),

    // ── Context slot configuration ─────────────────────────────────────────────
    // Used by marketing-page and landing-page templates.
    // Each slot's fallbackVariantKey becomes the active variant key on static
    // (no-engine) pages. On adaptive pages the decision engine may override it.
    defineField({
      name: "contextConfig",
      title: "Context Slot Config",
      type: "object",
      description:
        "Adaptive slot configuration for marketing-page and landing-page templates. " +
        "Set a fallback variant key for each slot — used when no decision engine is " +
        "running (static pages) or as the engine fallback on adaptive pages.",
      fields: [
        defineField({
          name: "hero",
          title: "Hero Slot",
          type: "object",
          fields: [
            defineField({
              name: "fallbackVariantKey",
              title: "Fallback Variant Key",
              type: "string",
              description:
                'Key of the heroVariant to show when no engine override exists. ' +
                'E.g. "hero_direct_brand".',
            }),
          ],
        }),
        defineField({
          name: "proof",
          title: "Proof Slot",
          type: "object",
          fields: [
            defineField({
              name: "fallbackVariantKey",
              title: "Fallback Variant Key",
              type: "string",
              description: 'Key of the proofVariant to use as fallback. E.g. "proof_cases".',
            }),
          ],
        }),
        defineField({
          name: "cta",
          title: "CTA Slot",
          type: "object",
          fields: [
            defineField({
              name: "fallbackVariantKey",
              title: "Fallback Variant Key",
              type: "string",
              description: 'Key of the ctaVariant to use as fallback. E.g. "cta_guide".',
            }),
          ],
        }),
      ],
    }),

    // ── Page sections ──────────────────────────────────────────────────────────
    // Full block catalogue — all live platform block types are available here.
    // Add sections in the order they should appear on the page.
    defineField({
      name: "sections",
      title: "Page Sections",
      type: "array",
      description:
        "Ordered page content. Add sections in the order they should appear. " +
        "Each block type has its own set of fields. " +
        "The template key above determines which blocks are meaningful for this page type.",
      of: [
        // ── Core ──────────────────────────────────────────────────────────────
        defineArrayMember({ type: "textSection" }),
        defineArrayMember({ type: "featureGrid" }),
        defineArrayMember({ type: "testimonialSection" }),
        defineArrayMember({ type: "faqSection" }),
        defineArrayMember({ type: "ctaSection" }),
        defineArrayMember({ type: "formSection" }),
        // ── Listing / overview ────────────────────────────────────────────────
        defineArrayMember({ type: "listing" }),
        defineArrayMember({ type: "filterBar" }),
        defineArrayMember({ type: "searchResults" }),
        // ── Detail (article / vacancy) ────────────────────────────────────────
        defineArrayMember({ type: "articleMeta" }),
        defineArrayMember({ type: "articleBody" }),
        defineArrayMember({ type: "relatedContent" }),
        defineArrayMember({ type: "vacancyMeta" }),
        defineArrayMember({ type: "applyPanel" }),
        defineArrayMember({ type: "recruiterPanel" }),
        // ── Search ────────────────────────────────────────────────────────────
        defineArrayMember({ type: "search" }),
        // ── Marketing / content ───────────────────────────────────────────────
        defineArrayMember({ type: "logoStrip" }),
        defineArrayMember({ type: "stats" }),
        defineArrayMember({ type: "about" }),
        defineArrayMember({ type: "newsList" }),
        // ── Rich editorial / marketing ────────────────────────────────────────
        defineArrayMember({ type: "contentSection" }),
        defineArrayMember({ type: "textMedia" }),
        defineArrayMember({ type: "teamSection" }),
        defineArrayMember({ type: "timeline" }),
        defineArrayMember({ type: "quickLinks" }),
        defineArrayMember({ type: "processSteps" }),
        defineArrayMember({ type: "pricingSection" }),
        defineArrayMember({ type: "contactSection" }),
        // ── Commerce / product ────────────────────────────────────────────────
        defineArrayMember({ type: "productOverview" }),
        defineArrayMember({ type: "productDetail" }),
      ],
    }),

    // ── Published flag ─────────────────────────────────────────────────────────
    defineField({
      name: "isPublished",
      title: "Published",
      type: "boolean",
      description:
        "Only published pages are returned by GROQ queries and rendered on the site. " +
        "Set to false to hide the page without deleting it.",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  preview: {
    select: {
      title:       "title",
      slug:        "slug.current",
      tenantId:    "tenantId",
      isPublished: "isPublished",
      sections:    "sections",
    },
    prepare({ title, slug, tenantId, isPublished, sections }) {
      const sectionCount = Array.isArray(sections) ? sections.length : 0;
      const publishedLabel = isPublished === false ? " · ⚠ unpublished" : "";
      const tenantLabel = tenantId ? ` [${tenantId}]` : "";
      return {
        title:    title ?? "(No title)",
        subtitle: `/${slug ?? "no-slug"}${tenantLabel} · ${sectionCount} section${sectionCount !== 1 ? "s" : ""}${publishedLabel}`,
      };
    },
  },
});
