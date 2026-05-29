-- ── Migration: create tenant-fonts storage bucket ────────────────────────────
--
-- Creates the `tenant-fonts` Supabase Storage bucket used to store custom
-- font files (woff2 / woff) uploaded by operators through the admin Design
-- Token Editor.
--
-- ─── Bucket configuration ────────────────────────────────────────────────────
--
--   public  = true   — Files are served via Supabase CDN without auth.
--                      Browsers download font files directly via public URL;
--                      no signed-URL plumbing required in the app server.
--
--   file_size_limit  — 5 MB maximum per file (mirrors the app-level check in
--                      font-actions.ts MAX_FILE_SIZE_BYTES).
--
--   allowed_mime_types — woff2 and woff only.  The `application/octet-stream`
--                        fallback is included because some OS/browser combos
--                        send generic binary MIME for font files.
--
-- ─── Storage path convention ─────────────────────────────────────────────────
--
--   {tenantId}/{role}/{weight}.{ext}
--   e.g. "workengine/sans/regular.woff2"
--        "workengine/sans/bold.woff2"
--        "workengine/serif/regular.woff"
--
-- ─── Access control ──────────────────────────────────────────────────────────
--
--   Read  — public (everyone; served via CDN).
--   Write — service-role key only (enforced by Supabase RLS + bucket policy).
--           All uploads and deletes go through server-side server actions
--           (font-actions.ts) that use the service-role Supabase client
--           returned by getDb().  Browser clients never write directly.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   Uses INSERT ... ON CONFLICT DO NOTHING so re-running the migration (e.g.
--   during a fresh local dev environment setup) is safe and has no effect when
--   the bucket already exists.
--
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'tenant-fonts',
  'tenant-fonts',
  true,
  5242880,   -- 5 MB = 5 * 1024 * 1024 bytes
  ARRAY[
    'font/woff2',
    'font/woff',
    'application/font-woff',
    'application/font-woff2',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies ──────────────────────────────────────────────────────────────
--
-- Public read: allows anyone to GET files (needed for browser font loading).
-- Write (INSERT / UPDATE / DELETE) is intentionally left to service-role only —
-- no explicit RLS write policy is added here because:
--   a) Supabase Storage rejects writes from the anon/authenticated roles when
--      no write policy exists for a bucket.
--   b) All writes in this project go through getDb() which uses the service-role
--      key that bypasses RLS entirely.

DO $$
BEGIN
  -- CREATE POLICY does not support IF NOT EXISTS; use exception handling instead.
  CREATE POLICY "tenant-fonts public read"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'tenant-fonts');
EXCEPTION WHEN duplicate_object THEN
  NULL; -- policy already exists; nothing to do
END $$;
