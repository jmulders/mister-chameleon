import { redirect } from "next/navigation";

/**
 * Admin root page — /admin
 *
 * The middleware already guards this route: unauthenticated requests are
 * redirected to /admin/login before this page renders.
 *
 * For authenticated users we just redirect to the primary admin landing page.
 * Keeping this file intentionally minimal — all auth logic lives in the
 * middleware and the admin layout.
 */
export default function AdminRootPage() {
  redirect("/admin/tenants");
}
