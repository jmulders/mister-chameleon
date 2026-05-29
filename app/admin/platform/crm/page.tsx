/**
 * Admin — Platform CRM Settings (legacy route)
 *
 * This page has moved to /admin/platform/integrations/crm.
 * Permanently redirects there so existing bookmarks and links continue to work.
 *
 * @deprecated  The CRM settings page now lives under the Integrations section.
 *              This file can be removed once all internal references are updated.
 */

import { redirect } from "next/navigation";

export default function PlatformCrmPageLegacy() {
  redirect("/admin/platform/integrations/crm");
}
