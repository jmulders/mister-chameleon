/**
 * CmsCredentialsPanel
 *
 * Admin panel for CMS credential status on the tenant Setup page.
 *
 * ─── Per-provider behaviour ───────────────────────────────────────────────────
 *
 *   sanity    — Write token for the provisioner.  Stored per-tenant in
 *               `tenant.cms.writeToken`.  Falls back to the platform-level
 *               write token (DB platform_settings or SANITY_API_WRITE_TOKEN
 *               / SANITY_WRITE_TOKEN env vars).  The `platformWriteTokenConfigured`
 *               prop suppresses the amber warning when the fallback covers it.
 *
 *   storyblok — Access token and region are configured at the platform level
 *               (Platform → CMS settings) or via STORYBLOK_ACCESS_TOKEN env var.
 *               There is no per-tenant Storyblok credential — show an info note
 *               that links to the platform CMS settings page.
 *
 *   statamic  — API URL and token are configured via environment variables
 *               (STATAMIC_API_URL, STATAMIC_API_TOKEN) or Platform → CMS
 *               settings.  No per-tenant credential stored here.
 *
 *   platform  — The built-in platform CMS requires no external credentials.
 *
 *   mock      — No credentials required.  Dev / local-only provider.
 *
 * ─── Security model (Sanity) ─────────────────────────────────────────────────
 *
 *   The write token is stored server-side only via saveCmsCredentialsAction.
 *   After save the full token value is NEVER returned to the client — only a
 *   boolean `hasCmsWriteToken` flag is reflected back.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveCmsCredentialsAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { CMSProviderName } from "@/tenant/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CmsCredentialsPanelProps {
  tenantId:         string;
  hasCmsWriteToken: boolean;
  cmsProvider:      CMSProviderName;
  /**
   * Sanity only.  True when a platform-level Sanity write token is available
   * (DB platform_settings or SANITY_API_WRITE_TOKEN / SANITY_WRITE_TOKEN env var).
   * When true and no per-tenant token is set, the amber warning is suppressed
   * because provisioning will succeed via the platform fallback.
   */
  platformWriteTokenConfigured?: boolean;
}

type PanelState =
  | { mode: "idle" }
  | { mode: "editing" }
  | { mode: "saving" }
  | { mode: "success"; hasToken: boolean }
  | { mode: "error";   message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<CMSProviderName, string> = {
  platform:  "Platform",
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock",
};

// ── Per-provider informational panels ─────────────────────────────────────────

/** Shown for providers where credentials are managed outside this panel. */
function InfoPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CmsCredentialsPanel({
  tenantId,
  hasCmsWriteToken: initialHasToken,
  cmsProvider,
  platformWriteTokenConfigured = false,
}: CmsCredentialsPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>({ mode: "idle" });
  const [tokenInput,  setTokenInput]  = useState("");
  const [hasToken,    setHasToken]    = useState(initialHasToken);
  const [isPending, startTransition]  = useTransition();

  const providerLabel = PROVIDER_LABEL[cmsProvider] ?? cmsProvider;

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          CMS Credentials
        </span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
          {providerLabel}
        </span>

        {/* Sanity-specific status badges */}
        {cmsProvider === "sanity" && hasToken && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
            ✓ Write token configured
          </span>
        )}
        {cmsProvider === "sanity" && !hasToken && platformWriteTokenConfigured && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
            Via platform setting
          </span>
        )}
        {cmsProvider === "sanity" && !hasToken && !platformWriteTokenConfigured && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            No write token
          </span>
        )}
      </div>

      {/* ── Mock ──────────────────────────────────────────────────────────── */}
      {cmsProvider === "mock" && (
        <InfoPanel>
          Mock provider — no credentials required. Switch to a real CMS provider
          before going live.
        </InfoPanel>
      )}

      {/* ── Platform ──────────────────────────────────────────────────────── */}
      {cmsProvider === "platform" && (
        <InfoPanel>
          The built-in platform CMS stores content in the platform database.
          No external credentials are required.
        </InfoPanel>
      )}

      {/* ── Storyblok ─────────────────────────────────────────────────────── */}
      {cmsProvider === "storyblok" && (
        <InfoPanel>
          Storyblok credentials (access token and region) are configured at the{" "}
          <strong className="font-medium">platform level</strong>, not per-tenant.
          Set them in{" "}
          <Link
            href="/admin/platform/cms"
            className="font-medium text-indigo-600 hover:underline"
          >
            Platform → CMS settings
          </Link>
          {" "}or via the{" "}
          <code className="rounded bg-neutral-100 px-1 font-mono">STORYBLOK_ACCESS_TOKEN</code>
          {" "}environment variable. All tenants using Storyblok share the platform token.
        </InfoPanel>
      )}

      {/* ── Statamic ──────────────────────────────────────────────────────── */}
      {cmsProvider === "statamic" && (
        <InfoPanel>
          This tenant&apos;s Statamic instance is determined by its{" "}
          <strong>CMS base URL</strong>{" "}
          (<code className="rounded bg-neutral-100 px-1 font-mono">statamicBaseUrl</code>) —
          the tenant&apos;s own Ploi host — set by the <strong>Provision / Finalize</strong>{" "}
          step on this Setup page. That is the per-tenant connection.
          <span className="mt-2 block text-neutral-500">
            No API token is needed: instances run with{" "}
            <code className="rounded bg-neutral-100 px-1 font-mono">STATAMIC_API_ENABLED=true</code>
            {" "}(public read-only API). The global{" "}
            <code className="rounded bg-neutral-100 px-1 font-mono">STATAMIC_API_URL</code>/
            <code className="rounded bg-neutral-100 px-1 font-mono">STATAMIC_API_TOKEN</code>
            {" "}env vars and{" "}
            <Link
              href="/admin/platform/cms"
              className="font-medium text-indigo-600 hover:underline"
            >
              Platform → CMS settings
            </Link>
            {" "}are only a fallback used when a tenant has no own base URL.
          </span>
        </InfoPanel>
      )}

      {/* ── Sanity — full write token management ──────────────────────────── */}
      {cmsProvider === "sanity" && (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            A per-tenant Sanity write token lets the provisioner seed or update
            content in this tenant&rsquo;s Sanity project. Leave blank to use the
            platform-level token from{" "}
            <Link href="/admin/platform/cms" className="text-indigo-600 hover:underline">
              Platform → CMS settings
            </Link>
            {" "}or the{" "}
            <code className="rounded bg-neutral-100 px-1 font-mono text-xs">SANITY_API_WRITE_TOKEN</code>
            {" "}env var.
          </p>

          {/* Token configured — masked + update/clear */}
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
                  Update
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

          {/* No per-tenant token — platform covers it */}
          {!hasToken && panelState.mode === "idle" && platformWriteTokenConfigured && (
            <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              No per-tenant token set — provisioning will use the{" "}
              <strong className="font-medium">platform-level write token</strong>.
              Add a token here only to override it for this specific tenant.
            </div>
          )}

          {/* No per-tenant token — nothing covers it */}
          {!hasToken && panelState.mode === "idle" && !platformWriteTokenConfigured && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No write token configured. Set one here or configure{" "}
              <code className="font-mono font-semibold">SANITY_API_WRITE_TOKEN</code>
              {" "}at the platform level — otherwise provisioning will fail.
            </div>
          )}

          {/* Edit form */}
          {panelState.mode === "editing" && (
            <div className="mb-3 space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                Sanity write token
                <span className="ml-1.5 font-normal text-neutral-400">(not shown after save)</span>
              </label>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <p className="text-[11px] text-neutral-400">
                Stored server-side only — the value is never echoed back after saving.
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

          {/* Add / override button */}
          {!hasToken && panelState.mode === "idle" && (
            <button
              onClick={handleEdit}
              className={[
                "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                platformWriteTokenConfigured
                  ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  : "bg-brand-600 text-white hover:bg-brand-700",
              ].join(" ")}
            >
              {platformWriteTokenConfigured ? "Override with per-tenant token" : "Add write token"}
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
                ? "✓ Write token saved."
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
