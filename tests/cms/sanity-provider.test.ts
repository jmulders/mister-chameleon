/**
 * SanityProvider — CMSProvider Contract Tests
 *
 * Verifies that SanityProvider satisfies the CMSProvider interface contract
 * using an injected mock SanityClient. No environment variables or network
 * calls are required — all data comes from the in-memory fixture lookup.
 *
 * ─── Injection point ─────────────────────────────────────────────────────────
 *
 *   SanityProvider(client?: SanityClient)
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
 *   Sanity-specific:
 *     • network / fetch errors return null (never throw)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SanityProvider } from '@/cms/providers/sanity-provider';
import { makeMockSanityClient } from './helpers/mock-sanity-client';
import { runCMSProviderContractSuite } from './contract-suite';
import {
  HERO_KEY,
  HERO_NO_TAG_KEY,
  PROOF_KEY,
  CTA_KEY,
  EXPECTED_HERO,
  EXPECTED_HERO_NO_TAG,
  EXPECTED_PROOF,
  EXPECTED_CTA,
  SANITY_HERO_RAW,
  SANITY_HERO_NO_TAG_RAW,
  SANITY_PROOF_RAW,
  SANITY_CTA_RAW,
} from './fixtures/contract-fixtures';

// ── Mock client ───────────────────────────────────────────────────────────────

/**
 * Flat lookup keyed by variant key — mirrors what a Sanity GROQ query returns
 * for each key. The mock SanityClient looks up by `params.key` so the query
 * string itself is irrelevant here (it's tested in integration, not unit tests).
 */
const SANITY_LOOKUP = {
  [HERO_KEY]:        SANITY_HERO_RAW,
  [HERO_NO_TAG_KEY]: SANITY_HERO_NO_TAG_RAW,
  [PROOF_KEY]:       SANITY_PROOF_RAW,
  [CTA_KEY]:         SANITY_CTA_RAW,
};

function makeSanityProvider(): SanityProvider {
  return new SanityProvider(makeMockSanityClient(SANITY_LOOKUP));
}

// ── Shared contract ───────────────────────────────────────────────────────────

describe('CMSProvider contract — SanityProvider', () => {
  runCMSProviderContractSuite('SanityProvider', makeSanityProvider, {
    heroKey:           HERO_KEY,
    heroKeyNoTag:      HERO_NO_TAG_KEY,
    proofKey:          PROOF_KEY,
    ctaKey:            CTA_KEY,
    expectedHero:      EXPECTED_HERO,
    expectedHeroNoTag: EXPECTED_HERO_NO_TAG,
    expectedProof:     EXPECTED_PROOF,
    expectedCTA:       EXPECTED_CTA,
  });

  // ── Sanity-specific: error handling ────────────────────────────────────────

  describe('SanityProvider error handling', () => {
    it('returns null when the Sanity client throws (e.g. network failure)', async () => {
      const errorClient = {
        fetch: async (): Promise<never> => {
          throw new Error('Simulated network failure');
        },
      };
      // Suppress expected warning log during test
      const provider = new SanityProvider(errorClient as never);
      const hero  = await provider.getHeroVariant(HERO_KEY);
      const proof = await provider.getProofVariant(PROOF_KEY);
      const cta   = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(hero,  null, 'getHeroVariant should return null on error');
      assert.strictEqual(proof, null, 'getProofVariant should return null on error');
      assert.strictEqual(cta,   null, 'getCTAVariant should return null on error');
    });

    it('returns null when the Sanity client returns null (GROQ found no document)', async () => {
      const nullClient = {
        fetch: async (): Promise<null> => null,
      };
      const provider = new SanityProvider(nullClient as never);
      const result = await provider.getHeroVariant(HERO_KEY);
      assert.strictEqual(result, null);
    });
  });
});
