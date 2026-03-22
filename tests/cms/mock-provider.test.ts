/**
 * MockCMSProvider — CMSProvider Contract Tests
 *
 * Verifies that MockCMSProvider satisfies the CMSProvider interface contract.
 * MockCMSProvider requires no injection or mocking — it is entirely self-
 * contained with hard-coded in-memory data.
 *
 * ─── Why test Mock? ───────────────────────────────────────────────────────────
 *
 *   1. MockCMSProvider is the production fallback when no CMS is configured.
 *      Running the contract suite against it confirms its output is contract-
 *      compliant and guards against accidental regressions in the mock data.
 *
 *   2. The expected values below are "pinned" snapshots of the mock data.
 *      If someone accidentally changes MockCMSProvider's hard-coded content,
 *      these tests will catch it before it reaches the real site.
 *
 * ─── Coverage ────────────────────────────────────────────────────────────────
 *
 *   Shared contract  (via runCMSProviderContractSuite):
 *     • getHeroVariant  — value equality, shape, null for unknown key
 *     • getProofVariant — value equality, shape, null for unknown key
 *     • getCTAVariant   — value equality, shape, null for unknown key
 *     • all methods return a Promise
 */

import { describe } from 'node:test';
import { MockCMSProvider } from '@/cms/providers/mock-provider';
import type { HeroBlockData, ProofBlockData, CTABlockData } from '@/cms/types';
import { runCMSProviderContractSuite } from './contract-suite';

// ── Pinned expected output ────────────────────────────────────────────────────
// These values are copied from MockCMSProvider's hard-coded data. They serve
// as a regression guard — any unintended change to the mock content will cause
// a test failure here before it ships to production.

const EXPECTED_MOCK_HERO: HeroBlockData = {
  id:       'hero_google_problem',
  tag:      'Stop sending every visitor to the same page',
  title:    "Your website speaks to no one.\nFix that in minutes.",
  subtitle: "Most visitors leave because your homepage wasn't written for them. " +
            'Mister Chameleon detects where they came from and instantly serves ' +
            'the version of your site that converts.',
  cta: { label: 'See how it works', href: '#how-it-works' },
};

const EXPECTED_MOCK_PROOF: ProofBlockData = {
  id:    'proof_cases',
  title: 'Conversion lifts that speak for themselves',
  items: [
    {
      title: '3.2× more qualified leads',
      text:  'SaaS teams using Mister Chameleon see an average 3.2× lift in demo ' +
             'requests within 30 days of going live — no engineering changes required.',
    },
    {
      title: 'First experience live in < 5 minutes',
      text:  'Connect your domain, define two rules, and your first adaptive experience ' +
             'is live. Most teams are shipping within a single afternoon.',
    },
    {
      title: '12 visitor signals, evaluated in real time',
      text:  'Source, device, campaign, recency, and more — every visit triggers a ' +
             'silent evaluation so the right experience loads before the page paints.',
    },
  ],
};

const EXPECTED_MOCK_CTA: CTABlockData = {
  id:    'cta_guide',
  title: 'Get the Adaptive Website Playbook',
  text:  'A practical, no-fluff guide to personalising your homepage for your three ' +
         'highest-value traffic sources. Free. No email gate.',
  cta: { label: 'Download the playbook', href: '#playbook' },
};

// ── Contract tests ────────────────────────────────────────────────────────────

describe('CMSProvider contract — MockCMSProvider', () => {
  runCMSProviderContractSuite('MockCMSProvider', () => new MockCMSProvider(), {
    heroKey:       'hero_google_problem',
    proofKey:      'proof_cases',
    ctaKey:        'cta_guide',
    expectedHero:  EXPECTED_MOCK_HERO,
    expectedProof: EXPECTED_MOCK_PROOF,
    expectedCTA:   EXPECTED_MOCK_CTA,
    // MockCMSProvider's three heroes all have `tag` set, so we don't exercise
    // the no-tag branch here — that coverage lives in the Sanity and Storyblok
    // provider tests where we control the raw fixture data.
  });
});
