/**
 * /admin/demo/new
 *
 * Prospect Demo Generator — admin entry point.
 *
 * ─── Mirror demo ──────────────────────────────────────────────────────────────
 *
 *   Fetches the prospect's actual homepage, resolves all assets, injects
 *   data-mc-slot annotations on the hero/proof/CTA elements, and embeds the MC
 *   snippet + a floating Scenario Control Panel. The prospect sees their own site
 *   with MC personalisation live.
 *     → Calls POST /api/demo/mirror
 *     → Shareable URL: /demo/[id]/live
 *
 *   (The former "Synthetic" (Legacy) mode — AI-generated bilingual copy via
 *   /api/demo/generate — was removed; Mirror is the only mode.)
 *
 * ─── Auth ──────────────────────────────────────────────────────────────────────
 *
 *   Both API routes validate the mc_admin_token session cookie automatically.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import Link                             from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

type GenerateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: GenerateResult }
  | { status: "error"; error: GenerateError };

// ── Progress steps ─────────────────────────────────────────────────────────────

const MIRROR_STEPS = [
  { delay: 0,     text: "Fetching and mirroring the homepage…" },
  { delay: 4_000, text: "Resolving assets and cleaning HTML…" },
  { delay: 9_000, text: "Analysing key page elements with AI…" },
  { delay: 16_000, text: "Generating 6 personalisation variants per element…" },
  { delay: 24_000, text: "Storing demo and preparing your shareable link…" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewDemoPage() {
  const [state,      setState]      = useState<GenerateState>({ status: "idle" });
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up step timers when loading ends
  useEffect(() => {
    if (state.status !== "loading") {
      stepTimers.current.forEach(clearTimeout);
      stepTimers.current = [];
    }
  }, [state.status]);

  // ── URL normalisation ─────────────────────────────────────────────────────

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const rawUrl = inputRef.current?.value.trim() ?? "";
    if (!rawUrl) return;

    const url = normalizeUrl(rawUrl);

    // Sync back the normalised URL into the input
    if (inputRef.current) inputRef.current.value = url;

    setState({ status: "loading" });

    // ── Start progress step cycle ───────────────────────────────────────────
    const steps = MIRROR_STEPS;
    setLoadingStep(steps[0].text);
    stepTimers.current = steps.slice(1).map(({ delay, text }) =>
      setTimeout(() => setLoadingStep(text), delay),
    );

    try {
      const response = await fetch("/api/demo/mirror", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url, generatedBy: "admin", expiryDays }),
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
      setState({ status: "success", result });
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Prospect Demo Generator</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create a shareable demo showing Mister Chameleon personalisation on a prospect's site.
          </p>
        </div>
        <Link
          href="/admin/demo"
          className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          View all demos →
        </Link>
      </div>

      {/* What a Mirror demo is */}
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <div className="flex gap-3 text-sm">
          <span className="text-xl shrink-0 mt-0.5">🪞</span>
          <div>
            <p className="font-medium text-neutral-800">Mirror Demo — their site, our personalisation</p>
            <p className="mt-0.5 text-neutral-500 leading-relaxed">
              Fetches the prospect's actual homepage, uses AI to detect 8–12 personalizable
              elements and generate 6 unique variants per element, then injects the MC snippet
              with a floating Scenario Control Panel. The prospect sees{" "}
              <strong>their own site</strong> adapt in real time across 6 visitor archetypes.
            </p>
          </div>
        </div>
      </div>

      {/* Auth error states */}
      {state.status === "error" && state.error.kind === "session_missing" && <SessionExpiredCard />}
      {state.status === "error" && state.error.kind === "2fa_required"    && <TwoFaRequiredCard />}

      {/* Form */}
      {(state.status === "idle" || (state.status === "error" && state.error.kind === "generic")) && (
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* URL input */}
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
              type="text"
              required
              autoFocus
              defaultValue=""
              placeholder="https://example.com"
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-xs text-neutral-400">
              The homepage will be fetched and instrumented server-side. Assets load from the prospect's domain. https:// is added automatically.
            </p>
          </div>

          {/* Expiry dropdown */}
          <div>
            <label
              htmlFor="expiry-days"
              className="block text-sm font-medium text-neutral-700 mb-1.5"
            >
              Demo link expiry
            </label>
            <select
              id="expiry-days"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days (default)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
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
            🪞 Generate mirror demo
          </button>
        </form>
      )}

      {/* Loading */}
      {state.status === "loading" && (
        <LoadingPanel currentStep={loadingStep} />
      )}

      {/* Success */}
      {state.status === "success" && (
        <SuccessPanel result={state.result} onReset={handleReset} />
      )}

    </div>
  );
}

// ── Loading panel ─────────────────────────────────────────────────────────────

function LoadingPanel({ currentStep }: { currentStep: string }) {
  const steps = MIRROR_STEPS;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm space-y-6">
      {/* Spinner */}
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
        <p className="text-sm font-medium text-neutral-700 text-center min-h-[20px]">
          {currentStep}
        </p>
      </div>

      {/* Step list */}
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const isActive  = step.text === currentStep;
          const isDone    = steps.findIndex((s) => s.text === currentStep) > i;
          return (
            <li key={i} className={`flex items-center gap-2.5 text-xs ${
              isActive  ? "text-indigo-700 font-medium" :
              isDone    ? "text-neutral-400 line-through" :
                          "text-neutral-400"
            }`}>
              <span className={`shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isActive  ? "bg-indigo-100 text-indigo-700" :
                isDone    ? "bg-neutral-100 text-neutral-400" :
                            "bg-neutral-100 text-neutral-300"
              }`}>
                {isDone ? "✓" : i + 1}
              </span>
              {step.text}
            </li>
          );
        })}
      </ol>

      <p className="text-center text-xs text-neutral-400">
        AI slot analysis usually adds 10–20 seconds. Hang tight!
      </p>
    </div>
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

  const fetchFailed = result.fetchSucceeded === false;

  return (
    <div className="space-y-5">

      {/* Success banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-green-500 text-xl">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">
              Mirror demo ready — {result.siteName}
            </p>
            <p className="mt-0.5 text-xs text-green-600">
              Homepage mirrored with AI-powered slot injection and 6 scenario controls.
              {" "}Link expires {expiresDate}.
            </p>
          </div>
        </div>
      </div>

      {/* Fetch failed warning — shown prominently when the site couldn't be fetched */}
      {fetchFailed && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-amber-500 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-900">Site could not be fetched</p>
              <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                The prospect's homepage returned an error or timed out. A stub page was
                generated instead — the Scenario Control Panel is still functional, but
                the demo will not show the prospect's actual design. This can happen when
                the site is behind auth or has strict bot protection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span>🪞</span>
          Mirror Demo
        </span>
        <span className="text-xs text-neutral-500">
          AI-detected slots · 6 personalisation scenarios
        </span>
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
        <Link
          href="/admin/demo"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          View all demos
        </Link>
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
            <dd>Mirror (live site + AI slots)</dd>
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
