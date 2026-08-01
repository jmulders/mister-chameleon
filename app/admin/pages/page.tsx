/**
 * Admin — Pages overview redirect (legacy route)
 *
 * This route existed before pages were tenant-scoped.  It now resolves the
 * active tenant from the request host and permanently redirects to the
 * tenant-scoped pages list at /admin/tenants/[tenantId]/content/pages.
 *
 * The redirect preserves backward compatibility for any existing bookmarks or
 * nav links pointing to /admin/pages.
 */

import { redirect } from "next/navigation";
import { getActiveTenant } from "@/tenant/server";

export default async function AdminPagesRedirectPage() {
  const tenant = await getActiveTenant();
  redirect(`/admin/tenants/${tenant.tenantId}/content/pages`);
}
