"use server";

/**
 * Admin Setup — Server Actions
 *
 * Provides an in-app mechanism to apply migration 21
 * (admin_user_tenants table) without requiring CLI access.
 *
 * Uses the Supabase Management API:
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 *
 * Requires a Supabase Personal Access Token (PAT) — separate from the
 * service role key. The PAT is accepted from the form (not stored in env)
 * and is only used for this one request.
 */

import { redirect }        from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireSuperAdmin } from "@/lib/admin-auth/authorization";

// ── Migration SQL ─────────────────────────────────────────────────────────────
//
// Identical to supabase/migrations/20240101000021_admin_user_management.sql.
// Kept here so the in-app setup action can execute it without filesystem reads.
// All statements use IF EXISTS / IF NOT EXISTS guards — safe to run more than once.

const MIGRATION_21_SQL = `
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
  on admin_user_tenants (tenant_id);
`.trim();

// ── Project ref extraction ─────────────────────────────────────────────────────

/**
 * Extracts the Supabase project reference from the project URL.
 * e.g. "https://kdhfpvjeriszteqhpgll.supabase.co" → "kdhfpvjeriszteqhpgll"
 */
function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

// ── applyMigration21Action ─────────────────────────────────────────────────────

/**
 * Applies migration 21 (admin_user_tenants) to the live Supabase database.
 *
 * Calls the Supabase Management API with the provided Personal Access Token.
 * All SQL statements use IF EXISTS / IF NOT EXISTS guards so the action is
 * idempotent — safe to run even after a partial prior apply.
 *
 * Superadmin only.
 *
 * Form fields:
 *   pat — Supabase Personal Access Token (from app.supabase.com → Account → Access tokens)
 */
export async function applyMigration21Action(formData: FormData): Promise<void> {
  try {
    await requireSuperAdmin();

    const pat = ((formData.get("pat") as string | null) ?? "").trim();
    if (!pat) {
      redirect("/admin/setup?error=Personal+access+token+is+required");
    }

    const ref = getProjectRef();
    if (!ref) {
      redirect("/admin/setup?error=Could+not+determine+Supabase+project+reference+from+NEXT_PUBLIC_SUPABASE_URL");
    }

    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: MIGRATION_21_SQL }),
      },
    );

    if (!resp.ok) {
      let detail = "";
      try {
        const body = await resp.json() as { message?: string; error?: string };
        detail = body.message ?? body.error ?? resp.statusText;
      } catch {
        detail = resp.statusText;
      }
      const msg = encodeURIComponent(`Migration failed (HTTP ${resp.status}): ${detail}`);
      redirect(`/admin/setup?error=${msg}`);
    }

    redirect("/admin/setup?success=1");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[applyMigration21Action]", err);
    const msg = encodeURIComponent(
      err instanceof Error ? err.message : "Unexpected error applying migration",
    );
    redirect(`/admin/setup?error=${msg}`);
  }
}
