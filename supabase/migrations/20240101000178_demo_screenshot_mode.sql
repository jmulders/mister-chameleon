-- Screenshot demo mode.
--
-- Adds a third demo_mode value ("screenshot") alongside "synthetic"/"mirror",
-- and a jsonb column holding the full-page screenshot URL + the vision-derived
-- personalization regions (bounding boxes as fractions + original text + the 6
-- scenario variants per region). The screenshot demo renders that payload as an
-- annotated-hotspot overlay instead of a cloned DOM.

-- 1) Relax the demo_mode CHECK to permit 'screenshot'.
ALTER TABLE demo_instances DROP CONSTRAINT IF EXISTS demo_instances_demo_mode_check;
ALTER TABLE demo_instances
  ADD CONSTRAINT demo_instances_demo_mode_check
  CHECK (demo_mode IN ('synthetic', 'mirror', 'screenshot'));

-- 2) Screenshot payload (null for non-screenshot demos).
ALTER TABLE demo_instances ADD COLUMN IF NOT EXISTS screenshot jsonb DEFAULT NULL;

COMMENT ON COLUMN demo_instances.screenshot IS
  'Screenshot demo payload: { screenshotUrl, width, height, regions: [{ slotKey, tag, box:{x,y,w,h fractions 0-1}, originalText, scenarios:{awareness,...} }] }. Null for non-screenshot modes.';
