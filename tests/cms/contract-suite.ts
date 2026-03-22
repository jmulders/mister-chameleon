/**
 * CMSProvider Contract Test Suite
 *
 * A reusable test suite function that verifies any CMSProvider implementation
 * satisfies the interface contract defined in cms/providers/cms-provider.ts.
 *
 * ─── What the contract covers ────────────────────────────────────────────────
 *
 *   Shape contract    — each method returns an object whose fields match the
 *                       HeroBlockData / ProofBlockData / CTABlockData types.
 *
 *   Value contract    — for a given key, the returned object deep-equals the
 *                       fixture-defined expected output. This verifies that the
 *                       provider's mapping pipeline is correct end-to-end.
 *
 *   Null contract     — an unrecognised key must return null, never throw.
 *
 *   Async contract    — all three methods must return a Promise regardless of
 *                       whether the underlying implementation is sync or async.
 *
 *   Optional tag      — when a hero variant has no eyebrow tag, the `tag`
 *                       property must be undefined (not a non-string value).
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { runCMSProviderContractSuite } from '../contract-suite';
 *
 *   describe('CMSProvider contract — SanityProvider', () => {
 *     runCMSProviderContractSuite('SanityProvider', makeSanityProvider, {
 *       heroKey:      HERO_KEY,
 *       heroKeyNoTag: HERO_NO_TAG_KEY,
 *       proofKey:     PROOF_KEY,
 *       ctaKey:       CTA_KEY,
 *       expectedHero:      EXPECTED_HERO,
 *       expectedHeroNoTag: EXPECTED_HERO_NO_TAG,
 *       expectedProof:     EXPECTED_PROOF,
 *       expectedCTA:       EXPECTED_CTA,
 *     });
 *   });
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { CMSProvider } from '@/cms/providers/cms-provider';
import type { HeroBlockData, ProofBlockData, CTABlockData } from '@/cms/types';

// ── Setup type ────────────────────────────────────────────────────────────────

export interface CMSProviderContractSetup {
  /** A hero variant key that exists in the provider's data source. */
  heroKey: string;
  /** A proof variant key that exists in the provider's data source. */
  proofKey: string;
  /** A CTA variant key that exists in the provider's data source. */
  ctaKey: string;
  /** Expected output for heroKey. The suite asserts deep equality. */
  expectedHero: HeroBlockData;
  /** Expected output for proofKey. The suite asserts deep equality. */
  expectedProof: ProofBlockData;
  /** Expected output for ctaKey. The suite asserts deep equality. */
  expectedCTA: CTABlockData;
  /**
   * Optional: a second hero key whose content has no `tag` field.
   * When provided, the suite also asserts that tag === undefined.
   */
  heroKeyNoTag?: string;
  /** Expected output for heroKeyNoTag, including `tag: undefined`. */
  expectedHeroNoTag?: HeroBlockData;
}

// ── Contract suite ────────────────────────────────────────────────────────────

/**
 * Registers the shared CMSProvider contract tests under a `describe` block
 * labelled with `name`. Intended to be called from inside a wrapping
 * `describe` block in the provider-specific test file.
 *
 * @param name         Human-readable provider name (used as the describe label)
 * @param makeProvider Factory that returns a fresh, test-ready CMSProvider.
 *                     Called in `beforeEach` so each test gets a clean instance.
 * @param setup        Fixture data: variant keys and their expected output.
 */
export function runCMSProviderContractSuite(
  name: string,
  makeProvider: () => CMSProvider,
  setup: CMSProviderContractSetup,
): void {
  describe(name, () => {
    let provider: CMSProvider;

    beforeEach(() => {
      provider = makeProvider();
    });

    // ── Hero variant ─────────────────────────────────────────────────────────

    describe('getHeroVariant()', () => {
      it('returns the expected HeroBlockData for a known key', async () => {
        const result = await provider.getHeroVariant(setup.heroKey);
        assert.deepStrictEqual(result, setup.expectedHero);
      });

      it('result conforms to the HeroBlockData shape', async () => {
        const result = await provider.getHeroVariant(setup.heroKey);
        assert.ok(result !== null, 'expected non-null HeroBlockData for known key');
        assert.strictEqual(typeof result.id,        'string',  'id must be a string');
        assert.strictEqual(typeof result.title,     'string',  'title must be a string');
        assert.strictEqual(typeof result.subtitle,  'string',  'subtitle must be a string');
        assert.strictEqual(typeof result.cta.label, 'string',  'cta.label must be a string');
        assert.strictEqual(typeof result.cta.href,  'string',  'cta.href must be a string');
        assert.ok(
          result.tag === undefined || typeof result.tag === 'string',
          '`tag` must be a string or undefined',
        );
      });

      it('returns null for an unrecognised key', async () => {
        const result = await provider.getHeroVariant('__does_not_exist__');
        assert.strictEqual(result, null);
      });

      // Optional no-tag test — only runs when a second hero key is provided
      if (setup.heroKeyNoTag && setup.expectedHeroNoTag) {
        it('returns undefined (not a string) for `tag` when the content has none', async () => {
          const result = await provider.getHeroVariant(setup.heroKeyNoTag!);
          assert.deepStrictEqual(result, setup.expectedHeroNoTag);
          assert.strictEqual(result?.tag, undefined, '`tag` should be undefined when absent in CMS');
        });
      }
    });

    // ── Proof variant ─────────────────────────────────────────────────────────

    describe('getProofVariant()', () => {
      it('returns the expected ProofBlockData for a known key', async () => {
        const result = await provider.getProofVariant(setup.proofKey);
        assert.deepStrictEqual(result, setup.expectedProof);
      });

      it('result conforms to the ProofBlockData shape', async () => {
        const result = await provider.getProofVariant(setup.proofKey);
        assert.ok(result !== null, 'expected non-null ProofBlockData for known key');
        assert.strictEqual(typeof result.id,    'string',  'id must be a string');
        assert.strictEqual(typeof result.title, 'string',  'title must be a string');
        assert.ok(Array.isArray(result.items),             '`items` must be an array');
        assert.ok(result.items.length > 0,                 '`items` must be non-empty');
        for (const item of result.items) {
          assert.strictEqual(typeof item.title, 'string',  'item.title must be a string');
          assert.strictEqual(typeof item.text,  'string',  'item.text must be a string');
        }
      });

      it('returns null for an unrecognised key', async () => {
        const result = await provider.getProofVariant('__does_not_exist__');
        assert.strictEqual(result, null);
      });
    });

    // ── CTA variant ───────────────────────────────────────────────────────────

    describe('getCTAVariant()', () => {
      it('returns the expected CTABlockData for a known key', async () => {
        const result = await provider.getCTAVariant(setup.ctaKey);
        assert.deepStrictEqual(result, setup.expectedCTA);
      });

      it('result conforms to the CTABlockData shape', async () => {
        const result = await provider.getCTAVariant(setup.ctaKey);
        assert.ok(result !== null, 'expected non-null CTABlockData for known key');
        assert.strictEqual(typeof result.id,        'string',  'id must be a string');
        assert.strictEqual(typeof result.title,     'string',  'title must be a string');
        assert.strictEqual(typeof result.text,      'string',  'text must be a string');
        assert.strictEqual(typeof result.cta.label, 'string',  'cta.label must be a string');
        assert.strictEqual(typeof result.cta.href,  'string',  'cta.href must be a string');
      });

      it('returns null for an unrecognised key', async () => {
        const result = await provider.getCTAVariant('__does_not_exist__');
        assert.strictEqual(result, null);
      });
    });

    // ── Async interface contract ───────────────────────────────────────────────

    describe('interface contract', () => {
      it('getHeroVariant() returns a Promise', () => {
        const p = provider.getHeroVariant(setup.heroKey);
        assert.ok(p instanceof Promise, 'getHeroVariant must return a Promise');
        // Prevent UnhandledPromiseRejection warnings
        p.catch(() => {});
      });

      it('getProofVariant() returns a Promise', () => {
        const p = provider.getProofVariant(setup.proofKey);
        assert.ok(p instanceof Promise, 'getProofVariant must return a Promise');
        p.catch(() => {});
      });

      it('getCTAVariant() returns a Promise', () => {
        const p = provider.getCTAVariant(setup.ctaKey);
        assert.ok(p instanceof Promise, 'getCTAVariant must return a Promise');
        p.catch(() => {});
      });
    });
  });
}
