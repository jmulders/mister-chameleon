/**
 * StoryblokProvider — CMSProvider Contract Tests
 *
 * Verifies that StoryblokProvider satisfies the CMSProvider interface contract
 * using an injected MockStoryblokClient. No environment variables or network
 * calls are required — all data comes from the in-memory slug map.
 *
 * ─── Injection point ─────────────────────────────────────────────────────────
 *
 *   StoryblokProvider(client?: StoryblokClient)
 *
 *   The optional `client` constructor parameter lets tests inject a mock
 *   without any environment variable setup.
 *
 * ─── Coverage ────────────────────────────────────────────────────────────────
 *
 *   Shared contract  (via runCMSProviderContractSuite):
 *     • getHeroVariant  — value equality, shape, null for unknown key
 *     • getProofVariant — value equality, shape, null for unknown key
 *     • getCTAVariant   — value equality, shape, null for unknown key
 *     • hero without tag field → tag: undefined
 *     • all methods return a Promise
 *
 *   Storyblok-specific:
 *     • is_active: false → returns null (not served even if published)
 *     • network / fetch errors return null (never throw)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StoryblokProvider } from '@/cms/providers/storyblok-provider';
import { MockStoryblokClient } from './helpers/mock-storyblok-client';
import { runCMSProviderContractSuite } from './contract-suite';
import { heroVariantSlug, proofVariantSlug, ctaVariantSlug } from '@/cms/queries/storyblok';
import {
  HERO_KEY,
  HERO_NO_TAG_KEY,
  PROOF_KEY,
  CTA_KEY,
  EXPECTED_HERO,
  EXPECTED_HERO_NO_TAG,
  EXPECTED_PROOF,
  EXPECTED_CTA,
  STORYBLOK_HERO_STORY,
  STORYBLOK_HERO_NO_TAG_STORY,
  STORYBLOK_PROOF_STORY,
  STORYBLOK_CTA_STORY,
} from './fixtures/contract-fixtures';

// ── Mock client ───────────────────────────────────────────────────────────────

/**
 * Slug map for the mock client. Storyblok identifies stories by their full
 * slug (`folder/key`) rather than by a key param, so the lookup is keyed
 * by the full slug produced by the provider's slug builder functions.
 */
const SLUG_MAP = {
  [heroVariantSlug(HERO_KEY)]:        STORYBLOK_HERO_STORY,
  [heroVariantSlug(HERO_NO_TAG_KEY)]: STORYBLOK_HERO_NO_TAG_STORY,
  [proofVariantSlug(PROOF_KEY)]:      STORYBLOK_PROOF_STORY,
  [ctaVariantSlug(CTA_KEY)]:          STORYBLOK_CTA_STORY,
};

function makeStoryblokProvider(): StoryblokProvider {
  return new StoryblokProvider(new MockStoryblokClient(SLUG_MAP));
}

// ── Shared contract ───────────────────────────────────────────────────────────

describe('CMSProvider contract — StoryblokProvider', () => {
  runCMSProviderContractSuite('StoryblokProvider', makeStoryblokProvider, {
    heroKey:           HERO_KEY,
    heroKeyNoTag:      HERO_NO_TAG_KEY,
    proofKey:          PROOF_KEY,
    ctaKey:            CTA_KEY,
    expectedHero:      EXPECTED_HERO,
    expectedHeroNoTag: EXPECTED_HERO_NO_TAG,
    expectedProof:     EXPECTED_PROOF,
    expectedCTA:       EXPECTED_CTA,
  });

  // ── Storyblok-specific: is_active flag ─────────────────────────────────────
  //
  // Storyblok cannot filter on content fields server-side, so StoryblokProvider
  // checks `story.content.is_active` after fetching and returns null when false.
  // Sanity handles this at the GROQ query level (isActive == true guard), so
  // this check is unique to StoryblokProvider.

  describe('is_active flag (Storyblok-specific)', () => {
    it('returns null for a hero variant with is_active: false', async () => {
      const slugMap = {
        [heroVariantSlug(HERO_KEY)]: {
          ...STORYBLOK_HERO_STORY,
          content: { ...STORYBLOK_HERO_STORY.content, is_active: false },
        },
      };
      const provider = new StoryblokProvider(new MockStoryblokClient(slugMap));
      const result = await provider.getHeroVariant(HERO_KEY);
      assert.strictEqual(result, null, 'is_active:false hero must return null');
    });

    it('returns null for a proof variant with is_active: false', async () => {
      const slugMap = {
        [proofVariantSlug(PROOF_KEY)]: {
          ...STORYBLOK_PROOF_STORY,
          content: { ...STORYBLOK_PROOF_STORY.content, is_active: false },
        },
      };
      const provider = new StoryblokProvider(new MockStoryblokClient(slugMap));
      const result = await provider.getProofVariant(PROOF_KEY);
      assert.strictEqual(result, null, 'is_active:false proof must return null');
    });

    it('returns null for a CTA variant with is_active: false', async () => {
      const slugMap = {
        [ctaVariantSlug(CTA_KEY)]: {
          ...STORYBLOK_CTA_STORY,
          content: { ...STORYBLOK_CTA_STORY.content, is_active: false },
        },
      };
      const provider = new StoryblokProvider(new MockStoryblokClient(slugMap));
      const result = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(result, null, 'is_active:false CTA must return null');
    });

    it('returns data normally when is_active: true (sanity check)', async () => {
      const result = await makeStoryblokProvider().getHeroVariant(HERO_KEY);
      assert.deepStrictEqual(result, EXPECTED_HERO);
    });
  });

  // ── Storyblok-specific: error handling ─────────────────────────────────────

  describe('StoryblokProvider error handling', () => {
    it('returns null when the Storyblok client throws (e.g. API error)', async () => {
      const errorClient = new MockStoryblokClient({});
      // Override fetchStory to throw unconditionally
      errorClient.fetchStory = async (): Promise<never> => {
        throw new Error('Simulated Storyblok API error');
      };
      const provider = new StoryblokProvider(errorClient);
      const hero  = await provider.getHeroVariant(HERO_KEY);
      const proof = await provider.getProofVariant(PROOF_KEY);
      const cta   = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(hero,  null, 'getHeroVariant should return null on error');
      assert.strictEqual(proof, null, 'getProofVariant should return null on error');
      assert.strictEqual(cta,   null, 'getCTAVariant should return null on error');
    });
  });
});
