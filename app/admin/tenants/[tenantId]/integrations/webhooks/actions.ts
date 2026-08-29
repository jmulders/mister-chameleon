"use server";

/**
 * Tenant Workspace › Integrations › Webhooks — overview + webhook-rule editing.
 *
 * Reads both outbound-webhook mechanisms for the overview, and lets the operator
 * create/edit/delete INDEPENDENT webhook rules (webhook-only rules) directly.
 *
 *   1. Lead-qualification webhook — one per tenant, stored in abm_settings
 *      (webhook_url). Fires on upward lead qualification. Deliveries are logged
 *      to webhook_deliveries (event "lead.qualified"). Edited under Leads.
 *   2. Rule-triggered webhooks — zero or more, stored per rule in rules_config
 *      (plan.webhook.url). Two kinds:
 *        - webhook-only rules (webhookOnly:true): fire independently of the
 *          variant decision; created/edited HERE.
 *        - combine rules (a variant rule that also carries an inline webhook):
 *          fire when they win the variant; edited in the Rules editor.
 *
 * Writes go through the shared validate+save path (saveTenantRulesAction), so the
 * engine's guarantees (URL safety, unique priorities, schema) are enforced.
 */

import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { getAbmWebhookUrl } from "@/lib/abm/abm-store";
import { listWebhookDeliveries, type WebhookDelivery } from "@/lib/lead-base/webhook-deliveries-store";
import { getTenantRulesAction, saveTenantRulesAction } from "@/app/admin/tenants/[tenantId]/rules/actions";
import { summarizeCondition } from "@/lib/webhooks/summarize-condition";
import { isSafeWebhookUrl } from "@/lib/webhooks/webhook-url";
import type { RuleCondition, StoredPlan, StoredRule } from "@/decision/rules/stored-rule";
import { revalidatePath } from "next/cache";

export interface RuleWebhookRow {
  ruleId:           string;
  label:            string;
  priority:         number;
  enabled:          boolean;
  url:              string;
  /** True for an independent webhook-only rule (editable here); false for a combine rule. */
  webhookOnly:      boolean;
  /** Whether a signing secret is configured (never returns the secret itself). */
  hasSecret:        boolean;
  /** Selected extra payload fields (consent-gated at fire time). */
  payloadFields:    string[];
  conditionSummary: string;
  /** Raw condition tree, for editing a webhook-only rule in place. */
  condition:        RuleCondition;
}

export interface OutboundWebhooksOverview {
  leadQual:     { url: string | null; deliveries: WebhookDelivery[] };
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
        webhookOnly:      r.webhookOnly === true,
        hasSecret:        !!r.plan?.webhook?.secret,
        payloadFields:    r.plan?.webhook?.payloadFields ?? [],
        conditionSummary: summarizeCondition(r.condition),
        condition:        r.condition,
      });
    }
    ruleWebhooks.sort((a, b) => a.priority - b.priority);
  }

  return { leadQual: { url, deliveries }, ruleWebhooks };
}

export interface WebhookRuleInput {
  /** Present when editing an existing webhook-only rule; omit to create. */
  ruleId?:   string;
  label:     string;
  url:       string;
  secret?:   string | null;
  condition: RuleCondition;
  enabled?:  boolean;
  payloadFields?: string[];
}

/** Lowest unused priority at/above 900 — keeps webhook rules clear of variant rules. */
function nextWebhookPriority(rules: readonly StoredRule[]): number {
  const used = new Set(rules.map((r) => r.priority));
  let p = 900;
  while (used.has(p)) p++;
  return p;
}

/**
 * Create or update an independent webhook-only rule. It never participates in
 * variant resolution (webhookOnly:true); it only fires its webhook on match.
 */
export async function saveWebhookRuleAction(
  tenantId: string,
  input:    WebhookRuleInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const label = input.label?.trim() ?? "";
  const url   = input.url?.trim() ?? "";
  if (!label) return { ok: false, error: "Label is required." };
  if (!isSafeWebhookUrl(url)) return { ok: false, error: "URL must be an absolute https URL to a public host." };

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) return { ok: false, error: current.error };

  const rules = [...current.config.rules];
  const existingIdx = input.ruleId ? rules.findIndex((r) => r.id === input.ruleId) : -1;
  if (input.ruleId && existingIdx < 0) return { ok: false, error: "Webhook rule not found." };
  if (existingIdx >= 0 && rules[existingIdx].webhookOnly !== true) {
    return { ok: false, error: "This rule is a variant rule with an inline webhook; edit it in the Rules editor." };
  }

  const secret = input.secret?.trim() || undefined;
  const payloadFields = input.payloadFields?.length ? input.payloadFields : undefined;
  // Webhook-only plans carry no variant keys — validation allows that. The cast
  // is the localized exception to StoredPlan's required variant keys.
  const plan = { webhook: { url, ...(secret ? { secret } : {}), ...(payloadFields ? { payloadFields } : {}) } } as unknown as StoredPlan;

  const rule: StoredRule = {
    id:          input.ruleId ?? `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    priority:    existingIdx >= 0 ? rules[existingIdx].priority : nextWebhookPriority(rules),
    label,
    condition:   input.condition,
    plan,
    reason:      `Webhook: ${label}`,
    enabled:     input.enabled ?? true,
    webhookOnly: true,
    source:      "tenant",
  };

  if (existingIdx >= 0) rules[existingIdx] = rule;
  else rules.push(rule);

  const result = await saveTenantRulesAction(tenantId, { ...current.config, rules });
  if (!result.ok) return { ok: false, error: result.fieldErrors?.join("; ") ?? result.error };

  revalidatePath(`/admin/tenants/${tenantId}/integrations/webhooks`);
  return { ok: true };
}

/** Delete a webhook-only rule. Refuses to touch a variant rule. */
export async function deleteWebhookRuleAction(
  tenantId: string,
  ruleId:   string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const current = await getTenantRulesAction(tenantId);
  if (!current.ok) return { ok: false, error: current.error };

  const target = current.config.rules.find((r) => r.id === ruleId);
  if (!target) return { ok: false, error: "Webhook rule not found." };
  if (target.webhookOnly !== true) {
    return { ok: false, error: "This is a variant rule; delete it in the Rules editor." };
  }

  const rules = current.config.rules.filter((r) => r.id !== ruleId);
  const result = await saveTenantRulesAction(tenantId, { ...current.config, rules });
  if (!result.ok) return { ok: false, error: result.fieldErrors?.join("; ") ?? result.error };

  revalidatePath(`/admin/tenants/${tenantId}/integrations/webhooks`);
  return { ok: true };
}
