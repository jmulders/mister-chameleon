-- ── Admin Users ───────────────────────────────────────────────────────────────
--
-- One row per admin/operator user.
-- Credentials and TOTP state are kept fully server-side.
-- The two_factor_secret column stores the TOTP shared secret in plaintext
-- because it is protected by the service-role key (no client ever reads it).
-- two_factor_backup_codes stores SHA-256 hashes of one-time recovery codes.
-- two_factor_pending_secret holds a not-yet-verified secret during setup and
-- is cleared once the user successfully verifies their first TOTP code.
--
-- RLS is enabled but no permissive policies are created — all access goes
-- through the service-role client which bypasses RLS entirely.
--
-- Migration: 20240101000020_create_admin_users.sql

create table if not exists admin_users (
  id                        uuid        primary key default gen_random_uuid(),
  email                     text        not null unique,
  password_hash             text        not null,
  name                      text        not null,
  role                      text        not null default 'admin'
                                        check (role in ('admin', 'superadmin')),

  -- TOTP 2FA
  two_factor_enabled        boolean     not null default false,
  two_factor_secret         text,                                -- live TOTP secret
  two_factor_pending_secret text,                                -- temp during setup
  two_factor_backup_codes   text[],                              -- SHA-256 hashed codes
  two_factor_enabled_at     timestamptz,

  -- Audit
  last_login_at             timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Enable RLS (service-role key bypasses it; this prevents accidental anon access)
alter table admin_users enable row level security;

-- Index for login lookups
create index if not exists admin_users_email_idx on admin_users (lower(email));
