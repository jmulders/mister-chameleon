/**
 * Admin — Database Setup
 *
 * Shows the current migration status and provides a one-click mechanism to
 * apply migration 21 (admin_user_tenants) using the Supabase Management API.
 *
 * ─── Why this page exists ─────────────────────────────────────────────────────
 *
 *   The supabase-js client communicates via PostgREST, which handles DML only
 *   (SELECT / INSERT / UPDATE / DELETE). DDL (CREATE TABLE, ALTER TABLE, etc.)
 *   cannot be executed through PostgREST.
 *
 *   This page accepts a Supabase Personal Access Token (PAT) at runtime and
 *   calls the Supabase Management API to execute the migration SQL directly.
 *   The PAT is never stored — it is used once and discarded.
 *
 *   Alternatively, operators who prefer the CLI can copy the SQL shown here and
 *   paste it into the Supabase SQL Editor, or run `npx supabase db push` locally.
 *
 * ─── Access ────────────────────────────────────────────────────────────────────
 *
 *   Superadmin only.
 */

import Link                         from "next/link";
import { requireSuperAdmin }        from "@/lib/admin-auth/authorization";
import { isAdminUserTenantsAvailable } from "@/data/admin-auth";
import { Text }                     from "@/components/primitives/Text";
import { applyMigration21Action }   from "./actions";

// ── Migration SQL (display copy — identical to the migration file) ─────────────

const DISPLAY_SQL = `-- Migration 21: admin_user_tenants
-- Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS guards)

alter table admin_users
  add column if not exists is_active boolean not null default true;

alter table admin_users drop constraint if exists admin_users_role_check;

alter table admin_users
  add constraint admin_users_role_check
  check (role in ('admin', 'superadmin', 'tenant_admin'));

update admin_users
   set role       = 'superadmin',
       updated_at = now()
 where role = 'admin';

alter table admin_users
  alter column role set default 'tenant_admin';

create table if not exists admin_user_tenants (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references admin_users(id) on delete cascade,
  tenant_id   text        not null,
  assigned_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

alter table admin_user_tenants enable row level security;

create index if not exists admin_user_tenants_user_idx
  on admin_user_tenants (user_id);

create index if not exists admin_user_tenants_tenant_idx
  on admin_user_tenants (tenant_id);`.trim();

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function AdminSetupPage({ searchParams }: Props) {
  await requireSuperAdmin();

  const { success, error } = await searchParams;
  const migrationApplied   = await isAdminUserTenantsAvailable();

  // Derive the Supabase SQL Editor URL from the project URL
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef   = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
  const sqlEditorUrl = projectRef
    ? `https://app.supabase.com/project/${projectRef}/sql/new`
    : "https://app.supabase.com";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Text variant="h2">Database setup</Text>
        <Text variant="body-sm" color="muted" className="mt-1">
          Apply pending database migrations to unlock platform features.
        </Text>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── Success banner ────────────────────────────────────────────── */}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-medium">Migration applied successfully.</p>
            <p className="mt-1 text-xs text-green-700">
              The <code className="rounded bg-green-100 px-1 font-mono">admin_user_tenants</code> table
              is now available. Tenant assignments will be saved going forward.{" "}
              <Link href="/admin/users" className="underline hover:text-green-900">
                Go to user management →
              </Link>
            </p>
          </div>
        )}

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Migration failed</p>
            <p className="mt-1 text-xs text-red-600">{decodeURIComponent(error)}</p>
          </div>
        )}

        {/* ── Migration 21 status card ──────────────────────────────────── */}
        <section className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Migration 21: Tenant assignments
              </h2>
              <p className="mt-0.5 text-xs text-neutral-400">
                Creates <code className="font-mono">admin_user_tenants</code>,
                adds <code className="font-mono">is_active</code> to{" "}
                <code className="font-mono">admin_users</code>, and introduces
                the two-tier role model (superadmin / tenant_admin).
              </p>
            </div>
            {/* Status badge */}
            <span
              className={[
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                migrationApplied
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700",
              ].join(" ")}
            >
              {migrationApplied ? "Applied" : "Pending"}
            </span>
          </div>

          <div className="px-6 py-5 space-y-5">
            {migrationApplied ? (
              <p className="text-sm text-neutral-600">
                This migration has already been applied. Tenant assignments are fully
                functional: users can be assigned to specific tenants from the{" "}
                <Link href="/admin/users" className="text-brand-600 hover:text-brand-700 underline">
                  user management
                </Link>{" "}
                page.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-600">
                  This migration has not yet been applied to the current database.
                  Until it runs, tenant assignment checkboxes in the user form are
                  shown for preview only and selections are not saved.
                </p>

                {/* ── Option A: One-click via Management API ────────────── */}
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-neutral-800">
                    Option A: Apply automatically
                  </p>
                  <p className="text-xs text-neutral-500">
                    Enter your Supabase Personal Access Token to apply the migration
                    directly from this page. Generate one at{" "}
                    <a
                      href="https://app.supabase.com/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      app.supabase.com → Account → Access tokens
                    </a>
                    . The token is used once and never stored.
                  </p>
                  <form action={applyMigration21Action} className="flex gap-2">
                    <input
                      name="pat"
                      type="password"
                      required
                      placeholder="sbp_…"
                      autoComplete="off"
                      className={
                        "flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm " +
                        "text-neutral-900 placeholder-neutral-400 shadow-sm font-mono " +
                        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      }
                    />
                    <button
                      type="submit"
                      className={
                        "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white " +
                        "shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 " +
                        "focus:ring-brand-300 transition-colors whitespace-nowrap"
                      }
                    >
                      Apply migration
                    </button>
                  </form>
                </div>

                {/* ── Option B: Manual SQL ──────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-800">
                    Option B: Run manually in the Supabase SQL Editor
                  </p>
                  <p className="text-xs text-neutral-500">
                    Copy the SQL below and paste it into the{" "}
                    <a
                      href={sqlEditorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Supabase SQL Editor
                    </a>
                    {" "}for this project, then click Run.
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100 font-mono whitespace-pre">
                    {DISPLAY_SQL}
                  </pre>
                </div>

                {/* ── Option C: CLI ─────────────────────────────────────── */}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-neutral-800">
                    Option C: Supabase CLI
                  </p>
                  <pre className="rounded-lg border border-neutral-200 bg-neutral-900 px-4 py-2.5 text-xs text-neutral-100 font-mono">
                    npx supabase db push
                  </pre>
                  <p className="text-xs text-neutral-400">
                    Run from the project root with the correct{" "}
                    <code className="font-mono text-neutral-500">SUPABASE_ACCESS_TOKEN</code> set.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
