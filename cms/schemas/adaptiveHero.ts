/**
 * Sanity Schema — adaptiveHero
 *
 * Een enkel document dat de "Content Matrix" implementeert: één blok met
 * meerdere varianten, in plaats van honderden losse documenten.  Elke
 * variant kan dynamische tokens bevatten (bijv. {{company_name}}) die
 * op render-tijd worden vervangen door echte bezoekersdata.
 *
 * ─── Structuur ────────────────────────────────────────────────────────────────
 *
 *   defaultVariant      — De SEO-fallback.  Altijd gerenderd voor bots en
 *                         bezoekers zonder matching variant.  Nooit tokens
 *                         gebruiken in dit veld — zoekmachines zien de ruwe
 *                         placeholder-tekst.
 *
 *   adaptiveVariants[]  — Elke entry koppelt een variantKey (bijv. "hero_roi")
 *                         aan variant-specifieke content.  Tokens zijn toegestaan
 *                         in title, subtitle en tag.
 *
 * ─── Token-syntax ─────────────────────────────────────────────────────────────
 *
 *   {{company_name}}   →  Reverse-IP bedrijfsnaam (bijv. "Philips")
 *   {{location}}       →  Stad of regio  (bijv. "Amsterdam")
 *   {{industry}}       →  Bedrijfstak  (bijv. "Technologie")
 *   {{first_name}}     →  CRM-voornaam (stille fallback als onbekend)
 *
 *   Token-fallbacks worden bepaald in lib/tokens/parse-tokens.ts.
 *
 * ─── Resolution-volgorde ─────────────────────────────────────────────────────
 *
 *   1. Is de bezoeker een bot?              → render defaultVariant
 *   2. Is adaptiveVariants leeg?            → render defaultVariant
 *   3. Bestaat de gezochte variantKey?      → render die variant
 *   4. Geen match gevonden?                 → render defaultVariant
 *
 * ─── Studio-tabs ──────────────────────────────────────────────────────────────
 *
 *   Content     — defaultVariant + alle adaptiveVariants
 *   Instellingen — key, tenantId, is_active
 */

import { defineArrayMember, defineField, defineType } from "sanity";

// ── Herbruikbaar veld: één CTA-knop ──────────────────────────────────────────

const ctaLinkFields = [
  defineField({
    name:        "label",
    title:       "Knoptekst",
    type:        "string",
    validation:  (r) => r.required().max(60),
  }),
  defineField({
    name:       "href",
    title:      "URL",
    type:       "string",
    validation: (r) => r.required(),
  }),
  defineField({
    name:    "variant",
    title:   "Stijl",
    type:    "string",
    options: {
      list: [
        { title: "Primair (gevuld)",     value: "primary"   },
        { title: "Secundair (omlijnd)",  value: "secondary" },
        { title: "Ghost (transparant)",  value: "ghost"     },
      ],
      layout: "radio",
    },
    initialValue: "primary",
  }),
];

// ── Herbruikbaar veld: variant-content ───────────────────────────────────────
//
// Gedeeld tussen defaultVariant én elke entry in adaptiveVariants.
// Tokens zijn toegestaan in title/subtitle/tag — maar NIET in defaultVariant
// (zie validatie aldaar).

function variantContentFields(allowTokens: boolean) {
  const tokenNote = allowTokens
    ? "Tokens toegestaan: {{company_name}}, {{location}}, {{industry}}, {{first_name}}"
    : "⚠️ Geen tokens gebruiken — dit is de SEO-fallback voor zoekmachines.";

  return [
    defineField({
      name:        "title",
      title:       "Koptekst",
      type:        "string",
      description: tokenNote,
      validation:  (r) => r.required().max(120),
    }),
    defineField({
      name:        "subtitle",
      title:       "Subtekst",
      type:        "text",
      rows:        3,
      description: tokenNote,
      validation:  (r) => r.required().max(300),
    }),
    defineField({
      name:        "tag",
      title:       "Eyebrow (badge boven koptekst)",
      type:        "string",
      description: allowTokens ? tokenNote : undefined,
      validation:  (r) => r.max(80),
    }),
    defineField({
      name:  "ctas",
      title: "CTA-knoppen",
      type:  "array",
      of:    [
        defineArrayMember({
          name:   "cta",
          title:  "Knop",
          type:   "object",
          fields: ctaLinkFields,
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        }),
      ],
      validation: (r) => r.max(2),
    }),
    defineField({
      name:    "image",
      title:   "Afbeelding (optioneel)",
      type:    "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name:        "alt",
          title:       "Alt-tekst",
          type:        "string",
          description: "Verplicht voor toegankelijkheid en SEO.",
          validation:  (r) => r.required(),
        }),
      ],
    }),
  ];
}

// ── Schema definitie ─────────────────────────────────────────────────────────

export default defineType({
  name:  "adaptiveHero",
  title: "Adaptive Hero Block",
  type:  "document",

  groups: [
    { name: "content",     title: "Content",      default: true },
    { name: "settings",    title: "Instellingen"               },
  ],

  fields: [

    // ── Instellingen ────────────────────────────────────────────────────────

    defineField({
      name:        "key",
      title:       "Block-sleutel",
      type:        "slug",
      description: "Unieke identifier voor dit adaptive hero block (bijv. 'hero_matrix_homepage').",
      group:       "settings",
      options:     { source: "defaultVariant.title", maxLength: 80 },
      validation:  (r) => r.required(),
    }),

    defineField({
      name:        "tenantId",
      title:       "Tenant ID",
      type:        "string",
      description: "Leeg = gedeeld platform-blok.  Ingevuld = tenant-specifieke override.",
      group:       "settings",
    }),

    defineField({
      name:         "is_active",
      title:        "Actief",
      type:         "boolean",
      description:  "Wanneer uitgeschakeld, rendert de beslissings-engine dit blok niet.",
      group:        "settings",
      initialValue: true,
      validation:   (r) => r.required(),
    }),

    // ── SEO-fallback variant ─────────────────────────────────────────────────

    defineField({
      name:        "defaultVariant",
      title:       "Standaard variant (SEO-fallback)",
      type:        "object",
      description: "Wordt gerenderd voor bots, bij geen match, en als veilige fallback. Gebruik hier GEEN tokens.",
      group:       "content",
      fields:      variantContentFields(false /* allowTokens */),
      validation:  (r) => r.required(),
    }),

    // ── Adaptive varianten ───────────────────────────────────────────────────

    defineField({
      name:        "adaptiveVariants",
      title:       "Adaptive varianten",
      type:        "array",
      description: "Elke variant wordt geactiveerd door de rule engine op basis van de variantKey.",
      group:       "content",
      of: [
        defineArrayMember({
          name:  "adaptiveVariant",
          title: "Variant",
          type:  "object",

          // Studio-preview: toont de variantKey als titel zodat editors snel
          // de juiste variant herkennen in de lijst.
          preview: {
            select: {
              title:    "variantKey",
              subtitle: "content.title",
            },
            prepare({ title, subtitle }) {
              return {
                title:    title ?? "(geen sleutel)",
                subtitle: subtitle ?? "",
              };
            },
          },

          fields: [
            defineField({
              name:        "variantKey",
              title:       "Variant-sleutel",
              type:        "string",
              description: "Moet overeenkomen met een sleutel uit de rule engine (bijv. 'hero_roi', 'hero_linkedin_vision').",
              validation:  (r) => r.required(),
            }),

            defineField({
              name:        "label",
              title:       "Intern label (optioneel)",
              type:        "string",
              description: "Alleen voor editors zichtbaar — bijv. 'LinkedIn / ROI-segment'.",
            }),

            defineField({
              name:        "tokenPreview",
              title:       "Token-voorbeeld (optioneel)",
              type:        "text",
              rows:        2,
              description: "Beschrijf hier welke tokenwaarden je verwacht, bijv. 'company_name=Philips, location=Eindhoven'. Puur als geheugensteuntje voor editors.",
            }),

            defineField({
              name:   "content",
              title:  "Variant-content",
              type:   "object",
              fields: variantContentFields(true /* allowTokens */),
              validation: (r) => r.required(),
            }),
          ],
        }),
      ],
    }),
  ],

  // Studio-overzicht: toont de key en het aantal varianten.
  preview: {
    select: {
      title:    "key.current",
      subtitle: "defaultVariant.title",
      active:   "is_active",
    },
    prepare({ title, subtitle, active }) {
      return {
        title:    title ?? "(geen sleutel)",
        subtitle: active === false ? `⏸ inactief — ${subtitle}` : subtitle,
      };
    },
  },
});
