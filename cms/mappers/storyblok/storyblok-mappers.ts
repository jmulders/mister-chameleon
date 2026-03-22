/**
 * Storyblok → Internal Type Mappers
 *
 * Pure functions that translate raw Storyblok story content objects into the
 * internal app content types (HeroBlockData, ProofBlockData, CTABlockData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────────
 *
 *   Storyblok field names use snake_case (cta_label, cta_href, is_active)
 *   while internal app types use camelCase nested objects (cta: { label, href }).
 *   This layer is the single place where that translation lives — neither the
 *   provider nor the components know about Storyblok's naming conventions.
 *
 *   Renaming a Storyblok field only requires a mapper change, not a cascade
 *   through components or page code.
 *
 * ─── is_active handling ──────────────────────────────────────────────────────
 *
 *   The `is_active` field is checked by StoryblokProvider BEFORE the mapper
 *   is called — inactive stories return null at the provider level and never
 *   reach these functions. The field is included in the raw types for
 *   documentation completeness but is not used inside the mappers themselves.
 *
 * ─── Mapping tables ──────────────────────────────────────────────────────────
 *
 *   StoryblokHeroContent     →  HeroBlockData
 *   ──────────────────────      ──────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   subtitle                →  subtitle
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
 *   tag                     →  tag
 *
 *   StoryblokProofContent    →  ProofBlockData
 *   ──────────────────────      ──────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   items[].title           →  items[].title
 *   items[].text            →  items[].text
 *   (items[]._uid skipped)
 *
 *   StoryblokCTAContent      →  CTABlockData
 *   ──────────────────────      ──────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   text                    →  text
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
 */

import type { HeroBlockData, ProofBlockData, CTABlockData } from "../../types";
import type {
  StoryblokHeroContent,
  StoryblokProofContent,
  StoryblokCTAContent,
} from "../../queries/storyblok";

// ── Hero mapper ───────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok heroVariant story content object into a HeroBlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A HeroBlockData ready for the experience composer.
 */
export function mapStoryblokHero(content: StoryblokHeroContent): HeroBlockData {
  return {
    id:       content.key,
    title:    content.title,
    subtitle: content.subtitle,
    cta: {
      label: content.cta_label,
      href:  content.cta_href,
    },
    tag: content.tag,
  };
}

// ── Proof mapper ──────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok proofVariant story content object into a ProofBlockData.
 *
 * The `items` field is normalised with a `?? []` fallback because Storyblok
 * may omit an empty Blocks array field from the CDN response.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A ProofBlockData ready for the experience composer.
 */
export function mapStoryblokProof(content: StoryblokProofContent): ProofBlockData {
  return {
    id:    content.key,
    title: content.title,
    items: (content.items ?? []).map((item) => ({
      title: item.title,
      text:  item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok ctaVariant story content object into a CTABlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A CTABlockData ready for the experience composer.
 */
export function mapStoryblokCTA(content: StoryblokCTAContent): CTABlockData {
  return {
    id:    content.key,
    title: content.title,
    text:  content.text,
    cta: {
      label: content.cta_label,
      href:  content.cta_href,
    },
  };
}
