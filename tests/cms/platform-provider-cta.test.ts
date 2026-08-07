/**
 * PlatformCMSProvider — CTA content normalisation
 *
 * Platform CTA content is authored with a `ctas: [{label, href}]` array (the
 * same shape as hero), but every CTA consumer reads a single `cta: {label,
 * href}`. normalizePlatformCTAContent() bridges that gap the same way the
 * Statamic provider does (ctas[0] → cta). These tests pin that behaviour so a
 * platform-hosted CTA block never regresses back to the undefined-`cta` crash.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlatformCTAContent } from '@/cms/providers/platform-provider';
import type { CTABlockData } from '@/cms/types';

describe('normalizePlatformCTAContent', () => {
  it('derives a singular cta from the first ctas entry', () => {
    const raw = {
      id: 'cta_guide',
      title: 'Klaar om te kiezen?',
      text: 'Vraag vrijblijvend een offerte aan.',
      ctas: [
        { label: 'Offerte aanvragen', href: '/contact', variant: 'primary' },
        { label: 'Bel ons', href: '/bellen', variant: 'secondary' },
      ],
    } as unknown as CTABlockData;

    const out = normalizePlatformCTAContent(raw);
    assert.deepEqual(out.cta, { label: 'Offerte aanvragen', href: '/contact' });
    assert.equal(out.title, 'Klaar om te kiezen?');
  });

  it('keeps an explicit, complete singular cta when present', () => {
    const raw: CTABlockData = {
      id: 'cta_service',
      title: 'Onderhoud nodig?',
      text: 'Plan het direct in.',
      cta: { label: 'Onderhoud inplannen', href: '/contact' },
    };

    const out = normalizePlatformCTAContent(raw);
    assert.deepEqual(out.cta, { label: 'Onderhoud inplannen', href: '/contact' });
  });

  it('falls back to safe defaults when there is no cta and no ctas', () => {
    const raw = {
      id: 'cta_empty',
      title: 'Titel',
      text: 'Tekst',
    } as unknown as CTABlockData;

    const out = normalizePlatformCTAContent(raw);
    assert.deepEqual(out.cta, { label: '', href: '#' });
  });

  it('derives from ctas when the singular cta is malformed (missing href)', () => {
    const raw = {
      id: 'cta_partial',
      title: 'Titel',
      text: 'Tekst',
      cta: { label: 'Alleen label' },
      ctas: [{ label: 'Uit ctas', href: '/from-ctas' }],
    } as unknown as CTABlockData;

    const out = normalizePlatformCTAContent(raw);
    assert.deepEqual(out.cta, { label: 'Uit ctas', href: '/from-ctas' });
  });
});
