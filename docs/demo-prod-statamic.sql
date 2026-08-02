-- Demo op prod zetten voor tenant "statamic"
-- Draai dit op de PROD-database (project kdhfpvjeriszteqhpgll) via de Supabase SQL-editor
-- of je eigen db-tooling. Idempotent: veilig om nogmaals te draaien.
--
-- Wat het doet:
--   1. Maakt/overschrijft rules_config 'homepage_statamic' met de 3 schone rol-regels
--      (distincte prioriteiten 0/1/2 — dubbele prioriteit laat de validator de HELE
--      config afkeuren). Neemt defaultPlan/schemaVersion over van homepage_mister-chameleon.
--   2. Voegt de 3 demo-rol-segmenten toe voor tenant 'statamic'.
--
-- Let op: de rol-COPY (hero/cta-teksten) zit in de Statamic-content (mister-chameleon-cms,
-- home.md) en moet apart mee met de CMS-deploy. En de app-code (rollen-schakelaar,
-- profielpaneel, inklap, presets) moet gedeployed zijn.

-- 1. Rules-config voor statamic
insert into rules_config (key, config)
select 'homepage_statamic',
  jsonb_set(
    jsonb_set(config, '{rulesEnabled}', 'true'::jsonb),
    '{rules}',
    '[
      {"id":"demo.role_marketeer","plan":{"ctaKey":"cta_demo","reason":"Demo-rol marketeer","heroKey":"hero_consideration","proofKey":"proof_default"},"label":"Demo-rol — Marketeer (eindklant)","reason":"Demo-rol: marketeer bij een eindklant.","source":"blueprint","enabled":true,"priority":0,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-marketeer","operator":"contains"},"precedenceLevel":"medium_segmentation"},
      {"id":"demo.role_bureau","plan":{"ctaKey":"cta_platform","reason":"Demo-rol bureau","heroKey":"hero_linkedin_vision","proofKey":"proof_default"},"label":"Demo-rol — Bureau-eigenaar","reason":"Demo-rol: bureau-eigenaar.","source":"blueprint","enabled":true,"priority":1,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-bureau","operator":"contains"},"precedenceLevel":"medium_segmentation"},
      {"id":"demo.role_technisch","plan":{"ctaKey":"cta_meeting","reason":"Demo-rol technisch","heroKey":"hero_google_problem","proofKey":"proof_default"},"label":"Demo-rol — Technisch verantwoordelijke","reason":"Demo-rol: technisch verantwoordelijke.","source":"blueprint","enabled":true,"priority":2,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-technisch","operator":"contains"},"precedenceLevel":"medium_segmentation"}
    ]'::jsonb
  )
from rules_config where key = 'homepage_mister-chameleon'
on conflict (key) do update set config = excluded.config;

-- 2. Demo-rol-segmenten voor tenant statamic
insert into audience_segments (id, tenant_id, key, label, description, criteria, is_active)
values
  (gen_random_uuid(), 'statamic', 'demo-role-marketeer', 'Demo — Marketeer (eindklant)',        'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true),
  (gen_random_uuid(), 'statamic', 'demo-role-bureau',    'Demo — Bureau-eigenaar',               'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true),
  (gen_random_uuid(), 'statamic', 'demo-role-technisch', 'Demo — Technisch verantwoordelijke',   'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true)
on conflict (tenant_id, key) do nothing;

-- 3. Verificatie
select r->>'id' as rule_id, (r->>'priority')::int as prio, r->'plan'->>'heroKey' as hero
from rules_config c, lateral jsonb_array_elements(c.config->'rules') r
where c.key = 'homepage_statamic' order by prio;
