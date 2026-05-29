/**
 * PlatformSettingsClient
 *
 * Client-side UI for the /admin/platform/settings page.
 *
 * ─── Security model ────────────────────────────────────────────────────────────
 *
 *   This component never receives or stores actual secret values.  The server
 *   page passes only:
 *     – Non-secret config (projectId, dataset, teamId, accountId) as plain strings.
 *     – Boolean presence flags (hasWriteToken, hasLicenseKey, etc.) for secrets.
 *     – The ISO-8601 updatedAt timestamp for each section (no secrets here).
 *
 *   When an operator enters a new secret in the input field, it is sent once via
 *   server action and immediately discarded from state.  The stored value is never
 *   reflected back — the UI reverts to showing the boolean "configured" indicator.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   Each section is a self-contained card that manages its own save state.
 *
 *     SanitySection  — projectId, dataset, write token
 *     MaxMindSection — accountId, license key
 *     AiSection      — Anthropic key, OpenAI key
 *     VercelSection  — team ID, API token
 */

"use client";

import { useState, useTransition } from "react";
import {
  savePlatformSanityAction,
  savePlatformMaxMindAction,
  savePlatformAiAction,
  savePlatformVercelAction,
} from "@/app/admin/platform/settings/actions";

// ── Timestamp formatter ────────────────────────────────────────────────────────

function formatUpdatedAt(iso: string | null | undefined): string | null {
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

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  badge,
  updatedAt,
  children,
}: {
  title:       string;
  description: string;
  badge?:      React.ReactNode;
  updatedAt?:  string | null;
  children:    React.ReactNode;
}) {
  const formatted = formatUpdatedAt(updatedAt);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
        {badge}
        {formatted && (
          <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
            Last saved: {formatted}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500">{description}</p>
      {children}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
      ✓ {label}
    </span>
  ) : (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
      {label} not set
    </span>
  );
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
          <span className="ml-auto text-[11px] text-neutral-400">configured</span>
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
        Leave blank to keep the existing value. Enter a new value to replace it.
        Value is stored server-side only — never echoed back.
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
}: {
  state:     SaveState;
  onSave:    () => void;
  onDismiss: () => void;
  isPending: boolean;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={isPending}
        className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>

      {state.mode === "success" && (
        <span className="flex items-center gap-1 text-xs text-green-700">
          ✓ Saved
          <button
            onClick={onDismiss}
            className="ml-1 text-[11px] text-neutral-400 underline hover:text-neutral-600"
          >
            Dismiss
          </button>
        </span>
      )}

      {state.mode === "error" && (
        <span className="flex items-center gap-1 text-xs text-red-700">
          {state.message}
          <button
            onClick={onDismiss}
            className="ml-1 text-[11px] text-neutral-400 underline hover:text-neutral-600"
          >
            Dismiss
          </button>
        </span>
      )}
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
  const [projectId,    setProjectId]    = useState(initialProjectId);
  const [dataset,      setDataset]      = useState(initialDataset);
  const [writeToken,   setWriteToken]   = useState("");
  const [hasToken,     setHasToken]     = useState(initialHasWriteToken);
  const [updatedAt,    setUpdatedAt]    = useState<string | null>(initialUpdatedAt);
  const [saveState,    setSaveState]    = useState<SaveState>({ mode: "idle" });
  const [isPending,    startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await savePlatformSanityAction({
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

  return (
    <SectionCard
      title="Sanity CMS"
      description="Platform-wide Sanity project configuration and write token. These are used by CMS provisioning unless a tenant has a per-tenant token configured. Env vars (SANITY_PROJECT_ID, SANITY_API_WRITE_TOKEN) remain as fallback when not set here."
      updatedAt={updatedAt}
      badge={<StatusBadge ok={hasToken} label="Write token" />}
    >
      <div className="space-y-3">
        <TextField
          label="Project ID"
          value={projectId}
          onChange={setProjectId}
          placeholder="e.g. in3s2m2m"
          hint="Takes priority over SANITY_PROJECT_ID env var when set."
        />
        <TextField
          label="Dataset"
          value={dataset}
          onChange={setDataset}
          placeholder="e.g. production"
          hint="Takes priority over SANITY_DATASET env var when set."
        />
        <SecretField
          label="Write token"
          value={writeToken}
          onChange={setWriteToken}
          hasExisting={hasToken}
          placeholder="skPn4r..."
        />
      </div>
      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />
    </SectionCard>
  );
}

// ── MaxMind section ────────────────────────────────────────────────────────────

function MaxMindSection({
  initialAccountId,
  initialHasLicenseKey,
  initialUpdatedAt,
}: {
  initialAccountId:    string;
  initialHasLicenseKey: boolean;
  initialUpdatedAt:    string | null;
}) {
  const [accountId,  setAccountId]  = useState(initialAccountId);
  const [licenseKey, setLicenseKey] = useState("");
  const [hasKey,     setHasKey]     = useState(initialHasLicenseKey);
  const [updatedAt,  setUpdatedAt]  = useState<string | null>(initialUpdatedAt);
  const [saveState,  setSaveState]  = useState<SaveState>({ mode: "idle" });
  const [isPending,  startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await savePlatformMaxMindAction({
        accountId,
        licenseKey: licenseKey || undefined,
      });

      if (result.ok) {
        if (licenseKey) setHasKey(true);
        setLicenseKey("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <SectionCard
      title="MaxMind GeoIP"
      description="IP geolocation enrichment credentials. Used to resolve visitor company, city, and ISP from IP addresses."
      updatedAt={updatedAt}
      badge={<StatusBadge ok={hasKey} label="License key" />}
    >
      <div className="space-y-3">
        <TextField
          label="Account ID"
          value={accountId}
          onChange={setAccountId}
          placeholder="e.g. 123456"
        />
        <SecretField
          label="License key"
          value={licenseKey}
          onChange={setLicenseKey}
          hasExisting={hasKey}
          placeholder="abcdef123456..."
        />
      </div>
      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />
    </SectionCard>
  );
}

// ── AI section ─────────────────────────────────────────────────────────────────

function AiSection({
  initialHasAnthropicKey,
  initialHasOpenaiKey,
  initialUpdatedAt,
}: {
  initialHasAnthropicKey: boolean;
  initialHasOpenaiKey:    boolean;
  initialUpdatedAt:       string | null;
}) {
  const [anthropicKey,    setAnthropicKey]    = useState("");
  const [openaiKey,       setOpenaiKey]       = useState("");
  const [hasAnthropicKey, setHasAnthropicKey] = useState(initialHasAnthropicKey);
  const [hasOpenaiKey,    setHasOpenaiKey]    = useState(initialHasOpenaiKey);
  const [updatedAt,       setUpdatedAt]       = useState<string | null>(initialUpdatedAt);
  const [saveState,       setSaveState]       = useState<SaveState>({ mode: "idle" });
  const [isPending,       startTransition]    = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await savePlatformAiAction({
        anthropicKey: anthropicKey || undefined,
        openaiKey:    openaiKey    || undefined,
      });

      if (result.ok) {
        if (anthropicKey) setHasAnthropicKey(true);
        if (openaiKey)    setHasOpenaiKey(true);
        setAnthropicKey("");
        setOpenaiKey("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <SectionCard
      title="AI Providers"
      description="Platform-level fallback API keys for AI providers. Tenant-level keys take precedence when configured."
      updatedAt={updatedAt}
      badge={
        <>
          <StatusBadge ok={hasAnthropicKey} label="Anthropic" />
          <StatusBadge ok={hasOpenaiKey}    label="OpenAI"    />
        </>
      }
    >
      <div className="space-y-3">
        <SecretField
          label="Anthropic API key"
          value={anthropicKey}
          onChange={setAnthropicKey}
          hasExisting={hasAnthropicKey}
          placeholder="sk-ant-..."
        />
        <SecretField
          label="OpenAI API key"
          value={openaiKey}
          onChange={setOpenaiKey}
          hasExisting={hasOpenaiKey}
          placeholder="sk-..."
        />
      </div>
      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />
    </SectionCard>
  );
}

// ── Vercel section ─────────────────────────────────────────────────────────────

function VercelSection({
  initialTeamId,
  initialHasApiToken,
  initialUpdatedAt,
}: {
  initialTeamId:     string;
  initialHasApiToken: boolean;
  initialUpdatedAt:  string | null;
}) {
  const [teamId,    setTeamId]    = useState(initialTeamId);
  const [apiToken,  setApiToken]  = useState("");
  const [hasToken,  setHasToken]  = useState(initialHasApiToken);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [saveState, setSaveState] = useState<SaveState>({ mode: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await savePlatformVercelAction({
        teamId,
        apiToken: apiToken || undefined,
      });

      if (result.ok) {
        if (apiToken) setHasToken(true);
        setApiToken("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <SectionCard
      title="Vercel Domains API"
      description="API credentials for managing custom tenant domains via the Vercel Domains API."
      updatedAt={updatedAt}
      badge={<StatusBadge ok={hasToken} label="API token" />}
    >
      <div className="space-y-3">
        <TextField
          label="Team ID"
          value={teamId}
          onChange={setTeamId}
          placeholder="e.g. team_abc123"
          hint="Your Vercel team ID (from the Vercel dashboard). Leave blank for personal accounts."
        />
        <SecretField
          label="API token"
          value={apiToken}
          onChange={setApiToken}
          hasExisting={hasToken}
          placeholder="Bearer token..."
        />
      </div>
      <SaveFooter
        state={saveState}
        onSave={handleSave}
        onDismiss={() => setSaveState({ mode: "idle" })}
        isPending={isPending}
      />
    </SectionCard>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export interface PlatformSettingsClientProps {
  sanity: {
    projectId:      string;
    dataset:        string;
    hasWriteToken:  boolean;
    updatedAt:      string | null;
  };
  maxmind: {
    accountId:     string;
    hasLicenseKey: boolean;
    updatedAt:     string | null;
  };
  ai: {
    hasAnthropicKey: boolean;
    hasOpenaiKey:    boolean;
    updatedAt:       string | null;
  };
  vercel: {
    teamId:      string;
    hasApiToken: boolean;
    updatedAt:   string | null;
  };
}

export function PlatformSettingsClient({
  sanity,
  maxmind,
  ai,
  vercel,
}: PlatformSettingsClientProps) {
  return (
    <div className="space-y-4">
      <SanitySection
        initialProjectId={sanity.projectId}
        initialDataset={sanity.dataset}
        initialHasWriteToken={sanity.hasWriteToken}
        initialUpdatedAt={sanity.updatedAt}
      />
      <MaxMindSection
        initialAccountId={maxmind.accountId}
        initialHasLicenseKey={maxmind.hasLicenseKey}
        initialUpdatedAt={maxmind.updatedAt}
      />
      <AiSection
        initialHasAnthropicKey={ai.hasAnthropicKey}
        initialHasOpenaiKey={ai.hasOpenaiKey}
        initialUpdatedAt={ai.updatedAt}
      />
      <VercelSection
        initialTeamId={vercel.teamId}
        initialHasApiToken={vercel.hasApiToken}
        initialUpdatedAt={vercel.updatedAt}
      />
    </div>
  );
}
