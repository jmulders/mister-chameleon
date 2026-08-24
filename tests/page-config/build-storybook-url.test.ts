/**
 * buildStorybookUrl — env-aware Storybook deep-links.
 *
 * The admin Block catalogue must not render a dead http://localhost Storybook
 * link in production. buildStorybookUrl therefore returns null unless a deployed
 * base URL is passed explicitly (from NEXT_PUBLIC_STORYBOOK_URL): no localhost
 * fallback.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStorybookUrl } from "../../page-config/block-catalogue.ts";

describe("buildStorybookUrl", () => {
  it("returns null when no base URL is configured (no localhost fallback)", () => {
    assert.equal(buildStorybookUrl("featureGrid"), null);
    assert.equal(buildStorybookUrl("featureGrid", ""), null);
    assert.equal(buildStorybookUrl("featureGrid", "   "), null);
    assert.equal(buildStorybookUrl("featureGrid", undefined), null);
  });

  it("builds a docs deep-link when a base URL is configured", () => {
    assert.equal(
      buildStorybookUrl("featureGrid", "https://storybook.example.com"),
      "https://storybook.example.com/?path=/docs/blocks-sections-featuregrid--docs",
    );
  });

  it("trims a trailing slash on the base URL", () => {
    assert.equal(
      buildStorybookUrl("featureGrid", "https://storybook.example.com/"),
      "https://storybook.example.com/?path=/docs/blocks-sections-featuregrid--docs",
    );
  });

  it("returns null for a block that has no story, even with a base URL", () => {
    // "image" is in BLOCKS_WITHOUT_STORIES (storybookSlug: null).
    assert.equal(buildStorybookUrl("image", "https://storybook.example.com"), null);
  });
});
