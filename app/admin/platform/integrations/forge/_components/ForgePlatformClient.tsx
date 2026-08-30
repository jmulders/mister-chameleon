/**
 * ForgePlatformClient
 *
 * Client component for /admin/platform/integrations/forge.
 * Manages Laravel Forge credentials and deployment defaults for automated
 * Statamic site provisioning.
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in state or passed as props.
 *   The server page passes only boolean flags and non-secret fields.
 *   The API token is sent once to the server action and immediately cleared.
 */

"use client";

import { useState, useTransition } from "react";
import {
  savePlatformForgeSettingsAction,
  testForgeConnectionAction,
}                                   from "@/app/admin/platform/integrations/forge/actions";

// ── Shared primitives ──────────────────────────────────────────────────────────

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

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  hint?:       string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function SecretField({
  label,
  value,
  onChange,
  hasExisting,
  placeholder,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  hasExisting: boolean;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
        <span className="ml-1.5 font-normal text-neutral-400">(not shown after save)</span>
      </label>
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
        Leave blank to keep the existing value. Stored server-side only, never echoed back.
      </p>
    </div>
  );
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

type TestState =
  | { mode: "idle" }
  | { mode: "testing" }
  | { mode: "success"; message: string }
  | { mode: "error"; message: string };

// ── Root component ─────────────────────────────────────────────────────────────

export interface ForgePlatformClientProps {
  hasApiKey:       boolean;
  defaultServerId: number | null;
  gitRepository:   string;
  gitBranch:       string;
  phpVersion:      string;
  isConfigured:    boolean;
  updatedAt:       string | null;
}

export function ForgePlatformClient({
  hasApiKey:       initialHasApiKey,
  defaultServerId: initialDefaultServerId,
  gitRepository:   initialGitRepository,
  gitBranch:       initialGitBranch,
  phpVersion:      initialPhpVersion,
  isConfigured:    initialIsConfigured,
  updatedAt:       initialUpdatedAt,
}: ForgePlatformClientProps) {
  const [apiKey,          setApiKey]          = useState("");
  const [hasApiKey,       setHasApiKey]       = useState(initialHasApiKey);
  const [defaultServerId, setDefaultServerId] = useState(
    initialDefaultServerId !== null ? String(initialDefaultServerId) : "",
  );
  const [gitRepository,   setGitRepository]   = useState(initialGitRepository);
  const [gitBranch,       setGitBranch]       = useState(initialGitBranch);
  const [phpVersion,      setPhpVersion]      = useState(initialPhpVersion);
  const [isConfigured,    setIsConfigured]    = useState(initialIsConfigured);
  const [updatedAt,       setUpdatedAt]       = useState<string | null>(initialUpdatedAt);
  const [saveState,       setSaveState]       = useState<SaveState>({ mode: "idle" });
  const [testState,       setTestState]       = useState<TestState>({ mode: "idle" });
  const [isSaving,        startSave]          = useTransition();
  const [isTesting,       startTest]          = useTransition();

  const formatted = formatDate(updatedAt);

  function handleSave() {
    startSave(async () => {
      setSaveState({ mode: "saving" });

      const serverIdNum = defaultServerId.trim()
        ? parseInt(defaultServerId.trim(), 10)
        : null;

      const result = await savePlatformForgeSettingsAction({
        apiKey:          apiKey || undefined,
        defaultServerId: serverIdNum,
        gitRepository:   gitRepository || undefined,
        gitBranch:       gitBranch     || undefined,
        phpVersion:      phpVersion    || undefined,
      });

      if (result.ok) {
        if (apiKey) setHasApiKey(true);
        setApiKey("");
        if (serverIdNum) setIsConfigured(true);
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  function handleTest() {
    startTest(async () => {
      setTestState({ mode: "testing" });
      const result = await testForgeConnectionAction();
      if (result.ok) {
        setTestState({ mode: "success", message: result.message });
      } else {
        setTestState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* Forge credentials card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Laravel Forge API</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                isConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-neutral-100 text-neutral-500"
              }`}>
                {isConfigured ? "✓ Configured" : "Not configured"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Personal API token and defaults for automated Statamic site deployment.
              Used when deploying a new Statamic tenant from the tenant setup page.
            </p>
          </div>
          {formatted && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatted}
            </span>
          )}
        </div>

        <div className="space-y-4">

          <SecretField
            label="Personal API token"
            value={apiKey}
            onChange={setApiKey}
            hasExisting={hasApiKey}
            placeholder="forge_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />

          <TextField
            label="Default server ID"
            value={defaultServerId}
            onChange={setDefaultServerId}
            placeholder="e.g. 123456"
            hint="Numeric Forge server ID. Shown in your server URL: forge.laravel.com/servers/123456. Used as the default for all Statamic deployments; can be overridden per deployment."
          />

          <TextField
            label="Git repository"
            value={gitRepository}
            onChange={setGitRepository}
            placeholder="org/mister-chameleon-cms"
            hint="GitHub repository containing the Statamic starter, in org/repo format."
          />

          <TextField
            label="Git branch"
            value={gitBranch}
            onChange={setGitBranch}
            placeholder="starter"
            hint="Branch to deploy. Should be a clean 'starter' branch without MC-specific content."
          />

          <TextField
            label="PHP version"
            value={phpVersion}
            onChange={setPhpVersion}
            placeholder="php82"
            hint="Forge PHP version identifier used when creating new sites. E.g. php82, php83."
          />
        </div>

        {/* Footer */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting || !hasApiKey}
            className="rounded border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isTesting ? "Testing…" : "Test connection"}
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

          {testState.mode === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-700">
              ✓ {testState.message}
              <button
                onClick={() => setTestState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}

          {testState.mode === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-700">
              Connection failed: {testState.message}
              <button
                onClick={() => setTestState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-700">How Forge deployment works</h3>
        <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
          When you click <strong>Deploy Statamic</strong> on a tenant&apos;s Setup page, the platform
          runs the following steps automatically:
        </p>
        <ol className="mt-2 space-y-1 text-[11px] text-neutral-500 list-decimal list-inside">
          <li>Create a new Forge site on the configured server (or the selected server)</li>
          <li>Install the Git repository and deploy the starter branch</li>
          <li>Generate a unique Statamic API token and push it to the site&apos;s .env</li>
          <li>Trigger the first deployment and wait for it to finish</li>
          <li>Run artisan commands (key:generate, migrate, etc.)</li>
          <li>Store the Statamic base URL and API token in the tenant settings</li>
          <li>Run <em>Initialize site</em> to seed blueprints, navigation, and globals</li>
        </ol>
      </div>

      {/* Security note */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
        <h3 className="text-xs font-semibold text-amber-800">Security note</h3>
        <p className="mt-1 text-xs text-amber-700 leading-relaxed">
          The Forge Personal API Token has broad access to your Forge account.
          Treat it like a password. It is stored encrypted at rest in the platform
          database and never returned to the browser after saving.
        </p>
      </div>

    </div>
  );
}
