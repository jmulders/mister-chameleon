/**
 * DomainsPlatformClient
 *
 * Client component for the /admin/platform/integrations/domains page.
 * Manages Vercel Domains API credentials for custom tenant domain management.
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in component state or passed as props.
 *   The server page passes only boolean presence flags and the non-secret
 *   teamId string.  The API token is sent once to the server action and
 *   immediately cleared from state — it is never echoed back.
 */

"use client";

import { useState, useTransition } from "react";
import { savePlatformVercelAction } from "@/app/admin/platform/settings/actions";

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
        placeholder={hasExisting ? "Enter new value to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <p className="mt-0.5 text-[11px] text-neutral-400">
        Leave blank to keep the existing value. Stored server-side only — never echoed back.
      </p>
    </div>
  );
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Root component ─────────────────────────────────────────────────────────────

export interface DomainsPlatformClientProps {
  teamId:      string;
  hasApiToken: boolean;
  updatedAt:   string | null;
}

export function DomainsPlatformClient({
  teamId:     initialTeamId,
  hasApiToken: initialHasApiToken,
  updatedAt:  initialUpdatedAt,
}: DomainsPlatformClientProps) {
  const [teamId,    setTeamId]    = useState(initialTeamId);
  const [apiToken,  setApiToken]  = useState("");
  const [hasToken,  setHasToken]  = useState(initialHasApiToken);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [saveState, setSaveState] = useState<SaveState>({ mode: "idle" });
  const [isPending, startTransition] = useTransition();

  const formatted = formatDate(updatedAt);

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
    <div className="space-y-6">

      {/* Vercel credentials card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Vercel Domains API</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasToken
                  ? "bg-green-100 text-green-700"
                  : "bg-neutral-100 text-neutral-500"
              }`}>
                {hasToken ? "✓ API token configured" : "API token not set"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              API credentials for managing custom tenant domains via the Vercel Domains API.
              Used to add, verify, and remove custom domains for tenant sites.
            </p>
          </div>
          {formatted && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatted}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <TextField
            label="Team ID"
            value={teamId}
            onChange={setTeamId}
            placeholder="e.g. team_abc123"
            hint="Your Vercel team ID (from the Vercel dashboard → Settings → General). Leave blank for personal accounts."
          />
          <SecretField
            label="API token"
            value={apiToken}
            onChange={setApiToken}
            hasExisting={hasToken}
            placeholder="Vercel API token..."
          />
        </div>

        {/* Save footer */}
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

      {/* What the domains integration does */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-700">What the Vercel Domains API is used for</h3>
        <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
          When a tenant is provisioned with a custom domain, the platform uses the Vercel API
          to register the domain against the deployment. Domain verification and SSL
          certificate provisioning happen automatically through Vercel once the domain
          DNS is pointed at the platform.
        </p>
        <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
          <li>Add a domain to a Vercel project on tenant onboarding</li>
          <li>Check domain verification status</li>
          <li>Remove domains when a tenant is deprovisioned</li>
        </ul>
      </div>

    </div>
  );
}
