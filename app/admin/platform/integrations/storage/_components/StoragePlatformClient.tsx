"use client";

/**
 * StoragePlatformClient
 *
 * Client component for Admin → Platform → Integrations → Storage.
 *
 * Displays three provider cards:
 *   1. Sanity Assets (auto-configured from Sanity integration)
 *   2. Supabase Storage (built-in, configurable bucket name)
 *   3. Cloudflare R2 (optional, requires external setup)
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   The R2 secret access key is never returned from the server.
 *   Saving with an empty secretAccessKey field preserves the stored value.
 *   Saving with a non-empty value replaces the stored value.
 *   The UI shows a "Key saved ✓" badge + "Replace" button when a key is stored.
 */

import { useState, useTransition }   from "react";
import type { SafeStorageConfig }    from "../actions";
import type {
  SaveR2CredentialsInput,
  SaveSupabaseStorageInput,
}                                    from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

type StorageProviderKey = "cloudflare_r2" | "supabase_storage" | "sanity_assets";

/** Success shape from POST /api/admin/integrations/storage/test */
interface IntegrationTestSuccess {
  ok:       true;
  provider: StorageProviderKey;
  upload:   boolean;
  read:     boolean;
  delete:   boolean;
}

/** Failure shape from POST /api/admin/integrations/storage/test */
interface IntegrationTestFailure {
  ok:       false;
  provider: StorageProviderKey;
  step:     "config" | "upload" | "read" | "delete";
  message:  string;
}

type IntegrationTestResult = IntegrationTestSuccess | IntegrationTestFailure;

// ── Props ──────────────────────────────────────────────────────────────────────

interface StoragePlatformClientProps {
  initialConfig: SafeStorageConfig;
  setActiveProviderAction: (
    provider: StorageProviderKey | null,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveR2CredentialsAction: (
    input: SaveR2CredentialsInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveSupabaseStorageAction: (
    input: SaveSupabaseStorageInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Legacy prop — kept for compat but test buttons now call the API route directly. */
  testProviderConnectionAction: (
    provider: StorageProviderKey,
  ) => Promise<{ ok: boolean; message: string }>;
}

// ── API call helper ───────────────────────────────────────────────────────────

/**
 * Calls POST /api/admin/integrations/storage/test and returns the typed result.
 * Falls back to an error shape if the network or JSON parse fails.
 */
async function runStorageIntegrationTest(
  provider: StorageProviderKey,
): Promise<IntegrationTestResult> {
  try {
    const res = await fetch("/api/admin/integrations/storage/test", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ provider }),
    });

    const json = await res.json() as IntegrationTestResult;
    return json;
  } catch (err) {
    return {
      ok:       false,
      provider,
      step:     "config",
      message:  err instanceof Error ? err.message : "Network error — could not reach test endpoint.",
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  sanity_assets:    "Sanity Assets",
  supabase_storage: "Supabase Storage",
  cloudflare_r2:    "Cloudflare R2",
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-neutral-300"}`}
      aria-hidden
    />
  );
}

function SavedBadge({ label = "Saved ✓" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
      {label}
    </span>
  );
}

/**
 * Renders the result of a full integration test (upload → read → delete).
 *
 * Success: green row with ✔ badges for each step that passed.
 * Failure: red row showing which step failed and the error message.
 */
function IntegrationTestResultDisplay({ result }: { result: IntegrationTestResult }) {
  if (result.ok) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-green-700">✔ Connection successful</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
          ✔ upload
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          result.read
            ? "bg-green-50 text-green-700 ring-green-200"
            : "bg-neutral-50 text-neutral-400 ring-neutral-200"
        }`}>
          {result.read ? "✔" : "—"} read
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
          ✔ delete
        </span>
      </div>
    );
  }

  const STEP_LABELS: Record<string, string> = {
    config: "Configuration",
    upload: "Upload",
    read:   "Read",
    delete: "Delete",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-red-600">
          ❌ {STEP_LABELS[result.step] ?? result.step} failed
        </span>
      </div>
      <p className="text-[11px] text-red-500 leading-snug max-w-sm break-words">
        {result.message}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StoragePlatformClient({
  initialConfig,
  setActiveProviderAction,
  saveR2CredentialsAction,
  saveSupabaseStorageAction,
  testProviderConnectionAction,
}: StoragePlatformClientProps) {
  const [config, setConfig]       = useState<SafeStorageConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();

  // ── Active provider selection ────────────────────────────────────────────────
  const [activeSaveMsg, setActiveSaveMsg] = useState<string | null>(null);

  function handleSetActive(provider: "cloudflare_r2" | "supabase_storage" | "sanity_assets" | null) {
    startTransition(async () => {
      setActiveSaveMsg(null);
      const result = await setActiveProviderAction(provider);
      if (result.ok) {
        setConfig((prev) => ({
          ...prev,
          activeProvider:    provider,
          effectiveProvider: provider ?? prev.effectiveProvider,
        }));
        setActiveSaveMsg("Active provider updated.");
      } else {
        setActiveSaveMsg(`Error: ${result.error}`);
      }
    });
  }

  // ── R2 form state ────────────────────────────────────────────────────────────
  const [r2AccountId,          setR2AccountId]          = useState(config.r2AccountId);
  const [r2AccessKeyId,        setR2AccessKeyId]        = useState(config.r2AccessKeyId);
  const [r2SecretAccessKey,    setR2SecretAccessKey]    = useState("");
  const [showR2SecretInput,    setShowR2SecretInput]    = useState(!config.hasR2SecretAccessKey);
  const [hasR2SecretAccessKey, setHasR2SecretAccessKey] = useState(config.hasR2SecretAccessKey);
  const [r2BucketName,         setR2BucketName]         = useState(config.r2BucketName);
  const [r2PublicUrl,          setR2PublicUrl]          = useState(config.r2PublicUrl);
  const [r2SaveStatus,         setR2SaveStatus]         = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [r2SaveMsg,            setR2SaveMsg]            = useState<string | null>(null);
  const [r2TestStatus,         setR2TestStatus]         = useState<IntegrationTestResult | null>(null);
  const [r2Testing,            setR2Testing]            = useState(false);

  function handleR2Save() {
    startTransition(async () => {
      setR2SaveStatus("saving");
      setR2SaveMsg(null);
      const result = await saveR2CredentialsAction({
        accountId:       r2AccountId       || undefined,
        accessKeyId:     r2AccessKeyId     || undefined,
        secretAccessKey: r2SecretAccessKey || undefined,
        bucketName:      r2BucketName      || undefined,
        publicUrl:       r2PublicUrl       || undefined,
      });

      if (result.ok) {
        setR2SaveStatus("saved");
        setR2SaveMsg("R2 credentials saved.");
        if (r2SecretAccessKey) {
          setHasR2SecretAccessKey(true);
          setR2SecretAccessKey("");
          setShowR2SecretInput(false);
        }
        setConfig((prev) => ({
          ...prev,
          hasR2AccountId:       Boolean(r2AccountId),
          hasR2AccessKeyId:     Boolean(r2AccessKeyId),
          hasR2SecretAccessKey: r2SecretAccessKey ? true : prev.hasR2SecretAccessKey,
          hasR2BucketName:      Boolean(r2BucketName),
          hasR2PublicUrl:       Boolean(r2PublicUrl),
          r2AccountId,
          r2AccessKeyId,
          r2BucketName,
          r2PublicUrl,
          r2Configured: Boolean(r2AccountId && r2AccessKeyId && (r2SecretAccessKey || prev.hasR2SecretAccessKey) && r2BucketName && r2PublicUrl),
        }));
      } else {
        setR2SaveStatus("error");
        setR2SaveMsg(result.error);
      }
    });
  }

  async function handleR2Test() {
    setR2Testing(true);
    setR2TestStatus(null);
    const result = await runStorageIntegrationTest("cloudflare_r2");
    setR2TestStatus(result);
    setR2Testing(false);
  }

  // ── Supabase form state ──────────────────────────────────────────────────────
  const [sbBucketName,   setSbBucketName]   = useState(config.supabaseBucketName);
  const [sbIsPublic,     setSbIsPublic]     = useState(config.supabaseIsPublic);
  const [sbSaveStatus,   setSbSaveStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sbSaveMsg,      setSbSaveMsg]      = useState<string | null>(null);
  const [sbTestStatus,   setSbTestStatus]   = useState<IntegrationTestResult | null>(null);
  const [sbTesting,      setSbTesting]      = useState(false);

  function handleSbSave() {
    startTransition(async () => {
      setSbSaveStatus("saving");
      setSbSaveMsg(null);
      const result = await saveSupabaseStorageAction({
        bucketName: sbBucketName || undefined,
        isPublic:   sbIsPublic,
      });

      if (result.ok) {
        setSbSaveStatus("saved");
        setSbSaveMsg("Supabase Storage settings saved.");
        setConfig((prev) => ({
          ...prev,
          supabaseBucketName: sbBucketName || "tenant-assets",
          supabaseIsPublic:   sbIsPublic,
        }));
      } else {
        setSbSaveStatus("error");
        setSbSaveMsg(result.error);
      }
    });
  }

  async function handleSbTest() {
    setSbTesting(true);
    setSbTestStatus(null);
    const result = await runStorageIntegrationTest("supabase_storage");
    setSbTestStatus(result);
    setSbTesting(false);
  }

  // ── Sanity test ──────────────────────────────────────────────────────────────
  const [sanityTestStatus, setSanityTestStatus] = useState<IntegrationTestResult | null>(null);
  const [sanityTesting,    setSanityTesting]    = useState(false);

  async function handleSanityTest() {
    setSanityTesting(true);
    setSanityTestStatus(null);
    const result = await runStorageIntegrationTest("sanity_assets");
    setSanityTestStatus(result);
    setSanityTesting(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const effectiveLabel = PROVIDER_LABELS[config.effectiveProvider] ?? config.effectiveProvider;

  return (
    <div className="space-y-6">

      {/* ── Active provider summary ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Active provider</p>
            <p className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <StatusDot ok={true} />
              {effectiveLabel}
              {config.activeProvider === null && (
                <span className="text-xs font-normal text-neutral-400">(auto-detected)</span>
              )}
            </p>
          </div>
          {config.activeProvider !== null && (
            <button
              onClick={() => handleSetActive(null)}
              disabled={isPending}
              className="text-xs text-neutral-400 hover:text-neutral-600 underline"
            >
              Reset to auto
            </button>
          )}
        </div>
        {activeSaveMsg && (
          <p className={`mt-2 text-xs ${activeSaveMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {activeSaveMsg}
          </p>
        )}
      </div>

      {/* ── Provider 1: Sanity Assets ──────────────────────────────────────────── */}
      <ProviderCard
        title="Sanity Assets"
        badge="v1 default"
        badgeVariant="blue"
        description="Upload images directly to Sanity's CDN via the Sanity Asset API. No extra storage cost — assets live in your Sanity dataset. Requires a Sanity write token."
        isActive={config.effectiveProvider === "sanity_assets"}
        isSelected={config.activeProvider === "sanity_assets"}
        onActivate={() => handleSetActive("sanity_assets")}
        isPending={isPending}
        configured={config.sanityConfigured && config.sanityHasWriteToken}
        configuredLabel={
          config.sanityConfigured && config.sanityHasWriteToken
            ? `Project: ${config.sanityProjectId} / ${config.sanityDataset}`
            : config.sanityConfigured
              ? "Sanity project found — write token missing"
              : "Sanity not configured"
        }
      >
        <div className="mt-3 space-y-2 text-xs text-neutral-600">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="font-medium">Project ID</span>
            <span className="font-mono text-neutral-500">{config.sanityProjectId || "—"}</span>
            <span className="font-medium">Dataset</span>
            <span className="font-mono text-neutral-500">{config.sanityDataset || "—"}</span>
            <span className="font-medium">Write token</span>
            <span>{config.sanityHasWriteToken ? <SavedBadge /> : <span className="text-amber-600">Not set</span>}</span>
          </div>
          {!config.sanityConfigured && (
            <p className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
              Configure Sanity in{" "}
              <a href="/admin/platform/integrations/cms" className="font-medium underline">
                Admin → Integrations → CMS
              </a>{" "}
              first.
            </p>
          )}
          {config.sanityConfigured && !config.sanityHasWriteToken && (
            <p className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
              Set <code className="bg-amber-100 px-1 rounded">SANITY_API_WRITE_TOKEN</code> or
              add a write token in{" "}
              <a href="/admin/platform/integrations/cms" className="font-medium underline">
                Admin → Integrations → CMS
              </a>
              .
            </p>
          )}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSanityTest}
              disabled={sanityTesting || !config.sanityConfigured}
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            >
              {sanityTesting ? "Testing…" : "Test integration"}
            </button>
            {sanityTestStatus && (
              <IntegrationTestResultDisplay result={sanityTestStatus} />
            )}
          </div>
        </div>
      </ProviderCard>

      {/* ── Provider 2: Supabase Storage ───────────────────────────────────────── */}
      <ProviderCard
        title="Supabase Storage"
        badge="v2 built-in"
        badgeVariant="teal"
        description="Uses your existing Supabase project storage. No additional credentials needed. Assets stored in a configurable bucket within your Supabase project."
        isActive={config.effectiveProvider === "supabase_storage"}
        isSelected={config.activeProvider === "supabase_storage"}
        onActivate={() => handleSetActive("supabase_storage")}
        isPending={isPending}
        configured={true}
        configuredLabel={`Bucket: ${config.supabaseBucketName}`}
      >
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
            <label className="font-medium text-neutral-700 whitespace-nowrap">Bucket name</label>
            <input
              type="text"
              value={sbBucketName}
              onChange={(e) => { setSbBucketName(e.target.value); setSbSaveStatus("idle"); }}
              placeholder="tenant-assets"
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <label className="font-medium text-neutral-700">Public bucket</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sbIsPublic}
                onChange={(e) => { setSbIsPublic(e.target.checked); setSbSaveStatus("idle"); }}
                className="rounded"
              />
              <span className="text-neutral-500">Public access (generates stable public URLs)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSbSave}
              disabled={isPending || sbSaveStatus === "saving"}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {sbSaveStatus === "saving" ? "Saving…" : "Save settings"}
            </button>
            <button
              onClick={handleSbTest}
              disabled={sbTesting}
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            >
              {sbTesting ? "Testing…" : "Test integration"}
            </button>
          </div>

          {sbSaveMsg && (
            <p className={`text-xs ${sbSaveStatus === "error" ? "text-red-600" : "text-green-600"}`}>
              {sbSaveMsg}
            </p>
          )}
          {sbTestStatus && (
            <IntegrationTestResultDisplay result={sbTestStatus} />
          )}
        </div>
      </ProviderCard>

      {/* ── Provider 3: Cloudflare R2 ──────────────────────────────────────────── */}
      <ProviderCard
        title="Cloudflare R2"
        badge="v3 zero-egress"
        badgeVariant="orange"
        description="Zero-egress storage via Cloudflare R2. Ideal for high-volume asset delivery at scale. Requires an R2 bucket and API credentials from the Cloudflare dashboard."
        isActive={config.effectiveProvider === "cloudflare_r2"}
        isSelected={config.activeProvider === "cloudflare_r2"}
        onActivate={() => handleSetActive("cloudflare_r2")}
        isPending={isPending}
        configured={config.r2Configured}
        configuredLabel={config.r2Configured ? `Bucket: ${config.r2BucketName}` : "Not configured"}
      >
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-[140px_1fr] items-center gap-x-3 gap-y-2 text-xs">
            <label className="font-medium text-neutral-700">Account ID</label>
            <input
              type="text"
              value={r2AccountId}
              onChange={(e) => { setR2AccountId(e.target.value); setR2SaveStatus("idle"); }}
              placeholder="abc123def456…"
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <label className="font-medium text-neutral-700">Access Key ID</label>
            <input
              type="text"
              value={r2AccessKeyId}
              onChange={(e) => { setR2AccessKeyId(e.target.value); setR2SaveStatus("idle"); }}
              placeholder="your-access-key-id"
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <label className="font-medium text-neutral-700">Secret Access Key</label>
            <div className="flex items-center gap-2">
              {!showR2SecretInput && hasR2SecretAccessKey ? (
                <>
                  <SavedBadge label="Key saved ✓" />
                  <button
                    type="button"
                    onClick={() => setShowR2SecretInput(true)}
                    className="text-[11px] text-brand-600 hover:underline"
                  >
                    Replace
                  </button>
                </>
              ) : (
                <input
                  type="password"
                  value={r2SecretAccessKey}
                  onChange={(e) => { setR2SecretAccessKey(e.target.value); setR2SaveStatus("idle"); }}
                  placeholder="your-secret-access-key"
                  className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
            </div>

            <label className="font-medium text-neutral-700">Bucket name</label>
            <input
              type="text"
              value={r2BucketName}
              onChange={(e) => { setR2BucketName(e.target.value); setR2SaveStatus("idle"); }}
              placeholder="mister-chameleon-assets"
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <label className="font-medium text-neutral-700">Public base URL</label>
            <input
              type="url"
              value={r2PublicUrl}
              onChange={(e) => { setR2PublicUrl(e.target.value); setR2SaveStatus("idle"); }}
              placeholder="https://pub-xxxxxxxx.r2.dev"
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleR2Save}
              disabled={isPending || r2SaveStatus === "saving"}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {r2SaveStatus === "saving" ? "Saving…" : "Save credentials"}
            </button>
            <button
              onClick={handleR2Test}
              disabled={r2Testing || !config.r2AccountId}
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            >
              {r2Testing ? "Testing…" : "Test integration"}
            </button>
          </div>

          {r2SaveMsg && (
            <p className={`text-xs ${r2SaveStatus === "error" ? "text-red-600" : "text-green-600"}`}>
              {r2SaveMsg}
            </p>
          )}
          {r2TestStatus && (
            <IntegrationTestResultDisplay result={r2TestStatus} />
          )}

          {/* R2 setup guide */}
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer font-medium text-neutral-600 hover:text-neutral-800">
              Cloudflare R2 setup guide ›
            </summary>
            <ol className="mt-2 space-y-1 pl-4 list-decimal">
              <li>Go to <strong>dash.cloudflare.com → R2 → Create bucket</strong></li>
              <li>Name the bucket (e.g. <code className="bg-neutral-100 px-1 rounded">mister-chameleon-assets</code>)</li>
              <li>Enable <strong>Public access</strong> on the bucket (Settings → Public access)</li>
              <li>Copy the <strong>public URL</strong> from the bucket overview page</li>
              <li>Go to <strong>R2 → API tokens → Create token</strong></li>
              <li>Permissions: <em>Object Read & Write</em> on your bucket</li>
              <li>Copy the <strong>Account ID</strong>, <strong>Access Key ID</strong> and <strong>Secret Access Key</strong></li>
              <li>Fill in the fields above and click <strong>Save credentials</strong></li>
              <li>Click <strong>Test connection</strong> to verify</li>
              <li>Click <strong>Set as active</strong> to start using R2</li>
            </ol>
          </details>
        </div>
      </ProviderCard>

    </div>
  );
}

// ── ProviderCard sub-component ────────────────────────────────────────────────

const BADGE_CLASSES = {
  blue:   "bg-blue-50 text-blue-700 ring-blue-200",
  teal:   "bg-teal-50 text-teal-700 ring-teal-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
} as const;

interface ProviderCardProps {
  title:           string;
  badge:           string;
  badgeVariant:    keyof typeof BADGE_CLASSES;
  description:     string;
  isActive:        boolean;
  isSelected:      boolean;
  onActivate:      () => void;
  isPending:       boolean;
  configured:      boolean;
  configuredLabel: string;
  children:        React.ReactNode;
}

function ProviderCard({
  title,
  badge,
  badgeVariant,
  description,
  isActive,
  isSelected,
  onActivate,
  isPending,
  configured,
  configuredLabel,
  children,
}: ProviderCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-lg border bg-white ${isActive ? "border-brand-300 ring-1 ring-brand-200" : "border-neutral-200"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-neutral-900">{title}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE_CLASSES[badgeVariant]}`}>
              {badge}
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">{description}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <StatusDot ok={configured} />
            <span className={configured ? "text-neutral-600" : "text-neutral-400"}>
              {configuredLabel}
            </span>
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          {!isSelected && (
            <button
              onClick={onActivate}
              disabled={isPending}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Set as active
            </button>
          )}
          {isSelected && (
            <span className="text-xs font-medium text-brand-600">✓ Active</span>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-neutral-400 hover:text-neutral-600 underline"
          >
            {open ? "Hide settings" : "Configure"}
          </button>
        </div>
      </div>

      {/* Collapsible settings */}
      {open && (
        <div className="border-t border-neutral-100 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
