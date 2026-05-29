/**
 * Email Config Resolver
 *
 * Resolves the effective email transport configuration for a tenant using
 * the standard four-layer model:
 *
 *   tenant   → tenant_email_transport table (highest priority)
 *   platform → platform_settings.email
 *   env      → RESEND_API_KEY / SMTP_HOST / MAIL_FROM_ADDRESS / BACKOFFICE_EMAIL
 *   system   → safe compiled defaults (transportType: "none")
 *
 * Returns a `DomainResolution<ResolvedEmailConfig>` with the merged config
 * and source metadata for admin UX and diagnostics.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   API keys and SMTP passwords in the `config` field are decrypted and
 *   SERVER ONLY.  Never pass `resolution.config` across a server→client boundary.
 *   For admin UI status, use `resolution.source`, `resolution.hasTenantOverride`,
 *   and `resolution.hasPlatformDefault` (all safe booleans).
 */

import "server-only";

import { loadTenantEmailTransport }          from "@/forms/load-tenant-email-transport";
import { getPlatformEmailSettings }          from "@/platform/platform-store";
import { serverEnv }                         from "@/lib/env";
import { layeredResolve }                    from "@/lib/config/resolver";
import type { DomainResolution }             from "@/lib/config/types";
import type { TenantEmailTransport }         from "@/tenant/types";
import type { PlatformEmailSettings }        from "@/platform/platform-store";

// ─────────────────────────────────────────────────────────────────────────────
// ResolvedEmailConfig — the merged, transport-ready type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-resolved email configuration for a tenant.
 *
 * Merges fields from `TenantEmailTransport` and `PlatformEmailSettings` into
 * a single shape that `mail-transport.ts` can consume directly.
 *
 * SERVER ONLY — contains decrypted secrets (resendApiKey, smtpPassword).
 */
export interface ResolvedEmailConfig {
  /** Active transport type after resolution. */
  transportType:    "resend" | "smtp" | "none";
  /** Display name for the "From" field, e.g. "Acme Platform". */
  fromName?:        string;
  /** From email address, e.g. "hello@acme.com". */
  fromEmail?:       string;
  /**
   * Platform-level or env-level default recipient for backoffice notifications.
   * Per-tenant recipients are in `TenantFormSettings.notificationRecipients`.
   */
  backofficeEmail?: string;
  // ── Resend ──────────────────────────────────────────────────────────────────
  /** Decrypted Resend API key. SERVER ONLY. */
  resendApiKey?:    string;
  // ── SMTP ────────────────────────────────────────────────────────────────────
  /** SMTP server hostname. */
  smtpHost?:        string;
  /** SMTP port (default 587). */
  smtpPort?:        number;
  /** SMTP auth username. */
  smtpUsername?:    string;
  /** Decrypted SMTP auth password. SERVER ONLY. */
  smtpPassword?:    string;
  /** Use implicit TLS when true; STARTTLS when false. */
  smtpSecure?:      boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveEmailConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective email configuration for `tenantId`.
 *
 * Loads all four layers in parallel where possible, then merges them with
 * `layeredResolve()`.
 *
 * @param tenantId  Tenant slug, e.g. "acme".
 *
 * @example
 *   const resolution = await resolveEmailConfig("acme");
 *   if (resolution.config.transportType !== "none") {
 *     await sendMail({ transport: resolution.config, ... });
 *   }
 */
export async function resolveEmailConfig(
  tenantId: string,
): Promise<DomainResolution<ResolvedEmailConfig>> {
  // Load tenant and platform layers in parallel — they're independent.
  const [tenantTransport, platformResult] = await Promise.all([
    loadTenantEmailTransport(tenantId),
    getPlatformEmailSettings(),
  ]);

  const platformSettings: PlatformEmailSettings | null =
    platformResult.ok ? platformResult.data : null;

  // ── System layer: safe compiled defaults ──────────────────────────────────
  const systemLayer: Partial<ResolvedEmailConfig> = {
    transportType: "none",
  };

  // ── Env layer: derive from environment variables ───────────────────────────
  const envLayer = buildEnvLayer();

  // ── Platform layer: platform_settings.email (strip secrets from shape) ────
  const platformLayer: Partial<ResolvedEmailConfig> | null = platformSettings
    ? {
        transportType: platformSettings.transportType,
        fromName:      platformSettings.fromName,
        fromEmail:     platformSettings.fromEmail,
        backofficeEmail: platformSettings.backofficeEmail,
        resendApiKey:  platformSettings.resendApiKey,
        smtpHost:      platformSettings.smtpHost,
        smtpPort:      platformSettings.smtpPort,
        smtpUsername:  platformSettings.smtpUsername,
        smtpPassword:  platformSettings.smtpPassword,
        smtpSecure:    platformSettings.smtpSecure,
      }
    : null;

  // ── Tenant layer: tenant_email_transport (already decrypted) ──────────────
  const tenantLayer: Partial<ResolvedEmailConfig> | null = tenantTransport
    ? {
        transportType: tenantTransport.transportType,
        fromName:      tenantTransport.fromName,
        fromEmail:     tenantTransport.fromEmail,
        resendApiKey:  tenantTransport.resendApiKey,
        smtpHost:      tenantTransport.smtpHost,
        smtpPort:      tenantTransport.smtpPort,
        smtpUsername:  tenantTransport.smtpUsername,
        smtpPassword:  tenantTransport.smtpPassword,
        smtpSecure:    tenantTransport.smtpSecure,
      }
    : null;

  const baseline: ResolvedEmailConfig = {
    transportType: "none",
  };

  return layeredResolve<ResolvedEmailConfig>(
    {
      system:   systemLayer,
      env:      envLayer,
      platform: platformLayer,
      tenant:   tenantLayer,
    },
    baseline,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Builds the env layer from serverEnv.  Returns null when no transport vars are set. */
function buildEnvLayer(): Partial<ResolvedEmailConfig> | null {
  const resendKey = serverEnv.email.resendApiKey;
  const smtpHost  = serverEnv.smtp.host;
  const fromAddr  = serverEnv.email.fromAddress;
  const backoffice = serverEnv.email.backofficeEmail;

  const hasTransport = Boolean(resendKey || smtpHost);
  if (!hasTransport && !backoffice && !fromAddr) return null;

  const layer: Partial<ResolvedEmailConfig> = {};

  if (backoffice) layer.backofficeEmail = backoffice;
  if (fromAddr)   layer.fromEmail       = fromAddr;

  if (smtpHost) {
    layer.transportType = "smtp";
    layer.smtpHost      = smtpHost;
    layer.smtpPort      = serverEnv.smtp.port ?? 587;
    layer.smtpUsername  = serverEnv.smtp.username;
    layer.smtpPassword  = serverEnv.smtp.password;
    layer.smtpSecure    = serverEnv.smtp.secure ?? false;
  } else if (resendKey) {
    layer.transportType = "resend";
    layer.resendApiKey  = resendKey;
  }

  return layer;
}
