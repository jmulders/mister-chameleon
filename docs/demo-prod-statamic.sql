-- Demo op prod zetten voor tenant "statamic" — VOLLEDIGE config (alle Quick Presets + 3 rollen)
-- Draai dit op de PROD-database (project kdhfpvjeriszteqhpgll) via de Supabase SQL-editor
-- of je eigen db-tooling. Idempotent: veilig om nogmaals te draaien.
--
-- Wat het doet:
--   1. Maakt/overschrijft rules_config 'homepage_statamic' met:
--        - de 41 preset-regels uit homepage_mister-chameleon (elke Quick Preset een variant), en
--        - de 3 rol-regels (marketeer/bureau/technisch),
--      allemaal HERNUMMERD naar unieke, opeenvolgende prioriteiten (rol-regels 0/1/2 vooraan).
--      Belangrijk: dubbele prioriteit laat de validator de HELE config afkeuren.
--   2. Voegt de 3 demo-rol-segmenten toe voor tenant 'statamic'.
--
-- Vereist dat homepage_mister-chameleon op prod de 41 preset-regels bevat (dat is zo).
-- De variant-COPY (hero/proof/cta-teksten, incl. careers + alle fallbacks) zit in de
-- Statamic-content (mister-chameleon-cms, home.md) en moet apart mee met de CMS-deploy.

-- 1a. Zorg dat de rij bestaat (skelet uit mister-chameleon: defaultPlan/schemaVersion).
insert into rules_config (key, config)
select 'homepage_statamic', config from rules_config where key = 'homepage_mister-chameleon'
on conflict (key) do nothing;

-- 1b. Rules-config voor statamic (volledige set, hernummerd)
update rules_config target
set config = jsonb_set(
  jsonb_set(
    coalesce(
      (select config from rules_config where key = 'homepage_statamic'),
      (select config from rules_config where key = 'homepage_mister-chameleon')
    ),
    '{rulesEnabled}', 'true'::jsonb
  ),
  '{rules}',
  (
    select jsonb_agg(jsonb_set(elem.rule, '{priority}', to_jsonb(elem.newprio)) order by elem.sortkey)
    from (
      select rr.rule, rr.rn::numeric as sortkey, (rr.rn - 1)::int as newprio
      from (select value as rule, row_number() over () rn
            from jsonb_array_elements('[
              {"id":"demo.role_marketeer","plan":{"ctaKey":"cta_demo","reason":"Demo-rol marketeer","heroKey":"hero_consideration","proofKey":"proof_default"},"label":"Demo-rol — Marketeer (eindklant)","reason":"Demo-rol: marketeer bij een eindklant.","source":"blueprint","enabled":true,"priority":0,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-marketeer","operator":"contains"},"precedenceLevel":"medium_segmentation"},
              {"id":"demo.role_bureau","plan":{"ctaKey":"cta_platform","reason":"Demo-rol bureau","heroKey":"hero_linkedin_vision","proofKey":"proof_default"},"label":"Demo-rol — Bureau-eigenaar","reason":"Demo-rol: bureau-eigenaar.","source":"blueprint","enabled":true,"priority":0,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-bureau","operator":"contains"},"precedenceLevel":"medium_segmentation"},
              {"id":"demo.role_technisch","plan":{"ctaKey":"cta_meeting","reason":"Demo-rol technisch","heroKey":"hero_google_problem","proofKey":"proof_default"},"label":"Demo-rol — Technisch verantwoordelijke","reason":"Demo-rol: technisch verantwoordelijke.","source":"blueprint","enabled":true,"priority":0,"condition":{"type":"field","field":"audienceSegmentIds","value":"demo-role-technisch","operator":"contains"},"precedenceLevel":"medium_segmentation"}
            ]'::jsonb)) rr
      union all
      select pr.rule, (100 + pr.rk)::numeric, (2 + pr.rk)::int
      from (select r as rule, row_number() over (order by (r->>'priority')::int) rk
            from rules_config c, lateral jsonb_array_elements(c.config->'rules') r
            where c.key = 'homepage_mister-chameleon') pr
    ) elem
  )
)
where target.key = 'homepage_statamic';

-- 2. Demo-rol-segmenten voor tenant statamic
insert into audience_segments (id, tenant_id, key, label, description, criteria, is_active)
values
  (gen_random_uuid(), 'statamic', 'demo-role-marketeer', 'Demo — Marketeer (eindklant)',        'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true),
  (gen_random_uuid(), 'statamic', 'demo-role-bureau',    'Demo — Bureau-eigenaar',               'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true),
  (gen_random_uuid(), 'statamic', 'demo-role-technisch', 'Demo — Technisch verantwoordelijke',   'Demo-rol voor de rollen-schakelaar.', '{}'::jsonb, true)
on conflict (tenant_id, key) do nothing;

-- 3. Verificatie (verwacht: 44 regels, 44 unieke prioriteiten; rol-regels op 0/1/2)
select jsonb_array_length(config->'rules') as n_rules,
       (select count(distinct (r->>'priority')::int) from jsonb_array_elements(config->'rules') r) as distinct_prios
from rules_config where key = 'homepage_statamic';
