/**
 * CMS model helpers
 *
 * A tenant's pages are either managed on the platform itself (the built-in
 * platform CMS, provider "platform") or in an external CMS surfaced through the
 * addon / plugin / snippet integration (Sanity, Storyblok, Statamic, ...).
 *
 * The predicate below expresses "pages are managed on the platform", which is
 * the correct gate for platform-only surfaces (e.g. the page-variants
 * diagnostics). It deliberately keys on the provider, NOT on whether platform
 * `pages` rows happen to exist, because some external-CMS tenants have synced
 * page rows without the platform being the source of truth.
 */

import type { CMSProviderName } from "@/tenant/types";

/** True when the platform itself is the CMS (provider "platform"). */
export function isPlatformCmsProvider(provider: CMSProviderName | string | null | undefined): boolean {
  return provider === "platform";
}
