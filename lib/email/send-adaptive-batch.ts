/**
 * Adaptive email — batch/campaign send (server-only).
 *
 * Sends one adaptive email per recipient by delegating to sendAdaptiveEmail,
 * which already enforces suppression, idempotency (email_sends unique key), and
 * per-recipient personalisation. This layer adds:
 *   - a per-campaign dedupeKey so a double-clicked "Send" doesn't re-mail the
 *     same campaign, while a NEW campaign to the same lead is allowed;
 *   - sequential delivery (gentle on the transport, deterministic logging);
 *   - an aggregate summary the UI shows back to the operator.
 *
 * It never throws — a single bad recipient is counted as failed and the batch
 * continues. Callers must have already authorised the operator.
 */

import "server-only";

import { sendAdaptiveEmail } from "./send-adaptive-email";
import type { EmailTemplateKey } from "./adaptive-email";
import type { BatchRecipient } from "./batch-select";
import { logger } from "@/lib/logger";

/** Hard ceiling per campaign — a safety rail against runaway sends. */
export const MAX_BATCH_RECIPIENTS = 500;

export interface SendBatchParams {
  tenantId:    string;
  templateKey: EmailTemplateKey;
  recipients:  BatchRecipient[];
  /**
   * Stable id for this campaign run. Combined per-recipient into the
   * email_sends dedupe key so re-running the exact campaign is a no-op.
   * Defaults to a timestamp-based id.
   */
  campaignId?: string;
}

export interface BatchSendSummary {
  campaignId: string;
  total:      number;
  sent:       number;
  suppressed: number;
  duplicate:  number;
  failed:     number;
  /** Per-recipient outcome, in send order. */
  results: {
    email:  string;
    status: "sent" | "suppressed" | "duplicate" | "failed";
    error?: string;
  }[];
}

export async function sendAdaptiveBatch(params: SendBatchParams): Promise<BatchSendSummary> {
  const campaignId = params.campaignId?.trim() || `c_${Date.now().toString(36)}`;
  const recipients = params.recipients.slice(0, MAX_BATCH_RECIPIENTS);

  const summary: BatchSendSummary = {
    campaignId,
    total:      recipients.length,
    sent:       0,
    suppressed: 0,
    duplicate:  0,
    failed:     0,
    results:    [],
  };

  for (const r of recipients) {
    let status: "sent" | "suppressed" | "duplicate" | "failed" = "failed";
    let error: string | undefined;

    try {
      const res = await sendAdaptiveEmail({
        tenantId:    params.tenantId,
        recipient:   { email: r.email, leadId: r.leadId },
        templateKey: params.templateKey,
        // Idempotent per (tenant, template, recipient, campaign).
        dedupeKey:   `batch:${campaignId}`,
      });

      if (res.ok) {
        status = res.skipped === "suppressed" ? "suppressed"
               : res.skipped === "duplicate"  ? "duplicate"
               : "sent";
      } else {
        status = "failed";
        error  = res.error;
      }
    } catch (e) {
      status = "failed";
      error  = e instanceof Error ? e.message : String(e);
    }

    summary[status] += 1;
    summary.results.push(error ? { email: r.email, status, error } : { email: r.email, status });
  }

  logger.info("[email] adaptive batch complete", {
    tenantId: params.tenantId, campaignId,
    total: summary.total, sent: summary.sent,
    suppressed: summary.suppressed, duplicate: summary.duplicate, failed: summary.failed,
  });

  return summary;
}
