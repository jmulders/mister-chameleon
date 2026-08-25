"use server";

/**
 * Tenant Workspace › Audience › Webhooks — read-only overview.
 *
 * Unifies the two outbound-webhook mechanisms into one list for visibility. It
 * only READS existing configuration and the existing delivery log; it never
 * changes how either webhook fires or where it is configured (each keeps its own
 * edit surface, linked from the page).
 *
 *   1. Lead-qualification webhook — one per tenant, stored in abm_settings
 *      (webhook_url). Fires on upward lead qualification. Deliveries are logged
 *      to webhook_deliveries (event "lead.qualified").
 *   2. Rule-triggered webhooks — zero or more, stored per rule in rules_config
 *      (plan.webhook.url). Fire on rule match. Fire-and-forget: not individually
 *      logged today, so they show configuration + trigger, not a delivery history.
 */

import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { getAbmWebhookUrl } from "@/lib/abm/abm-store";
import { listWebhookDeliveries, type WebhookDelivery } from "@/lib/lead-base/webhook-deliveries-store";
import { getTenantRulesAction } from "@/app/admin/tenants/[tenantId]/personalization/rules/actions";
import { summarizeCondition } from "@/lib/webhooks/summarize-condition";

export interface RuleWebhookRow {
  ruleId:           string;
  label:            string;
  priority:         number;
  enabled:          boolean;
  url:              string;
  conditionSummary: string;
}

export interface OutboundWebhooksOverview {
  /** Lead-qualification webhook: the configured destination + its recent deliveries. */
  leadQual:     { url: string | null; deliveries: WebhookDelivery[] };
  /** Rule-triggered webhooks: one row per rule that carries a webhook. */
  ruleWebhooks: RuleWebhookRow[];
}

export async function listOutboundWebhooksAction(tenantId: string): Promise<OutboundWebhooksOverview> {
  await getRequiredAdminSession();

  const [url, deliveries, rulesResult] = await Promise.all([
    getAbmWebhookUrl(tenantId),
    listWebhookDeliveries(tenantId, 25),
    getTenantRulesAction(tenantId),
  ]);

  const ruleWebhooks: RuleWebhookRow[] = [];
  if (rulesResult.ok) {
    for (const r of rulesResult.config.rules) {
      const whUrl = r.plan?.webhook?.url;
      if (!whUrl) continue;
      ruleWebhooks.push({
        ruleId:           r.id,
        label:            r.label,
        priority:         r.priority,
        enabled:          r.enabled !== false,
        url:              whUrl,
        conditionSummary: summarizeCondition(r.condition),
      });
    }
    ruleWebhooks.sort((a, b) => a.priority - b.priority);
  }

  return { leadQual: { url, deliveries }, ruleWebhooks };
}
