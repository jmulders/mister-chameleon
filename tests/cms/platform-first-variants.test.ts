/**
 * platformFirstVariants — tenant-precedence resolution (snippet path)
 *
 * The snippet path resolves adaptive variants "platform-first": the platform
 * store (platform_cms_content) wins, the tenant's own CMS is a fallback. That
 * silently shadowed a tenant's adaptive_blocks edit when a like-named platform
 * entry existed. The surgical fix: when the tenant has authored their OWN
 * adaptive_blocks row for a key, that row WINS; otherwise platform-first is
 * unchanged.
 *
 * These tests inject fakes for the platform source, the tenant-adaptive-row
 * check, and the fallback CMS provider, so no database is involved.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { platformFirstVariants, type VariantResolver } from "@/cms/providers/platform-first-variants";
import type { CMSProvider } from "@/cms/providers/cms-provider";
import type { HeroBlockData } from "@/cms/types";

const TENANT = "acme";
const KEY    = "hero_matrix_homepage";

const hero = (id: string): HeroBlockData => ({ id } as unknown as HeroBlockData);

/** A fallback CMSProvider whose hero variant is served from the tenant's adaptive block. */
function fakeFallback(heroValue: HeroBlockData | null): { provider: CMSProvider; calls: () => number } {
  let calls = 0;
  const provider = {
    getHeroVariant: async (_k: string) => { calls++; return heroValue; },
  } as unknown as CMSProvider;
  return { provider, calls: () => calls };
}

/** A fake platform source. */
function fakePlatform(heroValue: HeroBlockData | null): { platform: VariantResolver; calls: () => number } {
  let calls = 0;
  const platform = {
    getHeroVariant:         async (_k: string) => { calls++; return heroValue; },
    getProofVariant:        async () => null,
    getCTAVariant:          async () => null,
    getFeatureVariant:      async () => null,
    getConversionVariant:   async () => null,
    getNotificationVariant: async () => null,
  } as VariantResolver;
  return { platform, calls: () => calls };
}

describe("platformFirstVariants — tenant precedence", () => {

  it("tenant adaptive row WINS over a like-named platform entry", async () => {
    const fallback = fakeFallback(hero("tenant"));
    const platform = fakePlatform(hero("platform"));

    const r = platformFirstVariants(TENANT, fallback.provider, {
      platform: platform.platform,
      hasTenantAdaptiveRow:    async () => true,
      hasPlatformContentEntry: async () => true, // a shadowing platform entry exists
    });

    const out = await r.getHeroVariant(KEY);
    assert.equal(out?.id, "tenant", "tenant adaptive block must win");
    assert.equal(platform.calls(), 0, "platform must not be consulted when the tenant row wins");
  });

  it("no tenant row → platform-first (platform wins, fallback not consulted)", async () => {
    const fallback = fakeFallback(hero("tenant"));
    const platform = fakePlatform(hero("platform"));

    const r = platformFirstVariants(TENANT, fallback.provider, {
      platform: platform.platform,
      hasTenantAdaptiveRow:    async () => false,
      hasPlatformContentEntry: async () => false,
    });

    const out = await r.getHeroVariant(KEY);
    assert.equal(out?.id, "platform", "platform must win when there is no tenant row");
    assert.equal(fallback.calls(), 0, "fallback must not be consulted when the platform has a hit");
  });

  it("no tenant row + empty platform → falls back to the tenant CMS", async () => {
    const fallback = fakeFallback(hero("cms"));
    const platform = fakePlatform(null);

    const r = platformFirstVariants(TENANT, fallback.provider, {
      platform: platform.platform,
      hasTenantAdaptiveRow:    async () => false,
      hasPlatformContentEntry: async () => false,
    });

    const out = await r.getHeroVariant(KEY);
    assert.equal(out?.id, "cms", "fallback CMS is used when both tenant row and platform are absent");
  });

  it("tenant row exists but yields nothing servable → platform-first still applies", async () => {
    const fallback = fakeFallback(null); // e.g. a wrong-type row that maps to nothing
    const platform = fakePlatform(hero("platform"));

    const r = platformFirstVariants(TENANT, fallback.provider, {
      platform: platform.platform,
      hasTenantAdaptiveRow:    async () => true,
      hasPlatformContentEntry: async () => false,
    });

    const out = await r.getHeroVariant(KEY);
    assert.equal(out?.id, "platform", "no servable tenant hit → platform-first");
  });
});
