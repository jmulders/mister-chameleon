-- ── Admin User Management Enhancements ────────────────────────────────────────
--
-- This migration extends the admin auth foundation with:
--
--   1. is_active column on admin_users
--      Allows superadmin to deactivate accounts without deleting them.
--      Inactive users cannot log in (blocked in loginAction).
--
--   2. Updated role constraint
--      Adds 'tenant_admin' alongside the existing 'admin' and 'superadmin'.
--      Promotes all existing 'admin' rows to 'superadmin' (preserves their
--      unrestricted access — 'admin' was the original bootstrap role).
--      'admin' is kept in the constraint for safety; it can be removed
--      in a future migration once confirmed no rows carry that value.
--
--   3. admin_user_tenants junction table
--      Many-to-many relationship: one admin user can manage many tenants,
--      one tenant can be managed by many users.
--      tenant_id references the text slug in tenant_settings (no FK needed —
--      tenants live in a separate JSONB store / Supabase table).
--      CASCADE DELETE: removing a user automatically removes their assignments.
--
-- Migration: 20240101000021_admin_user_management.sql

-- ── 1. Add is_active ───────────────────────────────────────────────────────────
-- Default true so all existing users remain active after the migration.

alter table admin_users
  add column if not exists is_active boolean not null default true;

-- ── 2. Update role constraint to include tenant_admin ─────────────────────────
-- Drop the existing check first, then add a new one that also allows tenant_admin.

alter table admin_users drop constraint if exists admin_users_role_check;

alter table admin_users
  add constraint admin_users_role_check
  check (role in ('admin', 'superadmin', 'tenant_admin'));

-- ── 3. Promote existing 'admin' rows to 'superadmin' ──────────────────────────
--
-- 'admin' was the original unrestricted bootstrap role (pre-migration-21).
-- isSuperAdmin() in lib/admin-auth/authorization.ts treats it as full access,
-- and the intent documented there is:
--   "After migration 21 runs: existing 'admin' rows are converted to the
--    canonical equivalent — 'superadmin' — so no existing operator loses access."
--
-- Promoting to 'superadmin' (not 'tenant_admin') preserves the unrestricted
-- access these users already had and avoids locking out the bootstrap operator.
-- New users created through the UI after this migration default to 'tenant_admin'.

update admin_users
   set role       = 'superadmin',
       updated_at = now()
 where role = 'admin';

-- ── 4. Update column default so new rows get tenant_admin ─────────────────────

alter table admin_users
  alter column role set default 'tenant_admin';

-- ── 5. admin_user_tenants — many-to-many junction table ───────────────────────
--
-- user_id   → references admin_users.id (UUID)
-- tenant_id → the tenant slug string (e.g. "acme-corp") from tenant_settings
--
-- Superadmin users can access ALL tenants without an explicit row here;
-- the application layer skips the assignment check for superadmin.

create table if not exists admin_user_tenants (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references admin_users(id) on delete cascade,
  tenant_id   text        not null,
  assigned_at timestamptz not null default now(),

  -- Prevent duplicate assignments
  unique (user_id, tenant_id)
);

-- RLS enabled, no permissive policies — service-role client only.
alter table admin_user_tenants enable row level security;

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Lookup all tenants for a user (used in tenant access checks)
create index if not exists admin_user_tenants_user_idx
  on admin_user_tenants (user_id);

-- Lookup all users for a tenant (used in tenant user list)
create index if not exists admin_user_tenants_tenant_idx
  on admin_user_tenants (tenant_id);
