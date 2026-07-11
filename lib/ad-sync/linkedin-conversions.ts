/**
 * LinkedIn Conversions API — server-side conversion send.
 *
 *   POST https://api.linkedin.com/rest/conversionEvents
 *   { conversion: "urn:lla:llaPartnerConversion:{id}",
 *     conversionHappenedAt: <epoch ms>,
 *     conversionValue?: { currencyCode, amount },
 *     eventId?, user: { userIds: [ { idType: "SHA256_EMAIL", idValue: <hash> } ] } }
 *
 * Auth: OAuth2 access token with r_ads/rw_conversions. Versioned REST headers.
 * Email SHA-256 hashed (@/lib/ad-sync/hash). Fail-open, never throws.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail } from "./hash";
import type { LinkedInConfig } from "./types";
import type { ConversionConfig, ConversionEvent, ConversionSendResult } from "./conversion-types";

const REST_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202606";  // YYYYMM
const TIMEOUT_MS = 10_000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function sendLinkedInConversion(
  linkedin: LinkedInConfig,
  conv:     ConversionConfig,
  event:    ConversionEvent,
): Promise<ConversionSendResult> {
  const conversionId = conv.linkedin?.conversionId;
  if (!linkedin.accessToken || !conversionId) {
    return { ok: false, platform: "linkedin", status: "skipped", error: "LinkedIn CAPI not configured (access token + conversion id)." };
  }
  const idValue = hashEmail(event.email);
  if (!idValue) return { ok: false, platform: "linkedin", status: "skipped", error: "No hashable email." };

  try {
    const body: Record<string, unknown> = {
      conversion:           `urn:lla:llaPartnerConversion:${conversionId.replace(/\D/g, "")}`,
      conversionHappenedAt: event.eventTimeMs ?? Date.now(),
      user:                 { userIds: [{ idType: "SHA256_EMAIL", idValue }] },
      ...(event.transactionId ? { eventId: event.transactionId } : {}),
    };
    if (event.value != null) {
      body.conversionValue = {
        currencyCode: event.currency ?? conv.currency ?? "EUR",
        amount:       String(event.value),
      };
    }

    const res = await timedFetch(`${REST_BASE}/conversionEvents`, {
      method: "POST",
      headers: {
        Authorization:              `Bearer ${linkedin.accessToken}`,
        "Content-Type":             "application/json",
        "LinkedIn-Version":         LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      logger.warn("[ad-sync] LinkedIn CAPI non-2xx", { status: res.status, body: text.slice(0, 200) });
      return { ok: false, platform: "linkedin", status: "error", error: `LinkedIn CAPI ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, platform: "linkedin", status: "ok" };
  } catch (err) {
    return { ok: false, platform: "linkedin", status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
