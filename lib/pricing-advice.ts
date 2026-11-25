/**
 * The advice above the plans on the price list, read from a variant of the
 * adaptive block `feature_page_prijzen`.
 *
 * The block is a feature block, so the owner edits it in the admin like any
 * other. The page reads three things from a variant: its title, the text of
 * its first card and the link under that card. A link of the form
 * `#pakket-<plan>` also names the plan the page lifts out.
 */

import type { AdaptiveVariantContent } from "@/cms/types";

export interface PricingAdvice {
  title:      string;
  text:       string;
  linkLabel?: string;
  linkHref?:  string;
  /** The plan the advice points at, when its link is `#pakket-<plan>`. */
  planId?:    string;
}

/**
 * @param content  A variant of the block.
 * @param planIds  The plans the page shows; a link to another name lifts none.
 * @returns the advice, or null when the variant has no title or no text.
 */
export function adviceFrom(content: AdaptiveVariantContent, planIds: readonly string[]): PricingAdvice | null {
  const item  = content.items?.[0];
  const title = content.title?.trim();
  const text  = (item?.body ?? item?.text ?? content.subtitle ?? "").trim();
  if (!title || !text) return null;

  const href  = item?.ctaHref?.trim() || undefined;
  const label = item?.cta?.trim() || undefined;
  // A link needs both its words and its address.
  const linked = Boolean(href && label);
  const named  = /^#pakket-([a-z0-9_-]+)$/.exec(href ?? "")?.[1];
  return {
    title,
    text,
    linkHref:  linked ? href : undefined,
    linkLabel: linked ? label : undefined,
    planId:    named && planIds.includes(named) ? named : undefined,
  };
}
