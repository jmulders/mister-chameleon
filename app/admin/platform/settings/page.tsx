/**
 * Admin — Platform Settings (legacy route)
 *
 * This page has moved to /admin/platform/integrations.
 * The individual integration sections now live at:
 *
 *   CMS         → /admin/platform/integrations/cms
 *   CRM         → /admin/platform/integrations/crm
 *   AI          → /admin/platform/integrations/ai
 *   Enrichment  → /admin/platform/integrations/enrichment
 *   Domains     → /admin/platform/integrations/domains
 *
 * This redirect ensures that bookmarks and any lingering internal links
 * continue to work without a 404.
 *
 * @deprecated  Use /admin/platform/integrations instead.
 *              This file can be removed once all internal references are updated.
 */

import { redirect } from "next/navigation";

export default function PlatformSettingsPageLegacy() {
  redirect("/admin/platform/integrations");
}
