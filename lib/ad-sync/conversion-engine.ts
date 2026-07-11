/**
 * Ad-platform conversion feedback — orchestrator.
 *
 * sendConversion(tenantId, event) fans a single conversion out to every
 * configured platform (Google Data Manager events, Meta CAPI, LinkedIn
 * Conversions API), reusing the audience-sync credentials. Each send is logged
 * to ad_conversion_events. Fire-and-forget + fail-open — never throws, never
 * blocks the caller (form response / request pipeline).
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { getAdSyncSettings, getConversionConfig, logConversionEvent } from "./ad-sync-store";
import { sendGoogleConversion }   from "./google-conversions";
import { sendMetaConversion }     from "./meta-conversions";
import { sendLinkedInConversion } from "./linkedin-conversions";
import type { ConversionEvent, ConversionSendResult } from "./conversion-types";

export async function sendConversion(
  tenantId: string,
  event:    ConversionEvent,
  trigger:  "conversion" | "qualification" = "conversion",
): Promise<void> {
  try {
    const conv = await getConversionConfig(tenantId);
    if (!conv || !conv.enabled || !event.email) return;

    const settings = await getAdSyncSettings(tenantId);
    const results: ConversionSendResult[] = [];

    if (conv.google?.conversionActionId && settings.google) {
      results.push(await sendGoogleConversion(settings.google, conv, event));
    }
    if (conv.meta?.pixelId && settings.meta) {
      results.push(await sendMetaConversion(settings.meta, conv, event));
    }
    if (conv.linkedin?.conversionId && settings.linkedin) {
      results.push(await sendLinkedInConversion(settings.linkedin, conv, event));
    }

    for (const r of results) {
      await logConversionEvent(tenantId, {
        platform:  r.platform,
        status:    r.status,
        eventName: event.eventName ?? conv.eventName,
        trigger,
        error:     r.error ?? null,
      });
    }

    if (results.length > 0) {
      logger.info("[ad-sync] conversion sent", {
        tenantId, trigger,
        results: results.map((r) => `${r.platform}:${r.status}`).join(", "),
      });
    }
  } catch (err) {
    logger.warn("[ad-sync] sendConversion failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
  }
}
