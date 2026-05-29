/**
 * Snippet Site Key Generator
 *
 * Generates a public site key used to identify a tenant when their
 * visitor's browser calls the `/api/snippet/decide` endpoint.
 *
 * ─── Format ────────────────────────────────────────────────────────────────────
 *
 *   sk_live_<16 random hex bytes>
 *
 *   Example: sk_live_[32 hex chars]
 *
 * ─── Security notes ────────────────────────────────────────────────────────────
 *
 *   The site key is intentionally PUBLIC — it is embedded in the page HTML and
 *   visible to anyone who views source.  It is an identifier, not a credential.
 *   It does not grant any write access or admin capabilities.
 *
 *   To invalidate a key (e.g. after it has been misused), the operator calls
 *   `generateSnippetSiteKeyAction` again.  The old key immediately stops working
 *   because the tenant lookup resolves by the stored key value.
 */

import { randomBytes } from "crypto";

/**
 * Generates a new `sk_live_*` site key using 16 cryptographically random bytes.
 * Safe to call from server-side code only.
 */
export function generateSiteKey(): string {
  const random = randomBytes(16).toString("hex");
  return `sk_live_${random}`;
}
