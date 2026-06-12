/**
 * Storyblok Component Definitions — Adaptive Block
 *
 * Exporteert de StoryblokComponentDef objecten voor de adaptive_block component
 * en zijn geneste subcomponent (cta_item).
 *
 * ─── Gebruik ─────────────────────────────────────────────────────────────────
 *
 *   import { provisionAdaptiveBlockComponents } from "@/cms/schemas/storyblok/adaptive-block-component";
 *   import { createStoryblokManagementClient }  from "@/cms/providers/storyblok-management-client";
 *
 *   const client      = createStoryblokManagementClient(token, spaceId);
 *   const existingMap = new Map((await client.listComponents()).map(c => [c.name, c.id]));
 *   await provisionAdaptiveBlockComponents(client, existingMap);
 *
 * ─── Component hiërarchie ─────────────────────────────────────────────────────
 *
 *   adaptive_block           (is_root: false, is_nestable: true)
 *     └── ctas[]             → cta_item
 *
 * ─── Server-only ─────────────────────────────────────────────────────────────
 *
 *   Management API token is een geheim — importeer dit module alleen vanuit
 *   Server Actions of API routes.
 */

import type {
  StoryblokComponentDef,
  StoryblokManagementClient,
} from "../../providers/storyblok-management-client";

// ── CTA item component ────────────────────────────────────────────────────────

/**
 * Storyblok component definitie voor een enkelvoudige CTA-knop.
 * Wordt genest in adaptive_block.ctas.
 */
export const CTA_ITEM_COMPONENT_DEF: StoryblokComponentDef = {
  name:         "cta_item",
  display_name: "CTA Item",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label: {
      type:         "text",
      display_name: "Knoptekst",
      pos:          0,
      required:     true,
    },
    href: {
      type:         "text",
      display_name: "URL",
      pos:          1,
      required:     true,
    },
    variant: {
      type:         "option",
      display_name: "Stijl",
      pos:          2,
      options: [
        { value: "primary",   name: "Primair" },
        { value: "secondary", name: "Secundair" },
        { value: "outline",   name: "Outline" },
        { value: "ghost",     name: "Ghost" },
      ],
    },
  },
};

// ── Adaptive block component ───────────────────────────────────────────────────

/**
 * Storyblok component definitie voor een adaptive block.
 *
 * Elk adaptive block is een zelfstandige story in de "adaptive-blocks" folder.
 * Content managers vullen de velden direct in — geen geneste variant-laag.
 *
 * Veld pos-waarden zijn oplopend genummerd voor de juiste volgorde
 * in de Storyblok editor sidebar.
 */
export const ADAPTIVE_BLOCK_COMPONENT_DEF: StoryblokComponentDef = {
  name:         "adaptive_block",
  display_name: "Adaptive Block",
  is_root:      false,
  is_nestable:  true,
  schema: {
    // ── Block instellingen ────────────────────────────────────────────────
    block_key: {
      type:         "text",
      display_name: "Block key",
      pos:          0,
      required:     true,
    },
    slot_type: {
      type:         "option",
      display_name: "Slot type",
      pos:          1,
      required:     true,
      options: [
        { value: "hero",         name: "Hero" },
        { value: "proof",        name: "Proof" },
        { value: "cta",          name: "CTA" },
        { value: "feature",      name: "Feature" },
        { value: "conversion",   name: "Conversion" },
        { value: "notification", name: "Notification" },
      ],
    },
    is_active: {
      type:         "boolean",
      display_name: "Actief",
      pos:          2,
    },
    // ── Tekst ─────────────────────────────────────────────────────────────
    tag: {
      type:         "text",
      display_name: "Eyebrow",
      pos:          3,
    },
    title: {
      type:         "text",
      display_name: "Headline",
      pos:          4,
      required:     true,
    },
    subtitle: {
      type:         "textarea",
      display_name: "Subtitel",
      pos:          5,
      required:     true,
    },
    // ── Layout ────────────────────────────────────────────────────────────
    layout_variant: {
      type:         "option",
      display_name: "Layout variant",
      pos:          6,
      options: [
        { value: "hero_default",    name: "Default — tekst gecentreerd" },
        { value: "hero_split",      name: "Split — tekst links, media rechts" },
        { value: "hero_background", name: "Background — media als achtergrond" },
        { value: "hero_banner",     name: "Banner — compact horizontaal" },
        { value: "hero_proof",      name: "Proof — met testimonial of logo-balk" },
      ],
    },
    content_align: {
      type:         "option",
      display_name: "Uitlijning",
      pos:          7,
      options: [
        { value: "left",   name: "Links" },
        { value: "center", name: "Gecentreerd" },
        { value: "right",  name: "Rechts" },
      ],
    },
    // ── CTA's ─────────────────────────────────────────────────────────────
    ctas: {
      type:                "bloks",
      display_name:        "CTA-knoppen",
      pos:                 8,
      restrict_components: true,
      component_whitelist: ["cta_item"],
    },
    // ── Media ─────────────────────────────────────────────────────────────
    media_type: {
      type:         "option",
      display_name: "Media type",
      pos:          9,
      options: [
        { value: "none",  name: "Geen" },
        { value: "image", name: "Afbeelding" },
        { value: "video", name: "Video" },
      ],
    },
    media_image: {
      type:         "asset",
      display_name: "Afbeelding",
      pos:          10,
    },
    media_alt: {
      type:         "text",
      display_name: "Alt-tekst",
      pos:          11,
    },
    video_source: {
      type:         "option",
      display_name: "Video bron",
      pos:          12,
      options: [
        { value: "upload",  name: "Geüpload bestand" },
        { value: "youtube", name: "YouTube" },
        { value: "vimeo",   name: "Vimeo" },
      ],
    },
    video_file: {
      type:         "asset",
      display_name: "Video bestand",
      pos:          13,
    },
    video_poster: {
      type:         "asset",
      display_name: "Poster afbeelding",
      pos:          14,
    },
    video_id: {
      type:         "text",
      display_name: "Video ID (YouTube/Vimeo)",
      pos:          15,
    },
    video_autoplay: {
      type:         "boolean",
      display_name: "Automatisch afspelen",
      pos:          16,
    },
    video_muted: {
      type:         "boolean",
      display_name: "Gedempt",
      pos:          17,
    },
    video_loop: {
      type:         "boolean",
      display_name: "Herhalen",
      pos:          18,
    },
    video_controls: {
      type:         "boolean",
      display_name: "Besturingselementen",
      pos:          19,
    },
  },
};

// ── Provisioning function ─────────────────────────────────────────────────────

/**
 * Voorziet de Storyblok space van de adaptive block component definities.
 *
 * Maakt of updatet:
 *   1. cta_item          — geneste CTA-knop
 *   2. adaptive_block    — hoofdcomponent
 *
 * De volgorde is belangrijk: cta_item wordt aangemaakt voordat adaptive_block
 * ernaar verwijst via component_whitelist.
 *
 * @param managementClient  Geconfigureerde StoryblokManagementClient.
 * @param existingComponents  Map van { name → id } gebouwd met client.listComponents().
 */
export async function provisionAdaptiveBlockComponents(
  managementClient:   StoryblokManagementClient,
  existingComponents: Map<string, number>,
): Promise<void> {
  // 1. CTA item (geneste component)
  await managementClient.upsertComponent(CTA_ITEM_COMPONENT_DEF, existingComponents);

  // 2. Adaptive block (hoofdcomponent)
  await managementClient.upsertComponent(ADAPTIVE_BLOCK_COMPONENT_DEF, existingComponents);
}
