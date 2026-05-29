/**
 * loadTenantEmailTransport
 *
 * Server-only module that reads the tenant's email transport configuration
 * from the `tenant_email_transport` table, decrypts stored secrets, and
 * returns a ready-to-use TenantEmailTransport object.
 *
 * ─── Why a separate loader? ───────────────────────────────────────────────────
 *
 *   The form submission API route `/api/forms/[formKey]` needs the transport
 *   config at request time — it cannot rely on compile-time tenant config.
 *   This loader mirrors the pattern established by load-tenant-form-settings.ts.
 *
 * ─── Secret decryption ────────────────────────────────────────────────────────
 *
 *   SMTP passwords and Resend API keys are stored encrypted (AES-256-GCM)
 *   when EMAIL_ENCRYPTION_KEY is set.  Decryption happens here, at the
 *   boundary between storage and use — the transport layer receives
 *   already-decrypted values and never sees ciphertext.
 *
 * ─── Fallback ─────────────────────────────────────────────────────────────────
 *
 *   When no row exists for the tenant, null is returned.
 *   resolveTransportConfig() in mail-transport.ts then falls back to env vars.
 */

import "server-only";

import { getDb }            from "@/data/db";
import { logger }           from "@/lib/logger";
import { decryptSecret }    from "@/lib/email-crypto";
import type { TenantEmailTransport } from "@/tenant/types";

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Load the effective TenantEmailTransport for a tenant, with secrets decrypted.
 *
 * Returns null when:
 *   - tenantId is empty
 *   - no row exists (tenant hasn't configured transport → env-var fallback)
 *   - DB error (logged, falls back gracefully)
 *
 * @param tenantId  Tenant slug, e.g. "mister-chameleon".
 */
export async function loadTenantEmailTransport(
  tenantId: string,
): Promise<TenantEmailTransport | null> {
  if (!tenantId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_email_transport")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error) {
      logger.warn("[email-transport] Failed to load tenant email transport", {
        tenantId,
        error: result.error.message,
      });
      return null;
    }

    if (!result.data) {
      return null; // No row — fall back to env vars via resolveTransportConfig()
    }

    return decryptTransportConfig(result.data.config);
  } catch (err) {
    logger.warn("[email-transport] Unexpected error loading tenant email transport", {
      tenantId,
      error: String(err),
    });
    return null;
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function decryptTransportConfig(
  raw: Record<string, unknown>,
): TenantEmailTransport {
  const transportType = raw.transportType === "resend" || raw.transportType === "smtp"
    ? raw.transportType
    : "none" as const;

  const base: TenantEmailTransport = {
    transportType,
    fromName:  typeof raw.fromName  === "string" ? raw.fromName  : undefined,
    fromEmail: typeof raw.fromEmail === "string" ? raw.fromEmail : undefined,
  };

  if (transportType === "resend") {
    const storedKey = typeof raw.resendApiKey === "string" ? raw.resendApiKey : undefined;
    return {
      ...base,
      resendApiKey: storedKey ? safeDecrypt(storedKey, "resendApiKey") : undefined,
    };
  }

  if (transportType === "smtp") {
    const storedPw = typeof raw.smtpPassword === "string" ? raw.smtpPassword : undefined;
    return {
      ...base,
      smtpHost:     typeof raw.smtpHost     === "string" ? raw.smtpHost : undefined,
      smtpPort:     typeof raw.smtpPort     === "number" ? raw.smtpPort : undefined,
      smtpUsername: typeof raw.smtpUsername === "string" ? raw.smtpUsername : undefined,
      smtpPassword: storedPw ? safeDecrypt(storedPw, "smtpPassword") : undefined,
      smtpSecure:   typeof raw.smtpSecure   === "boolean" ? raw.smtpSecure : false,
    };
  }

  return base;
}

function safeDecrypt(stored: string, field: string): string | undefined {
  try {
    return decryptSecret(stored);
  } catch (err) {
    logger.error(`[email-transport] Failed to decrypt ${field}`, { error: String(err) });
    return undefined;
  }
}
