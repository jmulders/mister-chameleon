/**
 * Rule-match outbound webhook.
 *
 * Fired when a decision rule with a `plan.webhook` matches on a real (non-bot)
 * request that carries a tenantId. Fire-and-forget: it POSTs a JSON event to the
 * operator-configured URL with a short timeout, logs failures, and never throws —
 * it must never block or affect the decision. Mirrors lib/abm/abm-webhook.ts.
 *
 * The condition is the rule's own condition tree (evaluated by the engine); this
 * module only delivers the event when the engine says the rule matched.
 */

import { createHmac } from "node:crypto";
import { logger } from "@/lib/logger";
import { isSafeWebhookUrl } from "./webhook-url";

const TIMEOUT_MS = 2500;

export interface RuleWebhookEvent {
  tenantId: string;
  /** The matched rule's identity. */
  rule: { id: string; label?: string; priority?: number };
  /** The chosen variant keys / plan summary (no PII). */
  plan: Record<string, unknown>;
  /** A curated, non-PII slice of the decision context (source, device, path, …). */
  context?: Record<string, unknown>;
}

/**
 * POST a rule-match event to `url`. Fire-and-forget; safe to call without await.
 * Silently no-ops on an unsafe URL (defence in depth — config validation already
 * rejects these) or any network error.
 *
 * When `opts.secret` is set, the request is signed like the lead webhook: an
 * `x-mc-timestamp` header plus `x-mc-signature: sha256=<hmac>` over
 * `${timestamp}.${body}`, so the receiver can verify authenticity.
 */
export async function fireRuleWebhook(
  url:   string,
  event: RuleWebhookEvent,
  opts:  { secret?: string | null } = {},
): Promise<void> {
  try {
    if (!isSafeWebhookUrl(url)) {
      logger.warn("[rule-webhook] blocked unsafe url", { tenantId: event.tenantId });
      return;
    }

    const payload = {
      event:      "rule.matched",
      occurredAt: new Date().toISOString(),
      ...event,
    };
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent":   "MisterChameleon-RuleWebhook/1.0",
    };
    if (opts.secret) {
      const timestamp = new Date().toISOString();
      const signature = createHmac("sha256", opts.secret).update(`${timestamp}.${body}`).digest("hex");
      headers["x-mc-timestamp"] = timestamp;
      headers["x-mc-signature"] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn("[rule-webhook] endpoint returned non-2xx", {
          tenantId: event.tenantId, ruleId: event.rule.id, status: res.status,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn("[rule-webhook] fire failed", {
      tenantId: event.tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
