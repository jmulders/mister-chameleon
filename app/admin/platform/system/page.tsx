/**
 * /admin/platform/system
 *
 * System Operations — the single place to run, trigger, or understand:
 *
 *   • Backup          — interactive create + version history with rollback
 *   • Build pipeline  — staging, production, hotfix, rollback flows
 *   • Environments    — what each environment is and how to deploy to it
 *
 * The Backup section is an interactive client component backed by
 * /api/admin/backup (POST = create, GET = list) and
 * /api/admin/restore/[backupId] (POST = restore).
 *
 * Everything else is static operational runbook content.
 */

import Link                    from "next/link";
import { getDb }               from "@/data/db";
import { BackupPanel }         from "./_components/BackupPanel";
import { CodeBlock }           from "./_components/CodeBlock";
import { WorkflowButton }      from "./_components/WorkflowButton";
import { RollbackTriggerButton } from "./_components/RollbackTriggerButton";
import type { BackupMeta }     from "@/app/api/admin/backup/route";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {n}
      </span>
      <div className="text-sm text-neutral-700 leading-relaxed">{children}</div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
               0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
               -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
               .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
               -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
               .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
               .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
               0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function EnvRow({
  env, branch, url, db, stripe,
}: {
  env: string; branch: string; url: string; db: string; stripe: string;
}) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-3 pr-6 text-sm font-medium text-neutral-900">{env}</td>
      <td className="py-3 pr-6 font-mono text-xs text-neutral-600">{branch}</td>
      <td className="py-3 pr-6 text-sm text-neutral-600">{url}</td>
      <td className="py-3 pr-6 text-sm text-neutral-600">{db}</td>
      <td className="py-3 text-sm text-neutral-600">{stripe}</td>
    </tr>
  );
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadBackups(): Promise<BackupMeta[]> {
  try {
    const db = getDb();
    const { data } = await db
      .from("platform_backups")
      .select("id, created_at, created_by, label, version, status, error, tables, row_count, restored_from_version")
      .order("version", { ascending: false })
      .limit(20);
    return (data ?? []) as BackupMeta[];
  } catch {
    return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SystemPage() {
  const initialBackups = await loadBackups();

  return (
    <div className="max-w-4xl p-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">System Operations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Backup, build pipeline, environments, and rollback — all in one place.
        </p>
      </div>

      {/* ── PART 1: BACKUP ──────────────────────────────────────────────────── */}
      <Section title="Backup">
        <BackupPanel initialBackups={initialBackups} />
      </Section>

      {/* ── PART 2: ENVIRONMENTS ─────────────────────────────────────────────── */}
      <Section title="Environments">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-2 pr-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">Environment</th>
                  <th className="pb-2 pr-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">Branch</th>
                  <th className="pb-2 pr-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">URL</th>
                  <th className="pb-2 pr-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">Supabase</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Stripe</th>
                </tr>
              </thead>
              <tbody>
                <EnvRow
                  env="Development"
                  branch="any feature branch"
                  url="localhost:3000"
                  db="Shared dev project"
                  stripe="Test mode"
                />
                <EnvRow
                  env="Staging"
                  branch="develop"
                  url="staging.misterchameleon.com"
                  db="Staging project"
                  stripe="Test mode"
                />
                <EnvRow
                  env="Production"
                  branch="main"
                  url="misterchameleon.com"
                  db="Production project"
                  stripe="Live mode"
                />
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-5 py-4 text-sm text-neutral-700">
            Environment variable templates:{" "}
            <code className="font-mono text-xs">.env.local.example</code> (dev) ·{" "}
            <code className="font-mono text-xs">.env.staging.example</code> (staging) ·{" "}
            <code className="font-mono text-xs">.env.production.example</code> (production)
          </div>
        </div>
      </Section>

      {/* ── PART 3: BUILD PIPELINE ───────────────────────────────────────────── */}
      <Section title="Build Pipeline">
        <div className="space-y-6">

          {/* Staging */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">STAGING</span>
              <span className="text-sm text-neutral-600">Auto-deploys on every push to <code className="font-mono text-xs">develop</code></span>
            </div>
            <div className="space-y-2">
              <Step n={1}>
                Push to <code className="font-mono text-xs">develop</code> (or merge a PR into it):
                <CodeBlock>{`git push origin develop`}</CodeBlock>
              </Step>
              <Step n={2}>GitHub Actions: CI → Migrations → Vercel deploy → health check</Step>
              <Step n={3}>Staging URL aliases to <strong>staging.misterchameleon.com</strong> automatically</Step>
            </div>
            <WorkflowButton
              workflow="staging.yml"
              branch="develop"
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 disabled:opacity-60"
            >
              <GitHubIcon />
              Deploy to staging
            </WorkflowButton>
          </div>

          <div className="border-t border-neutral-100" />

          {/* Production */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">PRODUCTION</span>
              <span className="text-sm text-neutral-600">Merge to <code className="font-mono text-xs">main</code> + manual approval gate</span>
            </div>
            <div className="space-y-2">
              <Step n={1}>
                Open a PR from <code className="font-mono text-xs">develop</code> → <code className="font-mono text-xs">main</code> with code owner approval:
                <CodeBlock>{`gh pr create --base main --head develop --title "Release vX.Y.Z"`}</CodeBlock>
              </Step>
              <Step n={2}>After merge: GitHub Actions runs CI, then pauses for <strong>manual approval</strong> in the production environment gate</Step>
              <Step n={3}>After approval: Migrations → Vercel production deploy → health check → GitHub release tag created automatically</Step>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
              Manual approval gate: <strong>GitHub → Settings → Environments → production → Required reviewers</strong>
            </div>
            <WorkflowButton
              workflow="production.yml"
              branch="main"
              className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:border-green-300 hover:bg-green-100 disabled:opacity-60"
            >
              <GitHubIcon />
              Deploy to production
            </WorkflowButton>
          </div>

          <div className="border-t border-neutral-100" />

          {/* Hotfix */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">HOTFIX</span>
              <span className="text-sm text-neutral-600">Critical fix that requires a code change</span>
            </div>
            <div className="space-y-2">
              <Step n={1}><CodeBlock>{`git checkout -b hotfix/fix-description main`}</CodeBlock></Step>
              <Step n={2}>Apply minimal, focused fix. Push branch — CI runs automatically via hotfix workflow.</Step>
              <Step n={3}>Open PR → <code className="font-mono text-xs">main</code>. After merge, production workflow deploys automatically.</Step>
              <Step n={4}>
                Cherry-pick back to <code className="font-mono text-xs">develop</code>:
                <CodeBlock>{`git checkout develop\ngit cherry-pick <commit-sha>`}</CodeBlock>
              </Step>
            </div>
            <Link
              href="https://github.com/jmulders/mister-chameleon/actions/workflows/hotfix.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:border-orange-300 hover:bg-orange-100"
            >
              <GitHubIcon />
              View hotfix runs
            </Link>
          </div>
        </div>
      </Section>

      {/* ── PART 4: ROLLBACK ─────────────────────────────────────────────────── */}
      <Section title="Rollback">
        <div className="space-y-5">
          <div className="rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-800">
            <strong>When to use rollback vs hotfix</strong>
            <br />
            <strong>Rollback</strong> — code/UI regression, no DB schema change. Repoints Vercel to a previous
            deployment in seconds.
            <br />
            <strong>Hotfix</strong> — requires a code change. Use the hotfix flow above instead.
            <br />
            <strong>DB rollback</strong> — use Supabase Dashboard → Database → Backups. Never via code.
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-800">How to rollback production</p>
            <div className="space-y-2">
              <Step n={1}>Go to <strong>vercel.com → your project → Deployments</strong>. Find the last known-good deployment URL (e.g. <code className="font-mono text-xs">https://mister-chameleon-abc123.vercel.app</code>).</Step>
              <Step n={2}>
                Trigger via <strong>GitHub → Actions → Rollback — Production → Run workflow</strong>, or via the CLI:
                <CodeBlock>{`gh workflow run rollback.yml --ref main \\\n  -f deployment_url="https://mister-chameleon-<hash>.vercel.app" \\\n  -f reason="Reason for rollback"`}</CodeBlock>
              </Step>
              <Step n={3}>Approve the production gate. The deployment URL and reason are written to the audit log.</Step>
              <Step n={4}>The workflow re-aliases <code className="font-mono text-xs">misterchameleon.com</code> to that deployment and runs a health check.</Step>
            </div>
            <RollbackTriggerButton
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-60"
            />
          </div>
        </div>
      </Section>

      {/* ── PART 5: QUICK REFERENCE ──────────────────────────────────────────── */}
      <Section title="Quick Reference">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Create a backup",          value: "System page → Backup → Create Backup button" },
            { label: "Restore a backup",         value: "System page → Backup → ↩ Restore on any version" },
            { label: "Deploy to staging",        value: "push to develop (or PR merge)" },
            { label: "Deploy to production",     value: "PR to main → GitHub approval gate" },
            { label: "Emergency hotfix",         value: "hotfix/* branch → PR → main" },
            { label: "Rollback production",      value: "GitHub Actions → Rollback → Run workflow" },
            { label: "DB point-in-time restore", value: "Supabase Dashboard → Database → Backups" },
            { label: "View deploy history",      value: "vercel.com → project → Deployments" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
              <p className="mt-1 font-mono text-xs text-neutral-800">{value}</p>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
