/**
 * Admin — Per-Form Configuration
 *
 * Accessible at /admin/tenants/[tenantId]/forms/[formKey].
 * Linked from the "Configure" button in the Registered Forms table.
 *
 * ─── What this page does ──────────────────────────────────────────────────────
 *
 *   Shows the full configuration picture for a single registered form:
 *
 *   1. Resolution chain   — where each flag currently comes from
 *                           (form override → tenant default → code definition)
 *   2. Override settings  — per-form master toggle + action flags +
 *                           custom recipients / subject / sender
 *   3. Form definition    — read-only summary of the code-side definition
 *
 * ─── Runtime ──────────────────────────────────────────────────────────────────
 *
 *   Must be Node.js — inheriting server actions call SMTP/nodemailer paths.
 *   "use server" files cannot export runtime config, so it belongs here.
 */
export const runtime = "nodejs";

import type React                 from "react";
import { notFound }              from "next/navigation";
import { getTenantById }         from "@/tenant/server";
import { normalizeTenant }       from "@/tenant/normalize";
import { Text }                  from "@/components/primitives/Text";
import { getFormDefinition, isFormKey } from "@/forms";
import {
  getTenantFormOverrideAction,
  saveTenantFormOverrideAction,
  resetTenantFormOverrideAction,
} from "./actions";
import { getTenantFormSettingsAction, getTurnstileSettingsAction } from "../actions";
import {
  listFormVariantsAction,
  saveFormVariantAction,
  deleteFormVariantAction,
} from "./form-variants-actions";
import { FormOverrideClient }    from "./_components/FormOverrideClient";
import { FormVariantsEditor }    from "./_components/FormVariantsEditor";
import { resolveFormsConfig }    from "@/lib/config";
import type { TenantFormOverrideSettings } from "@/tenant/types";

// ── Route params ───────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ tenantId: string; formKey: string }>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function FormConfigPage({ params }: PageProps) {
  const { tenantId, formKey } = await params;

  // Validate form key
  if (!isFormKey(formKey)) {
    notFound();
  }

  // Load tenant
  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();
  const tenant = normalizeTenant(rawTenant);

  // Load form definition
  const formDef = getFormDefinition(formKey);
  if (!formDef) notFound();

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  const [overrideResult, formSettingsResult, formsResolution, turnstileResult] = await Promise.all([
    getTenantFormOverrideAction(tenantId, formKey),
    getTenantFormSettingsAction(tenantId),
    resolveFormsConfig(tenantId),
    getTurnstileSettingsAction(tenantId),
  ]);

  // Whether the tenant has both a Turnstile site key and a stored secret.
  const turnstileHasKeys = turnstileResult.ok
    ? Boolean(turnstileResult.siteKey) && turnstileResult.hasSecret
    : false;

  // Authored form variants (forms-as-adaptive-blocks, phase 2.2).
  const formVariants = await listFormVariantsAction(tenantId, formKey);

  // Current override state (or defaults if none saved yet)
  const currentOverride = overrideResult.ok
    ? overrideResult.settings
    : ({
        overrideEnabled:  false,
        notifyEnabled:    true,
        confirmEnabled:   true,
        storeEnabled:     true,
        customRecipients: [],
        turnstileEnabled: false,
      } satisfies TenantFormOverrideSettings);

  // Tenant-level effective flags
  const tenantSettings = formSettingsResult.ok
    ? formSettingsResult.settings
    : { storeSubmissions: true, notificationRecipients: [], sendConfirmationEmails: true };

  const tenantRecipients    = tenantSettings.notificationRecipients ?? [];
  const effectiveRecipients = formsResolution.config.effectiveRecipients;

  // ── Effective resolution for the summary display ────────────────────────────
  //
  //  If override is enabled, the per-form values win.
  //  Otherwise the tenant value is effective (which itself may override code def).
  const isOverriding = currentOverride.overrideEnabled;

  const effNotify   = isOverriding ? currentOverride.notifyEnabled   : formDef.action.notifyBackoffice;
  const effConfirm  = isOverriding ? currentOverride.confirmEnabled  : tenantSettings.sendConfirmationEmails;
  const effStore    = isOverriding ? currentOverride.storeEnabled    : tenantSettings.storeSubmissions;
  const effRecips   = isOverriding && currentOverride.customRecipients.length > 0
    ? currentOverride.customRecipients
    : effectiveRecipients;

  const notifySource   = isOverriding ? "form"   : "tenant";
  const confirmSource  = isOverriding ? "form"   : "tenant";
  const storeSource    = isOverriding ? "form"   : (tenantSettings.storeSubmissions !== undefined ? "tenant" : "definition");
  const recipientSource = isOverriding && currentOverride.customRecipients.length > 0
    ? "form"
    : formsResolution.config.recipientSource;

  // ── Bound server actions ────────────────────────────────────────────────────
  const boundSave  = saveTenantFormOverrideAction.bind(null, tenantId, formKey);
  const boundReset = resetTenantFormOverrideAction.bind(null, tenantId, formKey);
  const boundSaveVariant   = saveFormVariantAction.bind(null, tenantId, formKey);
  const boundDeleteVariant = deleteFormVariantAction.bind(null, tenantId, formKey);

  return (
    <div className="p-8 max-w-3xl space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-neutral-900">
            {formDef.title} (Form Configuration)
          </h1>
          <p className="text-sm text-neutral-500">
            Per-form overrides for{" "}
            <span className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">{formKey}</span>{" "}
            on{" "}
            <span className="font-medium text-neutral-700">{tenant.name ?? tenantId}</span>.
            These settings override tenant defaults for this specific form only.
          </p>
        </div>
      </div>

      {/* ── 1. Resolution summary ────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Effective Configuration</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Resolved values for this form, showing which config layer each setting comes from.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-left border-b border-neutral-200">
              <tr>
                <th className="px-4 py-2.5 font-medium text-neutral-700">Setting</th>
                <th className="px-4 py-2.5 font-medium text-neutral-700 text-center">Effective</th>
                <th className="px-4 py-2.5 font-medium text-neutral-700">Source</th>
                <th className="px-4 py-2.5 font-medium text-neutral-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <ResolutionRow
                setting="Notify backoffice"
                effective={effNotify}
                source={notifySource}
                detail={`Definition: ${formDef.action.notifyBackoffice ? "on" : "off"} · Tenant: ${tenantSettings.storeSubmissions !== undefined ? "inherited" : "n/a"}`}
              />
              <ResolutionRow
                setting="Send confirmation"
                effective={effConfirm}
                source={confirmSource}
                detail={`Tenant default: ${tenantSettings.sendConfirmationEmails ? "on" : "off"} · Definition: ${formDef.action.sendConfirmation ? "on" : "off"}`}
              />
              <ResolutionRow
                setting="Store submission"
                effective={effStore}
                source={storeSource}
                detail={`Tenant default: ${tenantSettings.storeSubmissions ? "on" : "off"} · Definition: ${formDef.action.storeSubmissions ? "on" : "off"}`}
              />
              <tr className="last:border-0">
                <td className="px-4 py-2.5 text-neutral-700">Recipients</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="text-neutral-700">
                    {effRecips.length > 0 ? `${effRecips.length} address${effRecips.length > 1 ? "es" : ""}` : "none"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <SourceBadge source={recipientSource} />
                </td>
                <td className="px-4 py-2.5 text-neutral-400 truncate max-w-xs">
                  {effRecips.length > 0 ? effRecips.join(", ") : "No recipients. Emails will be skipped"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {currentOverride.customSubject && isOverriding && (
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-600">
            <span className="font-medium">Custom subject:</span> {currentOverride.customSubject}
          </div>
        )}
        {currentOverride.customSenderName && isOverriding && (
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-600">
            <span className="font-medium">Custom sender name:</span> {currentOverride.customSenderName}
          </div>
        )}
      </div>

      {/* ── 2. Override settings ─────────────────────────────────────────── */}
      <FormOverrideClient
        initialOverride={currentOverride}
        tenantNotify={formDef.action.notifyBackoffice}
        tenantConfirm={tenantSettings.sendConfirmationEmails}
        tenantStore={tenantSettings.storeSubmissions}
        tenantRecipients={tenantRecipients.length > 0 ? tenantRecipients : effectiveRecipients}
        defNotify={formDef.action.notifyBackoffice}
        defConfirm={formDef.action.sendConfirmation}
        defStore={formDef.action.storeSubmissions}
        turnstileHasKeys={turnstileHasKeys}
        saveAction={boundSave}
        resetAction={boundReset}
      />

      {/* ── 3. Variants (forms-as-adaptive-blocks) ───────────────────────── */}
      <FormVariantsEditor
        initialVariants={formVariants}
        saveAction={boundSaveVariant}
        deleteAction={boundDeleteVariant}
      />

      {/* ── 3. Form definition (read-only) ───────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Form Definition</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Code-side defaults for this form. These are the base values before any tenant or
            per-form overrides are applied. Read-only. Changes require a code deployment.
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <DefinitionRow label="Form key"   value={<code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">{formDef.key}</code>} />
          <DefinitionRow label="Title"      value={formDef.title} />
          <DefinitionRow label="Fields"     value={`${formDef.fields.length} field${formDef.fields.length !== 1 ? "s" : ""}: ${formDef.fields.map((f) => f.key).join(", ")}`} />
          <DefinitionRow label="Default notify"   value={formDef.action.notifyBackoffice ? "✓ on" : "✗ off"} />
          <DefinitionRow label="Default confirm"  value={formDef.action.sendConfirmation ? "✓ on" : "✗ off"} />
          <DefinitionRow label="Default store"    value={formDef.action.storeSubmissions ? "✓ on" : "✗ off"} />
          {formDef.action.successMessage && (
            <DefinitionRow label="Success message" value={formDef.action.successMessage} />
          )}
        </div>
      </div>

      {/* ── DB error banner (if override table is missing) ───────────────── */}
      {!overrideResult.ok && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 space-y-2">
          <p className="font-semibold">Form overrides table unavailable</p>
          <p className="text-xs opacity-80">{overrideResult.error}</p>
          <p className="text-xs">
            Run migration{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">
              20240101000037_create_tenant_form_overrides.sql
            </code>{" "}
            to enable per-form overrides, then reload this page.
          </p>
        </div>
      )}

    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function ResolutionRow({
  setting,
  effective,
  source,
  detail,
}: {
  setting:   string;
  effective: boolean;
  source:    string;
  detail:    string;
}) {
  return (
    <tr className="last:border-0">
      <td className="px-4 py-2.5 text-neutral-700">{setting}</td>
      <td className="px-4 py-2.5 text-center">
        {effective ? (
          <span className="inline-flex items-center gap-1 text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" aria-hidden /> on
          </span>
        ) : (
          <span className="text-neutral-400">off</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <SourceBadge source={source} />
      </td>
      <td className="px-4 py-2.5 text-neutral-400 text-xs">{detail}</td>
    </tr>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isForm   = source === "form";
  const isTenant = source === "tenant";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isForm
          ? "text-indigo-700"
          : isTenant
          ? "text-green-700"
          : "text-neutral-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isForm ? "bg-indigo-500" : isTenant ? "bg-green-500" : "bg-neutral-300"
        }`}
        aria-hidden
      />
      {isForm ? "Form override" : isTenant ? "Tenant" : source}
    </span>
  );
}

function DefinitionRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-neutral-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-neutral-800">{value}</span>
    </div>
  );
}
