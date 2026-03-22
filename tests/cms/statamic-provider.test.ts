/**
 * StatamicProvider — CMSProvider Contract Tests
 *
 * Verifies that StatamicProvider satisfies the CMSProvider interface contract
 * using an injected MockStatamicClient. No environment variables or network
 * calls are required — all data comes from the in-memory entry map.
 *
 * ─── Injection point ───────────────────────────────────────────────────────
 *
 *   StatamicProvider(client?: StatamicClient)
 *
 *   The optional `client` constructor parameter lets tests inject a mock
 *   without any environment variable setup.
 *
 * ─── Coverage ──────────────────────────────────────────────────────────────
 *
 *   Shared contract  (via runCMSProviderContractSuite):
 *     • getHeroVariant  — value equality, shape, null for unknown key
 *     • getProofVariant — value equality, shape, null for unknown key
 *     • getCTAVariant   — value equality, shape, null for unknown key
 *     • hero without tag field → tag: undefined
 *     • all methods return a Promise
 *
 *   Statamic-specific:
 *     • is_active: false → returns null (not served even if published)
 *     • network / fetch errors return null (never throw)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatamicProvider } from '@/cms/providers/statamic-provider';
import { MockStatamicClient } from './helpers/mock-statamic-client';
import { runCMSProviderContractSuite } from './contract-suite';
import {
  HERO_VARIANTS_COLLECTION,
  PROOF_VARIANTS_COLLECTION,
  CTA_VARIANTS_COLLECTION,
} from '@/cms/queries/statamic';
import {
  HERO_KEY,
  HERO_NO_TAG_KEY,
  PROOF_KEY,
  CTA_KEY,
  EXPECTED_HERO,
  EXPECTED_HERO_NO_TAG,
  EXPECTED_PROOF,
  EXPECTED_CTA,
  STATAMIC_HERO_ENTRY,
  STATAMIC_HERO_NO_TAG_ENTRY,
  STATAMIC_PROOF_ENTRY,
  STATAMIC_CTA_ENTRY,
} from './fixtures/contract-fixtures';

// ── Mock client ────────────────────────────────────────────────────────────

/**
 * Entry map for the mock client. Statamic identifies entries by their
 * collection and key, so the lookup is keyed by "collection/key".
 */
const ENTRY_MAP = {
  [`${HERO_VARIANTS_COLLECTION}/${HERO_KEY}`]:           STATAMIC_HERO_ENTRY,
  [`${HERO_VARIANTS_COLLECTION}/${HERO_NO_TAG_KEY}`]:    STATAMIC_HERO_NO_TAG_ENTRY,
  [`${PROOF_VARIANTS_COLLECTION}/${PROOF_KEY}`]:         STATAMIC_PROOF_ENTRY,
  [`${CTA_VARIANTS_COLLECTION}/${CTA_KEY}`]:             STATAMIC_CTA_ENTRY,
};

function makeStatamicProvider(): StatamicProvider {
  return new StatamicProvider(new MockStatamicClient(ENTRY_MAP));
}

// ── Shared contract ────────────────────────────────────────────────────────

describe('CMSProvider contract — StatamicProvider', () => {
  runCMSProviderContractSuite('StatamicProvider', makeStatamicProvider, {
    heroKey:           HERO_KEY,
    heroKeyNoTag:      HERO_NO_TAG_KEY,
    proofKey:          PROOF_KEY,
    ctaKey:            CTA_KEY,
    expectedHero:      EXPECTED_HERO,
    expectedHeroNoTag: EXPECTED_HERO_NO_TAG,
    expectedProof:     EXPECTED_PROOF,
    expectedCTA:       EXPECTED_CTA,
  });

  // ── Statamic-specific: is_active flag ──────────────────────────────────
  //
  // Statamic's REST API returns published entries only (per collection config),
  // but the `is_active` field is a soft-disable. StatamicProvider checks
  // `entry.is_active` after fetching and returns null when false.

  describe('is_active flag (Statamic-specific)', () => {
    it('returns null for a hero variant with is_active: false', async () => {
      const entryMap = {
        [`${HERO_VARIANTS_COLLECTION}/${HERO_KEY}`]: {
          ...STATAMIC_HERO_ENTRY,
          is_active: false,
        },
      };
      const provider = new StatamicProvider(new MockStatamicClient(entryMap));
      const result = await provider.getHeroVariant(HERO_KEY);
      assert.strictEqual(result, null, 'is_active:false hero must return null');
    });

    it('returns null for a proof variant with is_active: false', async () => {
      const entryMap = {
        [`${PROOF_VARIANTS_COLLECTION}/${PROOF_KEY}`]: {
          ...STATAMIC_PROOF_ENTRY,
          is_active: false,
        },
      };
      const provider = new StatamicProvider(new MockStatamicClient(entryMap));
      const result = await provider.getProofVariant(PROOF_KEY);
      assert.strictEqual(result, null, 'is_active:false proof must return null');
    });

    it('returns null for a CTA variant with is_active: false', async () => {
      const entryMap = {
        [`${CTA_VARIANTS_COLLECTION}/${CTA_KEY}`]: {
          ...STATAMIC_CTA_ENTRY,
          is_active: false,
        },
      };
      const provider = new StatamicProvider(new MockStatamicClient(entryMap));
      const result = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(result, null, 'is_active:false CTA must return null');
    });

    it('returns data normally when is_active: true (sanity check)', async () => {
      const result = await makeStatamicProvider().getHeroVariant(HERO_KEY);
      assert.deepStrictEqual(result, EXPECTED_HERO);
    });
  });

  // ── Statamic-specific: error handling ──────────────────────────────────

  describe('StatamicProvider error handling', () => {
    it('returns null when the Statamic client throws (e.g. API error)', async () => {
      const errorClient = new MockStatamicClient({});
      // Override fetchEntry to throw unconditionally
      errorClient.fetchEntry = async (): Promise<never> => {
        throw new Error('Simulated Statamic API error');
      };
      const provider = new StatamicProvider(errorClient);
      const hero  = await provider.getHeroVariant(HERO_KEY);
      const proof = await provider.getProofVariant(PROOF_KEY);
      const cta   = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(hero,  null, 'getHeroVariant should return null on error');
      assert.strictEqual(proof, null, 'getProofVariant should return null on error');
      assert.strictEqual(cta,   null, 'getCTAVariant should return null on error');
    });
  });
});
