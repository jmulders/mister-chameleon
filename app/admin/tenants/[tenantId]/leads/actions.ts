"use server";

/**
 * Tenant Workspace › Lead Base — Server Actions
 *
 * List + filter the unified visitor/lead profiles, and bulk-delete (right to
 * erasure). Export is done client-side from the filtered rows. PII is never held
 * here (it lives in abm_leads), so the export is pseudonymous + firmographic.
 * See docs/lead-base-design.md.
 */

import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import {
  listVisitorProfiles,
  deleteVisitorProfiles,
  getHubspotContactIdsForProfiles,
  getPersonalizationPerformance,
  type VisitorProfile,
  type VisitorProfileFilter,
  type PersonalizationPerformance,
} from "@/lib/lead-base/visitor-profiles-store";
import { archiveContact } from "@/lib/lead-base/hubspot-sync";
import { getAbmHubspotToken } from "@/lib/abm/abm-store";
import { getLeadEmailsForProfiles } from "@/lib/ad-sync/segment";
import { removeLeadsFromAudiences } from "@/lib/ad-sync/sync-engine";
import { listVisitorEvents, type VisitorEvent } from "@/lib/lead-base/visitor-events-store";
import {
  listWebhookDeliveries,
  getWebhookDelivery,
  type WebhookDelivery,
} from "@/lib/lead-base/webhook-deliveries-store";
import { deliverAndLog } from "@/lib/lead-base/profile-webhook";
import { getAbmWebhookUrl } from "@/lib/abm/abm-store";

export async function listLeadProfilesAction(
  tenantId: string,
  filter:   VisitorProfileFilter = {},
): Promise<VisitorProfile[]> {
  await getRequiredAdminSession();
  return listVisitorProfiles(tenantId, filter);
}

export async function deleteLeadProfilesAction(
  tenantId: string,
  ids:      string[],
): Promise<{ ok: boolean; deleted: number; crmArchived: number }> {
  await getRequiredAdminSession();

  // GDPR erasure: archive the linked HubSpot contacts (the PII) before removing
  // the profiles. Best-effort; the company (firmographic) is left in place.
  let crmArchived = 0;
  const token = await getAbmHubspotToken(tenantId);
  if (token) {
    const contactIds = Array.from(new Set(await getHubspotContactIdsForProfiles(tenantId, ids)));
    for (const cid of contactIds) {
      const r = await archiveContact(token, cid);
      if (r.ok) crmArchived++;
    }
  }

  // Also purge these people from any ad-platform retargeting audiences. Resolve
  // their emails BEFORE deleting the profiles (the link is gone afterwards).
  const eraseEmails = await getLeadEmailsForProfiles(tenantId, ids);

  const deleted = await deleteVisitorProfiles(tenantId, ids);

  if (eraseEmails.length > 0) await removeLeadsFromAudiences(tenantId, eraseEmails);
  return { ok: deleted > 0, deleted, crmArchived };
}

/** The page-visit timeline for one visitor (lazy-loaded when a row is expanded). */
export async function listVisitorEventsAction(tenantId: string, visitorKey: string): Promise<VisitorEvent[]> {
  await getRequiredAdminSession();
  return listVisitorEvents(tenantId, visitorKey, 50);
}

// ── Personalization performance ──────────────────────────────────────────────────

export async function getPersonalizationPerformanceAction(tenantId: string): Promise<PersonalizationPerformance> {
  await getRequiredAdminSession();
  return getPersonalizationPerformance(tenantId);
}

// ── Webhook deliveries ──────────────────────────────────────────────────────────

export async function listWebhookDeliveriesAction(tenantId: string): Promise<WebhookDelivery[]> {
  await getRequiredAdminSession();
  return listWebhookDeliveries(tenantId, 25);
}

/** Re-send a past delivery's payload to the currently configured webhook URL. */
export async function replayWebhookDeliveryAction(
  tenantId: string,
  id:       string,
): Promise<{ ok: true; status: number | null } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const delivery = await getWebhookDelivery(tenantId, id);
  if (!delivery) return { ok: false, error: "Delivery not found." };
  if (delivery.payload == null) return { ok: false, error: "No stored payload to replay." };
  const url = await getAbmWebhookUrl(tenantId);
  if (!url) return { ok: false, error: "No webhook URL configured." };
  const result = await deliverAndLog(tenantId, url, delivery.event, delivery.payload);
  return result.ok ? { ok: true, status: result.statusCode } : { ok: false, error: result.error ?? "Delivery failed." };
}
