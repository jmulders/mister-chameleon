"use server";

/**
 * Tenant Integrations — Server Actions
 *
 * Persists ALL tenant-level integration settings across the five integration
 * domains: CMS, CRM, AI, Enrichment, Domains.
 *
 * ─── Two-layer model ──────────────────────────────────────────────────────────
 *
 *   Platform layer (/admin/platform/integrations):
 *     Stores API keys / tokens and infrastructure defaults (projectId, region,
 *     etc.) that apply to all tenants.  Contains only secrets + optional defaults.
 *
 *   Tenant layer (these actions):
 *     Stores usage config — which integrations are active for this tenant,
 *     per-tenant provider overrides, and behavior flags.
 *     Contains NO secrets (the sole exception: cms.writeToken is a per-tenant
 *     CMS write credential managed by saveCmsCredentialsAction, not here).
 *
 * ─── Secret preservation ──────────────────────────────────────────────────────
 *
 *   These actions never accept secret fields (API keys, write tokens).
 *   All actions re-read the stored record before saving so that secrets in the
 *   stored JSONB row (e.g. cms.writeToken, ai.*.apiKey) are always preserved
 *   through the merge — they cannot be lost by an integrations page save.
 */

import { revalidatePath }  from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type {
  CMSProviderName,
  TenantAiProviderName,
  TenantCrmSettings,
  TenantEnrichmentSettings,
  TenantDomainsSettings,
  TenantGa4Settings,
  TenantLeadinfoSettings,
} from "@/tenant/types";

// ── Result type ───────────────────────────────────────────────────────────────

export type SaveIntegrationsResult =
  | { ok: true }
  | { ok: false; error: string };

// ── Input shape ───────────────────────────────────────────────────────────────

/**
 * The payload sent from the client component to save all integration settings
 * for a tenant in a single server action call.
 *
 * ─── What is NOT included ──────────────────────────────────────────────────────
 *
 *   Secrets are excluded by design:
 *     cms.writeToken                     — managed by saveCmsCredentialsAction
 *     ai.liveProvider.apiKey             — managed by saveTenantAction (TenantSettingsForm)
 *     ai.shadowProvider.apiKey           — same as above
 *     ga4.tracking.apiSecret             — preserved server-side via re-read-merge
 *     ga4.history.serviceAccountJson     — preserved server-side via re-read-merge
 *
 *   Platform-level credentials (HubSpot token, MaxMind key, Vercel token, AI keys)
 *   are managed at /admin/platform/integrations/*.
 */
export interface TenantIntegrationsPayload {
  /** CMS provider selection and non-secret per-tenant overrides. */
  cms: {
    provider:         CMSProviderName;
    projectId?:       string;
    dataset?:         string;
    storyblokRegion?:   string;
    storyblokVersion?:  string;
    statamicBaseUrl?:   string;
  };
  /** CRM usage flags — whether HubSpot enrichment is active for this tenant. */
  crm: TenantCrmSettings;
  /** AI decision layer config — mode, provider selection, model, threshold. */
  ai: {
    mode:                 "disabled" | "shadow" | "live";
    confidenceThreshold?: number;
    liveProvider?: {
      name:   TenantAiProviderName;
      model?: string;
    };
    shadowProvider?: {
      name:   TenantAiProviderName;
      model?: string;
    };
  };
  /** Geo enrichment usage flags. */
  enrichment: TenantEnrichmentSettings;
  /** Vercel deployment mapping. */
  domains: TenantDomainsSettings;
  /**
   * Leadinfo client-side enrichment settings.
   *
   * `siteToken` is a non-secret public identifier — safe to include here.
   * No server-side secrets involved.
   */
  leadinfo?: {
    enabled:          boolean;
    siteToken?:       string;
    pushToDataLayer?: boolean;
    storeInContext?:  boolean;
  };
  /** Google Tag Manager container ID, e.g. "GTM-ABC1234". */
  gtm?: {
    containerId?: string;
  };
  /**
   * GA4 integration settings — tracking (event send) and Analytics History.
   *
   * Secrets (`apiSecret`, `serviceAccountJson`) are NOT included here.
   * They are accepted separately via `saveGa4TrackingSecretAction` and
   * `saveGa4HistorySecretAction`, or preserved automatically by the
   * save action via re-read-merge.
   */
  ga4?: {
    tracking?: {
      enabled:            boolean;
      measurementId?:     string;
      sendMode?:          "off" | "client" | "server";
      visitorIdParamName?: string;
      /** New API secret value — send only when the operator enters a new one. */
      apiSecret?:         string;
    };
    history?: {
      enabled:              boolean;
      propertyId?:          string;
      visitorIdDimension?:  string;
      lookbackDays?:        number;
      cacheTtlMinutes?:     number;
      /** New service account JSON — send only when the operator pastes a new one. */
      serviceAccountJson?:  string;
    };
  };
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Save all tenant integration settings in one round-trip.
 *
 * Merges the payload on top of the stored record, preserving all secret fields
 * (writeToken, AI API keys, etc.) that are not part of the payload.
 *
 * @param tenantId  The tenant to update.
 * @param payload   Integration settings to persist (no secrets).
 */
export async function saveTenantIntegrationsAction(
  tenantId: string,
  payload:  TenantIntegrationsPayload,
): Promise<SaveIntegrationsResult> {
  const stored = await getTenantById(tenantId);

  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── CMS: merge non-secret fields, preserve writeToken ──────────────────────
  const cms = {
    ...stored.cms,
    provider:        payload.cms.provider,
    // Only overwrite non-secret per-tenant overrides when provided.
    ...(payload.cms.projectId       !== undefined ? { projectId:        payload.cms.projectId       } : {}),
    ...(payload.cms.dataset         !== undefined ? { dataset:          payload.cms.dataset         } : {}),
    ...(payload.cms.storyblokRegion   !== undefined ? { storyblokRegion:   payload.cms.storyblokRegion   } : {}),
    ...(payload.cms.storyblokVersion  !== undefined ? { storyblokVersion:  payload.cms.storyblokVersion  } : {}),
    ...(payload.cms.statamicBaseUrl   !== undefined ? { statamicBaseUrl:   payload.cms.statamicBaseUrl   } : {}),
    // writeToken is NOT touched here — preserved from stored.cms
  };

  // ── AI: merge non-secret fields, preserve per-tenant API keys ─────────────
  const liveProvider = payload.ai.liveProvider
    ? {
        // Preserve any stored apiKey; update name + model only.
        ...stored.ai?.liveProvider,
        name:  payload.ai.liveProvider.name,
        ...(payload.ai.liveProvider.model !== undefined
          ? { model: payload.ai.liveProvider.model }
          : {}),
      }
    : stored.ai?.liveProvider;

  const shadowProvider = payload.ai.shadowProvider
    ? {
        ...stored.ai?.shadowProvider,
        name:  payload.ai.shadowProvider.name,
        ...(payload.ai.shadowProvider.model !== undefined
          ? { model: payload.ai.shadowProvider.model }
          : {}),
      }
    : stored.ai?.shadowProvider;

  const ai = {
    ...stored.ai,
    mode:                 payload.ai.mode,
    ...(payload.ai.confidenceThreshold !== undefined
      ? { confidenceThreshold: payload.ai.confidenceThreshold }
      : {}),
    ...(liveProvider    ? { liveProvider    } : {}),
    ...(shadowProvider  ? { shadowProvider  } : {}),
  };

  // ── Leadinfo: merge all fields (no secrets involved) ─────────────────────────
  let leadinfo: TenantLeadinfoSettings | undefined = stored.leadinfo;

  if (payload.leadinfo !== undefined) {
    leadinfo = {
      enabled:         payload.leadinfo.enabled,
      ...(payload.leadinfo.siteToken       !== undefined ? { siteToken:       payload.leadinfo.siteToken       } : {}),
      ...(payload.leadinfo.pushToDataLayer !== undefined ? { pushToDataLayer: payload.leadinfo.pushToDataLayer } : {}),
      ...(payload.leadinfo.storeInContext  !== undefined ? { storeInContext:  payload.leadinfo.storeInContext  } : {}),
    };
  }

  // ── GA4: merge non-secret fields, preserve apiSecret + serviceAccountJson ──
  let ga4: TenantGa4Settings | undefined = stored.ga4;

  if (payload.ga4) {
    const trackingPayload = payload.ga4.tracking;
    const historyPayload  = payload.ga4.history;

    const tracking = trackingPayload
      ? {
          // Preserve existing stored apiSecret; only replace when a new one is sent.
          ...stored.ga4?.tracking,
          enabled:            trackingPayload.enabled,
          ...(trackingPayload.measurementId     !== undefined ? { measurementId:      trackingPayload.measurementId     } : {}),
          ...(trackingPayload.sendMode          !== undefined ? { sendMode:           trackingPayload.sendMode          } : {}),
          ...(trackingPayload.visitorIdParamName !== undefined ? { visitorIdParamName: trackingPayload.visitorIdParamName } : {}),
          // Only overwrite the stored secret when a new non-empty value is provided.
          ...(trackingPayload.apiSecret && trackingPayload.apiSecret.trim().length > 0
            ? { apiSecret: trackingPayload.apiSecret.trim() }
            : {}),
        }
      : stored.ga4?.tracking;

    const history = historyPayload
      ? {
          // Preserve existing stored serviceAccountJson; only replace when a new one is sent.
          ...stored.ga4?.history,
          enabled:             historyPayload.enabled,
          ...(historyPayload.propertyId         !== undefined ? { propertyId:         historyPayload.propertyId         } : {}),
          ...(historyPayload.visitorIdDimension !== undefined ? { visitorIdDimension: historyPayload.visitorIdDimension } : {}),
          ...(historyPayload.lookbackDays       !== undefined ? { lookbackDays:       historyPayload.lookbackDays       } : {}),
          ...(historyPayload.cacheTtlMinutes    !== undefined ? { cacheTtlMinutes:    historyPayload.cacheTtlMinutes    } : {}),
          // Only overwrite when a new non-empty value is provided.
          ...(historyPayload.serviceAccountJson && historyPayload.serviceAccountJson.trim().length > 0
            ? { serviceAccountJson: historyPayload.serviceAccountJson.trim() }
            : {}),
        }
      : stored.ga4?.history;

    ga4 = {
      ...(tracking ? { tracking } : {}),
      ...(history  ? { history  } : {}),
    };
  }

  // ── Assemble the updated record ────────────────────────────────────────────
  const updated = {
    ...stored,
    cms,
    ai,
    crm:        payload.crm,
    enrichment: payload.enrichment,
    domains:    payload.domains,
    ...(leadinfo !== undefined ? { leadinfo } : {}),
    ...(ga4      !== undefined ? { ga4      } : {}),
    ...(payload.gtm !== undefined
      ? { gtm: { containerId: payload.gtm.containerId?.trim() || undefined } }
      : (stored.gtm ? { gtm: stored.gtm } : {})),
  };

  const result = await saveTenant(updated);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Revalidate relevant pages so the next visit is fresh.
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/integrations`);
  revalidatePath(`/admin/tenants/${tenantId}/content`);

  return { ok: true };
}
