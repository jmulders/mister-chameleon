/**
 * Design Token Extractor — Server Actions
 *
 * Accessible at /admin/platform/token-extractor.
 *
 * extractDesignTokensFromUrlAction — fetch a public URL, distil a grouped
 * design-token set from its CSS (see lib/design-tokens/url-token-extractor).
 *
 * Security: requires a valid admin session (mc_admin_token cookie). The
 * extractor only follows public http/https URLs and blocks internal hosts.
 */

"use server";

import { cookies } from "next/headers";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) return { ok: false, error: "No admin session — please log in." };
  const session = await verifySession(token);
  if (!session) return { ok: false, error: "Admin session expired — please log in again." };
  if (session.twoFaEnabled && !session.twoFaVerified)
    return { ok: false, error: "Two-factor authentication required." };
  return { ok: true };
}

export type ExtractTokensResult =
  | { ok: true;  tokens: Record<string, unknown>; blockTokens: Record<string, string>; notes: string[]; pagesAnalyzed: number }
  | { ok: false; error: string };

export async function extractDesignTokensFromUrlAction(url: string, maxPages = 5): Promise<ExtractTokensResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, error: "Voer een URL in." };
  }

  const pages = Math.min(Math.max(Math.trunc(Number(maxPages)) || 1, 1), 8);

  const { extractTokensFromSite } = await import("@/lib/design-tokens/url-token-extractor");
  const result = await extractTokensFromSite(url.trim(), pages);
  if (!result.ok) return { ok: false, error: result.error ?? "Kon geen tokens extraheren." };

  return {
    ok:            true,
    tokens:        result.tokens ?? {},
    blockTokens:   result.blockTokens ?? {},
    notes:         result.notes ?? [],
    pagesAnalyzed: result.pagesAnalyzed ?? 1,
  };
}
