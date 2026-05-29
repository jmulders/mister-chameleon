/**
 * Migration 063 — demo_instances: change id column from uuid to text
 *
 * Problem:
 *   demo/store.ts generates short 12-character alphanumeric IDs (nanoid-style)
 *   for demo_instances.id. The table was documented as `id TEXT PK`, but the
 *   live DB has `id uuid` — most likely from an earlier migration that used
 *   `uuid_generate_v4()` as the default.
 *
 *   Inserting a short ID produces:
 *     ERROR 22P02: invalid input syntax for type uuid: "ZDCj9PDgidNX"
 *
 * Temporary workaround (migration 063 not yet applied):
 *   demo/store.ts now uses crypto.randomUUID() so standard UUIDs are inserted.
 *   Demos work immediately without this migration.
 *
 * What this migration does:
 *   Alters demo_instances.id from uuid → text so the short nanoid-style IDs
 *   can be used again (friendlier /demo/<shortId> URLs).
 *
 *   After this migration is applied, switch demo/store.ts generateDemoId() back
 *   to use generateShortId() for new demos.
 *
 * Safety:
 *   uuid values cast cleanly to text (they become the standard
 *   "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" string representation).
 *   Existing rows keep their UUIDs as string values — all reads and the
 *   getDemoById lookup continue to work because .eq("id", demoId) compares
 *   TEXT to TEXT with no type coercion needed.
 *
 * Idempotency:
 *   Guarded with a DO block that checks the column type before altering,
 *   so re-running is safe.
 */

DO $$
BEGIN
  -- Only alter if the column is still uuid type.
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'demo_instances'
      AND  column_name  = 'id'
      AND  data_type    = 'uuid'
  ) THEN
    ALTER TABLE public.demo_instances
      ALTER COLUMN id TYPE text USING id::text;

    RAISE NOTICE 'demo_instances.id changed from uuid to text';
  ELSE
    RAISE NOTICE 'demo_instances.id is already text — no change needed';
  END IF;
END;
$$;
