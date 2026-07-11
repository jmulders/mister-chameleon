/**
 * Meta Conversions API (CAPI) — server-side conversion send.
 *
 *   POST https://graph.facebook.com/{version}/{pixelId}/events
 *   { data: [ { event_name, event_time, action_source, event_id,
 *               user_data: { em: [sha256], fbc? }, custom_data: { value, currency } } ],
 *     access_token }
 *
 * Email is SHA-256 hashed (@/lib/ad-sync/hash). fbclid is turned into an `fbc`
 * cookie value when present. Fail-open, never throws.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail } from "./hash";
import type { MetaConfig } from "./types";
import type { ConversionConfig, ConversionEvent, ConversionSendResult } from "./conversion-types";

const API_VERSION = "v21.0";
const TIMEOUT_MS = 10_000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function sendMetaConversion(
  meta:  MetaConfig,
  conv:  ConversionConfig,
  event: ConversionEvent,
): Promise<ConversionSendResult> {
  const pixelId = conv.meta?.pixelId;
  if (!meta.accessToken || !pixelId) {
    return { ok: false, platform: "meta", status: "skipped", error: "Meta CAPI not configured (access token + pixel id)." };
  }
  const em = hashEmail(event.email);
  if (!em) return { ok: false, platform: "meta", status: "skipped", error: "No hashable email." };

  try {
    const eventTimeSec = Math.floor((event.eventTimeMs ?? Date.now()) / 1000);
    const userData: Record<string, unknown> = { em: [em] };
    if (event.fbclid) userData.fbc = `fb.1.${Date.now()}.${event.fbclid}`;

    const data = [{
      event_name:    event.eventName ?? conv.eventName ?? "Lead",
      event_time:    eventTimeSec,
      action_source: "website",
      ...(event.transactionId ? { event_id: event.transactionId } : {}),
      user_data:     userData,
      custom_data:   {
        ...(event.value != null ? { value: event.value } : {}),
        currency: event.currency ?? conv.currency ?? "EUR",
      },
    }];

    const res = await timedFetch(`https://graph.facebook.com/${API_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, access_token: meta.accessToken }),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      logger.warn("[ad-sync] Meta CAPI non-2xx", { status: res.status, body: text.slice(0, 200) });
      return { ok: false, platform: "meta", status: "error", error: `Meta CAPI ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, platform: "meta", status: "ok" };
  } catch (err) {
    return { ok: false, platform: "meta", status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
