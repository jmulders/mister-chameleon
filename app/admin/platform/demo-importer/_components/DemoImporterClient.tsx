/**
 * Demo Importer — Client Component
 *
 * Renders all interactive sections of /admin/platform/demo-importer:
 *
 *   1. StatusOverview    — overall readiness + per-provider status cards
 *   2. ProviderCards     — configuration details + test-connection per provider
 *   3. BehaviorSettings  — crawl / signal-detection toggles (saved to DB)
 *   4. OutputDefaults    — default site type, scenario pack, theme, expiry
 *   5. RecentRunsTable   — last 20 demo_instances with lifecycle badges
 *   6. TestPanel         — live URL test with analyze-only / full-generation modes
 *
 * ─── Secrets policy ───────────────────────────────────────────────────────────
 *
 *   No secrets cross into this component.  API key presence is expressed as
 *   boolean flags (hasAnthropicKey) supplied by the server component.
 *   Server actions re-verify the admin session before executing any write.
 */

"use client";

import { useState, useTransition } from "react";
import Link                         from "next/link";
import {
  saveDemoImporterSettingsAction,
  saveScreenshotOneKeyAction,
  testAnalyzerConnectionAction,
  runDemoTestAction,
  deleteDemoInstanceAction,
} from "../actions";
import type {
  DemoImporterStatus,
  DemoImporterSettings,
  ProviderInfo,
  ProviderStatus,
  RecentRunSummary,
} from "../actions";
import { toDemoImporterSavePayload } from "../settings-payload";

// ── Props ──────────────────────────────────────────────────────────────────────

interface DemoImporterClientProps {
  status:              DemoImporterStatus;
  settings:            DemoImporterSettings | null;
  settingsUpdatedAt:   string | null;
  settingsError:       string | null;
  /** Whether a ScreenshotOne API key is stored (presence flag only — never the value). */
  hasScreenshotOneKey: boolean;
}

// ── Root component ────────────────────────────────────────────────────────────

export function DemoImporterClient({
  status,
  settings,
  settingsUpdatedAt,
  settingsError,
  hasScreenshotOneKey,
}: DemoImporterClientProps) {
  return (
    <div className="space-y-8">
      <StatusOverview status={status} />
      <ProviderCards providers={status.providers} />

      {settingsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load settings</p>
          <p className="mt-0.5 text-xs text-red-600">{settingsError}</p>
        </div>
      )}

      {settings && (
        <SettingsSections initial={settings} updatedAt={settingsUpdatedAt} />
      )}

      <ScreenshotOneKeyCard configured={hasScreenshotOneKey} />

      <RecentRunsTable runs={status.recentRuns} />
      <TestPanel />
    </div>
  );
}

// ── ScreenshotOne API key (write-only secret) ─────────────────────────────────

function ScreenshotOneKeyCard({ configured }: { configured: boolean }) {
  const [value, setValue]   = useState("");
  const [saved, setSaved]   = useState(configured);
  const [state, setState]   = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(clear: boolean) {
    setState("saving");
    setError(null);
    startTransition(async () => {
      const res = await saveScreenshotOneKeyAction(clear ? "" : value.trim());
      if (res.ok) {
        setState("done");
        setSaved(!clear);
        setValue("");
        setTimeout(() => setState("idle"), 3000);
      } else {
        setState("error");
        setError(res.error);
      }
    });
  }

  return (
    <section aria-labelledby="ss1-heading">
      <h2 id="ss1-heading" className="text-base font-semibold text-neutral-900 mb-3">Screenshot API key</h2>
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-5 py-4 space-y-3">
        <p className="text-xs text-neutral-500">
          ScreenshotOne API key for <span className="font-medium text-neutral-700">Screenshot demo mode</span>.
          Stored server-side (never shown back); the <code>SCREENSHOTONE_API_KEY</code> env var remains a fallback.
        </p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            saved ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {saved ? "Key configured ✓" : "No key set"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setState("idle"); }}
            placeholder={saved ? "Enter a new key to replace" : "Paste ScreenshotOne key"}
            autoComplete="off"
            className="min-w-[16rem] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
          <button
            onClick={() => save(false)}
            disabled={isPending || state === "saving" || !value.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {state === "saving" ? "Saving…" : state === "done" ? "Saved ✓" : "Save key"}
          </button>
          {saved && (
            <button
              onClick={() => save(true)}
              disabled={isPending || state === "saving"}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {state === "error" && error && (
          <p className="text-xs text-red-600">Save failed: {error}</p>
        )}
      </div>
    </section>
  );
}

// ── 1. Status Overview ────────────────────────────────────────────────────────

function StatusOverview({ status }: { status: DemoImporterStatus }) {
  const overallLabel = status.overall === "ready"
    ? "Ready"
    : status.overall === "partial"
    ? "Partially configured"
    : "Not configured";

  const overallColor = status.overall === "ready"
    ? "text-green-700 bg-green-50 border-green-200"
    : status.overall === "partial"
    ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

  const lastRun = status.lastRunAt
    ? new Date(status.lastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : ": ";

  return (
    <section aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-base font-semibold text-neutral-900 mb-3">
        Status overview
      </h2>
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">

        {/* Overall readiness */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-neutral-700">Overall readiness</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              All providers must be ready for full generation. Templates work without AI.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${overallColor}`}>
            {overallLabel}
          </span>
        </div>

        {/* Provider summary row */}
        <div className="grid grid-cols-3 divide-x divide-neutral-100">
          {status.providers.map((p) => (
            <div key={p.id} className="px-5 py-3">
              <p className="text-xs text-neutral-500 mb-1">{p.label}</p>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>

        {/* Last run stats */}
        <div className="grid grid-cols-2 divide-x divide-neutral-100">
          <div className="px-5 py-3">
            <p className="text-xs text-neutral-400">Last successful run</p>
            <p className="text-sm font-medium text-neutral-800 mt-0.5">{lastRun}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-neutral-400">Total demos (last 20 shown)</p>
            <p className="text-sm font-medium text-neutral-800 mt-0.5">
              {status.recentRuns.length === 20 ? "20+" : status.recentRuns.length}
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}

// ── 2. Provider Cards ─────────────────────────────────────────────────────────

function ProviderCards({ providers }: { providers: ProviderInfo[] }) {
  return (
    <section aria-labelledby="providers-heading">
      <h2 id="providers-heading" className="text-base font-semibold text-neutral-900 mb-3">
        Provider configuration
      </h2>
      <div className="space-y-3">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>
    </section>
  );
}

function ProviderCard({ provider: p }: { provider: ProviderInfo }) {
  const [testState, setTestState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "success"; note: string }
    | { phase: "error";   error: string }
  >({ phase: "idle" });

  const [url, setUrl]              = useState("");
  const [isPending, startTransition] = useTransition();

  function handleTestAnalyzer() {
    if (!url.trim()) {
      setTestState({ phase: "error", error: "Enter a URL to test the analyzer." });
      return;
    }
    setTestState({ phase: "loading" });
    startTransition(async () => {
      const result = await testAnalyzerConnectionAction(url.trim());
      if (result.ok) {
        setTestState({
          phase: "success",
          note: `Fetched in ${result.durationMs}ms, "${result.title}", category: ${result.category}, fetch succeeded: ${result.fetchSucceeded}`,
        });
      } else {
        setTestState({
          phase: "error",
          error: `Step: ${result.step}, ${result.error}`,
        });
      }
    });
  }

  const borderColor = p.status === "ready"
    ? "border-green-200"
    : p.status === "partial"
    ? "border-amber-200"
    : "border-neutral-200";

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${borderColor}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-neutral-900">{p.label}</p>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">{p.description}</p>
            <p className="mt-2 text-xs text-neutral-600 font-medium">{p.statusNote}</p>
          </div>
        </div>

        {/* Setup link for non-ready providers */}
        {p.status !== "ready" && p.configPath && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <span className="font-semibold">Action required:</span>{" "}
            Configure this provider at{" "}
            <Link href={p.configPath} className="font-medium underline hover:text-amber-900">
              {p.configPath}
            </Link>
            .
          </div>
        )}

        {/* Not-configured providers with no config path */}
        {p.status === "not_configured" && !p.configPath && (
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
            This provider is not yet available. No action required.
          </div>
        )}

        {/* Analyzer test connection */}
        {p.id === "analyzer" && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Test connection
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
              <button
                onClick={handleTestAnalyzer}
                disabled={isPending || testState.phase === "loading"}
                className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                {testState.phase === "loading" ? "Testing…" : "Test"}
              </button>
            </div>
            {testState.phase === "success" && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✓ {testState.note}
              </p>
            )}
            {testState.phase === "error" && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                ✗ {testState.error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3. Settings sections (shared state) ───────────────────────────────────────

/**
 * Both settings sections share ONE settings state. Each section keeps its own
 * Save button, but every Save persists the FULL payload (via saveAll), so a
 * toggle in one section is never dropped by a Save in the other — the render
 * toggle persistence bug.
 */
function SettingsSections({
  initial,
  updatedAt,
}: {
  initial:   DemoImporterSettings;
  updatedAt: string | null;
}) {
  const [settings, setSettings] = useState(initial);
  const patch = (p: Partial<DemoImporterSettings>) => setSettings((s) => ({ ...s, ...p }));
  const saveAll = () => saveDemoImporterSettingsAction(toDemoImporterSavePayload(settings));

  return (
    <>
      <BehaviorSettings settings={settings} patch={patch} updatedAt={updatedAt} saveAll={saveAll} />
      <OutputDefaults   settings={settings} patch={patch} updatedAt={updatedAt} saveAll={saveAll} />
    </>
  );
}

interface SectionProps {
  settings:  DemoImporterSettings;
  patch:     (p: Partial<DemoImporterSettings>) => void;
  updatedAt: string | null;
  /** Persist the FULL shared settings (all fields), returning the action result. */
  saveAll:   () => Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Shared save-button state machine used by both sections. */
function useSectionSave(saveAll: SectionProps["saveAll"]) {
  const [saveState, setSaveState]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const result = await saveAll();
      if (result.ok) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setSaveState("error");
        setSaveError(result.error);
      }
    });
  }

  return { saveState, setSaveState, saveError, isPending, handleSave };
}

function BehaviorSettings({ settings, patch, updatedAt, saveAll }: SectionProps) {
  const { saveState, setSaveState, saveError, isPending, handleSave } = useSectionSave(saveAll);

  return (
    <section aria-labelledby="behavior-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="behavior-heading" className="text-base font-semibold text-neutral-900">
            Mirror rendering
          </h2>
          {updatedAt && (
            <p className="text-xs text-neutral-400 mt-0.5">
              Last saved{" "}
              {new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending || saveState === "saving"}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
        </button>
      </div>

      {saveState === "error" && saveError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          Save failed: {saveError}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">

        {/* ── Mirror JS-rendering (self-hosted headless Chrome) ─────────────── */}
        <ToggleRow
          label="JavaScript rendering"
          note="Render the prospect page with a self-hosted headless Chrome so client-rendered sites mirror faithfully. Falls back to a plain fetch on error/timeout."
          checked={settings.renderEnabled}
          onChange={() => { patch({ renderEnabled: !settings.renderEnabled }); setSaveState("idle"); }}
        />

        {settings.renderEnabled && (
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="min-w-0 pr-4">
              <p className="text-sm font-medium text-neutral-800">Render timeout (ms)</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Max time to wait for the render (5000-45000, kept under the function budget). JS rendering needs longer than a plain fetch.
              </p>
            </div>
            <input
              type="number"
              min={5_000}
              max={45_000}
              step={1_000}
              value={settings.renderTimeoutMs}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) patch({ renderTimeoutMs: v });
                setSaveState("idle");
              }}
              className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-right text-neutral-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}

        {settings.renderEnabled && (
          <div className="px-5 py-3.5">
            <p className="text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">Runtime:</span>{" "}
              self-hosted headless Chrome: prod uses <code>@sparticuz/chromium-min</code>{" "}
              (binary fetched from <code>CHROMIUM_PACK_URL</code>), dev uses a local Chrome
              (<code>PUPPETEER_EXECUTABLE_PATH</code>). No API key. A launch/render failure is
              non-fatal: it silently falls back to a plain fetch, so a misconfigured runtime
              shows up as a plain (non-JS) mirror rather than an error.
            </p>
          </div>
        )}

        {/* ── Screenshot demo mode (managed capture + vision hotspots) ──────── */}
        <ToggleRow
          label="Screenshot demo mode"
          note="Capture a full-page screenshot (ScreenshotOne) and annotate the personalizable regions with per-scenario variants via Claude vision, instead of cloning the DOM. Needs a ScreenshotOne key; falls back to the mirror flow on any failure."
          checked={settings.screenshotEnabled}
          onChange={() => { patch({ screenshotEnabled: !settings.screenshotEnabled }); setSaveState("idle"); }}
        />

      </div>
    </section>
  );
}

// ── 4. Output Defaults ────────────────────────────────────────────────────────

function OutputDefaults({ settings, patch, updatedAt, saveAll }: SectionProps) {
  const { saveState, setSaveState, saveError, isPending, handleSave } = useSectionSave(saveAll);

  return (
    <section aria-labelledby="output-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="output-heading" className="text-base font-semibold text-neutral-900">
            Demo lifetime
          </h2>
          {updatedAt && (
            <p className="text-xs text-neutral-400 mt-0.5">
              Last saved{" "}
              {new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending || saveState === "saving"}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
        </button>
      </div>

      {saveState === "error" && saveError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          Save failed: {saveError}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">

        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="min-w-0 pr-4">
            <p className="text-sm font-medium text-neutral-800">Demo link expiry (days)</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Shareable links expire after this many days (1-30). Default: 7.
            </p>
          </div>
          <input
            type="number"
            min={1}
            max={30}
            value={settings.expiryDays}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) patch({ expiryDays: v });
              setSaveState("idle");
            }}
            className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-right text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        </div>

      </div>
    </section>
  );
}

// ── 5. Recent Runs Table ──────────────────────────────────────────────────────

function RecentRunsTable({ runs: initialRuns }: { runs: RecentRunSummary[] }) {
  const [runs,        setRuns]        = useState<RecentRunSummary[]>(initialRuns);
  const [confirming,  setConfirming]  = useState<string | null>(null); // demoId awaiting confirm
  const [deleting,    setDeleting]    = useState<string | null>(null); // demoId being deleted
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const CATEGORY_LABELS: Record<string, string> = {
    b2b_saas:    "B2B SaaS",
    agency:      "Agency",
    ecommerce:   "Ecommerce",
    recruitment: "Recruitment",
    general:     "General",
  };

  function handleDeleteClick(id: string) {
    setDeleteError(null);
    setConfirming(id);
  }

  function handleCancelDelete() {
    setConfirming(null);
  }

  function handleConfirmDelete(id: string) {
    setConfirming(null);
    setDeleting(id);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteDemoInstanceAction(id);
      setDeleting(null);
      if (result.ok) {
        setRuns((prev) => prev.filter((r) => r.id !== id));
      } else {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <section aria-labelledby="runs-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="runs-heading" className="text-base font-semibold text-neutral-900">
            Recent runs
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Last 20 successful demo generations. Failed runs are logged to the server console, use the
            Test Generator below for detailed diagnostics.
          </p>
        </div>
      </div>

      {deleteError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>Delete failed: {deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-8 text-center">
          <p className="text-sm text-neutral-500">No demos generated yet.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Use{" "}
            <Link href="/admin/demo/new" className="text-brand-600 hover:underline">
              Admin → Demo → New
            </Link>{" "}
            to create the first demo.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">URL</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Generated</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Views</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">ms</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={`transition-colors ${deleting === run.id ? "opacity-40" : "hover:bg-neutral-50"}`}
                >
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-neutral-800 truncate" title={run.sourceUrl}>
                      {run.siteName || run.sourceUrl}
                    </p>
                    <p className="text-neutral-400 truncate text-[10px]" title={run.sourceUrl}>
                      {run.sourceUrl}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {CATEGORY_LABELS[run.siteCategory] ?? run.siteCategory}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {new Date(run.generatedAt).toLocaleDateString("en-GB", {
                      day:   "numeric",
                      month: "short",
                      year:  "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {run.isExpired ? (
                      <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                        Expired
                      </span>
                    ) : (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-center">{run.viewCount}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {run.generationMs != null ? `${run.generationMs}` : ", "}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {confirming === run.id ? (
                        /* Inline confirmation */
                        <>
                          <span className="text-neutral-500 whitespace-nowrap">Delete?</span>
                          <button
                            onClick={() => handleConfirmDelete(run.id)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className="rounded border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-50 whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        /* Normal state */
                        <>
                          <Link
                            href={`/demo/${run.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:underline whitespace-nowrap"
                          >
                            Open ↗
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(run.id)}
                            disabled={deleting === run.id}
                            className="text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-40"
                            title="Delete demo"
                            aria-label="Delete demo"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 6. Test Panel ─────────────────────────────────────────────────────────────

type TestMode      = "analyze" | "dry_run" | "mirror";
type TestPhase     = "idle" | "running" | "success" | "error";

interface TestResult {
  fetchSucceeded: boolean;
  title:          string;
  category:       string;
  primaryColor:   string;
  scenarioCount:  number;
  generationMs:   number;
  demoId?:        string;
  demoUrl?:       string;
  /** JS-render outcome (Live Mirror only) — surfaces whether Chrome actually rendered. */
  render?:        { rendered: boolean; status: string; ms: number; reason?: string };
}

interface TestError {
  step:    string;
  message: string;
}

function TestPanel() {
  const [url, setUrl]             = useState("");
  const [mode, setMode]           = useState<TestMode>("analyze");
  const [phase, setPhase]         = useState<TestPhase>("idle");
  const [result, setResult]       = useState<TestResult | null>(null);
  const [error, setError]         = useState<TestError | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    if (!url.trim()) return;
    setPhase("running");
    setResult(null);
    setError(null);

    startTransition(async () => {
      if (mode === "analyze") {
        const res = await testAnalyzerConnectionAction(url.trim());
        if (res.ok) {
          setResult({
            fetchSucceeded: res.fetchSucceeded,
            title:          res.title,
            category:       res.category,
            primaryColor:   res.primaryColor,
            scenarioCount:  0,
            generationMs:   res.durationMs,
          });
          setPhase("success");
        } else {
          setError({ step: res.step, message: res.error });
          setPhase("error");
        }
        return;
      }

      // ── Live Mirror: mirror the real site HTML+CSS and inject adaptive slots ──
      if (mode === "mirror") {
        try {
          const resp = await fetch("/api/demo/mirror", {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "same-origin",
            body:        JSON.stringify({ url: url.trim() }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            setError({ step: "mirror", message: data?.error ?? data?.message ?? `HTTP ${resp.status}` });
            setPhase("error");
            return;
          }
          setResult({
            fetchSucceeded: Boolean(data.fetchSucceeded),
            title:          data.siteName ?? url.trim(),
            category:       "mirror",
            primaryColor:   "#6366f1",
            scenarioCount:  0,
            generationMs:   0,
            demoId:         data.demoId,
            demoUrl:        data.demoUrl,
            render:         data.render,
          });
          setPhase("success");
        } catch (e) {
          setError({ step: "mirror", message: e instanceof Error ? e.message : String(e) });
          setPhase("error");
        }
        return;
      }

      const res = await runDemoTestAction({
        url:         url.trim(),
        analyzeOnly: false,
        dryRun:      mode === "dry_run",
      });

      if (res.ok) {
        setResult({
          fetchSucceeded: res.fetchSucceeded,
          title:          res.title,
          category:       res.category,
          primaryColor:   res.primaryColor,
          scenarioCount:  res.scenarioCount,
          generationMs:   res.generationMs,
          demoId:         res.demoId,
          demoUrl:        res.demoUrl,
        });
        setPhase("success");
      } else {
        setError({ step: res.step, message: res.error });
        setPhase("error");
      }
    });
  }

  const STEP_LABELS: Record<string, string> = {
    auth:       "Authentication",
    validation: "Input validation",
    analyzer:   "Website Analyzer",
    generator:  "Content Generator",
    store:      "Database (demo_instances)",
  };

  return (
    <section aria-labelledby="test-heading">
      <h2 id="test-heading" className="text-base font-semibold text-neutral-900 mb-3">
        Test generator
      </h2>
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-5 py-5 space-y-4">

        <p className="text-xs text-neutral-500">
          Run the generation pipeline against a real URL without navigating away.
          Use <strong>Analyze only</strong> to test the analyzer in isolation; use{" "}
          <strong>Dry run</strong> to test the full pipeline without persisting a demo.
        </p>

        {/* URL input */}
        <div>
          <label htmlFor="test-url" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
            Prospect URL
          </label>
          <input
            id="test-url"
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setPhase("idle"); }}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Mode selector */}
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Run mode
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "analyze",  label: "Analyze only",  note: "No content generation" },
                { value: "dry_run",  label: "Dry run",       note: "Full pipeline, no DB write" },
                { value: "mirror",   label: "Live Mirror",   note: "Creates a real Mirror demo" },
              ] as { value: TestMode; label: string; note: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setMode(opt.value); setPhase("idle"); }}
                className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
                  mode === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {opt.label}
                <span className="ml-1.5 text-[10px] text-neutral-400 font-normal">{opt.note}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!url.trim() || isPending || phase === "running"}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {phase === "running" ? "Running…" : "Run test"}
        </button>

        {/* Results */}
        {phase === "success" && result && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">Test passed ✓</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><dt className="text-green-600">Fetch succeeded</dt><dd className="font-medium text-green-900">{result.fetchSucceeded ? "Yes" : "No (used defaults)"}</dd></div>
              <div><dt className="text-green-600">Duration</dt><dd className="font-medium text-green-900">{result.generationMs}ms</dd></div>
              <div><dt className="text-green-600">Site title</dt><dd className="font-medium text-green-900 truncate">{result.title}</dd></div>
              <div><dt className="text-green-600">Category</dt><dd className="font-medium text-green-900">{result.category}</dd></div>
              <div><dt className="text-green-600">Primary color</dt><dd className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-green-300" style={{ backgroundColor: result.primaryColor }} /><span className="font-medium text-green-900">{result.primaryColor}</span></dd></div>
              {result.scenarioCount > 0 && (
                <div><dt className="text-green-600">Scenarios</dt><dd className="font-medium text-green-900">{result.scenarioCount}</dd></div>
              )}
              {result.render && (
                <div className="col-span-2">
                  <dt className="text-green-600">JS render</dt>
                  <dd className="font-medium text-green-900">
                    {result.render.rendered
                      ? `Rendered ✓ (headless Chrome, ${result.render.ms}ms)`
                      : `Not rendered: plain fetch fallback · status: ${result.render.status}${result.render.reason ? ` · ${result.render.reason}` : ""}`}
                  </dd>
                </div>
              )}
            </dl>
            {result.demoUrl && (
              <p className="text-xs pt-1">
                <span className="text-green-700">Demo created: </span>
                <Link
                  href={result.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-800 underline hover:text-green-900"
                >
                  {result.demoUrl} ↗
                </Link>
              </p>
            )}
          </div>
        )}

        {phase === "error" && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-red-800">Test failed ✗</p>
            <p className="text-xs text-red-700">
              <span className="font-semibold">Failing step: </span>
              {STEP_LABELS[error.step] ?? error.step}
            </p>
            <p className="text-xs text-red-700">
              <span className="font-semibold">Error: </span>
              {error.message}
            </p>
            <ActionableErrorHint step={error.step} message={error.message} />
          </div>
        )}

      </div>
    </section>
  );
}

/**
 * Maps a failing step + error message to a specific, actionable admin hint.
 */
function ActionableErrorHint({ step, message }: { step: string; message: string }) {
  if (step === "auth") {
    return (
      <p className="text-xs text-red-700 font-medium">
        → Your admin session has expired.{" "}
        <Link href="/admin/login" className="underline hover:text-red-900">
          Log in again
        </Link>
        .
      </p>
    );
  }
  if (step === "analyzer") {
    if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("econnrefused")) {
      return (
        <p className="text-xs text-red-700 font-medium">
          → The prospect URL could not be reached (timeout or connection refused). Check that the URL is
          publicly accessible and not behind a firewall.
        </p>
      );
    }
    if (message.toLowerCase().includes("ssl") || message.toLowerCase().includes("certificate")) {
      return (
        <p className="text-xs text-red-700 font-medium">
          → SSL certificate error on the target site. The analyzer will still use fallback defaults, 
          this is a warning, not a hard failure.
        </p>
      );
    }
    return (
      <p className="text-xs text-red-700 font-medium">
        → The Website Analyzer (built-in) failed. Check that the URL is valid and accessible from
        the server. Check the server console for the full stack trace.
      </p>
    );
  }
  if (step === "store") {
    if (message.toLowerCase().includes("42p01") || message.toLowerCase().includes("demo_instances")) {
      return (
        <p className="text-xs text-red-700 font-medium">
          → The <code className="font-mono">demo_instances</code> table is missing. Run{" "}
          <code className="font-mono">supabase db push</code> to apply migration 048 which creates it.
        </p>
      );
    }
    return (
      <p className="text-xs text-red-700 font-medium">
        → Database write failed. Check the server console for the full error. Ensure{" "}
        <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is set correctly.
      </p>
    );
  }
  return null;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderStatus }) {
  const classes =
    status === "ready"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "partial"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-neutral-200 bg-neutral-100 text-neutral-500";

  const label =
    status === "ready"          ? "Ready"
    : status === "partial"      ? "Partial"
    : "Not configured";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function ToggleRow({
  label,
  note,
  checked,
  onChange,
  disabled,
  comingSoon,
}: {
  label:       string;
  note:        string;
  checked:     boolean;
  onChange:    () => void;
  disabled?:   boolean;
  comingSoon?: boolean;
}) {
  const isDisabled = disabled || comingSoon;
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${isDisabled ? "opacity-50" : ""}`}>
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-800">{label}</p>
          {comingSoon && (
            <span className="rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
              Soon
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">{note}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !isDisabled && onChange()}
        disabled={isDisabled}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
          checked ? "bg-brand-600" : "bg-neutral-300"
        } ${isDisabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
