/**
 * CmsCredentialsPanel
 *
 * Admin panel for configuring the CMS write token used by the provisioner.
 *
 * ─── Security model ────────────────────────────────────────────────────────────
 *
 *   The write token is stored server-side only via saveCmsCredentialsAction.
 *   After save the full token value is NEVER returned to the client — only a
 *   boolean `hasCmsWriteToken` flag is reflected back.  The UI shows:
 *
 *     • No token configured — warning strip + input prompt
 *     • Token configured    — masked indicator (sk-••••••) + update option
 *
 * ─── When to use ──────────────────────────────────────────────────────────────
 *
 *   When SANITY_API_WRITE_TOKEN / SANITY_WRITE_TOKEN environment variables are
 *   not set, the provisioner falls back to this per-tenant token.  Useful when:
 *     – Each tenant has their own Sanity project with its own write token.
 *     – The platform operator cannot update environment variables at runtime.
 *
 *   If a platform-level env var is already set the per-tenant token is still
 *   accepted and takes precedence (useful for testing or override purposes).
 */

"use client";

import { useState, useTransition } from "react";
import { saveCmsCredentialsAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { CMSProviderName } from "@/tenant/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CmsCredentialsPanelProps {
  tenantId:         string;
  hasCmsWriteToken: boolean;
  cmsProvider:      CMSProviderName;
}

type PanelState =
  | { mode: "idle" }
  | { mode: "editing" }
  | { mode: "saving" }
  | { mode: "success"; hasToken: boolean }
  | { mode: "error";   message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<CMSProviderName, string> = {
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CmsCredentialsPanel({
  tenantId,
  hasCmsWriteToken: initialHasToken,
  cmsProvider,
}: CmsCredentialsPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>({ mode: "idle" });
  const [tokenInput,  setTokenInput]  = useState("");
  const [hasToken,    setHasToken]    = useState(initialHasToken);
  const [isPending, startTransition]  = useTransition();

  const providerLabel = PROVIDER_LABEL[cmsProvider] ?? cmsProvider;

  // Only show the write-token section when the provider is Sanity (other
  // providers use different credential patterns).  For mock providers, show
  // a simple informational note instead.
  const isMock = cmsProvider === "mock";

  function handleEdit() {
    setTokenInput("");
    setPanelState({ mode: "editing" });
  }

  function handleCancel() {
    setTokenInput("");
    setPanelState({ mode: "idle" });
  }

  function handleSave() {
    startTransition(async () => {
      setPanelState({ mode: "saving" });
      const result = await saveCmsCredentialsAction(tenantId, tokenInput);
      if (result.ok) {
        setHasToken(result.data.hasCmsWriteToken);
        setTokenInput("");
        setPanelState({ mode: "success", hasToken: result.data.hasCmsWriteToken });
      } else {
        setPanelState({ mode: "error", message: result.error });
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      setPanelState({ mode: "saving" });
      const result = await saveCmsCredentialsAction(tenantId, "");
      if (result.ok) {
        setHasToken(false);
        setPanelState({ mode: "success", hasToken: false });
      } else {
        setPanelState({ mode: "error", message: result.error });
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">

      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          CMS Credentials
        </span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
          {providerLabel}
        </span>
        {hasToken && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
            ✓ Write token configured
          </span>
        )}
        {!hasToken && !isMock && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            No write token
          </span>
        )}
      </div>

      <p className="mb-4 text-xs text-neutral-500">
        {isMock
          ? "Mock provider — no credentials required."
          : `Configure a ${providerLabel} write token for the CMS provisioner. ` +
            "If a platform-level environment variable is already set, " +
            "the per-tenant token takes precedence (useful for per-project overrides)."}
      </p>

      {isMock ? null : (
        <>
          {/* Token status */}
          {hasToken && panelState.mode === "idle" && (
            <div className="mb-3 flex items-center gap-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
              <span className="font-mono text-xs text-neutral-500 tracking-widest">
                sk-••••••••••••••••••••••••••••••
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={handleEdit}
                  className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Update token
                </button>
                <span className="text-neutral-300">|</span>
                <button
                  onClick={handleClear}
                  disabled={isPending}
                  className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {!hasToken && panelState.mode === "idle" && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No write token configured for this tenant. The provisioner will
              fall back to <code className="font-mono font-semibold">SANITY_API_WRITE_TOKEN</code>{" "}
              / <code className="font-mono font-semibold">SANITY_WRITE_TOKEN</code> environment
              variables. If neither is set, provisioning will fail.
            </div>
          )}

          {/* Edit form */}
          {panelState.mode === "editing" && (
            <div className="mb-3 space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                {providerLabel} write token
                <span className="ml-1.5 font-normal text-neutral-400">(not shown after save)</span>
              </label>
              <input
                type="password"
                autoComplete="off"
                placeholder={`sk-...`}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <p className="text-[11px] text-neutral-400">
                Token is stored server-side only. Only a &ldquo;configured&rdquo; indicator
                is shown after save — the value is never echoed back.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isPending || !tokenInput.trim()}
                  className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save token
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add token button when none configured */}
          {!hasToken && panelState.mode === "idle" && (
            <button
              onClick={handleEdit}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Add write token
            </button>
          )}

          {/* Saving */}
          {panelState.mode === "saving" && (
            <p className="text-xs text-neutral-400">Saving…</p>
          )}

          {/* Success */}
          {panelState.mode === "success" && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              {panelState.hasToken
                ? "✓ Write token saved. Provisioning can now run for this tenant."
                : "✓ Write token cleared."}
              {" "}
              <button
                onClick={() => setPanelState({ mode: "idle" })}
                className="ml-1 underline hover:text-green-600"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error */}
          {panelState.mode === "error" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <span className="font-semibold">Error: </span>
              {panelState.message}
              {" "}
              <button
                onClick={() => setPanelState({ mode: "idle" })}
                className="ml-1 underline hover:text-red-600"
              >
                Dismiss
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
