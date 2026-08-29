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

  // Resolve the shared render config (demo_importer settings: renderEnabled +
  // renderTimeoutMs). When rendering is enabled, the extractor captures the
  // start page through the self-hosted headless Chrome so tokens come from the
  // JS-built DOM — consistent with Mirror. Any failure here degrades to a plain
  // fetch (render stays undefined).
  let render;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { resolveRenderConfig } = await import("@/demo/site-render");
    const client = createClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false } },
    );
    render = await resolveRenderConfig(client);
  } catch {
    render = undefined;
  }

  const { extractTokensFromSite } = await import("@/lib/design-tokens/url-token-extractor");
  const result = await extractTokensFromSite(url.trim(), pages, render);
  if (!result.ok) return { ok: false, error: result.error ?? "Kon geen tokens extraheren." };

  return {
    ok:            true,
    tokens:        result.tokens ?? {},
    blockTokens:   result.blockTokens ?? {},
    notes:         result.notes ?? [],
    pagesAnalyzed: result.pagesAnalyzed ?? 1,
  };
}
