/**
 * The colours stop with the content when the month's sessions are used up.
 *
 * Over the plan limit a visitor gets the default content: the decision
 * pipeline skips the rules (billing/plan-enforcement.ts). The theme is decided
 * in another place, in the layouts, and that place did not look at the limit.
 * A tenant over the limit kept the personalised colours: the evening theme,
 * the Christmas theme, the theme of a campaign. "Personalisation stops" was
 * half true.
 *
 * Both theme decisions (the page-wide one in request-theme.ts and the block
 * tokens in contextual-block-tokens.ts) ask this first. The verdict is the one
 * the content path uses, remembered for a minute, so the page waits for
 * nothing extra.
 */

import "server-only";
import { checkSessionSoftCapRemembered } from "@/billing/plan-enforcement";

/**
 * True when the tenant is over the month's session limit, so no theme rule
 * may be applied. A failed read answers false: a visitor keeps the colours
 * rather than losing them over a database hiccup, as the content path does.
 */
export async function themeStoppedBySessionLimit(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  try {
    return (await checkSessionSoftCapRemembered(tenantId)).overLimit === true;
  } catch {
    return false;
  }
}
