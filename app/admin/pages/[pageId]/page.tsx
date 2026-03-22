/**
 * Admin — Page editor redirect (legacy route)
 *
 * This route existed before pages were tenant-scoped.  It now looks up the
 * page by id (without a tenant filter), reads its tenantId, and redirects
 * to the canonical tenant-scoped editor at:
 *
 *   /admin/tenants/[tenantId]/pages/[pageId]
 *
 * This keeps existing bookmarks and any server-action revalidatePath calls
 * targeting the old route working while the real editing UI lives under the
 * tenant hierarchy.
 */

import { notFound, redirect } from "next/navigation";
import { getPageById } from "@/page-store";

export default async function AdminPageEditorRedirectPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;

  // Global lookup — no tenant filter needed here, we just need the tenantId.
  const page = await getPageById(pageId);
  if (!page) notFound();

  redirect(`/admin/tenants/${page.tenantId}/pages/${pageId}`);
}
