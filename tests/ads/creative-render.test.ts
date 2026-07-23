/**
 * Contract test: an ad's `creative` JSON must render through renderBlockHtml.
 *
 * These are the canonical example creatives per slot type — the same shapes
 * documented in docs/design/ad-network-setup.md. If renderBlockHtml's expected
 * fields change, this test fails, so an advertiser's ads never silently render
 * to an empty block (the failure mode we hit with unverified CMS variant keys).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renderBlockHtml } from "../../lib/snippet/render-block-html.ts";

const EXAMPLES: Record<string, Record<string, unknown>> = {
  hero: {
    tag: "Sponsored",
    title: "Ship faster with Acme",
    subtitle: "The all-in-one toolkit for growing teams.",
    ctas: [{ label: "Try it free", href: "https://acme.test" }],
  },
  cta: {
    title: "Ready to switch?",
    text: "Join 5,000 teams already on Acme.",
    cta: { label: "Get started", href: "https://acme.test" },
  },
  notification: {
    message: "New: Acme AI is here.",
    severity: "info",
    ctaLabel: "See what's new",
    ctaHref: "https://acme.test",
  },
  proof: {
    title: "Trusted by teams everywhere",
    items: [{ title: "5,000+", text: "active teams" }, { title: "99.9%", text: "uptime" }],
  },
  feature: {
    title: "Why Acme",
    subtitle: "Everything in one place.",
    items: [{ title: "Fast", body: "Live in a day." }, { title: "Private", body: "No cookies." }],
  },
  conversion: {
    urgencyLabel: "Limited offer",
    title: "Start today",
    text: "20% off your first year.",
    ctas: [{ label: "Claim offer", href: "https://acme.test" }],
  },
};

describe("ad creative → renderBlockHtml contract", () => {
  for (const [slot, creative] of Object.entries(EXAMPLES)) {
    it(`renders a non-empty ${slot} block`, () => {
      const html = renderBlockHtml(slot, creative);
      assert.ok(html, `expected ${slot} creative to render`);
      // The headline/message text must appear in the output.
      const needle = String(creative.title ?? creative.message);
      assert.ok(html!.includes(needle), `expected "${needle}" in the ${slot} HTML`);
    });
  }

  it("returns null for an empty creative (never a bare shell)", () => {
    assert.equal(renderBlockHtml("hero", {}), null);
    assert.equal(renderBlockHtml("cta", {}), null);
  });

  it("keeps the CTA href (where the click-tracking URL is injected)", () => {
    const html = renderBlockHtml("hero", EXAMPLES.hero)!;
    assert.match(html, /href="https:\/\/acme\.test"/);
  });
});
