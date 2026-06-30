/**
 * Lead Base — outbound webhook delivery log.
 *
 * Persists every webhook attempt (status, attempts, error, payload) so the admin
 * can see what reached the receiver and replay failures. Service-role only.
 * See docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";

export interface WebhookDelivery {
  id:         string;
  tenantId:   string;
  event:      string;
  targetUrl:  string;
  ok:         boolean;
  statusCode: number | null;
  attempts:   number;
  error:      string | null;
  payload:    unknown;
  createdAt:  string;
}

export interface RecordDeliveryInput {
  tenantId:   string;
  event:      string;
  targetUrl:  string;
  ok:         boolean;
  statusCode?: number | null;
  attempts:   number;
  error?:     string | null;
  payload:    unknown;
}

/** Insert a delivery record. Fail-open (never blocks the webhook path). */
export async function recordWebhookDelivery(input: RecordDeliveryInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db.from("webhook_deliveries").insert({
      tenant_id:   input.tenantId,
      event:       input.event,
      target_url:  input.targetUrl,
      ok:          input.ok,
      status_code: input.statusCode ?? null,
      attempts:    input.attempts,
      error:       input.error ?? null,
      payload:     input.payload ?? null,
    });
  } catch (err) {
    logger.warn("[lead-base] recordWebhookDelivery failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function mapRow(r: Record<string, unknown>): WebhookDelivery {
  return {
    id:         String(r.id),
    tenantId:   String(r.tenant_id),
    event:      String(r.event),
    targetUrl:  String(r.target_url),
    ok:         !!r.ok,
    statusCode: r.status_code != null ? Number(r.status_code) : null,
    attempts:   Number(r.attempts ?? 1),
    error:      (r.error as string | null) ?? null,
    payload:    r.payload ?? null,
    createdAt:  String(r.created_at),
  };
}

/** Recent deliveries for a tenant, newest first. */
export async function listWebhookDeliveries(tenantId: string, limit = 25): Promise<WebhookDelivery[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("webhook_deliveries")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapRow);
  } catch {
    return [];
  }
}

/** A single delivery (for replay). Scoped to tenant. */
export async function getWebhookDelivery(tenantId: string, id: string): Promise<WebhookDelivery | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("webhook_deliveries")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
