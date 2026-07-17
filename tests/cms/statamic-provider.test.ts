/**
 * StatamicProvider — CMSProvider Contract Tests
 *
 * Verifies that StatamicProvider satisfies the CMSProvider interface contract
 * without environment variables or network calls.
 *
 * ─── Injection point ───────────────────────────────────────────────────────
 *
 *   new StatamicProvider(client?, draftBlocks?, tenantId?)
 *
 *   `draftBlocks` pre-populates the provider's home-page Replicator cache, so
 *   the variant getters resolve from memory and never touch the API.
 *
 *   These tests used to inject a MockStatamicClient that overrode
 *   `fetchEntry(collection, key)`. That method is no longer on the provider's
 *   read path: variants moved from per-variant collection entries to Replicator
 *   sets on home.md (plus per-tenant overrides in the platform DB). The mock kept
 *   answering a question nobody asked, the provider found nothing, and every
 *   variant test asserted against `null` — for a provider that works fine in
 *   production. Injecting draftBlocks exercises the path the site actually uses.
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
 *     • enabled:   false → returns null (the Replicator set's own toggle)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatamicProvider } from '@/cms/providers/statamic-provider';
import { runCMSProviderContractSuite } from './contract-suite';
import { assertVariantEquals } from './helpers/assert-variant';
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

// ── Replicator blocks ──────────────────────────────────────────────────────
//
// A Replicator set is the entry's fields plus a `type` naming the set. The
// fixtures already carry the field shape, so the block is the fixture + type.

function heroSet(overrides: Record<string, unknown> = {}) {
  return { ...STATAMIC_HERO_ENTRY, type: 'hero_variant', ...overrides };
}

const DRAFT_BLOCKS: unknown[] = [
  heroSet(),
  { ...STATAMIC_HERO_NO_TAG_ENTRY, type: 'hero_variant'  },
  { ...STATAMIC_PROOF_ENTRY,       type: 'proof_variant' },
  { ...STATAMIC_CTA_ENTRY,         type: 'cta_variant'   },
];

/**
 * Build a provider whose home-page Replicator cache is pre-filled.
 *
 * tenantId is null, so the adaptive_blocks DB lookup finds no tenant row and the
 * Replicator catalog answers — which is exactly the fallback path being tested.
 */
function makeStatamicProvider(blocks: unknown[] = DRAFT_BLOCKS): StatamicProvider {
  return new StatamicProvider(undefined, blocks, null);
}

// ── Shared contract ────────────────────────────────────────────────────────

describe('CMSProvider contract — StatamicProvider', () => {
  runCMSProviderContractSuite('StatamicProvider', () => makeStatamicProvider(), {
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
  // `is_active` is a soft-disable, independent of Statamic's own publication
  // state: an entry can be published and still not be served.

  describe('is_active flag (Statamic-specific)', () => {
    it('returns null for a hero variant with is_active: false', async () => {
      const provider = makeStatamicProvider([heroSet({ is_active: false })]);
      const result   = await provider.getHeroVariant(HERO_KEY);
      assert.strictEqual(result, null, 'is_active:false hero must return null');
    });

    it('returns null for a proof variant with is_active: false', async () => {
      const provider = makeStatamicProvider([
        { ...STATAMIC_PROOF_ENTRY, type: 'proof_variant', is_active: false },
      ]);
      const result = await provider.getProofVariant(PROOF_KEY);
      assert.strictEqual(result, null, 'is_active:false proof must return null');
    });

    it('returns null for a CTA variant with is_active: false', async () => {
      const provider = makeStatamicProvider([
        { ...STATAMIC_CTA_ENTRY, type: 'cta_variant', is_active: false },
      ]);
      const result = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(result, null, 'is_active:false CTA must return null');
    });

    it('returns data normally when is_active: true (sanity check)', async () => {
      const result = await makeStatamicProvider().getHeroVariant(HERO_KEY);
      assertVariantEquals(result, EXPECTED_HERO);
    });
  });

  // ── Statamic-specific: the Replicator set's own enable toggle ───────────

  describe('enabled toggle (Statamic-specific)', () => {
    it('returns null for a hero variant with enabled: false', async () => {
      const provider = makeStatamicProvider([heroSet({ enabled: false })]);
      const result   = await provider.getHeroVariant(HERO_KEY);
      assert.strictEqual(result, null, 'enabled:false hero must return null');
    });
  });

  // ── Unknown key ────────────────────────────────────────────────────────

  describe('StatamicProvider unknown keys', () => {
    it('returns null when the Replicator catalog is empty (never throws)', async () => {
      const provider = makeStatamicProvider([]);
      const hero  = await provider.getHeroVariant(HERO_KEY);
      const proof = await provider.getProofVariant(PROOF_KEY);
      const cta   = await provider.getCTAVariant(CTA_KEY);
      assert.strictEqual(hero,  null, 'getHeroVariant should return null');
      assert.strictEqual(proof, null, 'getProofVariant should return null');
      assert.strictEqual(cta,   null, 'getCTAVariant should return null');
    });
  });
});
