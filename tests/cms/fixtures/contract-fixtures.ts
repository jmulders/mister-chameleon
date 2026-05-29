/**
 * CMS Provider Contract Test Fixtures
 *
 * Defines three sets of parallel fixtures — one per variant type — that are
 * used by every provider test to verify contract consistency:
 *
 *   1. expected-output.ts shapes  — the canonical HeroBlockData / ProofBlockData /
 *      CTABlockData that EVERY provider must return for the given key.
 *
 *   2. Sanity raw shapes  — SanityHeroRaw / SanityProofRaw / SanityCTARaw values
 *      that, when run through the Sanity mappers, produce the expected output.
 *
 *   3. Storyblok story shapes  — StoryblokStory<*Content> values that, when
 *      run through the Storyblok mappers, produce the expected output.
 *
 * The fixture keys are deliberately distinct from the real variant keys used
 * by MockCMSProvider (hero_google_problem etc.) to avoid collisions.
 */

import type { HeroBlockData, ProofBlockData, CTABlockData } from '@/cms/types';
import type { SanityHeroRaw, SanityProofRaw, SanityCTARaw } from '@/cms/queries/sanity';
import type { SanityProofItemRaw } from '@/cms/queries/sanity/proof-queries';
import type { StoryblokStory } from '@/cms/providers/storyblok-client';
import type {
  StoryblokHeroContent,
  StoryblokProofContent,
  StoryblokCTAContent,
} from '@/cms/queries/storyblok';
import type {
  StatamicHeroEntry,
  StatamicProofEntry,
  StatamicCTAEntry,
} from '@/cms/queries/statamic';

// ── Variant keys used across all provider tests ───────────────────────────────

export const HERO_KEY        = 'hero_test'        as const;
export const HERO_NO_TAG_KEY = 'hero_test_no_tag' as const;
export const PROOF_KEY       = 'proof_test'       as const;
export const CTA_KEY         = 'cta_test'         as const;

// ── Expected output ───────────────────────────────────────────────────────────
// These are the canonical shapes that every CMS provider must produce for the
// fixture keys above. Both SanityProvider and StoryblokProvider are tested
// against these exact values, exercising their full mapping pipelines.

export const EXPECTED_HERO: HeroBlockData = {
  id:       HERO_KEY,
  title:    'Your site speaks to every visitor.',
  subtitle: 'Adaptive personalisation without the engineering overhead.',
  // The raw CMS fixture uses legacy ctaLabel/ctaHref flat fields (no ctas array),
  // so the mapper normalises them into a single-item ctas array.
  ctas:     [{ label: 'See how it works', href: '#how-it-works' }],
  tag:      'No A/B testing required',
};

/**
 * Hero variant with no eyebrow tag.
 * The `tag` property must be `undefined` (not absent) because both mappers
 * produce `tag: content.tag` — when the raw field is absent, the result
 * object carries the property with value `undefined`.
 */
export const EXPECTED_HERO_NO_TAG: HeroBlockData = {
  id:       HERO_NO_TAG_KEY,
  title:    'A headline without an eyebrow.',
  subtitle: 'This variant has no tag field set.',
  ctas:     [{ label: 'Get started', href: '/start' }],
  tag:      undefined,
};

export const EXPECTED_PROOF: ProofBlockData = {
  id:    PROOF_KEY,
  title: 'Results that speak for themselves',
  items: [
    { title: '3.2× more qualified leads',   text: 'Average lift in demo requests within 30 days.' },
    { title: 'First experience in < 5 min', text: 'Connect, configure, and ship in one afternoon.' },
    { title: 'Zero engineering required',   text: 'Rule-based or AI-driven — both need zero sprints.' },
  ],
};

export const EXPECTED_CTA: CTABlockData = {
  id:    CTA_KEY,
  title: 'Start adapting today',
  text:  'No credit card required. Up and running in minutes.',
  cta:   { label: 'Create free account', href: '/signup' },
};

// ── Sanity raw fixtures ───────────────────────────────────────────────────────
// Each raw shape mirrors what Sanity's GROQ projection returns for the given
// key. Running mapSanityHero / mapSanityProof / mapSanityCTA on these values
// must produce the corresponding EXPECTED_* shape above.

export const SANITY_HERO_RAW: SanityHeroRaw = {
  _id:      'sanity-doc-hero-test',
  key:      HERO_KEY,                              // → id
  title:    EXPECTED_HERO.title,
  subtitle: EXPECTED_HERO.subtitle,
  // Legacy flat fields — mapper normalises these to ctas[0]
  ctaLabel: EXPECTED_HERO.ctas[0]!.label,          // → ctas[0].label
  ctaHref:  EXPECTED_HERO.ctas[0]!.href,           // → ctas[0].href
  tag:      EXPECTED_HERO.tag,
};

export const SANITY_HERO_NO_TAG_RAW: SanityHeroRaw = {
  _id:      'sanity-doc-hero-no-tag',
  key:      HERO_NO_TAG_KEY,
  title:    EXPECTED_HERO_NO_TAG.title,
  subtitle: EXPECTED_HERO_NO_TAG.subtitle,
  ctaLabel: EXPECTED_HERO_NO_TAG.ctas[0]!.label,
  ctaHref:  EXPECTED_HERO_NO_TAG.ctas[0]!.href,
  // tag intentionally absent → mapper produces tag: undefined
};

export const SANITY_PROOF_RAW: SanityProofRaw = {
  _id:   'sanity-doc-proof-test',
  key:   PROOF_KEY,                           // → id
  title: EXPECTED_PROOF.title,
  items: EXPECTED_PROOF.items satisfies SanityProofItemRaw[],
};

export const SANITY_CTA_RAW: SanityCTARaw = {
  _id:      'sanity-doc-cta-test',
  key:      CTA_KEY,                          // → id
  title:    EXPECTED_CTA.title,
  text:     EXPECTED_CTA.text,
  ctaLabel: EXPECTED_CTA.cta.label,           // → cta.label
  ctaHref:  EXPECTED_CTA.cta.href,            // → cta.href
};

// ── Storyblok story fixtures ──────────────────────────────────────────────────
// Each StoryblokStory<TContent> value mirrors what StoryblokClient.fetchStory()
// returns for the given slug. Running mapStoryblokHero / mapStoryblokProof /
// mapStoryblokCTA on story.content must produce the corresponding EXPECTED_*
// shape above.

function makeStory<TContent>(slug: string, content: TContent): StoryblokStory<TContent> {
  return { id: 1000, uuid: `uuid-${slug}`, full_slug: slug, content };
}

export const STORYBLOK_HERO_STORY: StoryblokStory<StoryblokHeroContent> = makeStory(
  `hero-variants/${HERO_KEY}`,
  {
    key:       HERO_KEY,                              // → id
    title:     EXPECTED_HERO.title,
    subtitle:  EXPECTED_HERO.subtitle,
    // Legacy flat fields — mapper normalises these to ctas[0]
    cta_label: EXPECTED_HERO.ctas[0]!.label,          // → ctas[0].label
    cta_href:  EXPECTED_HERO.ctas[0]!.href,           // → ctas[0].href
    tag:       EXPECTED_HERO.tag,
    is_active: true,
  },
);

export const STORYBLOK_HERO_NO_TAG_STORY: StoryblokStory<StoryblokHeroContent> = makeStory(
  `hero-variants/${HERO_NO_TAG_KEY}`,
  {
    key:       HERO_NO_TAG_KEY,
    title:     EXPECTED_HERO_NO_TAG.title,
    subtitle:  EXPECTED_HERO_NO_TAG.subtitle,
    cta_label: EXPECTED_HERO_NO_TAG.ctas[0]!.label,
    cta_href:  EXPECTED_HERO_NO_TAG.ctas[0]!.href,
    is_active: true,
    // tag intentionally absent → mapper produces tag: undefined
  } as StoryblokHeroContent,
);

export const STORYBLOK_PROOF_STORY: StoryblokStory<StoryblokProofContent> = makeStory(
  `proof-variants/${PROOF_KEY}`,
  {
    key:       PROOF_KEY,                     // → id
    title:     EXPECTED_PROOF.title,
    items:     EXPECTED_PROOF.items.map((item, i) => ({
      _uid:      `uid-proof-item-${i}`,
      component: 'proof_item',
      title:     item.title,
      text:      item.text,
    })),
    is_active: true,
  },
);

export const STORYBLOK_CTA_STORY: StoryblokStory<StoryblokCTAContent> = makeStory(
  `cta-variants/${CTA_KEY}`,
  {
    key:       CTA_KEY,                       // → id
    title:     EXPECTED_CTA.title,
    text:      EXPECTED_CTA.text,
    cta_label: EXPECTED_CTA.cta.label,        // → cta.label
    cta_href:  EXPECTED_CTA.cta.href,         // → cta.href
    is_active: true,
  },
);

// ── Statamic entry fixtures ────────────────────────────────────────────────
// Each StatamicXxxEntry value mirrors what StatamicClient.fetchEntry()
// returns for the given key. Running mapStatamicHero / mapStatamicProof /
// mapStatamicCTA on these values must produce the corresponding EXPECTED_*
// shape above.

export const STATAMIC_HERO_ENTRY: StatamicHeroEntry = {
  id:        'statamic-uuid-hero-test',
  slug:      'hero_test',
  key:       HERO_KEY,                               // → id
  title:     EXPECTED_HERO.title,
  subtitle:  EXPECTED_HERO.subtitle,
  // Legacy flat fields — mapper normalises these to ctas[0]
  cta_label: EXPECTED_HERO.ctas[0]!.label,           // → ctas[0].label
  cta_href:  EXPECTED_HERO.ctas[0]!.href,            // → ctas[0].href
  tag:       EXPECTED_HERO.tag,
  is_active: true,
};

export const STATAMIC_HERO_NO_TAG_ENTRY: StatamicHeroEntry = {
  id:        'statamic-uuid-hero-no-tag',
  slug:      'hero_test_no_tag',
  key:       HERO_NO_TAG_KEY,
  title:     EXPECTED_HERO_NO_TAG.title,
  subtitle:  EXPECTED_HERO_NO_TAG.subtitle,
  cta_label: EXPECTED_HERO_NO_TAG.ctas[0]!.label,
  cta_href:  EXPECTED_HERO_NO_TAG.ctas[0]!.href,
  is_active: true,
  // tag intentionally absent → mapper produces tag: undefined
};

export const STATAMIC_PROOF_ENTRY: StatamicProofEntry = {
  id:    'statamic-uuid-proof-test',
  slug:  'proof_test',
  key:   PROOF_KEY,                           // → id
  title: EXPECTED_PROOF.title,
  items: EXPECTED_PROOF.items.map((item) => ({
    title: item.title,
    text:  item.text,
  })),
  is_active: true,
};

export const STATAMIC_CTA_ENTRY: StatamicCTAEntry = {
  id:        'statamic-uuid-cta-test',
  slug:      'cta_test',
  key:       CTA_KEY,                         // → id
  title:     EXPECTED_CTA.title,
  text:      EXPECTED_CTA.text,
  cta_label: EXPECTED_CTA.cta.label,          // → cta.label
  cta_href:  EXPECTED_CTA.cta.href,           // → cta.href
  is_active: true,
};
