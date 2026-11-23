-- Drie demorollen voor misterchameleon.nl, elk met een eigen banner.
--
-- In het paneel Scenario Control kiest een bezoeker onder "Who are you?" wie hij
-- is. Daar stond alleen Marketer. De rollen Agency owner en Technical lead
-- bestonden al, met een eigen regel, maar die regels kozen een banner die voor
-- iets anders geschreven is (LinkedIn, Google). De marketeer kreeg de algemene
-- banner "Vergelijk en kies".
--
-- Dit doet drie dingen voor tenant 'statamic':
--   1. drie banners, een per rol (hero_role_marketeer, _bureau, _technisch);
--   2. de drie regels demo.role_* wijzen naar hun eigen banner, met een bewijs
--      en een call to action die erbij passen;
--   3. de twee rollen die uit stonden gaan aan in het paneel.
--
-- Eerst moet de platformversie live zijn die deze drie bannersleutels kent.
-- Twee keer draaien kan geen kwaad. Zichtbaar binnen twee minuten.
--
-- Draaien in Supabase, project mister-chameleon-prod, SQL Editor.

begin;

-- 1. De banners.
insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_role_marketeer', 'statamic', 'Demo-rol Marketeer', true,
        $mc${"tag": "Voor marketeers", "title": "Meer uit elke klik", "subtitle": "Je betaalt voor elke bezoeker. Laat je site dan aansluiten op de campagne waar hij vandaan komt. Je stelt het zelf in met keuzelijsten, zonder developer.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Bekijk de functies", "href": "/functies"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-jurk-2.svg", "kind": "image"}, "contentAlign": "left", "layoutVariant": "hero_split"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_role_bureau', 'statamic', 'Demo-rol Bureau', true,
        $mc${"tag": "Voor bureaus", "title": "Al je klanten op één plek", "subtitle": "Je beheert de sites van al je klanten vanuit één omgeving. Elke klant heeft zijn eigen gegevens, regels en cijfers. Dat zit in het pakket Pro.", "ctas": [{"label": "Plan een demo", "href": "/demo"}, {"label": "Lees de toepassing", "href": "/cases/klantsites-in-een-omgeving"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-vest-2.svg", "kind": "image"}, "contentAlign": "left", "layoutVariant": "hero_split"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

insert into adaptive_blocks (key, tenant_id, label, is_active, default_variant)
values ('hero_role_technisch', 'statamic', 'Demo-rol Technisch', true,
        $mc${"tag": "Voor developers", "title": "Koppel in drie stappen", "subtitle": "Een add-on voor Statamic, een plugin voor WordPress of één regel code voor elke andere site. Je site blijft zoals hij is. In Statamic valt de keuze op de server, dus de pagina verspringt niet.", "ctas": [{"label": "Bekijk de integraties", "href": "/integraties"}, {"label": "Zo werkt het", "href": "/hoe-het-werkt"}], "media": {"alt": "", "url": "https://cms.misterchameleon.nl/assets/mc-rond-bezoeker-streep-2.svg", "kind": "image"}, "contentAlign": "left", "layoutVariant": "hero_split"}$mc$::jsonb)
on conflict on constraint adaptive_blocks_key_tenant_unique
do update set default_variant = excluded.default_variant,
       label      = excluded.label,
       is_active  = true,
       updated_at = now();

-- 2. De regels. Alleen de drie rolregels veranderen, de volgorde blijft gelijk.
--    updatedAt in de configuratie gaat mee omhoog: daar hangt de versie aan
--    waaronder een server de regels onthoudt.
update rules_config
set config = jsonb_set(jsonb_set(config, '{rules}', (
      select jsonb_agg(
        case r->>'id'
      when 'demo.role_marketeer' then jsonb_set(r, '{plan}', (r->'plan') || '{"heroKey": "hero_role_marketeer", "proofKey": "proof_default", "ctaKey": "cta_demo"}'::jsonb)
      when 'demo.role_bureau' then jsonb_set(r, '{plan}', (r->'plan') || '{"heroKey": "hero_role_bureau", "proofKey": "proof_cases", "ctaKey": "cta_meeting"}'::jsonb)
      when 'demo.role_technisch' then jsonb_set(r, '{plan}', (r->'plan') || '{"heroKey": "hero_role_technisch", "proofKey": "proof_platform", "ctaKey": "cta_guide"}'::jsonb)
          else r
        end
        order by ord)
      from jsonb_array_elements(config->'rules') with ordinality as t(r, ord))),
      '{updatedAt}', to_jsonb(now()::text)),
    updated_at = now()
where key = 'homepage_statamic';

-- 3. De rollen in het paneel. De rest van scenarioPanel blijft staan.
update tenant_settings
set settings = jsonb_set(
      settings,
      '{scenarioPanel}',
      coalesce(settings->'scenarioPanel', '{}'::jsonb)
        || '{"roleKeys": ["demo_role_marketeer", "demo_role_bureau", "demo_role_technisch"]}'::jsonb)
where tenant_id = 'statamic';

commit;
