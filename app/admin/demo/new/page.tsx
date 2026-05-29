/**
 * /admin/demo/new
 *
 * Prospect Demo Generator — admin entry point.
 *
 * ─── Modes ────────────────────────────────────────────────────────────────────
 *
 *   Mirror Demo (recommended)
 *     Fetches the prospect's actual homepage, resolves all assets, injects
 *     data-mc-slot annotations on the hero/proof/CTA elements, and embeds
 *     the MC snippet + a floating Scenario Control Panel.
 *     The prospect sees their own site with MC personalisation live.
 *     → Calls POST /api/demo/mirror
 *     → Shareable URL: /demo/[id]/live
 *
 *   Synthetic Demo (legacy)
 *     AI-generated bilingual page content using the prospect's brand signals
 *     (colours, fonts, industry) but entirely new copy.
 *     → Calls POST /api/demo/generate
 *     → Shareable URL: /demo/[id]
 *
 * ─── Auth ──────────────────────────────────────────────────────────────────────
 *
 *   Both API routes validate the mc_admin_token session cookie automatically.
 */

"use client";

import { useState, useRef } from "react";
import Link                 from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type DemoModeTab = "mirror" | "synthetic";

type GenerateError =
  | { kind: "session_missing" }
  | { kind: "2fa_required" }
  | { kind: "generic"; message: string };

interface GenerateResult {
  demoId:          string;
  demoUrl:         string;
  siteName:        string;
  expiresAt:       string;
  fetchSucceeded?: boolean;
  mode:            DemoModeTab;
}

type GenerateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: GenerateResult }
  | { status: "error"; error: GenerateError };

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewDemoPage() {
  const [mode,  setMode]  = useState<DemoModeTab>("mirror");
  const [state, setState] = useState<GenerateState>({ status: "idle" });
  const inputRef          = useRef<HTMLInputElement>(null);

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const url = inputRef.current?.value.trim() ?? "";
    if (!url) return;

    setState({ status: "loading" });

    try {
      const endpoint = mode === "mirror" ? "/api/demo/mirror" : "/api/demo/generate";

      const response = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url, generatedBy: "admin" }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as {
          error?: string;
          detail?: string;
          message?: string;
        };

        if (response.status === 401) {
          const detail = body.detail ?? "session_missing";
          setState({
            status: "error",
            error:  detail === "2fa_required"
              ? { kind: "2fa_required" }
              : { kind: "session_missing" },
          });
          return;
        }

        setState({
          status: "error",
          error:  { kind: "generic", message: body.error ?? `HTTP ${response.status}` },
        });
        return;
      }

      const result = await response.json() as {
        demoId: string; demoUrl: string; siteName: string;
        expiresAt: string; fetchSucceeded?: boolean;
      };
      setState({ status: "success", result: { ...result, mode } });
    } catch (err) {
      setState({
        status: "error",
        error:  { kind: "generic", message: err instanceof Error ? err.message : "Network error — please try again." },
      });
    }
  }

  function handleReset() {
    setState({ status: "idle" });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl p-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Prospect Demo Generator</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create a shareable demo showing Mister Chameleon personalisation on a prospect's site.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        <ModeTab
          active={mode === "mirror"}
          onClick={() => { setMode("mirror"); setState({ status: "idle" }); }}
          icon="🪞"
          label="Mirror Demo"
          badge="Recommended"
        />
        <ModeTab
          active={mode === "synthetic"}
          onClick={() => { setMode("synthetic"); setState({ status: "idle" }); }}
          icon="✨"
          label="Synthetic Demo"
          badge="Legacy"
        />
      </div>

      {/* Mode description */}
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        {mode === "mirror" ? (
          <div className="flex gap-3 text-sm">
            <span className="text-xl shrink-0 mt-0.5">🪞</span>
            <div>
              <p className="font-medium text-neutral-800">Mirror Demo — their site, our personalisation</p>
              <p className="mt-0.5 text-neutral-500 leading-relaxed">
                Fetches the prospect's actual homepage, resolves all assets, and injects the
                MC snippet with a floating scenario panel. The prospect sees{" "}
                <strong>their own site</strong> adapt in real time across 6 visitor archetypes.
                Instantly convincing — no synthetic copy needed.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 text-sm">
            <span className="text-xl shrink-0 mt-0.5">✨</span>
            <div>
              <p className="font-medium text-neutral-800">Synthetic Demo — AI-generated copy</p>
              <p className="mt-0.5 text-neutral-500 leading-relaxed">
                Analyses the prospect's brand signals (colours, fonts, industry) and generates
                a fully AI-written bilingual demo page with 5 personalisation scenarios.
                Best when the prospect site is behind auth or slow to load.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Auth error states */}
      {state.status === "error" && state.error.kind === "session_missing" && <SessionExpiredCard />}
      {state.status === "error" && state.error.kind === "2fa_required"    && <TwoFaRequiredCard />}

      {/* Form */}
      {(state.status === "idle" || (state.status === "error" && state.error.kind === "generic")) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="prospect-url"
              className="block text-sm font-medium text-neutral-700 mb-1.5"
            >
              Prospect website URL
            </label>
            <input
              ref={inputRef}
              id="prospect-url"
              type="url"
              required
              autoFocus
              defaultValue=""
              placeholder="https://example.com"
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-xs text-neutral-400">
              {mode === "mirror"
                ? "The homepage will be fetched and instrumented server-side. Assets load from the prospect's domain."
                : "The URL will be fetched server-side to extract brand signals and generate copy."}
            </p>
          </div>

          {state.status === "error" && state.error.kind === "generic" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">Generation failed</p>
              <p className="mt-0.5 text-xs text-red-600">{state.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-colors"
          >
            {mode === "mirror" ? "🪞 Generate mirror demo" : "✨ Generate synthetic demo"}
          </button>
        </form>
      )}

      {/* Loading */}
      {state.status === "loading" && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-medium text-neutral-700">
            {mode === "mirror" ? "Mirroring and instrumenting homepage…" : "Generating your demo…"}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {mode === "mirror"
              ? "Fetching HTML, resolving assets, injecting snippet and scenario panel."
              : "Fetching site, extracting brand signals, and writing personalised content."}
            {" "}This usually takes 5–15 seconds.
          </p>
        </div>
      )}

      {/* Success */}
      {state.status === "success" && (
        <SuccessPanel result={state.result} onReset={handleReset} />
      )}

    </div>
  );
}

// ── Mode tab ──────────────────────────────────────────────────────────────────

function ModeTab({
  active, onClick, icon, label, badge,
}: {
  active:  boolean;
  onClick: () => void;
  icon:    string;
  label:   string;
  badge?:  string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-white shadow-sm text-neutral-900 border border-neutral-200"
          : "text-neutral-500 hover:text-neutral-700"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active
            ? badge === "Recommended"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-neutral-100 text-neutral-500"
            : "bg-neutral-100 text-neutral-400"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Auth error cards ──────────────────────────────────────────────────────────

function SessionExpiredCard() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-500 text-xl" aria-hidden>⚠</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">Admin session expired</p>
          <p className="mt-1 text-sm text-amber-700">
            Your admin session is no longer valid. Please log in again to generate demos.
          </p>
          <div className="mt-4">
            <Link href="/admin/login" className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors">
              Go to admin login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TwoFaRequiredCard() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-500 text-xl" aria-hidden>🔐</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">Two-factor authentication required</p>
          <p className="mt-1 text-sm text-amber-700">
            Your account has two-factor authentication enabled. Please complete the 2FA challenge.
          </p>
          <div className="mt-4">
            <Link href="/admin/login/2fa" className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors">
              Complete 2FA →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success panel ─────────────────────────────────────────────────────────────

function SuccessPanel({
  result,
  onReset,
}: {
  result:  GenerateResult;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(result.demoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const expiresDate = new Date(result.expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const isMirror = result.mode === "mirror";

  return (
    <div className="space-y-5">

      {/* Success banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-green-500 text-xl">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">
              {isMirror ? "Mirror demo ready" : "Demo ready"} — {result.siteName}
            </p>
            <p className="mt-0.5 text-xs text-green-600">
              {isMirror
                ? result.fetchSucceeded === false
                  ? "⚠ Site fetch failed — stub page served with scenario panel active."
                  : "Homepage mirrored with 6 scenario controls + MC snippet injected."
                : "5 personalisation scenarios generated."}
              {" "}Link expires {expiresDate}.
            </p>
          </div>
        </div>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isMirror
            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : "bg-purple-50 text-purple-700 border border-purple-200"
        }`}>
          <span>{isMirror ? "🪞" : "✨"}</span>
          {isMirror ? "Mirror Demo" : "Synthetic Demo"}
        </span>
        {isMirror && (
          <span className="text-xs text-neutral-500">
            Includes floating Scenario Control Panel with 6 visitor archetypes
          </span>
        )}
      </div>

      {/* Shareable link */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
          Shareable demo link
        </label>
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={result.demoUrl}
            className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-mono text-neutral-700 select-all focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={result.demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          Open demo ↗
        </Link>
        <button
          onClick={onReset}
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Generate another
        </button>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
          Demo details
        </p>
        <dl className="space-y-1 text-xs text-neutral-600">
          <div className="flex gap-2">
            <dt className="font-medium text-neutral-500 w-24 shrink-0">Demo ID</dt>
            <dd className="font-mono">{result.demoId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-neutral-500 w-24 shrink-0">Site</dt>
            <dd>{result.siteName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-neutral-500 w-24 shrink-0">Mode</dt>
            <dd>{isMirror ? "Mirror (live site)" : "Synthetic (AI content)"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-neutral-500 w-24 shrink-0">Expires</dt>
            <dd>{expiresDate}</dd>
          </div>
        </dl>
      </div>

    </div>
  );
}
