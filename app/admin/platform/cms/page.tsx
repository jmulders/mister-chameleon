/**
 * Admin — Platform CMS Settings (legacy route)
 *
 * This page has moved to /admin/platform/integrations/cms.
 * Permanently redirects there so existing bookmarks and links continue to work.
 *
 * @deprecated  The CMS settings page now lives under the Integrations section.
 *              This file can be removed once all internal references are updated.
 */

import { redirect } from "next/navigation";

export default function PlatformCmsPageLegacy() {
  redirect("/admin/platform/integrations/cms");
}
