/**
 * Google conversion feedback via the Data Manager API (events:ingest).
 *
 *   POST https://datamanager.googleapis.com/v1/events:ingest
 *   { destinations: [ { operatingAccount: { accountType: "GOOGLE_ADS", accountId },
 *                       loginAccount?, productDestinationId: <conversionActionId> } ],
 *     events: [ { transactionId, eventTimestamp,
 *                 userData: { userIdentifiers: [ { emailAddress: <sha256 hex> } ] },
 *                 conversionValue?: { currencyCode, amount } } ],
 *     encoding: "HEX" }
 *
 * "Enhanced conversions for leads": the productDestinationId must be a Google Ads
 * conversion action with type UPLOAD_CLICKS. Auth is OAuth2 with the datamanager
 * scope (reuses the audience-sync Google credentials). Email SHA-256 hashed.
 * Fail-open, never throws.
 *
 * NOTE: field names are pinned here (operatingAccount.accountType, conversionValue,
 * eventTimestamp) per the Data Manager API v1 events:ingest schema; bump if Google
 * changes them.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { hashEmail } from "./hash";
import { getGoogleAccessToken } from "./google-ads-client";
import type { GoogleAdsConfig } from "./types";
import type { ConversionConfig, ConversionEvent, ConversionSendResult } from "./conversion-types";

const DM_BASE = "https://datamanager.googleapis.com/v1";
const TIMEOUT_MS = 12_000;

function digits(v: string | undefined | null): string { return (v ?? "").replace(/\D/g, ""); }

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function sendGoogleConversion(
  google: GoogleAdsConfig,
  conv:   ConversionConfig,
  event:  ConversionEvent,
): Promise<ConversionSendResult> {
  const conversionActionId = conv.google?.conversionActionId;
  if (!google.customerId || !conversionActionId) {
    return { ok: false, platform: "google", status: "skipped", error: "Google conversions not configured (customer id + conversion action id)." };
  }
  const emailAddress = hashEmail(event.email);
  if (!emailAddress) return { ok: false, platform: "google", status: "skipped", error: "No hashable email." };

  const accessToken = await getGoogleAccessToken(google);
  if (!accessToken) return { ok: false, platform: "google", status: "error", error: "Google OAuth failed (datamanager scope)." };

  try {
    // NOTE: the Data Manager *events* API uses `accountType` on the account
    // objects (the audiences API uses `product`) — verified against the
    // events:ingest reference.
    const destination: Record<string, unknown> = {
      ...(google.loginCustomerId ? { loginAccount: { accountType: "GOOGLE_ADS", accountId: digits(google.loginCustomerId) } } : {}),
      operatingAccount: { accountType: "GOOGLE_ADS", accountId: digits(google.customerId) },
      productDestinationId: digits(conversionActionId),
    };

    const ev: Record<string, unknown> = {
      transactionId:  event.transactionId ?? `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventTimestamp: new Date(event.eventTimeMs ?? Date.now()).toISOString(),
      userData:       { userIdentifiers: [{ emailAddress }] },
    };
    if (event.value != null) {
      ev.conversionValue = { currencyCode: event.currency ?? conv.currency ?? "EUR", amount: event.value };
    }

    const res = await timedFetch(`${DM_BASE}/events:ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ destinations: [destination], events: [ev], encoding: "HEX" }),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      logger.warn("[ad-sync] Google events:ingest non-2xx", { status: res.status, body: text.slice(0, 2000) });
      return { ok: false, platform: "google", status: "error", error: `Data Manager events ${res.status}: ${text.slice(0, 2000)}` };
    }
    return { ok: true, platform: "google", status: "ok" };
  } catch (err) {
    return { ok: false, platform: "google", status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
