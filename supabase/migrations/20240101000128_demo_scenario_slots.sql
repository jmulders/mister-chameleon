-- migration 128 — demo_instances: add scenario_slots column
--
-- Stores AI-generated slot content per blueprint scenario for mirror demos.
-- Shape: { "awareness": { "hero-title": "...", ... }, "high_intent": { ... }, ... }
--
-- This replaces the embedded SCENARIO_SLOTS JSON blob in the instrumented HTML,
-- keeping the HTML clean and enabling the scenario panel to load content via
-- the /api/snippet/decide endpoint (passing _demoId in context).

ALTER TABLE demo_instances
  ADD COLUMN IF NOT EXISTS scenario_slots JSONB DEFAULT NULL;
