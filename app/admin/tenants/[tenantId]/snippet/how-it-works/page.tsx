/**
 * /snippet/how-it-works  →  redirects to /snippet
 *
 * The "How it works" content now lives as a tab on the main Snippet page.
 * This redirect keeps any existing bookmarks or sidebar links working.
 */

import { redirect } from "next/navigation";

export default async function SnippetHowItWorksRedirect({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/admin/tenants/${tenantId}/snippet`);
}
