import { requireSuperAdmin } from "@/lib/admin-auth/authorization";

/**
 * Superadmin only.
 *
 * The navigation hides this section from a tenant admin, but hiding a link is
 * not a check: the pages below rendered for any signed-in admin who typed the
 * URL. This layout runs for every page in the section and sends anyone else
 * back to their tenants.
 */
export default async function InterestProfilesSectionLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return children;
}
