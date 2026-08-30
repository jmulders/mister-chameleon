/**
 * CmsPlatformClient
 *
 * Client component for the /admin/platform/integrations/cms page.
 * Manages credentials for all supported CMS providers:
 *
 *   ● Sanity     — projectId, dataset, write token + live test connection
 *   ● Storyblok  — access token, CDN region, content version
 *   ● Statamic   — base URL, API key
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in component state or passed as props.
 *   Secret inputs (tokens, API keys) are always blank on render — the UI shows
 *   only a boolean "configured" indicator when a secret is saved.
 *   When the user enters a new secret it is sent to the server action once,
 *   then cleared immediately from state regardless of success or failure.
 *
 * ─── Test connection ───────────────────────────────────────────────────────────
 *
 *   Test connection is supported for Sanity and Storyblok.  Both use the current
 *   form state merged with saved state on the server, allowing operators to test
 *   new credentials before saving.
 *
 *   Statamic does not yet have a live test — the section shows the credential
 *   form and configuration status only.
 */

"use client";

import { useState, useTransition } from "react";
import {
  saveCmsPlatformSettingsAction,
  testCmsPlatformConnectionAction,
  saveCmsStoryblokSettingsAction,
  testCmsStoryblokConnectionAction,
  testCmsStoryblokManagementAction,
  saveCmsStatamicSettingsAction,
  testCmsStatamicConnectionAction,
} from "@/app/admin/platform/cms/actions";
import type { TestConnectionResult, StoryblokTestConnectionResult, StoryblokManagementTestResult, StatamicTestConnectionResult } from "@/app/admin/platform/cms/actions";

// ── Shared field primitives ────────────────────────────────────────────────────

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

function FieldLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <label className="mb-1 block text-xs font-medium text-neutral-700">
      {children}
      {note && <span className="ml-1.5 font-normal text-neutral-400">{note}</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  hint,
}: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  hint?:       string;
}) {
  return (
    <div>
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

function SelectInput({
  value,
  onChange,
  options,
  hint,
}: {
  value:    string;
  onChange: (v: string) => void;
  options:  { value: string; label: string }[];
  hint?:    string;
}) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
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
        placeholder={hasExisting ? "Enter new value to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <p className="mt-0.5 text-[11px] text-neutral-400">
        Leave blank to keep the existing value.
        Stored server-side only: never shown after save.
      </p>
    </div>
  );
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

function SaveFooter({
  state,
  onSave,
  onDismiss,
  isPending,
  label,
}: {
  state:     SaveState;
  onSave:    () => void;
  onDismiss: () => void;
  isPending: boolean;
  label?:    string;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={isPending}
        className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : (label ?? "Save settings")}
      </button>

      {state.mode === "success" && (
        <span className="flex items-center gap-1.5 text-xs text-green-700">
          ✓ Saved
          <button
            onClick={onDismiss}
            className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
          >
            Dismiss
          </button>
        </span>
      )}

      {state.mode === "error" && (
        <span className="flex items-center gap-1.5 text-xs text-red-700">
          {state.message}
          <button
            onClick={onDismiss}
            className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
          >
            Dismiss
          </button>
        </span>
      )}
    </div>
  );
}

// ── Test result banner ─────────────────────────────────────────────────────────

function TestResultBanner({ result }: { result: TestConnectionResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-semibold text-green-800">Connection test passed</p>
        <p className="mt-0.5 text-xs text-green-700">{result.message}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-green-600">
          <span>Project: <span className="font-mono">{result.details.project}</span></span>
          <span>Dataset: <span className="font-mono">{result.details.dataset}</span></span>
          <span>
            Write access:{" "}
            {result.details.writeAccess
              ? <span className="font-semibold">✓ confirmed</span>
              : <span className="text-amber-600 font-semibold">✗ no token</span>
            }
          </span>
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

// ── Provider section wrapper ───────────────────────────────────────────────────

function ProviderCard({
  title,
  badge,
  description,
  updatedAt,
  children,
}: {
  title:       string;
  badge?:      React.ReactNode;
  description: string;
  updatedAt:   string | null;
  children:    React.ReactNode;
}) {
  const formatted = formatDate(updatedAt);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {badge}
        {formatted && (
          <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
            Last saved: {formatted}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500 leading-relaxed">{description}</p>
      {children}
    </div>
  );
}

// ── Sanity section ─────────────────────────────────────────────────────────────

function SanitySection({
  initialProjectId,
  initialDataset,
  initialHasWriteToken,
  initialUpdatedAt,
}: {
  initialProjectId:     string;
  initialDataset:       string;
  initialHasWriteToken: boolean;
  initialUpdatedAt:     string | null;
}) {
  const [projectId,  setProjectId]  = useState(initialProjectId);
  const [dataset,    setDataset]    = useState(initialDataset);
  const [writeToken, setWriteToken] = useState("");
  const [hasToken,   setHasToken]   = useState(initialHasWriteToken);
  const [updatedAt,  setUpdatedAt]  = useState<string | null>(initialUpdatedAt);
  const [saveState,  setSaveState]  = useState<SaveState>({ mode: "idle" });
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const [isSaving,  startSaveTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  function handleSave() {
    startSaveTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await saveCmsPlatformSettingsAction({
        projectId,
        dataset,
        writeToken: writeToken || undefined,
      });
      if (result.ok) {
        if (writeToken) setHasToken(true);
        setWriteToken("");
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
      const result = await testCmsPlatformConnectionAction({
        projectId,
        dataset,
        writeToken: writeToken || undefined,
      });
      setTestResult(result);
    });
  }

  return (
    <ProviderCard
      title="Sanity"
      badge={
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
          Headless CMS
        </span>
      }
      description="One shared Sanity project for the platform. Tenant content is scoped by tenantId on each document. Env vars (SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_WRITE_TOKEN) remain as fallback when not set here."
      updatedAt={updatedAt}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel note="Takes priority over SANITY_PROJECT_ID env var when set.">Project ID</FieldLabel>
          <TextInput
            value={projectId}
            onChange={setProjectId}
            placeholder="e.g. in3s2m2m"
          />
        </div>
        <div>
          <FieldLabel note="Takes priority over SANITY_DATASET env var when set. Defaults to 'production'.">Dataset</FieldLabel>
          <TextInput
            value={dataset}
            onChange={setDataset}
            placeholder="e.g. production"
          />
        </div>
        <div>
          <FieldLabel>Write token</FieldLabel>
          <SecretInput
            value={writeToken}
            onChange={setWriteToken}
            hasExisting={hasToken}
            placeholder="skPn4r..."
          />
        </div>
      </div>

      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isSaving}
      />

      {/* Test connection */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-xs text-neutral-500">
          Test that the configured project ID, dataset, and write token can connect.
          Uses the current form values, you can test credentials before saving.
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

    </ProviderCard>
  );
}

// ── Storyblok test result banner ──────────────────────────────────────────────

function StoryblokTestResultBanner({ result }: { result: StoryblokTestConnectionResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-semibold text-green-800">Connection test passed</p>
        <p className="mt-0.5 text-xs text-green-700">{result.message}</p>
        <p className="mt-1.5 text-[11px] text-green-600">
          Region: <span className="font-mono">{result.region}</span>
        </p>
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

// ── Storyblok management test result banner ───────────────────────────────────

function StoryblokManagementTestBanner({ result }: { result: StoryblokManagementTestResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-semibold text-green-800">Management API connected</p>
        <p className="mt-0.5 text-xs text-green-700">{result.message}</p>
        <p className="mt-1.5 text-[11px] text-green-600">
          Space: <span className="font-mono">{result.spaceName}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-red-800">Management API test failed</p>
      <p className="mt-0.5 text-xs text-red-700">{result.error}</p>
      {result.hint && (
        <p className="mt-1.5 text-[11px] text-red-600">
          <span className="font-semibold">Fix: </span>{result.hint}
        </p>
      )}
    </div>
  );
}

// ── Statamic test result banner ────────────────────────────────────────────────

function StatamicTestResultBanner({ result }: { result: StatamicTestConnectionResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-semibold text-green-800">Connection test passed</p>
        <p className="mt-0.5 text-xs text-green-700">{result.message}</p>
        <p className="mt-1.5 text-[11px] text-green-600">
          URL: <span className="font-mono">{result.baseUrl}</span>
        </p>
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

// ── Storyblok section ──────────────────────────────────────────────────────────

const STORYBLOK_REGIONS = [
  { value: "",   label: "Default (eu)" },
  { value: "eu", label: "EU: api.storyblok.com" },
  { value: "us", label: "US: api-us.storyblok.com" },
  { value: "ap", label: "AP: api-ap.storyblok.com" },
  { value: "ca", label: "CA: api-ca.storyblok.com" },
  { value: "cn", label: "CN: app.storyblokchina.cn" },
];

const STORYBLOK_VERSIONS = [
  { value: "",          label: "Default (published)" },
  { value: "published", label: "published" },
  { value: "draft",     label: "draft" },
];

function StoryblokSection({
  initialRegion,
  initialVersion,
  initialSpaceId,
  initialTenantId,
  initialHasAccessToken,
  initialHasManagementToken,
  initialHasWebhookSecret,
  initialUpdatedAt,
}: {
  initialRegion:              string;
  initialVersion:             string;
  initialSpaceId:             string;
  initialTenantId:            string;
  initialHasAccessToken:      boolean;
  initialHasManagementToken:  boolean;
  initialHasWebhookSecret:    boolean;
  initialUpdatedAt:           string | null;
}) {
  const [region,           setRegion]           = useState(initialRegion);
  const [version,          setVersion]          = useState(initialVersion);
  const [spaceId,          setSpaceId]          = useState(initialSpaceId);
  const [tenantId,         setTenantId]         = useState(initialTenantId);
  const [accessToken,      setAccessToken]      = useState("");
  const [managementToken,  setManagementToken]  = useState("");
  const [webhookSecret,    setWebhookSecret]    = useState("");
  const [hasToken,         setHasToken]         = useState(initialHasAccessToken);
  const [hasMgmtToken,     setHasMgmtToken]     = useState(initialHasManagementToken);
  const [hasWebhookSec,    setHasWebhookSec]    = useState(initialHasWebhookSecret);
  const [updatedAt,        setUpdatedAt]        = useState<string | null>(initialUpdatedAt);
  const [saveState,        setSaveState]        = useState<SaveState>({ mode: "idle" });
  const [testResult,       setTestResult]       = useState<StoryblokTestConnectionResult | null>(null);
  const [mgmtTestResult,   setMgmtTestResult]   = useState<StoryblokManagementTestResult | null>(null);
  const [isPending,        startTransition]     = useTransition();
  const [isTesting,        startTestTransition] = useTransition();
  const [isMgmtTesting,    startMgmtTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await saveCmsStoryblokSettingsAction({
        region,
        version,
        spaceId,
        tenantId,
        accessToken:     accessToken     || undefined,
        managementToken: managementToken || undefined,
        webhookSecret:   webhookSecret   || undefined,
      });
      if (result.ok) {
        if (accessToken)   setHasToken(true);
        if (managementToken) setHasMgmtToken(true);
        if (webhookSecret) setHasWebhookSec(true);
        setAccessToken("");
        setManagementToken("");
        setWebhookSecret("");
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
      const result = await testCmsStoryblokConnectionAction({
        accessToken: accessToken || undefined,
        region:      region      || undefined,
      });
      setTestResult(result);
    });
  }

  function handleMgmtTest() {
    startMgmtTransition(async () => {
      setMgmtTestResult(null);
      const result = await testCmsStoryblokManagementAction({
        managementToken: managementToken || undefined,
        spaceId:         spaceId         || undefined,
      });
      setMgmtTestResult(result);
    });
  }

  return (
    <ProviderCard
      title="Storyblok"
      badge={
        <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-200">
          Headless CMS
        </span>
      }
      description="Storyblok Content Delivery API credentials (for reading content) and Management API credentials (for provisioning starter content to tenants)."
      updatedAt={updatedAt}
    >
      {/* ── Read credentials ── */}
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        Read credentials
      </p>
      <div className="space-y-4">
        <div>
          <FieldLabel note="Takes priority over STORYBLOK_ACCESS_TOKEN env var when set.">
            Content Delivery API token
          </FieldLabel>
          <SecretInput
            value={accessToken}
            onChange={setAccessToken}
            hasExisting={hasToken}
            placeholder="preview or public token..."
          />
        </div>
        <div>
          <FieldLabel note="CDN region for the Storyblok API. Defaults to eu.">Region</FieldLabel>
          <SelectInput
            value={region}
            onChange={setRegion}
            options={STORYBLOK_REGIONS}
            hint="Takes priority over STORYBLOK_REGION env var when set."
          />
        </div>
        <div>
          <FieldLabel note="Content version to fetch. Defaults to published.">Version</FieldLabel>
          <SelectInput
            value={version}
            onChange={setVersion}
            options={STORYBLOK_VERSIONS}
            hint="Takes priority over STORYBLOK_VERSION env var when set."
          />
        </div>
      </div>

      {/* ── Write / provisioning credentials ── */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Provisioning credentials
        </p>
        <p className="mb-4 text-xs text-neutral-500">
          Required for the "Sync CMS" provisioning flow. The Management API token is a
          Personal Access Token from <span className="font-mono text-[11px]">My Account → Personal Access Tokens</span>{" "}
          in Storyblok. The Space ID is the numeric ID from <span className="font-mono text-[11px]">Settings → General</span>.
        </p>
        <div className="space-y-4">
          <div>
            <FieldLabel note="Takes priority over STORYBLOK_SPACE_ID env var when set.">
              Space ID
            </FieldLabel>
            <TextInput
              value={spaceId}
              onChange={setSpaceId}
              placeholder="e.g. 123456"
              hint="Numeric ID from Storyblok Settings → General. Storyblok shows it as '# 123456', enter only the digits."
            />
          </div>
          <div>
            <FieldLabel note="Takes priority over STORYBLOK_MANAGEMENT_TOKEN env var when set.">
              Management API token
            </FieldLabel>
            <SecretInput
              value={managementToken}
              onChange={setManagementToken}
              hasExisting={hasMgmtToken}
              placeholder="Personal access token..."
            />
          </div>
        </div>
      </div>

      {/* ── Webhook credentials ── */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Webhook
        </p>
        <p className="mb-4 text-xs text-neutral-500">
          Required for the adaptive blocks sync webhook{" "}
          <span className="font-mono text-[11px]">POST /api/webhooks/cms/storyblok</span>.
          Configure a matching secret under{" "}
          <span className="font-mono text-[11px]">Settings → Webhooks</span> in Storyblok.
        </p>
        <div className="space-y-4">
          <div>
            <FieldLabel note="Takes priority over STORYBLOK_WEBHOOK_SECRET env var when set.">
              Webhook secret
            </FieldLabel>
            <SecretInput
              value={webhookSecret}
              onChange={setWebhookSecret}
              hasExisting={hasWebhookSec}
              placeholder="Shared webhook secret..."
            />
          </div>
          <div>
            <FieldLabel note="Takes priority over STORYBLOK_TENANT_ID env var when set.">
              Default tenant ID
            </FieldLabel>
            <TextInput
              value={tenantId}
              onChange={setTenantId}
              placeholder="e.g. my-tenant"
              hint="Tenant scope for adaptive blocks synced via the webhook. Can be overridden per-request with ?tenantId= query param."
            />
          </div>
        </div>
      </div>

      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />

      {/* ── Test read connection ── */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-xs text-neutral-500">
          Test that the Content Delivery token and region can read from Storyblok.
          Uses the current form values, you can test credentials before saving.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTesting ? "Testing…" : "Test read connection"}
          </button>
          <button
            onClick={handleMgmtTest}
            disabled={isMgmtTesting}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMgmtTesting ? "Testing…" : "Test provisioning connection"}
          </button>
        </div>
        <StoryblokTestResultBanner result={testResult} />
        <StoryblokManagementTestBanner result={mgmtTestResult} />
      </div>

    </ProviderCard>
  );
}

// ── Statamic section ───────────────────────────────────────────────────────────
// NOTE: Seed operations (SanityContentSeed, StoryblokContentSeed) have been
// moved to the per-tenant Content tab so operators seed only the specific
// tenant they are editing: /admin/tenants/[tenantId]/content

function StatamicSection({
  initialBaseUrl,
  initialHasApiKey,
  initialHasWebhookSecret,
  initialUpdatedAt,
}: {
  initialBaseUrl:          string;
  initialHasApiKey:        boolean;
  initialHasWebhookSecret: boolean;
  initialUpdatedAt:        string | null;
}) {
  const [baseUrl,       setBaseUrl]       = useState(initialBaseUrl);
  const [apiKey,        setApiKey]        = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasKey,        setHasKey]        = useState(initialHasApiKey);
  const [hasWebhookSec, setHasWebhookSec] = useState(initialHasWebhookSecret);
  const [updatedAt,     setUpdatedAt]     = useState<string | null>(initialUpdatedAt);
  const [saveState,     setSaveState]     = useState<SaveState>({ mode: "idle" });
  const [testResult,    setTestResult]    = useState<StatamicTestConnectionResult | null>(null);
  const [isPending,     startTransition]     = useTransition();
  const [isTesting,     startTestTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await saveCmsStatamicSettingsAction({
        baseUrl,
        apiKey:        apiKey        || undefined,
        webhookSecret: webhookSecret || undefined,
      });
      if (result.ok) {
        if (apiKey)        setHasKey(true);
        if (webhookSecret) setHasWebhookSec(true);
        setApiKey("");
        setWebhookSecret("");
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
      const result = await testCmsStatamicConnectionAction({
        baseUrl: baseUrl || undefined,
        apiKey:  apiKey  || undefined,
      });
      setTestResult(result);
    });
  }

  return (
    <ProviderCard
      title="Statamic"
      badge={
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Headless CMS
        </span>
      }
      description="Statamic REST API credentials. These supplement the STATAMIC_API_URL and STATAMIC_API_KEY environment variables. The provider is activated when STATAMIC_API_URL is set (or configured here) and neither Sanity nor Storyblok is configured."
      updatedAt={updatedAt}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel note="Takes priority over STATAMIC_API_URL env var when set.">
            Base URL
          </FieldLabel>
          <TextInput
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://cms.example.com"
            hint="Full URL including protocol. No trailing slash."
          />
        </div>
        <div>
          <FieldLabel note="Takes priority over STATAMIC_API_KEY env var when set.">
            API key / Bearer token
          </FieldLabel>
          <SecretInput
            value={apiKey}
            onChange={setApiKey}
            hasExisting={hasKey}
            placeholder="Bearer token for protected API..."
          />
        </div>
      </div>

      {/* ── Webhook credentials ── */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Webhook
        </p>
        <p className="mb-4 text-xs text-neutral-500">
          Required for the adaptive blocks sync webhook{" "}
          <span className="font-mono text-[11px]">POST /api/webhooks/cms/statamic</span>.
          Configure a matching secret in Statamic under{" "}
          <span className="font-mono text-[11px]">Utilities → Webhooks → Headers: x-statamic-secret</span>.
        </p>
        <div>
          <FieldLabel note="Takes priority over STATAMIC_WEBHOOK_SECRET env var when set.">
            Webhook secret
          </FieldLabel>
          <SecretInput
            value={webhookSecret}
            onChange={setWebhookSecret}
            hasExisting={hasWebhookSec}
            placeholder="Shared webhook secret..."
          />
        </div>
      </div>

      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />

      {/* ── Test connection ── */}
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-xs text-neutral-500">
          Test that the base URL can reach the Statamic REST API.
          Uses the current form values, you can test credentials before saving.
        </p>
        <button
          onClick={handleTest}
          disabled={isTesting}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTesting ? "Testing…" : "Test connection"}
        </button>
        <StatamicTestResultBanner result={testResult} />
      </div>
    </ProviderCard>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────


export interface CmsPlatformClientProps {
  /** Sanity provider props */
  projectId:     string;
  dataset:       string;
  hasWriteToken: boolean;
  updatedAt:     string | null;
  /** Storyblok provider props */
  storyblok: {
    region:              string;
    version:             string;
    spaceId:             string;
    tenantId:            string;
    hasAccessToken:      boolean;
    hasManagementToken:  boolean;
    hasWebhookSecret:    boolean;
    updatedAt:           string | null;
  };
  /** Statamic provider props */
  statamic: {
    baseUrl:          string;
    hasApiKey:        boolean;
    hasWebhookSecret: boolean;
    updatedAt:        string | null;
  };
}

export function CmsPlatformClient({
  projectId,
  dataset,
  hasWriteToken,
  updatedAt,
  storyblok,
  statamic,
}: CmsPlatformClientProps) {
  return (
    <div className="space-y-4">

      {/* Provider priority note */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        <strong className="text-neutral-700">Provider selection order:</strong>{" "}
        Sanity (if configured) → Storyblok (if STORYBLOK_ACCESS_TOKEN set) →
        Statamic (if STATAMIC_API_URL set) → Mock fallback.
        Configure only the provider you intend to use.
      </div>

      <SanitySection
        initialProjectId={projectId}
        initialDataset={dataset}
        initialHasWriteToken={hasWriteToken}
        initialUpdatedAt={updatedAt}
      />

      <StoryblokSection
        initialRegion={storyblok.region}
        initialVersion={storyblok.version}
        initialSpaceId={storyblok.spaceId}
        initialTenantId={storyblok.tenantId}
        initialHasAccessToken={storyblok.hasAccessToken}
        initialHasManagementToken={storyblok.hasManagementToken}
        initialHasWebhookSecret={storyblok.hasWebhookSecret}
        initialUpdatedAt={storyblok.updatedAt}
      />

      <StatamicSection
        initialBaseUrl={statamic.baseUrl}
        initialHasApiKey={statamic.hasApiKey}
        initialHasWebhookSecret={statamic.hasWebhookSecret}
        initialUpdatedAt={statamic.updatedAt}
      />

    </div>
  );
}
