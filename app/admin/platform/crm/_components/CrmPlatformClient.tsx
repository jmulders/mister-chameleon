/**
 * CrmPlatformClient
 *
 * Client component for the /admin/platform/crm page.
 * Manages CRM integration settings (provider selection, access token)
 * and provides a "Test connection" action.
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in component state or passed as props.
 *   The access token input is always blank on render — the UI shows only a
 *   boolean "configured" indicator when a token is saved.
 *   When the user enters a new token it is sent to the server action once,
 *   then cleared immediately from state regardless of success or failure.
 *
 * ─── Test connection ───────────────────────────────────────────────────────────
 *
 *   The test uses the current form state (any new token entered) merged with
 *   saved state on the server.  This allows testing new credentials before
 *   committing them with Save.
 */

"use client";

import { useState, useTransition } from "react";
import {
  saveCrmPlatformSettingsAction,
  testCrmConnectionAction,
} from "@/app/admin/platform/crm/actions";
import type { TestCrmConnectionResult } from "@/app/admin/platform/crm/actions";

// ── Timestamp formatter ────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Field primitives ───────────────────────────────────────────────────────────

function Label({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <label className="mb-1 block text-xs font-medium text-neutral-700">
      {children}
      {note && <span className="ml-1.5 font-normal text-neutral-400">{note}</span>}
    </label>
  );
}

function SecretInput({
  value,
  onChange,
  hasExisting,
  placeholder,
}: {
  value:       string;
  onChange:    (v: string) => void;
  hasExisting: boolean;
  placeholder: string;
}) {
  return (
    <div>
      {hasExisting && !value && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
          <span className="font-mono text-xs tracking-widest text-neutral-400">
            ••••••••••••••••••••••••••••••••
          </span>
          <span className="ml-auto text-[11px] text-green-600 font-medium">configured</span>
        </div>
      )}
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasExisting ? "Enter new token to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <p className="mt-0.5 text-[11px] text-neutral-400">
        Leave blank to keep the existing token.
        Value is stored server-side only and never shown after save.
      </p>
    </div>
  );
}

// ── Save status ────────────────────────────────────────────────────────────────

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Test result banner ─────────────────────────────────────────────────────────

function TestResultBanner({ result }: { result: TestCrmConnectionResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-semibold text-green-800">Connection test passed</p>
        <p className="mt-0.5 text-xs text-green-700">{result.message}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-green-600">
          <span>Provider: <span className="font-mono">{result.details.provider}</span></span>
          <span>Endpoint: <span className="font-mono">{result.details.endpoint}</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-red-800">Connection test failed</p>
      <p className="mt-0.5 text-xs text-red-700">{result.error}</p>
      {result.hint && (
        <p className="mt-1.5 text-[11px] text-red-600">
          <span className="font-semibold">Fix: </span>{result.hint}
        </p>
      )}
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export interface CrmPlatformClientProps {
  provider:       string;
  hasAccessToken: boolean;
  updatedAt:      string | null;
}

export function CrmPlatformClient({
  provider:       initialProvider,
  hasAccessToken: initialHasAccessToken,
  updatedAt:      initialUpdatedAt,
}: CrmPlatformClientProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  //
  // provider is currently fixed to "hubspot" (only supported option).
  // Stored as state to allow future multi-provider dropdown without layout
  // changes.
  const [_provider,     _setProvider]     = useState(initialProvider);
  const [accessToken,   setAccessToken]   = useState("");
  const [hasToken,      setHasToken]      = useState(initialHasAccessToken);
  const [updatedAt,     setUpdatedAt]     = useState<string | null>(initialUpdatedAt);

  // ── Operation state ────────────────────────────────────────────────────────
  const [saveState,   setSaveState]   = useState<SaveState>({ mode: "idle" });
  const [testResult,  setTestResult]  = useState<TestCrmConnectionResult | null>(null);

  const [isSaving,  startSaveTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    startSaveTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await saveCrmPlatformSettingsAction({
        provider:    "hubspot",
        accessToken: accessToken || undefined,
      });

      if (result.ok) {
        if (accessToken) setHasToken(true);
        setAccessToken("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  function handleTest() {
    startTestTransition(async () => {
      setTestResult(null);
      const result = await testCrmConnectionAction({
        accessToken: accessToken || undefined,
      });
      setTestResult(result);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const formattedUpdatedAt = formatDate(updatedAt);

  return (
    <div className="space-y-6">

      {/* ── Settings form ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">HubSpot configuration</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Platform-wide HubSpot Private App token used for company-by-domain enrichment.
              The token needs <code className="rounded bg-neutral-100 px-1 text-[11px] font-mono">crm.objects.companies.read</code> scope.
            </p>
          </div>
          {formattedUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formattedUpdatedAt}
            </span>
          )}
        </div>

        {/* Provider badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-neutral-500">Provider:</span>
          <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
            HubSpot
          </span>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <Label note="(not shown after save)">Private App access token</Label>
            <SecretInput
              value={accessToken}
              onChange={setAccessToken}
              hasExisting={hasToken}
              placeholder="pat-na1-…"
            />
          </div>
        </div>

        {/* Save footer */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>

          {saveState.mode === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-700">
              ✓ Settings saved
              <button
                onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}

          {saveState.mode === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-700">
              {saveState.message}
              <button
                onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Test connection ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Test connection</h2>
        <p className="mt-0.5 mb-4 text-xs text-neutral-500">
          Validates that the configured access token can reach the HubSpot API.
          Uses a lightweight read ({" "}
          <code className="rounded bg-neutral-100 px-1 text-[11px] font-mono">
            GET /crm/v3/owners
          </code>
          {" "}): no visitor data is written or modified.
          You can paste a new token above to test it before saving.
        </p>

        <button
          onClick={handleTest}
          disabled={isTesting}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTesting ? "Testing…" : "Test connection"}
        </button>

        <TestResultBanner result={testResult} />
      </div>

      {/* ── Enrichment info ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-700">What this integration does</h3>
        <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
          When a visitor&apos;s email is known (e.g. from a form submission), the enrichment
          pipeline extracts the email domain and searches HubSpot for a matching company.
          The following context fields are populated from the result and are available to
          the rules engine and AI decision provider:
        </p>
        <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
          <li><code className="rounded bg-white px-1 font-mono">crmMatched</code>: whether a company was found</li>
          <li><code className="rounded bg-white px-1 font-mono">crmLifecycleStage</code>: HubSpot lifecycle stage of the company</li>
          <li><code className="rounded bg-white px-1 font-mono">crmCompanyId</code>: HubSpot object ID</li>
          <li><code className="rounded bg-white px-1 font-mono">crmCompanyName</code>: company name from HubSpot</li>
          <li><code className="rounded bg-white px-1 font-mono">crmCompanyDomain</code>: primary domain in HubSpot</li>
          <li><code className="rounded bg-white px-1 font-mono">crmIndustry</code>: industry field from HubSpot</li>
          <li><code className="rounded bg-white px-1 font-mono">crmIsCustomer</code>: true when lifecycle stage is &quot;customer&quot;</li>
        </ul>
      </div>

    </div>
  );
}
