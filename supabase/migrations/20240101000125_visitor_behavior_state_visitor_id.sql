-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0125 — visitor_behavior_state: fix visitor_id in primary key
--
-- Problem:
--   visitor_id was added to visitor_behavior_state out-of-band and was made
--   part of the PRIMARY KEY.  The column was never set by updateBehaviorState(),
--   so every upsert fails with:
--
--     null value in column "visitor_id" of relation "visitor_behavior_state"
--     violates not-null constraint
--
--   PRIMARY KEY columns are always NOT NULL in Postgres, so the standard
--   ALTER COLUMN … DROP NOT NULL fails with SQLSTATE 42P16.
--
-- Fix:
--   1. Drop the PRIMARY KEY constraint that includes visitor_id.
--   2. Restore the correct PRIMARY KEY on `id` (the original design per
--      migration 028: id uuid PRIMARY KEY DEFAULT gen_random_uuid()).
--   3. Ensure the UNIQUE (tenant_id, session_id) constraint exists — this is
--      the onConflict target used by the upsert in updateBehaviorState().
--   4. visitor_id remains as a standalone nullable column.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the PRIMARY KEY that includes visitor_id.
--   We don't know the exact constraint name (it depends on how it was created),
--   so we query pg_constraint to find it dynamically.
DO $$
DECLARE
  v_pk_name text;
BEGIN
  SELECT conname
  INTO   v_pk_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.visitor_behavior_state'::regclass
    AND  contype  = 'p'                       -- primary key
    AND  conkey   @> ARRAY[
           (SELECT attnum FROM pg_attribute
            WHERE  attrelid = 'public.visitor_behavior_state'::regclass
              AND  attname  = 'visitor_id')
         ]::smallint[];                        -- PK includes visitor_id column

  IF v_pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.visitor_behavior_state DROP CONSTRAINT %I', v_pk_name);
    RAISE NOTICE 'visitor_behavior_state: dropped PK % (contained visitor_id)', v_pk_name;
  ELSE
    RAISE NOTICE 'visitor_behavior_state: no PK containing visitor_id found — skipped drop';
  END IF;
END $$;

-- Step 2: Ensure the `id` column exists with its original definition.
ALTER TABLE public.visitor_behavior_state
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Back-fill id for any rows that were inserted without it.
UPDATE public.visitor_behavior_state SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 3: Restore PRIMARY KEY on id (if no PK exists now).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'public.visitor_behavior_state'::regclass
      AND  contype  = 'p'
  ) THEN
    ALTER TABLE public.visitor_behavior_state ADD PRIMARY KEY (id);
    RAISE NOTICE 'visitor_behavior_state: PRIMARY KEY (id) restored';
  ELSE
    RAISE NOTICE 'visitor_behavior_state: PRIMARY KEY already exists — skipped';
  END IF;
END $$;

-- Step 4: Ensure UNIQUE (tenant_id, session_id) exists — onConflict target for upserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'public.visitor_behavior_state'::regclass
      AND  contype  = 'u'
      AND  conname  = 'visitor_behavior_state_tenant_id_session_id_key'
  ) THEN
    ALTER TABLE public.visitor_behavior_state
      ADD CONSTRAINT visitor_behavior_state_tenant_id_session_id_key
      UNIQUE (tenant_id, session_id);
    RAISE NOTICE 'visitor_behavior_state: UNIQUE (tenant_id, session_id) added';
  ELSE
    RAISE NOTICE 'visitor_behavior_state: UNIQUE (tenant_id, session_id) already exists — skipped';
  END IF;
END $$;

-- Step 5: visitor_id is now a plain nullable column — no further action needed.
COMMENT ON COLUMN public.visitor_behavior_state.visitor_id IS
  'Stable visitor UUID (mc_visitor_id). NULL for sessions where the client never sent one.';
