/**
 * Whether Leadinfo may be used for a visitor.
 *
 * Leadinfo recognises the company behind a visit from the IP address. That is
 * what the enrichment category asks the visitor's permission for, so without
 * it the browser does not load Leadinfo (components/tracking/LeadinfoProvider)
 * and the server keeps nothing of a result that is posted anyway
 * (app/api/enrichment/leadinfo): no mc_li cookie, no charge, no cache entry.
 */

import { readConsentFromCookieHeader } from "@/lib/consent/server-consent";

/** Whether the visitor behind this Cookie header allowed company recognition. */
export function leadinfoAllowed(cookieHeader: string | null): boolean {
  return readConsentFromCookieHeader(cookieHeader).enrichment === true;
}
