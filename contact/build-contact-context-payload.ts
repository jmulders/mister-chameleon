/**
 * Contact Context Payload Builder
 *
 * Assembles the enriched N8nContactPayload from the four signal layers the
 * platform has already collected for this visitor:
 *
 *   1. ContactFormFields   — what the visitor typed (name, email, message)
 *   2. VisitorContext       — how they arrived (source, UTMs, device)
 *   3. VisitorHistory       — what they did before submitting (page views, CTA clicks)
 *   4. ServedVariantRow     — which homepage experience they saw
 *
 * ─── No I/O in this file ─────────────────────────────────────────────────────
 *
 *   This module is intentionally pure — it takes already-fetched data and
 *   returns a plain object. All DB queries and network calls live in the
 *   API route handler (`app/api/contact/route.ts`), keeping this function
 *   fast, deterministic, and trivially unit-testable.
 *
 * ─── sendToN8n ────────────────────────────────────────────────────────────────
 *
 *   The companion `sendToN8n()` function fires the payload to the configured
 *   webhook URL. It returns a `ContactSubmissionResult` so the route handler
 *   can respond appropriately without catching exceptions.
 *
 *   When `N8N_CONTACT_WEBHOOK_URL` is not configured, `sendToN8n()` logs a
 *   warning and returns `{ ok: true }` — the form submission is still accepted
 *   so development and staging environments work without a live n8n instance.
 */

import "server-only";

import type { VisitorContext } from "@/context/types";
import type { VisitorHistory } from "@/context/visitor-history";
import type { ServedVariantRow } from "@/data/types";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  ContactFormFields,
  ContactCampaignContext,
  ContactSessionContext,
  ContactServedExperience,
  N8nContactPayload,
  ContactSubmissionResult,
} from "./types";

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * All inputs required to build a complete N8nContactPayload.
 *
 * These are the four already-resolved signal layers plus the raw form data
 * and the page pathname from the request.
 */
export interface BuildContactPayloadInput {
  /** Raw form fields — name, email, message */
  formFields: ContactFormFields;
  /** URL pathname where the form was submitted, e.g. "/" or "/contact" */
  pathname: string;
  /** Resolved visitor context — source, device, UTMs, referrer */
  context: VisitorContext;
  /** First-party behavioural history — page views, CTA clicks */
  history: VisitorHistory;
  /**
   * Most recent served_variants row for this session.
   * Null when no homepage render was captured yet for this session.
   */
  lastServedVariant: ServedVariantRow | null;
  /** The visitor's session UUID from the mc_session_id cookie */
  sessionId: string;
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Assemble an enriched N8nContactPayload from the four signal layers.
 *
 * Pure function — no I/O, no side effects. Safe to call in tests without
 * mocking any network or database dependencies.
 *
 * @param input  All signal layers already resolved by the route handler.
 * @returns      A complete N8nContactPayload ready to POST to n8n.
 *
 * @example
 * const payload = buildContactContextPayload({
 *   formFields: { name, email, message },
 *   pathname: "/",
 *   context,
 *   history,
 *   lastServedVariant,
 *   sessionId,
 * });
 */
export function buildContactContextPayload(
  input: BuildContactPayloadInput,
): N8nContactPayload {
  const { formFields, pathname, context, history, lastServedVariant, sessionId } = input;

  // ── Campaign context ────────────────────────────────────────────────────────
  const campaign: ContactCampaignContext = {
    source: context.source,
    referrerDomain: context.referrerDomain,
    utmSource: context.utmSource,
    utmMedium: context.utmMedium,
    utmCampaign: context.utmCampaign,
    utmContent: context.utmContent,
    utmTerm: context.utmTerm,
  };

  // ── Session behaviour ───────────────────────────────────────────────────────
  const session: ContactSessionContext = {
    sessionId,
    visitType: context.visitType,
    device: context.device,
    pageViewCount: history.pageViewCount,
    hasClickedCta: history.hasClickedCta,
    ctaClickCount: history.ctaClickCount,
    firstSeenAt: history.firstSeenAt,
  };

  // ── Served experience ───────────────────────────────────────────────────────
  // Map the DB row to the outbound type. null → not yet captured.
  const servedExperience: ContactServedExperience | null = lastServedVariant
    ? {
        heroKey: lastServedVariant.hero_key,
        proofKey: lastServedVariant.proof_key,
        ctaKey: lastServedVariant.cta_key,
        reason: lastServedVariant.reason,
        // created_at is stored as a timestamptz string in Supabase
        servedAt: lastServedVariant.created_at,
      }
    : null;

  return {
    submittedAt: new Date().toISOString(),
    contact: formFields,
    campaign,
    session,
    servedExperience,
    page: { pathname },
  };
}

// ── n8n dispatch ──────────────────────────────────────────────────────────────

/**
 * POST the enriched contact payload to the configured n8n webhook URL.
 *
 * ─── Graceful no-op when unconfigured ────────────────────────────────────────
 *
 *   When `N8N_CONTACT_WEBHOOK_URL` is not set (local dev, staging without n8n),
 *   the function logs the payload at debug level and returns `{ ok: true }`.
 *   The contact submission is still accepted — the webhook is a nice-to-have,
 *   not a hard dependency.
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   Non-2xx responses and network errors both return `{ ok: false, error: ... }`.
 *   The route handler decides whether to surface this to the client.
 *
 *   We intentionally do NOT use fire-and-forget here: the API route should
 *   tell the browser whether the webhook call succeeded so we can surface
 *   a meaningful error if n8n is unreachable.
 *
 * @param payload  The N8nContactPayload built by `buildContactContextPayload()`.
 * @returns        `{ ok: true }` on success, `{ ok: false, error }` on failure.
 */
export async function sendToN8n(
  payload: N8nContactPayload,
): Promise<ContactSubmissionResult> {
  const webhookUrl = serverEnv.n8n.contactWebhookUrl;

  // ── Unconfigured: log and return ok so the form still works ────────────────
  if (!webhookUrl) {
    logger.debug("[contact] N8N_CONTACT_WEBHOOK_URL not configured — skipping dispatch", {
      sessionId: payload.session.sessionId,
      email: payload.contact.email,
      source: payload.campaign.source,
    });
    return { ok: true };
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────
  try {
    logger.debug("[contact] Sending payload to n8n webhook", {
      sessionId: payload.session.sessionId,
      source: payload.campaign.source,
      pageViewCount: payload.session.pageViewCount,
      hasClickedCta: payload.session.hasClickedCta,
      servedExperience: payload.servedExperience
        ? {
            heroKey: payload.servedExperience.heroKey,
            ctaKey: payload.servedExperience.ctaKey,
          }
        : null,
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // User-Agent helps n8n identify the source of the webhook call
        "User-Agent": "MisterChameleon/1.0 contact-form",
      },
      body: JSON.stringify(payload),
      // 10-second timeout guards against a slow n8n instance blocking the response
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "(unreadable)");
      logger.warn("[contact] n8n webhook returned non-2xx response", {
        status: response.status,
        statusText: response.statusText,
        body: responseText.slice(0, 200), // truncate to avoid log bloat
        sessionId: payload.session.sessionId,
      });
      return {
        ok: false,
        error: `n8n webhook responded with ${response.status} ${response.statusText}`,
      };
    }

    logger.info("[contact] Payload dispatched to n8n successfully", {
      status: response.status,
      sessionId: payload.session.sessionId,
      email: payload.contact.email,
      source: payload.campaign.source,
      ctaKey: payload.servedExperience?.ctaKey ?? null,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // AbortSignal.timeout() throws a DOMException with name "TimeoutError"
    const isTimeout = err instanceof Error && err.name === "TimeoutError";

    logger.warn("[contact] n8n webhook dispatch failed", {
      error: message,
      isTimeout,
      sessionId: payload.session.sessionId,
    });

    return {
      ok: false,
      error: isTimeout ? "n8n webhook timed out (10s)" : `Webhook dispatch failed: ${message}`,
    };
  }
}
