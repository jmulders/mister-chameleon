"use client";

/**
 * DeploymentDashboard.tsx
 *
 * Three-tab deployment hub:
 *   1. Checklist  — step-by-step setup status with actionable fix buttons
 *   2. Env vars   — grouped list of all env vars with set/missing status
 *   3. Guide      — Vercel + Supabase Cloud deployment walkthrough
 */

import { useState, useTransition } from "react";
import type { DeploymentData, DeploymentCheck, EnvVarStatus, CheckStatus } from "../page";
import {
  seedEnrichmentPricingAction,
  seedPlatformVariantsAction,
  checkDeploymentStatusAction,
} from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; cls: string }> = {
    ok:      { label: "✓",  cls: "bg-green-50 text-green-700 border-green-200" },
    warning: { label: "⚠",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    error:   { label: "✗",  cls: "bg-red-50 text-red-700 border-red-200" },
    unknown: { label: "?",  cls: "bg-neutral-50 text-neutral-500 border-neutral-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-sm font-semibold shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
    >
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative group">
      <pre className="rounded-md bg-neutral-900 text-green-300 text-xs p-3 overflow-x-auto font-mono leading-relaxed">
        {children}
      </pre>
      <CopyButton text={children} label="Copy" />
    </div>
  );
}

// ── Tab 1: Checklist ──────────────────────────────────────────────────────────

function ChecklistTab({ checks, data }: { checks: DeploymentCheck[]; data: DeploymentData }) {
  const [isPending, startTransition] = useTransition();
  const [actionResults, setActionResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  function runAction(actionId: string) {
    startTransition(async () => {
      let result: { ok: boolean; error?: string; detail?: string };
      if (actionId === "seed-enrichment-pricing") {
        result = await seedEnrichmentPricingAction();
      } else if (actionId === "seed-platform-variants") {
        result = await seedPlatformVariantsAction();
      } else {
        result = { ok: false, error: "Unknown action." };
      }
      setActionResults((prev) => ({
        ...prev,
        [actionId]: { ok: result.ok, msg: result.ok ? (result.detail ?? "Done.") : (result.error ?? "Failed.") },
      }));
    });
  }

  const errorCount   = checks.filter((c) => c.status === "error").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const allOk        = errorCount === 0 && warningCount === 0;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {allOk ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-700">
            All deployment checks passed — your environment is ready.
          </p>
        </div>
      ) : (
        <div className={`rounded-lg border px-4 py-3 ${errorCount > 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-sm font-medium ${errorCount > 0 ? "text-red-700" : "text-amber-700"}`}>
            {errorCount > 0
              ? `${errorCount} error${errorCount > 1 ? "s" : ""} require${errorCount === 1 ? "s" : ""} attention`
              : `${warningCount} warning${warningCount > 1 ? "s" : ""} — optional but recommended`}
            {errorCount > 0 && warningCount > 0 && ` · ${warningCount} warning${warningCount > 1 ? "s" : ""}`}
          </p>
        </div>
      )}

      {/* Check rows */}
      <div className="rounded-lg border border-neutral-200 bg-white divide-y divide-neutral-100">
        {checks.map((check) => (
          <div key={check.id} className="flex items-start gap-3 px-4 py-3">
            <StatusBadge status={check.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800">{check.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{check.detail}</p>
              {check.fixHint && check.status !== "ok" && (
                <p className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
                  Fix: {check.fixHint}
                </p>
              )}
              {check.actionable && check.actionId && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => runAction(check.actionId!)}
                    disabled={isPending}
                    className="rounded bg-neutral-800 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                  >
                    {isPending ? "Running…"
                      : check.actionId === "seed-platform-variants" ? "Seed / update platform variants"
                      : "Reset to defaults"}
                  </button>
                  {actionResults[check.actionId] && (
                    <span className={`text-xs ${actionResults[check.actionId]!.ok ? "text-green-600" : "text-red-600"}`}>
                      {actionResults[check.actionId]!.msg}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CLI steps that cannot run from the browser */}
      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
          CLI commands (run locally or in CI)
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-neutral-600 mb-1">Apply database migrations:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-neutral-900 text-green-300 rounded px-2 py-1">
                supabase db push
              </code>
              <CopyButton text="supabase db push" />
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">Seed Sanity CMS shared content (optional):</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-neutral-900 text-green-300 rounded px-2 py-1">
                npx tsx cms/seed/platform-seed.ts
              </code>
              <CopyButton text="npx tsx cms/seed/platform-seed.ts" />
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">Run a backup:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-neutral-900 text-green-300 rounded px-2 py-1">
                npm run backup:no-sanity
              </code>
              <CopyButton text="npm run backup:no-sanity" />
            </div>
          </div>
        </div>
      </div>

      {/* Download setup.sh */}
      <div className="flex items-center gap-3 pt-1">
        <a
          href="/api/admin/deployment/setup-script"
          download="setup.sh"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          ↓ Download setup.sh
        </a>
        <p className="text-xs text-neutral-400">
          Shell script with all CLI commands in order — chmod +x setup.sh &amp;&amp; ./setup.sh
        </p>
      </div>
    </div>
  );
}

// ── Tab 2: Environment Variables ──────────────────────────────────────────────

function EnvVarsTab({ envVars }: { envVars: EnvVarStatus[] }) {
  const groups = Array.from(new Set(envVars.map((e) => e.group)));
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(envVars.filter((e) => e.required && !e.isSet).map((e) => e.group)),
  );

  function toggle(g: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  }

  // "Effectively set" = env var set OR stored in platform_settings DB
  const effectivelySet = (v: EnvVarStatus) => v.isSet || Boolean(v.isSetViaDb);

  const totalSet     = envVars.filter(effectivelySet).length;
  const requiredMiss = envVars.filter((e) => e.required && !effectivelySet(e)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="text-green-600 font-medium">{totalSet} configured</span>
        <span>·</span>
        <span>{envVars.length - totalSet} not set</span>
        {requiredMiss > 0 && (
          <>
            <span>·</span>
            <span className="text-red-600 font-medium">{requiredMiss} required missing</span>
          </>
        )}
      </div>

      {groups.map((group) => {
        const groupVars  = envVars.filter((e) => e.group === group);
        // Count vars that are set either via env or DB
        const groupSet   = groupVars.filter(effectivelySet).length;
        // All vars in this group are configured (any combination of env + DB)
        const allConfigured = groupSet === groupVars.length;
        // Entire group configured exclusively via DB
        const allViaDb   = groupVars.every((v) => !v.isSet && Boolean(v.isSetViaDb));
        const someViaDb  = groupVars.some((v) => v.isSetViaDb);
        const isOpen     = expanded.has(group);
        const hasErrors  = groupVars.some((e) => e.required && !effectivelySet(e));

        return (
          <div key={group} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <button
              onClick={() => toggle(group)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-800">{group}</span>
                {hasErrors && (
                  <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium">
                    Missing required
                  </span>
                )}
                {!hasErrors && allConfigured && allViaDb && (
                  <span className="text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 font-medium">
                    ✓ Platform settings
                  </span>
                )}
                {!hasErrors && allConfigured && !allViaDb && (
                  <span className="text-xs rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 font-medium">
                    ✓ All configured
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>{groupSet}/{groupVars.length} configured</span>
                <span>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-neutral-100 divide-y divide-neutral-50">
                {/* DB-config notice for groups where credentials live in platform_settings */}
                {someViaDb && (
                  <div className="flex items-start gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-blue-500 text-sm shrink-0 mt-0.5">ℹ</span>
                    <p className="text-xs text-blue-700">
                      These credentials are stored in <strong>Platform Settings</strong> (configured via{" "}
                      {group === "Cloudflare R2"
                        ? <a href="/admin/platform/integrations/storage" className="underline hover:text-blue-900">Integrations → Storage</a>
                        : <a href="/admin/platform/integrations/email" className="underline hover:text-blue-900">Integrations → Email</a>
                      }
                      ) — env vars are optional when using this method.
                    </p>
                  </div>
                )}

                {groupVars.map((v) => {
                  const viaDb    = Boolean(v.isSetViaDb);
                  const viaEnv   = v.isSet;
                  const isOk     = viaEnv || viaDb;
                  const icon     = viaEnv ? "✓" : viaDb ? "✓" : v.required ? "✗" : "–";
                  const iconCls  = viaEnv
                    ? "text-green-600"
                    : viaDb
                    ? "text-blue-500"
                    : v.required
                    ? "text-red-500"
                    : "text-neutral-300";

                  return (
                    <div key={v.key} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 text-sm shrink-0 ${iconCls}`}>{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-mono text-neutral-700">{v.key}</code>
                          {v.required && (
                            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">required</span>
                          )}
                          {viaEnv && (
                            <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">env var ✓</span>
                          )}
                          {!viaEnv && viaDb && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">platform settings ✓</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">{v.description}</p>
                        {!isOk && (
                          <p className="mt-0.5 text-xs text-neutral-400 italic">Where to get it: {v.howToGet}</p>
                        )}
                      </div>
                      <CopyButton text={v.key} label="Copy key" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 3: Setup Guide ────────────────────────────────────────────────────────

function GuideTab() {
  const steps = [
    {
      num:   "1",
      title: "Prerequisites",
      content: (
        <ul className="text-sm text-neutral-600 space-y-1 list-disc list-inside">
          <li>Node.js 20 or later — <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">nodejs.org</a></li>
          <li>Git repository cloned locally</li>
          <li>Supabase CLI — <code className="text-xs bg-neutral-100 px-1 rounded">npm install -g supabase</code></li>
          <li>A <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Vercel</a> account (free tier is fine)</li>
          <li>A <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Supabase</a> project (free tier is fine)</li>
        </ul>
      ),
    },
    {
      num:   "2",
      title: "Environment variables",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>Copy <code className="text-xs bg-neutral-100 px-1 rounded">.env.example</code> to <code className="text-xs bg-neutral-100 px-1 rounded">.env.local</code> and fill in all required values:</p>
          <CodeBlock>cp .env.example .env.local{"\n"}# Then open .env.local and fill in at minimum:{"\n"}# NEXT_PUBLIC_SUPABASE_URL{"\n"}# NEXT_PUBLIC_SUPABASE_ANON_KEY{"\n"}# SUPABASE_SERVICE_ROLE_KEY{"\n"}# ADMIN_SESSION_SECRET  (generate: openssl rand -hex 32)</CodeBlock>
          <p className="text-xs text-neutral-500">The <strong>Env Vars</strong> tab shows every variable with descriptions and where to find each value.</p>
        </div>
      ),
    },
    {
      num:   "3",
      title: "Install dependencies",
      content: <CodeBlock>npm install</CodeBlock>,
    },
    {
      num:   "4",
      title: "Apply database migrations",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>Link your Supabase project and push all migrations:</p>
          <CodeBlock>{"# Link to your remote Supabase project\nsupabase link --project-ref YOUR_PROJECT_REF\n\n# Apply all migrations in supabase/migrations/\nsupabase db push"}</CodeBlock>
          <p className="text-xs text-neutral-500">
            Find your project ref at <strong>app.supabase.com → Settings → General → Reference ID</strong>.
            Alternatively, paste each <code>.sql</code> file from <code>supabase/migrations/</code> into the Supabase SQL editor in order.
          </p>
        </div>
      ),
    },
    {
      num:   "5",
      title: "Seed platform defaults",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>Once migrations are applied, seed the enrichment pricing table from this dashboard:</p>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
            Admin → Platform → Billing → Pricing → <strong>Reset to defaults</strong>
          </div>
          <p>Optionally seed Sanity CMS shared content (hero/proof/CTA variants):</p>
          <CodeBlock>npx tsx cms/seed/platform-seed.ts</CodeBlock>
        </div>
      ),
    },
    {
      num:   "6",
      title: "Verify locally",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>Start the development server and confirm the app loads:</p>
          <CodeBlock>npm run dev</CodeBlock>
          <p className="text-xs text-neutral-500">
            Visit <strong>http://localhost:3000/admin</strong> — log in with the credentials you set in Admin Auth env vars.
            Check the <strong>Checklist</strong> tab above — all items should show green.
          </p>
        </div>
      ),
    },
    {
      num:   "7",
      title: "Deploy to Vercel",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <ol className="list-decimal list-inside space-y-1">
            <li>Push your code to GitHub.</li>
            <li>Go to <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">vercel.com/new</a> and import your repository.</li>
            <li>In <strong>Project Settings → Environment Variables</strong>, add all variables from your <code>.env.local</code>.</li>
            <li>Click <strong>Deploy</strong>. Vercel runs <code>npm install</code> and <code>npm run build</code> automatically.</li>
          </ol>
          <p className="text-xs text-neutral-500 mt-2">
            Future pushes to <code>main</code> trigger automatic re-deploys. Preview deployments are created for every pull request.
            Set <code>MC_FALLBACK_TENANT_ID</code> to your tenant ID so staging URLs (*.vercel.app) resolve correctly.
          </p>
        </div>
      ),
    },
    {
      num:   "8",
      title: "Set up automated backups (optional)",
      content: (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>
            Add a Vercel Cron Job in <code>vercel.json</code> to run daily backups:
          </p>
          <CodeBlock>{`{
  "crons": [{
    "path": "/api/cron/backup",
    "schedule": "0 3 * * *"
  }]
}`}</CodeBlock>
          <p className="text-xs text-neutral-500">
            Or run <code>npm run backup:no-sanity</code> manually from your local machine whenever needed.
            Backup files are stored in the <code>backups/</code> directory or R2 when configured.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800 font-medium">Vercel + Supabase Cloud deployment guide</p>
        <p className="text-xs text-blue-600 mt-0.5">
          Estimated time: 20–30 minutes for a first setup. Subsequent deploys are automatic via git push.
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <details key={step.num} className="rounded-lg border border-neutral-200 bg-white group" open={step.num === "1"}>
            <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors list-none">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-white text-xs font-bold shrink-0">
                {step.num}
              </span>
              <span className="text-sm font-medium text-neutral-800">{step.title}</span>
              <span className="ml-auto text-neutral-400 text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-4 py-4">
              {step.content}
            </div>
          </details>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <a
          href="/api/admin/deployment/setup-script"
          download="setup.sh"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          ↓ Download setup.sh
        </a>
        <p className="text-xs text-neutral-400">
          Automated shell script for steps 3–6 above
        </p>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

const TABS = ["Checklist", "Env Vars", "Guide"] as const;
type Tab = (typeof TABS)[number];

export function DeploymentDashboard({ data }: { data: DeploymentData }) {
  const [activeTab, setActiveTab] = useState<Tab>("Checklist");
  const [refreshPending, startRefresh] = useTransition();
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  function handleRefresh() {
    startRefresh(async () => {
      const result = await checkDeploymentStatusAction();
      setRefreshMsg(result.ok ? "Refreshed." : (result.error ?? "Refresh failed."));
      setTimeout(() => setRefreshMsg(null), 3000);
    });
  }

  const errorCount   = data.checks.filter((c) => c.status === "error").length;
  const warningCount = data.checks.filter((c) => c.status === "warning").length;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-neutral-200 mb-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-neutral-800 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab}
              {tab === "Checklist" && errorCount > 0 && (
                <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
                  {errorCount}
                </span>
              )}
              {tab === "Checklist" && errorCount === 0 && warningCount > 0 && (
                <span className="ml-1.5 text-xs bg-amber-500 text-white rounded-full px-1.5 py-0.5">
                  {warningCount}
                </span>
              )}
              {tab === "Env Vars" && data.envVars.filter((e) => e.required && !e.isSet).length > 0 && (
                <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
                  {data.envVars.filter((e) => e.required && !e.isSet).length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 pb-1">
          {refreshMsg && <span className="text-xs text-neutral-500">{refreshMsg}</span>}
          <button
            onClick={handleRefresh}
            disabled={refreshPending}
            className="text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-50 transition-colors"
          >
            {refreshPending ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "Checklist" && <ChecklistTab checks={data.checks} data={data} />}
      {activeTab === "Env Vars"  && <EnvVarsTab envVars={data.envVars} />}
      {activeTab === "Guide"     && <GuideTab />}
    </div>
  );
}
