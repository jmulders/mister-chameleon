/**
 * AiPlatformClient
 *
 * Client component for the /admin/platform/integrations/ai page.
 * Manages platform-level fallback API keys for Anthropic and OpenAI.
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in component state or passed as props.
 *   The server page passes only boolean presence flags.
 *   API keys are sent once to the server action and immediately cleared.
 *   They are never echoed back.
 */

"use client";

import { useState, useTransition } from "react";
import { savePlatformAiAction } from "@/app/admin/platform/settings/actions";

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

function SecretField({
  label,
  value,
  onChange,
  hasExisting,
  placeholder,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  hasExisting: boolean;
  placeholder: string;
  hint?:       string;
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
        placeholder={hasExisting ? "Enter new value to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
      {!hint && (
        <p className="mt-0.5 text-[11px] text-neutral-400">
          Leave blank to keep the existing value. Stored server-side only, never echoed back.
        </p>
      )}
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

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Root component ─────────────────────────────────────────────────────────────

export interface AiPlatformClientProps {
  hasAnthropicKey: boolean;
  hasOpenaiKey:    boolean;
  hasDemoSiteKey:  boolean;
  updatedAt:       string | null;
}

export function AiPlatformClient({
  hasAnthropicKey: initialHasAnthropicKey,
  hasOpenaiKey:    initialHasOpenaiKey,
  hasDemoSiteKey:  initialHasDemoSiteKey,
  updatedAt:       initialUpdatedAt,
}: AiPlatformClientProps) {
  const [anthropicKey,    setAnthropicKey]    = useState("");
  const [openaiKey,       setOpenaiKey]       = useState("");
  const [demoSiteKey,     setDemoSiteKey]     = useState("");
  const [hasAnthropicKey, setHasAnthropicKey] = useState(initialHasAnthropicKey);
  const [hasOpenaiKey,    setHasOpenaiKey]    = useState(initialHasOpenaiKey);
  const [hasDemoSiteKey,  setHasDemoSiteKey]  = useState(initialHasDemoSiteKey);
  const [updatedAt,       setUpdatedAt]       = useState<string | null>(initialUpdatedAt);
  const [saveState,       setSaveState]       = useState<SaveState>({ mode: "idle" });
  const [isPending,       startTransition]    = useTransition();

  const formatted = formatDate(updatedAt);

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result = await savePlatformAiAction({
        anthropicKey: anthropicKey || undefined,
        openaiKey:    openaiKey    || undefined,
        demoSiteKey:  demoSiteKey  || undefined,
      });
      if (result.ok) {
        if (anthropicKey) setHasAnthropicKey(true);
        if (openaiKey)    setHasOpenaiKey(true);
        if (demoSiteKey)  setHasDemoSiteKey(true);
        setAnthropicKey("");
        setOpenaiKey("");
        setDemoSiteKey("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* ── AI provider keys card ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h2 className="text-sm font-semibold text-neutral-900">AI provider keys</h2>
              <StatusBadge ok={hasAnthropicKey} label="Anthropic" />
              <StatusBadge ok={hasOpenaiKey}    label="OpenAI"    />
            </div>
            <p className="text-xs text-neutral-500">
              Platform-level fallback API keys. Tenant-level keys take precedence
              when configured in the tenant workspace.
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
            label="Anthropic API key"
            value={anthropicKey}
            onChange={setAnthropicKey}
            hasExisting={hasAnthropicKey}
            placeholder="sk-ant-..."
            hint="Get yours at console.anthropic.com → API Keys. Takes priority over ANTHROPIC_API_KEY env var."
          />
          <SecretField
            label="OpenAI API key"
            value={openaiKey}
            onChange={setOpenaiKey}
            hasExisting={hasOpenaiKey}
            placeholder="sk-..."
            hint="Takes priority over OPENAI_API_KEY env var when set."
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save settings"}
          </button>
          {saveState.mode === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-700">
              ✓ Settings saved
              <button onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600">Dismiss</button>
            </span>
          )}
          {saveState.mode === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-700">
              {saveState.message}
              <button onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600">Dismiss</button>
            </span>
          )}
        </div>
      </div>

      {/* ── Demo site key card ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-sm font-semibold text-neutral-900">Mirror Demo site key</h2>
            <StatusBadge ok={hasDemoSiteKey} label="Configured" />
          </div>
          <p className="text-xs text-neutral-500">
            The snippet site key the Mirror Demo generator injects into prospect pages
            (<code className="font-mono text-[11px]">MC_DEMO_SITE_KEY</code>).
            Find it in Admin → Snippet &amp; Integration for your demo tenant.
          </p>
        </div>

        <div className="space-y-4">
          <SecretField
            label="Demo site key"
            value={demoSiteKey}
            onChange={setDemoSiteKey}
            hasExisting={hasDemoSiteKey}
            placeholder="sk_live_..."
            hint="Takes priority over MC_DEMO_SITE_KEY env var when set."
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save settings"}
          </button>
          {saveState.mode === "success" && (
            <span className="text-xs text-green-700">✓ Settings saved</span>
          )}
          {saveState.mode === "error" && (
            <span className="text-xs text-red-700">{saveState.message}</span>
          )}
        </div>
      </div>

      {/* ── Info card ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-700">How AI provider keys are used</h3>
        <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
          The AI decision engine uses these keys as platform-level fallbacks when a tenant
          has not configured their own API key. Key resolution order:
          tenant key → platform key (here) → environment variable.
        </p>
      </div>
    </div>
  );
}
