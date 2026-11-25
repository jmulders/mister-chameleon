/**
 * Which hero a CMS inner page shows.
 *
 * An inner page has one hero slot. Two things can fill it:
 *
 *   - the compact banner the rule engine picks for this visitor
 *     (`hero_page_banner_*`), the same on every page, and
 *   - the hero the CMS author set on the page itself.
 *
 * The banner used to win always, so every page opened with the same heading
 * and none of them said what the page was about. A page that names its own
 * hero now keeps it. Its key starts with `hero_page_` (for example
 * `hero_page_prijzen`), which tells it apart from the generic keys a page
 * template hands out (`hero_default`, `hero_page_banner_awareness`): those
 * still give way to the banner, so existing pages do not change.
 *
 * The banner stays on the slot as a fallback, for a page whose own hero has no
 * content yet.
 *
 * A page's own hero can still speak to the visitor. Its block may hold a
 * variant per audience, filed under the hero key the rule engine picks for
 * that audience (`hero_role_bureau`, say). The slot carries that key as the
 * preferred variant, so an agency owner reads the features page with an
 * intro for agencies, under the same heading as everyone else.
 *
 * Pure: no I/O.
 */

const PAGE_OWNED_PREFIX = "hero_page_";
const BANNER_PREFIX     = "hero_page_banner";

/** True for a hero key that belongs to one page, e.g. `hero_page_prijzen`. */
export function isPageOwnedHeroKey(key: string | null | undefined): boolean {
  if (typeof key !== "string") return false;
  return key.startsWith(PAGE_OWNED_PREFIX) && !key.startsWith(BANNER_PREFIX);
}

/**
 * True for a key that belongs to one page in any slot: `hero_page_prijzen`,
 * `feature_page_functies`, `proof_page_integraties`.
 *
 * A hero is the page's own heading. In the other slots a page-owned block is a
 * section of that page which may read differently per audience, or exist for
 * some audiences only: its default may be left empty, and then the section is
 * there for the visitors it has a variant for and absent for everyone else.
 */
export function isPageOwnedSlotKey(slotId: string, key: string | null | undefined): boolean {
  if (slotId === "hero") return isPageOwnedHeroKey(key);
  return typeof key === "string" && slotId !== "" && key.startsWith(`${slotId}_page_`);
}

/**
 * The slot of a page-owned section, with the variant to prefer.
 *
 * The rule engine must not swap such a section for the block it picked for
 * this slot (a page about integrations keeps its own section), so the key
 * stays. What the engine does decide is who is reading: the hero it picked
 * names the audience, and a page-owned block files its variants under that
 * same key. One key per audience, on every page and in every slot.
 */
export function resolvePageOwnedSlotKeys(
  pageKey:     string,
  planHeroKey: string | null | undefined,
): { variantKey: string; preferredVariantKey?: string } {
  return planHeroKey && planHeroKey !== pageKey
    ? { variantKey: pageKey, preferredVariantKey: planHeroKey }
    : { variantKey: pageKey };
}

export type HeroSlotKeys = {
  variantKey:           string;
  fallbackVariantKey?:  string;
  preferredVariantKey?: string;
};

/**
 * @param pageKey     the key the CMS author set on the page's hero slot
 * @param bannerKey   the banner the rule engine picked, when it picked one
 * @param planHeroKey the hero the rule engine picked for this visitor. On a
 *                    page with its own hero it names the variant of that hero
 *                    to prefer, never a different block.
 */
export function resolveHeroSlotKeys(
  pageKey:      string,
  bannerKey:    string | undefined,
  planHeroKey?: string | null,
): HeroSlotKeys {
  if (isPageOwnedHeroKey(pageKey)) {
    return {
      variantKey: pageKey,
      ...(bannerKey && bannerKey !== pageKey ? { fallbackVariantKey: bannerKey } : {}),
      ...(planHeroKey && planHeroKey !== pageKey ? { preferredVariantKey: planHeroKey } : {}),
    };
  }
  return { variantKey: bannerKey ?? pageKey };
}
