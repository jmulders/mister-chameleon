/**
 * Lead Base — CRM-sync webhook.
 *
 * When a visitor profile newly QUALIFIES (becomes named/known, or reaches MQL/SQL/
 * customer), POST it once to the tenant's generic outbound webhook — the same sink
 * the ABM feature uses (HubSpot workflow / Slack / Zapier / custom). The platform
 * is not the system-of-record for named leads; this hands them to the CRM.
 *
 * Fire-and-forget + fail-open. Only the upward transition fires it, so normal page
 * views never spam the endpoint. See docs/lead-base-design.md.
 */

import "server-only";

import { createHmac }             from "node:crypto";
import { getAbmWebhookUrl, getAbmWebhookSecret } from "@/lib/abm/abm-store";
import { recordWebhookDelivery }  from "./webhook-deliveries-store";
import { logger }                 from "@/lib/logger";
import type { GatedProfilePatch, IdentityLevel, ProfileStatus } from "./profile-gate";
import type { ProfileUpsertResult } from "./visitor-profiles-store";

const TIMEOUT_MS = 2500;

const QUALIFYING_LEVELS:   IdentityLevel[] = ["known", "customer"];
const QUALIFYING_STATUSES: ProfileStatus[] = ["mql", "sql", "customer"];

/**
 * True when the platform first identified the company behind a visitor
 * (anonymous → recognised). Only the enrichment-driven "recognised" level counts;
 * ABM named leads jump straight to "known" and are not billed as recognition.
 */
export function isNewlyRecognised(t: ProfileUpsertResult): boolean {
  return t.level === "recognised" && (t.prevLevel === null || t.prevLevel === "anonymous");
}

/** True when this upsert crossed a qualification threshold (not already past it). */
export function isNewlyQualified(t: ProfileUpsertResult): boolean {
  const levelCrossed =
    QUALIFYING_LEVELS.includes(t.level) &&
    !(t.prevLevel && QUALIFYING_LEVELS.includes(t.prevLevel));
  const statusCrossed =
    QUALIFYING_STATUSES.includes(t.status) &&
    !(t.prevStatus && QUALIFYING_STATUSES.includes(t.prevStatus));
  return levelCrossed || statusCrossed;
}

/** The named person behind a known ABM lead, included in the webhook payload. */
export interface WebhookPerson {
  firstName?:   string | null;
  lastName?:    string | null;
  email?:       string | null;
  jobTitle?:    string | null;
  linkedinUrl?: string | null;
}

/** Returns true when a webhook target was configured and the POST was attempted. */
export async function fireProfileWebhook(
  patch:      GatedProfilePatch,
  transition: ProfileUpsertResult,
  person?:    WebhookPerson | null,
): Promise<boolean> {
  try {
    const url = await getAbmWebhookUrl(patch.tenantId);
    if (!url) return false;

    const fullName = person && (person.firstName || person.lastName)
      ? [person.firstName, person.lastName].filter(Boolean).join(" ")
      : null;

    const payload = {
      event:      "lead.qualified",
      tenantId:   patch.tenantId,
      occurredAt: new Date().toISOString(),
      transition: {
        fromLevel:  transition.prevLevel,
        toLevel:    transition.level,
        fromStatus: transition.prevStatus,
        toStatus:   transition.status,
      },
      // The named person (present for ABM leads; null for funnel-qualified visitors).
      person: person ? {
        fullName,
        firstName:   person.firstName   ?? null,
        lastName:    person.lastName    ?? null,
        email:       person.email       ?? null,
        jobTitle:    person.jobTitle    ?? null,
        linkedinUrl: person.linkedinUrl ?? null,
      } : null,
      profile: {
        visitorKey:      patch.visitorKey,
        identityLevel:   patch.identityLevel,
        status:          patch.status,
        companyName:     patch.companyName     ?? null,
        companyDomain:   patch.companyDomain   ?? null,
        companySize:     patch.companySize     ?? null,
        companyIndustry: patch.companyIndustry ?? null,
        geoCountry:      patch.geoCountry       ?? null,
        geoRegion:       patch.geoRegion        ?? null,
        intentScore:     patch.intentScore     ?? null,
        funnelStage:     patch.funnelStage      ?? null,
        segmentIds:      patch.segmentIds       ?? [],
        consentState:    patch.consentState,
        abmLeadId:       patch.abmLeadId        ?? null,
      },
    };

    await deliverAndLog(patch.tenantId, url, payload.event, payload);
    return true;
  } catch (err) {
    logger.warn("[lead-base] fireProfileWebhook failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── Delivery (retry + signing + logging) ────────────────────────────────────────

const RETRY_DELAYS_MS = [0, 600, 1800]; // 3 attempts, exponential-ish backoff

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export interface DeliveryResult {
  ok:         boolean;
  statusCode: number | null;
  attempts:   number;
  error:      string | null;
}

/**
 * POST a (optionally signed) body with bounded retries. Retries on network
 * errors, timeouts, 5xx and 429; stops immediately on other 4xx (a client/config
 * error that won't fix itself). Signs once with a single timestamp per call.
 */
async function deliverWebhook(url: string, secret: string | null, body: string): Promise<DeliveryResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent":   "MisterChameleon-LeadBase/1.0",
  };
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    headers["x-mc-timestamp"] = timestamp;
    headers["x-mc-signature"] = `sha256=${signature}`;
  }

  let attempts = 0;
  let statusCode: number | null = null;
  let error: string | null = null;

  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (RETRY_DELAYS_MS[i]) await sleep(RETRY_DELAYS_MS[i]);
    attempts++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
      statusCode = res.status;
      if (res.ok) return { ok: true, statusCode, attempts, error: null };
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, statusCode, attempts, error: `HTTP ${res.status}` };
      }
      error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, statusCode, attempts, error };
}

/**
 * Sign + deliver (with retry) and persist the outcome to the deliveries log.
 * Used by the live qualification path and by admin replay. Fail-open.
 */
export async function deliverAndLog(
  tenantId: string,
  url:      string,
  event:    string,
  payload:  unknown,
): Promise<DeliveryResult> {
  const body   = JSON.stringify(payload);
  const secret = await getAbmWebhookSecret(tenantId);
  const result = await deliverWebhook(url, secret, body);
  if (!result.ok) {
    logger.warn("[lead-base] webhook delivery failed", {
      tenantId, status: result.statusCode, attempts: result.attempts, error: result.error,
    });
  }
  await recordWebhookDelivery({
    tenantId, event, targetUrl: url,
    ok: result.ok, statusCode: result.statusCode, attempts: result.attempts, error: result.error,
    payload,
  });
  return result;
}
