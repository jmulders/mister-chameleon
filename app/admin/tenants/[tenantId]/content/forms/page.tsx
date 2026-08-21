/**
 * Admin — Tenant Form Settings
 *
 * Accessible at /admin/tenants/[tenantId]/content/forms.
 *
 * This is the primary page for configuring how form submissions are handled
 * for a tenant.  It covers:
 *
 *   1. Effective Status Summary — at-a-glance resolved state across all layers
 *   2. Email Transport          — configure or inherit the outbound email transport
 *   3. Notification Recipients  — who receives backoffice notifications + reply-to
 *   4. Default Form Behavior    — store / confirm / webhook / success defaults
 *   5. Registered Forms         — read-only table of platform-registered forms
 *
 * ─── Resolution model ─────────────────────────────────────────────────────────
 *
 *   All settings follow the four-layer model:
 *
 *     tenant → platform → env → system    (tenant wins)
 *
 *   The EffectiveStatusSummary at the top shows which layer is active for each
 *   key dimension so admins can understand the current state at a glance.
 *
 * ─── Independent section saves ────────────────────────────────────────────────
 *
 *   Each section saves independently via a dedicated server action so changes
 *   to one section cannot clobber another.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   1. Server page fetches all required data in parallel.
 *   2. EffectiveStatusSummary receives pre-computed resolved values as props.
 *   3. Client components receive their initial values + bound server actions.
 *   4. On save, actions run read-then-merge to preserve other sections.
 */

// ─── Runtime ──────────────────────────────────────────────────────────────────
// Force the Node.js runtime for this route segment.
//
// Server actions inherit the runtime of the page/layout that invokes them.
// sendTestEmailAction calls sendViaSMTP → nodemailer, which is a Node.js-only
// package.  Declaring `runtime = "nodejs"` here ensures every server action
// exported from actions.ts in this segment runs in the Node.js runtime and
// never in the Edge runtime where Node.js APIs are unavailable.
//
// "use server" files may only export async functions — the runtime config
// therefore lives here in the page, not in actions.ts.
export const runtime = "nodejs";

import { notFound }        from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { Text }            from "@/components/primitives/Text";
import {
  getTenantFormSettingsAction,
  getTenantEmailTransportAction,
  saveTenantEmailTransportAction,
  saveNotificationSettingsAction,
  saveFormBehaviorAction,
  sendTestEmailAction,
  resetTenantEmailTransportAction,
  getTurnstileSettingsAction,
  saveTurnstileSettingsAction,
} from "./actions";
import { TurnstileSettingsClient } from "./_components/TurnstileSettingsClient";
import { TenantEmailTransportClient } from "./_components/TenantEmailTransportClient";
import { NotificationRecipientsClient } from "./_components/NotificationRecipientsClient";
import { DefaultFormBehaviorClient }   from "./_components/DefaultFormBehaviorClient";
import { RegisteredFormsTable }        from "./_components/RegisteredFormsTable";
import {
  EffectiveStatusSummary,
} from "./_components/EffectiveStatusSummary";
import { RetentionSettingsClient }     from "./_components/RetentionSettingsClient";
import { getAllFormDefinitions }        from "@/forms";
import { serverEnv }                   from "@/lib/env";
import Link                            from "next/link";
import {
  getPlatformEmailSettings,
  emailPlatformFlags,
} from "@/platform/platform-store";
import {
  resolveEmailConfig,
  resolveFormsConfig,
} from "@/lib/config";

export default async function TenantFormsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [
    formSettingsResult,
    transportResult,
    platformEmailResult,
    emailResolution,
    formsResolution,
  ] = await Promise.all([
    getTenantFormSettingsAction(tenantId),
    getTenantEmailTransportAction(tenantId),
    getPlatformEmailSettings(),
    resolveEmailConfig(tenantId),
    resolveFormsConfig(tenantId),
  ]);

  const turnstileResult = await getTurnstileSettingsAction(tenantId);

  const formDefs = getAllFormDefinitions();

  // ── Platform transport info (for labels / fallback description) ────────────
  const platformFlags            = platformEmailResult.ok ? emailPlatformFlags(platformEmailResult.data) : null;
  const platformTransportType    = (platformFlags?.transportType ?? "none") as "resend" | "smtp" | "none";
  const platformTransportLabel: string | null = platformFlags?.configured
    ? (platformTransportType === "resend" ? "Resend" : "SMTP")
    : null;

  // ── Env transport fallback indicators ─────────────────────────────────────
  const envResendConfigured = Boolean(serverEnv.email.resendApiKey);
  const envSmtpConfigured   = Boolean(serverEnv.smtp.host);

  // ── Effective resolved values for the status summary ──────────────────────
  //
  //   emailResolution.config has the fully-merged config across all layers.
  //   emailResolution.source is the winning layer.
  const effectiveTransportType   = emailResolution.config.transportType ?? "none";
  const effectiveTransportSource = emailResolution.source;
  const effectiveFromEmail       = emailResolution.config.fromEmail ?? null;
  const effectiveFromName        = emailResolution.config.fromName  ?? null;

  // Sender source: treat transport source as a reasonable proxy
  // (the from address usually comes from the same layer as the transport).
  const senderSource = effectiveTransportSource;

  // Recipient resolution
  const tenantRecipients        = formSettingsResult.ok ? formSettingsResult.settings.notificationRecipients : [];
  const platformBackofficeEmail = platformEmailResult.ok ? (platformEmailResult.data.backofficeEmail ?? null) : null;
  const envBackofficeEmail      = serverEnv.email.backofficeEmail ?? null;
  const recipientSource         = formsResolution.config.recipientSource;
  const effectiveRecipients     = formsResolution.config.effectiveRecipients;

  // ── Form settings (with defaults) ─────────────────────────────────────────
  const formSettings = formSettingsResult.ok
    ? formSettingsResult.settings
    : { storeSubmissions: true, notificationRecipients: [], sendConfirmationEmails: true };

  // ── Retention setting ──────────────────────────────────────────────────────
  const retentionDays = formSettingsResult.ok
    ? (formSettingsResult.settings.submissionRetentionDays ?? null)
    : null;

  // ── Bound server actions ───────────────────────────────────────────────────
  const boundSaveTransport       = saveTenantEmailTransportAction.bind(null, tenantId);
  const boundTestEmail           = sendTestEmailAction.bind(null, tenantId);
  const boundResetTransport      = resetTenantEmailTransportAction.bind(null, tenantId);
  const boundSaveNotifications   = saveNotificationSettingsAction.bind(null, tenantId);
  const boundSaveFormBehavior    = saveFormBehaviorAction.bind(null, tenantId);
  const boundSaveTurnstile       = saveTurnstileSettingsAction.bind(null, tenantId);

  return (
    <div className="p-8 max-w-3xl space-y-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-neutral-900">Form Settings</h1>
          <p className="text-sm text-neutral-500">
            Configure email delivery, notifications, and form behavior for{" "}
            <span className="font-medium text-neutral-700">
              {tenant.name ?? tenant.tenantId}
            </span>
            .
          </p>
        </div>
        {/* Discoverable entry point to the submissions inbox (same tenant scope). */}
        <Link
          href={`/admin/tenants/${tenant.tenantId}/content/forms/submissions`}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          View submissions
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {/* ── 1. Effective Status Summary ──────────────────────────────────── */}
      <EffectiveStatusSummary
        transportType={effectiveTransportType as "resend" | "smtp" | "none"}
        transportSource={effectiveTransportSource}
        fromEmail={effectiveFromEmail}
        fromName={effectiveFromName}
        senderSource={senderSource}
        recipientCount={effectiveRecipients.length}
        recipientSample={effectiveRecipients[0] ?? null}
        recipientSource={recipientSource}
        storeSubmissions={formSettings.storeSubmissions}
        sendConfirmationEmails={formSettings.sendConfirmationEmails}
        webhookConfigured={Boolean(formSettings.webhookUrl)}
      />

      {/* ── 2. Email Transport ────────────────────────────────────────────── */}
      {transportResult.ok ? (
        <TenantEmailTransportClient
          initialConfig={transportResult.config}
          saveAction={boundSaveTransport}
          testEmailAction={boundTestEmail}
          resetAction={boundResetTransport}
          platformTransportType={platformTransportType}
          platformTransportLabel={platformTransportLabel}
        />
      ) : (
        <DbErrorBanner
          sectionTitle="Email Transport"
          error={transportResult.error}
          table="tenant_email_transport"
          expectedColumns={[
            { name: "id",         type: "uuid",        note: "PRIMARY KEY DEFAULT gen_random_uuid()" },
            { name: "tenant_id",  type: "text",        note: "NOT NULL UNIQUE" },
            { name: "config",     type: "jsonb",       note: "NOT NULL DEFAULT '{}'" },
            { name: "updated_at", type: "timestamptz", note: "NOT NULL DEFAULT now()" },
          ]}
        />
      )}

      {/* ── 3. Notification Recipients ───────────────────────────────────── */}
      {formSettingsResult.ok ? (
        <NotificationRecipientsClient
          initialRecipients={tenantRecipients}
          initialReplyTo={formSettings.replyTo ?? ""}
          recipientSource={recipientSource}
          platformBackofficeEmail={platformBackofficeEmail}
          envBackofficeEmail={envBackofficeEmail}
          saveAction={boundSaveNotifications}
        />
      ) : (
        <DbErrorBanner
          sectionTitle="Notification Recipients / Form Settings"
          error={formSettingsResult.error}
          table="tenant_form_settings"
          expectedColumns={[
            { name: "id",         type: "uuid",        note: "PRIMARY KEY DEFAULT gen_random_uuid()" },
            { name: "tenant_id",  type: "text",        note: "NOT NULL UNIQUE" },
            { name: "settings",   type: "jsonb",       note: "NOT NULL DEFAULT '{}'" },
            { name: "updated_at", type: "timestamptz", note: "NOT NULL DEFAULT now()" },
          ]}
        />
      )}

      {/* ── 4. Default Form Behavior ─────────────────────────────────────── */}
      {formSettingsResult.ok ? (
        <DefaultFormBehaviorClient
          initial={{
            storeSubmissions:       formSettings.storeSubmissions,
            sendConfirmationEmails: formSettings.sendConfirmationEmails,
            webhookUrl:             formSettings.webhookUrl,
            hubspotEnabled:         formSettings.hubspotEnabled,
            successMessage:         formSettings.successMessage,
            successRedirectUrl:     formSettings.successRedirectUrl,
          }}
          saveAction={boundSaveFormBehavior}
        />
      ) : null /* error already shown in section 3 above */}

      {/* ── 4b. Spam protection — Cloudflare Turnstile keys ──────────────── */}
      <TurnstileSettingsClient
        initialSiteKey={turnstileResult.ok ? turnstileResult.siteKey : ""}
        hasSecret={turnstileResult.ok ? turnstileResult.hasSecret : false}
        saveAction={boundSaveTurnstile}
      />

      {/* ── 5. Registered Forms ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <RegisteredFormsTable
          forms={formDefs.map((def) => ({
            key:       def.key,
            title:     def.title,
            defStore:  def.action.storeSubmissions,
            defNotify: def.action.notifyBackoffice,
            defConfirm: def.action.sendConfirmation,
          }))}
          tenantId={tenantId}
          tenantStore={formSettings.storeSubmissions}
          tenantConfirm={formSettings.sendConfirmationEmails}
          tenantHasRecipients={tenantRecipients.length > 0 || effectiveRecipients.length > 0}
        />
        <div className="flex justify-end gap-2">
          {/* Contextual forms now lives under the Personalization tab. */}
          <Link
            href={`/admin/tenants/${tenantId}/content/forms/submissions`}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            View submissions →
          </Link>
        </div>
      </div>

      {/* ── 6. Retention Settings (AVG) ──────────────────────────────────── */}
      <RetentionSettingsClient
        tenantId={tenantId}
        initialRetentionDays={retentionDays}
      />

      {/* ── Env-var transport warning (no DB config at any level) ─────────── */}
      {!transportResult.ok && !platformFlags?.configured && (envResendConfigured || envSmtpConfigured) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <span className="font-medium">Env-var transport active:</span>{" "}
          {envResendConfigured ? "RESEND_API_KEY" : "SMTP_HOST"} is set and will be used as
          the transport fallback. Configure a tenant or platform transport above for better
          control.
        </div>
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

interface ExpectedColumn {
  name: string;
  type: string;
  note: string;
}

/**
 * DbErrorBanner
 *
 * Renders one of four distinct diagnostic panels depending on the error kind:
 *
 *   TABLE_NOT_FOUND   — table missing → run migration
 *   SCHEMA_MISMATCH   — table exists, column missing → ALTER TABLE
 *   PERMISSION_DENIED — service role can't access table → wrong key / wrong schema
 *   other             — raw error message with the expected schema as context
 *
 * The `expectedColumns` prop is always shown so the admin can compare against
 * whatever they manually created.
 */
function DbErrorBanner({
  sectionTitle,
  error,
  table,
  expectedColumns,
}: {
  sectionTitle:    string;
  error:           string;
  table:           string;
  expectedColumns: ExpectedColumn[];
}) {
  // Strip the error-kind prefix to get a clean raw message for display.
  const rawMessage = error
    .replace(/^TABLE_NOT_FOUND:\s*/,    "")
    .replace(/^SCHEMA_MISMATCH:\s*/,    "")
    .replace(/^PERMISSION_DENIED:\s*/, "");

  const isTableMissing    = error.startsWith("TABLE_NOT_FOUND");
  const isSchemaMismatch  = error.startsWith("SCHEMA_MISMATCH");
  const isPermissionError = error.startsWith("PERMISSION_DENIED");

  // Build the CREATE TABLE SQL so admins can copy-paste to fix things.
  const createSql =
    `CREATE TABLE IF NOT EXISTS public.${table} (\n` +
    expectedColumns.map((c) => `  ${c.name.padEnd(12)} ${c.type.padEnd(12)} ${c.note}`).join(",\n") +
    `\n);\n` +
    `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_tenant_id_key ON public.${table} (tenant_id);`;

  return (
    <div className={`rounded-xl border px-5 py-4 text-sm space-y-3 ${
      isPermissionError
        ? "border-red-200 bg-red-50 text-red-900"
        : isSchemaMismatch
        ? "border-orange-200 bg-orange-50 text-orange-900"
        : "border-amber-200 bg-amber-50 text-amber-900"
    }`}>
      {/* ── Headline ────────────────────────────────────────────────────── */}
      <div>
        <p className="font-semibold">
          {isTableMissing    && `${sectionTitle} (table missing)`}
          {isSchemaMismatch  && `${sectionTitle} (schema mismatch)`}
          {isPermissionError && `${sectionTitle} (permission denied)`}
          {!isTableMissing && !isSchemaMismatch && !isPermissionError && `${sectionTitle} (database error)`}
        </p>
        <p className="text-xs mt-0.5 opacity-80">{rawMessage}</p>
      </div>

      {/* ── Explanation ─────────────────────────────────────────────────── */}
      {isTableMissing && (
        <p>
          The <code className="font-mono text-xs bg-amber-100 px-1 rounded">{table}</code> table
          does not exist in your Supabase database. Run the pending migration or use the SQL
          below to create it manually, then reload this page.
        </p>
      )}
      {isSchemaMismatch && (
        <p>
          The <code className="font-mono text-xs bg-orange-100 px-1 rounded">{table}</code> table
          exists but is missing a required column or has an incompatible type. Compare the columns
          in your table against the expected schema below.
          Use <code className="font-mono text-xs bg-orange-100 px-1 rounded">ALTER TABLE</code> to
          add missing columns, or drop and recreate the table using the SQL below.
        </p>
      )}
      {isPermissionError && (
        <p>
          The server cannot read{" "}
          <code className="font-mono text-xs bg-red-100 px-1 rounded">{table}</code>.
          Possible causes: (1) <code className="font-mono text-xs bg-red-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is
          wrong or points to a different project, (2) the table was created in a schema other
          than <code className="font-mono text-xs bg-red-100 px-1 rounded">public</code>, or
          (3) an unusual RLS policy blocks the service role.
        </p>
      )}
      {!isTableMissing && !isSchemaMismatch && !isPermissionError && (
        <p>
          An unexpected error occurred querying{" "}
          <code className="font-mono text-xs bg-neutral-100 px-1 rounded">{table}</code>.
          Check the server logs for the full Postgres error code and details.
        </p>
      )}

      {/* ── Expected schema ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium mb-1">Expected schema for <code className="font-mono">{table}</code></p>
        <table className="w-full text-xs border border-current/20 rounded overflow-hidden">
          <thead>
            <tr className="bg-current/5">
              <th className="px-3 py-1.5 text-left font-medium">Column</th>
              <th className="px-3 py-1.5 text-left font-medium">Type</th>
              <th className="px-3 py-1.5 text-left font-medium">Constraint</th>
            </tr>
          </thead>
          <tbody>
            {expectedColumns.map((col) => (
              <tr key={col.name} className="border-t border-current/10">
                <td className="px-3 py-1.5 font-mono">{col.name}</td>
                <td className="px-3 py-1.5 font-mono">{col.type}</td>
                <td className="px-3 py-1.5 opacity-70">{col.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Quick-fix SQL ───────────────────────────────────────────────── */}
      {(isTableMissing || isSchemaMismatch) && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium select-none">
            Show CREATE TABLE SQL ▸
          </summary>
          <pre className={`mt-2 rounded-lg text-xs p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed ${
            isSchemaMismatch
              ? "bg-orange-100 text-orange-900"
              : "bg-amber-100 text-amber-900"
          }`}>
            {createSql}
          </pre>
          <p className="text-xs mt-1 opacity-70">
            Run in Supabase Dashboard → SQL Editor, or via{" "}
            <code className="font-mono">supabase db push</code> after adding the migration file.
          </p>
        </details>
      )}
    </div>
  );
}
