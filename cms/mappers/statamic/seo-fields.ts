/**
 * The SEO fields of a Statamic entry, as the page layer expects them.
 *
 * The pages blueprint has a tab with seo_title, seo_description, robots_noindex,
 * robots_nofollow, canonical_url and three og_* fields. This is the one place
 * that reads them, for pages and for collection entries alike.
 *
 * An emptied field in the control panel arrives as "" or null. Both mean "not
 * set", so the page falls back to its own title instead of showing an empty
 * <title>.
 *
 * Pure apart from the asset resolver that is passed in.
 */

export type StatamicAssetField =
  | Array<{ url?: string; permalink?: string } | string>
  | string
  | null
  | undefined;

export interface MappedSeoFields {
  seoTitle?:       string;
  seoDescription?: string;
  robots?:         { noindex: boolean; nofollow: boolean };
  canonicalUrl?:   string;
  ogTitle?:        string;
  ogDescription?:  string;
  ogImage?:        string;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** A Statamic toggle: true, or the strings the API sometimes sends for it. */
function on(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function mapStatamicSeoFields(
  entry: Record<string, unknown>,
  resolveAsset: (field: StatamicAssetField) => string | undefined,
): MappedSeoFields {
  const noindex  = on(entry.robots_noindex);
  const nofollow = on(entry.robots_nofollow);

  return {
    seoTitle:       text(entry.seo_title),
    seoDescription: text(entry.seo_description),
    robots:         noindex || nofollow ? { noindex, nofollow } : undefined,
    canonicalUrl:   text(entry.canonical_url),
    ogTitle:        text(entry.og_title),
    ogDescription:  text(entry.og_description),
    ogImage:        resolveAsset(entry.og_image as StatamicAssetField),
  };
}
