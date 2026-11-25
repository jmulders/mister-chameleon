/**
 * The variant of a page's own block that this visitor should see, for a page
 * that is not rendered from CMS slots.
 *
 * A CMS page gets this for free: its slots go through the decision and the
 * renderer picks the variant (see lib/page-hero-key.ts). Two kinds of page
 * cannot take that road:
 *
 *   - a page written in code, such as the price list, which has no slots;
 *   - an article or a case, which keeps a block of its own (its closing call to
 *     action) and should only give it up when the page's block has something
 *     to say to this visitor.
 *
 * Both ask the same question: "does block X have a variant for the audience
 * the rules picked?" This answers it, with the same decision a CMS page runs.
 *
 * It costs nothing for a tenant that has no such block, or a block without
 * variants: the block is read first (remembered for about a minute) and the
 * decision only runs when there is a variant to choose.
 */

import { headers } from "next/headers";
import { createCMSProvider } from "@/cms";
import type { AdaptiveVariantContent } from "@/cms/types";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { resolveSlugPageConfig } from "@/lib/cms-page-decision";
import { resolveAdaptiveVariant } from "@/lib/tokens/resolve-adaptive-variant";
import type { TokenContext } from "@/lib/tokens/parse-tokens";
import type { ContextSlotId, PageConfig, ResolvedContextSlot } from "@/page-config";

export interface OwnBlockVariant {
  /** The slot as the decision resolved it: the block's key and the preferred variant. */
  slot:         ResolvedContextSlot;
  /** The variant's content, as stored: merge tags are not filled in. */
  content:      AdaptiveVariantContent;
  tokenContext: TokenContext | null;
}

/**
 * @param path    The page's path without a leading slash, e.g. "prijzen" or "blog/my-article".
 * @param slotId  The kind of block: "feature", "cta", "proof".
 * @param key     The block's key, `<slotId>_page_<name>`.
 * @returns the variant for this visitor, or null when the visitor gets the
 *          page as it is (no such block, no variant for this audience, a bot,
 *          the control group, or a failed decision).
 */
export async function resolveOwnBlockVariant(
  path:   string,
  slotId: ContextSlotId,
  key:    string,
): Promise<OwnBlockVariant | null> {
  try {
    const { tenantId } = await getActiveTenant();
    const tenant       = await getTenantForRender(tenantId ?? "");
    const block        = await createCMSProvider(tenant?.cms, tenantId).getAdaptiveBlock(key);
    if (!block?.isActive || !block.adaptiveVariants?.length) return null;

    const headerStore = await headers();
    const proto       = headerStore.get("x-forwarded-proto") ?? "http";
    const request     = new Request(
      `${proto}://${headerStore.get("host") ?? "localhost"}/${path}`,
      { headers: headerStore },
    );

    const slot: ResolvedContextSlot = { slotId, variantKey: key };
    const config: PageConfig = {
      pageId:        `own-block:${path}`,
      slug:          path,
      title:         path,
      templateKey:   "marketing-page",
      pageItems:     [{ kind: "slot", slot }],
      contextSlots:  [slot],
      contentBlocks: [],
      seo:           {},
    };

    const { pageConfig, tokenContext } = await resolveSlugPageConfig(
      request,
      headerStore.get("cookie"),
      path,
      config,
      tenant,
      tenantId ?? "",
    );

    const resolved  = pageConfig.contextSlots[0];
    const preferred = resolved?.preferredVariantKey;
    if (!resolved || !preferred) return null;

    // No merge tags here. The renderer fills them in for a slot it draws, and
    // a variant of a section has no subtitle, which the tag parser expects.
    const match = resolveAdaptiveVariant(block, { variantKey: preferred });
    if (match.isDefault) return null;

    return { slot: resolved, content: match.content, tokenContext };
  } catch {
    // A page must never fail on its extras: the visitor gets the page as it is.
    return null;
  }
}
