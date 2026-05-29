/**
 * Admin — Platform Integrations › Email
 *
 * Platform-level email transport configuration.
 * Accessible at /admin/platform/integrations/email.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   The platform-level email transport (Resend or SMTP) used by default when
 *   a tenant has not configured their own transport in their Forms settings.
 *
 *   Also stores the platform-level backoffice notification address
 *   (BACKOFFICE_EMAIL override) and the From name/address.
 *
 * ─── Transport resolution at send-time ────────────────────────────────────────
 *
 *   1. Per-tenant DB config  (tenant_email_transport)     — highest priority
 *   2. Platform DB config    (this page — platform_settings.email)
 *   3. Env vars              (RESEND_API_KEY / SMTP_HOST) — legacy fallback
 *   4. None — silent skip
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   All secrets are stripped before crossing the server→client boundary.
 *   Only boolean "has key" flags are passed to the client component.
 */

import Link                      from "next/link";
import { serverEnv }             from "@/lib/env";
import {
  getPlatformEmailAction,
  savePlatformEmailAction,
  clearPlatformEmailTransportAction,
}                                from "./actions";
import { EmailPlatformClient }   from "./_components/EmailPlatformClient";

export default async function IntegrationsEmailPage() {
  const emailResult = await getPlatformEmailAction();

  // Env-var fallback status (informational — shown when platform DB is "none")
  const envResend = Boolean(serverEnv.email.resendApiKey);
  const envSmtp   = Boolean(serverEnv.smtp.host);
  const envBackoffice = Boolean(serverEnv.email.backofficeEmail);

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Platform Email — Default Transport</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            Platform default
          </span>
          <span className="text-xs text-neutral-400">— used when a tenant has no transport override</span>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Platform-wide fallback transport for form notifications and confirmations.
          This is used for any tenant that has not configured its own transport.
          To configure a transport for a specific tenant, go to that tenant&apos;s{" "}
          <Link href="/admin/tenants" className="font-medium underline hover:text-neutral-700">
            Forms settings
          </Link>
          .
        </p>
      </div>

      {/* Resolution order — helps admins understand where this fits */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p className="font-medium text-neutral-700 mb-1.5">Transport resolution order (highest priority first)</p>
        <ol className="space-y-0.5">
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
              1. Tenant
            </span>
            <span>— per-tenant transport configured in each tenant&apos;s Forms page</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
              2. Platform
            </span>
            <span>— <strong>this page</strong> — applies to all tenants without a tenant override</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-neutral-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />
              3. Env vars
            </span>
            <span>—{" "}
              <code className="bg-neutral-100 px-0.5 rounded">RESEND_API_KEY</code>{" "}
              /{" "}
              <code className="bg-neutral-100 px-0.5 rounded">SMTP_HOST</code>
            </span>
          </li>
        </ol>
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong>{" "}
        API keys and SMTP passwords are stored encrypted at rest and never
        returned to the browser after saving.
        The UI shows only whether a credential is configured, not its value.
      </div>

      {/* Env-var fallback status — shown when DB config is "none" */}
      {emailResult.ok && !emailResult.config.configured && (
        <div className={`rounded-lg border px-4 py-3 text-xs space-y-1 ${
          envResend || envSmtp
            ? "border-neutral-200 bg-neutral-50 text-neutral-600"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          <p className="font-medium">
            {envResend || envSmtp
              ? "Using env-var fallback transport"
              : "No transport configured"}
          </p>
          <p>
            {envResend && (
              <>
                <code className="bg-neutral-100 px-1 rounded">RESEND_API_KEY</code> is set in env —
                Resend will be used until you configure a DB transport above.
              </>
            )}
            {envSmtp && (
              <>
                <code className="bg-neutral-100 px-1 rounded">SMTP_HOST</code> is set in env —
                SMTP will be used until you configure a DB transport above.
              </>
            )}
            {!envResend && !envSmtp && (
              <>
                Neither <code className="bg-amber-100 px-1 rounded">RESEND_API_KEY</code> nor{" "}
                <code className="bg-amber-100 px-1 rounded">SMTP_HOST</code> is set.
                Configure a transport below or add an env var to enable email delivery.
              </>
            )}
          </p>
          {!envBackoffice && (
            <p>
              <code className={`px-1 rounded ${envResend || envSmtp ? "bg-neutral-100" : "bg-amber-100"}`}>
                BACKOFFICE_EMAIL
              </code>{" "}
              is not set — configure a Backoffice Email below so notifications have a destination.
            </p>
          )}
        </div>
      )}

      {/* Load error */}
      {!emailResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Failed to load email settings:</strong> {emailResult.error}
        </div>
      )}

      {/* Settings form */}
      {emailResult.ok && (
        <EmailPlatformClient
          initialConfig={emailResult.config}
          saveAction={savePlatformEmailAction}
          clearAction={clearPlatformEmailTransportAction}
        />
      )}

    </div>
  );
}
