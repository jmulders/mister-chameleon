import { redirect } from "next/navigation";

/**
 * /dashboard/settings — permanent redirect to /dashboard/tenant
 *
 * The nav now points directly to /dashboard/tenant. This stub ensures any
 * bookmarked or linked /dashboard/settings URLs are forwarded correctly.
 */
export default function DashboardSettingsRedirect() {
  redirect("/dashboard/tenant");
}
