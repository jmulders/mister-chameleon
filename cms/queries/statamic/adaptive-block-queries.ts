/**
 * Adaptive Block — Statamic content type
 *
 * Defines:
 *   StatamicAdaptiveBlockEntry      — the entry shape of an adaptive_blocks collection entry
 *   StatamicAdaptiveBlockReplicatorSet — Replicator Set variant for page content arrays
 *
 * ─── Statamic collection: adaptive_blocks ────────────────────────────────────
 *
 *   The `adaptive_blocks` collection must be configured with these fields:
 *
 *   Field handle                  Type          Notes
 *   ────────────────────────      ──────        ──────────────────────────────────
 *   block_key                     Text          Routing key, e.g. "hero_saas_default"
 *   slot_type                     Select        hero|proof|cta|feature|conversion|notification
 *   is_active                     Toggle        Soft-disable without deleting the entry
 *
 *   default_variant_title         Text          Standaard koptekst (SEO fallback)
 *   default_variant_subtitle      Textarea      Standaard subtekst
 *   default_variant_tag           Text          Eyebrow label (optioneel)
 *   default_variant_layout_variant Select       hero_default|hero_split|hero_proof|hero_background|hero_banner
 *   default_variant_content_align Select        left|center|right
 *   default_variant_ctas          Replicator    CTA-knoppen (label + href + variant)
 *   default_variant_media_type    Select        none|image|video
 *   default_variant_media_image   Assets        Afbeelding-URL
 *   default_variant_media_alt     Text          Alt-tekst
 *   default_variant_video_source  Select        upload|youtube|vimeo
 *   default_variant_video_file    Assets        Video-bestand
 *   default_variant_video_poster  Assets        Poster-afbeelding
 *   default_variant_video_autoplay Toggle
 *   default_variant_video_muted   Toggle
 *   default_variant_video_loop    Toggle
 *   default_variant_video_controls Toggle
 *   default_variant_video_id      Text          YouTube of Vimeo video-ID
 *
 *   adaptive_variants             Replicator    Gepersonaliseerde varianten
 *
 * ─── Field name mapping ───────────────────────────────────────────────────────
 *
 *   StatamicAdaptiveBlockEntry     →  AdaptiveBlockData
 *   ─────────────────────────         ─────────────────────────
 *   id                             →  id
 *   block_key                      →  key
 *   slot_type                      →  (meta, not stored in AdaptiveBlockData)
 *   is_active                      →  isActive
 *   default_variant                →  defaultVariant (AdaptiveVariantContent)
 *   adaptive_variants[]            →  adaptiveVariants[]
 */

// ── Collection handle ──────────────────────────────────────────────────────────

/**
 * Statamic collection handle voor adaptive block entries.
 * Moet exact overeenkomen met de collection aangemaakt in de Statamic installatie.
 */
export const ADAPTIVE_BLOCKS_COLLECTION = "adaptive_blocks" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/**
 * Een enkele CTA-knop binnen een Statamic Replicator `ctas` veld.
 */
export interface StatamicAdaptiveCTAItem {
  /** Knoptekst */
  label: string;
  /** Doel-URL — relatief ("/demo") of absoluut */
  href: string;
  /** Visuele stijl — weggelaten betekent positie-gebaseerde standaard */
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Inhoudsvelden van één adaptive variant (zowel defaultVariant als elke adaptiveVariant).
 *
 * Veldnamen volgen Statamic's snake_case conventie op API-niveau.
 * De mapper (mapStatamicAdaptiveVariantContent) vertaalt dit naar AdaptiveVariantContent.
 */
export interface StatamicAdaptiveVariantContent {
  /** Primaire headline */
  title: string;
  /** Ondersteunende alinea onder de headline */
  subtitle: string;
  /** Eyebrow label boven de headline */
  tag?: string;
  /** 0–2 CTA-knoppen */
  ctas?: StatamicAdaptiveCTAItem[];
  /**
   * Layout-variant sleutel, bijv. "hero_split", "hero_background".
   * Add a Select field met opties: hero_default|hero_split|hero_proof|hero_background|hero_banner
   */
  layout_variant?: string;
  /**
   * Horizontale uitlijning van tekst + CTA's.
   * Alleen van toepassing op de hero_background layout.
   */
  content_align?: "left" | "center" | "right";
  /** Media-type — selecteert welke media-velden worden gebruikt */
  media_type?: "none" | "image" | "video";
  /** URL van de afbeelding (opgelost door Statamic's Assets fieldtype) */
  media_image?: string | null;
  /** Alt-tekst voor de afbeelding */
  media_alt?: string | null;
  /** Video-brontype */
  video_source?: "upload" | "youtube" | "vimeo";
  /** URL van het geüploade videobestand */
  video_file?: string | null;
  /** URL van de poster-afbeelding */
  video_poster?: string | null;
  video_autoplay?: boolean;
  video_muted?: boolean;
  video_loop?: boolean;
  video_controls?: boolean;
  /** YouTube of Vimeo video-ID */
  video_id?: string | null;
}

/**
 * Één entry in de adaptive_variants Replicator.
 * Koppelt een variantKey aan variant-inhoud.
 */
export interface StatamicAdaptiveVariantEntry {
  /** Sleutel uit de rule engine, bijv. "hero_saas_default_dev" */
  variant_key: string;
  /** Optioneel weergavelabel voor de editor */
  label?: string;
  /** De feitelijke variant-inhoud */
  content: StatamicAdaptiveVariantContent;
}

/**
 * Inhoudsvelden van een Statamic adaptive_blocks collection entry.
 *
 * Veldnamen volgen Statamic's snake_case conventie op API-niveau.
 * Statamic voegt automatisch `id` toe aan elke entry.
 */
export interface StatamicAdaptiveBlockEntry {
  /** Statamic-gegenereerde entry UUID */
  id: string;
  /** Routing-sleutel, bijv. "hero_saas_default" */
  block_key: string;
  /** Slot-type — bepaalt welk block-component de inhoud rendert */
  slot_type: "hero" | "proof" | "cta" | "feature" | "conversion" | "notification";
  /**
   * Soft-disable vlag.
   * Gepubliceerde entries met is_active=false worden behandeld als niet gevonden.
   */
  is_active: boolean;
  /** SEO-fallback variant — altijd gerenderd voor bots en bij geen match */
  default_variant: StatamicAdaptiveVariantContent;
  /** Gepersonaliseerde varianten gesorteerd op prioriteit */
  adaptive_variants?: StatamicAdaptiveVariantEntry[];
}

/**
 * Replicator Set voor een adaptive_block ingebed in de `content` Replicator van een pagina.
 *
 * Gebruikt hetzelfde Replicator-patroon als StatamicHeroReplicatorSet —
 * de inhoudsvelden staan flat (niet genest onder default_variant).
 */
export interface StatamicAdaptiveBlockReplicatorSet {
  /** Set-handle toegevoegd door Statamic aan elk Replicator-blok */
  type: "adaptive_block";
  /** Routing-sleutel */
  block_key: string;
  /** Slot-type */
  slot_type: string;
  is_active?: boolean;
  /** Flat inhoudsvelden (gelijk aan StatamicAdaptiveVariantContent) */
  title?: string;
  subtitle?: string;
  tag?: string;
  ctas?: StatamicAdaptiveCTAItem[];
  layout_variant?: string;
  content_align?: "left" | "center" | "right";
  media_type?: "none" | "image" | "video";
  media_image?: string | null;
  media_alt?: string | null;
  video_source?: "upload" | "youtube" | "vimeo";
  video_file?: string | null;
  video_poster?: string | null;
  video_autoplay?: boolean;
  video_muted?: boolean;
  video_loop?: boolean;
  video_controls?: boolean;
  video_id?: string | null;
  /** Gepersonaliseerde varianten */
  adaptive_variants?: StatamicAdaptiveVariantEntry[];
}
