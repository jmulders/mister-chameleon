/**
 * Tenant Form Settings Actions
 *
 * Server actions for reading and writing tenant-level form configuration from
 * the `tenant_form_settings` Supabase table, and tenant email transport
 * configuration from the `tenant_email_transport` table.
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   Input validation is minimal — the settings contain only scalar fields
 *   (booleans, string arrays, optional URLs) with no injection risk.
 *   We trim strings, filter empty values, and limit array length.
 *
 *   Secret fields (Resend API key, SMTP password) are encrypted at rest using
 *   AES-256-GCM (lib/email-crypto.ts) when EMAIL_ENCRYPTION_KEY is set.
 *   The actions NEVER return plaintext secret values to the client — only
 *   boolean `hasXxx` indicators so the client can show "key saved" UI.
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   These actions are called from the tenant admin workspace — only reachable
 *   by authenticated admins with access to this specific tenant.
 *   Authorization is enforced in the layout.tsx (assertTenantAccess).
 */

"use server";

import { revalidatePath }               from "next/cache";
import { getDb }                        from "@/data/db";
import { logger }                       from "@/lib/logger";
import type { TenantFormSettings }      from "@/tenant/types";
import { DEFAULT_TENANT_FORM_SETTINGS } from "@/tenant/types";
import { encryptSecret, hasStoredSecret } from "@/lib/email-crypto";
import { loadTenantEmailTransport }     from "@/forms/load-tenant-email-transport";
import { getPlatformEmailSettings }     from "@/platform/platform-store";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { serverEnv }                    from "@/lib/env";

// ── DB error classification ────────────────────────────────────────────────────

/**
 * The three distinguishable failure modes we surface to the admin UI.
 *
 *   "table_missing"    — the table itself does not exist in the DB.
 *                        Postgres 42P01 / PostgREST "Could not find the table".
 *                        Fix: run the pending migration.
 *
 *   "schema_mismatch"  — the table exists but a required column is absent or
 *                        the column type is incompatible.
 *                        Postgres 42703 / "column X does not exist".
 *                        Fix: check the expected column names below and ALTER
 *                        TABLE or recreate with the correct schema.
 *
 *   "permission_denied"— the DB role cannot SELECT the table (42501 / RLS).
 *                        Should not happen with the service-role key (which
 *                        bypasses RLS), but surfaces if SUPABASE_SERVICE_ROLE_KEY
 *                        is wrong or the table was created in a restricted schema.
 *
 *   "other"            — any other DB or network error.  The raw message is
 *                        surfaced so the admin can diagnose it.
 */
type DbErrorKind = "table_missing" | "schema_mismatch" | "permission_denied" | "other";

interface RawDbError {
  message: string;
  code?:   string;    // Postgres error code, e.g. "42P01", "42703"
  details?: string;
  hint?:    string;
}

/**
 * Classify a Supabase/PostgREST query error into one of the four kinds above.
 *
 * ─── Why the previous logic was wrong ────────────────────────────────────────
 *
 *   The old check used `message.includes("does not exist")` as a catch-all for
 *   "table missing".  That is too broad: Postgres uses the same phrase for
 *   column-missing errors (42703) and operator-missing errors, which have the
 *   same substring but a completely different fix.
 *
 *   Similarly, "schema cache" appears in PostgREST messages for BOTH
 *   table-missing and column-missing cases.
 *
 *   The fix: prefer the Postgres error CODE when available.  Fall back to
 *   message-text matching only when the code is absent, and be specific enough
 *   that the two cases don't overlap:
 *
 *     - table_missing: code 42P01 OR "could not find the table" phrase
 *     - schema_mismatch: code 42703 OR "column" appearing alongside "does not
 *       exist" OR "schema cache" when the table-specific phrase is absent
 */
function classifyDbError(err: RawDbError): DbErrorKind {
  const msg  = err.message.toLowerCase();
  const code = (err.code ?? "").toLowerCase();

  // ── 1. Prefer Postgres error codes (most reliable) ──────────────────────────

  if (code === "42p01") return "table_missing";      // undefined_table
  if (code === "42703") return "schema_mismatch";    // undefined_column
  if (code === "42501") return "permission_denied";  // insufficient_privilege

  // ── 2. PostgREST schema-cache phrases (table-level vs. column-level) ────────

  // "Could not find the table 'X' in the schema cache" — table is missing.
  // This phrase is table-specific and does NOT appear for column errors.
  if (msg.includes("could not find the table")) return "table_missing";

  // "Could not find a relationship between 'X' and 'Y' in the schema cache"
  // or "Could not find the column 'X' of the table 'Y' in the schema cache"
  // — the table exists but a column/relationship is wrong.
  if (msg.includes("schema cache") && (msg.includes("column") || msg.includes("relationship"))) {
    return "schema_mismatch";
  }

  // ── 3. "does not exist" disambiguation ──────────────────────────────────────
  //
  //   Postgres uses this phrase for both relations (tables/views) and columns.
  //   We distinguish them by checking whether "column" also appears in the message.
  //
  //   Table-missing: "relation \"public.tenant_form_settings\" does not exist"
  //   Column-missing: "column \"settings\" does not exist"
  //               or: "column tenant_form_settings.settings does not exist"

  if (msg.includes("does not exist")) {
    if (msg.includes("column") || msg.includes("operator") || msg.includes("function")) {
      return "schema_mismatch";   // column / function / operator missing
    }
    return "table_missing";       // relation / table missing
  }

  // Also catch the raw "undefined_table" literal (not typically seen via PostgREST
  // but can appear via direct pg connections or some client libs).
  if (msg.includes("undefined_table")) return "table_missing";
  if (msg.includes("undefined_column")) return "schema_mismatch";

  // ── 4. Permission phrases ────────────────────────────────────────────────────
  if (msg.includes("permission denied") || msg.includes("row-level security") || msg.includes("insufficient privilege")) {
    return "permission_denied";
  }

  return "other";
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load the current form settings for a tenant.
 * Returns DEFAULT_TENANT_FORM_SETTINGS when no row exists yet.
 */
export async function getTenantFormSettingsAction(tenantId: string): Promise<{
  ok:       true;
  settings: TenantFormSettings;
} | {
  ok:    false;
  error: string;
}> {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { settings: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error) {
      const rawErr = result.error as unknown as RawDbError;
      const kind   = classifyDbError(rawErr);

      logger.warn("[forms-settings-actions] DB error reading tenant_form_settings", {
        tenantId,
        kind,
        code:    rawErr.code,
        message: rawErr.message,
        details: rawErr.details,
      });

      if (kind === "table_missing") {
        return {
          ok:    false,
          error: "TABLE_NOT_FOUND: The tenant_form_settings table does not exist. Run the pending database migration to create it.",
        };
      }
      if (kind === "schema_mismatch") {
        return {
          ok:    false,
          error: `SCHEMA_MISMATCH: The tenant_form_settings table exists but a required column is missing or has the wrong type (${rawErr.message}). Expected columns: tenant_id TEXT UNIQUE, settings JSONB.`,
        };
      }
      if (kind === "permission_denied") {
        return {
          ok:    false,
          error: `PERMISSION_DENIED: The database user cannot access tenant_form_settings (${rawErr.message}). Ensure SUPABASE_SERVICE_ROLE_KEY is correct and the table is in the public schema.`,
        };
      }

      return { ok: false, error: rawErr.message };
    }

    if (!result.data) {
      return { ok: true, settings: { ...DEFAULT_TENANT_FORM_SETTINGS } };
    }

    const raw = result.data.settings;
    const settings: TenantFormSettings = {
      storeSubmissions: typeof raw.storeSubmissions === "boolean"
        ? raw.storeSubmissions
        : DEFAULT_TENANT_FORM_SETTINGS.storeSubmissions,

      notificationRecipients: Array.isArray(raw.notificationRecipients)
        ? (raw.notificationRecipients as unknown[])
            .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        : DEFAULT_TENANT_FORM_SETTINGS.notificationRecipients,

      replyTo: typeof raw.replyTo === "string" && raw.replyTo.trim() !== ""
        ? raw.replyTo.trim()
        : undefined,

      sendConfirmationEmails: typeof raw.sendConfirmationEmails === "boolean"
        ? raw.sendConfirmationEmails
        : DEFAULT_TENANT_FORM_SETTINGS.sendConfirmationEmails,

      webhookUrl: typeof raw.webhookUrl === "string" && raw.webhookUrl.trim() !== ""
        ? raw.webhookUrl.trim()
        : undefined,

      hubspotEnabled: typeof raw.hubspotEnabled === "boolean"
        ? raw.hubspotEnabled
        : false,

      successMessage: typeof raw.successMessage === "string" && raw.successMessage.trim() !== ""
        ? raw.successMessage.trim()
        : undefined,

      successRedirectUrl: typeof raw.successRedirectUrl === "string" && raw.successRedirectUrl.trim() !== ""
        ? raw.successRedirectUrl.trim()
        : undefined,

      // Turnstile site key is PUBLIC — safe to surface. The secret is never
      // returned here; use getTurnstileSettingsAction for a hasSecret boolean.
      turnstileSiteKey: typeof raw.turnstileSiteKey === "string" && raw.turnstileSiteKey.trim() !== ""
        ? raw.turnstileSiteKey.trim()
        : undefined,
    };

    return { ok: true, settings };
  } catch (err) {
    logger.error("[forms-settings-actions] Failed to read form settings", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Failed to read form settings" };
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Save form settings for a tenant.
 * Upserts a row in `tenant_form_settings` keyed by tenant_id.
 */
export async function saveTenantFormSettingsAction(
  tenantId: string,
  incoming: TenantFormSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required" };
  }

  // Preserve Turnstile keys — they're managed via the dedicated Turnstile
  // section (saveTurnstileSettingsAction) and must not be wiped by a full save
  // of the other settings. Read the current row and carry them over. The secret
  // (encrypted) is preserved as-is; the public site key is preserved unless the
  // incoming payload explicitly provides one.
  let prevTurnstileSiteKey: string | undefined;
  let prevTurnstileSecretKey: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: { settings: Record<string, unknown> } | null };
    const p = prev.data?.settings ?? {};
    if (typeof p.turnstileSiteKey === "string")   prevTurnstileSiteKey   = p.turnstileSiteKey;
    if (typeof p.turnstileSecretKey === "string") prevTurnstileSecretKey = p.turnstileSecretKey;
  } catch { /* no previous row — nothing to preserve */ }

  // Sanitise inputs before storing.
  const settings: TenantFormSettings = {
    storeSubmissions:       Boolean(incoming.storeSubmissions),
    notificationRecipients: (incoming.notificationRecipients ?? [])
      .map((r) => r.trim())
      .filter((r) => r !== "" && r.includes("@"))
      .slice(0, 20),                          // cap at 20 recipients
    replyTo:                incoming.replyTo?.trim() || undefined,
    sendConfirmationEmails: Boolean(incoming.sendConfirmationEmails),
    webhookUrl: incoming.webhookUrl?.trim() || undefined,
    hubspotEnabled: Boolean(incoming.hubspotEnabled),
    successMessage: incoming.successMessage?.trim() || undefined,
    successRedirectUrl: incoming.successRedirectUrl?.trim() || undefined,
    turnstileSiteKey:   incoming.turnstileSiteKey?.trim() || prevTurnstileSiteKey,
    turnstileSecretKey: prevTurnstileSecretKey,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (getDb() as any)
      .from("tenant_form_settings")
      .upsert(
        {
          tenant_id:  tenantId,
          settings:   settings as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };

    if (error) {
      logger.error("[forms-settings-actions] Failed to save form settings", {
        tenantId,
        error: error.message,
      });
      return { ok: false, error: `Failed to save: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/content/forms`);
    return { ok: true };
  } catch (err) {
    logger.error("[forms-settings-actions] Unexpected error saving form settings", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Failed to save form settings" };
  }
}

// ── Turnstile (Cloudflare CAPTCHA) keys ─────────────────────────────────────────

/**
 * Read the tenant's Turnstile config for the admin UI: the PUBLIC site key and
 * whether a secret is stored. The secret value is never returned to the client.
 */
export async function getTurnstileSettingsAction(
  tenantId: string,
): Promise<{ ok: true; siteKey: string; hasSecret: boolean } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { settings: Record<string, unknown> } | null;
        error: { message: string } | null;
      };
    if (res.error) return { ok: false, error: res.error.message };
    const s = res.data?.settings ?? {};
    return {
      ok:       true,
      siteKey:  typeof s.turnstileSiteKey === "string" ? s.turnstileSiteKey : "",
      hasSecret: hasStoredSecret(typeof s.turnstileSecretKey === "string" ? s.turnstileSecretKey : null),
    };
  } catch (err) {
    logger.error("[forms-settings-actions] Failed to read Turnstile settings", { tenantId, error: String(err) });
    return { ok: false, error: "Failed to read Turnstile settings" };
  }
}

/**
 * Save the tenant's Turnstile keys. Read-then-merge so the other form settings
 * are preserved. The site key is public (stored plain); the secret is encrypted
 * at rest. An empty secret input PRESERVES the existing secret, so the admin can
 * update the site key without re-entering the secret.
 */
export async function saveTurnstileSettingsAction(
  tenantId: string,
  input: { siteKey: string; secretKey: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: { settings: Record<string, unknown> } | null };
    const current = (prev.data?.settings ?? {}) as Record<string, unknown>;

    const siteKey   = input.siteKey.trim();
    const newSecret = input.secretKey.trim();
    const merged: Record<string, unknown> = {
      ...current,
      turnstileSiteKey:   siteKey || undefined,
      turnstileSecretKey: newSecret
        ? encryptSecret(newSecret)
        : (typeof current.turnstileSecretKey === "string" ? current.turnstileSecretKey : undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (getDb() as any)
      .from("tenant_form_settings")
      .upsert(
        { tenant_id: tenantId, settings: merged, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };
    if (error) return { ok: false, error: `Failed to save: ${error.message}` };

    revalidatePath(`/admin/tenants/${tenantId}/content/forms`);
    return { ok: true };
  } catch (err) {
    logger.error("[forms-settings-actions] Failed to save Turnstile settings", { tenantId, error: String(err) });
    return { ok: false, error: "Failed to save Turnstile settings" };
  }
}

// ── Targeted section saves ─────────────────────────────────────────────────────

/**
 * Save only the notification-recipient fields (recipients + replyTo).
 *
 * Reads the current row, merges the two fields, and writes back.
 * Other fields (storeSubmissions, sendConfirmationEmails, etc.) are preserved.
 * This prevents two independently-saveable sections from clobbering each other.
 */
export async function saveNotificationSettingsAction(
  tenantId: string,
  incoming: {
    notificationRecipients: string[];
    replyTo?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  const current = await getTenantFormSettingsAction(tenantId);
  const base: TenantFormSettings = current.ok ? current.settings : { ...DEFAULT_TENANT_FORM_SETTINGS };

  const merged: TenantFormSettings = {
    ...base,
    notificationRecipients: (incoming.notificationRecipients ?? [])
      .map((r) => r.trim())
      .filter((r) => r !== "" && r.includes("@"))
      .slice(0, 20),
    replyTo: incoming.replyTo?.trim() || undefined,
  };

  return saveTenantFormSettingsAction(tenantId, merged);
}

/**
 * Save only the form-behavior fields (storage, confirmation, webhook, success).
 *
 * Reads the current row, merges those fields, and writes back.
 * Notification recipients and replyTo are preserved unchanged.
 */
export async function saveFormBehaviorAction(
  tenantId: string,
  incoming: {
    storeSubmissions:       boolean;
    sendConfirmationEmails: boolean;
    webhookUrl?:            string;
    hubspotEnabled?:        boolean;
    successMessage?:        string;
    successRedirectUrl?:    string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  const current = await getTenantFormSettingsAction(tenantId);
  const base: TenantFormSettings = current.ok ? current.settings : { ...DEFAULT_TENANT_FORM_SETTINGS };

  const merged: TenantFormSettings = {
    ...base,
    storeSubmissions:       Boolean(incoming.storeSubmissions),
    sendConfirmationEmails: Boolean(incoming.sendConfirmationEmails),
    webhookUrl:             incoming.webhookUrl?.trim() || undefined,
    hubspotEnabled:         Boolean(incoming.hubspotEnabled),
    successMessage:         incoming.successMessage?.trim() || undefined,
    successRedirectUrl:     incoming.successRedirectUrl?.trim() || undefined,
  };

  return saveTenantFormSettingsAction(tenantId, merged);
}

// ── Test email ─────────────────────────────────────────────────────────────────

/**
 * Send a test email using the tenant's currently-resolved transport.
 *
 * Resolution order: tenant DB → platform DB → env vars.
 * Returns { ok: false } when no transport is configured at any level.
 */
export async function sendTestEmailAction(
  tenantId:        string,
  recipientEmail:  string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!tenantId)       return { ok: false, error: "tenantId is required" };
  if (!recipientEmail?.includes("@")) return { ok: false, error: "Valid recipient email is required" };

  try {
    const [tenantTransport, platformResult] = await Promise.all([
      loadTenantEmailTransport(tenantId),
      getPlatformEmailSettings(),
    ]);

    const platformConfig = platformResult.ok ? platformResult.data : null;
    const transportCfg   = resolveTransportConfig(tenantTransport, platformConfig);

    if (transportCfg.type === "none") {
      return {
        ok:    false,
        error: "No email transport is configured. Set up a transport in the Email Transport section or at Platform › Email.",
      };
    }

    // Build From address: tenant override → platform default → env fallback.
    const fromEmail =
      tenantTransport?.fromEmail ??
      platformConfig?.fromEmail ??
      serverEnv.email.fromAddress ??
      "noreply@example.com";
    const fromName = tenantTransport?.fromName ?? platformConfig?.fromName;
    const fromAddress = fromName?.trim()
      ? `${fromName.trim()} <${fromEmail}>`
      : fromEmail;

    const result = await sendMail(
      {
        from:    fromAddress,
        to:      [recipientEmail.trim()],
        subject: "Test email — Mister Chameleon platform",
        text: [
          "This is a test email sent from the Mister Chameleon admin panel.",
          "",
          `Tenant:    ${tenantId}`,
          `Transport: ${transportCfg.type}`,
          `Sent at:   ${new Date().toISOString()}`,
          "",
          "If you received this, email delivery is working correctly.",
        ].join("\n"),
      },
      transportCfg,
    );

    if (result.ok) {
      return { ok: true, message: `Test email sent to ${recipientEmail.trim()}.` };
    }
    return { ok: false, error: result.error };
  } catch (err) {
    logger.error("[forms-actions] sendTestEmailAction failed", { tenantId, error: String(err) });
    return { ok: false, error: "Failed to send test email" };
  }
}

// ── Reset transport ────────────────────────────────────────────────────────────

/**
 * Remove the tenant's email transport override row.
 *
 * After reset, the tenant falls back to the platform default transport (or env
 * vars).  This is equivalent to selecting "None / use platform default" and
 * saving, but more explicit and non-destructive — callers can undo by
 * re-configuring transport at any time.
 */
export async function resetTenantEmailTransportAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (getDb() as any)
      .from("tenant_email_transport")
      .delete()
      .eq("tenant_id", tenantId)) as { error: { message: string } | null };

    if (error) {
      logger.error("[email-transport-actions] Failed to reset email transport", {
        tenantId,
        error: error.message,
      });
      return { ok: false, error: `Failed to reset: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/content/forms`);
    return { ok: true };
  } catch (err) {
    logger.error("[email-transport-actions] Unexpected error resetting transport", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Failed to reset email transport" };
  }
}

// ── Email Transport ────────────────────────────────────────────────────────────

/**
 * The sanitised transport config returned to the client.
 * Secret values are NEVER included — only boolean indicators.
 */
export interface SafeTransportConfig {
  transportType:   "resend" | "smtp" | "none";
  fromName:        string;
  fromEmail:       string;
  // Resend
  hasResendKey:    boolean;
  // SMTP
  smtpHost:        string;
  smtpPort:        number;
  smtpUsername:    string;
  hasSmtpPassword: boolean;
  smtpSecure:      boolean;
}

/**
 * The form data the client sends to saveTenantEmailTransportAction.
 * Secret fields are empty string when the user wants to preserve the stored value.
 */
export interface TransportFormInput {
  transportType: "resend" | "smtp" | "none";
  fromName:      string;
  fromEmail:     string;
  resendApiKey:  string;   // empty = preserve existing stored key
  smtpHost:      string;
  smtpPort:      string;   // string because it comes from a form input
  smtpUsername:  string;
  smtpPassword:  string;   // empty = preserve existing stored password
  smtpSecure:    boolean;
}

/**
 * Load the current email transport config for a tenant.
 * Returns a SafeTransportConfig — secrets replaced with boolean indicators.
 */
export async function getTenantEmailTransportAction(tenantId: string): Promise<{
  ok:       true;
  config:   SafeTransportConfig;
} | {
  ok:    false;
  error: string;
}> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

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
      const rawErr = result.error as unknown as RawDbError;
      const kind   = classifyDbError(rawErr);

      logger.warn("[email-transport-actions] DB error reading tenant_email_transport", {
        tenantId,
        kind,
        code:    rawErr.code,
        message: rawErr.message,
        details: rawErr.details,
      });

      if (kind === "table_missing") {
        return {
          ok:    false,
          error: "TABLE_NOT_FOUND: The tenant_email_transport table does not exist. Run the pending database migration to create it.",
        };
      }
      if (kind === "schema_mismatch") {
        return {
          ok:    false,
          error: `SCHEMA_MISMATCH: The tenant_email_transport table exists but a required column is missing or has the wrong type (${rawErr.message}). Expected columns: tenant_id TEXT UNIQUE, config JSONB.`,
        };
      }
      if (kind === "permission_denied") {
        return {
          ok:    false,
          error: `PERMISSION_DENIED: The database user cannot access tenant_email_transport (${rawErr.message}). Ensure SUPABASE_SERVICE_ROLE_KEY is correct and the table is in the public schema.`,
        };
      }

      return { ok: false, error: rawErr.message };
    }

    if (!result.data) {
      // No row — return safe defaults.
      return { ok: true, config: defaultSafeConfig() };
    }

    return { ok: true, config: toSafeConfig(result.data.config) };
  } catch (err) {
    logger.error("[email-transport-actions] Failed to read email transport", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Failed to read email transport config" };
  }
}

/**
 * Save email transport config for a tenant.
 *
 * Secret fields (resendApiKey, smtpPassword) are only overwritten when
 * the client sends a non-empty value — an empty string means "keep existing".
 * Secrets are encrypted before storage when EMAIL_ENCRYPTION_KEY is set.
 */
export async function saveTenantEmailTransportAction(
  tenantId: string,
  input:    TransportFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  const transportType: "resend" | "smtp" | "none" =
    input.transportType === "resend" || input.transportType === "smtp"
      ? input.transportType
      : "none";

  try {
    // ── Load existing row so we can preserve stored secrets ───────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (await (getDb() as any)
      .from("tenant_email_transport")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    const prev = existing.data?.config ?? {};

    // ── Build the config to store ─────────────────────────────────────────────
    const config: Record<string, unknown> = {
      transportType,
      fromName:  input.fromName.trim()  || undefined,
      fromEmail: input.fromEmail.trim() || undefined,
    };

    if (transportType === "resend") {
      const newKey = input.resendApiKey.trim();
      config.resendApiKey = newKey
        ? encryptSecret(newKey)
        : (prev.resendApiKey ?? undefined); // preserve if empty
    }

    if (transportType === "smtp") {
      config.smtpHost     = input.smtpHost.trim()     || undefined;
      config.smtpPort     = Number(input.smtpPort)    || 587;
      config.smtpUsername = input.smtpUsername.trim() || undefined;
      config.smtpSecure   = Boolean(input.smtpSecure);

      const newPw = input.smtpPassword.trim();
      config.smtpPassword = newPw
        ? encryptSecret(newPw)
        : (prev.smtpPassword ?? undefined); // preserve if empty
    }

    // ── Upsert ────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (getDb() as any)
      .from("tenant_email_transport")
      .upsert(
        {
          tenant_id:  tenantId,
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };

    if (error) {
      logger.error("[email-transport-actions] Failed to save email transport", {
        tenantId,
        error: error.message,
      });
      return { ok: false, error: `Failed to save: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/content/forms`);
    return { ok: true };
  } catch (err) {
    logger.error("[email-transport-actions] Unexpected error saving email transport", {
      tenantId,
      error: String(err),
    });
    return { ok: false, error: "Failed to save email transport config" };
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function defaultSafeConfig(): SafeTransportConfig {
  return {
    transportType:   "none",
    fromName:        "",
    fromEmail:       "",
    hasResendKey:    false,
    smtpHost:        "",
    smtpPort:        587,
    smtpUsername:    "",
    hasSmtpPassword: false,
    smtpSecure:      false,
  };
}

function toSafeConfig(raw: Record<string, unknown>): SafeTransportConfig {
  const transportType: "resend" | "smtp" | "none" =
    raw.transportType === "resend" || raw.transportType === "smtp"
      ? raw.transportType
      : "none";

  return {
    transportType,
    fromName:        typeof raw.fromName  === "string" ? raw.fromName  : "",
    fromEmail:       typeof raw.fromEmail === "string" ? raw.fromEmail : "",
    // Resend
    hasResendKey:    hasStoredSecret(typeof raw.resendApiKey === "string" ? raw.resendApiKey : null),
    // SMTP
    smtpHost:        typeof raw.smtpHost     === "string" ? raw.smtpHost     : "",
    smtpPort:        typeof raw.smtpPort     === "number" ? raw.smtpPort     : 587,
    smtpUsername:    typeof raw.smtpUsername === "string" ? raw.smtpUsername : "",
    hasSmtpPassword: hasStoredSecret(typeof raw.smtpPassword === "string" ? raw.smtpPassword : null),
    smtpSecure:      typeof raw.smtpSecure   === "boolean" ? raw.smtpSecure  : false,
  };
}
