/**
 * ABM outbound webhook.
 *
 * When a known lead arrives via a personalized URL, optionally POST the visit
 * event to a per-tenant webhook URL (configured in the ABM admin). The payload
 * is generic JSON so it can drive a HubSpot workflow, a Slack message, a Zapier /
 * n8n scenario, or a custom endpoint — without hardwiring any one CRM.
 *
 * Fire-and-forget + fail-open: no URL configured, a slow endpoint, or any error
 * never affects the visitor's redirect. A short timeout guards the worker.
 *
 * The webhook URL is operator-configured (trusted admin input), never derived
 * from request content.
 */

import "server-only";

import { getAbmWebhookUrl } from "@/lib/abm/abm-store";
import type { AbmLead }     from "@/lib/abm/abm-store";
import { logger }           from "@/lib/logger";

const TIMEOUT_MS = 2500;

export async function fireAbmVisitWebhook(lead: AbmLead, path: string): Promise<void> {
  try {
    const url = await getAbmWebhookUrl(lead.tenantId);
    if (!url) return;

    const now = new Date().toISOString();
    const payload = {
      event:      "abm.lead.visit",
      tenantId:   lead.tenantId,
      occurredAt: now,
      lead: {
        id:          lead.id,
        identifier:  lead.identifier,
        vanityPath:  lead.vanityPath,
        targetPath:  lead.targetPath,
        segmentHint: lead.segmentHint,
        profile:     lead.profile,
      },
      visit: {
        path,
        visitedAt:   now,
        // Sequence number including this arrival (lead.visitCount is the
        // pre-increment value at redirect time).
        visitNumber: lead.visitCount + 1,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: {
          "content-type": "application/json",
          "user-agent":   "MisterChameleon-ABM/1.0",
        },
        body:   JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn("[abm-webhook] endpoint returned non-2xx", {
          tenantId: lead.tenantId, status: res.status,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn("[abm-webhook] fire failed", {
      leadId: lead.id, err: err instanceof Error ? err.message : String(err),
    });
  }
}
