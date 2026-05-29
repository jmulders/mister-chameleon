/**
 * billing/wallet-webhook-events.ts
 *
 * Read helpers for the wallet_webhook_events audit log.
 *
 * Webhook events are written by the webhook route handler (billing/stripe.ts →
 * recordWebhookEvent).  These helpers are read-only and used by the admin UI.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletWebhookEvent } from "./types";
import { serializeError } from "./errors";

/**
 * Return the most recent webhook events for a specific tenant.
 *
 * @param limit   Maximum number of events to return (default 20).
 */
export async function getRecentWebhookEvents(
  client:   SupabaseClient,
  tenantId: string,
  limit     = 20,
): Promise<WalletWebhookEvent[]> {
  const { data, error } = await client
    .from("wallet_webhook_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw new Error(
      `[billing/wallet-webhook-events] getRecentWebhookEvents failed: ${error.message} (code: ${error.code})`,
    );
  }

  return (data ?? []) as WalletWebhookEvent[];
}

/**
 * Return the most recent webhook events across all tenants (admin overview).
 * Optionally filter by livemode.
 *
 * @param livemode  true = live events only, false = test events only, undefined = all
 */
export async function getRecentWebhookEventsGlobal(
  client:    SupabaseClient,
  limit      = 50,
  livemode?: boolean,
): Promise<WalletWebhookEvent[]> {
  let query = client
    .from("wallet_webhook_events")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (livemode !== undefined) {
    query = query.eq("livemode", livemode);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw new Error(
      `[billing/wallet-webhook-events] getRecentWebhookEventsGlobal failed: ${error.message} (code: ${error.code})`,
    );
  }

  return (data ?? []) as WalletWebhookEvent[];
}
