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
 *   ──────────────────          ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   subtitle                →  subtitle
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
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

import type { HeroBlockData, ProofBlockData, CTABlockData } from "../../types";
import type {
  StatamicHeroEntry,
  StatamicProofEntry,
  StatamicCTAEntry,
} from "../../queries/statamic";

// ── Hero mapper ───────────────────────────────────────────────────────────

/**
 * Translate a Statamic hero_variants entry into a HeroBlockData.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A HeroBlockData ready for the experience composer.
 */
export function mapStatamicHero(entry: StatamicHeroEntry): HeroBlockData {
  return {
    id:       entry.key,
    title:    entry.title,
    subtitle: entry.subtitle,
    cta: {
      label: entry.cta_label,
      href:  entry.cta_href,
    },
    tag: entry.tag,
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
