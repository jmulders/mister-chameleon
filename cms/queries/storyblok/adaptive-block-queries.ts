/**
 * Adaptive Block — Storyblok content type
 *
 * Defines:
 *   StoryblokAdaptiveBlockContent  — the content field shape of an adaptive_block story
 *
 * ─── Storyblok component: adaptive_block ──────────────────────────────────────
 *
 *   The `adaptive_block` Storyblok component must be configured with these fields:
 *
 *   Field name         Type      Notes
 *   ──────────────     ──────    ─────────────────────────────────────────────
 *   block_key          Text      Routing key, e.g. "hero_saas_default"
 *   slot_type          Option    hero|proof|cta|feature|conversion|notification
 *   is_active          Boolean   Soft-disable without unpublishing
 *
 *   tag                Text      Eyebrow label (optioneel)
 *   title              Text      Headline (required)
 *   subtitle           Textarea  Subtitel (required)
 *
 *   layout_variant     Option    hero_default|hero_split|hero_proof|hero_background|hero_banner
 *   content_align      Option    left|center|right
 *
 *   ctas               Bloks     CTA-knoppen (whitelist: ["cta_item"])
 *
 *   media_type         Option    none|image|video
 *   media_image        Asset     Afbeelding
 *   media_alt          Text      Alt-tekst
 *   video_source       Option    upload|youtube|vimeo
 *   video_file         Asset     Video-bestand
 *   video_poster       Asset     Poster-afbeelding
 *   video_autoplay     Boolean
 *   video_muted        Boolean
 *   video_loop         Boolean
 *   video_controls     Boolean
 *   video_id           Text      YouTube of Vimeo video-ID
 *
 * ─── Story slug convention ─────────────────────────────────────────────────────
 *
 *   Stories must be created inside a folder named "adaptive-blocks" in Storyblok:
 *
 *     Storyblok space
 *       └── adaptive-blocks/
 *             ├── hero_saas_default   ← slug = "hero_saas_default"
 *             └── hero_saas_dev       ← slug = "hero_saas_dev"
 *
 * ─── Field name mapping ────────────────────────────────────────────────────────
 *
 *   StoryblokAdaptiveBlockContent   →  AdaptiveBlockData
 *   ─────────────────────────────      ─────────────────────────
 *   block_key                       →  key
 *   is_active                       →  isActive
 *   (content fields via variant)    →  defaultVariant (AdaptiveVariantContent)
 */

// ── Storyblok folder slug ──────────────────────────────────────────────────────

/**
 * Storyblok folder slug die alle adaptive block stories bevat.
 * Moet exact overeenkomen met de folder aangemaakt in de Storyblok space.
 */
export const ADAPTIVE_BLOCKS_FOLDER = "adaptive-blocks" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/**
 * Een enkele CTA-knop binnen de Storyblok `ctas` Blocks array.
 *
 * Storyblok gebruikt zijn standaard component + _uid envelope;
 * `_uid` wordt weggelaten hier omdat de mapper dit niet gebruikt.
 */
export interface StoryblokAdaptiveCTAItem {
  _uid?: string;
  /** Knoptekst */
  label: string;
  /** Doel-URL — relatief ("/demo") of absoluut */
  href: string;
  /** Visuele stijl — weggelaten betekent positie-gebaseerde standaard */
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Inhoudsvelden van één adaptive variant (flat block content).
 *
 * Veldnamen volgen Storyblok's snake_case conventie.
 * De mapper (mapStoryblokAdaptiveVariantContent) vertaalt dit naar AdaptiveVariantContent.
 */
export interface StoryblokAdaptiveVariantContent {
  /** Primaire headline */
  title: string;
  /** Ondersteunende alinea onder de headline */
  subtitle: string;
  /** Eyebrow label boven de headline */
  tag?: string;
  /** 0–2 CTA-knoppen */
  ctas?: StoryblokAdaptiveCTAItem[];
  /** Layout-variant sleutel, bijv. "hero_split", "hero_background" */
  layout_variant?: string;
  /** Horizontale uitlijning van tekst + CTA's */
  content_align?: "left" | "center" | "right";
  /** Media-type — selecteert welke media-velden worden gebruikt */
  media_type?: "none" | "image" | "video";
  /** Storyblok asset object voor de afbeelding */
  media_image?: { filename?: string; alt?: string } | null;
  /** Video-brontype */
  video_source?: "upload" | "youtube" | "vimeo";
  /** Storyblok asset object voor het videobestand */
  video_file?: { filename?: string } | null;
  /** Storyblok asset object voor de poster-afbeelding */
  video_poster?: { filename?: string } | null;
  video_autoplay?: boolean;
  video_muted?: boolean;
  video_loop?: boolean;
  video_controls?: boolean;
  /** YouTube of Vimeo video-ID */
  video_id?: string;
}

/**
 * Content fields van een Storyblok `adaptive_block` story.
 *
 * Extends StoryblokAdaptiveVariantContent — alle content-velden staan flat op
 * de story zelf (geen geneste default_variant wrapper).
 *
 * Note: Storyblok voegt automatisch `_uid` en `component` toe aan elk
 * content-object — ze worden hier weggelaten omdat de mapper ze niet gebruikt.
 */
export interface StoryblokAdaptiveBlockContent extends StoryblokAdaptiveVariantContent {
  /** Routing-sleutel, bijv. "hero_saas_default" */
  block_key: string;
  /** Slot-type — bepaalt welk block-component de inhoud rendert */
  slot_type: string;
  /**
   * Soft-disable vlag.
   * Gepubliceerde stories met is_active=false worden behandeld als niet gevonden.
   */
  is_active: boolean;
}

// ── Slug builder ───────────────────────────────────────────────────────────────

/**
 * Bouwt de volledige Storyblok story slug voor een adaptive block.
 *
 * @param key  De block routing key, bijv. "hero_saas_default"
 * @returns    De volledige story slug, bijv. "adaptive-blocks/hero_saas_default"
 */
export function adaptiveBlockSlug(key: string): string {
  return `${ADAPTIVE_BLOCKS_FOLDER}/${key}`;
}
