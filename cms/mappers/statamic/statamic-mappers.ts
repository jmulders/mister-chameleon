/**
 * Statamic → Internal Type Mappers
 *
 * Pure functions that translate raw Statamic entry content objects into the
 * internal app content types (HeroBlockData, ProofBlockData, CTABlockData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────
 *
 *   Statamic field names use snake_case (cta_label, cta_href, is_active)
 *   while internal app types use camelCase nested objects (cta: { label, href }).
 *   This layer is the single place where that translation lives — neither the
 *   provider nor the components know about Statamic's naming conventions.
 *
 *   Renaming a Statamic field only requires a mapper change, not a cascade
 *   through components or page code.
 *
 * ─── is_active handling ──────────────────────────────────────────────────
 *
 *   The `is_active` field is checked by StatamicProvider BEFORE the mapper
 *   is called — inactive entries return null at the provider level and never
 *   reach these functions. The field is included in the raw types for
 *   documentation completeness but is not used inside the mappers themselves.
 *
 * ─── Mapping tables ────────────────────────────────────────────────────────
 *
 *   StatamicHeroEntry       →  HeroBlockData
 *   ──────────────────          ──────────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   subtitle                →  subtitle
 *   ctas[].label            →  ctas[].label   (preferred)
 *   ctas[].href             →  ctas[].href
 *   ctas[].variant          →  ctas[].variant
 *   cta_label               →  cta.label      (legacy fallback)
 *   cta_href                →  cta.href       (legacy fallback)
 *   tag                     →  tag
 *
 *   StatamicProofEntry      →  ProofBlockData
 *   ───────────────────         ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   (items??[]).map(...)    →  items (see item mapping below)
 *
 *   StatamicProofItem       →  ProofBlockData.items[n]
 *   ────────────────────        ────────────────────────
 *   title                   →  title
 *   text                    →  text
 *
 *   StatamicCTAEntry        →  CTABlockData
 *   ──────────────────          ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   text                    →  text
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
 */

import type { HeroBlockData, HeroBannerMedia, ProofBlockData, CTABlockData } from "../../types";
import type {
  StatamicHeroEntry,
  StatamicHeroMedia,
  StatamicProofEntry,
  StatamicCTAEntry,
} from "../../queries/statamic";

// ── Hero media helper ───────────────────────────────────────────────────────

/**
 * Translate the flat Statamic media object into the HeroBannerMedia union.
 * Returns undefined for absent / "none" / incomplete media (safe fallback).
 */
function mapStatamicHeroMedia(raw: StatamicHeroMedia | null | undefined): HeroBannerMedia | undefined {
  if (!raw || !raw.media_type || raw.media_type === "none") return undefined;

  if (raw.media_type === "image") {
    if (!raw.media_image) return undefined;
    return { kind: "image", url: raw.media_image, alt: raw.media_alt ?? "" };
  }

  if (raw.media_type === "video") {
    if (!raw.video_source) return undefined;

    if (raw.video_source === "upload") {
      if (!raw.video_file) return undefined;
      return {
        kind:  "video",
        video: {
          source:   "upload",
          url:       raw.video_file,
          poster:    raw.video_poster   ?? undefined,
          autoplay:  raw.video_autoplay,
          muted:     raw.video_muted,
          loop:      raw.video_loop,
          controls:  raw.video_controls,
        },
      };
    }

    if (raw.video_source === "youtube") {
      if (!raw.video_id) return undefined;
      return { kind: "video", video: { source: "youtube", videoId: raw.video_id } };
    }

    if (raw.video_source === "vimeo") {
      if (!raw.video_id) return undefined;
      return { kind: "video", video: { source: "vimeo", videoId: raw.video_id } };
    }
  }

  return undefined;
}

// ── Hero mapper ───────────────────────────────────────────────────────────

/**
 * Translate a Statamic hero_variants entry into a HeroBlockData.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A HeroBlockData ready for the experience composer.
 */
export function mapStatamicHero(entry: StatamicHeroEntry): HeroBlockData {
  // Prefer the new ctas array; fall back to the legacy flat fields for
  // entries authored before the ctas field was added to the blueprint.
  const ctas: HeroBlockData["ctas"] =
    entry.ctas && entry.ctas.length > 0
      ? entry.ctas.map((c) => ({
          label:   c.label,
          href:    c.href,
          variant: c.variant,
        }))
      : entry.cta_label
        ? [{ label: entry.cta_label, href: entry.cta_href ?? "" }]
        : [];

  return {
    id:            entry.key,
    layoutVariant: entry.layout_variant,
    contentAlign:  entry.content_align,
    title:         entry.title,
    subtitle:      entry.subtitle,
    ctas,
    tag:           entry.tag,
    media:         mapStatamicHeroMedia(entry.media),
  };
}

// ── Proof mapper ───────────────────────────────────────────────────────────

/**
 * Translate a Statamic proof_variants entry into a ProofBlockData.
 *
 * The `items` field is normalised with a `?? []` fallback because Statamic
 * may omit an empty Grid field from the API response.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A ProofBlockData ready for the experience composer.
 */
export function mapStatamicProof(entry: StatamicProofEntry): ProofBlockData {
  return {
    id:    entry.key,
    title: entry.title,
    items: (entry.items ?? []).map((item) => ({
      title: item.title,
      text:  item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────

/**
 * Translate a Statamic cta_variants entry into a CTABlockData.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A CTABlockData ready for the experience composer.
 */
export function mapStatamicCTA(entry: StatamicCTAEntry): CTABlockData {
  return {
    id:    entry.key,
    title: entry.title,
    text:  entry.text,
    cta: {
      label: entry.cta_label,
      href:  entry.cta_href,
    },
  };
}
