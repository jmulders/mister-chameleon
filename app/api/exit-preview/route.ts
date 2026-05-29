/**
 * Sanity Preview Mode — exit route
 *
 * Disables Next.js draft mode for the current browser session and redirects to
 * the homepage.  Call this route from an "Exit preview" button in the site UI.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   /api/exit-preview
 *
 *   No parameters required.  The draft-mode cookie is cleared unconditionally —
 *   calling this route when preview is not active is a safe no-op.
 *
 * ─── Redirect target ─────────────────────────────────────────────────────────
 *
 *   Always redirects to "/" (homepage).  The browser will re-render without
 *   the draft-mode cookie — all pages return to published content.
 */

import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
  // Disable draft mode — clears the signed HTTP-only cookie set by /api/preview.
  (await draftMode()).disable();

  // Return to the homepage with published content.
  redirect("/");
}
