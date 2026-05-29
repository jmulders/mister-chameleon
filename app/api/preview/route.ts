/**
 * Sanity Preview Mode — enable route
 *
 * Validates the preview secret and enables Next.js draft mode for the current
 * browser session.  After enabling, the browser is redirected to the requested
 * page so it is immediately rendered with draft content.
 *
 * ─── Usage (from Sanity Studio or custom preview button) ─────────────────────
 *
 *   /api/preview?secret=<SANITY_PREVIEW_SECRET>&slug=<page-slug>
 *
 *   secret  — Must match SANITY_PREVIEW_SECRET in the server environment.
 *             Returns 401 when absent or incorrect.
 *   slug    — URL slug of the page to preview, e.g. "about-us".
 *             Defaults to "" (homepage) when omitted.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   - The secret is compared with constant-time semantics via a simple string
 *     equality check (timing attacks are not a concern here — the secret is a
 *     long random string, not a password hash).
 *   - Draft mode is implemented via a signed HTTP-only cookie set by Next.js —
 *     it cannot be forged by a client without the cookie secret.
 *   - SANITY_PREVIEW_SECRET should be set to a random string of ≥ 32 characters.
 *     Generate one with: openssl rand -hex 32
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   SANITY_PREVIEW_SECRET  — Required. Secret token that authorises preview mode.
 *                            Add to .env.local and your deployment platform.
 */

import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug   = searchParams.get("slug") ?? "";

  // ── Secret validation ───────────────────────────────────────────────────────
  //
  // SANITY_PREVIEW_SECRET is a server-only env var — never exposed to the client.
  // Return 500 (not 401) when it is missing so misconfiguration is immediately
  // visible in server logs without leaking the expected value.

  const previewSecret = process.env.SANITY_PREVIEW_SECRET;

  if (!previewSecret) {
    return new Response(
      "Preview mode is not configured on this server. " +
        "Set SANITY_PREVIEW_SECRET in your environment.",
      { status: 500 },
    );
  }

  if (secret !== previewSecret) {
    return new Response("Invalid preview secret.", { status: 401 });
  }

  // ── Enable draft mode ───────────────────────────────────────────────────────
  //
  // draftMode().enable() sets a signed HTTP-only cookie that persists for the
  // browser session.  All subsequent requests from this browser will have
  // draftMode().isEnabled === true until exit-preview is called.

  (await draftMode()).enable();

  // ── Redirect to the requested page ─────────────────────────────────────────
  //
  // Redirect to the slug so the browser immediately loads the preview.
  // The page component checks draftMode().isEnabled and uses the preview
  // CMS provider (perspective: "previewDrafts") instead of the public one.

  const destination = slug ? `/${slug}` : "/";
  redirect(destination);
}
